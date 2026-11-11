import { Capacitor } from '@capacitor/core'
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
import { bannerAdUnitId, googleTestBannerAdUnitId, shouldUseTestAdUnits } from './adConfig'
import { isNativeApp } from './platform'

let running = false
let activeAdUnitId: string | null = null
let productionLoadFailed = false
let requestNonPersonalizedAds = false
let listeners: PluginListenerHandle[] = []
let refreshMarginTimer: ReturnType<typeof setTimeout> | null = null

function setBannerInset(heightPx: number): void {
  const root = document.documentElement
  if (heightPx > 0) {
    root.style.setProperty('--banner-ad-height', `${heightPx}px`)
    root.classList.add('show-banner-ad')
  } else {
    root.style.removeProperty('--banner-ad-height')
    root.classList.remove('show-banner-ad')
  }
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
    return Math.max(100, Math.round(tabBar + safeBottom + 12))
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
  try {
    let consent = await AdMob.requestConsentInfo()
    if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) {
      consent = await AdMob.showConsentForm()
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

async function presentBanner(adId: string): Promise<void> {
  activeAdUnitId = adId
  await AdMob.showBanner(bannerOptions(adId))
}

async function tryTestBannerAfterProductionNoFill(): Promise<void> {
  if (shouldUseTestAdUnits() || productionLoadFailed) return
  const testId = googleTestBannerAdUnitId()
  if (!testId || !running) return
  productionLoadFailed = true
  console.warn(
    'AdMob banner: production unit did not load — showing Google test banner so you can verify the pipeline.',
  )
  try {
    await AdMob.removeBanner()
    await presentBanner(testId)
    activeAdUnitId = testId
  } catch (err) {
    console.warn('AdMob banner: test fallback failed', err)
  }
}

async function attachListeners(): Promise<void> {
  if (listeners.length > 0) return
  listeners = await Promise.all([
    AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size: AdMobBannerSize) => {
      setBannerInset(size.height)
    }),
    AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (err) => {
      console.warn('AdMob banner failed to load', err)
      setBannerInset(0)
      void tryTestBannerAfterProductionNoFill()
    }),
  ])
}

async function detachListeners(): Promise<void> {
  await Promise.all(listeners.map((h) => h.remove()))
  listeners = []
}

function waitForTabBarLayout(): Promise<void> {
  return new Promise((resolve) => {
    if (Capacitor.getPlatform() !== 'ios') {
      resolve()
      return
    }
    requestAnimationFrame(() => {
      window.setTimeout(resolve, 450)
    })
  })
}

/** Show adaptive bottom banner for signed-in free users on native builds. */
export async function startBannerAds(): Promise<void> {
  if (!isNativeApp() || Capacitor.getPlatform() === 'web') return
  if (running) return

  const adId = bannerAdUnitId()
  if (!adId) {
    console.warn('AdMob banner: no ad unit id (set VITE_ADMOB_* or use test mode)')
    return
  }

  running = true
  productionLoadFailed = false
  activeAdUnitId = adId
  console.info('AdMob banner: starting', {
    adUnitTail: adId.slice(-12),
    testMode: shouldUseTestAdUnits(),
  })

  try {
    await attachListeners()

    const ok = await ensureConsent()
    if (!ok) {
      running = false
      activeAdUnitId = null
      await detachListeners()
      return
    }

    await AdMob.initialize({
      initializeForTesting: shouldUseTestAdUnits(),
    })

    await waitForTabBarLayout()
    await presentBanner(adId)
  } catch (err) {
    console.warn('AdMob banner failed to start', err)
    running = false
    activeAdUnitId = null
    setBannerInset(0)
    await detachListeners()
  }
}

export async function stopBannerAds(): Promise<void> {
  if (!isNativeApp()) return
  if (refreshMarginTimer) {
    clearTimeout(refreshMarginTimer)
    refreshMarginTimer = null
  }
  setBannerInset(0)
  try {
    await AdMob.removeBanner()
  } catch {
    // ignore
  }
  await detachListeners()
  running = false
  activeAdUnitId = null
  productionLoadFailed = false
  requestNonPersonalizedAds = false
}

/** Call when bottom chrome changes (e.g. native tab bar appears) so banner is not covered. */
export async function refreshBannerMargin(): Promise<void> {
  if (!running) return
  const adId = activeAdUnitId ?? bannerAdUnitId()
  if (!adId) return

  if (refreshMarginTimer) clearTimeout(refreshMarginTimer)
  refreshMarginTimer = setTimeout(() => {
    refreshMarginTimer = null
    void (async () => {
      if (!running) return
      try {
        await AdMob.removeBanner()
        await presentBanner(adId)
      } catch {
        // ignore
      }
    })()
  }, 350)
}
