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
  | 'unknown'

export function parseMobileDeepLink(url: string): MobileDeepLinkKind {
  if (url.startsWith(MOBILE_AUTH_REDIRECT)) return 'auth'
  if (url.startsWith(MOBILE_CHECKOUT_SUCCESS)) return 'checkout-success'
  if (url.startsWith(MOBILE_CHECKOUT_CANCEL)) return 'checkout-cancel'
  if (url.startsWith(MOBILE_ACCOUNT_REDIRECT)) return 'account'
  if (url.startsWith(`${MOBILE_APP_SCHEME}://`)) return 'unknown'
  return 'unknown'
}

export const CHECKOUT_SUCCESS_EVENT = 'decanti:checkout-success'
export const CHECKOUT_CANCEL_EVENT = 'decanti:checkout-cancel'
export const ACCOUNT_EVENT = 'decanti:account'

export function emitMobileDeepLinkEvent(kind: MobileDeepLinkKind): void {
  if (kind === 'checkout-success') {
    window.dispatchEvent(new CustomEvent(CHECKOUT_SUCCESS_EVENT))
  } else if (kind === 'checkout-cancel') {
    window.dispatchEvent(new CustomEvent(CHECKOUT_CANCEL_EVENT))
  } else if (kind === 'account') {
    window.dispatchEvent(new CustomEvent(ACCOUNT_EVENT))
  }
}
