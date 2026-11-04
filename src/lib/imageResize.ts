const DEFAULT_MAX_DIMENSION = 1600
const DEFAULT_QUALITY = 0.85

async function loadImageBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error('Could not load image'))
        el.src = url
      })
      return await createImageBitmap(img)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      if (typeof dataUrl !== 'string') {
        reject(new Error('Could not encode image'))
        return
      }
      const comma = dataUrl.indexOf(',')
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl)
    }
    reader.onerror = () => reject(new Error('Could not encode image'))
    reader.readAsDataURL(blob)
  })
}

/** Downscale and re-encode as JPEG so menu photos stay under Edge Function limits. */
export async function resizeImageForUpload(
  file: File,
  maxDimension = DEFAULT_MAX_DIMENSION,
  quality = DEFAULT_QUALITY,
): Promise<{ base64: string; mimeType: string }> {
  const bitmap = await loadImageBitmap(file)
  let { width, height } = bitmap
  const scale = Math.min(1, maxDimension / Math.max(width, height))
  width = Math.round(width * scale)
  height = Math.round(height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Could not prepare image for upload.')
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const mimeType = 'image/jpeg'
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (encoded) => (encoded ? resolve(encoded) : reject(new Error('Could not encode image'))),
      mimeType,
      quality,
    )
  })

  return { base64: await blobToBase64(blob), mimeType }
}

/** Downscale a photo before on-device OCR (same limits as AI upload). */
export async function resizeImageFile(
  file: File,
  maxDimension = DEFAULT_MAX_DIMENSION,
  quality = DEFAULT_QUALITY,
): Promise<File> {
  const { base64, mimeType } = await resizeImageForUpload(file, maxDimension, quality)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'scan'
  return new File([bytes], `${baseName}.jpg`, { type: mimeType })
}
