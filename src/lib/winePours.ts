import type { Wine } from '../types'
import { normalizeTriedOn } from './wineMoments'

/** One more time this bottle was opened, after the original tasting. */
export interface Pour {
  triedOn: string | null
}

const MAX_POURS = 50

export function normalizePours(value: unknown): Pour[] {
  if (!Array.isArray(value)) return []
  const pours: Pour[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const raw = item as { triedOn?: unknown; tried_on?: unknown }
    pours.push({ triedOn: normalizeTriedOn(raw.triedOn ?? raw.tried_on) })
    if (pours.length >= MAX_POURS) break
  }
  return pours
}

/** Tried wines count the first tasting plus every later pour. */
export function timesTried(wine: Pick<Wine, 'status' | 'pours'>): number {
  if (wine.status === 'wishlist') return 0
  return 1 + (wine.pours?.length ?? 0)
}

/** First tasting, then each later pour, oldest first. */
export function tastingMoments(wine: Pick<Wine, 'status' | 'triedOn' | 'pours'>): Pour[] {
  if (wine.status === 'wishlist') return []
  return [{ triedOn: normalizeTriedOn(wine.triedOn) }, ...normalizePours(wine.pours)]
}

function identityText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Same bottle already in the tried cellar.
 * The name has to match. Winery and vintage only rule a wine out when both
 * sides filled them in and they disagree, so a scan that missed the producer
 * still finds the bottle.
 */
export function findCellarDuplicate(
  wines: readonly Wine[],
  candidate: Pick<Wine, 'id' | 'name' | 'winery' | 'vintage' | 'status'>,
): Wine | undefined {
  if (candidate.status === 'wishlist') return undefined
  const name = identityText(candidate.name)
  if (name.length < 2) return undefined
  const winery = identityText(candidate.winery ?? '')
  return wines.find((wine) => {
    if (wine.status === 'wishlist' || wine.id === candidate.id) return false
    if (identityText(wine.name) !== name) return false
    const otherWinery = identityText(wine.winery ?? '')
    if (winery && otherWinery && winery !== otherWinery) return false
    if (
      candidate.vintage != null &&
      wine.vintage != null &&
      candidate.vintage !== wine.vintage
    ) {
      return false
    }
    return true
  })
}
