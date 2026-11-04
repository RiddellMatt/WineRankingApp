export type ShareCardFormatId = 'instagram-post' | 'instagram-story' | 'tiktok' | 'square'

export interface ShareCardFormat {
  id: ShareCardFormatId
  /** Short label under the icon */
  label: string
  /** Aspect hint shown in UI */
  aspectLabel: string
  width: number
  height: number
  filenameSuffix: string
}

export const SHARE_CARD_FORMATS: ShareCardFormat[] = [
  {
    id: 'instagram-post',
    label: 'IG Post',
    aspectLabel: '4:5',
    width: 1080,
    height: 1350,
    filenameSuffix: 'ig-post',
  },
  {
    id: 'instagram-story',
    label: 'IG Story',
    aspectLabel: '9:16',
    width: 1080,
    height: 1920,
    filenameSuffix: 'ig-story',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    aspectLabel: '9:16',
    width: 1080,
    height: 1920,
    filenameSuffix: 'tiktok',
  },
  {
    id: 'square',
    label: 'Square',
    aspectLabel: '1:1',
    width: 1080,
    height: 1080,
    filenameSuffix: 'square',
  },
]

export function shareCardFormatById(id: ShareCardFormatId): ShareCardFormat {
  return SHARE_CARD_FORMATS.find((f) => f.id === id) ?? SHARE_CARD_FORMATS[0]!
}

export interface ShareCardLayout {
  format: ShareCardFormat
  panelX: number
  panelY: number
  panelW: number
  panelH: number
  maxTasteRows: number
  maxNoteLinesWithTaste: number
  maxNoteLinesNoTaste: number
  /** Multiplier for typography and spacing inside the panel */
  scale: number
}

export function layoutForShareFormat(id: ShareCardFormatId): ShareCardLayout {
  const format = shareCardFormatById(id)
  const panelX = 72
  const panelW = format.width - panelX * 2

  switch (id) {
    case 'instagram-story':
    case 'tiktok':
      return {
        format,
        panelX,
        panelY: 360,
        panelW,
        panelH: 1120,
        maxTasteRows: 3,
        maxNoteLinesWithTaste: 2,
        maxNoteLinesNoTaste: 4,
        scale: 1,
      }
    case 'square':
      return {
        format,
        panelX,
        panelY: 88,
        panelW,
        panelH: 820,
        maxTasteRows: 2,
        maxNoteLinesWithTaste: 1,
        maxNoteLinesNoTaste: 2,
        scale: 0.9,
      }
    case 'instagram-post':
    default:
      return {
        format,
        panelX,
        panelY: 150,
        panelW,
        panelH: 920,
        maxTasteRows: 4,
        maxNoteLinesWithTaste: 2,
        maxNoteLinesNoTaste: 6,
        scale: 1,
      }
  }
}
