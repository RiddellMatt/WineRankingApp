export type BannerChromeSample = {
  platform: 'ios' | 'android' | 'web'
  /** `html` has the native iOS tab bar class. */
  nativeTabBar: boolean
  /** Measured `env(safe-area-inset-bottom)` in CSS pixels. */
  insetPx: number
  /** First inset seen during this wait. */
  baselineInsetPx: number | null
  /** Consecutive samples with the same inset. */
  stableTicks: number
  elapsedMs: number
}

/** How long a cold start may wait for the tab bar to grow the bottom safe area. */
export const BANNER_CHROME_TIMEOUT_MS = 2500

const IOS_STABLE_TICKS = 3
/** Tab bar adds roughly its own height (~49pt) on top of the home indicator. */
const IOS_TAB_GROWTH_PX = 40
const IOS_MIN_TAB_INSET_PX = 49

/**
 * Cold start used to show the banner before the native tab bar expanded the
 * safe area, then reload it once the inset caught up. Wait until that inset
 * has actually moved (or was already large when we looked) and stopped changing.
 */
export function isBannerChromeSettled(sample: BannerChromeSample): boolean {
  if (sample.platform !== 'ios') return true
  if (sample.elapsedMs >= BANNER_CHROME_TIMEOUT_MS) return true
  if (!sample.nativeTabBar || sample.stableTicks < IOS_STABLE_TICKS) return false
  if (sample.baselineInsetPx === null) return false
  if (
    sample.baselineInsetPx < IOS_MIN_TAB_INSET_PX &&
    sample.insetPx < sample.baselineInsetPx + IOS_TAB_GROWTH_PX
  ) {
    return false
  }
  return sample.insetPx >= IOS_MIN_TAB_INSET_PX
}
