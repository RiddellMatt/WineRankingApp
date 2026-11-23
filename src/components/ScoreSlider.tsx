import { useRef, useState } from 'react'
import {
  SCORE_MAX,
  SCORE_STEP,
  formatScore,
  formatScoreOutOf,
  scoreColor,
  scoreFromTyped,
  scoreGradientCss,
  snapScore,
} from '../lib/scoreScale'

interface SliderProps {
  value: number
  onChange: (value: number) => void
  label: string
}

export function ScoreSlider({ value, onChange, label }: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const shown = snapScore(value)
  const rated = shown > 0
  const color = rated ? scoreColor(shown) : 'var(--text-faint)'
  const pct = `${(shown / SCORE_MAX) * 100}%`

  function setFromClientX(clientX: number) {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0) return
    const ratio = (clientX - rect.left) / rect.width
    onChange(snapScore(ratio * SCORE_MAX))
  }

  function nudge(delta: number) {
    onChange(snapScore(shown + delta))
  }

  function commit(raw: string) {
    onChange(scoreFromTyped(raw, shown))
    setDraft(null)
  }

  return (
    <div className="score-slider">
      <div
        ref={trackRef}
        className="score-track"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={SCORE_MAX}
        aria-valuenow={shown}
        aria-valuetext={rated ? `${formatScore(shown)} out of 10` : 'No rating'}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.currentTarget.setPointerCapture(e.pointerId)
          setFromClientX(e.clientX)
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
          setFromClientX(e.clientX)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault()
            nudge(SCORE_STEP)
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault()
            nudge(-SCORE_STEP)
          } else if (e.key === 'Home') {
            e.preventDefault()
            onChange(0)
          } else if (e.key === 'End') {
            e.preventDefault()
            onChange(SCORE_MAX)
          }
        }}
      >
        <span className="score-track-bar" aria-hidden="true">
          <span className="score-track-scale" style={{ background: scoreGradientCss() }} />
          <span className="score-track-rest" style={{ left: pct }} />
        </span>
        <span className="score-thumb" style={{ left: pct, background: color }} aria-hidden="true" />
      </div>
      {draft === null ? (
        <button
          type="button"
          className="score-slider-value"
          style={{ color }}
          aria-label={rated ? `${formatScore(shown)} out of 10. Tap to type a score` : 'No score yet. Tap to type a score'}
          onClick={() => setDraft(rated ? formatScore(shown) : '')}
        >
          {rated ? formatScoreOutOf(shown) : '—/10'}
        </button>
      ) : (
        <input
          className="score-slider-type"
          inputMode="decimal"
          autoFocus
          aria-label={`${label} as a number out of 10`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            }
          }}
        />
      )}
    </div>
  )
}

export function ScoreReadout({
  value,
  compact = false,
}: {
  value: number
  compact?: boolean
}) {
  const rated = value > 0
  const color = rated ? scoreColor(value) : undefined
  return (
    <span className={`score-readout${compact ? ' is-compact' : ''}`} title={rated ? formatScoreOutOf(value) : 'No rating'}>
      {!compact && rated && (
        <span className="score-readout-track" aria-hidden="true">
          <span
            className="score-readout-fill"
            style={{ width: `${(snapScore(value) / SCORE_MAX) * 100}%`, background: color }}
          />
        </span>
      )}
      <span className="score-readout-num" style={color ? { color } : undefined}>
        {rated ? formatScore(value) : '—'}
        {rated && !compact && <span className="score-readout-denom">/10</span>}
      </span>
    </span>
  )
}
