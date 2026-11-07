import { formatActivityTime } from '../lib/activityFeed'
import { compositeScore } from '../lib/ranking'
import type { PassportStamp } from '../lib/passportAtlas'
import type { RankingPreference, Wine } from '../types'

interface Props {
  stamp: PassportStamp
  wines: Wine[]
  rankingPreference: RankingPreference
  onClose: () => void
}

export function StampWinesModal({ stamp, wines, rankingPreference, onClose }: Props) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal stamp-wines-modal" role="dialog" aria-labelledby="stamp-wines-title">
        <div className="modal-header">
          <div className="modal-header-titles">
            <h2 id="stamp-wines-title">
              <span className="stamp-wines-modal-icon" aria-hidden="true">
                {stamp.icon}
              </span>{' '}
              {stamp.label}
            </h2>
            <p className="modal-destination-hint">
              {stamp.kind === 'journey' ? stamp.detail : `${wines.length} wines`}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {wines.length === 0 ? (
          <p className="passport-empty">No wines in this stamp yet.</p>
        ) : (
          <ol className="stamp-wines-list">
            {wines.map((wine) => {
              const title = [wine.name, wine.vintage].filter(Boolean).join(' ')
              const score = compositeScore(wine, rankingPreference)
              return (
                <li key={wine.id} className="stamp-wine-row">
                  <div className="stamp-wine-copy">
                    <p className="stamp-wine-name">{title}</p>
                    {wine.winery?.trim() && <p className="stamp-wine-winery">{wine.winery.trim()}</p>}
                  </div>
                  <div className="stamp-wine-meta">
                    {score > 0 && <span className="stamp-wine-rating">{score.toFixed(1)}★</span>}
                    <span className="stamp-wine-when">{formatActivityTime(wine.addedAt)}</span>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
        <div className="modal-actions">
          <button type="button" className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
