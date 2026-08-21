import type { BadgeProgress, BadgeTier } from '../lib/badges'
import { tierLabel } from '../lib/badges'

interface Props {
  badges: BadgeProgress[]
}

const TIER_CLASS: Record<BadgeTier, string> = {
  locked: 'badge-tier-locked',
  bronze: 'badge-tier-bronze',
  silver: 'badge-tier-silver',
  gold: 'badge-tier-gold',
  diamond: 'badge-tier-diamond',
}

export function BadgeGrid({ badges }: Props) {
  return (
    <ul className="badge-grid">
      {badges.map((badge) => (
        <li className={`badge-card ${badge.tier === 'locked' ? 'locked' : 'earned'}`} key={badge.id}>
          <div className={`badge-medal ${TIER_CLASS[badge.tier]}`} aria-hidden="true">
            <span className="badge-medal-icon">{badge.icon}</span>
            {badge.tier !== 'locked' && (
              <span className="badge-medal-tier">{tierLabel(badge.tier)}</span>
            )}
          </div>
          <div className="badge-copy">
            <h4 className="badge-title">{badge.title}</h4>
            <p className="badge-desc">{badge.description}</p>
            <p className="badge-progress">{badge.progressLabel}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
