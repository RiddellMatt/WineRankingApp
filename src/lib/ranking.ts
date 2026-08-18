import type { RankingPreference, Wine } from '../types'

export const RANKING_PREFERENCE_OPTIONS: {
  value: RankingPreference
  title: string
  description: string
}[] = [
  {
    value: 'taste_first',
    title: 'Great taste',
    description: 'Your rankings weight enjoyment 60% and value 40%.',
  },
  {
    value: 'balanced',
    title: 'Both equally',
    description: 'Enjoyment and value each count 50%.',
  },
  {
    value: 'value_first',
    title: 'Great value',
    description: 'Your rankings weight value 60% and enjoyment 40%.',
  },
]

const LOCAL_PREF_KEY = 'cellar-rank.ranking-preference'

export function getScoreWeights(pref: RankingPreference): { enjoyment: number; value: number } {
  switch (pref) {
    case 'taste_first':
      return { enjoyment: 0.6, value: 0.4 }
    case 'value_first':
      return { enjoyment: 0.4, value: 0.6 }
    default:
      return { enjoyment: 0.5, value: 0.5 }
  }
}

export function wineEnjoyment(wine: Partial<Wine>): number {
  return wine.ratingEnjoyment ?? wine.rating ?? 0
}

export function wineValueScore(wine: Partial<Wine>): number | null {
  const value = wine.ratingValue
  if (value != null && value > 0) return value
  return null
}

/** Composite rank from enjoyment + optional value, using profile weighting. */
export function compositeScore(
  wine: Partial<Wine>,
  pref: RankingPreference = 'balanced',
): number {
  const enjoyment = wineEnjoyment(wine)
  const value = wineValueScore(wine)
  if (value == null) return enjoyment
  const weights = getScoreWeights(pref)
  return Math.round((enjoyment * weights.enjoyment + value * weights.value) * 10) / 10
}

export function compareByRank(a: Wine, b: Wine, pref: RankingPreference): number {
  return compositeScore(b, pref) - compositeScore(a, pref) || a.name.localeCompare(b.name)
}

export function applyCompositeRating(wine: Wine, pref: RankingPreference): Wine {
  return { ...wine, rating: compositeScore(wine, pref) }
}

export function loadLocalRankingPreference(): RankingPreference | null {
  try {
    const raw = localStorage.getItem(LOCAL_PREF_KEY)
    if (raw === 'taste_first' || raw === 'balanced' || raw === 'value_first') return raw
  } catch {
    // ignore
  }
  return null
}

export function saveLocalRankingPreference(pref: RankingPreference): void {
  localStorage.setItem(LOCAL_PREF_KEY, pref)
}

export function resolveRankingPreference(
  profilePref?: RankingPreference | null,
): RankingPreference {
  return profilePref ?? loadLocalRankingPreference() ?? 'balanced'
}

export function needsRankingPreferenceSetup(
  profilePref: RankingPreference | null | undefined,
  signedIn: boolean,
): boolean {
  if (profilePref) return false
  if (signedIn) return true
  return loadLocalRankingPreference() == null
}

/** Backfill legacy exports and old saves that only had `rating`. */
export function normalizeWine(raw: Partial<Wine>): Wine {
  const enjoyment = raw.ratingEnjoyment ?? raw.rating ?? 0
  const pref = loadLocalRankingPreference() ?? 'balanced'
  const wine: Wine = {
    id: raw.id ?? crypto.randomUUID(),
    name: raw.name ?? '',
    winery: raw.winery ?? '',
    vintage: raw.vintage ?? null,
    type: raw.type ?? 'Red',
    varietal: raw.varietal ?? '',
    region: raw.region ?? '',
    price: raw.price ?? null,
    ratingEnjoyment: enjoyment,
    ratingValue: raw.ratingValue ?? null,
    ratingBuyAgain: raw.ratingBuyAgain ?? null,
    rating: raw.rating ?? enjoyment,
    notes: raw.notes ?? '',
    purchasedAt: raw.purchasedAt ?? '',
    taste: raw.taste ?? {},
    tasteSource: raw.tasteSource,
    addedAt: raw.addedAt ?? Date.now(),
  }
  return applyCompositeRating(wine, pref)
}

export function buyAgainLabel(score: number | null | undefined): string | null {
  if (score == null || score <= 0) return null
  if (score >= 4.5) return 'Buy again'
  if (score >= 2.5) return 'Maybe'
  return 'Pass'
}
