import { tierLabel, type BadgeTier } from '../lib/badges'

export const BADGE_TIER_CLASS: Record<BadgeTier, string> = {
  locked: 'badge-tier-locked',
  bronze: 'badge-tier-bronze',
  silver: 'badge-tier-silver',
  gold: 'badge-tier-gold',
  diamond: 'badge-tier-diamond',
}

interface Props {
  icon: string
  tier: BadgeTier
  size?: 'md' | 'sm'
  /** Override ribbon text (e.g. journey “Done”). */
  tierCaption?: string
}

export function BadgeMedal({ icon, tier, size = 'md', tierCaption }: Props) {
  const showRibbon = tier !== 'locked' || tierCaption != null
  const ribbon = tierCaption ?? (tier !== 'locked' ? tierLabel(tier) : null)

  return (
    <span
      className={`badge-medal ${BADGE_TIER_CLASS[tier]} ${size === 'sm' ? 'badge-medal-sm' : ''}`}
      aria-hidden="true"
    >
      <span className="badge-medal-icon">{icon}</span>
      {showRibbon && ribbon && <span className="badge-medal-tier">{ribbon}</span>}
    </span>
  )
}
