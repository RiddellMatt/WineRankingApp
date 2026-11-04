import { APP_NAME } from '../brand'
import { nativePlatform } from './platform'
import { renderShareWineCard, shareWineCardFilename, type ShareWineCardInput } from './shareWineCard'

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Could not read share image.'))
    }
    reader.onerror = () => reject(new Error('Could not read share image.'))
    reader.readAsDataURL(blob)
  })
}

async function androidDecantiAlbumId(): Promise<string> {
  const { Media } = await import('@capacitor-community/media')
  const { albums } = await Media.getAlbums()
  const existing = albums.find((a) => a.name === APP_NAME)
  if (existing) return existing.identifier

  await Media.createAlbum({ name: APP_NAME })
  const { albums: refreshed } = await Media.getAlbums()
  const created = refreshed.find((a) => a.name === APP_NAME)
  if (!created) throw new Error('Could not create a photo album for Decanti.')
  return created.identifier
}

/** Saves the rendered wine card PNG to the device photo library (iOS / Android). */
export async function saveWineCardToPhotos(input: ShareWineCardInput): Promise<void> {
  const blob = await renderShareWineCard(input)
  const path = await blobToDataUrl(blob)
  const { Media } = await import('@capacitor-community/media')

  const baseName = shareWineCardFilename(input.wine).replace(/\.png$/i, '')

  if (nativePlatform() === 'android') {
    const albumIdentifier = await androidDecantiAlbumId()
    await Media.savePhoto({ path, albumIdentifier, fileName: baseName })
    return
  }

  await Media.savePhoto({ path })
}
