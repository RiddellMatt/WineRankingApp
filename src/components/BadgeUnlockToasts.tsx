import { useEffect } from 'react'
import type { BadgeTier } from '../lib/badges'
import { tierLabel } from '../lib/badges'
import type { BadgeUnlock } from '../lib/badgeUnlocks'
import { unlockDetail, unlockHeadline } from '../lib/badgeUnlocks'

const TOAST_MS = 4500

const TIER_CLASS: Record<BadgeTier, string> = {
  locked: 'badge-tier-locked',
  bronze: 'badge-tier-bronze',
  silver: 'badge-tier-silver',
  gold: 'badge-tier-gold',
  diamond: 'badge-tier-diamond',
}

export interface BadgeToastItem extends BadgeUnlock {
  toastId: string
}

interface Props {
  items: BadgeToastItem[]
  onDismiss: (toastId: string) => void
}

export function createBadgeToastItems(unlocks: BadgeUnlock[]): BadgeToastItem[] {
  return unlocks.map((unlock) => ({
    ...unlock,
    toastId: `${unlock.id}-${unlock.tier}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  }))
}

export function BadgeUnlockToasts({ items, onDismiss }: Props) {
  if (items.length === 0) return null

  return (
    <div className="badge-toast-stack" aria-live="polite" aria-atomic="false">
      {items.map((item) => (
        <BadgeToast key={item.toastId} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function BadgeToast({
  item,
  onDismiss,
}: {
  item: BadgeToastItem
  onDismiss: (toastId: string) => void
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(item.toastId), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [item.toastId, onDismiss])

  return (
    <button type="button" className="badge-toast" onClick={() => onDismiss(item.toastId)}>
      <span
        className={`badge-toast-medal badge-medal ${TIER_CLASS[item.tier]}`}
        aria-hidden="true"
      >
        <span className="badge-medal-icon">{item.icon}</span>
        <span className="badge-medal-tier">{tierLabel(item.tier)}</span>
      </span>
      <span className="badge-toast-copy">
        <span className="badge-toast-title">{unlockHeadline(item)}</span>
        <span className="badge-toast-desc">{unlockDetail(item)}</span>
      </span>
    </button>
  )
}
