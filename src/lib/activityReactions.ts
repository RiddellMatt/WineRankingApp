import type { PostgrestError } from '@supabase/supabase-js'
import type { ActivityEvent, ActivityEventType } from './activityFeed'
import { getSupabase } from './supabase'

export type ReactionType = 'cheers' | 'fire' | 'nice'

export interface EventReactions {
  counts: Record<ReactionType, number>
  myReaction: ReactionType | null
}

export const ACTIVITY_REACTIONS: {
  type: ReactionType
  emoji: string
  label: string
}[] = [
  { type: 'cheers', emoji: '🥂', label: 'Cheers' },
  { type: 'fire', emoji: '🔥', label: 'Fire' },
  { type: 'nice', emoji: '👏', label: 'Nice pick' },
]

export interface ActivityReactionRow {
  id: string
  reactor_id: string
  target_user_id: string
  target_wine_id: string
  event_type: ActivityEventType
  reaction_type: ReactionType
  created_at: string
}

export function emptyEventReactions(): EventReactions {
  return {
    counts: { cheers: 0, fire: 0, nice: 0 },
    myReaction: null,
  }
}

function isMissingReactionsTable(error: PostgrestError | null): boolean {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /activity_reactions/i.test(error.message ?? '')
  )
}

export function reactionEventKey(
  targetUserId: string,
  wineId: string,
  eventType: ActivityEventType,
): string {
  return `${targetUserId}-${wineId}-${eventType}`
}

function aggregateReactions(
  rows: ActivityReactionRow[],
  viewerId: string,
): Map<string, EventReactions> {
  const byEvent = new Map<string, EventReactions>()

  for (const row of rows) {
    const key = reactionEventKey(row.target_user_id, row.target_wine_id, row.event_type)
    const entry = byEvent.get(key) ?? emptyEventReactions()
    entry.counts[row.reaction_type] += 1
    if (row.reactor_id === viewerId) {
      entry.myReaction = row.reaction_type
    }
    byEvent.set(key, entry)
  }

  return byEvent
}

/** Attach reaction counts to feed events. No-op if table missing or no events. */
export async function attachReactionsToEvents(
  events: ActivityEvent[],
  viewerId: string,
): Promise<ActivityEvent[]> {
  if (events.length === 0) return events

  const wineIds = [...new Set(events.map((e) => e.wine.id))]
  const { data, error } = await getSupabase()
    .from('activity_reactions')
    .select('*')
    .in('target_wine_id', wineIds)

  if (error) {
    if (isMissingReactionsTable(error)) return events
    throw error
  }

  const byEvent = aggregateReactions((data ?? []) as ActivityReactionRow[], viewerId)
  return events.map((event) => ({
    ...event,
    reactions: byEvent.get(event.id) ?? emptyEventReactions(),
  }))
}

export interface ToggleReactionInput {
  targetUserId: string
  wineId: string
  eventType: ActivityEventType
  reaction: ReactionType
  currentReaction: ReactionType | null
}

export async function toggleActivityReaction(input: ToggleReactionInput): Promise<ReactionType | null> {
  const {
    data: { user },
  } = await getSupabase().auth.getUser()
  if (!user) throw new Error('Not signed in')

  const supabase = getSupabase()

  if (input.currentReaction === input.reaction) {
    const { error } = await supabase
      .from('activity_reactions')
      .delete()
      .eq('reactor_id', user.id)
      .eq('target_user_id', input.targetUserId)
      .eq('target_wine_id', input.wineId)
      .eq('event_type', input.eventType)
    if (error) throw error
    return null
  }

  const { error } = await supabase.from('activity_reactions').upsert(
    {
      reactor_id: user.id,
      target_user_id: input.targetUserId,
      target_wine_id: input.wineId,
      event_type: input.eventType,
      reaction_type: input.reaction,
    },
    { onConflict: 'reactor_id,target_user_id,target_wine_id,event_type' },
  )
  if (error) throw error
  return input.reaction
}

/** Optimistic feed update when toggling a reaction. */
export function applyReactionToggle(
  events: ActivityEvent[],
  eventId: string,
  reaction: ReactionType,
): ActivityEvent[] {
  return events.map((event) => {
    if (event.id !== eventId) return event
    const current = event.reactions ?? emptyEventReactions()
    const counts = { ...current.counts }
    let myReaction = current.myReaction

    if (myReaction === reaction) {
      counts[reaction] = Math.max(0, counts[reaction] - 1)
      myReaction = null
    } else {
      if (myReaction) {
        counts[myReaction] = Math.max(0, counts[myReaction] - 1)
      }
      counts[reaction] += 1
      myReaction = reaction
    }

    return { ...event, reactions: { counts, myReaction } }
  })
}
