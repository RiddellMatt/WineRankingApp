import { resizeImageForUpload } from './imageResize'

/** Keep invoke JSON small enough for iOS WKWebView fetch (inline base64 fallback). */
export const AI_SCAN_MAX_INLINE_BASE64_CHARS = 1_200_000

/** Compress a menu/label photo for AI vision APIs. */
export async function prepareImageForAiScan(
  file: File,
): Promise<{ base64: string; mimeType: string; blob: Blob }> {
  const attempts: [number, number][] = [
    [1120, 0.72],
    [960, 0.65],
    [800, 0.6],
    [720, 0.55],
  ]

  let last: { base64: string; mimeType: string } | null = null
  for (const [maxDimension, quality] of attempts) {
    last = await resizeImageForUpload(file, maxDimension, quality)
    if (last.base64.length <= AI_SCAN_MAX_INLINE_BASE64_CHARS) {
      break
    }
  }

  if (!last || last.base64.length > AI_SCAN_MAX_INLINE_BASE64_CHARS) {
    throw new Error('Photo is too large. Try a closer crop or retake in good light.')
  }

  const binary = atob(last.base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return {
    base64: last.base64,
    mimeType: last.mimeType,
    blob: new Blob([bytes], { type: last.mimeType }),
  }
}
