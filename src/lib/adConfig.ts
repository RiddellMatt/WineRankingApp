import { Capacitor } from '@capacitor/core'

/** Google sample banner units — safe for development; replace via env for production. */
const TEST_BANNER_IOS = 'ca-app-pub-3940256089942544/2934735716'
const TEST_BANNER_ANDROID = 'ca-app-pub-3940256089942544/6300978111'

/** Decanti production banner units (AdMob console). */
const PRODUCTION_BANNER_IOS = 'ca-app-pub-5228268438882570/1899228305'
const PRODUCTION_BANNER_ANDROID = 'ca-app-pub-5228268438882570/1149253411'

function envString(key: string): string {
  const value = import.meta.env[key]
  return typeof value === 'string' ? value.trim() : ''
}

function envFlag(key: string): boolean {
  const value = import.meta.env[key]
  return value === 'true' || value === '1'
}

/** Default true until you set VITE_ADMOB_TEST_MODE=false for production units. */
const useTestAds = import.meta.env.VITE_ADMOB_TEST_MODE !== 'false'

/** When true, banners show for Pro (for QA). Production should leave this unset. */
export function adsShowForPro(): boolean {
  return envFlag('VITE_ADMOB_SHOW_FOR_PRO')
}

export function shouldUseTestAdUnits(): boolean {
  return useTestAds
}

/** Google demo units — use when production has no fill during AdMob app setup. */
export function googleTestBannerAdUnitId(): string | null {
  const platform = Capacitor.getPlatform()
  if (platform === 'ios') return TEST_BANNER_IOS
  if (platform === 'android') return TEST_BANNER_ANDROID
  return null
}

export function bannerAdUnitId(): string | null {
  const platform = Capacitor.getPlatform()
  if (platform !== 'ios' && platform !== 'android') return null

  if (useTestAds) {
    return googleTestBannerAdUnitId()
  }

  const fromEnv =
    platform === 'ios' ? envString('VITE_ADMOB_BANNER_IOS') : envString('VITE_ADMOB_BANNER_ANDROID')
  if (fromEnv) return fromEnv
  return platform === 'ios' ? PRODUCTION_BANNER_IOS : PRODUCTION_BANNER_ANDROID
}

/** Whether ads may run for this subscriber state. */
export function adsEnabledForUser(isPro: boolean): boolean {
  if (!isPro) return true
  return adsShowForPro()
}
