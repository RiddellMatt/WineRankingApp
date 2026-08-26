import {
  BADGE_DEFINITIONS,
  compareTiers,
  computeBadgeProgress,
  maxTier,
  nextThresholdAfterTier,
  tierLabel,
  type BadgeInput,
  type BadgeProgress,
  type BadgeTier,
} from './badges'
import { STORAGE_PREFIX } from '../brand'

/** Permanent earned tiers — never downgraded when wines are removed. */
const EARNED_KEY = `${STORAGE_PREFIX}.badge-tiers.v1`

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

export function loadEarnedBadgeTiers(): BadgeTierSnapshot | null {
  try {
    const raw = localStorage.getItem(EARNED_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BadgeTierSnapshot
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function saveEarnedBadgeTiers(snapshot: BadgeTierSnapshot): void {
  try {
    localStorage.setItem(EARNED_KEY, JSON.stringify(snapshot))
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
    merged[def.id] = maxTier(a[def.id] ?? 'locked', b[def.id] ?? 'locked')
  }
  return merged
}

/** Unlock when live progress exceeds the permanent earned ledger. */
export function detectEarnedUnlocks(
  earned: BadgeTierSnapshot,
  next: BadgeTierSnapshot,
): BadgeUnlock[] {
  const unlocks: BadgeUnlock[] = []

  for (const def of BADGE_DEFINITIONS) {
    const previousTier = earned[def.id] ?? 'locked'
    const newTier = next[def.id] ?? 'locked'
    if (compareTiers(newTier, previousTier) <= 0) continue

    unlocks.push({
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      tier: newTier,
      previousTier,
    })
  }

  return unlocks.sort(
    (a, b) => compareTiers(a.tier, b.tier) - compareTiers(b.tier, a.tier),
  )
}

/**
 * Account UI: show the best of earned (permanent) and live cellar progress.
 * Progress counts stay live; tier medals reflect once-earned unlocks.
 */
export function computeDisplayedBadgeProgress(input: BadgeInput): BadgeProgress[] {
  const live = computeBadgeProgress(input)
  const earned = loadEarnedBadgeTiers() ?? {}

  return live.map((badge) => {
    const earnedTier = earned[badge.id] ?? 'locked'
    const displayTier = maxTier(earnedTier, badge.tier)
    const def = BADGE_DEFINITIONS.find((d) => d.id === badge.id)
    const next =
      displayTier === 'diamond' || !def
        ? null
        : nextThresholdAfterTier(displayTier, def.thresholds)
    const progressLabel =
      displayTier === 'diamond'
        ? 'Max tier'
        : next != null
          ? `${badge.current} / ${next}`
          : `${badge.current}`

    return {
      ...badge,
      tier: displayTier,
      nextThreshold: next,
      progressLabel,
    }
  })
}

/**
 * One-time sync after cellar + friends are loaded.
 * Never emits toasts — seeds ledger for existing cellars, otherwise preserves earned tiers.
 */
export function hydrateBadgeTracking(input: BadgeInput): BadgeTierSnapshot {
  const current = snapshotFromBadgeInput(input)
  const stored = loadEarnedBadgeTiers()
  if (!stored) {
    saveEarnedBadgeTiers(current)
    return current
  }
  return stored
}

/** Persist new earned tiers and return unlocks for toasts. */
export function commitBadgeProgressChange(
  _previous: BadgeInput,
  next: BadgeInput,
): BadgeUnlock[] {
  const earned = loadEarnedBadgeTiers() ?? {}
  const nextSnapshot = snapshotFromBadgeInput(next)
  const unlocks = detectEarnedUnlocks(earned, nextSnapshot)
  saveEarnedBadgeTiers(maxTierSnapshot(earned, nextSnapshot))
  return unlocks
}

/** Sync earned ledger on load without emitting unlocks. */
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

export function isBadgeTestingEnabled(): boolean {
  if (import.meta.env.DEV) return true
  if (typeof window === 'undefined') return false
  return window.location.hostname.endsWith('github.io')
}

/** Clear earned tiers so unlock toasts can be exercised again on this deployment. */
export function resetEarnedBadgeProgressForTesting(): void {
  const locked: BadgeTierSnapshot = Object.fromEntries(
    BADGE_DEFINITIONS.map((def) => [def.id, 'locked' as BadgeTier]),
  )
  saveEarnedBadgeTiers(locked)
}
