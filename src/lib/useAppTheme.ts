import { useEffect, useState } from 'react'
import { loadStoredTheme, THEME_CHANGE_EVENT, type AppTheme } from './themes'

/** Reactive theme for components that swap logos or other theme-specific UI. */
export function useAppTheme(): AppTheme {
  const [theme, setTheme] = useState<AppTheme>(() => loadStoredTheme())

  useEffect(() => {
    const onThemeChange = (event: Event) => {
      const next = (event as CustomEvent<AppTheme>).detail
      if (next) setTheme(next)
    }

    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange)
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange)
  }, [])

  return theme
}
