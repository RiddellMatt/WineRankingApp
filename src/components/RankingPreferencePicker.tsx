import { useState } from 'react'
import { RANKING_PREFERENCE_OPTIONS } from '../lib/ranking'
import type { RankingPreference } from '../types'

interface Props {
  rankingPreference: RankingPreference
  onRankingPreferenceSaved: (preference: RankingPreference) => Promise<void>
  title?: string
  className?: string
}

export function RankingPreferencePicker({
  rankingPreference,
  onRankingPreferenceSaved,
  title = 'Ranking style',
  className = '',
}: Props) {
  const [busy, setBusy] = useState(false)

  async function choose(preference: RankingPreference) {
    if (preference === rankingPreference || busy) return
    setBusy(true)
    try {
      await onRankingPreferenceSaved(preference)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={`account-section ranking-preference-block ${className}`.trim()}>
      <h3>{title}</h3>
      <div className="ranking-preference-list account-ranking-list">
        {RANKING_PREFERENCE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`ranking-preference-card ${rankingPreference === option.value ? 'active' : ''}`}
            disabled={busy}
            onClick={() => void choose(option.value)}
          >
            <span className="ranking-preference-title">{option.title}</span>
            <span className="ranking-preference-desc">{option.description}</span>
          </button>
        ))}
      </div>
    </section>
  )
}