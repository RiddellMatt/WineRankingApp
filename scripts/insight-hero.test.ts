import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer, type ViteDevServer } from 'vite'
import type { Wine } from '../src/types'

const server: ViteDevServer = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

const prices = await server.ssrLoadModule('/src/lib/winePrice.ts')
const hero = await server.ssrLoadModule('/src/lib/insightHero.ts')
const leaders = await server.ssrLoadModule('/src/lib/insightsLeaders.ts')
const ranking = await server.ssrLoadModule('/src/lib/ranking.ts')

test.after(async () => {
  await server.close()
})

function wine(partial: Partial<Wine> & Pick<Wine, 'id' | 'name'>): Wine {
  return ranking.normalizeWine({
    type: 'Red',
    ratingEnjoyment: 7,
    ratingScale: 10,
    ...partial,
  })
}

test('a single legacy price is kept as the bottle price', () => {
  const resolved = prices.resolveWinePrices({ price: 32 })
  assert.equal(resolved.bottlePrice, 32)
  assert.equal(resolved.glassPrice, null)
  assert.equal(resolved.price, 32)
  assert.equal(prices.formatWinePriceSummary({ price: 32 }), '$32 bottle')
})

test('glass and bottle stay separate, and sort uses the bottle', () => {
  const resolved = prices.resolveWinePrices({ glassPrice: 14, bottlePrice: 48, price: 14 })
  assert.equal(resolved.glassPrice, 14)
  assert.equal(resolved.bottlePrice, 48)
  assert.equal(resolved.price, 48)
  assert.equal(
    prices.formatWinePriceSummary({ glassPrice: 14, bottlePrice: 48 }),
    '$14 glass · $48 bottle',
  )
})

test('a glass-only price is not promoted to a bottle', () => {
  const resolved = prices.resolveWinePrices({ glassPrice: 16, price: 16 })
  assert.equal(resolved.glassPrice, 16)
  assert.equal(resolved.bottlePrice, null)
  assert.equal(resolved.price, 16)
  assert.equal(prices.formatWinePriceSummary(resolved), '$16 glass')
})

test('a different legacy price next to a glass is the bottle', () => {
  const resolved = prices.resolveWinePrices({ glassPrice: 14, price: 42 })
  assert.equal(resolved.glassPrice, 14)
  assert.equal(resolved.bottlePrice, 42)
})

test('usual score is enjoyment to one decimal', () => {
  const wines = [
    wine({ id: 'a', name: 'A', ratingEnjoyment: 7 }),
    wine({ id: 'b', name: 'B', ratingEnjoyment: 8 }),
    wine({ id: 'c', name: 'C', ratingEnjoyment: 8.5 }),
  ]
  const tiles = hero.buildInsightHero(wines)
  assert.equal(tiles.usual.value, '7.8')
  assert.equal(tiles.usual.label, 'your usual score')
})

test('three priced bottles show favorites instead of a sweet spot', () => {
  const wines = [
    wine({ id: 'a', name: 'A', price: 30, ratingEnjoyment: 8, ratingBuyAgain: 5 }),
    wine({ id: 'b', name: 'B', price: 40, ratingEnjoyment: 7 }),
    wine({ id: 'c', name: 'C', price: 150, ratingEnjoyment: 9 }),
  ]
  const tiles = hero.buildInsightHero(wines)
  assert.equal(tiles.secondary.value, '1')
  assert.equal(tiles.secondary.label, 'favorite')
})

test('opened again is the fallback when nothing is a favorite', () => {
  const wines = [
    wine({ id: 'a', name: 'A', price: 22, ratingEnjoyment: 7, pours: [{ triedOn: '2026-11-01' }] }),
    wine({ id: 'b', name: 'B', ratingEnjoyment: 6 }),
  ]
  const tiles = hero.buildInsightHero(wines)
  assert.equal(tiles.secondary.value, '1')
  assert.equal(tiles.secondary.label, 'opened again')
})

test('sweet spot is the bottle band with the highest enjoyment', () => {
  const wines = [
    wine({ id: 'a', name: 'A', price: 18, ratingEnjoyment: 6 }),
    wine({ id: 'b', name: 'B', price: 22, ratingEnjoyment: 6.5 }),
    wine({ id: 'c', name: 'C', bottlePrice: 28, ratingEnjoyment: 9 }),
    wine({ id: 'd', name: 'D', bottlePrice: 34, ratingEnjoyment: 8.5 }),
    wine({ id: 'e', name: 'E', bottlePrice: 90, ratingEnjoyment: 7 }),
    wine({ id: 'f', name: 'F', glassPrice: 12, ratingEnjoyment: 10 }),
  ]
  assert.equal(hero.bottleSweetSpot(wines), '$25–40')
  const tiles = hero.buildInsightHero(wines)
  assert.equal(tiles.secondary.value, '$25–40')
  assert.equal(tiles.secondary.label, 'your sweet spot')
})

test('best value ignores a cheap glass when the cellar has bottle prices', () => {
  const wines = [
    wine({ id: 'glass', name: 'House pour', glassPrice: 11, ratingEnjoyment: 9 }),
    wine({ id: 'deal', name: 'Weeknight red', bottlePrice: 22, ratingEnjoyment: 8 }),
    wine({ id: 'spend', name: 'Celebration', bottlePrice: 80, ratingEnjoyment: 8.5 }),
  ]
  const [best] = leaders.topInsightWines(wines, 'value', 'balanced', 1)
  assert.equal(best.name, 'Weeknight red')
  assert.equal(leaders.formatInsightWinePrice(best, 'value'), '$22 bottle')
})

test('biggest splurge can be a glass when that pour cost more', () => {
  const wines = [
    wine({ id: 'glass', name: 'Rare pour', glassPrice: 45, ratingEnjoyment: 9 }),
    wine({ id: 'bottle', name: 'Table red', bottlePrice: 30, ratingEnjoyment: 7 }),
  ]
  const [splurge] = leaders.topInsightWines(wines, 'splurge', 'balanced', 1)
  assert.equal(splurge.name, 'Rare pour')
  assert.equal(leaders.formatInsightWinePrice(splurge, 'splurge'), '$45 glass')
})
