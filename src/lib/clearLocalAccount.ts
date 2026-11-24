import {
  LEGACY_PRO_STORAGE_KEY,
  LEGACY_WINE_STORAGE_KEY,
  PRO_STORAGE_KEY,
  STORAGE_PREFIX,
  WINE_STORAGE_KEY,
} from '../brand'
import { badgeTiersStorageKey, journeyCompletionsStorageKey } from './progressStorage'

/** On-device copies of the account. Theme, app icon, and the iOS 21+ shop confirmation stay; they are device preferences. */
export const LOCAL_ACCOUNT_KEYS = [
  WINE_STORAGE_KEY,
  LEGACY_WINE_STORAGE_KEY,
  PRO_STORAGE_KEY,
  LEGACY_PRO_STORAGE_KEY,
  `${STORAGE_PREFIX}.badge-tiers.v1`,
  `${STORAGE_PREFIX}.badge-catchup-testing.v1`,
  `${STORAGE_PREFIX}.journey-completions.v1`,
  `${STORAGE_PREFIX}.ranking-preference`,
  `${STORAGE_PREFIX}.ranking-preference-setup-done`,
  `${STORAGE_PREFIX}.custom-tasting-tags`,
  `${STORAGE_PREFIX}.monthly-challenge-join.v1`,
  'cellar-rank.ranking-preference',
  'cellar-rank.ranking-preference-setup-done',
] as const

const PROFILE_PROMPT_KEY = `${STORAGE_PREFIX}.profile-name-prompt`

/** Progress cache only. Pro stays; the server flag is restored on the next profile load. */
const LOCAL_PROGRESS_KEYS = LOCAL_ACCOUNT_KEYS.filter(
  (key) => key !== PRO_STORAGE_KEY && key !== LEGACY_PRO_STORAGE_KEY,
)

function removeKeys(keys: readonly string[]): void {
  for (const key of keys) {
    try {
      localStorage.removeItem(key)
    } catch {
      // Private mode or a blocked storage API.
    }
  }
}

/** Drop cached cellar, badges, journeys, and ranking setup. Keeps Pro and device preferences. */
export function clearLocalProgressData(userId?: string | null): void {
  removeKeys(LOCAL_PROGRESS_KEYS)
  if (!userId) return
  removeKeys([badgeTiersStorageKey(userId), journeyCompletionsStorageKey(userId)])
}

export function clearLocalAccountData(): void {
  removeKeys(LOCAL_ACCOUNT_KEYS)
  try {
    sessionStorage.removeItem(PROFILE_PROMPT_KEY)
  } catch {
    // ignore
  }
}
