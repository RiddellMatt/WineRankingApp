import { compositeScore, wineEnjoyment, wineValueScore } from './ranking'
import { formatDollars, resolveWinePrices, type WinePriceServing } from './winePrice'
import type { RankingPreference, Wine } from '../types'

export type InsightsLeaderKind = 'value' | 'splurge'

interface ServingPrice {
  amount: number
  serving: WinePriceServing
}

function servingPrice(wine: Wine, serving: WinePriceServing): number | null {
  const prices = resolveWinePrices(wine)
  return serving === 'bottle' ? prices.bottlePrice : prices.glassPrice
}

/** Bottles compete with bottles. A glass-only cellar falls back to glass prices. */
function valueCohort(wines: Wine[]): { wines: Wine[]; serving: WinePriceServing } {
  const bottles = wines.filter((wine) => resolveWinePrices(wine).bottlePrice != null)
  if (bottles.length > 0) return { wines: bottles, serving: 'bottle' }
  const glasses = wines.filter((wine) => resolveWinePrices(wine).glassPrice != null)
  return { wines: glasses, serving: 'glass' }
}

function highestSpend(wine: Wine): ServingPrice | null {
  const { glassPrice, bottlePrice } = resolveWinePrices(wine)
  if (bottlePrice != null && (glassPrice == null || bottlePrice >= glassPrice)) {
    return { amount: bottlePrice, serving: 'bottle' }
  }
  if (glassPrice != null) return { amount: glassPrice, serving: 'glass' }
  return null
}

function valueRatio(wine: Wine, serving: WinePriceServing, rankingPreference: RankingPreference): number {
  const value = wineValueScore(wine) ?? wineEnjoyment(wine)
  const price = servingPrice(wine, serving) ?? 1
  const rank = compositeScore(wine, rankingPreference)
  return (value / price) * (1 + rank * 0.02)
}

export function insightWinePrice(wine: Wine, kind: InsightsLeaderKind): ServingPrice | null {
  if (kind === 'splurge') return highestSpend(wine)
  const { serving } = valueCohort([wine])
  const amount = servingPrice(wine, serving)
  if (amount == null) return null
  return { amount, serving }
}

export function formatInsightWinePrice(wine: Wine, kind: InsightsLeaderKind): string {
  const price = insightWinePrice(wine, kind)
  if (!price) return '—'
  return `${formatDollars(price.amount)} ${price.serving}`
}

export function topInsightWines(
  wines: Wine[],
  kind: InsightsLeaderKind,
  rankingPreference: RankingPreference,
  limit = 3,
): Wine[] {
  if (kind === 'splurge') {
    return wines
      .filter((wine) => highestSpend(wine) != null)
      .sort((a, b) => (highestSpend(b)?.amount ?? 0) - (highestSpend(a)?.amount ?? 0))
      .slice(0, limit)
  }

  const cohort = valueCohort(wines)
  return [...cohort.wines]
    .sort(
      (a, b) =>
        valueRatio(b, cohort.serving, rankingPreference) - valueRatio(a, cohort.serving, rankingPreference),
    )
    .slice(0, limit)
}
