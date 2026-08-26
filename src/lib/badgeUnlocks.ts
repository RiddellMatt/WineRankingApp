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
 * Never emits toasts — merges persisted tiers forward and seeds session baseline.
 */
export function hydrateBadgeTracking(input: BadgeInput): BadgeTierSnapshot {
  const current = snapshotFromBadgeInput(input)
  const stored = loadBadgeTierSnapshot()
  if (!stored) {
    saveBadgeTierSnapshot(current)
    return current
  }
  const merged = maxTierSnapshot(stored, current)
  saveBadgeTierSnapshot(merged)
  return current
}

/** Diff against session baseline, advance baseline, persist max tiers. */
export function advanceBadgeTracking(
  baseline: BadgeTierSnapshot,
  input: BadgeInput,
): { unlocks: BadgeUnlock[]; baseline: BadgeTierSnapshot } {
  const current = snapshotFromBadgeInput(input)
  const unlocks = detectBadgeUnlocks(baseline, input)
  const stored = loadBadgeTierSnapshot()
  const persisted = stored ? maxTierSnapshot(stored, current) : current
  saveBadgeTierSnapshot(persisted)
  return { unlocks, baseline: current }
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
