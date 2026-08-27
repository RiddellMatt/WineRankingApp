import {
  BADGE_DEFINITIONS,
  compareTiers,
  tierLabel,
  type BadgeTier,
} from './badges'
import { fetchEarnedBadgeTiersForUsers } from './badgeDb'
import { lockedBadgeSnapshot, type BadgeTierSnapshot } from './badgeUnlocks'
import { fetchCompletedJourneysForUsers } from './journeyDb'
import { JOURNEY_DEFINITIONS } from './journeys'

export interface BadgeHighlight {
  id: string
  title: string
  icon: string
  tier: BadgeTier
}

export interface FriendMilestoneSummary {
  userId: string
  journeyCount: number
  earnedBadgeCount: number
  badgeHighlights: BadgeHighlight[]
  summaryLine: string
}

function summarizeBadges(snapshot: BadgeTierSnapshot): {
  earnedBadgeCount: number
  badgeHighlights: BadgeHighlight[]
} {
  const earned = BADGE_DEFINITIONS.flatMap((def) => {
    const tier = snapshot[def.id] ?? 'locked'
    if (tier === 'locked') return []
    return [{ id: def.id, title: def.title, icon: def.icon, tier }]
  }).sort((a, b) => compareTiers(b.tier, a.tier))

  return {
    earnedBadgeCount: earned.length,
    badgeHighlights: earned.slice(0, 3),
  }
}

export function buildFriendMilestoneSummary(
  userId: string,
  badges: BadgeTierSnapshot,
  journeys: Set<string>,
): FriendMilestoneSummary {
  const { earnedBadgeCount, badgeHighlights } = summarizeBadges(badges)
  const journeyCount = JOURNEY_DEFINITIONS.filter((def) => journeys.has(def.id)).length

  const parts: string[] = []
  if (journeyCount > 0) {
    parts.push(`${journeyCount} journey${journeyCount === 1 ? '' : 's'}`)
  }
  for (const badge of badgeHighlights.slice(0, 2)) {
    parts.push(`${badge.title} ${tierLabel(badge.tier)}`)
  }
  if (parts.length === 0 && earnedBadgeCount === 0) {
    parts.push('No milestones yet')
  }

  return {
    userId,
    journeyCount,
    earnedBadgeCount,
    badgeHighlights,
    summaryLine: parts.join(' · '),
  }
}

export async function fetchFriendMilestoneSummaries(
  friendIds: string[],
): Promise<Map<string, FriendMilestoneSummary>> {
  if (friendIds.length === 0) return new Map()

  const [badgesByUser, journeysByUser] = await Promise.all([
    fetchEarnedBadgeTiersForUsers(friendIds),
    fetchCompletedJourneysForUsers(friendIds),
  ])

  const summaries = new Map<string, FriendMilestoneSummary>()
  for (const friendId of friendIds) {
    summaries.set(
      friendId,
      buildFriendMilestoneSummary(
        friendId,
        badgesByUser.get(friendId) ?? lockedBadgeSnapshot(),
        journeysByUser.get(friendId) ?? new Set(),
      ),
    )
  }
  return summaries
}
