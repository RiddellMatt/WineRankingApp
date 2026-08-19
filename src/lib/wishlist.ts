import type { MenuMatch } from '../menuMatch'
import { normalizeMenuWineFields } from './menuWineParse'
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

export function wishlistIdentityKey(
  wine: Pick<Wine, 'name' | 'winery' | 'vintage'>,
): string {
  return `${wine.name.trim().toLowerCase()}|${(wine.winery ?? '').trim().toLowerCase()}|${wine.vintage ?? ''}`
}

export function isWishlistDuplicate(
  wines: Wine[],
  candidate: Pick<Wine, 'name' | 'winery' | 'vintage'>,
): boolean {
  const key = wishlistIdentityKey(candidate)
  return wines.some((w) => isWishlist(w) && wishlistIdentityKey(w) === key)
}

/** Build a wishlist stub from a friend's logged wine. */
export function friendWineToWishlist(wine: Wine, friendName?: string): Wine {
  const notes = friendName ? `Saved from ${friendName}'s cellar` : ''
  return normalizeWine({
    name: wine.name,
    winery: wine.winery ?? '',
    vintage: wine.vintage,
    type: wine.type,
    varietal: wine.varietal ?? '',
    region: wine.region ?? '',
    price: wine.price,
    status: 'wishlist',
    ratingEnjoyment: 0,
    ratingValue: null,
    ratingBuyAgain: null,
    notes,
    addedAt: Date.now(),
  })
}

function parseMenuPrice(raw: string | null): number | null {
  if (!raw) return null
  const n = parseFloat(raw.replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : null
}

function parseVintageToken(raw: string | undefined): number | null {
  if (!raw) return null
  const token = raw.trim().toUpperCase()
  if (!token || token === 'NV') return null
  const year = Number(token)
  return Number.isFinite(year) ? year : null
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
  let winery = match.winery?.trim() ?? ''
  let wineName = match.wineName?.trim() ?? ''

  if (!wineName) {
    const vintageMatch = match.line.match(/^(NV|19[5-9]\d|20\d{2})\s+(.*)$/i)
    wineName = vintageMatch ? vintageMatch[2]!.trim() : match.line.trim()
  }

  const split = normalizeMenuWineFields(winery || undefined, wineName)
  winery = split.winery
  wineName = split.name

  const vintage =
    parseVintageToken(match.vintage) ??
    (() => {
      const fromLine = match.line.match(/^(NV|19[5-9]\d|20\d{2})\b/i)
      return fromLine ? parseVintageToken(fromLine[1]) : null
    })()

  const searchText = `${winery} ${wineName} ${match.line} ${match.description ?? ''}`
  return normalizeWine({
    name: wineName || match.line.trim(),
    winery,
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
