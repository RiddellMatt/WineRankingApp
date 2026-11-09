/** Curated region → country for wine forms (labels stored as "Region, Country"). */

export interface WineRegionEntry {
  region: string
  country: string
  /** Extra tokens for search (journey keywords, aliases). */
  searchTokens?: string[]
}

function labelOf(entry: WineRegionEntry): string {
  return `${entry.region}, ${entry.country}`
}

const ENTRIES: WineRegionEntry[] = [
  { region: 'Napa Valley', country: 'USA', searchTokens: ['napa', 'oakville', 'rutherford'] },
  { region: 'Sonoma', country: 'USA', searchTokens: ['sonoma', 'russian river'] },
  { region: 'Willamette Valley', country: 'USA', searchTokens: ['willamette', 'oregon'] },
  { region: 'Paso Robles', country: 'USA' },
  { region: 'Santa Barbara', country: 'USA' },
  { region: 'Finger Lakes', country: 'USA' },
  { region: 'Bordeaux', country: 'France' },
  { region: 'Burgundy', country: 'France', searchTokens: ['bourgogne', 'chablis', 'beaujolais'] },
  { region: 'Champagne', country: 'France', searchTokens: ['reims', 'epernay'] },
  { region: 'Loire Valley', country: 'France', searchTokens: ['loire', 'sancerre', 'vouvray'] },
  { region: 'Rhône', country: 'France', searchTokens: ['rhone', 'côtes du rhône'] },
  { region: 'Alsace', country: 'France' },
  { region: 'Provence', country: 'France' },
  { region: 'Languedoc', country: 'France' },
  { region: 'Tuscany', country: 'Italy', searchTokens: ['toscana', 'chianti', 'brunello'] },
  { region: 'Piedmont', country: 'Italy', searchTokens: ['piemonte', 'barolo', 'barbaresco', 'langhe'] },
  { region: 'Barolo', country: 'Italy' },
  { region: 'Barbaresco', country: 'Italy' },
  { region: 'Brunello di Montalcino', country: 'Italy', searchTokens: ['brunello'] },
  { region: 'Chianti', country: 'Italy' },
  { region: 'Veneto', country: 'Italy', searchTokens: ['valpolicella', 'prosecco'] },
  { region: 'Sicily', country: 'Italy', searchTokens: ['sicilia'] },
  { region: 'Rioja', country: 'Spain' },
  { region: 'Ribera del Duero', country: 'Spain' },
  { region: 'Priorat', country: 'Spain' },
  { region: "Rías Baixas", country: 'Spain', searchTokens: ['rias baixas', 'albariño'] },
  { region: 'Douro', country: 'Portugal', searchTokens: ['port', 'porto'] },
  { region: 'Vinho Verde', country: 'Portugal' },
  { region: 'Alentejo', country: 'Portugal' },
  { region: 'Marlborough', country: 'New Zealand' },
  { region: 'Central Otago', country: 'New Zealand' },
  { region: 'Barossa Valley', country: 'Australia', searchTokens: ['barossa', 'eden valley'] },
  { region: 'Margaret River', country: 'Australia' },
  { region: 'Yarra Valley', country: 'Australia' },
  { region: 'Hunter Valley', country: 'Australia' },
  { region: 'Mendoza', country: 'Argentina' },
  { region: 'Maipo', country: 'Chile' },
  { region: 'Mosel', country: 'Germany', searchTokens: ['mosel-saar-ruwer'] },
  { region: 'Rheingau', country: 'Germany' },
  { region: 'Pfalz', country: 'Germany' },
  { region: 'Stellenbosch', country: 'South Africa', searchTokens: ['swartland'] },
  { region: 'Okanagan', country: 'Canada' },
]

export const WINE_REGION_LABELS: string[] = ENTRIES.map(labelOf)

export const WINE_REGION_COUNTRIES: string[] = [
  ...new Set(ENTRIES.map((e) => e.country)),
].sort((a, b) => a.localeCompare(b))

export function regionsForCountry(country: string): WineRegionEntry[] {
  return ENTRIES.filter((e) => e.country === country)
}

export function parseRegionLabel(
  value: string,
): { region: string; country: string } | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const idx = trimmed.lastIndexOf(',')
  if (idx < 0) return { region: trimmed, country: '' }
  return {
    region: trimmed.slice(0, idx).trim(),
    country: trimmed.slice(idx + 1).trim(),
  }
}

export function regionMatchesSearch(entry: WineRegionEntry, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = [
    entry.region,
    entry.country,
    labelOf(entry),
    ...(entry.searchTokens ?? []),
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

export function searchWineRegions(query: string, limit = 24): string[] {
  const q = query.trim()
  if (!q) return []
  return ENTRIES.filter((e) => regionMatchesSearch(e, q))
    .map(labelOf)
    .slice(0, limit)
}
