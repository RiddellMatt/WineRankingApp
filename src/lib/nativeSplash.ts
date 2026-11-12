import { SplashScreen } from '@capacitor/splash-screen'
import { isNativeApp } from './platform'

const FADE_MS = 480

let splashHidden = false

export type LaunchOverlayPhase = 'visible' | 'exiting' | 'done'

type LaunchOverlayBridge = {
  exit: () => void
  done: () => void
}

let launchOverlay: LaunchOverlayBridge | null = null

export function registerLaunchOverlay(bridge: LaunchOverlayBridge | null): void {
  launchOverlay = bridge
}

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/** Hide launch splash once UI is ready — branded overlay fades, then native splash. */
export async function hideNativeSplashOnce(): Promise<void> {
  if (!isNativeApp() || splashHidden) return

  launchOverlay?.exit()
  await waitMs(FADE_MS)

  splashHidden = true
  await waitForNextPaint()
  try {
    await SplashScreen.hide({ fadeOutDuration: FADE_MS })
  } catch {
    // Plugin unavailable in web preview.
  }

  launchOverlay?.done()
}
