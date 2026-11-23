import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer, type ViteDevServer } from 'vite'
import type { Wine } from '../src/types.ts'

const server: ViteDevServer = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
const pours = await server.ssrLoadModule('/src/lib/winePours.ts')

test.after(async () => {
  await server.close()
})

function wine(partial: Partial<Wine>): Wine {
  return {
    id: partial.id ?? 'a',
    name: partial.name ?? 'Barolo',
    winery: partial.winery ?? 'Marchesi',
    vintage: partial.vintage === undefined ? 2019 : partial.vintage,
    type: partial.type ?? 'Red',
    varietal: partial.varietal ?? 'Nebbiolo',
    region: partial.region ?? 'Piedmont',
    price: null,
    ratingEnjoyment: 4,
    rating: 4,
    notes: '',
    purchasedAt: '',
    taste: {},
    status: partial.status ?? 'tried',
    triedOn: partial.triedOn ?? '2024-01-01',
    pours: partial.pours,
    addedAt: 1,
  }
}

test('a later pour increases the times-tried count and keeps its date', () => {
  const bottle = wine({
    pours: [{ triedOn: '2026-11-22' }, { triedOn: null }],
  })
  assert.equal(pours.timesTried(bottle), 3)
  assert.equal(pours.timesTried(wine({ status: 'wishlist' })), 0)
  const moments = pours.tastingMoments(bottle)
  assert.deepEqual(
    moments.map((moment: { triedOn: string | null }) => moment.triedOn),
    ['2024-01-01', '2026-11-22', null],
  )
  assert.deepEqual(pours.normalizePours([{ tried_on: '2020-05-02' }, { triedOn: 'nope' }]), [
    { triedOn: '2020-05-02' },
    { triedOn: null },
  ])
})

test('the same name and producer is a duplicate, a different vintage is not', () => {
  const cellar = [
    wine({ id: 'cellar', name: 'Barolo Riserva', winery: 'Marchesi di Barolo', vintage: 2019 }),
    wine({ id: 'other', name: 'Barolo Riserva', winery: 'Marchesi di Barolo', vintage: 2016 }),
  ]
  const again = wine({
    id: 'new',
    name: '  barolo   riserva ',
    winery: 'Marchesi di Barolo',
    vintage: null,
  })
  assert.equal(pours.findCellarDuplicate(cellar, again)?.id, 'cellar')
  assert.equal(
    pours.findCellarDuplicate(cellar, wine({ id: 'new', name: 'Barolo Riserva', vintage: 2015 }))
      ?.id,
    undefined,
  )
  assert.equal(
    pours.findCellarDuplicate(cellar, wine({ id: 'cellar', name: 'Barolo Riserva' })),
    undefined,
  )
  assert.equal(
    pours.findCellarDuplicate(cellar, wine({ id: 'new', name: 'Chianti', winery: 'Marchesi di Barolo' })),
    undefined,
  )
})
