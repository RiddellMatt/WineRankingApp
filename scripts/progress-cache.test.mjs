// npx tsx --test scripts/progress-cache.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clearLocalProgressData } from '../src/lib/clearLocalAccount.ts'
import {
  loadEarnedBadgeTiers,
  saveEarnedBadgeTiers,
} from '../src/lib/badgeUnlocks.ts'
import {
  LEGACY_BADGE_TIERS_KEY,
  LEGACY_JOURNEY_COMPLETIONS_KEY,
  setActiveProgressUser,
} from '../src/lib/progressStorage.ts'

function installMemoryStorage() {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value))
    },
    removeItem: (key) => {
      store.delete(key)
    },
    key: (index) => [...store.keys()][index] ?? null,
    get length() {
      return store.size
    },
  }
  return store
}

test('signed-in progress ignores the shared device cache until this session saves it', () => {
  installMemoryStorage()
  const userId = '11111111-1111-4111-8111-111111111111'
  const otherId = '22222222-2222-4222-8222-222222222222'
  localStorage.setItem(LEGACY_BADGE_TIERS_KEY, JSON.stringify({ first_pour: 'silver' }))
  localStorage.setItem(LEGACY_JOURNEY_COMPLETIONS_KEY, JSON.stringify(['piedmont']))

  setActiveProgressUser(userId)

  assert.equal(localStorage.getItem(LEGACY_BADGE_TIERS_KEY), null)
  assert.equal(localStorage.getItem(LEGACY_JOURNEY_COMPLETIONS_KEY), null)
  assert.equal(loadEarnedBadgeTiers(), null)

  saveEarnedBadgeTiers({ first_pour: 'bronze' })
  localStorage.setItem(
    `decanti.journey-completions.v1.${userId}`,
    JSON.stringify(['loire']),
  )

  assert.deepEqual(loadEarnedBadgeTiers(), { first_pour: 'bronze' })
  assert.equal(
    localStorage.getItem(`decanti.badge-tiers.v1.${userId}`),
    JSON.stringify({ first_pour: 'bronze' }),
  )

  setActiveProgressUser(otherId)
  assert.equal(loadEarnedBadgeTiers(), null)

  clearLocalProgressData(userId)
  assert.equal(localStorage.getItem(`decanti.badge-tiers.v1.${userId}`), null)
  assert.equal(localStorage.getItem(`decanti.journey-completions.v1.${userId}`), null)

  setActiveProgressUser(null)
})
