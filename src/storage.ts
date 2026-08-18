import type { Wine } from './types'
import { normalizeWine } from './lib/ranking'

const STORAGE_KEY = 'wine-rank.wines.v1'

export function loadWines(): Wine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((w: Partial<Wine>) => normalizeWine({ purchasedAt: '', taste: {}, ...w }))
  } catch {
    return []
  }
}

export function saveWines(wines: Wine[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wines))
}

export const SAMPLE_WINES: Wine[] = [
  {
    id: 'sample-1',
    name: 'Réserve Spéciale',
    winery: 'Château Margaux',
    vintage: 2018,
    type: 'Red',
    varietal: 'Cabernet Sauvignon',
    region: 'Bordeaux, France',
    price: 85,
    ratingEnjoyment: 4.5,
    rating: 4.5,
    notes: 'Blackcurrant and cedar with silky tannins. Long, elegant finish.',
    purchasedAt: 'Total Wine, Denver',
    taste: { body: 75, tannin: 60, sweetness: 15, acidity: 55 },
    addedAt: Date.now() - 6 * 86400000,
  },
  {
    id: 'sample-2',
    name: 'Cloudy Bay',
    winery: 'Cloudy Bay Vineyards',
    vintage: 2022,
    type: 'White',
    varietal: 'Sauvignon Blanc',
    region: 'Marlborough, New Zealand',
    price: 32,
    ratingEnjoyment: 4,
    rating: 4,
    notes: 'Zesty grapefruit and passionfruit. Crisp, refreshing acidity.',
    purchasedAt: 'Whole Foods',
    taste: { body: 25, sweetness: 10, acidity: 85 },
    addedAt: Date.now() - 5 * 86400000,
  },
  {
    id: 'sample-3',
    name: 'Whispering Angel',
    winery: "Château d'Esclans",
    vintage: 2023,
    type: 'Rosé',
    varietal: 'Grenache blend',
    region: 'Provence, France',
    price: 24,
    ratingEnjoyment: 3.5,
    rating: 3.5,
    notes: 'Pale salmon color. Strawberry and white peach, bone dry.',
    purchasedAt: 'Trader Joe\u2019s',
    taste: { body: 30, sweetness: 8, acidity: 65 },
    addedAt: Date.now() - 4 * 86400000,
  },
  {
    id: 'sample-4',
    name: 'Brut Yellow Label',
    winery: 'Veuve Clicquot',
    vintage: null,
    type: 'Sparkling',
    varietal: 'Champagne blend',
    region: 'Champagne, France',
    price: 60,
    ratingEnjoyment: 4.5,
    rating: 4.5,
    notes: 'Brioche and green apple. Fine, persistent bubbles.',
    purchasedAt: 'Costco',
    taste: { body: 40, sweetness: 20, acidity: 75, fizz: 85 },
    addedAt: Date.now() - 3 * 86400000,
  },
  {
    id: 'sample-5',
    name: 'Barolo Riserva',
    winery: 'Marchesi di Barolo',
    vintage: 2016,
    type: 'Red',
    varietal: 'Nebbiolo',
    region: 'Piedmont, Italy',
    price: 55,
    ratingEnjoyment: 5,
    rating: 5,
    notes: 'Rose petal, tar, and dried cherry. Structured and unforgettable.',
    purchasedAt: 'Enoteca Rossi, Rome',
    taste: { body: 80, tannin: 85, sweetness: 10, acidity: 70 },
    addedAt: Date.now() - 2 * 86400000,
  },
  {
    id: 'sample-6',
    name: 'Tokaji Aszú 5 Puttonyos',
    winery: 'Royal Tokaji',
    vintage: 2017,
    type: 'Dessert',
    varietal: 'Furmint',
    region: 'Tokaj, Hungary',
    price: 45,
    ratingEnjoyment: 4,
    rating: 4,
    notes: 'Apricot, honey, and saffron. Sweetness balanced by bright acid.',
    purchasedAt: 'Wine.com',
    taste: { body: 55, sweetness: 90, acidity: 80 },
    addedAt: Date.now() - 86400000,
  },
]
