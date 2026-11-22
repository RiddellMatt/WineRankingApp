import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer, type ViteDevServer } from 'vite'

const server: ViteDevServer = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
const guide = await server.ssrLoadModule('/src/lib/userGuide.ts')

test.after(async () => {
  await server.close()
})

test('the first-run tour skips Stats and ends by asking for a scan', () => {
  const steps: { id: string; tab: string; final?: boolean; segment?: string }[] = guide.USER_GUIDE_STEPS
  assert.equal(steps.some((step) => step.tab === 'insights'), false)
  assert.deepEqual(
    steps.map((step) => step.tab),
    ['cellar', 'cellar', 'friends', 'scan', 'more', 'scan'],
  )
  assert.equal(steps[1]?.segment, 'wishlist')
  assert.equal(steps.at(-1)?.final, true)
  assert.equal(steps.at(-1)?.id, 'scan')
  assert.equal(steps.slice(0, -1).some((step) => step.final), false)
})
