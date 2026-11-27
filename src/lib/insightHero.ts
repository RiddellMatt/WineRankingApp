import { isWineFavorite, wineEnjoyment } from './ranking'
import { timesTried } from './winePours'
import { resolveWinePrices } from './winePrice'
import type { Wine } from '../types'

export interface InsightTile {
  value: string
  label: string
}

export interface InsightHero {
  usual: InsightTile
  secondary: InsightTile
}

/** Bottle-price bands for the sweet-spot tile. The top band is open-ended. */
const BOTTLE_BANDS: { label: string; min: number; max: number }[] = [
  { label: 'Under $15', min: 0, max: 15 },
  { label: '$15–25', min: 15, max: 25 },
  { label: '$25–40', min: 25, max: 40 },
  { label: '$40–75', min: 40, max: 75 },
  { label: '$75+', min: 75, max: Number.POSITIVE_INFINITY },
]

export const SWEET_SPOT_MIN_BOTTLES = 4
export const SWEET_SPOT_MIN_IN_BAND = 2

export function usualEnjoyment(wines: Wine[]): number | null {
  const rated = wines.filter((wine) => wineEnjoyment(wine) > 0)
  if (rated.length === 0) return null
  const mean = rated.reduce((sum, wine) => sum + wineEnjoyment(wine), 0) / rated.length
  return Math.round(mean * 10) / 10
}

export function formatUsualScore(value: number | null): string {
  if (value == null) return '—'
  return value.toFixed(1)
}

/**
 * The bottle-price band with the highest average enjoyment.
 * Needs a handful of priced bottles, and the winning band needs more than one.
 */
export function bottleSweetSpot(wines: Wine[]): string | null {
  const priced = wines.flatMap((wine) => {
    const price = resolveWinePrices(wine).bottlePrice
    const enjoyment = wineEnjoyment(wine)
    if (price == null || enjoyment <= 0) return []
    return [{ price, enjoyment }]
  })
  if (priced.length < SWEET_SPOT_MIN_BOTTLES) return null

  let best: { label: string; avg: number; count: number; min: number } | null = null
  for (const band of BOTTLE_BANDS) {
    const inBand = priced.filter((wine) => wine.price >= band.min && wine.price < band.max)
    if (inBand.length < SWEET_SPOT_MIN_IN_BAND) continue
    const avg = inBand.reduce((sum, wine) => sum + wine.enjoyment, 0) / inBand.length
    const closer =
      !best ||
      avg > best.avg + 1e-9 ||
      (Math.abs(avg - best.avg) <= 1e-9 && inBand.length > best.count) ||
      (Math.abs(avg - best.avg) <= 1e-9 && inBand.length === best.count && band.min < best.min)
    if (closer) best = { label: band.label, avg, count: inBand.length, min: band.min }
  }
  return best?.label ?? null
}

export function buildInsightHero(wines: Wine[]): InsightHero {
  const sweet = bottleSweetSpot(wines)
  const favorites = wines.filter((wine) => isWineFavorite(wine)).length
  const repeats = wines.filter((wine) => timesTried(wine) > 1).length

  let secondary: InsightTile
  if (sweet) {
    secondary = { value: sweet, label: 'your sweet spot' }
  } else if (favorites > 0) {
    secondary = {
      value: String(favorites),
      label: favorites === 1 ? 'favorite' : 'favorites',
    }
  } else if (repeats > 0) {
    secondary = { value: String(repeats), label: 'opened again' }
  } else {
    secondary = { value: '0', label: 'favorites' }
  }

  return {
    usual: { value: formatUsualScore(usualEnjoyment(wines)), label: 'your usual score' },
    secondary,
  }
}
