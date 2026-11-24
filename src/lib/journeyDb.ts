import type { PostgrestError } from '@supabase/supabase-js'
import type { Wine } from '../types'
import { mergedJourneyCompletions } from './journeys'
import { journeyCompletionsStorageKey } from './progressStorage'
import { localProgressGeneration } from './progressReset'
import { getSupabase } from './supabase'

export function loadCompletedJourneysLocal(): Set<string> {
  try {
    const raw = localStorage.getItem(journeyCompletionsStorageKey())
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as string[]
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

export function saveCompletedJourneysLocal(completed: Set<string>): void {
  try {
    localStorage.setItem(journeyCompletionsStorageKey(), JSON.stringify([...completed]))
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
        earned_generation: localProgressGeneration(userId),
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
  const earnedGeneration = localProgressGeneration(userId)
  const rows = journeyIds.map((journeyId) => ({
    user_id: userId,
    journey_id: journeyId,
    completed_at: now,
    earned_generation: earnedGeneration,
  }))

  const { error } = await getSupabase().from('user_journey_completions').upsert(rows, {
    onConflict: 'user_id,journey_id',
  })

  if (error) {
    if (isMissingJourneyCompletionsTable(error)) return
    throw error
  }
}

/**
 * Keep server completions, including ones the cellar no longer satisfies,
 * and add journeys this cellar actually completes. The on-device set is not
 * an authority — it used to re-upload another account's passport after a reset.
 */
export async function syncJourneyCompletions(
  userId: string,
  wines: Wine[],
): Promise<Set<string>> {
  const cloud = await fetchCompletedJourneys(userId)
  const merged = mergedJourneyCompletions(wines, cloud)
  const toUpload = [...merged].filter((id) => !cloud.has(id))
  if (toUpload.length > 0) {
    await markJourneysComplete(userId, toUpload)
  }
  return merged
}
