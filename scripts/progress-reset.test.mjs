// npx tsx --test scripts/progress-reset.test.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { PRO_STORAGE_KEY, WINE_STORAGE_KEY } from '../src/brand.ts'
import { clearLocalProgressData } from '../src/lib/clearLocalAccount.ts'
import { progressGenerationIsNewer } from '../src/lib/progressGeneration.ts'
import { parseArgs, planResetSteps } from './reset-profile.mjs'

test('progress generation only discards when the server marker is ahead', () => {
  assert.equal(progressGenerationIsNewer(null, 0), false)
  assert.equal(progressGenerationIsNewer(0, 0), false)
  assert.equal(progressGenerationIsNewer(1, 0), true)
  assert.equal(progressGenerationIsNewer(2, 2), false)
  assert.equal(progressGenerationIsNewer(2, 3), false)
  assert.equal(progressGenerationIsNewer(Number.NaN, 0), false)
})

test('progress clear drops the cellar and badges and keeps Pro', () => {
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
  localStorage.setItem(WINE_STORAGE_KEY, '[{"name":"Barolo"}]')
  localStorage.setItem('decanti.badge-tiers.v1', '{"explorer":"gold"}')
  localStorage.setItem('decanti.journey-completions.v1', '["piedmont"]')
  localStorage.setItem('decanti.progress-generation.v1', '{"user":1}')
  localStorage.setItem(PRO_STORAGE_KEY, 'active')

  clearLocalProgressData()

  assert.equal(localStorage.getItem(WINE_STORAGE_KEY), null)
  assert.equal(localStorage.getItem('decanti.badge-tiers.v1'), null)
  assert.equal(localStorage.getItem('decanti.journey-completions.v1'), null)
  assert.equal(localStorage.getItem('decanti.progress-generation.v1'), '{"user":1}')
  assert.equal(localStorage.getItem(PRO_STORAGE_KEY), 'active')
})

test('parseArgs accepts an email, --id, and safety flags', () => {
  assert.deepEqual(parseArgs(['ada@example.com']), {
    email: 'ada@example.com',
    id: '',
    yes: false,
    keepFriends: false,
    help: false,
  })
  assert.deepEqual(parseArgs(['--id', '11111111-1111-4111-8111-111111111111', '--yes', '--keep-friends']), {
    email: '',
    id: '11111111-1111-4111-8111-111111111111',
    yes: true,
    keepFriends: true,
    help: false,
  })
  assert.equal(parseArgs(['--help']).help, true)
  assert.throws(() => parseArgs(['--nope']), /Unknown option/)
  assert.throws(() => parseArgs(['one@example.com', 'two@example.com']), /one email/)
})

test('reset plan covers cellar, badges, and journeys and leaves the account row', () => {
  const tables = planResetSteps({ keepFriends: false }).map((step) => step.table)
  for (const required of ['wines', 'user_badge_tiers', 'user_journey_completions', 'friendships']) {
    assert.ok(tables.includes(required), required)
  }
  assert.equal(tables.includes('push_device_tokens'), false)
  assert.equal(tables.includes('profiles'), false)
  assert.equal(
    planResetSteps({ keepFriends: true }).some((step) => step.table === 'friendships'),
    false,
  )

  const sql = readFileSync(new URL('./reset-profile.sql', import.meta.url), 'utf8')
  const sqlTables = [...sql.matchAll(/delete from public\.(\w+)/g)].map((match) => match[1])
  assert.deepEqual(sqlTables, tables)
  assert.match(sql, /function private\.reset_profile\(\s*target_email text/i)
  assert.match(sql, /revoke all on function private\.reset_profile\(text, boolean\) from public/i)
  assert.match(sql, /step := 'cellar'/)
  assert.match(sql, /step := 'points'/)
  assert.match(sql, /progress_reset_at = now\(\)/)
  assert.match(sql, /reject_restored_cellar/)
  assert.match(sql, /reject_restored_points/)
  assert.equal(sql.includes('delete from storage.objects'), false)
})
