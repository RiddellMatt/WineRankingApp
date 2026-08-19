import { OAUTH_ERROR_EVENT } from './mobileOAuth'
import { isOAuthCallback } from './authRedirect'
import { isNativeApp } from './platform'
import { getSupabase } from './supabase'
import { friendlyAuthError } from './supabaseConfig'

/** Add these in Supabase → Authentication → URL Configuration → Redirect URLs. */
export const SUPABASE_WEB_REDIRECT_URLS = [
  'https://riddellmatt.github.io/WineRankingApp/',
  'https://riddellmatt.github.io/WineRankingApp',
  'http://localhost:5173/',
  'http://localhost:5173',
] as const

export function isWebOAuthCallback(): boolean {
  return !isNativeApp() && isOAuthCallback()
}

/** Complete Google/Apple sign-in when Safari returns with ?code= on the web app URL. */
export async function completeWebOAuthFromUrl(url: string): Promise<string | null> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return 'Invalid sign-in redirect.'
  }

  const oauthError =
    parsed.searchParams.get('error_description') ?? parsed.searchParams.get('error')
  if (oauthError) return oauthError

  if (!parsed.searchParams.has('code')) return null

  const supabase = getSupabase()
  const { data: existing } = await supabase.auth.getSession()
  if (existing.session) return null

  const { error } = await supabase.auth.exchangeCodeForSession(url)
  return error ? friendlyAuthError(error.message) : null
}

export function emitWebOAuthError(message: string): void {
  window.dispatchEvent(new CustomEvent(OAUTH_ERROR_EVENT, { detail: message }))
}
