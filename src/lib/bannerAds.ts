import { Capacitor } from '@capacitor/core'
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  type AdMobBannerSize,
} from '@capacitor-community/admob'
import type { PluginListenerHandle } from '@capacitor/core'
import { bannerAdUnitId } from './adConfig'
import { isNativeApp } from './platform'

let running = false
let listeners: PluginListenerHandle[] = []

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

/** Lift banner above Decanti bottom chrome (native UITabBar or HTML dock). */
function bannerBottomMarginPx(): number {
  const root = document.documentElement
  const tabBar =
    parseFloat(getComputedStyle(root).getPropertyValue('--tab-bar-height')) || 3.55 * 16
  if (root.classList.contains('native-ios-tab-bar')) {
    return Math.round(tabBar)
  }
  if (root.classList.contains('native-app')) {
    return Math.round(tabBar + 12)
  }
  return 0
}

async function ensureConsent(): Promise<boolean> {
  try {
    let consent = await AdMob.requestConsentInfo()
    if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) {
      consent = await AdMob.showConsentForm()
    }
    return consent.canRequestAds
  } catch {
    return true
  }
}

async function attachListeners(): Promise<void> {
  if (listeners.length > 0) return
  listeners = await Promise.all([
    AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size: AdMobBannerSize) => {
      setBannerInset(size.height)
    }),
    AdMob.addListener(BannerAdPluginEvents.FailedToLoad, () => {
      setBannerInset(0)
    }),
  ])
}

async function detachListeners(): Promise<void> {
  await Promise.all(listeners.map((h) => h.remove()))
  listeners = []
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

  try {
    await AdMob.initialize()
    const ok = await ensureConsent()
    if (!ok) {
      running = false
      return
    }

    await attachListeners()

    await AdMob.showBanner({
      adId,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: bannerBottomMarginPx(),
    })
  } catch (err) {
    console.warn('AdMob banner failed to start', err)
    running = false
    setBannerInset(0)
    await detachListeners()
  }
}

export async function stopBannerAds(): Promise<void> {
  if (!isNativeApp()) return
  setBannerInset(0)
  try {
    await AdMob.removeBanner()
  } catch {
    // ignore
  }
  await detachListeners()
  running = false
}

/** Call when bottom chrome changes (e.g. native tab bar appears) so banner is not covered. */
export async function refreshBannerMargin(): Promise<void> {
  if (!running) return
  const adId = bannerAdUnitId()
  if (!adId) return
  try {
    await AdMob.removeBanner()
    await AdMob.showBanner({
      adId,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: bannerBottomMarginPx(),
    })
  } catch {
    // ignore
  }
}
