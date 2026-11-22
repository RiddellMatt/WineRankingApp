import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer, type ViteDevServer } from 'vite'

const server: ViteDevServer = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
const varietals = await server.ssrLoadModule('/src/lib/wineVarietals.ts')

test.after(async () => {
  await server.close()
})

test('Bordeaux Blanc is one dropdown row for the white Bordeaux spellings', () => {
  assert.equal(varietals.canonicalVarietal('Bordeaux Blanc'), 'Bordeaux Blanc')
  assert.equal(varietals.canonicalVarietal('white bordeaux'), 'Bordeaux Blanc')
  assert.equal(varietals.canonicalVarietal('Meritage'), 'Bordeaux Blend')
  assert.equal(varietals.typeForVarietal('Bordeaux Blanc'), 'White')
  assert.equal(varietals.typeForVarietal('Red Bordeaux'), 'Red')
  const names: string[] = varietals.WINE_VARIETAL_OPTIONS
  assert.equal(names.filter((name) => name === 'Bordeaux Blanc').length, 1)
  assert.equal(names.includes('White Bordeaux'), false)
})

test('the varietal list keeps common grapes and does not repeat spellings', () => {
  const names: string[] = varietals.WINE_VARIETAL_OPTIONS
  const expected = [
    'Cabernet Sauvignon',
    'Sauvignon Blanc',
    'Sémillon',
    'Chardonnay',
    'Pinot Noir',
    'Gamay',
    'GSM',
    'Rhône Blend',
    'Assyrtiko',
    'Torrontés',
    'Mencía',
    'Touriga Nacional',
    'Blanc de Blancs',
  ]
  for (const name of expected) {
    assert.equal(varietals.isListedVarietal(name), true, name)
  }
  assert.equal(new Set(names).size, names.length)
  assert.equal(varietals.canonicalVarietal('not a grape'), 'not a grape')
  assert.equal(varietals.isListedVarietal('not a grape'), false)
})
