import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer, type ViteDevServer } from 'vite'

const server: ViteDevServer = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
const chrome = await server.ssrLoadModule('/src/lib/bannerChrome.ts')

test.after(async () => {
  await server.close()
})

test('android banner clears the measured menu and leaves the nav inset to the plugin', () => {
  assert.equal(
    chrome.bannerMarginAboveDock({
      nativeTabBar: false,
      dockFromBottomPx: 128,
      safeBottomPx: 48,
    }),
    88,
  )
})

test('android banner uses the dock fallback before the menu is measured', () => {
  assert.equal(
    chrome.bannerMarginAboveDock({
      nativeTabBar: false,
      dockFromBottomPx: 0,
      safeBottomPx: 0,
    }),
    chrome.HTML_DOCK_FALLBACK_PX + 8,
  )
})

test('ios native tab bar keeps the fixed lift', () => {
  assert.equal(
    chrome.bannerMarginAboveDock({
      nativeTabBar: true,
      dockFromBottomPx: 200,
      safeBottomPx: 0,
    }),
    55,
  )
  assert.equal(
    chrome.bannerMarginAboveDock({
      nativeTabBar: true,
      dockFromBottomPx: 0,
      safeBottomPx: 34,
    }),
    89,
  )
})
