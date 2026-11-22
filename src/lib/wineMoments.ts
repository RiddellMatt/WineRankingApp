/** Calendar day the bottle was tasted, plus optional photos on the cellar card. */

export const MAX_WINE_PHOTOS = 12

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function normalizeTriedOn(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = ISO_DATE.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return value
}

export function formatTriedOn(iso: string): string {
  const parsed = normalizeTriedOn(iso)
  if (!parsed) return iso
  const [year, month, day] = parsed.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function isoDateFromLocal(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isFutureDay(date: Date): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return day.getTime() > today.getTime()
}

export function normalizeWinePhotos(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const photos: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    if (!item.startsWith('data:image/') && !item.startsWith('https://')) continue
    photos.push(item)
    if (photos.length >= MAX_WINE_PHOTOS) break
  }
  return photos
}
