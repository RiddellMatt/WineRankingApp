import { friendDisplayLabel, type FriendProfile } from './friendsDb'
import type { EventReactions } from './activityReactions'
import { fetchFriendMilestoneEvents, type ActivityEventRow } from './activityEventsDb'
import { wineFromRow } from './wineDb'
import { getSupabase } from './supabase'
import { fetchProfilesByIds } from './profileDb'
import { isWishlist } from './wishlist'
import type { BadgeTier } from './badges'
import type { Wine } from '../types'

export type WineActivityEventType = 'logged' | 'saved_to_try'
export type MilestoneActivityEventType = 'badge_unlock' | 'journey_complete'
export type ActivityEventType = WineActivityEventType | MilestoneActivityEventType

export interface ActivityMilestone {
  badgeId?: string
  badgeTitle?: string
  badgeIcon?: string
  tier?: BadgeTier
  previousTier?: BadgeTier
  journeyId?: string
  journeyTitle?: string
  journeyIcon?: string
}

export interface ActivityEvent {
  id: string
  type: ActivityEventType
  at: number
  actor: FriendProfile
  wine?: Wine
  milestone?: ActivityMilestone
  reactions?: EventReactions
}

export function activityEventType(wine: Pick<Wine, 'status'>): WineActivityEventType {
  return isWishlist(wine) ? 'saved_to_try' : 'logged'
}

export function activityEventLabel(type: ActivityEventType): string {
  switch (type) {
    case 'saved_to_try':
      return 'saved to try'
    case 'badge_unlock':
      return 'earned a badge'
    case 'journey_complete':
      return 'completed a journey'
    default:
      return 'logged'
  }
}

export function formatActivityTime(at: number): string {
  const date = new Date(at)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / 3_600_000)
  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function wineActivityTitle(wine: Wine): string {
  const parts = [wine.name, wine.vintage].filter(Boolean)
  return parts.join(' ')
}

export function wineActivitySubtitle(wine: Wine): string | null {
  if (wine.winery.trim()) return wine.winery.trim()
  return null
}

function milestoneFromRow(row: ActivityEventRow): ActivityMilestone {
  const payload = row.payload
  if (row.event_type === 'badge_unlock') {
    const p = payload as {
      badge_id: string
      badge_title: string
      badge_icon: string
      tier: BadgeTier
      previous_tier?: BadgeTier
    }
    return {
      badgeId: p.badge_id,
      badgeTitle: p.badge_title,
      badgeIcon: p.badge_icon,
      tier: p.tier,
      previousTier: p.previous_tier,
    }
  }
  const p = payload as {
    journey_id: string
    journey_title: string
    journey_icon: string
  }
  return {
    journeyId: p.journey_id,
    journeyTitle: p.journey_title,
    journeyIcon: p.journey_icon,
  }
}

function milestoneEventFromRow(row: ActivityEventRow, actor: FriendProfile): ActivityEvent {
  return {
    id: row.id,
    type: row.event_type,
    at: new Date(row.created_at).getTime(),
    actor,
    milestone: milestoneFromRow(row),
  }
}

/** Recent activity from accepted friends (wines + milestone events). */
export async function fetchFriendActivity(
  friendIds: string[],
  limit = 30,
): Promise<ActivityEvent[]> {
  if (friendIds.length === 0) return []

  const perSource = Math.max(limit, 20)

  const [wineResult, milestoneRows] = await Promise.all([
    getSupabase()
      .from('wines')
      .select('*')
      .in('user_id', friendIds)
      .order('added_at', { ascending: false })
      .limit(perSource),
    fetchFriendMilestoneEvents(friendIds, perSource),
  ])

  if (wineResult.error) throw wineResult.error

  const rows = wineResult.data ?? []
  const actorIds = [
    ...new Set([
      ...rows.map((r) => r.user_id as string),
      ...milestoneRows.map((r) => r.user_id),
    ]),
  ]
  const profiles = new Map<string, FriendProfile>()
  if (actorIds.length > 0) {
    const profileRows = await fetchProfilesByIds(actorIds)
    for (const row of profileRows) {
      profiles.set(row.id, {
        id: row.id,
        displayName: row.display_name,
        email: row.email,
        avatarUrl: row.avatar_url ?? undefined,
      })
    }
  }

  const events: ActivityEvent[] = []

  for (const row of rows) {
    const actor = profiles.get(row.user_id as string)
    if (!actor) continue
    const wine = wineFromRow(row)
    const type = activityEventType(wine)
    events.push({
      id: `${row.user_id}-${wine.id}-${type}`,
      type,
      at: wine.addedAt,
      actor,
      wine,
    })
  }

  for (const row of milestoneRows) {
    const actor = profiles.get(row.user_id)
    if (!actor) continue
    events.push(milestoneEventFromRow(row, actor))
  }

  return events.sort((a, b) => b.at - a.at).slice(0, limit)
}

/** Fallback when the user has no friends yet — show their own recent logs. */
export function ownRecentActivity(
  userId: string,
  displayName: string,
  email: string,
  avatarUrl: string | undefined,
  wines: Wine[],
  limit = 8,
): ActivityEvent[] {
  const actor: FriendProfile = {
    id: userId,
    displayName: displayName.trim() || email.split('@')[0] || 'You',
    email,
    avatarUrl,
  }

  return [...wines]
    .sort((a, b) => b.addedAt - a.addedAt)
    .slice(0, limit)
    .map((wine) => {
      const type = activityEventType(wine)
      return {
        id: `${userId}-${wine.id}-${type}`,
        type,
        at: wine.addedAt,
        actor,
        wine,
      }
    })
}

export function actorLabel(actor: FriendProfile, viewerId: string): string {
  if (actor.id === viewerId) return 'You'
  return friendDisplayLabel(actor)
}

export function milestoneHeadline(event: ActivityEvent): string | null {
  if (!event.milestone) return null
  if (event.type === 'badge_unlock') {
    const { badgeTitle, tier, badgeIcon } = event.milestone
    if (!badgeTitle) return null
    const tierLabel = tier && tier !== 'locked' ? ` · ${tier.charAt(0).toUpperCase()}${tier.slice(1)}` : ''
    return `${badgeIcon ?? '🏅'} ${badgeTitle}${tierLabel}`
  }
  if (event.type === 'journey_complete') {
    const { journeyTitle, journeyIcon } = event.milestone
    if (!journeyTitle) return null
    return `${journeyIcon ?? '🧭'} ${journeyTitle}`
  }
  return null
}
