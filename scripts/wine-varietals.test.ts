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

test('the varietal list for a type leaves out grapes of another color', () => {
  const white: string[] = varietals.varietalsForType('White')
  const red: string[] = varietals.varietalsForType('Red')
  assert.equal(white.includes('Chardonnay'), true)
  assert.equal(white.includes('Bordeaux Blanc'), true)
  assert.equal(white.includes('Merlot'), false)
  assert.equal(white.includes('Cabernet Sauvignon'), false)
  assert.equal(red.includes('Merlot'), true)
  assert.equal(red.includes('Chardonnay'), false)
  assert.equal(varietals.varietalFitsType('Merlot', 'White'), false)
  assert.equal(varietals.varietalFitsType('Chardonnay', 'White'), true)
  assert.equal(varietals.varietalFitsType('house blend', 'White'), true)
  const rose: string[] = varietals.varietalsForType('Rosé')
  assert.equal(rose.includes('Pinot Noir'), true)
  assert.equal(rose.includes('Chardonnay'), false)
  const orange: string[] = varietals.varietalsForType('Orange')
  assert.equal(orange.includes('Chardonnay'), true)
  assert.equal(orange.includes('Merlot'), false)
  const sparkling: string[] = varietals.varietalsForType('Sparkling')
  assert.equal(sparkling.includes('Prosecco'), true)
  assert.equal(sparkling.includes('Merlot'), false)
  const dessert: string[] = varietals.varietalsForType('Dessert')
  assert.equal(dessert.includes('Riesling'), true)
  assert.equal(dessert.includes('Merlot'), false)
  const fortified: string[] = varietals.varietalsForType('Fortified')
  assert.equal(fortified.includes('Port'), true)
  assert.equal(fortified.includes('Merlot'), false)
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
