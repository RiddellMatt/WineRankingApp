import { PRO_CONFIG } from './config'

const PRO_KEY = 'wine-rank.pro.v1'

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

/** Returns true (and activates Pro) if the code is valid. */
export function redeemUnlockCode(code: string): boolean {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return false
  if (PRO_CONFIG.unlockCodes.some((c) => c.toUpperCase() === normalized)) {
    activatePro()
    return true
  }
  return false
}

/** Merge server-side Pro entitlement into local storage when signed in. */
export function syncProFromServer(isPro: boolean | undefined): boolean {
  if (isPro) {
    activatePro()
    return true
  }
  return loadProStatus()
}
