import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer, type ViteDevServer } from 'vite'

const server: ViteDevServer = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
const wishlist = await server.ssrLoadModule('/src/lib/wishlist.ts')

test.after(async () => {
  await server.close()
})

test('a tagged wine becomes a new tried draft with a typical profile and no borrowed score', () => {
  const draft = wishlist.friendWineToTriedDraft({
    id: 'friend-bottle',
    name: 'Barolo',
    winery: 'Marchesi',
    vintage: 2019,
    type: 'Red',
    varietal: 'Nebbiolo',
    region: 'Piedmont',
    price: 42,
    ratingEnjoyment: 5,
    ratingValue: 4,
    rating: 5,
    notes: 'Their notes',
    photos: ['https://example.com/theirs.jpg'],
    withFriendIds: ['me'],
    status: 'tried',
    addedAt: 1,
  })
  assert.notEqual(draft.id, 'friend-bottle')
  assert.equal(draft.status, 'tried')
  assert.equal(draft.ratingEnjoyment, 0)
  assert.equal(draft.notes, '')
  assert.equal(draft.tasteSource, 'typical')
  assert.equal(draft.varietal, 'Nebbiolo')
  assert.equal(draft.price, 42)
  assert.ok(draft.taste.body != null)
  assert.deepEqual(draft.withFriendIds, [])
  assert.deepEqual(draft.photos, [])
})

test('a menu line carries a typical taste profile into the tried draft', () => {
  const match = {
    line: '2022 Sonoma Chardonnay',
    wineName: 'Sonoma Chardonnay',
    winery: 'Test Winery',
    vintage: '2022',
    price: '$18',
    score: 80,
    reasons: ['Matches wines you like'],
    description: 'Bright and citrusy',
  }
  const taste = wishlist.menuMatchTaste(match)
  assert.equal(taste.basedOn, 'Chardonnay')
  assert.equal(taste.taste.acidity, 55)

  const draft = wishlist.menuMatchToTriedDraft(match)
  assert.equal(draft.status, 'tried')
  assert.equal(draft.name, 'Sonoma Chardonnay')
  assert.equal(draft.winery, 'Test Winery')
  assert.equal(draft.vintage, 2022)
  assert.equal(draft.tasteSource, 'typical')
  assert.equal(draft.taste.acidity, 55)
  assert.equal(draft.ratingEnjoyment, 0)

  const saved = wishlist.menuMatchToWishlist(match)
  assert.equal(saved.status, 'wishlist')
})
