import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { DECANTI_GLASS_SRC } from '../lib/brandAssets'
import { lockAppScroll } from '../lib/lockAppScroll'

interface Props {
  open: boolean
  message: string
}

/** Full-screen loading overlay while AI reads a label or menu photo. */
export function ScanPourOverlay({ open, message }: Props) {
  useEffect(() => {
    if (!open) return
    return lockAppScroll()
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className="scan-pour-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
    >
      <div className="scan-pour-overlay-card">
        <div className="scan-pour-glass-stage" aria-hidden="true">
          <img
            className="scan-pour-glass-img"
            src={DECANTI_GLASS_SRC}
            width={140}
            height={140}
            alt=""
            decoding="async"
          />
          <span className="scan-pour-splash scan-pour-splash-a" />
          <span className="scan-pour-splash scan-pour-splash-b" />
          <span className="scan-pour-splash scan-pour-splash-c" />
        </div>
        <p className="scan-pour-message">{message}</p>
      </div>
    </div>,
    document.body,
  )
}
