import { compositeScore, wineEnjoyment, wineValueScore } from './ranking'
import type { RankingPreference, Wine } from '../types'

export type InsightsLeaderKind = 'value' | 'splurge'

function pricedWines(wines: Wine[]): Wine[] {
  return wines.filter((w) => w.price != null && w.price > 0)
}

function valueRatio(wine: Wine, rankingPreference: RankingPreference): number {
  const value = wineValueScore(wine) ?? wineEnjoyment(wine)
  const price = wine.price ?? 1
  const rank = compositeScore(wine, rankingPreference)
  return (value / price) * (1 + rank * 0.02)
}

export function topInsightWines(
  wines: Wine[],
  kind: InsightsLeaderKind,
  rankingPreference: RankingPreference,
  limit = 3,
): Wine[] {
  const priced = pricedWines(wines)
  if (priced.length === 0) return []

  if (kind === 'splurge') {
    return [...priced].sort((a, b) => (b.price ?? 0) - (a.price ?? 0)).slice(0, limit)
  }

  return [...priced]
    .sort((a, b) => valueRatio(b, rankingPreference) - valueRatio(a, rankingPreference))
    .slice(0, limit)
}
