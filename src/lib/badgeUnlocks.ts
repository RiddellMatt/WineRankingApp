import {
  BADGE_DEFINITIONS,
  compareTiers,
  computeBadgeProgress,
  tierLabel,
  type BadgeInput,
  type BadgeTier,
} from './badges'
import { STORAGE_PREFIX } from '../brand'

const SNAPSHOT_KEY = `${STORAGE_PREFIX}.badge-tiers.v1`

export type BadgeTierSnapshot = Record<string, BadgeTier>

export interface BadgeUnlock {
  id: string
  title: string
  description: string
  icon: string
  tier: BadgeTier
  previousTier: BadgeTier
}

export function snapshotFromBadgeInput(input: BadgeInput): BadgeTierSnapshot {
  return Object.fromEntries(
    computeBadgeProgress(input).map((badge) => [badge.id, badge.tier]),
  )
}

export function loadBadgeTierSnapshot(): BadgeTierSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BadgeTierSnapshot
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function saveBadgeTierSnapshot(snapshot: BadgeTierSnapshot): void {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
  } catch {
    // ignore quota / private mode
  }
}

/** Keep the highest tier recorded for each badge. */
export function maxTierSnapshot(
  a: BadgeTierSnapshot,
  b: BadgeTierSnapshot,
): BadgeTierSnapshot {
  const merged: BadgeTierSnapshot = { ...a }
  for (const def of BADGE_DEFINITIONS) {
    const left = a[def.id] ?? 'locked'
    const right = b[def.id] ?? 'locked'
    merged[def.id] = compareTiers(left, right) >= 0 ? left : right
  }
  return merged
}

export function detectBadgeUnlocks(
  previous: BadgeTierSnapshot,
  input: BadgeInput,
): BadgeUnlock[] {
  const current = snapshotFromBadgeInput(input)
  const unlocks: BadgeUnlock[] = []

  for (const def of BADGE_DEFINITIONS) {
    const oldTier = previous[def.id] ?? 'locked'
    const newTier = current[def.id] ?? 'locked'
    if (compareTiers(newTier, oldTier) <= 0) continue

    unlocks.push({
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      tier: newTier,
      previousTier: oldTier,
    })
  }

  return unlocks.sort(
    (a, b) => compareTiers(a.tier, b.tier) - compareTiers(b.tier, a.tier),
  )
}

/**
 * One-time sync after cellar + friends are loaded.
 * Never emits toasts — persists the current tier snapshot only.
 */
export function hydrateBadgeTracking(input: BadgeInput): BadgeTierSnapshot {
  const current = snapshotFromBadgeInput(input)
  saveBadgeTierSnapshot(current)
  return current
}

/** Diff two progress snapshots, persist current tiers, return unlocks for toasts. */
export function commitBadgeProgressChange(
  previous: BadgeInput,
  next: BadgeInput,
): BadgeUnlock[] {
  const previousSnapshot = snapshotFromBadgeInput(previous)
  const nextSnapshot = snapshotFromBadgeInput(next)
  const unlocks = detectBadgeUnlocks(previousSnapshot, next)
  saveBadgeTierSnapshot(nextSnapshot)
  return unlocks
}

/** Sync persisted tiers on load without emitting unlocks. */
export function syncBadgeTrackingSilently(input: BadgeInput): BadgeTierSnapshot {
  return hydrateBadgeTracking(input)
}

export function unlockHeadline(unlock: BadgeUnlock): string {
  if (unlock.previousTier === 'locked') {
    return `${unlock.title} unlocked`
  }
  return `${unlock.title} — ${tierLabel(unlock.tier)}`
}

export function unlockDetail(unlock: BadgeUnlock): string {
  if (unlock.previousTier === 'locked') {
    return `${tierLabel(unlock.tier)} badge earned`
  }
  return `Upgraded to ${tierLabel(unlock.tier)}`
}

export function isLockedBadgeBaseline(snapshot: BadgeTierSnapshot): boolean {
  return BADGE_DEFINITIONS.every((def) => (snapshot[def.id] ?? 'locked') === 'locked')
}
