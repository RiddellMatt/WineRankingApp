import { useLayoutEffect, useState } from 'react'
import { isNativeApp } from '../lib/platform'
import { registerLaunchOverlay, type LaunchOverlayPhase } from '../lib/nativeSplash'
import { BrandMark } from './BrandMark'

const LAUNCH_BG = '#ffffff'

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

  return (
    <div
      className={`app-launch-overlay app-launch-overlay--light ${phase === 'exiting' ? 'app-launch-overlay--exit' : ''}`}
      style={{ backgroundColor: LAUNCH_BG }}
      aria-hidden="true"
    >
      <BrandMark className="app-launch-mark" size={88} />
    </div>
  )
}
