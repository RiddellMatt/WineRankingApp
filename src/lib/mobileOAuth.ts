import { Browser } from '@capacitor/browser'
import type { Provider } from '@supabase/supabase-js'
import { authRedirectUrl } from './authRedirect'
import { MOBILE_AUTH_REDIRECT } from './mobileDeepLinks'
import { nativePlatform } from './platform'
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

/** Finish Google/Apple sign-in after Supabase redirects to the app scheme. */
export async function completeOAuthFromUrl(url: string): Promise<boolean> {
  if (!url.startsWith(MOBILE_AUTH_REDIRECT)) return false

  if (nativePlatform() === 'android') {
    try {
      await Browser.close()
    } catch {
      // Browser tab may already be closed when the app opens.
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

/** Capacitor must open OAuth in the system browser, not the WebView. */
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

  // iOS SFSafariViewController (Browser.open) cannot redirect to custom URL schemes
  // and shows "Safari address is invalid". Run OAuth in the app WebView instead.
  if (nativePlatform() === 'ios') {
    window.location.assign(data.url)
    return null
  }

  await Browser.open({ url: data.url })
  return null
}
