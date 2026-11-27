import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer, type ViteDevServer } from 'vite'
import type { MapPlace } from '../src/lib/placeSearch'

const server: ViteDevServer = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
const menu = await server.ssrLoadModule('/src/lib/placePickerMenu.ts')

test.after(async () => {
  await server.close()
})

const recent = ['The Ordinary, Charleston, South Carolina', 'Fig, Charleston, South Carolina', 'Home']

const ordinary: MapPlace = {
  id: 'N:1',
  label: 'The Ordinary, Charleston, South Carolina',
  title: 'The Ordinary',
  subtitle: '544 King Street, Charleston, South Carolina',
  lat: 32.79,
  lng: -79.94,
}

const leon: MapPlace = {
  id: 'N:2',
  label: "Leon's Oyster Shop, Charleston, South Carolina",
  title: "Leon's Oyster Shop",
  subtitle: 'Charleston, South Carolina',
  lat: 32.79,
  lng: -79.93,
}

test('a fresh field offers recent places and current location', () => {
  const items = menu.buildPlaceMenu({
    text: '',
    dirty: false,
    value: '',
    recentPlaces: recent,
    results: [],
  })
  assert.deepEqual(
    items.map((item: { kind: string; label?: string }) => item.kind === 'locate' ? 'locate' : item.label),
    [...recent, 'locate'],
  )
})

test('typing keeps filtering recents and can save the typed place', () => {
  const items = menu.buildPlaceMenu({
    text: 'fig',
    dirty: true,
    value: '',
    recentPlaces: recent,
    results: [],
  })
  assert.deepEqual(
    items.map((item: { kind: string; label?: string }) => `${item.kind}:${item.label ?? ''}`),
    ['recent:Fig, Charleston, South Carolina', 'custom:fig', 'locate:'],
  )
})

test('map matches join the filtered recents once the query is long enough', () => {
  const items = menu.buildPlaceMenu({
    text: 'leo',
    dirty: true,
    value: '',
    recentPlaces: recent,
    results: [ordinary, leon],
  })
  assert.deepEqual(
    items.map((item: { kind: string; label?: string }) => `${item.kind}:${item.label ?? ''}`),
    [
      'place:The Ordinary, Charleston, South Carolina',
      "place:Leon's Oyster Shop, Charleston, South Carolina",
      'custom:leo',
      'locate:',
    ],
  )
})

test('an exact recent match is the selection, not a second custom row', () => {
  const items = menu.buildPlaceMenu({
    text: 'Home',
    dirty: true,
    value: '',
    recentPlaces: recent,
    results: [],
  })
  assert.deepEqual(
    items.map((item: { kind: string }) => item.kind),
    ['recent', 'locate'],
  )
})
