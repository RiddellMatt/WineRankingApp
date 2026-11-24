import { STORAGE_PREFIX } from '../brand'

/**
 * Badge and journey caches used to live in one device key shared by every
 * account. A reset clears the server, then the next sign-in uploaded that
 * shared cache — including the previous account's tiers — and stamped it with
 * the new progress generation, so the server accepted it.
 * Keys are per account. The signed-in cache is ignored until this session
 * rebuilds it from the server and the current cellar.
 */
let activeUserId: string | null = null
let signedInCacheFresh = false

export const LEGACY_BADGE_TIERS_KEY = `${STORAGE_PREFIX}.badge-tiers.v1`
export const LEGACY_JOURNEY_COMPLETIONS_KEY = `${STORAGE_PREFIX}.journey-completions.v1`

export function setActiveProgressUser(userId: string | null): void {
  if (userId === activeUserId) return
  activeUserId = userId
  signedInCacheFresh = false
  if (!userId) return
  try {
    localStorage.removeItem(LEGACY_BADGE_TIERS_KEY)
    localStorage.removeItem(LEGACY_JOURNEY_COMPLETIONS_KEY)
  } catch {
    // Private mode. The server copy is still the authority once sync runs.
  }
}

export function activeProgressUserId(): string | null {
  return activeUserId
}

export function signedInProgressCacheIsFresh(): boolean {
  return activeUserId == null || signedInCacheFresh
}

export function markSignedInProgressCacheFresh(): void {
  signedInCacheFresh = true
}

export function badgeTiersStorageKey(userId: string | null = activeUserId): string {
  return userId ? `${LEGACY_BADGE_TIERS_KEY}.${userId}` : LEGACY_BADGE_TIERS_KEY
}

export function journeyCompletionsStorageKey(userId: string | null = activeUserId): string {
  return userId
    ? `${LEGACY_JOURNEY_COMPLETIONS_KEY}.${userId}`
    : LEGACY_JOURNEY_COMPLETIONS_KEY
}
