import type { Wine } from './types'
import { REGIONS, VARIETALS } from './scanner'

export interface MenuMatch {
  /** Cleaned menu line for the wine. */
  line: string
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

function significantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t))
}

function extractPrice(line: string): string | null {
  // "$18", "18.50", "14 / 52" (glass/bottle) at the end of the line.
  const m = line.match(/\$?\s?(\d{1,3}(?:\.\d{2})?)(\s*\/\s*\$?\s?\d{1,3}(?:\.\d{2})?)?\s*$/)
  if (!m || !/\d\d/.test(m[0])) return null
  return m[0].replace(/\s+/g, ' ').trim()
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

  for (const raw of menuText.split('\n')) {
    const line = raw.replace(/\s+/g, ' ').trim()
    if (line.length < 6) continue
    const letters = (line.match(/\p{L}/gu) ?? []).length
    if (letters < 5) continue
    const lower = line.toLowerCase()

    const varietalHit = VARIETALS.find(([keyword]) => lower.includes(keyword))
    const regionHit = REGIONS.find((region) => lower.includes(region))

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

    if (!varietalHit && !regionHit && !cellarWine) continue

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

    matches.push({
      line,
      price: extractPrice(line),
      score: Math.round(Math.min(score, 100)),
      reasons,
      cellarWine,
    })
  }

  return matches.sort((a, b) => b.score - a.score)
}
