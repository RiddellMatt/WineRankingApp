import { useEffect, useState } from 'react'
import { shouldUseTestAdUnits } from '../lib/adConfig'
import { getBannerAdDebugState, subscribeBannerAdDebug } from '../lib/bannerAdDebug'
import { isNativeApp } from '../lib/platform'

type AdBannerProbeProps = {
  visible: boolean
  blockedReason?: string
}

/** Test builds only: shows whether the JS ad pipeline ran (native ad is separate). */
export function AdBannerProbe({ visible, blockedReason }: AdBannerProbeProps) {
  const [status, setStatus] = useState(getBannerAdDebugState)

  useEffect(() => {
    return subscribeBannerAdDebug(() => setStatus(getBannerAdDebugState()))
  }, [])

  if (!isNativeApp() || !shouldUseTestAdUnits() || !visible) return null

  const line = blockedReason ?? `${status.phase}${status.detail ? ` — ${status.detail}` : ''}`

  return (
    <div className="ad-banner-probe" role="status">
      {line}
    </div>
  )
}
