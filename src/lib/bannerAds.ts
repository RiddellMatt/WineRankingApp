import { Capacitor } from '@capacitor/core'
import { setBannerAdDebug } from './bannerAdDebug'
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  type AdMobBannerSize,
  type BannerAdOptions,
} from '@capacitor-community/admob'
import type { PluginListenerHandle } from '@capacitor/core'
import {
  adUnitModeLabel,
  bannerAdUnitId,
  googleTestBannerAdUnitId,
  productionTestFallbackEnabled,
  shouldUseTestAdUnits,
} from './adConfig'
import { isNativeApp } from './platform'
import { isBannerChromeSettled } from './bannerChrome'

let running = false
let activeAdUnitId: string | null = null
let productionLoadFailed = false
let requestNonPersonalizedAds = false
let listeners: PluginListenerHandle[] = []
let refreshMarginTimer: ReturnType<typeof setTimeout> | null = null
let loadWatchdogTimer: ReturnType<typeof setTimeout> | null = null
/** True after native SizeChanged reports height > 0 (safe to remove+re-show for margin). */
let nativeBannerSized = false
/** Margin last passed to showBanner. Same margin must not remove and reload the ad. */
let presentedMargin: number | null = null
let lastPresentedSize: BannerAdSize | null = null
let presentQueue: Promise<void> = Promise.resolve()
let chromeWait: Promise<void> | null = null
let chromeGeneration = 0
/** Reserve space while loading; adaptive banners are often taller than 50pt. */
const PENDING_SLOT_PX = 60
const PROVISIONAL_BANNER_HEIGHT_PX = 60

/** Google errors that mean prod will not fill soon — avoid reserved empty gutter. */
function isAdAccountOrSetupBlock(message: string): boolean {
  return /account not approved|publisher data not found|not approved yet|ad unit.*not found/i.test(
    message,
  )
}

function syncBannerContentPad(heightPx: number): void {
  const root = document.documentElement
  if (heightPx <= 0) {
    root.style.removeProperty('--banner-content-pad')
    root.style.removeProperty('--banner-native-margin')
    return
  }
  const margin = bannerBottomMarginPx()
  const pad = Math.ceil(heightPx + margin + 20)
  root.style.setProperty('--banner-native-margin', `${margin}px`)
  root.style.setProperty('--banner-content-pad', `${pad}px`)
}

function setBannerInset(heightPx: number): void {
  const root = document.documentElement
  if (heightPx > 0) {
    root.style.setProperty('--banner-ad-height', `${heightPx}px`)
    syncBannerContentPad(heightPx)
    root.classList.add('show-banner-ad')
    root.classList.remove('ad-banner-pending')
  } else {
    root.style.removeProperty('--banner-ad-height')
    root.style.removeProperty('--banner-content-pad')
    root.style.removeProperty('--banner-native-margin')
    root.classList.remove('show-banner-ad')
    root.classList.remove('ad-banner-pending')
  }
}

function setPendingAdSlot(): void {
  const root = document.documentElement
  root.classList.add('show-banner-ad', 'ad-banner-pending')
  root.style.setProperty('--banner-ad-height', `${PENDING_SLOT_PX}px`)
  syncBannerContentPad(PENDING_SLOT_PX)
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    }),
  ])
}

function cssPx(value: string): number {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

/** Lift banner above Decanti bottom chrome (native UITabBar or HTML dock). */
function bannerBottomMarginPx(): number {
  const root = document.documentElement
  const style = getComputedStyle(root)
  const tabBar = cssPx(style.getPropertyValue('--tab-bar-height')) || 3.55 * 16
  const safeBottom = cssPx(style.getPropertyValue('--safe-bottom'))
  if (root.classList.contains('native-ios-tab-bar')) {
    // UIView banner sits on the full window; lift above native UITabBar (~49pt) + home indicator.
    return Math.round(49 + safeBottom + 6)
  }
  if (root.classList.contains('native-app')) {
    return Math.round(tabBar + 12)
  }
  return 0
}

function bannerOptions(adId: string): BannerAdOptions {
  return {
    adId,
    adSize: BannerAdSize.ADAPTIVE_BANNER,
    position: BannerAdPosition.BOTTOM_CENTER,
    margin: bannerBottomMarginPx(),
    isTesting: false,
    npa: requestNonPersonalizedAds,
  }
}

async function ensureConsent(): Promise<boolean> {
  requestNonPersonalizedAds = false
  if (shouldUseTestAdUnits()) {
    requestNonPersonalizedAds = true
    setBannerAdDebug('consent', 'skipped (test)')
    return true
  }
  try {
    setBannerAdDebug('consent', 'requesting')
    let consent = await withTimeout(AdMob.requestConsentInfo(), 12_000, 'UMP consent info')
    if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) {
      setBannerAdDebug('consent', 'form')
      consent = await withTimeout(AdMob.showConsentForm(), 120_000, 'UMP consent form')
    }
    if (!consent.canRequestAds) {
      console.warn('AdMob banner: consent blocked personalized ads', {
        status: consent.status,
        isConsentFormAvailable: consent.isConsentFormAvailable,
      })
      if (shouldUseTestAdUnits()) {
        requestNonPersonalizedAds = true
        return true
      }
      return false
    }
    return true
  } catch (err) {
    console.warn('AdMob banner: consent check failed (continuing)', err)
    return true
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/** Read the live bottom inset. Custom properties keep the `env()` text, so measure a probe. */
function measureSafeAreaBottomPx(): number {
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;left:0;bottom:0;width:0;height:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden;'
  document.documentElement.appendChild(probe)
  const height = probe.getBoundingClientRect().height
  probe.remove()
  return height
}

function invalidateBannerChrome(): void {
  chromeGeneration += 1
  chromeWait = null
}

/**
 * On the first iOS paint the tab bar has not grown the safe area yet.
 * Showing then makes the banner sit in the old bottom slot until a later
 * reload moves it. Wait until that inset has settled before the first show.
 */
function waitForSettledBannerChrome(): Promise<void> {
  if (Capacitor.getPlatform() !== 'ios') {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()))
  }
  const generation = chromeGeneration
  if (!chromeWait) {
    chromeWait = (async () => {
      const started = Date.now()
      let baseline: number | null = null
      let lastInset = Number.NaN
      let stableTicks = 0
      setBannerAdDebug('position', 'waiting for tab bar')
      while (chromeGeneration === generation) {
        const elapsedMs = Date.now() - started
        const nativeTabBar = document.documentElement.classList.contains('native-ios-tab-bar')
        const insetPx = measureSafeAreaBottomPx()
        if (baseline === null) baseline = insetPx
        stableTicks = insetPx === lastInset ? stableTicks + 1 : 0
        lastInset = insetPx
        if (
          isBannerChromeSettled({
            platform: 'ios',
            nativeTabBar,
            insetPx,
            baselineInsetPx: baseline,
            stableTicks,
            elapsedMs,
          })
        ) {
          setBannerAdDebug('position', `settled ${Math.round(insetPx)}px`)
          return
        }
        await delay(50)
      }
    })()
  }
  return chromeWait
}

function enqueueBannerPresent(task: () => Promise<void>): Promise<void> {
  const run = presentQueue.then(task, task)
  presentQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

function armNativeLoadWatchdog(adId: string, ms = 8_000): void {
  if (loadWatchdogTimer) clearTimeout(loadWatchdogTimer)
  loadWatchdogTimer = setTimeout(() => {
    loadWatchdogTimer = null
    if (!running || nativeBannerSized) return
    const margin = bannerBottomMarginPx()
    setBannerAdDebug('timeout', `retry BANNER m=${margin}`)
    presentedMargin = null
    lastPresentedSize = null
    void enqueueBannerPresent(() => presentBanner(adId, BannerAdSize.BANNER))
  }, ms)
}

async function presentBanner(adId: string, size = BannerAdSize.ADAPTIVE_BANNER): Promise<void> {
  await waitForSettledBannerChrome()
  if (!running) return
  const margin = bannerBottomMarginPx()
  if (presentedMargin === margin && activeAdUnitId === adId && lastPresentedSize === size) return
  activeAdUnitId = adId
  lastPresentedSize = size
  nativeBannerSized = false
  setPendingAdSlot()
  setBannerAdDebug('show', `${size} m=${margin}`)
  await AdMob.showBanner({ ...bannerOptions(adId), adSize: size })
  presentedMargin = margin
  armNativeLoadWatchdog(adId)
}

async function tryTestBannerAfterProductionNoFill(): Promise<void> {
  if (shouldUseTestAdUnits() || productionLoadFailed || !productionTestFallbackEnabled()) return
  const testId = googleTestBannerAdUnitId()
  if (!testId || !running) return
  productionLoadFailed = true
  console.warn(
    'AdMob banner: production unit did not load — showing Google test banner so you can verify the pipeline.',
  )
  try {
    await AdMob.removeBanner()
    presentedMargin = null
    lastPresentedSize = null
    await enqueueBannerPresent(() => presentBanner(testId))
  } catch (err) {
    console.warn('AdMob banner: test fallback failed', err)
  }
}

async function attachListeners(): Promise<void> {
  if (listeners.length > 0) return
  listeners = await Promise.all([
    AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size: AdMobBannerSize) => {
      setBannerInset(size.height)
      if (size.height > 0) {
        nativeBannerSized = true
        if (loadWatchdogTimer) {
          clearTimeout(loadWatchdogTimer)
          loadWatchdogTimer = null
        }
        setBannerAdDebug('loaded', `${Math.round(size.height)}px`)
      }
    }),
    AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
      setBannerAdDebug('loaded', 'native creative')
      if (!nativeBannerSized) {
        setBannerInset(PROVISIONAL_BANNER_HEIGHT_PX)
      }
    }),
    AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (err) => {
      const message =
        typeof err === 'object' && err && 'message' in err
          ? String((err as { message?: string }).message)
          : String(err)
      console.warn('AdMob banner failed to load', err)
      nativeBannerSized = false
      const short = message.replace(/\s*<https?:\/\/[^>]+>/g, '').slice(0, 72)
      setBannerAdDebug('failed', `${short} (${adUnitModeLabel()})`)
      if (shouldUseTestAdUnits()) {
        setPendingAdSlot()
      } else if (isAdAccountOrSetupBlock(message)) {
        setBannerInset(0)
      } else {
        setPendingAdSlot()
      }
      void tryTestBannerAfterProductionNoFill()
    }),
  ])
}

async function detachListeners(): Promise<void> {
  await Promise.all(listeners.map((h) => h.remove()))
  listeners = []
}

/** Show adaptive bottom banner for signed-in free users on native builds. */
export async function startBannerAds(): Promise<void> {
  if (!isNativeApp() || Capacitor.getPlatform() === 'web') {
    setBannerAdDebug('skipped', 'not native')
    return
  }
  if (running) return

  const adId = bannerAdUnitId()
  if (!adId) {
    setBannerAdDebug('skipped', 'no ad unit id')
    console.warn('AdMob banner: no ad unit id (set VITE_ADMOB_* or use test mode)')
    return
  }

  if (!Capacitor.isPluginAvailable('AdMob')) {
    setBannerAdDebug('error', 'AdMob plugin missing in binary')
    console.warn('AdMob banner: Capacitor plugin not available')
    return
  }

  running = true
  productionLoadFailed = false
  nativeBannerSized = false
  presentedMargin = null
  lastPresentedSize = null
  activeAdUnitId = adId
  setBannerAdDebug('starting', `unit …${adId.slice(-10)}`)
  console.info('AdMob banner: starting', {
    adUnitTail: adId.slice(-12),
    testMode: shouldUseTestAdUnits(),
  })

  try {
    await attachListeners()

    const ok = await ensureConsent()
    if (!ok) {
      setBannerAdDebug('blocked', 'consent')
      running = false
      activeAdUnitId = null
      await detachListeners()
      return
    }

    setBannerAdDebug('init', 'sdk')
    await withTimeout(
      AdMob.initialize({
        initializeForTesting: shouldUseTestAdUnits(),
      }),
      15_000,
      'AdMob.initialize',
    )

    try {
      await enqueueBannerPresent(() => presentBanner(adId))
    } catch (firstErr) {
      if (shouldUseTestAdUnits() && Capacitor.getPlatform() === 'ios') {
        console.warn('AdMob adaptive banner failed, retrying BANNER at the settled margin', firstErr)
        setBannerAdDebug('retry', 'BANNER settled margin')
        presentedMargin = null
        lastPresentedSize = null
        await AdMob.removeBanner()
        await enqueueBannerPresent(() => presentBanner(adId, BannerAdSize.BANNER))
      } else {
        throw firstErr
      }
    }
    setBannerAdDebug('requested', 'awaiting native load')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    setBannerAdDebug('error', message.slice(0, 72))
    console.warn('AdMob banner failed to start', err)
    running = false
    activeAdUnitId = null
    if (shouldUseTestAdUnits()) setPendingAdSlot()
    else setBannerInset(0)
    await detachListeners()
  }
}

export async function stopBannerAds(): Promise<void> {
  if (!isNativeApp()) return
  running = false
  invalidateBannerChrome()
  if (refreshMarginTimer) {
    clearTimeout(refreshMarginTimer)
    refreshMarginTimer = null
  }
  if (loadWatchdogTimer) {
    clearTimeout(loadWatchdogTimer)
    loadWatchdogTimer = null
  }
  setBannerAdDebug('stopped')
  setBannerInset(0)
  try {
    await AdMob.removeBanner()
  } catch {
    // ignore
  }
  await detachListeners()
  activeAdUnitId = null
  productionLoadFailed = false
  requestNonPersonalizedAds = false
  nativeBannerSized = false
  presentedMargin = null
  lastPresentedSize = null
}

/**
 * Re-show the banner only when the bottom margin changed.
 * A same-margin reload is what flashed the old position on cold start.
 */
export async function refreshBannerMargin(force = false): Promise<void> {
  if (!running) return
  if (!force && !nativeBannerSized && presentedMargin === null) return
  const adId = activeAdUnitId ?? bannerAdUnitId()
  if (!adId) return

  if (refreshMarginTimer) clearTimeout(refreshMarginTimer)
  refreshMarginTimer = setTimeout(() => {
    refreshMarginTimer = null
    void enqueueBannerPresent(async () => {
      if (!running) return
      await waitForSettledBannerChrome()
      if (!running) return
      const margin = bannerBottomMarginPx()
      if (presentedMargin === margin) return
      if (!force && !nativeBannerSized) return
      try {
        await AdMob.removeBanner()
        presentedMargin = null
        lastPresentedSize = null
        await presentBanner(adId)
      } catch {
        // ignore
      }
    })
  }, 350)
}
