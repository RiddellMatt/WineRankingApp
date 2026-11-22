import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { lockAppScroll } from '../lib/lockAppScroll'
import { WINE_FACTS } from '../lib/wineFacts'
import { ScanPourGlass } from './ScanPourGlass'

export type ScanPourVariant = 'menu' | 'label'

const MENU_LINES = ['Scanning the list…', 'Comparing your cellar…', 'Picking standouts…'] as const

const MENU_STAGE_MS = 2400
const WINE_FACT_MS = 8_000
const RING_R = 54
const RING_C = 2 * Math.PI * RING_R

interface Props {
  open: boolean
  variant: ScanPourVariant
  /** Blurred photo behind the scrim (object URL). */
  previewUrl?: string | null
  /** 0–100 when the caller reports upload progress; omit for indeterminate. */
  progress?: number
}

/** Full-screen loading overlay while AI reads a label or menu photo. */
export function ScanPourOverlay({ open, variant, previewUrl, progress }: Props) {
  const [stageIndex, setStageIndex] = useState(0)
  const lines = variant === 'label' ? WINE_FACTS : MENU_LINES
  const intervalMs = variant === 'label' ? WINE_FACT_MS : MENU_STAGE_MS
  const message = lines[stageIndex % lines.length] ?? lines[0]

  useEffect(() => {
    if (!open) return
    return lockAppScroll()
  }, [open])

  useEffect(() => {
    if (!open) {
      setStageIndex(0)
      return
    }
    const start = variant === 'label' ? Math.floor(Math.random() * lines.length) : 0
    setStageIndex(start)
    const id = window.setInterval(() => {
      setStageIndex((i) => (i + 1) % lines.length)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [open, variant, lines.length, intervalMs])

  if (!open) return null

  const hasProgress = typeof progress === 'number' && Number.isFinite(progress)
  const ringOffset = hasProgress
    ? RING_C * (1 - Math.min(100, Math.max(0, progress)) / 100)
    : undefined

  return createPortal(
    <div
      className="scan-pour-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
    >
      {previewUrl ? (
        <div
          className="scan-pour-preview"
          style={{ backgroundImage: `url(${previewUrl})` }}
          aria-hidden="true"
        >
          <div className="scan-pour-sweep-beam" />
        </div>
      ) : null}

      <div className="scan-pour-overlay-scrim" aria-hidden="true" />

      <div className="scan-pour-overlay-card">
        <div className="scan-pour-ring-wrap" aria-hidden="true">
          <svg className="scan-pour-ring" viewBox="0 0 120 120" width={120} height={120}>
            <circle className="scan-pour-ring-track" cx={60} cy={60} r={RING_R} />
            <circle
              className={
                hasProgress ? 'scan-pour-ring-progress' : 'scan-pour-ring-progress scan-pour-ring-indeterminate'
              }
              cx={60}
              cy={60}
              r={RING_R}
              strokeDasharray={RING_C}
              strokeDashoffset={ringOffset}
            />
          </svg>
          <div className="scan-pour-glass-tilt">
            <ScanPourGlass />
          </div>
        </div>
        <p className="scan-pour-message" key={stageIndex}>
          {message}
        </p>
      </div>
    </div>,
    document.body,
  )
}