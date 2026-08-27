import { containsPhrase } from '../textMatch'

/** Region keyword → human label (subset focused on journeys + common origins). */
const REGION_HINTS: readonly (readonly [string, string])[] = [
  ['napa valley', 'Napa Valley, USA'],
  ['willamette valley', 'Willamette Valley, USA'],
  ['sonoma', 'Sonoma, USA'],
  ['tuscany', 'Tuscany, Italy'],
  ['toscana', 'Tuscany, Italy'],
  ['chianti', 'Chianti, Italy'],
  ['brunello', 'Brunello di Montalcino, Italy'],
  ['piedmont', 'Piedmont, Italy'],
  ['piemonte', 'Piedmont, Italy'],
  ['barolo', 'Barolo, Italy'],
  ['barbaresco', 'Barbaresco, Italy'],
  ['burgundy', 'Burgundy, France'],
  ['bourgogne', 'Burgundy, France'],
  ['chablis', 'Chablis, France'],
  ['beaujolais', 'Beaujolais, France'],
  ['bordeaux', 'Bordeaux, France'],
  ['champagne', 'Champagne, France'],
  ['loire', 'Loire Valley, France'],
  ['rhône', 'Rhône, France'],
  ['rhone', 'Rhône, France'],
  ['rioja', 'Rioja, Spain'],
  ['ribera del duero', 'Ribera del Duero, Spain'],
  ['priorat', 'Priorat, Spain'],
  ['marlborough', 'Marlborough, New Zealand'],
  ['barossa', 'Barossa Valley, Australia'],
  ['mendoza', 'Mendoza, Argentina'],
  ['douro', 'Douro, Portugal'],
  ['mosel', 'Mosel, Germany'],
  ['stellenbosch', 'Stellenbosch, South Africa'],
  ['eden valley', 'Barossa Valley, Australia'],
  ['oakville', 'Napa Valley, USA'],
]

const SORTED_HINTS = [...REGION_HINTS].sort((a, b) => b[0].length - a[0].length)

const VARIETAL_REGION: readonly (readonly [string, string])[] = [
  ['nebbiolo', 'Piedmont, Italy'],
  ['barolo', 'Barolo, Italy'],
  ['sangiovese', 'Tuscany, Italy'],
  ['tempranillo', 'Rioja, Spain'],
  ['pinot noir', 'Burgundy, France'],
  ['chardonnay', 'Burgundy, France'],
  ['sauvignon blanc', 'Marlborough, New Zealand'],
  ['malbec', 'Mendoza, Argentina'],
  ['shiraz', 'Barossa Valley, Australia'],
  ['syrah', 'Rhône, France'],
  ['riesling', 'Mosel, Germany'],
  ['port', 'Douro, Portugal'],
  ['albariño', 'Rías Baixas, Spain'],
  ['albarino', 'Rías Baixas, Spain'],
]

function collectMatches(text: string, limit: number): string[] {
  const found: string[] = []
  const seen = new Set<string>()

  for (const [keyword, label] of SORTED_HINTS) {
    if (found.length >= limit) break
    if (!containsPhrase(text, keyword)) continue
    if (seen.has(label)) continue
    seen.add(label)
    found.push(label)
  }

  return found
}

export interface RegionSuggestionInput {
  name?: string
  winery?: string
  varietal?: string
  region?: string
}

/** Suggest region labels from wine metadata (for form chips). */
export function suggestRegions(input: RegionSuggestionInput, limit = 4): string[] {
  const combined = [input.name, input.winery, input.varietal, input.region]
    .filter(Boolean)
    .join(' ')
    .trim()
    .toLowerCase()

  if (!combined) return []

  const suggestions = collectMatches(combined, limit)

  const varietal = (input.varietal ?? '').trim().toLowerCase()
  if (varietal && suggestions.length < limit) {
    for (const [key, label] of VARIETAL_REGION) {
      if (suggestions.length >= limit) break
      if (!containsPhrase(varietal, key)) continue
      if (suggestions.includes(label)) continue
      suggestions.push(label)
    }
  }

  return suggestions.slice(0, limit)
}
