import { Capacitor } from '@capacitor/core'

/** Google sample banner units — safe for development; replace via env for production. */
const TEST_BANNER_IOS = 'ca-app-pub-3940256089942544/2934735716'
const TEST_BANNER_ANDROID = 'ca-app-pub-3940256089942544/6300978111'

function envString(key: string): string {
  const value = import.meta.env[key]
  return typeof value === 'string' ? value.trim() : ''
}

const useTestAds = import.meta.env.VITE_ADMOB_TEST_MODE !== 'false'

export function shouldUseTestAdUnits(): boolean {
  return useTestAds
}

export function bannerAdUnitId(): string | null {
  const platform = Capacitor.getPlatform()
  if (platform !== 'ios' && platform !== 'android') return null

  if (useTestAds) {
    return platform === 'ios' ? TEST_BANNER_IOS : TEST_BANNER_ANDROID
  }

  const configured =
    platform === 'ios' ? envString('VITE_ADMOB_BANNER_IOS') : envString('VITE_ADMOB_BANNER_ANDROID')
  return configured || null
}
