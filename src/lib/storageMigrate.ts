import {
  LEGACY_PRO_STORAGE_KEY,
  LEGACY_STORAGE_PREFIX,
  LEGACY_WINE_STORAGE_KEY,
  PRO_STORAGE_KEY,
  STORAGE_PREFIX,
  WINE_STORAGE_KEY,
} from '../brand'

const MIGRATED_FLAG = `${STORAGE_PREFIX}.storage-migrated.v1`

/** Copy legacy localStorage keys so existing installs keep preferences after rebrand. */
export function migrateLegacyStorageKeys(): void {
  try {
    if (localStorage.getItem(MIGRATED_FLAG) === '1') return

    const legacyKeys = [
      `${LEGACY_STORAGE_PREFIX}.ranking-preference`,
      `${LEGACY_STORAGE_PREFIX}.ranking-preference-setup-done`,
      `${LEGACY_STORAGE_PREFIX}.offline-mode`,
      `${LEGACY_STORAGE_PREFIX}.profile-name-prompt`,
      `${LEGACY_STORAGE_PREFIX}.auth.`,
    ]

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue

      if (key.startsWith(`${LEGACY_STORAGE_PREFIX}.auth.`)) {
        const next = key.replace(`${LEGACY_STORAGE_PREFIX}.auth.`, `${STORAGE_PREFIX}.auth.`)
        if (localStorage.getItem(next) == null) {
          localStorage.setItem(next, localStorage.getItem(key)!)
        }
        continue
      }

      if (legacyKeys.includes(key)) {
        const next = key.replace(`${LEGACY_STORAGE_PREFIX}.`, `${STORAGE_PREFIX}.`)
        if (localStorage.getItem(next) == null) {
          localStorage.setItem(next, localStorage.getItem(key)!)
        }
      }
    }

    if (localStorage.getItem(WINE_STORAGE_KEY) == null) {
      const legacyWines = localStorage.getItem(LEGACY_WINE_STORAGE_KEY)
      if (legacyWines != null) localStorage.setItem(WINE_STORAGE_KEY, legacyWines)
    }

    if (localStorage.getItem(PRO_STORAGE_KEY) == null) {
      const legacyPro = localStorage.getItem(LEGACY_PRO_STORAGE_KEY)
      if (legacyPro != null) localStorage.setItem(PRO_STORAGE_KEY, legacyPro)
    }

    localStorage.setItem(MIGRATED_FLAG, '1')
  } catch {
    // localStorage may be unavailable
  }
}
