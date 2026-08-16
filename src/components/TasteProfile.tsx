import { TASTE_AXES, type TasteProfile, type WineType } from '../types'

/** Read-only pill-on-track rows, shown on wine cards. */
export function TasteDisplay({ taste }: { taste: TasteProfile }) {
  const rows = TASTE_AXES.filter((a) => taste[a.key] != null)
  if (rows.length === 0) return null
  return (
    <div className="taste-display">
      {rows.map((a) => {
        const value = taste[a.key]!
        return (
          <div className="taste-track-row" key={a.key}>
            <span className={`taste-end ${value < 50 ? 'strong' : ''}`}>{a.left}</span>
            <div className="taste-track">
              <div className="taste-pill" style={{ left: `${value}%` }} />
            </div>
            <span className={`taste-end right ${value >= 50 ? 'strong' : ''}`}>{a.right}</span>
          </div>
        )
      })}
    </div>
  )
}

interface InputProps {
  taste: TasteProfile
  wineType: WineType
  onChange: (taste: TasteProfile) => void
}

/** Editable sliders for the wine form. Axes are optional; × clears one. */
export function TasteInput({ taste, wineType, onChange }: InputProps) {
  const axes = TASTE_AXES.filter((a) => !a.sparklingOnly || wineType === 'Sparkling')

  return (
    <div className="taste-input">
      {axes.map((a) => {
        const value = taste[a.key]
        const isSet = value != null
        return (
          <div className={`taste-slider-row ${isSet ? 'set' : ''}`} key={a.key}>
            <span className={`taste-end ${isSet && value < 50 ? 'strong' : ''}`}>{a.left}</span>
            <div className="taste-slider-track">
              <input
                type="range"
                min="0"
                max="100"
                value={value ?? 50}
                aria-label={`${a.left} to ${a.right}`}
                onChange={(e) => onChange({ ...taste, [a.key]: Number(e.target.value) })}
              />
              {!isSet && <span className="taste-unset-hint">drag to set</span>}
            </div>
            <span className={`taste-end right ${isSet && value >= 50 ? 'strong' : ''}`}>
              {a.right}
            </span>
            <button
              type="button"
              className={`icon-btn taste-clear ${isSet ? '' : 'hidden'}`}
              aria-label={`Clear ${a.left}/${a.right}`}
              title="Clear"
              onClick={() => {
                const next = { ...taste }
                delete next[a.key]
                onChange(next)
              }}
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
