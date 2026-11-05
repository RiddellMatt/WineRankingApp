import { prepareImageForAiScan } from './aiScanImage'
import { getSupabase } from './supabase'

const SCAN_BUCKET = 'ai-scan-uploads'

export type AiScanInvokeBody = {
  mimeType: string
  imageBase64?: string
  storagePath?: string
}

/** Prefer Storage upload (tiny JSON body); fall back to inline base64 when bucket is unavailable. */
export async function buildAiScanInvokeBody(file: File): Promise<AiScanInvokeBody> {
  const { base64, mimeType, blob } = await prepareImageForAiScan(file)
  const supabase = getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { mimeType, imageBase64: base64 }
  }

  const storagePath = `${user.id}/${crypto.randomUUID()}.jpg`
  const { error: uploadError } = await supabase.storage.from(SCAN_BUCKET).upload(storagePath, blob, {
    contentType: mimeType,
    upsert: false,
  })

  if (!uploadError) {
    return { mimeType, storagePath }
  }

  // Bucket missing or policy not applied yet — inline body (heavily compressed).
  console.warn('[ai-scan] Storage upload failed, using inline image body:', uploadError.message)
  return { mimeType, imageBase64: base64 }
}
