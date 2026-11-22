import { resizeImageFile } from './imageResize'
import { getSupabase } from './supabase'
import { MAX_WINE_PHOTOS, normalizeWinePhotos } from './wineMoments'
import type { Wine } from '../types'

export const WINE_PHOTO_BUCKET = 'wine-photos'

const PUBLIC_MARKER = `/storage/v1/object/public/${WINE_PHOTO_BUCKET}/`

function photoSetupError(error: { message: string }): Error {
  const msg = error.message.toLowerCase()
  if (msg.includes('bucket not found') || msg.includes('row-level security')) {
    return new Error('Photo upload is not available yet.')
  }
  return new Error(error.message)
}

export async function fileToWinePhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a photo.')
  }
  const resized = await resizeImageFile(file, 1280, 0.72)
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Could not read that photo.'))
    }
    reader.onerror = () => reject(new Error('Could not read that photo.'))
    reader.readAsDataURL(resized)
  })
}

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',')
  const header = comma >= 0 ? dataUrl.slice(0, comma) : ''
  const data = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const mime = /data:(.*?);/.exec(header)?.[1] || 'image/jpeg'
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function storagePathFromPublicUrl(url: string): string | null {
  const index = url.indexOf(PUBLIC_MARKER)
  if (index < 0) return null
  const path = url.slice(index + PUBLIC_MARKER.length).split('?')[0]
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

async function uploadDataUrl(userId: string, wineId: string, dataUrl: string): Promise<string> {
  const supabase = getSupabase()
  const path = `${userId}/${wineId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(WINE_PHOTO_BUCKET).upload(path, dataUrlToBlob(dataUrl), {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (error) throw photoSetupError(error)
  const { data } = supabase.storage.from(WINE_PHOTO_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

async function removeDroppedPhotos(userId: string, wineId: string, kept: string[]): Promise<void> {
  const folder = `${userId}/${wineId}`
  const keptPaths = new Set(
    kept.map(storagePathFromPublicUrl).filter((path): path is string => path?.startsWith(`${folder}/`) ?? false),
  )
  const { data, error } = await getSupabase().storage.from(WINE_PHOTO_BUCKET).list(folder)
  if (error || !data?.length) return
  const drop = data
    .filter((file) => file.name && !keptPaths.has(`${folder}/${file.name}`))
    .map((file) => `${folder}/${file.name}`)
  if (drop.length === 0) return
  await getSupabase().storage.from(WINE_PHOTO_BUCKET).remove(drop)
}

/** Upload new data-URL photos and drop storage files the card no longer uses. */
export async function persistWinePhotos(userId: string, wine: Wine): Promise<Wine> {
  const photos = normalizeWinePhotos(wine.photos).slice(0, MAX_WINE_PHOTOS)
  const next: string[] = []
  for (const photo of photos) {
    if (photo.startsWith('data:')) {
      next.push(await uploadDataUrl(userId, wine.id, photo))
    } else {
      next.push(photo)
    }
  }
  try {
    await removeDroppedPhotos(userId, wine.id, next)
  } catch {
    // A leftover file should not block saving the bottle.
  }
  return { ...wine, photos: next }
}

export async function removeWinePhotoFolder(userId: string, wineId: string): Promise<void> {
  const folder = `${userId}/${wineId}`
  const { data, error } = await getSupabase().storage.from(WINE_PHOTO_BUCKET).list(folder)
  if (error || !data?.length) return
  const paths = data.filter((file) => file.name).map((file) => `${folder}/${file.name}`)
  if (paths.length === 0) return
  await getSupabase().storage.from(WINE_PHOTO_BUCKET).remove(paths)
}
