import { SplashScreen } from '@capacitor/splash-screen'
import { isNativeApp } from './platform'

/** Branded splash stays up at least this long (ms). */
export const MIN_LAUNCH_VISIBLE_MS = 1500
const FADE_MS = 500

let splashHidden = false
let launchEpochMs = 0
let hideInFlight: Promise<void> | null = null

export type LaunchOverlayPhase = 'visible' | 'exiting' | 'done'

type LaunchOverlayBridge = {
  exit: () => void
  done: () => void
}

let launchOverlay: LaunchOverlayBridge | null = null

const launchCompleteListeners = new Set<() => void>()

export function initLaunchEpoch(): void {
  if (!isNativeApp() || launchEpochMs > 0) return
  launchEpochMs = Date.now()
}

export function isLaunchSequenceComplete(): boolean {
  return !isNativeApp() || splashHidden
}

/** Subscribe to launch fade finishing (native tab bar can appear after). */
export function onLaunchComplete(listener: () => void): () => void {
  launchCompleteListeners.add(listener)
  if (splashHidden) listener()
  return () => launchCompleteListeners.delete(listener)
}

function emitLaunchComplete(): void {
  for (const listener of launchCompleteListeners) listener()
}

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

async function waitForOverlayBridge(maxMs = 5000): Promise<void> {
  const start = Date.now()
  while (!launchOverlay && Date.now() - start < maxMs) {
    await waitMs(32)
  }
}

async function waitForMinLaunchVisible(): Promise<void> {
  const epoch = launchEpochMs || Date.now()
  const remain = Math.max(0, MIN_LAUNCH_VISIBLE_MS - (Date.now() - epoch))
  if (remain > 0) await waitMs(remain)
}

/**
 * Dismiss native Capacitor splash, then fade the in-app launch overlay.
 * Honors minimum visible time so fast loads still show the transition.
 */
export async function hideNativeSplashOnce(): Promise<void> {
  if (!isNativeApp() || splashHidden) return
  if (hideInFlight) return hideInFlight

  hideInFlight = (async () => {
    await waitForOverlayBridge()
    await waitForMinLaunchVisible()
    await waitForNextPaint()

    try {
      await SplashScreen.hide({ fadeOutDuration: 300 })
    } catch {
      // Plugin unavailable in web preview.
    }

    await waitMs(100)
    launchOverlay?.exit()
    await waitMs(FADE_MS)

    splashHidden = true
    launchOverlay?.done()
    emitLaunchComplete()
  })()

  try {
    await hideInFlight
  } finally {
    hideInFlight = null
  }
}
