import { useState } from 'react'

interface StarProps {
  fill: number // 0, 0.5, or 1
  size: number
}

function Star({ fill, size }: StarProps) {
  const id = `grad-${fill}`
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={id}>
          <stop offset={`${fill * 100}%`} stopColor="var(--star)" />
          <stop offset={`${fill * 100}%`} stopColor="var(--star-empty)" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
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
}

export function StarInput({ value, onChange, size = 30 }: InputProps) {
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? value

  return (
    <div className="star-input" onMouseLeave={() => setHover(null)}>
      <span className="star-row">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="star-cell" style={{ width: size, height: size }}>
            <Star size={size} fill={Math.min(Math.max(shown - i + 1, 0), 1)} />
            <button
              type="button"
              className="star-half left"
              aria-label={`Rate ${i - 0.5} stars`}
              onMouseEnter={() => setHover(i - 0.5)}
              onFocus={() => setHover(i - 0.5)}
              onClick={() => onChange(i - 0.5)}
            />
            <button
              type="button"
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
