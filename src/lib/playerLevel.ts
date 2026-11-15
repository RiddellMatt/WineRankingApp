import { BADGE_DEFINITIONS, type BadgeTier } from './badges'
import {
  type BadgeTierSnapshot,
  loadEarnedBadgeTiers,
  lockedBadgeSnapshot,
} from './badgeUnlocks'
import { isWishlist, triedWines } from './wishlist'
import type { Wine } from '../types'

const WINE_BASE_XP = 10
const WINE_REGION_XP = 4
const WINE_TAGS_XP = 5
const WINE_TASTE_XP = 3
const JOURNEY_COMPLETE_XP = 35

const BADGE_TIER_XP: Record<BadgeTier, number> = {
  locked: 0,
  bronze: 20,
  silver: 45,
  gold: 90,
  diamond: 150,
}

const MAX_LEVEL = 50

export interface PlayerLevelInput {
  wines: Wine[]
  friendCount: number
  completedJourneys: ReadonlySet<string>
}

export interface PlayerLevelState {
  level: number
  title: string
  totalXp: number
  xpIntoLevel: number
  xpForNextLevel: number
  progressPercent: number
}

/** XP from a single tried wine — counted once per bottle, not on repeated edits alone. */
export function xpForWine(wine: Wine): number {
  if (isWishlist(wine)) return 0
  let xp = WINE_BASE_XP
  if (wine.region?.trim()) xp += WINE_REGION_XP
  if ((wine.tastingTags?.length ?? 0) > 0) xp += WINE_TAGS_XP
  const taste = wine.taste
  if (
    taste &&
    (taste.body != null ||
      taste.tannin != null ||
      taste.sweetness != null ||
      taste.acidity != null ||
      taste.fizz != null)
  ) {
    xp += WINE_TASTE_XP
  }
  return xp
}

function badgeXpFromEarnedLedger(earned: BadgeTierSnapshot): number {
  let xp = 0
  for (const def of BADGE_DEFINITIONS) {
    const tier = earned[def.id] ?? 'locked'
    xp += BADGE_TIER_XP[tier]
  }
  return xp
}

function earnedBadgeTiers(override?: BadgeTierSnapshot | null): BadgeTierSnapshot {
  return override ?? loadEarnedBadgeTiers() ?? lockedBadgeSnapshot()
}

export function computeTotalXp(
  input: PlayerLevelInput,
  earnedOverride?: BadgeTierSnapshot | null,
): number {
  let total = 0
  for (const wine of triedWines(input.wines)) {
    total += xpForWine(wine)
  }
  total += input.completedJourneys.size * JOURNEY_COMPLETE_XP
  total += badgeXpFromEarnedLedger(earnedBadgeTiers(earnedOverride))
  return total
}

/** Cumulative XP required to *reach* the given level (level 1 = 0). */
export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0
  let cumulative = 0
  for (let i = 1; i < level; i++) {
    cumulative += 30 + i * 15
  }
  return cumulative
}

export function levelTitle(level: number): string {
  if (level >= 20) return 'Ambassador'
  if (level >= 12) return 'Voyager'
  if (level >= 6) return 'Enthusiast'
  if (level >= 3) return 'Taster'
  return 'Novice'
}

export function computePlayerLevel(
  input: PlayerLevelInput,
  earnedOverride?: BadgeTierSnapshot | null,
): PlayerLevelState {
  const totalXp = computeTotalXp(input, earnedOverride)
  let level = 1
  while (level < MAX_LEVEL && totalXp >= xpRequiredForLevel(level + 1)) {
    level += 1
  }

  const floor = xpRequiredForLevel(level)
  const ceiling =
    level >= MAX_LEVEL ? floor : xpRequiredForLevel(level + 1)
  const xpIntoLevel = totalXp - floor
  const xpForNextLevel = Math.max(ceiling - floor, 1)
  const progressPercent =
    level >= MAX_LEVEL ? 100 : Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100))

  return {
    level,
    title: levelTitle(level),
    totalXp,
    xpIntoLevel,
    xpForNextLevel,
    progressPercent,
  }
}
