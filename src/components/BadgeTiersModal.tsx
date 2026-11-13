import { useEffect } from 'react'
import { STANDARD_BADGE_THRESHOLDS, tierLabel, type BadgeTier } from '../lib/badges'
import { lockAppScroll } from '../lib/lockAppScroll'

const TIERS: BadgeTier[] = ['bronze', 'silver', 'gold', 'diamond']

interface Props {
  onClose: () => void
}

export function BadgeTiersModal({ onClose }: Props) {
  useEffect(() => lockAppScroll(), [])

  return (
    <div
      className="modal-backdrop badge-tiers-backdrop"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal badge-tiers-modal" role="dialog" aria-labelledby="badge-tiers-title">
        <div className="modal-header">
          <h2 id="badge-tiers-title">Badge tiers</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="badge-tiers-body">
          <p>Four tiers per badge — log progress to level up.</p>
          <ul className="badge-tiers-legend">
            {TIERS.map((tier) => (
              <li key={tier} className={`badge-tiers-row badge-tier-${tier}`}>
                <span className="badge-tiers-name">{tierLabel(tier)}</span>
              </li>
            ))}
          </ul>
          <p className="badge-tiers-note">
            Goals: {STANDARD_BADGE_THRESHOLDS[0]} / {STANDARD_BADGE_THRESHOLDS[1]} /{' '}
            {STANDARD_BADGE_THRESHOLDS[2]} / {STANDARD_BADGE_THRESHOLDS[3]} (bronze → diamond)
          </p>
        </div>
      </div>
    </div>
  )
}
