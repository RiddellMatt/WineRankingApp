import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { lockAppScroll } from '../lib/lockAppScroll'

interface Props {
  open: boolean
  message: string
}

/** Full-screen loading overlay while AI reads a label or menu photo. */
export function ScanPourOverlay({ open, message }: Props) {
  const uid = useId().replace(/:/g, '')

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
        <svg
          className="scan-pour-glass"
          viewBox="0 0 64 72"
          width={120}
          height={135}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id={`${uid}-glass`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f4d58d" />
              <stop offset="45%" stopColor="#e8b04b" />
              <stop offset="100%" stopColor="#b62c4a" />
            </linearGradient>
            <clipPath id={`${uid}-decanter`}>
              <path d="M30 4h4c0 10-1.5 16-4 19v22h-6a2.5 2.5 0 0 0 0 5h20a2.5 2.5 0 0 0 0-5h-6V23c-2.5-3-4-9-4-19z" />
            </clipPath>
          </defs>
          <path
            className="scan-pour-glass-body"
            fill={`url(#${uid}-glass)`}
            d="M30 4h4c0 10-1.5 16-4 19v22h-6a2.5 2.5 0 0 0 0 5h20a2.5 2.5 0 0 0 0-5h-6V23c-2.5-3-4-9-4-19z"
          />
          <path
            fill="#f3e6e9"
            opacity="0.22"
            d="M32 10c1.5 4 2 8 2 12v8h-4V22c0-4 .5-8 2-12z"
          />
          <g clipPath={`url(#${uid}-decanter)`}>
            <rect className="scan-pour-wine-fill" x="14" y="18" width="36" height="40" rx="2" />
          </g>
          <rect className="scan-pour-stream" x="30.5" y="0" width="3" height="26" rx="1.5" />
          <ellipse cx="32" cy="52" rx="14" ry="3.5" fill="#b62c4a" opacity="0.35" />
        </svg>
        <p className="scan-pour-message">{message}</p>
      </div>
    </div>,
    document.body,
  )
}
