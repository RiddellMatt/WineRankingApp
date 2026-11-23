import { isJwtIssuedAtFutureError, isSupabaseJwtTimingError } from './jwtFutureRetry'
import { getSupabase } from './supabase'

export { isSupabaseJwtTimingError }

/** Refresh the stored session from GoTrue (no-op when signed out). */
export async function refreshSupabaseSession(): Promise<void> {
  const { error } = await getSupabase().auth.refreshSession()
  if (error && !isSupabaseJwtTimingError(error) && !isJwtIssuedAtFutureError(error)) {
    throw error
  }
}

/** Run a Supabase-backed call; on an expired JWT, refresh once and retry. */
export async function withSupabaseAuthRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (!isSupabaseJwtTimingError(error)) throw error
    await refreshSupabaseSession()
    return await fn()
  }
}