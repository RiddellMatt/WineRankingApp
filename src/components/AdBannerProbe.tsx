import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import {
  adUnitModeLabel,
  adsDebugProbeEnabled,
  bannerAdUnitId,
  bundledAdMobTestModeEnv,
} from '../lib/adConfig'
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

  if (!isNativeApp() || !adsDebugProbeEnabled() || !visible) return null

  const unitTail = bannerAdUnitId()?.slice(-12) ?? 'no-unit'
  const prefix = `[${adUnitModeLabel()} env=${bundledAdMobTestModeEnv()} …${unitTail}]`
  const line =
    blockedReason ??
    `${prefix} ${status.phase}${status.detail ? ` — ${status.detail}` : ''}`

  return createPortal(
    <div className="ad-banner-probe" role="status">
      {line}
    </div>,
    document.body,
  )
}
