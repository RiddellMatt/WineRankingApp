import { getSupabase } from './supabase'

const DEFAULT_INVOKE_TIMEOUT_MS = 120_000

/** Invoke a Supabase Edge Function with a fresh session JWT (mobile-safe). */
export async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
  timeoutMs = DEFAULT_INVOKE_TIMEOUT_MS,
) {
  const supabase = getSupabase()
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError || !session?.access_token) {
    return {
      data: null,
      error: new Error('Sign in required.'),
    }
  }

  const expiresAtMs = (session.expires_at ?? 0) * 1000
  if (expiresAtMs > 0 && expiresAtMs < Date.now() + 60_000) {
    await supabase.auth.refreshSession()
  }

  const {
    data: { session: refreshed },
  } = await supabase.auth.getSession()
  const accessToken = refreshed?.access_token ?? session.access_token

  return supabase.functions.invoke<T>(functionName, {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: timeoutMs,
  })
}
