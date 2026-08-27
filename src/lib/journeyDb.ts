import type { PostgrestError } from '@supabase/supabase-js'
import { STORAGE_PREFIX } from '../brand'
import { getSupabase } from './supabase'

const COMPLETED_KEY = `${STORAGE_PREFIX}.journey-completions.v1`

export function loadCompletedJourneysLocal(): Set<string> {
  try {
    const raw = localStorage.getItem(COMPLETED_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as string[]
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

export function saveCompletedJourneysLocal(completed: Set<string>): void {
  try {
    localStorage.setItem(COMPLETED_KEY, JSON.stringify([...completed]))
  } catch {
    // ignore
  }
}

export function isMissingJourneyCompletionsTable(error: PostgrestError | null): boolean {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /user_journey_completions/i.test(error.message ?? '')
  )
}

export async function fetchCompletedJourneys(userId: string): Promise<Set<string>> {
  const { data, error } = await getSupabase()
    .from('user_journey_completions')
    .select('journey_id')
    .eq('user_id', userId)

  if (error) {
    if (isMissingJourneyCompletionsTable(error)) return new Set()
    throw error
  }

  return new Set((data ?? []).map((row) => (row as { journey_id: string }).journey_id))
}

/** Batch fetch journey completions for multiple users (friends). */
export async function fetchCompletedJourneysForUsers(
  userIds: string[],
): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>()
  if (userIds.length === 0) return result

  for (const userId of userIds) {
    result.set(userId, new Set())
  }

  const { data, error } = await getSupabase()
    .from('user_journey_completions')
    .select('user_id, journey_id')
    .in('user_id', userIds)

  if (error) {
    if (isMissingJourneyCompletionsTable(error)) return result
    throw error
  }

  for (const row of data ?? []) {
    const userId = (row as { user_id: string; journey_id: string }).user_id
    const journeyId = (row as { user_id: string; journey_id: string }).journey_id
    const set = result.get(userId) ?? new Set()
    set.add(journeyId)
    result.set(userId, set)
  }
  return result
}

export async function markJourneyComplete(userId: string, journeyId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('user_journey_completions')
    .upsert(
      {
        user_id: userId,
        journey_id: journeyId,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,journey_id' },
    )

  if (error) {
    if (isMissingJourneyCompletionsTable(error)) return
    throw error
  }
}

export async function markJourneysComplete(
  userId: string,
  journeyIds: string[],
): Promise<void> {
  if (journeyIds.length === 0) return
  const now = new Date().toISOString()
  const rows = journeyIds.map((journeyId) => ({
    user_id: userId,
    journey_id: journeyId,
    completed_at: now,
  }))

  const { error } = await getSupabase().from('user_journey_completions').upsert(rows, {
    onConflict: 'user_id,journey_id',
  })

  if (error) {
    if (isMissingJourneyCompletionsTable(error)) return
    throw error
  }
}

/** Merge cloud completions with newly detected local completions. */
export async function syncJourneyCompletions(
  userId: string,
  localEarned: Set<string>,
): Promise<Set<string>> {
  const cloud = await fetchCompletedJourneys(userId)
  const merged = new Set([...cloud, ...localEarned])
  const toUpload = [...localEarned].filter((id) => !cloud.has(id))
  if (toUpload.length > 0) {
    await markJourneysComplete(userId, toUpload)
  }
  return merged
}
