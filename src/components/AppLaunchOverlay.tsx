import { useLayoutEffect, useState } from 'react'
import { loadStoredTheme, THEME_META, THEME_OPTIONS } from '../lib/themes'
import { isNativeApp } from '../lib/platform'
import { registerLaunchOverlay, type LaunchOverlayPhase } from '../lib/nativeSplash'

export function AppLaunchOverlay() {
  const [phase, setPhase] = useState<LaunchOverlayPhase>(() =>
    isNativeApp() ? 'visible' : 'done',
  )

  useLayoutEffect(() => {
    if (!isNativeApp()) return
    registerLaunchOverlay({
      exit: () => setPhase('exiting'),
      done: () => setPhase('done'),
    })
    return () => registerLaunchOverlay(null)
  }, [])

  if (phase === 'done') return null

  const theme = loadStoredTheme()
  const logoSrc =
    THEME_OPTIONS.find((option) => option.id === theme)?.logoSrc ??
    `${import.meta.env.BASE_URL}brand/logo-light.png`

  return (
    <div
      className={`app-launch-overlay ${phase === 'exiting' ? 'app-launch-overlay--exit' : ''}`}
      style={{ backgroundColor: THEME_META[theme] }}
      aria-hidden="true"
    >
      <div className="app-launch-stack">
        <img className="app-launch-logo" src={logoSrc} alt="" decoding="async" />
        <p className="app-launch-wordmark">Decanti</p>
      </div>
    </div>
  )
}
