import {
  LEGACY_PRO_STORAGE_KEY,
  LEGACY_WINE_STORAGE_KEY,
  PRO_STORAGE_KEY,
  STORAGE_PREFIX,
  WINE_STORAGE_KEY,
} from '../brand'

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

export function clearLocalAccountData(): void {
  for (const key of LOCAL_ACCOUNT_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      // Private mode or a blocked storage API.
    }
  }
  try {
    sessionStorage.removeItem(PROFILE_PROMPT_KEY)
  } catch {
    // ignore
  }
}
