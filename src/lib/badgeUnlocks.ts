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
/** After testing reset, the next cellar change may re-toast tiers already live in the cellar. */
const CATCHUP_KEY = `${STORAGE_PREFIX}.badge-catchup-testing.v1`

export type BadgeTierSnapshot = Record<string, BadgeTier>

export interface BadgeUnlock {
  id: string
  title: string
  description: string
  icon: string
  tier: BadgeTier
  previousTier: BadgeTier
}

export function lockedBadgeSnapshot(): BadgeTierSnapshot {
  return Object.fromEntries(BADGE_DEFINITIONS.map((def) => [def.id, 'locked' as BadgeTier]))
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

export function markCatchUpTestingUnlocks(): void {
  try {
    localStorage.setItem(CATCHUP_KEY, '1')
  } catch {
    // ignore
  }
}

export function consumeCatchUpTestingFlag(): boolean {
  try {
    if (localStorage.getItem(CATCHUP_KEY) !== '1') return false
    localStorage.removeItem(CATCHUP_KEY)
    return true
  } catch {
    return false
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

/**
 * Detect unlocks for a cellar change.
 * Normal: action must cross a tier AND tier must beat the earned ledger (no re-toast after delete).
 * Catch-up (testing reset): any live tier above earned counts once, even without an action tier jump.
 */
export function detectBadgeUnlocksForAction(
  earned: BadgeTierSnapshot,
  previous: BadgeTierSnapshot,
  next: BadgeTierSnapshot,
  options?: { catchUpAfterReset?: boolean },
): BadgeUnlock[] {
  const unlocks: BadgeUnlock[] = []
  const catchUp = options?.catchUpAfterReset ?? false

  for (const def of BADGE_DEFINITIONS) {
    const earnedTier = earned[def.id] ?? 'locked'
    const previousTier = previous[def.id] ?? 'locked'
    const newTier = next[def.id] ?? 'locked'

    if (compareTiers(newTier, earnedTier) <= 0) continue
    if (!catchUp && compareTiers(newTier, previousTier) <= 0) continue

    unlocks.push({
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      tier: newTier,
      previousTier: earnedTier,
    })
  }

  return unlocks.sort(
    (a, b) => compareTiers(a.tier, b.tier) - compareTiers(b.tier, a.tier),
  )
}

/**
 * Account UI: show the best of earned (permanent) and live cellar progress.
 * Pass `earned` when available to avoid stale localStorage reads during the same session.
 */
export function computeDisplayedBadgeProgress(
  input: BadgeInput,
  earnedOverride?: BadgeTierSnapshot | null,
): BadgeProgress[] {
  const live = computeBadgeProgress(input)
  const earned = earnedOverride ?? loadEarnedBadgeTiers() ?? {}

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
 * Load earned tiers on startup.
 * When `seedIfMissing` is false (pending save queued), keep locked rather than seeding from live wines.
 */
export function hydrateEarnedBadgeTiers(
  input: BadgeInput,
  options?: { seedIfMissing?: boolean },
): BadgeTierSnapshot {
  const stored = loadEarnedBadgeTiers()
  if (stored) return stored

  if (options?.seedIfMissing === false) {
    return lockedBadgeSnapshot()
  }

  const current = snapshotFromBadgeInput(input)
  saveEarnedBadgeTiers(current)
  return current
}

export function evaluateBadgeProgressChange(
  earned: BadgeTierSnapshot,
  previous: BadgeInput,
  next: BadgeInput,
  options?: { catchUpAfterReset?: boolean },
): { unlocks: BadgeUnlock[]; earned: BadgeTierSnapshot } {
  const previousSnapshot = snapshotFromBadgeInput(previous)
  const nextSnapshot = snapshotFromBadgeInput(next)
  const unlocks = detectBadgeUnlocksForAction(
    earned,
    previousSnapshot,
    nextSnapshot,
    options,
  )
  const nextEarned = maxTierSnapshot(earned, nextSnapshot)
  return { unlocks, earned: nextEarned }
}

/** @deprecated Use hydrateEarnedBadgeTiers */
export function syncBadgeTrackingSilently(
  input: BadgeInput,
  options?: { seedIfMissing?: boolean },
): BadgeTierSnapshot {
  return hydrateEarnedBadgeTiers(input, options)
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

export function isBadgeTestingEnabled(): boolean {
  if (import.meta.env.DEV) return true
  if (typeof window === 'undefined') return false
  return window.location.hostname.endsWith('github.io')
}

/** Clear earned tiers and allow the next cellar change to re-toast live tiers (testing). */
export function resetEarnedBadgeProgressForTesting(): void {
  saveEarnedBadgeTiers(lockedBadgeSnapshot())
  markCatchUpTestingUnlocks()
}
