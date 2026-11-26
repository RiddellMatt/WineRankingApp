import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer, type ViteDevServer } from 'vite'

const server: ViteDevServer = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
const sortMenu = await server.ssrLoadModule('/src/components/CellarSortMenu.tsx')

test.after(async () => {
  await server.close()
})

const options = [
  { key: 'rating', label: 'Rating' },
  { key: 'price', label: 'Price' },
  { key: 'vintage', label: 'Vintage' },
  { key: 'name', label: 'Name' },
  { key: 'addedAt', label: 'Recently added' },
]

test('the cellar sort control shows Recently added before anyone picks a sort', () => {
  const html = renderToStaticMarkup(
    createElement(sortMenu.CellarSortMenu, {
      value: 'addedAt',
      options,
      onChange: () => {},
      layout: 'bar',
    }),
  )
  assert.match(html, /Recently added/)
  assert.equal(html.includes('Category'), false)
  assert.match(html, /Sort by, Recently added/)
})
