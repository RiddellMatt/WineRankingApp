import type { BadgeProgress } from '../lib/badges'
import { BadgeMedal } from './BadgeMedal'

interface Props {
  badges: BadgeProgress[]
}

export function BadgeGrid({ badges }: Props) {
  return (
    <ul className="badge-grid">
      {badges.map((badge) => (
        <li className={`badge-card ${badge.tier === 'locked' ? 'locked' : 'earned'}`} key={badge.id}>
          <BadgeMedal icon={badge.icon} tier={badge.tier} />
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
