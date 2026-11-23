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
const tips = await server.ssrLoadModule('/src/components/RatingTips.tsx')

test.after(async () => {
  await server.close()
})

test('each score keeps an enjoyment reading and a value reading together', () => {
  const html = renderToStaticMarkup(createElement(tips.RatingTips))
  const items = html.split('<li>').slice(1)
  assert.equal(items.length, 10)
  for (const [index, item] of items.entries()) {
    assert.match(item, new RegExp(`>${index + 1}<`))
    const enjoymentAt = item.indexOf('Enjoyment')
    const valueAt = item.indexOf('Value')
    assert.ok(enjoymentAt > 0, `score ${index + 1} is missing enjoyment`)
    assert.ok(valueAt > enjoymentAt, `score ${index + 1} splits value away from enjoyment`)
  }
  assert.match(html, /Not for you/)
  assert.match(html, /Not worth it/)
  assert.match(html, /As good as it gets/)
  assert.match(html, /Unbeatable/)
})
