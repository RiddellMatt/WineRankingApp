import type { MenuMatch } from '../menuMatch'
import { VARIETALS } from '../scanner'
import type { Wine, WineType } from '../types'
import { normalizeWine } from './ranking'

export function isWishlist(wine: Pick<Wine, 'status'>): boolean {
  return wine.status === 'wishlist'
}

export function triedWines(wines: Wine[]): Wine[] {
  return wines.filter((w) => !isWishlist(w))
}

export function wishlistWines(wines: Wine[]): Wine[] {
  return wines.filter(isWishlist)
}

export function triedCount(wines: Wine[]): number {
  return triedWines(wines).length
}

export function wishlistCount(wines: Wine[]): number {
  return wishlistWines(wines).length
}

function wishlistKey(name: string, vintage: number | null): string {
  return `${name.trim().toLowerCase()}|${vintage ?? ''}`
}

export function isWishlistDuplicate(
  wines: Wine[],
  candidate: Pick<Wine, 'name' | 'vintage'>,
): boolean {
  const key = wishlistKey(candidate.name, candidate.vintage)
  return wines.some((w) => isWishlist(w) && wishlistKey(w.name, w.vintage) === key)
}

function parseMenuPrice(raw: string | null): number | null {
  if (!raw) return null
  const n = parseFloat(raw.replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : null
}

function inferWineTypeFromText(text: string): WineType {
  const lower = text.toLowerCase()
  if (/\b(sparkling|champagne|prosecco|cava|crémant|cremant|brut)\b/.test(lower)) {
    return 'Sparkling'
  }
  if (/\b(rosé|rose)\b/.test(lower)) return 'Rosé'
  if (/\b(port|sherry|madeira|fortified)\b/.test(lower)) return 'Fortified'
  if (/\b(dessert|ice wine|icewine|sauternes|tokaji|aszú|aszú)\b/.test(lower)) {
    return 'Dessert'
  }
  if (/\borange\b/.test(lower)) return 'Orange'
  for (const [keyword, type] of VARIETALS) {
    if (lower.includes(keyword)) return type
  }
  return 'Red'
}

/** Build a wishlist stub from a menu scan result line. */
export function menuMatchToWishlist(match: MenuMatch): Wine {
  const vintageMatch = match.line.match(/^(NV|19[5-9]\d|20\d{2})\s+(.*)$/i)
  let vintage: number | null = null
  let name = match.line.trim()
  if (vintageMatch) {
    const token = vintageMatch[1].toUpperCase()
    vintage = token === 'NV' ? null : Number(token)
    name = vintageMatch[2].trim()
  }

  const searchText = `${match.line} ${match.description ?? ''}`
  return normalizeWine({
    name: name || match.line.trim(),
    vintage,
    price: parseMenuPrice(match.price),
    type: inferWineTypeFromText(searchText),
    status: 'wishlist',
    ratingEnjoyment: 0,
    notes: '',
    addedAt: Date.now(),
  })
}

export function formatWishlistDate(addedAt: number): string {
  return new Date(addedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
