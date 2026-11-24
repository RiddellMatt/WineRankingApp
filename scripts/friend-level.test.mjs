// npx tsx --test scripts/friend-level.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lockedBadgeSnapshot } from '../src/lib/badgeUnlocks.ts'
import { computePlayerLevel } from '../src/lib/playerLevel.ts'

function loggedBottle(id) {
  return {
    id,
    name: id,
    winery: 'Pine Ridge',
    vintage: 2025,
    type: 'White',
    varietal: 'Chenin Blanc',
    region: 'Napa Valley, USA',
    price: null,
    rating: 4,
    ratingEnjoyment: 4,
    notes: '',
    purchasedAt: 'Charleston SC',
    taste: { body: 40, sweetness: 30, acidity: 55 },
    tastingTags: ['Mineral', 'Stone fruit'],
    status: 'tried',
    addedAt: Date.now(),
  }
}

test('two logged bottles stay level 1 unless the viewer badge cache is mixed in', () => {
  const wines = [loggedBottle('blanc'), loggedBottle('viognier')]
  const input = { wines, friendCount: 1, completedJourneys: new Set() }

  const hers = computePlayerLevel(input, lockedBadgeSnapshot())
  assert.equal(hers.level, 1)
  assert.equal(hers.title, 'Novice')
  assert.equal(hers.totalXp, 44)

  const viewerCache = lockedBadgeSnapshot()
  viewerCache.first_pour = 'silver'
  viewerCache.explorer = 'silver'
  viewerCache.social = 'silver'
  viewerCache.curator = 'bronze'
  viewerCache.traveler = 'bronze'
  const mixed = computePlayerLevel(input, viewerCache)
  assert.equal(mixed.level, 4)
  assert.equal(mixed.title, 'Taster')
  assert.equal(mixed.totalXp, 219)
})
