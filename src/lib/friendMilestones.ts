import {
  BADGE_DEFINITIONS,
  compareTiers,
  tierLabel,
  type BadgeTier,
} from './badges'
import { fetchEarnedBadgeTiersForUsers } from './badgeDb'
import { lockedBadgeSnapshot, maxTierSnapshot, snapshotFromBadgeInput, type BadgeTierSnapshot } from './badgeUnlocks'
import { fetchCompletedJourneysForUsers } from './journeyDb'
import { JOURNEY_DEFINITIONS, mergedJourneyCompletions } from './journeys'
import type { Wine } from '../types'

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

export interface FriendMilestoneInput {
  userId: string
  wines: Wine[]
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
  journeys: ReadonlySet<string>,
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

function displayBadgesForFriend(
  wines: Wine[],
  cloudBadges: BadgeTierSnapshot,
  journeys: ReadonlySet<string>,
): BadgeTierSnapshot {
  const live = snapshotFromBadgeInput({
    wines,
    friendCount: 0,
    completedJourneys: journeys,
  })
  return maxTierSnapshot(cloudBadges, live)
}

/** Friend milestones from cloud + live cellar (same max logic as your Account badges). */
export async function fetchFriendMilestoneSummaries(
  friends: FriendMilestoneInput[],
): Promise<Map<string, FriendMilestoneSummary>> {
  if (friends.length === 0) return new Map()

  const friendIds = friends.map((friend) => friend.userId)
  const [badgesByUser, journeysByUser] = await Promise.all([
    fetchEarnedBadgeTiersForUsers(friendIds),
    fetchCompletedJourneysForUsers(friendIds),
  ])

  const summaries = new Map<string, FriendMilestoneSummary>()
  for (const friend of friends) {
    const cloudBadges = badgesByUser.get(friend.userId) ?? lockedBadgeSnapshot()
    const cloudJourneys = journeysByUser.get(friend.userId) ?? new Set()
    const journeys = mergedJourneyCompletions(friend.wines, cloudJourneys)
    const badges = displayBadgesForFriend(friend.wines, cloudBadges, journeys)
    summaries.set(friend.userId, buildFriendMilestoneSummary(friend.userId, badges, journeys))
  }
  return summaries
}
