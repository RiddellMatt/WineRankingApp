import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer, type ViteDevServer } from 'vite'

const server: ViteDevServer = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
const catalog = await server.ssrLoadModule('/src/lib/wineRegionsCatalog.ts')

test.after(async () => {
  await server.close()
})

test('an empty region box lists suggestions and typing filters the catalog', () => {
  const suggestions = catalog.regionComboboxOptions('', ['Piedmont, Italy', 'Piedmont, Italy'])
  assert.deepEqual(
    suggestions.map((option: { label: string }) => option.label),
    ['Piedmont, Italy'],
  )

  const matches = catalog.regionComboboxOptions('barolo', [])
  assert.equal(matches.some((option: { label: string }) => option.label === 'Barolo, Italy'), true)
  assert.equal(matches.some((option: { custom: boolean }) => option.custom), false)

  const custom = catalog.regionComboboxOptions('my backyard vineyard', [])
  assert.deepEqual(custom, [{ label: 'my backyard vineyard', custom: true }])
})
