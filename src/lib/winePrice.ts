import type { Wine } from '../types'

export type WinePriceServing = 'glass' | 'bottle'

export interface ResolvedWinePrices {
  glassPrice: number | null
  bottlePrice: number | null
  /** Bottle price when one is set, otherwise the glass price. */
  price: number | null
}

function positivePrice(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return value
}

/**
 * Glass and bottle are stored separately. Older cellars have a single `price`,
 * which is kept as the bottle price.
 */
export function resolveWinePrices(wine: {
  price?: number | null
  glassPrice?: number | null
  bottlePrice?: number | null
}): ResolvedWinePrices {
  const glass = positivePrice(wine.glassPrice)
  let bottle = positivePrice(wine.bottlePrice)
  const legacy = positivePrice(wine.price)
  if (bottle == null && glass == null) {
    bottle = legacy
  } else if (bottle == null && legacy != null && legacy !== glass) {
    bottle = legacy
  }
  return {
    glassPrice: glass,
    bottlePrice: bottle,
    price: bottle ?? glass,
  }
}

export function formatDollars(amount: number): string {
  return `$${amount.toFixed(0)}`
}

export function winePriceParts(
  wine: { price?: number | null; glassPrice?: number | null; bottlePrice?: number | null },
): { amount: number; serving: WinePriceServing }[] {
  const { glassPrice, bottlePrice } = resolveWinePrices(wine)
  const parts: { amount: number; serving: WinePriceServing }[] = []
  if (glassPrice != null) parts.push({ amount: glassPrice, serving: 'glass' })
  if (bottlePrice != null) parts.push({ amount: bottlePrice, serving: 'bottle' })
  return parts
}

export function formatWinePriceSummary(wine: {
  price?: number | null
  glassPrice?: number | null
  bottlePrice?: number | null
}): string | null {
  const parts = winePriceParts(wine)
  if (parts.length === 0) return null
  return parts.map((part) => `${formatDollars(part.amount)} ${part.serving}`).join(' · ')
}

/** Number used when the cellar is sorted by price. Unpriced wines sort last. */
export function sortPrice(wine: Pick<Wine, 'price' | 'glassPrice' | 'bottlePrice'>): number {
  return resolveWinePrices(wine).price ?? -1
}

export function listedPrices(wine: {
  price?: number | null
  glassPrice?: number | null
  bottlePrice?: number | null
}): number[] {
  return winePriceParts(wine).map((part) => part.amount)
}
