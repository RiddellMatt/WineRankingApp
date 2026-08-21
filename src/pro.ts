import { PRO_STORAGE_KEY } from './brand'

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
 * When signed in, server `is_pro` is the source of truth.
 * Offline mode keeps using localStorage until the user signs in.
 */
export function syncProFromServer(isPro: boolean | undefined, signedIn: boolean): boolean {
  if (signedIn) {
    if (isPro) {
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
