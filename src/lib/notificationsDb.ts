import type { PostgrestError } from '@supabase/supabase-js'
import type { ActivityEventType } from './activityFeed'
import { friendDisplayLabel, type FriendProfile } from './friendsDb'
import { fetchProfilesByIds } from './profileDb'
import type { ReactionType } from './activityReactions'
import { getSupabase } from './supabase'

export type NotificationType = 'reaction' | 'friend_request' | 'friend_accepted'

export interface ReactionNotificationPayload {
  reaction_type: ReactionType
  wine_id: string
  wine_name: string
  event_type: ActivityEventType
}

export interface FriendshipNotificationPayload {
  friendship_id: string
}

export interface AppNotification {
  id: string
  type: NotificationType
  actor: FriendProfile | null
  payload: ReactionNotificationPayload | FriendshipNotificationPayload
  readAt: string | null
  createdAt: string
}

interface NotificationRow {
  id: string
  recipient_id: string
  actor_id: string | null
  type: NotificationType
  payload: ReactionNotificationPayload | FriendshipNotificationPayload
  read_at: string | null
  created_at: string
}

const REACTION_EMOJI: Record<ReactionType, string> = {
  cheers: '🥂',
  fire: '🔥',
  nice: '👏',
}

export function isMissingNotificationsTable(error: PostgrestError | null): boolean {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /notifications/i.test(error.message ?? '')
  )
}

export function notificationMessage(n: AppNotification): string {
  const name = n.actor ? friendDisplayLabel(n.actor, 'Someone') : 'Someone'
  switch (n.type) {
    case 'reaction': {
      const p = n.payload as ReactionNotificationPayload
      const emoji = REACTION_EMOJI[p.reaction_type] ?? '✨'
      const verb = p.event_type === 'saved_to_try' ? 'want-to-try save' : 'wine log'
      return `${name} reacted ${emoji} to your ${verb} — ${p.wine_name}`
    }
    case 'friend_request':
      return `${name} sent you a friend request`
    case 'friend_accepted':
      return `${name} accepted your friend request`
    default:
      return 'New notification'
  }
}

export function notificationFriendsTab(n: AppNotification): 'feed' | 'manage' {
  return n.type === 'reaction' ? 'feed' : 'manage'
}

export async function fetchNotifications(limit = 40): Promise<AppNotification[]> {
  const { data, error } = await getSupabase()
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingNotificationsTable(error)) return []
    throw error
  }

  const rows = (data ?? []) as NotificationRow[]
  const actorIds = [
    ...new Set(rows.map((r) => r.actor_id).filter((id): id is string => Boolean(id))),
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

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    actor: row.actor_id ? profiles.get(row.actor_id) ?? null : null,
    payload: row.payload,
    readAt: row.read_at,
    createdAt: row.created_at,
  }))
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const { count, error } = await getSupabase()
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .is('read_at', null)

  if (error) {
    if (isMissingNotificationsTable(error)) return 0
    throw error
  }
  return count ?? 0
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await getSupabase()
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
  if (error) throw error
}

export function formatNotificationTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
