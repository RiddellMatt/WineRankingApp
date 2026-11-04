import { SplashScreen } from '@capacitor/splash-screen'
import { isNativeApp } from './platform'

let splashHidden = false

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

/** Hide launch splash once UI is ready (avoids flash/shake while layout settles). */
export async function hideNativeSplashOnce(): Promise<void> {
  if (!isNativeApp() || splashHidden) return
  splashHidden = true
  await waitForNextPaint()
  try {
    await SplashScreen.hide()
  } catch {
    // Plugin unavailable in web preview.
  }
}
