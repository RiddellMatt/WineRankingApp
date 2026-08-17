import { isNativeApp } from './platform'
import {
  MOBILE_AUTH_REDIRECT,
  MOBILE_CHECKOUT_SUCCESS,
} from './mobileDeepLinks'

/** OAuth redirect target; must match Supabase Auth → URL Configuration. */
export function authRedirectUrl(): string {
  if (isNativeApp()) return MOBILE_AUTH_REDIRECT

  const base = import.meta.env.BASE_URL || '/'
  const normalized = base.endsWith('/') ? base : `${base}/`
  return `${window.location.origin}${normalized}`
}

export function isCheckoutSuccessUrl(): boolean {
  if (isNativeApp()) return false
  const params = new URLSearchParams(window.location.search)
  return params.get('checkout') === 'success'
}

export function checkoutSuccessRedirectTarget(): string {
  return isNativeApp() ? MOBILE_CHECKOUT_SUCCESS : authRedirectUrl() + '?checkout=success'
}

const AUTH_QUERY_PARAMS = [
  'code',
  'error',
  'error_code',
  'error_description',
  'access_token',
  'refresh_token',
  'expires_in',
  'token_type',
  'type',
]

export function isOAuthCallback(): boolean {
  const params = new URLSearchParams(window.location.search)
  if (params.has('code') || params.has('error')) return true
  const hash = window.location.hash
  return hash.includes('access_token') || hash.includes('error=')
}

/** Remove Supabase OAuth params from the address bar after sign-in. */
export function cleanAuthParamsFromUrl(): void {
  if (isNativeApp()) return

  const url = new URL(window.location.href)
  let changed = false

  for (const key of AUTH_QUERY_PARAMS) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key)
      changed = true
    }
  }

  if (url.hash && (url.hash.includes('access_token') || url.hash.includes('error'))) {
    url.hash = ''
    changed = true
  }

  if (changed) {
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }
}
