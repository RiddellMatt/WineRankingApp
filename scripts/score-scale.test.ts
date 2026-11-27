import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer, type ViteDevServer } from 'vite'

const server: ViteDevServer = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
const scale = await server.ssrLoadModule('/src/lib/scoreScale.ts')
const ranking = await server.ssrLoadModule('/src/lib/ranking.ts')

test.after(async () => {
  await server.close()
})

test('typed scores snap to the nearest quarter out of 10', () => {
  assert.equal(scale.snapScore(7.3), 7.25)
  assert.equal(scale.snapScore(7.4), 7.5)
  assert.equal(scale.snapScore(7.125), 7.25)
  assert.equal(scale.snapScore(11), 10)
  assert.equal(scale.snapScore(-3), 0)
  assert.equal(scale.scoreFromTyped('7.3', 4), 7.25)
  assert.equal(scale.scoreFromTyped('nope', 6.5), 6.5)
  assert.equal(scale.scoreFromTyped('', 8), 0)
  assert.equal(scale.formatScoreOutOf(7.25), '7.25/10')
  assert.equal(scale.formatScoreOutOf(8), '8/10')
  assert.equal(scale.formatScoreOutOf(7.5), '7.5/10')
})

test('a legacy half-star score doubles once onto the 10-point scale', () => {
  assert.equal(scale.toTenPoint(4.5, 5), 9)
  assert.equal(scale.toTenPoint(5, 5), 10)
  assert.equal(scale.toTenPoint(4.5, 10), 4.5)
  const wine = ranking.normalizeWine({
    id: 'old',
    name: 'Barolo',
    ratingEnjoyment: 4,
    ratingValue: 3.5,
    rating: 4,
  })
  assert.equal(wine.ratingEnjoyment, 8)
  assert.equal(wine.ratingValue, 7)
  assert.equal(wine.ratingScale, 10)
  const again = ranking.normalizeWine(wine)
  assert.equal(again.ratingEnjoyment, 8)
  assert.equal(again.ratingValue, 7)
})

test('the bar is red at 1, yellow at 5, green at 7, and darker green at 10', () => {
  const one = scale.scoreStopAt(1)
  const five = scale.scoreStopAt(5)
  const seven = scale.scoreStopAt(7)
  const ten = scale.scoreStopAt(10)
  assert.ok(one.h < 15, `1 should be red, hue ${one.h}`)
  assert.ok(five.h > 40 && five.h < 60, `5 should be yellow, hue ${five.h}`)
  assert.ok(seven.h > 110 && seven.h < 145, `7 should be green, hue ${seven.h}`)
  assert.ok(ten.h > seven.h, '10 should sit further into green than 7')
  assert.ok(ten.l < seven.l, '10 should be darker than 7')
})

test('an unrated bottle stays unranked even if value was scored', () => {
  assert.equal(ranking.compositeScore({ ratingEnjoyment: 0, ratingValue: 8 }, 'balanced'), 0)
  assert.equal(ranking.compositeScore({ ratingEnjoyment: 0, ratingValue: null }, 'taste_first'), 0)
})

test('overall is the ranking blend, snapped to a quarter', () => {
  const score = ranking.compositeScore(
    { ratingEnjoyment: 8, ratingValue: 6 },
    'balanced',
  )
  assert.equal(score, 7)
  const tasteFirst = ranking.compositeScore(
    { ratingEnjoyment: 8, ratingValue: 5 },
    'taste_first',
  )
  assert.equal(tasteFirst, scale.snapScore(8 * 0.6 + 5 * 0.4))
})
