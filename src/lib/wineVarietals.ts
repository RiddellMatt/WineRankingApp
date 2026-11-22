import { VARIETALS } from '../scanner'
import type { WineType } from '../types'

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
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Spellings that should share one dropdown row. The value is the canonical key
 * after accent stripping, not the display label.
 */
const VARIETAL_ALIAS_KEY: Record<string, string> = {
  'white bordeaux': 'bordeaux blanc',
  'red bordeaux': 'bordeaux blend',
  meritage: 'bordeaux blend',
  'ugni blanc': 'trebbiano',
  'muller thurgau': 'muller-thurgau',
  carignane: 'carignan',
}

/** Preferred label when multiple spellings map to the same grape. */
const PREFERRED_VARIETAL_LABEL: Record<string, string> = {
  albarino: 'Albariño',
  gruner: 'Grüner Veltliner',
  'gruner veltliner': 'Grüner Veltliner',
  gewurztraminer: 'Gewürztraminer',
  mourvedre: 'Mourvèdre',
  carmenere: 'Carménère',
  semillon: 'Sémillon',
  'bordeaux blanc': 'Bordeaux Blanc',
  'bordeaux blend': 'Bordeaux Blend',
  torrontes: 'Torrontés',
  'muller-thurgau': 'Müller-Thurgau',
  aligote: 'Aligoté',
  mencia: 'Mencía',
  cremant: 'Crémant',
  'rhone blend': 'Rhône Blend',
  gsm: 'GSM',
  blaufrankisch: 'Blaufränkisch',
  'melon de bourgogne': 'Melon de Bourgogne',
  'greco di tufo': 'Greco di Tufo',
  'blanc de blancs': 'Blanc de Blancs',
  'blanc de noirs': 'Blanc de Noirs',
}

const EXTRA_PICKER_OPTIONS: [string, string][] = [
  ['red blend', 'Red Blend'],
  ['white blend', 'White Blend'],
]

function canonicalKey(raw: string): string {
  const key = varietalOptionKey(raw)
  return VARIETAL_ALIAS_KEY[key] ?? key
}

function buildVarietalCatalog(): { options: string[]; types: Map<string, WineType> } {
  const byKey = new Map<string, string>()
  const types = new Map<string, WineType>()
  for (const [raw, type] of VARIETALS) {
    const key = canonicalKey(raw)
    if (!key) continue
    if (!types.has(key)) types.set(key, type)
    const label = PREFERRED_VARIETAL_LABEL[key] ?? titleCase(raw)
    const existing = byKey.get(key)
    if (!existing || (PREFERRED_VARIETAL_LABEL[key] && existing !== PREFERRED_VARIETAL_LABEL[key])) {
      byKey.set(key, label)
    }
  }
  for (const [key, label] of EXTRA_PICKER_OPTIONS) {
    if (!byKey.has(key)) byKey.set(key, label)
  }
  const options = [...byKey.values()].sort((a, b) => a.localeCompare(b))
  return { options, types }
}

const CATALOG = buildVarietalCatalog()

/** Sorted unique grape / style names for form pickers. */
export const WINE_VARIETAL_OPTIONS: string[] = CATALOG.options

export const VARIETAL_CUSTOM = '__custom__'

export function varietalMatchesOption(value: string, option: string): boolean {
  return canonicalKey(value) === canonicalKey(option)
}

/** The dropdown label for a known grape or blend, or the trimmed text when it is custom. */
export function canonicalVarietal(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const key = canonicalKey(trimmed)
  return WINE_VARIETAL_OPTIONS.find((option) => canonicalKey(option) === key) ?? trimmed
}

export function isListedVarietal(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  const listed = canonicalVarietal(trimmed)
  return canonicalKey(listed) === canonicalKey(trimmed) && WINE_VARIETAL_OPTIONS.some((option) => option === listed)
}

export function typeForVarietal(value: string): WineType | undefined {
  const listed = canonicalVarietal(value)
  if (!isListedVarietal(listed)) return undefined
  return CATALOG.types.get(canonicalKey(listed))
}