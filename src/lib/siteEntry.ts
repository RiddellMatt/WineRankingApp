import { isCheckoutSuccessUrl, isOAuthCallback } from './authRedirect'
import { isNativeApp } from './platform'

const ENTER_APP_KEY = 'decanti.enterApp'

/** Logged-out web visitors see the marketing page. The native apps, and anyone already entering the product, skip it. */
export function shouldOpenAppDirectly(): boolean {
  if (isNativeApp()) return true
  if (isOAuthCallback() || isCheckoutSuccessUrl()) return true
  const params = new URLSearchParams(window.location.search)
  if (params.has('view') || params.get('app') === '1' || params.has('ref')) return true
  try {
    return sessionStorage.getItem(ENTER_APP_KEY) === '1'
  } catch {
    return false
  }
}

export function rememberOpenApp(): void {
  try {
    sessionStorage.setItem(ENTER_APP_KEY, '1')
  } catch {
    // Private browsing can block storage. The in-memory flag still opens the app.
  }
}
