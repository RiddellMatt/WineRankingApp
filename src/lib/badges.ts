import { completedJourneyCount } from './journeys'
import { countDrinkLocations, countOriginCountries } from './wineGeo'
import { triedWines, wishlistWines } from './wishlist'
import type { Wine } from '../types'
import { APP_NAME } from '../brand'

export type BadgeTier = 'locked' | 'bronze' | 'silver' | 'gold' | 'diamond'

export interface BadgeDefinition {
  id: string
  title: string
  description: string
  icon: string
  /** Thresholds for bronze → diamond. Index 0 = bronze, etc. */
  thresholds: [number, number, number, number]
}

export interface BadgeProgress {
  id: string
  title: string
  description: string
  icon: string
  tier: BadgeTier
  current: number
  nextThreshold: number | null
  progressLabel: string
}

export interface BadgeInput {
  wines: Wine[]
  friendCount: number
  /** Permanent journey completions for Pathfinder badge */
  completedJourneys?: ReadonlySet<string>
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'first_pour',
    title: 'First Pour',
    description: 'Log wines to your cellar',
    icon: '🍷',
    thresholds: [1, 5, 25, 100],
  },
  {
    id: 'explorer',
    title: 'Globetrotter',
    description: 'Try wines from different countries',
    icon: '🌍',
    thresholds: [3, 5, 10, 20],
  },
  {
    id: 'curator',
    title: 'Curator',
    description: 'Build your want-to-try list',
    icon: '📋',
    thresholds: [1, 5, 10, 25],
  },
  {
    id: 'traveler',
    title: 'Traveler',
    description: 'Log where you drank it — cities & trips count',
    icon: '✈️',
    thresholds: [2, 5, 10, 20],
  },
  {
    id: 'social',
    title: 'Social',
    description: `Connect with friends on ${APP_NAME}`,
    icon: '👥',
    thresholds: [1, 3, 5, 10],
  },
  {
    id: 'pathfinder',
    title: 'Pathfinder',
    description: 'Complete passport journeys',
    icon: '🧭',
    thresholds: [1, 3, 5, 10],
  },
]

const TIER_ORDER: BadgeTier[] = ['locked', 'bronze', 'silver', 'gold', 'diamond']

function tierForValue(value: number, thresholds: [number, number, number, number]): BadgeTier {
  if (value >= thresholds[3]) return 'diamond'
  if (value >= thresholds[2]) return 'gold'
  if (value >= thresholds[1]) return 'silver'
  if (value >= thresholds[0]) return 'bronze'
  return 'locked'
}

function nextThreshold(
  value: number,
  thresholds: [number, number, number, number],
): number | null {
  for (const t of thresholds) {
    if (value < t) return t
  }
  return null
}

function badgeValue(id: string, input: BadgeInput): number {
  const tried = triedWines(input.wines)
  switch (id) {
    case 'first_pour':
      return tried.length
    case 'explorer':
      return countOriginCountries(tried).length
    case 'curator':
      return wishlistWines(input.wines).length
    case 'traveler':
      return countDrinkLocations(tried).length
    case 'social':
      return input.friendCount
    case 'pathfinder':
      return completedJourneyCount(input.completedJourneys ?? new Set())
    default:
      return 0
  }
}

export function computeBadgeProgress(input: BadgeInput): BadgeProgress[] {
  return BADGE_DEFINITIONS.map((def) => {
    const current = badgeValue(def.id, input)
    const tier = tierForValue(current, def.thresholds)
    const next = nextThreshold(current, def.thresholds)
    const progressLabel =
      tier === 'diamond'
        ? 'Max tier'
        : next != null
          ? `${current} / ${next}`
          : `${current}`

    return {
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      tier,
      current,
      nextThreshold: next,
      progressLabel,
    }
  })
}

export function tierLabel(tier: BadgeTier): string {
  if (tier === 'locked') return 'Locked'
  return tier.charAt(0).toUpperCase() + tier.slice(1)
}

export function compareTiers(a: BadgeTier, b: BadgeTier): number {
  return TIER_ORDER.indexOf(a) - TIER_ORDER.indexOf(b)
}

export function maxTier(a: BadgeTier, b: BadgeTier): BadgeTier {
  return compareTiers(a, b) >= 0 ? a : b
}

/** Next count needed to reach the tier above `tier`. */
export function nextThresholdAfterTier(
  tier: BadgeTier,
  thresholds: [number, number, number, number],
): number | null {
  switch (tier) {
    case 'locked':
      return thresholds[0]
    case 'bronze':
      return thresholds[1]
    case 'silver':
      return thresholds[2]
    case 'gold':
      return thresholds[3]
    case 'diamond':
      return null
  }
}
