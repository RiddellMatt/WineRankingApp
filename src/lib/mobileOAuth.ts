import { Browser } from '@capacitor/browser'
import type { Provider } from '@supabase/supabase-js'
import { authRedirectUrl } from './authRedirect'
import { MOBILE_AUTH_REDIRECT } from './mobileDeepLinks'
import { isNativeApp, nativePlatform } from './platform'
import { getSupabase } from './supabase'
import { friendlyAuthError } from './supabaseConfig'

export const OAUTH_SUCCESS_EVENT = 'cellar-rank:oauth-success'
export const OAUTH_ERROR_EVENT = 'cellar-rank:oauth-error'

function emitOAuthError(message: string): void {
  window.dispatchEvent(new CustomEvent(OAUTH_ERROR_EVENT, { detail: message }))
}

function emitOAuthSuccess(): void {
  window.dispatchEvent(new CustomEvent(OAUTH_SUCCESS_EVENT))
}

function oauthCodeFromUrl(url: string): string | null {
  try {
    return new URL(url).searchParams.get('code')
  } catch {
    return null
  }
}

/** Prevent double exchange when getLaunchUrl and appUrlOpen both fire on Android. */
let exchangeInFlight: Promise<boolean> | null = null
let lastCompletedCode: string | null = null

async function exchangeOAuthCallback(url: string): Promise<boolean> {
  if (nativePlatform() === 'android') {
    try {
      await Browser.close()
    } catch {
      // Tab may already be closed when the app opens from the deep link.
    }
  }

  try {
    const parsed = new URL(url)
    const oauthError =
      parsed.searchParams.get('error_description') ?? parsed.searchParams.get('error')
    if (oauthError) {
      emitOAuthError(friendlyAuthError(oauthError))
      return true
    }
  } catch {
    // exchangeCodeForSession accepts the raw callback URL.
  }

  const { error } = await getSupabase().auth.exchangeCodeForSession(url)
  if (error) {
    console.error('OAuth deep link failed:', error.message)
    emitOAuthError(friendlyAuthError(error.message))
    return true
  }

  emitOAuthSuccess()
  return true
}

/** Finish Google/Apple sign-in after Supabase redirects to the app scheme. */
export async function completeOAuthFromUrl(url: string): Promise<boolean> {
  if (!url.startsWith(MOBILE_AUTH_REDIRECT)) return false

  const code = oauthCodeFromUrl(url)
  if (code && code === lastCompletedCode) return true

  if (exchangeInFlight) return exchangeInFlight

  exchangeInFlight = (async () => {
    const handled = await exchangeOAuthCallback(url)
    if (handled && code) lastCompletedCode = code
    return handled
  })()

  try {
    return await exchangeInFlight
  } finally {
    exchangeInFlight = null
  }
}

/**
 * Google blocks OAuth inside embedded WebViews (400 after 2FA). Android must use
 * Chrome Custom Tabs (Browser.open). PKCE state is stored via Capacitor Preferences
 * so exchangeCodeForSession still works when returning via deep link.
 * iOS uses in-app WebView navigation because SFSafariViewController cannot open custom schemes.
 */
export async function startNativeOAuth(provider: Provider): Promise<string | null> {
  const options: { redirectTo: string; skipBrowserRedirect: boolean; scopes?: string } = {
    redirectTo: authRedirectUrl(),
    skipBrowserRedirect: true,
  }
  if (provider === 'apple') {
    options.scopes = 'name email'
  }

  const { data, error } = await getSupabase().auth.signInWithOAuth({ provider, options })
  if (error) return error.message
  if (!data.url) return 'Could not start sign in.'

  lastCompletedCode = null

  if (!isNativeApp()) {
    return 'Native sign-in is only available in the mobile app.'
  }

  if (nativePlatform() === 'android') {
    await Browser.open({ url: data.url })
    return null
  }

  window.location.assign(data.url)
  return null
}
