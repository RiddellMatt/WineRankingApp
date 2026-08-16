import type { Wine } from './types'
import { REGIONS, VARIETALS } from './scanner'

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

/** Tasting-note vocabulary — strong signal this is prose, not a wine title. */
const TASTING_RE =
  /\b(cherry|berries|berry|blackberry|currant|cassis|plum|peach|apricot|citrus|grapefruit|lemon|lime|apple|pear|tropical|floral|vanilla|oak|cedar|tobacco|leather|graphite|mineral|minerality|tannin|tannins|acid|acidity|crisp|bright|supple|velvety|silky|elegant|structured|balanced|finish|palate|aroma|aromas|notes? of|hint of|hints of|undertones|full[- ]bodied|medium[- ]bodied|light[- ]bodied|dry|sweet|off[- ]dry|spice|spicy|herbal|earthy|smoky|brioche|butter|creamy|zesty|refreshing)\b/i

/** Food menu lines OCR'd alongside wine lists — never wines or descriptions. */
const FOOD_RE =
  /\b(octopus|calamari|shrimp|prawn|scallop|lobster|crab|oyster|salmon|tuna|halibut|cod|snapper|branzino|chicken|beef|pork|lamb|duck|venison|steak|burger|meatball|pasta|risotto|pizza|salad|soup|appetizer|entree|bruschetta|charcuterie board)\b/i

function significantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t))
}

/** Strip OCR junk and characters that rarely appear on printed menus. */
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

/** Reject lines that are mostly symbols / single-char noise from OCR. */
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

/** Wine title without trailing price (for display). */
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
  return /\b(19[5-9]\d|20\d{2})\b/.test(line)
}

/**
 * Menus print wine names in Title Case or CAPS; tasting-note descriptions
 * are mostly lowercase prose, comma-heavy, or use tasting vocabulary.
 */
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

  // Short lines without tasting vocabulary or commas are OCR noise, not prose.
  if (words.length < 8 && commaCount === 0) return false

  if (words.length === 0) return true
  const lowerStarts = words.filter((w) => {
    const first = w.match(/\p{L}/u)?.[0] ?? ''
    return first === first.toLowerCase() && first !== first.toUpperCase()
  }).length
  return lowerStarts / words.length > 0.45
}

/**
 * A real menu wine line usually has a price, a vintage year, or reads like
 * a title (Title Case / ALL CAPS). Prose without those signals is not a wine.
 */
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

/**
 * Score each line of an OCR'd menu against the user's cellar.
 * Direct cellar matches use the user's own rating; otherwise the score is
 * driven by how the user rates that varietal, then that wine type.
 */
export function matchMenu(menuText: string, cellar: Wine[]): MenuMatch[] {
  const varietalPrefs = new Map<string, Preference>()
  for (const w of cellar) {
    const v = w.varietal.toLowerCase().trim()
    if (!v) continue
    for (const [keyword] of VARIETALS) {
      if (v.includes(keyword) || keyword.includes(v)) {
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
        if (w.region.toLowerCase().includes(region)) lovedRegions.set(region, w)
      }
    }
  }

  const matches: MenuMatch[] = []
  // The most recent wine entry, so following description lines attach to it.
  let lastMatch: MenuMatch | null = null

  for (const raw of menuText.split('\n')) {
    const line = cleanLine(raw)
    if (line.length < 6 || isMostlyGarbage(line)) continue
    const letters = (line.match(/\p{L}/gu) ?? []).length
    if (letters < 5 || letters / line.length < 0.45) continue

    const lower = line.toLowerCase()
    const price = extractPrice(line)

    if (FOOD_RE.test(lower)) continue

    // Tasting-note prose under a wine — never a new entry, even if it
    // name-drops a varietal ("notes of Cabernet and cherry").
    if (isDescriptionLike(line, price)) {
      if (lastMatch) attachDescription(lastMatch, line)
      continue
    }

    // Direct cellar match: enough distinctive tokens from name+winery on the line.
    let cellarWine: Wine | undefined
    for (const w of cellar) {
      const tokens = significantTokens(`${w.name} ${w.winery}`)
      if (tokens.length === 0) continue
      const hits = tokens.filter((t) => lower.includes(t)).length
      if (hits >= Math.min(2, tokens.length)) {
        cellarWine = w
        break
      }
    }

    const varietalHit = VARIETALS.find(([keyword]) => lower.includes(keyword))
    const regionHit = REGIONS.find((region) => lower.includes(region))

    // Without a price, vintage, or title shape, treat as description — varietal
    // keywords in prose must not spawn a second wine row.
    if (!looksLikeWineTitle(line, price) && !cellarWine) {
      if (lastMatch && isDescriptionLike(line, price)) attachDescription(lastMatch, line)
      continue
    }

    if (!varietalHit && !regionHit && !cellarWine) {
      // Only merge prose; skip food, garbage, and other non-wine lines.
      if (lastMatch && isDescriptionLike(line, price)) attachDescription(lastMatch, line)
      continue
    }

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
