import { useLayoutEffect, useState } from 'react'
import { isNativeApp } from '../lib/platform'
import { registerLaunchOverlay, type LaunchOverlayPhase } from '../lib/nativeSplash'
import { THEME_META, THEME_OPTIONS } from '../lib/themes'
import { useAppTheme } from '../lib/useAppTheme'
import { BrandMark } from './BrandMark'

export function AppLaunchOverlay() {
  const theme = useAppTheme()
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

  const wordmark = THEME_OPTIONS.find((item) => item.id === theme)?.wordmarkSrc

  return (
    <div
      className={`app-launch-overlay ${phase === 'exiting' ? 'app-launch-overlay--exit' : ''}`}
      style={{ backgroundColor: THEME_META[theme] }}
      aria-hidden="true"
    >
      {wordmark ? (
        <img src={wordmark} alt="" className="app-launch-logo" decoding="async" />
      ) : (
        <BrandMark className="app-launch-mark" size={88} />
      )}
    </div>
  )
}
