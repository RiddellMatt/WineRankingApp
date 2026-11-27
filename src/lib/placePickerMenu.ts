import type { MapPlace } from './placeSearch'

export type PlaceMenuItem =
  | { kind: 'recent'; label: string }
  | { kind: 'place'; id: string; title: string; subtitle: string; label: string }
  | { kind: 'custom'; label: string }
  | { kind: 'locate' }

function samePlace(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/**
 * Suggestions for the drink-location field.
 * Recents keep filtering as the person types. A typed name that is not already
 * in the list can be saved as-is. Map matches join once the query is long enough.
 */
export function buildPlaceMenu(input: {
  text: string
  dirty: boolean
  value: string
  recentPlaces: string[]
  results: MapPlace[]
}): PlaceMenuItem[] {
  const query = input.dirty ? input.text.trim() : ''
  const queryKey = query.toLowerCase()
  const seen = new Set<string>()
  const items: PlaceMenuItem[] = []

  for (const place of input.recentPlaces) {
    const label = place.trim()
    if (!label) continue
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    if (!input.dirty && samePlace(label, input.value)) continue
    if (queryKey && !key.includes(queryKey)) continue
    seen.add(key)
    items.push({ kind: 'recent', label })
    if (items.length === 4) break
  }

  if (query.length >= 2) {
    for (const place of input.results) {
      const label = place.label.trim()
      const key = label.toLowerCase()
      if (!label || seen.has(key)) continue
      seen.add(key)
      items.push({
        kind: 'place',
        id: place.id,
        title: place.title,
        subtitle: place.subtitle,
        label,
      })
    }
  }

  if (query && !seen.has(queryKey)) {
    items.push({ kind: 'custom', label: query })
  }

  items.push({ kind: 'locate' })
  return items
}
