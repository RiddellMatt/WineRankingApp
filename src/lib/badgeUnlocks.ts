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

function snapshotFromInput(input: BadgeInput): BadgeTierSnapshot {
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

/** Seed snapshot on first run so existing badges do not toast on load. */
export function ensureBadgeTierSnapshot(input: BadgeInput): void {
  if (loadBadgeTierSnapshot()) return
  saveBadgeTierSnapshot(snapshotFromInput(input))
}

export function detectBadgeUnlocks(
  previous: BadgeTierSnapshot,
  input: BadgeInput,
): BadgeUnlock[] {
  const current = snapshotFromInput(input)
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

/** Compare against stored tiers, persist the new snapshot, return fresh unlocks. */
export function consumeBadgeUnlocks(input: BadgeInput): BadgeUnlock[] {
  const previous = loadBadgeTierSnapshot()
  if (!previous) {
    ensureBadgeTierSnapshot(input)
    return []
  }

  const unlocks = detectBadgeUnlocks(previous, input)
  saveBadgeTierSnapshot(snapshotFromInput(input))
  return unlocks
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
