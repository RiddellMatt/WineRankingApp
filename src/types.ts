export const WINE_TYPES = [
  'Red',
  'White',
  'Rosé',
  'Sparkling',
  'Orange',
  'Dessert',
  'Fortified',
] as const

export type WineType = (typeof WINE_TYPES)[number]

export type WineStatus = 'tried' | 'wishlist'

export type RankingPreference = 'taste_first' | 'balanced' | 'value_first'

/**
 * Taste characteristic values are 0–100 along the axis (0 = left label,
 * 100 = right label). Missing key = not rated for that axis.
 */
export interface TasteProfile {
  body?: number // Light ↔ Bold
  tannin?: number // Smooth ↔ Tannic
  sweetness?: number // Dry ↔ Sweet
  acidity?: number // Soft ↔ Acidic
  fizz?: number // Gentle ↔ Fizzy (sparkling)
}

export const TASTE_AXES: {
  key: keyof TasteProfile
  left: string
  right: string
  sparklingOnly?: boolean
}[] = [
  { key: 'body', left: 'Light', right: 'Bold' },
  { key: 'tannin', left: 'Smooth', right: 'Tannic' },
  { key: 'sweetness', left: 'Dry', right: 'Sweet' },
  { key: 'acidity', left: 'Soft', right: 'Acidic' },
  { key: 'fizz', left: 'Gentle', right: 'Fizzy', sparklingOnly: true },
]

export interface Wine {
  id: string
  name: string
  winery: string
  vintage: number | null
  type: WineType
  varietal: string
  region: string
  price: number | null
  /** How much you liked drinking it, from 0 to 10 in quarter steps. 0 means unset. */
  ratingEnjoyment: number
  /** Worth the price — optional; used in composite rank when set. Same 0–10 scale. */
  ratingValue?: number | null
  /** 10 = current quarter-step scores. Missing or 5 = legacy half stars out of 5. */
  ratingScale?: 5 | 10
  /** Would buy again — optional; shown on cards, not in composite rank. */
  ratingBuyAgain?: number | null
  /** Composite score cached at save time; use compositeScore() for display with current preference. */
  rating: number
  notes: string
  /** Quick tasting descriptors (filterable on tried wines). */
  tastingTags?: string[]
  /** Accepted friends tagged on this pour (Beli-style "with you"). */
  withFriendIds?: string[]
  purchasedAt: string
  /** Calendar day the bottle was tasted, YYYY-MM-DD. Optional. */
  triedOn?: string | null
  /** Photo URLs or local data URLs. Optional. */
  photos?: string[]
  taste: TasteProfile
  /** Whether taste came from the reference dataset or was tuned by the user. */
  tasteSource?: 'typical' | 'custom'
  /** Tried = rated and ranked; wishlist = want to try, not yet tasted. */
  status?: WineStatus
  addedAt: number
}

export type SortKey = 'rating' | 'name' | 'vintage' | 'price' | 'addedAt'
