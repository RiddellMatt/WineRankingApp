import type { Wine } from './types'
import { REGIONS, VARIETALS } from './scanner'
import { containsPhrase, findPhrase, findRegion } from './textMatch'

export interface MenuMatch {
  /** Cleaned menu line for the wine. */
  line: string
  /** Menu description text printed under the wine, if any. */
  description?: string
  price: string | null
  score: number // 0–100
  reasons: string[]
  /** Set when the line matches a wine already in the cellar. */
  cellarWine?: Wine
}

const STOPWORDS = new Set([
  'the', 'and', 'with', 'wine', 'glass', 'bottle', 'from', 'les', 'las', 'los',
  'del', 'della', 'di', 'de', 'la', 'le', 'du', 'des', 'red', 'white',
])

const TASTING_RE =
  /\b(cherry|berries|berry|blackberry|currant|cassis|plum|peach|apricot|citrus|grapefruit|lemon|lime|apple|pear|tropical|floral|vanilla|oak|cedar|tobacco|leather|graphite|mineral|minerality|tannin|tannins|acid|acidity|crisp|bright|supple|velvety|silky|elegant|structured|balanced|finish|palate|aroma|aromas|notes? of|hint of|hints of|undertones|full[- ]bodied|medium[- ]bodied|light[- ]bodied|dry|sweet|off[- ]dry|spice|spicy|herbal|earthy|smoky|brioche|butter|creamy|zesty|refreshing)\b/i

const FOOD_RE =
  /\b(octopus|calamari|shrimp|prawn|scallop|lobster|crab|oyster|salmon|tuna|halibut|cod|snapper|branzino|chicken|beef|pork|lamb|duck|venison|steak|burger|meatball|pasta|risotto|pizza|salad|soup|appetizer|entree|bruschetta|charcuterie board)\b/i

const SECTION_RE =
  /^(bubbles?|whites?|reds?|ros[eé]s?|skin[- ]contact(?:\/funky stuff)?|funky stuff|sparkling|dessert|fortified|all bottles)$/i

function significantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t))
}

function cleanLine(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[|¦‖\\`~^*#@+=<>[\]{}]/g, ' ')
    .replace(/[^\p{L}\p{N}\s,.'’\-–—&()/$%]/gu, ' ')
    .replace(/\.{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isMostlyGarbage(line: string): boolean {
  if (!line) return true
  const clean = (line.match(/[\p{L}\p{N}\s,.'’\-–—&()/$%]/gu) ?? []).length
  if (clean / line.length < 0.72) return true
  const words = line.split(/\s+/)
  const junk = words.filter((w) => w.length === 1 && !/\p{L}/u.test(w)).length
  return junk >= 3 || (words.length <= 4 && junk >= 2)
}

function extractPrice(line: string): string | null {
  const m = line.match(
    /(?<!\d)\$?\s?(\d{1,3}(?:\.\d{2})?)(\s*\/\s*\$?\s?\d{1,3}(?:\.\d{2})?)?\s*$/,
  )
  if (!m || !/\d\d/.test(m[0])) return null
  return m[0].replace(/\s+/g, ' ').trim()
}

function wineTitle(line: string, price: string | null): string {
  if (!price) return line
  const idx = line.lastIndexOf(price.replace(/\s+/g, ' ').trim())
  if (idx > 0) return line.slice(0, idx).replace(/[,\s]+$/, '')
  return line.replace(
    /(?<!\d)\$?\s?\d{1,3}(?:\.\d{2})?(\s*\/\s*\$?\s?\d{1,3}(?:\.\d{2})?)?\s*$/,
    '',
  ).trim()
}

function hasVintage(line: string): boolean {
  return /\b(19[5-9]\d|20\d{2})\b/.test(line) || /^NV\b/i.test(line.trim())
}

function isSectionHeader(line: string, price: string | null): boolean {
  if (price) return false
  const stripped = line.replace(/[^a-zA-Z\s/-]/g, '').trim()
  if (SECTION_RE.test(stripped)) return true
  if (/\bcorkage\b/i.test(line)) return true
  return false
}

/**
 * Grape/region lines common on restaurant menus (often ALL CAPS, comma-heavy,
 * ending in a country — e.g. "ARINTO, TRAJADURA, ETC. VINHO VERDE, PORTUGAL.").
 */
function isMenuDetailLine(line: string, price: string | null): boolean {
  if (price) return false
  if (/\betc\.?\b/i.test(line)) return true
  const trimmed = line.trim()
  if (/,\s*[A-Z][A-Z\s.]+\.$/.test(trimmed)) return true

  const commas = (line.match(/,/g)?.length ?? 0)
  if (commas >= 1 && trimmed.endsWith('.')) return true

  const words = line.split(/\s+/).filter((w) => /\p{L}/u.test(w))
  if (words.length >= 2 && commas >= 1) {
    const allCaps = words.filter((w) => w.length > 2 && w === w.toUpperCase()).length
    if (allCaps / words.length > 0.65) return true
  }
  return false
}

function isDescriptionLike(line: string, price: string | null): boolean {
  if (price) return false
  if (TASTING_RE.test(line)) return true

  const commaCount = (line.match(/,/g)?.length ?? 0)
  if (commaCount >= 2) return true

  const words = line.split(/\s+/).filter((w) => /\p{L}/u.test(w))
  if (words.length >= 10) return true

  if (/^(notes? of|aromas? of|on the palate|pairs? with|a |an |the |with )/i.test(line)) {
    return true
  }

  if (words.length < 8 && commaCount === 0) return false

  if (words.length === 0) return true
  const lowerStarts = words.filter((w) => {
    const first = w.match(/\p{L}/u)?.[0] ?? ''
    return first === first.toLowerCase() && first !== first.toUpperCase()
  }).length
  return lowerStarts / words.length > 0.45
}

function looksLikeWineTitle(line: string, price: string | null): boolean {
  if (price) return true
  if (hasVintage(line)) return true

  const words = line.split(/\s+/).filter((w) => /\p{L}/u.test(w))
  if (words.length < 2) return false

  const titleish = words.filter((w) => {
    if (w.length >= 2 && w === w.toUpperCase()) return true
    const first = w[0]
    return first === first.toUpperCase() && first !== first.toLowerCase()
  }).length

  return titleish / words.length >= 0.55
}

interface Preference {
  avg: number
  count: number
}

function preferencesBy(wines: Wine[], key: (w: Wine) => string): Map<string, Preference> {
  const groups = new Map<string, number[]>()
  for (const w of wines) {
    const k = key(w).toLowerCase().trim()
    if (!k) continue
    groups.set(k, [...(groups.get(k) ?? []), w.rating])
  }
  return new Map(
    [...groups.entries()].map(([k, ratings]) => [
      k,
      { avg: ratings.reduce((s, r) => s + r, 0) / ratings.length, count: ratings.length },
    ]),
  )
}

function attachDescription(lastMatch: MenuMatch, line: string): void {
  const merged = [lastMatch.description, line].filter(Boolean).join(' ')
  lastMatch.description = merged.length > 160 ? `${merged.slice(0, 157)}…` : merged
}

export function matchMenu(menuText: string, cellar: Wine[]): MenuMatch[] {
  const varietalPrefs = new Map<string, Preference>()
  for (const w of cellar) {
    const v = w.varietal.toLowerCase().trim()
    if (!v) continue
    for (const [keyword] of VARIETALS) {
      if (containsPhrase(v, keyword) || containsPhrase(keyword, v)) {
        const cur = varietalPrefs.get(keyword)
        varietalPrefs.set(keyword, {
          avg: cur ? (cur.avg * cur.count + w.rating) / (cur.count + 1) : w.rating,
          count: (cur?.count ?? 0) + 1,
        })
      }
    }
  }
  const typePrefs = preferencesBy(cellar, (w) => w.type)
  const lovedRegions = new Map<string, Wine>()
  for (const w of cellar) {
    if (w.rating >= 4 && w.region.trim()) {
      for (const region of REGIONS) {
        if (containsPhrase(w.region, region)) lovedRegions.set(region, w)
      }
    }
  }

  const matches: MenuMatch[] = []
  let lastMatch: MenuMatch | null = null

  for (const raw of menuText.split('\n')) {
    const line = cleanLine(raw)
    if (line.length < 6 || isMostlyGarbage(line)) continue
    const letters = (line.match(/\p{L}/gu) ?? []).length
    if (letters < 5 || letters / line.length < 0.45) continue

    const lower = line.toLowerCase()
    const price = extractPrice(line)

    if (FOOD_RE.test(lower) || isSectionHeader(line, price)) continue

    if (isMenuDetailLine(line, price) || isDescriptionLike(line, price)) {
      if (lastMatch) attachDescription(lastMatch, line)
      continue
    }

    let cellarWine: Wine | undefined
    for (const w of cellar) {
      const tokens = significantTokens(`${w.name} ${w.winery}`)
      if (tokens.length === 0) continue
      const hits = tokens.filter((t) => containsPhrase(lower, t)).length
      if (hits >= Math.min(2, tokens.length)) {
        cellarWine = w
        break
      }
    }

    const varietalHit = findPhrase(lower, VARIETALS)
    const regionHit = findRegion(lower, REGIONS)

    if (!looksLikeWineTitle(line, price) && !cellarWine) continue

    if (!varietalHit && !regionHit && !cellarWine && !price && !hasVintage(line)) continue

    let score: number
    const reasons: string[] = []

    if (cellarWine) {
      score = cellarWine.rating * 20
      reasons.push(`In your cellar — you rated it ${cellarWine.rating.toFixed(1)}★`)
    } else {
      const pref = varietalHit ? varietalPrefs.get(varietalHit[0]) : undefined
      const typePref = varietalHit ? typePrefs.get(varietalHit[1].toLowerCase()) : undefined
      if (pref) {
        score = pref.avg * 18 + 5
        const label = varietalHit![0].replace(/(^|\s)\S/g, (c) => c.toUpperCase())
        reasons.push(
          `You average ${pref.avg.toFixed(1)}★ across ${pref.count} ${label} ${
            pref.count === 1 ? 'wine' : 'wines'
          }`,
        )
      } else if (typePref) {
        score = typePref.avg * 15 + 5
        reasons.push(
          `You average ${typePref.avg.toFixed(1)}★ on ${varietalHit![1]} wines`,
        )
      } else {
        score = 50
        reasons.push(
          varietalHit
            ? `No ${varietalHit[0].replace(/(^|\s)\S/g, (c) => c.toUpperCase())} in your cellar yet — an adventure`
            : 'New territory for your cellar',
        )
      }
      if (regionHit && lovedRegions.has(regionHit)) {
        score += 5
        const fav = lovedRegions.get(regionHit)!
        reasons.push(
          `You loved ${fav.name} from ${regionHit.replace(/(^|\s)\S/g, (c) => c.toUpperCase())}`,
        )
      }
    }

    const displayLine = wineTitle(line, price)
    const match: MenuMatch = {
      line: displayLine,
      price,
      score: Math.round(Math.min(score, 100)),
      reasons,
      cellarWine,
    }
    matches.push(match)
    lastMatch = match
  }

  return matches.sort((a, b) => b.score - a.score)
}
