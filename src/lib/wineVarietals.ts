import { VARIETALS } from '../scanner'

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s\-'''])\p{L}/gu, (c) => c.toUpperCase())
}

/** Collapse accent/spelling variants (e.g. albarino vs albariño) for list dedupe. */
export function varietalOptionKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

/** Preferred label when multiple spellings map to the same grape. */
const PREFERRED_VARIETAL_LABEL: Record<string, string> = {
  albarino: 'Albariño',
  gruner: 'Grüner Veltliner',
  'gruner veltliner': 'Grüner Veltliner',
  gewurztraminer: 'Gewürztraminer',
  mourvedre: 'Mourvèdre',
  carmenere: 'Carménère',
}

const EXTRA_PICKER_OPTIONS: [string, string][] = [
  ['red blend', 'Red Blend'],
  ['white blend', 'White Blend'],
]

function buildVarietalOptions(): string[] {
  const byKey = new Map<string, string>()
  for (const [raw] of VARIETALS) {
    const key = varietalOptionKey(raw)
    if (!key) continue
    const label = PREFERRED_VARIETAL_LABEL[key] ?? titleCase(raw)
    const existing = byKey.get(key)
    if (!existing || label.length > existing.length) {
      byKey.set(key, label)
    }
  }
  for (const [key, label] of EXTRA_PICKER_OPTIONS) {
    if (!byKey.has(key)) byKey.set(key, label)
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b))
}

/** Sorted unique grape / style names for form pickers. */
export const WINE_VARIETAL_OPTIONS: string[] = buildVarietalOptions()

export const VARIETAL_CUSTOM = '__custom__'

export function varietalMatchesOption(value: string, option: string): boolean {
  return varietalOptionKey(value) === varietalOptionKey(option)
}