import { PRO_STORAGE_KEY } from './brand'
import { hasProAccess } from './lib/referrals'

const PRO_KEY = PRO_STORAGE_KEY

export function loadProStatus(): boolean {
  try {
    return localStorage.getItem(PRO_KEY) === 'active'
  } catch {
    return false
  }
}

export function activatePro(): void {
  localStorage.setItem(PRO_KEY, 'active')
}

export function clearPro(): void {
  try {
    localStorage.removeItem(PRO_KEY)
  } catch {
    // ignore
  }
}

/**
 * When signed in, paid Pro or an unexpired invite month is the source of truth.
 * Offline mode keeps using localStorage until the user signs in.
 */
export function syncProFromServer(
  isPro: boolean | undefined,
  signedIn: boolean,
  proUntil?: string | null,
): boolean {
  if (signedIn) {
    if (hasProAccess(isPro, proUntil)) {
      activatePro()
      return true
    }
    clearPro()
    return false
  }
  if (isPro) {
    activatePro()
    return true
  }
  return loadProStatus()
}
