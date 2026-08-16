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

export interface Wine {
  id: string
  name: string
  winery: string
  vintage: number | null
  type: WineType
  varietal: string
  region: string
  price: number | null
  rating: number // 0.5 – 5 in half-star steps
  notes: string
  addedAt: number
}

export type SortKey = 'rating' | 'name' | 'vintage' | 'price' | 'addedAt'
