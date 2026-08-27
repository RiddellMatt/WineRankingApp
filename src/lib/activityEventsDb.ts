import type { PostgrestError } from '@supabase/supabase-js'
import type { BadgeTier } from './badges'
import { getSupabase } from './supabase'

export type MilestoneEventType = 'badge_unlock' | 'journey_complete'

export interface BadgeUnlockPayload {
  badge_id: string
  badge_title: string
  badge_icon: string
  tier: BadgeTier
  previous_tier: BadgeTier
}

export interface JourneyCompletePayload {
  journey_id: string
  journey_title: string
  journey_icon: string
}

export interface ActivityEventRow {
  id: string
  user_id: string
  event_type: MilestoneEventType
  payload: BadgeUnlockPayload | JourneyCompletePayload
  created_at: string
}

export function isMissingActivityEventsTable(error: PostgrestError | null): boolean {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /activity_events/i.test(error.message ?? '')
  )
}

export async function recordBadgeUnlockEvent(
  userId: string,
  payload: BadgeUnlockPayload,
): Promise<void> {
  const { error } = await getSupabase().from('activity_events').insert({
    user_id: userId,
    event_type: 'badge_unlock',
    payload,
  })

  if (error) {
    if (isMissingActivityEventsTable(error)) return
    throw error
  }
}

export async function recordJourneyCompleteEvent(
  userId: string,
  payload: JourneyCompletePayload,
): Promise<void> {
  const { error } = await getSupabase().from('activity_events').insert({
    user_id: userId,
    event_type: 'journey_complete',
    payload,
  })

  if (error) {
    if (isMissingActivityEventsTable(error)) return
    throw error
  }
}

export async function fetchFriendMilestoneEvents(
  friendIds: string[],
  limit = 30,
): Promise<ActivityEventRow[]> {
  if (friendIds.length === 0) return []

  const { data, error } = await getSupabase()
    .from('activity_events')
    .select('id, user_id, event_type, payload, created_at')
    .in('user_id', friendIds)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingActivityEventsTable(error)) return []
    throw error
  }

  return (data ?? []) as ActivityEventRow[]
}
