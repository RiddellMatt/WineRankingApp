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

/** Bottle-price bands. The top band is open-ended. Glass prices stay out of these. */
const BOTTLE_BANDS: { label: string; min: number; max: number }[] = [
  { label: 'Under $15', min: 0, max: 15 },
  { label: '$15–25', min: 15, max: 25 },
  { label: '$25–40', min: 25, max: 40 },
  { label: '$40–75', min: 40, max: 75 },
  { label: '$75+', min: 75, max: Number.POSITIVE_INFINITY },
]

export interface BottlePriceBand {
  label: string
  count: number
  /** Mean enjoyment. Null when the band has no rated bottles. */
  avg: number | null
}

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

function pricedBottles(wines: Wine[]): { price: number; enjoyment: number }[] {
  return wines.flatMap((wine) => {
    const price = resolveWinePrices(wine).bottlePrice
    const enjoyment = wineEnjoyment(wine)
    if (price == null || enjoyment <= 0) return []
    return [{ price, enjoyment }]
  })
}

/** Every bottle-price band, including ones with a single bottle or none. */
export function bottlePriceBands(wines: Wine[]): BottlePriceBand[] {
  const priced = pricedBottles(wines)
  return BOTTLE_BANDS.map((band) => {
    const inBand = priced.filter((wine) => wine.price >= band.min && wine.price < band.max)
    if (inBand.length === 0) return { label: band.label, count: 0, avg: null }
    const mean = inBand.reduce((sum, wine) => sum + wine.enjoyment, 0) / inBand.length
    return {
      label: band.label,
      count: inBand.length,
      avg: Math.round(mean * 10) / 10,
    }
  })
}

/**
 * The bottle-price band with the highest average enjoyment.
 * Needs a handful of priced bottles, and the winning band needs more than one.
 */
export function bottleSweetSpot(wines: Wine[]): string | null {
  const bands = bottlePriceBands(wines)
  const pricedCount = bands.reduce((sum, band) => sum + band.count, 0)
  if (pricedCount < SWEET_SPOT_MIN_BOTTLES) return null

  let best: { label: string; avg: number; count: number; min: number } | null = null
  for (let index = 0; index < bands.length; index += 1) {
    const row = bands[index]
    if (!row || row.count < SWEET_SPOT_MIN_IN_BAND || row.avg == null) continue
    const min = BOTTLE_BANDS[index]?.min ?? 0
    const closer =
      !best ||
      row.avg > best.avg + 1e-9 ||
      (Math.abs(row.avg - best.avg) <= 1e-9 && row.count > best.count) ||
      (Math.abs(row.avg - best.avg) <= 1e-9 && row.count === best.count && min < best.min)
    if (closer) best = { label: row.label, avg: row.avg, count: row.count, min }
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
