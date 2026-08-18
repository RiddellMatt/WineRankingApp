import { RANKING_PREFERENCE_OPTIONS } from '../lib/ranking'
import type { RankingPreference } from '../types'

interface Props {
  onChoose: (preference: RankingPreference) => void
  busy?: boolean
}

export function RankingPreferenceModal({ onChoose, busy = false }: Props) {
  return (
    <div className="modal-backdrop ranking-onboarding-backdrop">
      <div className="modal ranking-onboarding" role="dialog" aria-labelledby="ranking-onboarding-title">
        <div className="modal-header">
          <h2 id="ranking-onboarding-title">Personalize your rankings</h2>
        </div>
        <p className="ranking-onboarding-lead">
          When comparing wines in your cellar, what matters more to you?
        </p>
        <div className="ranking-preference-list">
          {RANKING_PREFERENCE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="ranking-preference-card"
              disabled={busy}
              onClick={() => onChoose(option.value)}
            >
              <span className="ranking-preference-title">{option.title}</span>
              <span className="ranking-preference-desc">{option.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
