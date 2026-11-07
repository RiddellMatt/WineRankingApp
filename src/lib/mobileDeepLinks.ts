import { APP_SCHEME } from '../brand'

export const MOBILE_APP_SCHEME = APP_SCHEME
export const MOBILE_AUTH_REDIRECT = `${MOBILE_APP_SCHEME}://login-callback`
export const MOBILE_CHECKOUT_SUCCESS = `${MOBILE_APP_SCHEME}://checkout-success`
export const MOBILE_CHECKOUT_CANCEL = `${MOBILE_APP_SCHEME}://checkout-cancel`
export const MOBILE_ACCOUNT_REDIRECT = `${MOBILE_APP_SCHEME}://account`

export type MobileDeepLinkKind =
  | 'auth'
  | 'checkout-success'
  | 'checkout-cancel'
  | 'account'
  | 'friends'
  | 'unknown'

const FRIENDS_PREFIX = `${MOBILE_APP_SCHEME}://friends`

/** Push notification deep link → Social tab. */
export function parseFriendsDeepLink(url: string): 'feed' | 'manage' | null {
  if (!url.startsWith(FRIENDS_PREFIX)) return null
  try {
    const parsed = new URL(url)
    return parsed.searchParams.get('tab') === 'manage' ? 'manage' : 'feed'
  } catch {
    return 'feed'
  }
}

export function parseMobileDeepLink(url: string): MobileDeepLinkKind {
  if (url.startsWith(MOBILE_AUTH_REDIRECT)) return 'auth'
  if (url.startsWith(MOBILE_CHECKOUT_SUCCESS)) return 'checkout-success'
  if (url.startsWith(MOBILE_CHECKOUT_CANCEL)) return 'checkout-cancel'
  if (url.startsWith(MOBILE_ACCOUNT_REDIRECT)) return 'account'
  if (url.startsWith(FRIENDS_PREFIX)) return 'friends'
  if (url.startsWith(`${MOBILE_APP_SCHEME}://`)) return 'unknown'
  return 'unknown'
}

export const CHECKOUT_SUCCESS_EVENT = 'decanti:checkout-success'
export const CHECKOUT_CANCEL_EVENT = 'decanti:checkout-cancel'
export const ACCOUNT_EVENT = 'decanti:account'
export const FRIENDS_PUSH_EVENT = 'decanti:friends-push'

export function emitMobileDeepLinkEvent(kind: MobileDeepLinkKind, url?: string): void {
  if (kind === 'checkout-success') {
    window.dispatchEvent(new CustomEvent(CHECKOUT_SUCCESS_EVENT))
  } else if (kind === 'checkout-cancel') {
    window.dispatchEvent(new CustomEvent(CHECKOUT_CANCEL_EVENT))
  } else if (kind === 'account') {
    window.dispatchEvent(new CustomEvent(ACCOUNT_EVENT))
  } else if (kind === 'friends') {
    const tab = url ? parseFriendsDeepLink(url) : 'feed'
    window.dispatchEvent(new CustomEvent(FRIENDS_PUSH_EVENT, { detail: { tab: tab ?? 'feed' } }))
  }
}
