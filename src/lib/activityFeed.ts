import { friendDisplayLabel, type FriendProfile } from './friendsDb'
import { wineFromRow } from './wineDb'
import { getSupabase } from './supabase'
import { fetchProfilesByIds } from './profileDb'
import { isWishlist } from './wishlist'
import type { Wine } from '../types'

export type ActivityEventType = 'logged' | 'saved_to_try'

export interface ActivityEvent {
  id: string
  type: ActivityEventType
  at: number
  actor: FriendProfile
  wine: Wine
}

export function activityEventType(wine: Pick<Wine, 'status'>): ActivityEventType {
  return isWishlist(wine) ? 'saved_to_try' : 'logged'
}

export function activityEventLabel(type: ActivityEventType): string {
  return type === 'saved_to_try' ? 'saved to try' : 'logged'
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

/** Recent activity from accepted friends (includes wishlist saves). */
export async function fetchFriendActivity(
  friendIds: string[],
  limit = 30,
): Promise<ActivityEvent[]> {
  if (friendIds.length === 0) return []

  const { data, error } = await getSupabase()
    .from('wines')
    .select('*')
    .in('user_id', friendIds)
    .order('added_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  const rows = data ?? []
  const actorIds = [...new Set(rows.map((r) => r.user_id as string))]
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

  return events.sort((a, b) => b.at - a.at)
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
