import type { ReactNode } from 'react'
import { RANKING_PREFERENCE_OPTIONS } from '../lib/ranking'
import type { RankingPreference } from '../types'

interface Props {
  value: RankingPreference
  onChange: (preference: RankingPreference) => void
  disabled?: boolean
  title?: string
  className?: string
  children?: ReactNode
}

export function RankingPreferencePicker({
  value,
  onChange,
  disabled = false,
  title = 'Ranking style',
  className = '',
  children,
}: Props) {
  return (
    <section className={`account-section ranking-preference-block ${className}`.trim()}>
      <h3>{title}</h3>
      <div className="ranking-preference-list account-ranking-list">
        {RANKING_PREFERENCE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`ranking-preference-card ${value === option.value ? 'active' : ''}`}
            disabled={disabled}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            <span className="ranking-preference-title">{option.title}</span>
            <span className="ranking-preference-desc">{option.description}</span>
          </button>
        ))}
      </div>
      {children}
    </section>
  )
}
