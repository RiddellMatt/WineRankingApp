import { getSupabase } from './supabase'

/** PostgREST / GoTrue errors when device clock and JWT `iat` disagree (common on cold iOS launch). */
export function isSupabaseJwtTimingError(error: unknown): boolean {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error)
  return /jwt issued at future|jwt expired|token.*expired|clock skew/i.test(message)
}

/** Refresh the stored session from GoTrue (no-op when signed out). */
export async function refreshSupabaseSession(): Promise<void> {
  const { error } = await getSupabase().auth.refreshSession()
  if (error && !isSupabaseJwtTimingError(error)) {
    throw error
  }
}

/** Run a Supabase-backed call; on JWT timing errors, refresh once and retry. */
export async function withSupabaseAuthRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (!isSupabaseJwtTimingError(error)) throw error
    await refreshSupabaseSession()
    return await fn()
  }
}