import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer, type ViteDevServer } from 'vite'
import { FREE_MENU_SCANS, resolveScanAllowance } from '../supabase/functions/_shared/scanQuota.ts'
import { renderWineShareHtml } from '../supabase/functions/_shared/wineShareHtml.ts'

const server: ViteDevServer = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

const sharePrompt = await server.ssrLoadModule('/src/lib/sharePrompt.ts')
const review = await server.ssrLoadModule('/src/lib/storeReviewPrompt.ts')
const menuShare = await server.ssrLoadModule('/src/lib/menuShare.ts')
const wineShare = await server.ssrLoadModule('/src/lib/wineShare.ts')
const shareCard = await server.ssrLoadModule('/src/lib/shareWineCard.ts')

test.after(async () => {
  await server.close()
})

function bottle(id: string, enjoyment: number) {
  return {
    id,
    name: id,
    winery: '',
    vintage: null,
    type: 'Red',
    varietal: '',
    region: '',
    price: null,
    ratingEnjoyment: enjoyment,
    rating: enjoyment,
    notes: '',
    purchasedAt: '',
    taste: {},
    addedAt: 1,
  }
}

test('free menu scans stop at two, and Pro keeps the monthly cap', () => {
  assert.equal(FREE_MENU_SCANS, 2)
  assert.deepEqual(
    resolveScanAllowance({ isPro: false, used: 0, monthlyLimit: 30, freeAllowance: 2 }),
    { allowed: true, limit: 2 },
  )
  assert.equal(
    resolveScanAllowance({ isPro: false, used: 2, monthlyLimit: 30, freeAllowance: 2 }).code,
    'pro_required',
  )
  assert.equal(
    resolveScanAllowance({ isPro: false, used: 0, monthlyLimit: 30 }).code,
    'pro_required',
  )
  assert.equal(
    resolveScanAllowance({ isPro: true, used: 30, monthlyLimit: 30, freeAllowance: 2 }).code,
    'quota_exceeded',
  )
  assert.equal(
    resolveScanAllowance({ isPro: true, used: 2, monthlyLimit: 30, freeAllowance: 2 }).limit,
    30,
  )
})

test('a new top bottle prompts a share, and editing that bottle does not', () => {
  const first = bottle('a', 8)
  assert.equal(sharePrompt.becameTopWine([], first, 'balanced'), true)
  const second = bottle('b', 7)
  assert.equal(sharePrompt.becameTopWine([first], second, 'balanced'), false)
  const better = bottle('c', 9)
  assert.equal(sharePrompt.becameTopWine([first, second], better, 'balanced'), true)
  const edited = { ...first, notes: 'longer finish' }
  assert.equal(sharePrompt.becameTopWine([first, second], edited, 'balanced'), false)
  assert.equal(sharePrompt.becameTopWine([], { ...first, status: 'wishlist' }, 'balanced'), false)
})

test('store review waits for a third wine or a journey, then stops', () => {
  assert.equal(
    review.shouldRequestStoreReview({ ratedCount: 2, journeyCompleted: false, alreadyAsked: false }),
    false,
  )
  assert.equal(
    review.shouldRequestStoreReview({ ratedCount: 3, journeyCompleted: false, alreadyAsked: false }),
    true,
  )
  assert.equal(
    review.shouldRequestStoreReview({ ratedCount: 1, journeyCompleted: true, alreadyAsked: false }),
    true,
  )
  assert.equal(
    review.shouldRequestStoreReview({ ratedCount: 8, journeyCompleted: true, alreadyAsked: true }),
    false,
  )
})

test('share links keep the invite code and the wine', () => {
  const page = wineShare.wineSharePageUrl(
    {
      wineName: 'Barolo',
      winery: 'Giacosa',
      vintage: 2018,
      scoreLabel: '9/10',
      referralCode: 'k7h2m9qx',
    },
    'https://decantiwine.com/',
  )
  const url = new URL(page)
  assert.equal(url.origin + url.pathname, 'https://decantiwine.com/share.html')
  assert.equal(url.searchParams.get('ref'), 'K7H2M9QX')
  assert.equal(url.searchParams.get('wine'), 'Barolo')
  assert.equal(url.searchParams.get('score'), '9/10')
  assert.equal(
    wineShare.wineShareFunctionUrl('https://abc.supabase.co/', '11111111-1111-4111-8111-111111111111'),
    'https://abc.supabase.co/functions/v1/wine-share?id=11111111-1111-4111-8111-111111111111',
  )
  assert.equal(wineShare.wineShareCaption('Barolo 2018', '9/10'), 'Barolo 2018 — 9/10 on Decanti')
  assert.equal(shareCard.SHARE_CARD_FOOTER, 'decantiwine.com')
})

test('menu picks share as a match, not a score out of 10', () => {
  const input = menuShare.menuMatchShareInput({
    line: '2019 Giacosa Barolo',
    winery: 'Giacosa',
    wineName: 'Barolo',
    vintage: '2019',
    price: '$90',
    score: 85,
    reasons: ['Close to wines you rate highly'],
  })
  assert.equal(input.scoreLabel, '85 match')
  assert.equal(input.scoreMax, 100)
  assert.equal(input.wine.name, 'Barolo')
  assert.match(input.wine.notes, /Close to wines/)
})

test('share preview html escapes the wine name and keeps the invite', () => {
  const html = renderWineShareHtml({
    wineName: '<script>alert(1)</script>',
    scoreLabel: '9/10',
    referralCode: 'AB12CD',
    imageUrl: 'https://example.com/card.png',
  })
  assert.equal(html.includes('<script>alert(1)</script>'), false)
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /data-ref="AB12CD"/)
  assert.match(html, /intent:\/\/invite/)
  assert.match(html, /com\.northline\.decanti/)
})
