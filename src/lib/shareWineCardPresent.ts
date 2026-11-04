import { APP_NAME } from '../brand'
import { isNativeApp } from './platform'
import type { ShareCardFormatId } from './shareCardFormats'
import {
  renderShareWineCard,
  shareWineCardFilename,
  type ShareWineCardInput,
} from './shareWineCard'

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Could not read share image.'))
        return
      }
      const base64 = result.includes(',') ? result.split(',')[1]! : result
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Could not read share image.'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Renders the card for the platform size, then opens the **system share sheet**
 * (Instagram, Messages, Mail, etc.) — same handoff as Beli after you pick IG Post / Story.
 */
export async function presentWineCardShareSheet(
  input: ShareWineCardInput,
  formatId: ShareCardFormatId,
): Promise<'shared' | 'downloaded'> {
  const blob = await renderShareWineCard(input, formatId)
  const filename = shareWineCardFilename(input.wine, formatId)
  const title = input.wine.vintage ? `${input.wine.name} ${input.wine.vintage}` : input.wine.name
  const text = `${title} — ${input.score.toFixed(1)}★ on ${APP_NAME}`

  if (isNativeApp()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const data = await blobToBase64(blob)
    const written = await Filesystem.writeFile({
      path: filename,
      data,
      directory: Directory.Cache,
    })
    await Share.share({
      title,
      text,
      files: [written.uri],
      dialogTitle: 'Share this page',
    })
    return 'shared'
  }

  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title, text })
    return 'shared'
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
