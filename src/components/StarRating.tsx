import { useId, useState } from 'react'

interface StarProps {
  fill: number // 0, 0.5, or 1
  size: number
}

function Star({ fill, size }: StarProps) {
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, '')
  const gradientId = `star-fill-${reactId}`
  const partial = fill > 0 && fill < 1
  const fillPaint = fill >= 1 ? 'var(--star)' : fill <= 0 ? 'var(--star-empty)' : `url(#${gradientId})`
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {partial && (
        <defs>
          <linearGradient id={gradientId}>
            <stop offset={`${fill * 100}%`} stopColor="var(--star)" />
            <stop offset={`${fill * 100}%`} stopColor="var(--star-empty)" />
          </linearGradient>
        </defs>
      )}
      <path
        fill={fillPaint}
        stroke="var(--star)"
        strokeWidth="1"
        d="M12 2.5l2.9 6.26 6.6.72-4.9 4.55 1.32 6.47L12 17.25 6.08 20.5 7.4 14.03 2.5 9.48l6.6-.72z"
      />
    </svg>
  )
}

interface DisplayProps {
  value: number
  size?: number
}

export function StarDisplay({ value, size = 18 }: DisplayProps) {
  return (
    <span className="star-row" title={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={Math.min(Math.max(value - i + 1, 0), 1)} />
      ))}
    </span>
  )
}

interface InputProps {
  value: number
  onChange: (value: number) => void
  size?: number
  label?: string
}

export function StarInput({ value, onChange, size = 30, label = 'Rating' }: InputProps) {
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? value

  function nudge(delta: number) {
    const next = Math.min(5, Math.max(0, Math.round((value + delta) * 2) / 2))
    onChange(next)
  }

  return (
    <div
      className="star-input"
      tabIndex={0}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={5}
      aria-valuenow={value}
      aria-valuetext={value > 0 ? `${value} out of 5` : 'No rating'}
      onMouseLeave={() => setHover(null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault()
          nudge(0.5)
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault()
          nudge(-0.5)
        }
      }}
    >
      <span className="star-row">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="star-cell" style={{ width: size, height: size }}>
            <Star size={size} fill={Math.min(Math.max(shown - i + 1, 0), 1)} />
            <button
              type="button"
              tabIndex={-1}
              className="star-half left"
              aria-label={`Rate ${i - 0.5} stars`}
              onMouseEnter={() => setHover(i - 0.5)}
              onFocus={() => setHover(i - 0.5)}
              onClick={() => onChange(i - 0.5)}
            />
            <button
              type="button"
              tabIndex={-1}
              className="star-half right"
              aria-label={`Rate ${i} stars`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onClick={() => onChange(i)}
            />
          </span>
        ))}
      </span>
      <span className="star-input-value">{shown > 0 ? shown.toFixed(1) : '—'}</span>
    </div>
  )
}
