import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import { createServer, type ViteDevServer } from 'vite'
import { openInAppHref, storeLinksForPlatform, storePlatform } from '../src/lib/storeRoutingCore.js'
import {
  SHARE_APP_STORE_URL,
  SHARE_PLAY_STORE_URL,
  sharePageRoutingScript,
} from '../src/lib/storeRouting.ts'
import { FREE_MENU_SCANS, resolveScanAllowance } from '../supabase/functions/_shared/scanQuota.ts'
import { renderWineShareHtml } from '../supabase/functions/_shared/wineShareHtml.ts'

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const APP_STORE = 'https://apps.apple.com/app/decanti/id1234567890'
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.northline.decanti&hl=en'

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
    appStoreUrl: APP_STORE,
    playStoreUrl: PLAY_STORE,
  })
  assert.equal(html.includes('<script>alert(1)</script>'), false)
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /data-ref="AB12CD"/)
  assert.match(html, /intent:\/\/invite/)
  assert.match(html, /com\.northline\.decanti/)
  assert.equal(bodyAttr(html, 'data-app-store'), APP_STORE)
  assert.equal(bodyAttr(html, 'data-play-store'), PLAY_STORE)
  assert.match(html, /id="open-app-store" hidden/)
  assert.match(html, /id="open-play-store" hidden/)
})

test('share pages publish the store urls from brand, and hide them while empty', () => {
  const page = readFileSync(new URL('../public/share.html', import.meta.url), 'utf8')
  const script = readFileSync(new URL('../public/store-routing.js', import.meta.url), 'utf8')
  assert.equal(script, sharePageRoutingScript())
  assert.equal(bodyAttr(page, 'data-app-store'), SHARE_APP_STORE_URL)
  assert.equal(bodyAttr(page, 'data-play-store'), SHARE_PLAY_STORE_URL)
  assert.match(page, /src="\.\/store-routing\.js"/)
  const rendered = renderWineShareHtml({ wineName: 'Barolo', scoreLabel: '9/10' })
  assert.equal(bodyAttr(rendered, 'data-app-store'), SHARE_APP_STORE_URL)
  assert.equal(bodyAttr(rendered, 'data-play-store'), SHARE_PLAY_STORE_URL)

  const fromStaticPage = runShareScript(script, {
    userAgent: ANDROID_UA,
    href: 'https://decantiwine.com/share.html?wine=Barolo&ref=K7H2M9QX',
    search: '?wine=Barolo&ref=K7H2M9QX',
    body: {
      'data-app-store': bodyAttr(page, 'data-app-store'),
      'data-play-store': bodyAttr(page, 'data-play-store'),
    },
  })
  assert.equal(fromStaticPage['open-web'].href, 'https://decantiwine.com/?ref=K7H2M9QX')
  assert.match(fromStaticPage['open-app'].href, /^intent:\/\/invite\?ref=K7H2M9QX#Intent;/)
  const playListing = SHARE_PLAY_STORE_URL.trim()
  if (playListing) {
    assert.match(
      fromStaticPage['open-app'].href,
      new RegExp(`browser_fallback_url=${encodeURIComponent(playListing)}`),
    )
  } else {
    assert.match(fromStaticPage['open-app'].href, /browser_fallback_url=https%3A%2F%2Fdecantiwine\.com/)
  }
  assert.equal(fromStaticPage['open-app-store'].hidden, true)
  assert.equal(fromStaticPage['open-play-store'].hidden, playListing.length === 0)
})

test('a share click opens the store that matches the phone', () => {
  const cases = [
    { ua: IPHONE_UA, touch: 0, platform: 'ios' as const },
    { ua: ANDROID_UA, touch: 0, platform: 'android' as const },
    { ua: DESKTOP_UA, touch: 0, platform: 'desktop' as const },
    { ua: DESKTOP_UA, touch: 5, platform: 'ios' as const },
  ]
  for (const sample of cases) {
    assert.equal(storePlatform(sample.ua, { maxTouchPoints: sample.touch }), sample.platform)
    const links = storeLinksForPlatform(sample.platform, {
      appStoreUrl: APP_STORE,
      playStoreUrl: PLAY_STORE,
    })
    const html = renderWineShareHtml({
      wineName: 'Barolo',
      scoreLabel: '9/10',
      referralCode: 'AB12CD',
      appStoreUrl: `  ${APP_STORE}  `,
      playStoreUrl: PLAY_STORE,
    })
    const routed = runShareScript(routingScriptFromHtml(html), {
      userAgent: sample.ua,
      maxTouchPoints: sample.touch,
      href: 'https://abc.supabase.co/functions/v1/wine-share?id=1',
      search: '?id=1',
      body: {
        'data-ref': 'AB12CD',
        'data-site': 'https://decantiwine.com/',
        'data-app-store': bodyAttr(html, 'data-app-store'),
        'data-play-store': bodyAttr(html, 'data-play-store'),
      },
    })
    const web = 'https://decantiwine.com/?ref=AB12CD'
    assert.equal(routed['open-web'].href, web)
    assert.equal(
      routed['open-app'].href,
      openInAppHref({
        platform: sample.platform,
        referralCode: 'AB12CD',
        webUrl: web,
        playStoreUrl: links.playStoreUrl,
        scheme: 'com.northline.decanti',
        packageId: 'com.northline.decanti',
      }),
    )
    assert.equal(routed['open-app-store'].href, links.appStoreUrl ?? '')
    assert.equal(routed['open-app-store'].hidden, links.appStoreUrl == null)
    assert.equal(routed['open-play-store'].href, links.playStoreUrl ?? '')
    assert.equal(routed['open-play-store'].hidden, links.playStoreUrl == null)
  }

  const iphone = storeLinksForPlatform('ios', { appStoreUrl: APP_STORE, playStoreUrl: PLAY_STORE })
  assert.equal(iphone.appStoreUrl, APP_STORE)
  assert.equal(iphone.playStoreUrl, null)
  const android = storeLinksForPlatform('android', { appStoreUrl: APP_STORE, playStoreUrl: PLAY_STORE })
  assert.equal(android.appStoreUrl, null)
  assert.equal(android.playStoreUrl, PLAY_STORE)
  const desktop = storeLinksForPlatform('desktop', { appStoreUrl: APP_STORE, playStoreUrl: PLAY_STORE })
  assert.deepEqual(desktop, { appStoreUrl: APP_STORE, playStoreUrl: PLAY_STORE })
  assert.deepEqual(storeLinksForPlatform('desktop', { appStoreUrl: '', playStoreUrl: '  ' }), {
    appStoreUrl: null,
    playStoreUrl: null,
  })

  const androidHref = openInAppHref({
    platform: 'android',
    referralCode: 'AB12CD',
    webUrl: 'https://decantiwine.com/?ref=AB12CD',
    playStoreUrl: PLAY_STORE,
    scheme: 'com.northline.decanti',
    packageId: 'com.northline.decanti',
  })
  assert.match(androidHref, new RegExp(`browser_fallback_url=${encodeURIComponent(PLAY_STORE)}`))
  const websiteFallback = openInAppHref({
    platform: 'android',
    referralCode: 'AB12CD',
    webUrl: 'https://decantiwine.com/?ref=AB12CD',
    scheme: 'com.northline.decanti',
    packageId: 'com.northline.decanti',
  })
  assert.match(websiteFallback, /browser_fallback_url=https%3A%2F%2Fdecantiwine\.com/)
  assert.equal(
    openInAppHref({
      platform: 'ios',
      referralCode: 'AB12CD',
      webUrl: 'https://decantiwine.com/?ref=AB12CD',
      playStoreUrl: PLAY_STORE,
      scheme: 'com.northline.decanti',
      packageId: 'com.northline.decanti',
    }),
    'com.northline.decanti://invite?ref=AB12CD',
  )
})

function bodyAttr(html: string, name: string): string {
  const body = html.match(/<body\b([^>]*)>/)
  assert.ok(body, 'share page has a body tag')
  const attr = body[1].match(new RegExp(`\\s${name}="([^"]*)"`))
  assert.ok(attr, name)
  return attr[1]
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function routingScriptFromHtml(html: string): string {
  const match = html.match(/<script>\s*(\/\* decanti-store-routing \*\/[\s\S]*?)<\/script>/)
  assert.ok(match, 'share page includes the routing script')
  return match[1]
}

function runShareScript(
  script: string,
  options: {
    userAgent: string
    maxTouchPoints?: number
    href: string
    search: string
    body: Record<string, string>
  },
) {
  const elements = new Map<string, { hidden: boolean; attrs: Record<string, string> }>()
  for (const id of ['open-web', 'open-app', 'open-app-store', 'open-play-store']) {
    elements.set(id, { hidden: true, attrs: {} })
  }
  const document = {
    body: {
      getAttribute(name: string) {
        return Object.prototype.hasOwnProperty.call(options.body, name) ? options.body[name] : null
      },
    },
    getElementById(id: string) {
      const el = elements.get(id)
      if (!el) return null
      return {
        get hidden() {
          return el.hidden
        },
        set hidden(value: boolean) {
          el.hidden = value
        },
        setAttribute(name: string, value: string) {
          el.attrs[name] = String(value)
        },
        getAttribute(name: string) {
          return el.attrs[name] ?? null
        },
      }
    },
  }
  vm.runInNewContext(script, {
    document,
    navigator: {
      userAgent: options.userAgent,
      maxTouchPoints: options.maxTouchPoints ?? 0,
    },
    location: { search: options.search, href: options.href },
    URL,
    URLSearchParams,
    encodeURIComponent,
  })
  return Object.fromEntries(
    [...elements].map(([id, el]) => [id, { hidden: el.hidden, href: el.attrs.href ?? '' }]),
  )
}
