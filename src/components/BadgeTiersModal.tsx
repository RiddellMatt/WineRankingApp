import { useEffect } from 'react'
import { BADGE_DEFINITIONS, tierLabel, type BadgeTier } from '../lib/badges'
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
          <p>
            Each badge has four earnable tiers. Log progress toward the goal to unlock the next
            metallic tier.
          </p>
          <ul className="badge-tiers-legend">
            {TIERS.map((tier) => (
              <li key={tier} className={`badge-tiers-row badge-tier-${tier}`}>
                <span className="badge-tiers-name">{tierLabel(tier)}</span>
              </li>
            ))}
          </ul>
          <p className="badge-tiers-note">Example goals (per badge):</p>
          <ul className="badge-tiers-examples">
            {BADGE_DEFINITIONS.slice(0, 3).map((def) => (
              <li key={def.id}>
                <strong>{def.title}</strong> — bronze {def.thresholds[0]}, silver{' '}
                {def.thresholds[1]}, gold {def.thresholds[2]}, diamond {def.thresholds[3]}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
