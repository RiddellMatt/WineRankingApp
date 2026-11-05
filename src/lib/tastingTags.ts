import type { Wine } from '../types'
import { STORAGE_PREFIX } from '../brand'

export interface TastingTagDef {
  id: string
  label: string
}

/**
 * Free plan: flavor/aroma tags only — not body, tannin, sweetness, or acidity
 * (those use the taste sliders: Light/Bold, Smooth/Tannic, Dry/Sweet, Soft/Acidic).
 */
export const FREE_TASTING_TAGS: TastingTagDef[] = [
  { id: 'fruity', label: 'Fruity' },
  { id: 'oaky', label: 'Oaky' },
  { id: 'earthy', label: 'Earthy' },
  { id: 'floral', label: 'Floral' },
  { id: 'spicy', label: 'Spicy' },
  { id: 'mineral', label: 'Mineral' },
  { id: 'nutty', label: 'Nutty' },
  { id: 'citrus', label: 'Citrus' },
]

/** Pro: extra fruit and winemaking notes — still no slider overlap. */
export const PRO_TASTING_TAGS: TastingTagDef[] = [
  { id: 'cherry', label: 'Cherry' },
  { id: 'berry', label: 'Berry' },
  { id: 'tropical', label: 'Tropical' },
  { id: 'stone-fruit', label: 'Stone fruit' },
  { id: 'vanilla', label: 'Vanilla' },
  { id: 'honey', label: 'Honey' },
  { id: 'herbal', label: 'Herbal' },
  { id: 'smoky', label: 'Smoky' },
  { id: 'peppery', label: 'Peppery' },
  { id: 'chocolate', label: 'Chocolate' },
]

const CUSTOM_TAGS_KEY = `${STORAGE_PREFIX}.custom-tasting-tags`

const ALL_BUILTIN = [...FREE_TASTING_TAGS, ...PRO_TASTING_TAGS]
const builtinById = new Map(ALL_BUILTIN.map((t) => [t.id, t]))

export function normalizeTastingTagId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 32)
}

export function tastingTagLabel(id: string): string {
  const built = builtinById.get(id)
  if (built) return built.label
  if (id.startsWith('custom:')) {
    return id.slice('custom:'.length).replace(/-/g, ' ')
  }
  return id.replace(/-/g, ' ')
}

export function loadCustomTastingTags(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TAGS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((t) => typeof t === 'string' && t.startsWith('custom:'))
  } catch {
    return []
  }
}

export function saveCustomTastingTags(tags: string[]): void {
  localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(tags))
}

export function catalogTags(pro: boolean): TastingTagDef[] {
  const list = pro
    ? [...FREE_TASTING_TAGS, ...PRO_TASTING_TAGS]
    : [...FREE_TASTING_TAGS]
  if (pro) {
    for (const id of loadCustomTastingTags()) {
      if (!list.some((t) => t.id === id)) {
        list.push({ id, label: tastingTagLabel(id) })
      }
    }
  }
  return list
}

export function countTagUsage(wines: Wine[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const wine of wines) {
    for (const id of wine.tastingTags ?? []) {
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  return counts
}

/** Sort tag ids by how often they appear in the cellar (most used first). */
export function sortTagsByFrequency(tagIds: string[], wines: Wine[]): string[] {
  const counts = countTagUsage(wines)
  return [...tagIds].sort((a, b) => {
    const diff = (counts.get(b) ?? 0) - (counts.get(a) ?? 0)
    if (diff !== 0) return diff
    return tastingTagLabel(a).localeCompare(tastingTagLabel(b))
  })
}

/** Tags used in tried wines, ordered for filter chips (most frequent first). */
export function filterTagsForCellar(triedWines: Wine[], pro: boolean): TastingTagDef[] {
  const counts = countTagUsage(triedWines)
  const usedIds = [...counts.keys()].filter((id) => (counts.get(id) ?? 0) > 0)
  const ordered = sortTagsByFrequency(usedIds, triedWines)
  const catalog = catalogTags(pro)
  return ordered.map(
    (id) => catalog.find((t) => t.id === id) ?? { id, label: tastingTagLabel(id) },
  )
}

export function wineMatchesTagFilter(wine: Wine, tagFilter: string | null): boolean {
  if (!tagFilter) return true
  return (wine.tastingTags ?? []).includes(tagFilter)
}

export function normalizeTastingTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const id = item.startsWith('custom:') ? item : normalizeTastingTagId(item)
    if (!id) continue
    if (!out.includes(id)) out.push(id)
  }
  return out
}

export function addCustomTastingTag(label: string, pro: boolean): string | null {
  if (!pro) return null
  const slug = normalizeTastingTagId(label)
  if (!slug) return null
  const id = `custom:${slug}`
  const existing = loadCustomTastingTags()
  if (!existing.includes(id)) {
    saveCustomTastingTags([...existing, id])
  }
  return id
}
