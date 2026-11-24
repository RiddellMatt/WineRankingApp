// node --test scripts/share-preview-title.test.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

function metaContent(attr, key) {
  const pattern = new RegExp(
    `<meta\\s+[^>]*${attr}=["']${key}["'][^>]*content=["']([^"']*)["']|<meta\\s+[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${key}["']`,
    'i',
  )
  const match = html.match(pattern)
  assert.ok(match, `missing meta ${attr}="${key}"`)
  return match[1] ?? match[2]
}

// iOS hides a title segment that resembles the host when a separator is present.
// "Decanti — wine ranking app" on decantiwine.com becomes "wine ranking app".
function iosSharePreviewTitle(title, host = 'decantiwine.com') {
  const parts = title
    .split(/\s*(?:\||—|–|:)\s*|\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length < 2) return title.trim()
  const label = host.split('.')[0].toLowerCase()
  const kept = parts.filter((part) => !label.startsWith(part.toLowerCase()))
  return (kept.length ? kept : parts).join(' ').trim()
}

test('iOS drops the brand from a dashed title that matches the domain', () => {
  assert.equal(
    iosSharePreviewTitle('Decanti — wine ranking app'),
    'wine ranking app',
  )
})

test('referral share previews say Decanti', () => {
  for (const title of [
    metaContent('name', 'apple:title'),
    metaContent('property', 'og:title'),
    metaContent('name', 'twitter:title'),
  ]) {
    assert.equal(title, 'Decanti')
    assert.equal(iosSharePreviewTitle(title), 'Decanti')
  }
})
