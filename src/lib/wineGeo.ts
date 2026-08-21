import { containsPhrase } from '../textMatch'
import type { Wine, WineType } from '../types'

/** Wine region keywords → country (longest match wins). */
const REGION_COUNTRY: readonly (readonly [string, string])[] = [
  ['napa valley', 'United States'],
  ['willamette valley', 'United States'],
  ['columbia valley', 'United States'],
  ['paso robles', 'United States'],
  ['russian river', 'United States'],
  ['santa barbara', 'United States'],
  ['finger lakes', 'United States'],
  ['sonoma', 'United States'],
  ['mendocino', 'United States'],
  ['swartland', 'South Africa'],
  ['stellenbosch', 'South Africa'],
  ['saint-émilion', 'France'],
  ['saint-emilion', 'France'],
  ['ribera del duero', 'Spain'],
  ['rías baixas', 'Spain'],
  ['rias baixas', 'Spain'],
  ['central otago', 'New Zealand'],
  ['hawkes bay', 'New Zealand'],
  ['hunter valley', 'Australia'],
  ['mclaren vale', 'Australia'],
  ['yarra valley', 'Australia'],
  ['margaret river', 'Australia'],
  ['rioja', 'Spain'],
  ['priorat', 'Spain'],
  ['penedès', 'Spain'],
  ['penedes', 'Spain'],
  ['carinena', 'Spain'],
  ['cariñena', 'Spain'],
  ['jerez', 'Spain'],
  ['valencia', 'Spain'],
  ['bordeaux', 'France'],
  ['burgundy', 'France'],
  ['bourgogne', 'France'],
  ['champagne', 'France'],
  ['beaujolais', 'France'],
  ['chablis', 'France'],
  ['sancerre', 'France'],
  ['pauillac', 'France'],
  ['margaux', 'France'],
  ['médoc', 'France'],
  ['medoc', 'France'],
  ['loire', 'France'],
  ['rhône', 'France'],
  ['rhone', 'France'],
  ['alsace', 'France'],
  ['provence', 'France'],
  ['languedoc', 'France'],
  ['barolo', 'Italy'],
  ['brunello', 'Italy'],
  ['chianti', 'Italy'],
  ['valpolicella', 'Italy'],
  ['tuscany', 'Italy'],
  ['toscana', 'Italy'],
  ['piedmont', 'Italy'],
  ['piemonte', 'Italy'],
  ['veneto', 'Italy'],
  ['sicily', 'Italy'],
  ['sicilia', 'Italy'],
  ['abruzzo', 'Italy'],
  ['puglia', 'Italy'],
  ['campania', 'Italy'],
  ['friuli', 'Italy'],
  ['mosel', 'Germany'],
  ['rheingau', 'Germany'],
  ['pfalz', 'Germany'],
  ['nahe', 'Germany'],
  ['marlborough', 'New Zealand'],
  ['barossa', 'Australia'],
  ['douro', 'Portugal'],
  ['alentejo', 'Portugal'],
  ['vinho verde', 'Portugal'],
  ['portugal', 'Portugal'],
  ['mendoza', 'Argentina'],
  ['maipo', 'Chile'],
  ['colchagua', 'Chile'],
  ['casablanca', 'Chile'],
  ['okanagan', 'Canada'],
  ['tokaj', 'Hungary'],
  ['cotes du marmandais', 'France'],
]

const COUNTRY_ALIASES: readonly (readonly [string, string])[] = [
  ['united states', 'United States'],
  ['usa', 'United States'],
  ['u.s.a.', 'United States'],
  ['u.s.', 'United States'],
  ['america', 'United States'],
  ['spain', 'Spain'],
  ['españa', 'Spain'],
  ['france', 'France'],
  ['italy', 'Italy'],
  ['italia', 'Italy'],
  ['germany', 'Germany'],
  ['deutschland', 'Germany'],
  ['portugal', 'Portugal'],
  ['australia', 'Australia'],
  ['new zealand', 'New Zealand'],
  ['argentina', 'Argentina'],
  ['chile', 'Chile'],
  ['south africa', 'South Africa'],
  ['hungary', 'Hungary'],
  ['canada', 'Canada'],
  ['greece', 'Greece'],
  ['austria', 'Austria'],
  ['georgia', 'Georgia'],
]

const US_STATE_NAMES: readonly (readonly [string, string])[] = [
  ['south carolina', 'South Carolina'],
  ['north carolina', 'North Carolina'],
  ['new york', 'New York'],
  ['new mexico', 'New Mexico'],
  ['new jersey', 'New Jersey'],
  ['new hampshire', 'New Hampshire'],
  ['west virginia', 'West Virginia'],
  ['rhode island', 'Rhode Island'],
  ['district of columbia', 'District of Columbia'],
  ['california', 'California'],
  ['colorado', 'Colorado'],
  ['connecticut', 'Connecticut'],
  ['delaware', 'Delaware'],
  ['florida', 'Florida'],
  ['georgia', 'Georgia'],
  ['hawaii', 'Hawaii'],
  ['idaho', 'Idaho'],
  ['illinois', 'Illinois'],
  ['indiana', 'Indiana'],
  ['iowa', 'Iowa'],
  ['kansas', 'Kansas'],
  ['kentucky', 'Kentucky'],
  ['louisiana', 'Louisiana'],
  ['maine', 'Maine'],
  ['maryland', 'Maryland'],
  ['massachusetts', 'Massachusetts'],
  ['michigan', 'Michigan'],
  ['minnesota', 'Minnesota'],
  ['mississippi', 'Mississippi'],
  ['missouri', 'Missouri'],
  ['montana', 'Montana'],
  ['nebraska', 'Nebraska'],
  ['nevada', 'Nevada'],
  ['ohio', 'Ohio'],
  ['oklahoma', 'Oklahoma'],
  ['oregon', 'Oregon'],
  ['pennsylvania', 'Pennsylvania'],
  ['tennessee', 'Tennessee'],
  ['texas', 'Texas'],
  ['utah', 'Utah'],
  ['vermont', 'Vermont'],
  ['virginia', 'Virginia'],
  ['washington', 'Washington'],
  ['wisconsin', 'Wisconsin'],
  ['wyoming', 'Wyoming'],
  ['arizona', 'Arizona'],
  ['arkansas', 'Arkansas'],
  ['alabama', 'Alabama'],
  ['alaska', 'Alaska'],
]

const US_STATE_ABBREV: Record<string, string> = {
  al: 'Alabama',
  ak: 'Alaska',
  az: 'Arizona',
  ar: 'Arkansas',
  ca: 'California',
  co: 'Colorado',
  ct: 'Connecticut',
  de: 'Delaware',
  fl: 'Florida',
  ga: 'Georgia',
  hi: 'Hawaii',
  id: 'Idaho',
  il: 'Illinois',
  in: 'Indiana',
  ia: 'Iowa',
  ks: 'Kansas',
  ky: 'Kentucky',
  la: 'Louisiana',
  me: 'Maine',
  md: 'Maryland',
  ma: 'Massachusetts',
  mi: 'Michigan',
  mn: 'Minnesota',
  ms: 'Mississippi',
  mo: 'Missouri',
  mt: 'Montana',
  ne: 'Nebraska',
  nv: 'Nevada',
  nh: 'New Hampshire',
  nj: 'New Jersey',
  nm: 'New Mexico',
  ny: 'New York',
  nc: 'North Carolina',
  nd: 'North Dakota',
  oh: 'Ohio',
  ok: 'Oklahoma',
  or: 'Oregon',
  pa: 'Pennsylvania',
  ri: 'Rhode Island',
  sc: 'South Carolina',
  sd: 'South Dakota',
  tn: 'Tennessee',
  tx: 'Texas',
  ut: 'Utah',
  vt: 'Vermont',
  va: 'Virginia',
  wa: 'Washington',
  wv: 'West Virginia',
  wi: 'Wisconsin',
  wy: 'Wyoming',
  dc: 'District of Columbia',
}

const SORTED_REGION_COUNTRY = [...REGION_COUNTRY].sort((a, b) => b[0].length - a[0].length)

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s\-'’/])\p{L}/gu, (c) => c.toUpperCase())
}

/** Infer origin country from wine region text. */
export function wineOriginCountry(wine: Pick<Wine, 'region'>): string | null {
  const text = wine.region.trim().toLowerCase()
  if (!text) return null

  for (const [alias, country] of COUNTRY_ALIASES) {
    if (containsPhrase(text, alias)) return country
  }

  for (const [region, country] of SORTED_REGION_COUNTRY) {
    if (containsPhrase(text, region)) return country
  }

  return null
}

/** Combo label for origin stats, e.g. "Spain · White". */
export function wineOriginCombo(wine: Pick<Wine, 'region' | 'type'>): string | null {
  const country = wineOriginCountry(wine)
  if (!country) return null
  return `${country} · ${wine.type}`
}

/** Parse "where you drank it" into a normalized location label. */
export function parseDrinkLocation(purchasedAt: string): string | null {
  const trimmed = purchasedAt.trim()
  if (!trimmed) return null

  const abbrevMatch = trimmed.match(/,\s*([A-Za-z]{2})\s*$/)
  if (abbrevMatch) {
    const state = US_STATE_ABBREV[abbrevMatch[1]!.toLowerCase()]
    if (state) return state
  }

  const parts = trimmed
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

  if (parts.length >= 2) {
    const last = parts[parts.length - 1]!.toLowerCase()
    for (const [alias, country] of COUNTRY_ALIASES) {
      if (last === alias || containsPhrase(last, alias)) return country
    }
    const stateFromAbbrev = US_STATE_ABBREV[last]
    if (stateFromAbbrev) return stateFromAbbrev
    for (const [name, state] of US_STATE_NAMES) {
      if (last === name || containsPhrase(last, name)) return state
    }
    return titleCase(parts[parts.length - 1]!)
  }

  const lower = trimmed.toLowerCase()
  for (const [name, state] of US_STATE_NAMES) {
    if (containsPhrase(lower, name)) return state
  }
  for (const [alias, country] of COUNTRY_ALIASES) {
    if (containsPhrase(lower, alias)) return country
  }

  return null
}

export interface CountEntry {
  label: string
  count: number
}

export function countBy<T>(
  items: T[],
  keyFn: (item: T) => string | null,
): CountEntry[] {
  const groups = new Map<string, number>()
  for (const item of items) {
    const key = keyFn(item)
    if (!key) continue
    groups.set(key, (groups.get(key) ?? 0) + 1)
  }
  return [...groups.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export function countOriginCountries(wines: Wine[]): CountEntry[] {
  return countBy(wines, wineOriginCountry)
}

export function countOriginCombos(wines: Wine[]): CountEntry[] {
  return countBy(wines, wineOriginCombo)
}

export function countDrinkLocations(wines: Wine[]): CountEntry[] {
  return countBy(wines, (w) => parseDrinkLocation(w.purchasedAt))
}

export function countRegions(wines: Wine[]): CountEntry[] {
  return countBy(wines, (w) => (w.region.trim() ? titleCase(w.region.trim()) : null))
}

export function countTypes(wines: Wine[]): CountEntry[] {
  return countBy(wines, (w) => w.type)
}

export function countTypeInCountry(wines: Wine[], country: string, type: WineType): number {
  return wines.filter((w) => wineOriginCountry(w) === country && w.type === type).length
}
