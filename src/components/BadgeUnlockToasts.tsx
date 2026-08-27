import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { BadgeTier } from '../lib/badges'
import { tierLabel } from '../lib/badges'
import type { BadgeUnlock } from '../lib/badgeUnlocks'
import { unlockDetail, unlockHeadline } from '../lib/badgeUnlocks'
import type { JourneyDefinition } from '../lib/journeys'

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

export interface JourneyToastItem {
  toastId: string
  id: string
  title: string
  icon: string
  description: string
}

export type MilestoneToastItem =
  | ({ kind: 'badge' } & BadgeToastItem)
  | ({ kind: 'journey' } & JourneyToastItem)

interface Props {
  items: MilestoneToastItem[]
  onDismiss: (toastId: string) => void
}

export function createBadgeToastItems(unlocks: BadgeUnlock[]): MilestoneToastItem[] {
  return unlocks.map((unlock) => ({
    kind: 'badge' as const,
    ...unlock,
    toastId: `badge-${unlock.id}-${unlock.tier}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  }))
}

export function createJourneyToastItems(journeys: JourneyDefinition[]): MilestoneToastItem[] {
  return journeys.map((journey) => ({
    kind: 'journey' as const,
    toastId: `journey-${journey.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    id: journey.id,
    title: journey.title,
    icon: journey.icon,
    description: `${journey.regionLabel} journey complete — nice work, explorer!`,
  }))
}

export function BadgeUnlockToasts({ items, onDismiss }: Props) {
  if (items.length === 0) return null

  return createPortal(
    <div className="badge-toast-stack" aria-live="polite" aria-atomic="false">
      {items.map((item) =>
        item.kind === 'badge' ? (
          <BadgeToast key={item.toastId} item={item} onDismiss={onDismiss} />
        ) : (
          <JourneyToast key={item.toastId} item={item} onDismiss={onDismiss} />
        ),
      )}
    </div>,
    document.body,
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

function JourneyToast({
  item,
  onDismiss,
}: {
  item: JourneyToastItem
  onDismiss: (toastId: string) => void
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(item.toastId), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [item.toastId, onDismiss])

  return (
    <button type="button" className="badge-toast journey-toast" onClick={() => onDismiss(item.toastId)}>
      <span className="badge-toast-medal badge-medal badge-tier-gold" aria-hidden="true">
        <span className="badge-medal-icon">{item.icon}</span>
        <span className="badge-medal-tier">Done</span>
      </span>
      <span className="badge-toast-copy">
        <span className="badge-toast-title">{item.title} complete!</span>
        <span className="badge-toast-desc">{item.description}</span>
      </span>
    </button>
  )
}
