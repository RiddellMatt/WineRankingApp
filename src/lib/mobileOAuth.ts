import { Browser } from '@capacitor/browser'
import type { Provider } from '@supabase/supabase-js'
import { authRedirectUrl, parseOAuthCallbackParams } from './authRedirect'
import { MOBILE_AUTH_REDIRECT } from './mobileDeepLinks'
import { isNativeApp } from './platform'
import { getSupabase } from './supabase'
import { friendlyAuthError } from './supabaseConfig'

export const OAUTH_SUCCESS_EVENT = 'decanti:oauth-success'
export const OAUTH_ERROR_EVENT = 'decanti:oauth-error'

function emitOAuthError(message: string): void {
  window.dispatchEvent(new CustomEvent(OAUTH_ERROR_EVENT, { detail: message }))
}

function emitOAuthSuccess(): void {
  window.dispatchEvent(new CustomEvent(OAUTH_SUCCESS_EVENT))
}

/** Prevent double exchange when getLaunchUrl and appUrlOpen both fire on Android. */
let exchangeInFlight: Promise<boolean> | null = null
let lastCompletedCode: string | null = null
/** Codes we already exchanged (success or failure) — avoids stale getLaunchUrl loops on iOS. */
const attemptedOAuthCodes = new Set<string>()
/** PKCE flow id from the in-flight signInWithOAuth call (fallback if not on callback URL). */
let pendingOAuthFlowId: string | null = null
/** True while the user may still be in the system browser for OAuth. */
let waitingForOAuthBrowserReturn = false
let browserDismissGeneration = 0

async function exchangeOAuthCallback(url: string): Promise<boolean> {
  waitingForOAuthBrowserReturn = false
  browserDismissGeneration += 1

  if (isNativeApp()) {
    try {
      await Browser.close()
    } catch {
      // Browser may already be closed when the app opens from the deep link.
    }
  }

  const { code, flowId, oauthError } = parseOAuthCallbackParams(url)
  if (oauthError) {
    emitOAuthError(friendlyAuthError(oauthError))
    return true
  }
  if (!code) {
    emitOAuthError('Sign-in redirect was missing an authorization code. Try again.')
    return true
  }

  if (attemptedOAuthCodes.has(code)) {
    return true
  }

  const effectiveFlowId = flowId ?? pendingOAuthFlowId ?? undefined
  pendingOAuthFlowId = null

  const { error } = await getSupabase().auth.exchangeCodeForSession(
    code,
    effectiveFlowId ? { flowId: effectiveFlowId } : undefined,
  )
  attemptedOAuthCodes.add(code)

  if (error) {
    console.error('OAuth deep link failed:', error.message)
    emitOAuthError(friendlyAuthError(error.message))
    return true
  }

  lastCompletedCode = code
  emitOAuthSuccess()
  return true
}

/** Finish Google/Apple sign-in after Supabase redirects to the app scheme. */
export async function completeOAuthFromUrl(url: string): Promise<boolean> {
  if (!url.startsWith(MOBILE_AUTH_REDIRECT)) return false

  const { code } = parseOAuthCallbackParams(url)
  if (code && code === lastCompletedCode) return true
  if (code && attemptedOAuthCodes.has(code)) return true

  if (exchangeInFlight) return exchangeInFlight

  exchangeInFlight = (async () => exchangeOAuthCallback(url))()

  try {
    return await exchangeInFlight
  } finally {
    exchangeInFlight = null
  }
}

/**
 * Google blocks OAuth inside embedded WebViews (400 after 2FA). Native builds open
 * the system browser (Chrome Custom Tabs / SFSafariViewController) via Browser.open
 * so Supabase can redirect to com.northline.decanti://login-callback and resume the app.
 * PKCE state is stored via Capacitor Preferences for exchangeCodeForSession on return.
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

  pendingOAuthFlowId = data.flowId ?? null
  lastCompletedCode = null

  if (!isNativeApp()) {
    return 'Native sign-in is only available in the mobile app.'
  }

  waitingForOAuthBrowserReturn = true
  browserDismissGeneration += 1
  await Browser.open({ url: data.url })
  return null
}

/** Clear OAuth spinner if the user closes the browser without finishing sign-in. */
export function listenForOAuthBrowserDismiss(): void {
  if (!isNativeApp()) return

  void Browser.addListener('browserFinished', () => {
    if (!waitingForOAuthBrowserReturn) return

    const generation = browserDismissGeneration
    window.setTimeout(() => {
      if (!waitingForOAuthBrowserReturn || generation !== browserDismissGeneration) return
      if (exchangeInFlight) return

      void getSupabase()
        .auth.getSession()
        .then(({ data }) => {
          if (!waitingForOAuthBrowserReturn || generation !== browserDismissGeneration) return
          if (!data.session) {
            waitingForOAuthBrowserReturn = false
            emitOAuthError('Sign-in was cancelled. Tap Continue with Google to try again.')
          }
        })
    }, 900)
  })
}
