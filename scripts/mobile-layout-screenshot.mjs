/**
 * Mobile layout check: flex tab bar + scrollable content (no overlap).
 * Run with dev server on http://127.0.0.1:5173
 */
import { chromium, devices } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const OUT_DIR = '/opt/cursor/artifacts'
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173'

const sampleWines = [
  {
    id: '1',
    name: 'Whispering Angel',
    winery: "Château d'Esclans",
    vintage: 2023,
    type: 'Rosé',
    varietal: 'Grenache blend',
    region: 'Provence, France',
    price: 45,
    ratingEnjoyment: 4,
    ratingValue: 4,
    rating: 4,
    notes: 'Pale salmon. Strawberry and white peach.',
    purchasedAt: "Trader Joe's",
    taste: {},
    status: 'tried',
    addedAt: Date.now() - 86400000,
  },
  {
    id: '2',
    name: 'Barolo Riserva',
    winery: 'Marchesi di Barolo',
    vintage: 2016,
    type: 'Red',
    varietal: 'Nebbiolo',
    region: 'Piedmont, Italy',
    price: 85,
    ratingEnjoyment: 5,
    ratingValue: 4,
    rating: 4.8,
    notes: '',
    purchasedAt: '',
    taste: {},
    status: 'tried',
    addedAt: Date.now() - 172800000,
  },
]

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({
    ...devices['iPhone 14 Pro'],
    locale: 'en-US',
  })
  const page = await context.newPage()
  await page.addInitScript((wines) => {
    document.documentElement.classList.add('native-app')
    document.body.classList.add('native-app')
    localStorage.setItem('decanti.wines.v1', JSON.stringify(wines))
    localStorage.setItem('decanti.offline-mode', 'true')
    localStorage.setItem('decanti.ranking-preference-setup-done', '1')
    localStorage.setItem('decanti.ranking-preference', 'enjoyment')
  }, sampleWines)

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
  // Auth/session bootstrap on configured builds can take a few seconds.
  await page.waitForTimeout(2500)
  const offlineBtn = page.getByRole('button', { name: /Continue without an account/i })
  if (await offlineBtn.isVisible().catch(() => false)) {
    await offlineBtn.click()
    await page.waitForTimeout(800)
  }
  await page.waitForSelector('nav.tabs', { timeout: 20000 })

  const rankingModal = page.locator('.ranking-onboarding')
  if (await rankingModal.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /enjoyment/i }).first().click()
  }

  await page.waitForSelector('.wine-list li, .cellar-empty', { timeout: 20000 })

  // Cellar: scroll to bottom
  await page.click('button[aria-label="Cellar"]')
  await page.waitForTimeout(400)
  const content = page.locator('main.content')
  await content.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  await page.waitForTimeout(300)
  await page.screenshot({
    path: path.join(OUT_DIR, 'mobile-cellar-scroll-bottom.png'),
    fullPage: false,
  })

  // Profile activity
  await page.click('button[aria-label="Profile"]')
  await page.waitForTimeout(400)
  await content.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  await page.waitForTimeout(300)
  await page.screenshot({
    path: path.join(OUT_DIR, 'mobile-profile-scroll-bottom.png'),
    fullPage: false,
  })

  const metrics = await page.evaluate(() => {
    const tabs = document.querySelector('.tabs')
    const main = document.querySelector('main.content')
    const lastCard = document.querySelector('.wine-card:last-child, .own-activity-item:last-child')
    const vw = document.documentElement.clientWidth
    let widest = { tag: '', width: vw }
    for (const el of document.querySelectorAll('body *')) {
      const rect = el.getBoundingClientRect()
      if (rect.width > widest.width + 0.5) {
        widest = { tag: el.tagName + (el.className ? `.${String(el.className).split(' ')[0]}` : ''), width: rect.width }
      }
    }
    const docOverflow = Math.max(
      document.documentElement.scrollWidth - vw,
      document.body.scrollWidth - vw,
    )
    if (!tabs || !main) return null
    const tr = tabs.getBoundingClientRect()
    const vr = { bottom: window.innerHeight, top: 0, left: 0, right: window.innerWidth }
    const tabsClipped = tr.bottom > vr.bottom + 0.5 || tr.top < 0
    let cardAboveTabs = true
    if (lastCard) {
      const cr = lastCard.getBoundingClientRect()
      cardAboveTabs = cr.bottom <= tr.top + 1
    }
    return {
      viewportHeight: window.innerHeight,
      viewportWidth: vw,
      tabsTop: tr.top,
      tabsBottom: tr.bottom,
      tabsClipped,
      cardAboveTabs,
      mainScrollHeight: main.scrollHeight,
      mainClientHeight: main.clientHeight,
      docHorizontalOverflow: docOverflow,
      widestElement: widest,
    }
  })

  // Profile passport tab — common overflow surface
  await page.click('button[aria-label="Profile"]')
  await page.waitForTimeout(300)
  const passportTab = page.getByRole('button', { name: 'Passport' })
  if (await passportTab.isVisible().catch(() => false)) {
    await passportTab.click()
    await page.waitForTimeout(500)
  }
  await page.screenshot({
    path: path.join(OUT_DIR, 'mobile-passport-tab.png'),
    fullPage: false,
  })

  // Attempt horizontal pan on the shell — tabs should stay anchored
  const panMetrics = await page.evaluate(() => {
    const tabs = document.querySelector('.tabs')
    const before = tabs?.getBoundingClientRect().left ?? 0
    window.scrollBy(80, 0)
    const afterScroll = tabs?.getBoundingClientRect().left ?? 0
    window.scrollTo(0, 0)
    const vw = document.documentElement.clientWidth
    const overflow = Math.max(
      document.documentElement.scrollWidth - vw,
      document.body.scrollWidth - vw,
    )
    return { tabsShifted: Math.abs(afterScroll - before) > 1, overflow }
  })
  await writeFile(
    path.join(OUT_DIR, 'mobile-horizontal-pan-metrics.json'),
    JSON.stringify(panMetrics, null, 2),
  )

  await writeFile(path.join(OUT_DIR, 'mobile-layout-metrics.json'), JSON.stringify(metrics, null, 2))
  await browser.close()

  if (!metrics) {
    console.error('Layout metrics unavailable')
    process.exit(1)
  }
  if (
    metrics.tabsClipped ||
    !metrics.cardAboveTabs ||
    metrics.docHorizontalOverflow > 1 ||
    panMetrics.overflow > 1 ||
    panMetrics.tabsShifted
  ) {
    console.error('Layout check FAILED', { metrics, panMetrics })
    process.exit(1)
  }
  console.log('Layout check OK', { metrics, panMetrics })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
