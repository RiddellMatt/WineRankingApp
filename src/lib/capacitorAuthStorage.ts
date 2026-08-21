import type { SupportedStorage } from '@supabase/supabase-js'
import { STORAGE_PREFIX } from '../brand'
import { isNativeApp } from './platform'

const AUTH_PREFIX = `${STORAGE_PREFIX}.auth.`

/** Native SharedPreferences/UserDefaults — survives WebView reloads and Chrome Custom Tab OAuth. */
export function createNativeAuthStorage(): SupportedStorage | undefined {
  if (!isNativeApp()) return undefined

  return {
    getItem(key: string) {
      return import('@capacitor/preferences').then(({ Preferences }) =>
        Preferences.get({ key: AUTH_PREFIX + key }).then(({ value }) => value),
      )
    },
    setItem(key: string, value: string) {
      return import('@capacitor/preferences').then(({ Preferences }) =>
        Preferences.set({ key: AUTH_PREFIX + key, value }),
      )
    },
    removeItem(key: string) {
      return import('@capacitor/preferences').then(({ Preferences }) =>
        Preferences.remove({ key: AUTH_PREFIX + key }),
      )
    },
  }
}
