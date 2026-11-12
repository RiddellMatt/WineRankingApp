import { useEffect } from 'react'
import { formatActivityTime } from '../lib/activityFeed'
import { lockAppScroll } from '../lib/lockAppScroll'
import { compositeScore } from '../lib/ranking'
import type { InsightsLeaderKind } from '../lib/insightsLeaders'
import type { RankingPreference, Wine } from '../types'

const TITLES: Record<InsightsLeaderKind, string> = {
  value: 'Best value',
  splurge: 'Biggest splurge',
}

interface Props {
  kind: InsightsLeaderKind
  wines: Wine[]
  rankingPreference: RankingPreference
  onClose: () => void
}

export function InsightsLeadersModal({ kind, wines, rankingPreference, onClose }: Props) {
  useEffect(() => lockAppScroll(), [])

  return (
    <div
      className="modal-backdrop insights-leaders-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal insights-leaders-modal" role="dialog" aria-labelledby="insights-leaders-title">
        <div className="modal-header insights-leaders-header">
          <h2 id="insights-leaders-title">Your top 3 · {TITLES[kind]}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="insights-leaders-body">
          {wines.length === 0 ? (
            <p className="passport-empty">Add priced wines to see leaders here.</p>
          ) : (
            <ol className="insights-leaders-list">
              {wines.map((wine, index) => {
                const title = [wine.name, wine.vintage].filter(Boolean).join(' ')
                const score = compositeScore(wine, rankingPreference)
                return (
                  <li key={wine.id} className="insights-leader-row">
                    <span className="insights-leader-rank">#{index + 1}</span>
                    <div className="insights-leader-copy">
                      <p className="insights-leader-name">{title}</p>
                      <p className="insights-leader-sub">
                        {wine.price != null && wine.price > 0 ? `$${wine.price.toFixed(0)}` : '—'}
                        {score > 0 ? ` · ${score.toFixed(1)}★` : ''}
                      </p>
                    </div>
                    <span className="insights-leader-when">{formatActivityTime(wine.addedAt)}</span>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
