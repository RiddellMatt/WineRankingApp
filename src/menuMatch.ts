import type { Wine } from './types'
import { REGIONS, VARIETALS } from './scanner'
import { containsPhrase, findPhrase, findRegion } from './textMatch'

export interface ParsedMenuWine {
  vintage: string
  name: string
  price: string | null
  description?: string
}

export interface MenuMatch {
  line: string
  description?: string
  price: string | null
  score: number
  reasons: string[]
  cellarWine?: Wine
}

interface ParsedWine {
  vintage: string
  name: string
  price: string
  description: string[]
}

const STOPWORDS = new Set([
  'the', 'and', 'with', 'wine', 'glass', 'bottle', 'from', 'les', 'las', 'los',
  'del', 'della', 'di', 'de', 'la', 'le', 'du', 'des',
])

const FOOD_RE =
  /\b(octopus|calamari|shrimp|prawn|scallop|lobster|crab|oyster|salmon|tuna|halibut|cod|snapper|branzino|chicken|beef|pork|lamb|duck|venison|steak|burger|meatball|pasta|risotto|pizza|salad|soup|appetizer|entree|bruschetta|charcuterie board)\b/i

/** Category column headers — never wines, even when OCR merges columns ("Bubbles Rosé"). */
const SECTION_WORDS = new Set([
  'bubbles', 'bubble', 'white', 'whites', 'red', 'reds', 'rose', 'roses', 'rosé', 'rosés',
  'skin-contact', 'skin', 'contact', 'funky', 'stuff', 'sparkling', 'dessert', 'fortified',
  'all', 'bottles', 'corkage', 'wines', 'by', 'the', 'glass',
])

const VINTAGE_RE = /\b(NV|19[5-9]\d|20\d{2})\b/gi

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
  return clean / line.length < 0.65
}

function significantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t))
}

/**
 * Restaurant wine lines: vintage (NV or year) + producer/name + trailing price.
 * When OCR reads across two menu columns, one physical line may contain several
 * of these — split them before anything else.
 */
function extractWineSegments(line: string): ParsedWine[] {
  const segments: ParsedWine[] = []
  const starts: number[] = []
  VINTAGE_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = VINTAGE_RE.exec(line)) !== null) {
    starts.push(m.index)
  }
  if (starts.length === 0) return segments

  for (let i = 0; i < starts.length; i++) {
    const chunk = line.slice(starts[i], starts[i + 1] ?? line.length).trim()
    const vm = chunk.match(/^(NV|19[5-9]\d|20\d{2})\s+/i)
    if (!vm) continue

    const vintage = vm[1].toUpperCase()
    const rest = chunk.slice(vm[0].length)
    const pm = rest.match(/\s(\d{1,3})\s*$/)
    if (!pm) continue

    const priceNum = Number(pm[1])
    // Glass pours on this menu are $8–$99; skip years/prices that aren't menu pricing.
    if (priceNum < 8 || priceNum > 99) continue

    const name = rest.slice(0, rest.length - pm[0].length).replace(/[,\s]+$/, '').trim()
    if (name.length < 4) continue
    // Reject if the "name" is really a category header fragment.
    if (isSectionHeaderLine(name)) continue

    segments.push({ vintage, name, price: pm[1], description: [] })
  }
  return segments
}

/** True when every word on the line is a known menu section label. */
function isSectionHeaderLine(line: string): boolean {
  if (/\b(NV|19[5-9]\d|20\d{2})\b/i.test(line)) return false

  const words = line
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0 || words.length > 6) return false
  return words.every((w) => SECTION_WORDS.has(w))
}

/** Grape / region detail lines (line 2–3 under a wine on the reference menu). */
function isDetailLine(line: string): boolean {
  if (/\b(NV|19[5-9]\d|20\d{2})\s+\p{L}/iu.test(line)) return false
  if (/\betc\.?\b/i.test(line)) return true
  if (line.trim().endsWith('.') && (line.match(/,/g)?.length ?? 0) >= 1) return true

  const words = line.split(/\s+/).filter((w) => /\p{L}/u.test(w))
  if (words.length >= 2) {
    const caps = words.filter((w) => w.length > 2 && w === w.toUpperCase()).length
    if (caps / words.length > 0.6) return true
  }
  return false
}

/**
 * Turn raw OCR text into discrete wine entries before scoring.
 * Only lines matching vintage → name → price become wines; everything else
 * is either skipped (headers) or attached as description.
 */
export function parseMenuWines(menuText: string): ParsedWine[] {
  const wines: ParsedWine[] = []
  let recentBatch: ParsedWine[] = []

  for (const raw of menuText.split('\n')) {
    const line = cleanLine(raw)
    if (line.length < 3 || isMostlyGarbage(line)) continue
    if (FOOD_RE.test(line) || /\bcorkage\b/i.test(line)) continue
    if (isSectionHeaderLine(line)) continue

    const segments = extractWineSegments(line)

    if (segments.length > 0) {
      recentBatch = segments
      for (const seg of segments) wines.push(seg)
      continue
    }

    if (recentBatch.length > 0 && isDetailLine(line)) {
      const parts = splitDetailLine(line)
      const assigned =
        parts.length === recentBatch.length
          ? parts
          : parts.length > recentBatch.length
            ? mergeParts(parts, recentBatch.length)
            : [line]
      assigned.forEach((p, i) => recentBatch[i].description.push(p))
      recentBatch = []
    }
  }

  return wines
}

/** When OCR merges grape/region lines from two columns, split on sentence boundaries. */
function splitDetailLine(line: string): string[] {
  const parts = line
    .split(/(?<=\.)\s+(?=[A-Z])/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 6)
  return parts.length > 0 ? parts : [line]
}

/** Merge over-split OCR fragments back into one description per wine. */
function mergeParts(parts: string[], count: number): string[] {
  if (count <= 0) return []
  if (count === 1) return [parts.join(' ')]
  const per = Math.ceil(parts.length / count)
  return Array.from({ length: count }, (_, i) =>
    parts.slice(i * per, (i + 1) * per).join(' '),
  )
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

export function matchParsedMenuWines(
  parsed: ParsedMenuWine[],
  cellar: Wine[],
): MenuMatch[] {
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

  for (const wine of parsed) {
    const displayLine = `${wine.vintage} ${wine.name}`.trim()
    const searchText = `${displayLine} ${wine.description ?? ''}`.toLowerCase()

    let cellarWine: Wine | undefined
    for (const w of cellar) {
      const tokens = significantTokens(`${w.name} ${w.winery}`)
      if (tokens.length === 0) continue
      const hits = tokens.filter((t) => containsPhrase(searchText, t)).length
      if (hits >= Math.min(2, tokens.length)) {
        cellarWine = w
        break
      }
    }

    const varietalHit = findPhrase(searchText, VARIETALS)
    const regionHit = findRegion(searchText, REGIONS)

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
        reasons.push(`You average ${typePref.avg.toFixed(1)}★ on ${varietalHit![1]} wines`)
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

    matches.push({
      line: displayLine,
      description: wine.description || undefined,
      price: wine.price,
      score: Math.round(Math.min(score, 100)),
      reasons,
      cellarWine,
    })
  }

  return matches.sort((a, b) => b.score - a.score)
}

export function matchMenu(menuText: string, cellar: Wine[]): MenuMatch[] {
  const parsedRaw = parseMenuWines(menuText)
  const parsed: ParsedMenuWine[] = parsedRaw.map((w) => ({
    vintage: w.vintage,
    name: w.name,
    price: w.price,
    description: w.description.join(' ') || undefined,
  }))
  return matchParsedMenuWines(parsed, cellar)
}
