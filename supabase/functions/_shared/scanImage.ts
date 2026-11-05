import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const SCAN_BUCKET = 'ai-scan-uploads'

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

export async function resolveScanImageFromBody(
  admin: SupabaseClient,
  userId: string,
  body: { imageBase64?: string; storagePath?: string; mimeType?: string },
): Promise<{ imageBase64: string; mimeType: string; cleanupPath?: string }> {
  const mimeType = String(body.mimeType ?? 'image/jpeg')
  const storagePath = body.storagePath ? String(body.storagePath) : ''

  if (storagePath) {
    if (!storagePath.startsWith(`${userId}/`)) {
      throw new Error('Invalid upload path.')
    }
    const { data, error } = await admin.storage.from(SCAN_BUCKET).download(storagePath)
    if (error || !data) {
      throw new Error('Could not read uploaded photo. Try again.')
    }
    const bytes = new Uint8Array(await data.arrayBuffer())
    return {
      imageBase64: bytesToBase64(bytes),
      mimeType,
      cleanupPath: storagePath,
    }
  }

  const imageBase64 = String(body.imageBase64 ?? '')
  if (!imageBase64) {
    throw new Error('Image is missing.')
  }
  return { imageBase64, mimeType }
}

export async function deleteScanUpload(admin: SupabaseClient, path: string | undefined): Promise<void> {
  if (!path) return
  await admin.storage.from(SCAN_BUCKET).remove([path])
}
