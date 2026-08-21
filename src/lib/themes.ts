import { STORAGE_PREFIX } from '../brand'
import { isNativeApp } from './platform'

export type AppTheme = 'classic' | 'navy' | 'light'

export const THEME_STORAGE_KEY = `${STORAGE_PREFIX}.theme`

export const THEME_OPTIONS: {
  id: AppTheme
  label: string
  description: string
  swatches: [string, string, string]
}[] = [
  {
    id: 'classic',
    label: 'Cellar',
    description: 'Deep burgundy with gold accents',
    swatches: ['#12080c', '#c41e3a', '#e8b04b'],
  },
  {
    id: 'navy',
    label: 'Navy',
    description: 'Logo navy with wine-red splash',
    swatches: ['#1a3674', '#8b2d23', '#ffffff'],
  },
  {
    id: 'light',
    label: 'Daylight',
    description: 'White canvas with terracotta',
    swatches: ['#ffffff', '#a35447', '#231f20'],
  },
]

export const THEME_META: Record<AppTheme, string> = {
  classic: '#12080c',
  navy: '#1a3674',
  light: '#ffffff',
}

export function isAppTheme(value: string | null | undefined): value is AppTheme {
  return value === 'classic' || value === 'navy' || value === 'light'
}

export function loadStoredTheme(): AppTheme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (isAppTheme(stored)) return stored
  } catch {
    // ignore
  }
  return 'classic'
}

export function applyTheme(theme: AppTheme): void {
  document.documentElement.dataset.theme = theme

  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', THEME_META[theme])

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // ignore
  }

  if (isNativeApp()) {
    void updateNativeChrome(theme)
  }
}

async function updateNativeChrome(theme: AppTheme): Promise<void> {
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    const color = THEME_META[theme]
    await StatusBar.setStyle({ style: theme === 'light' ? Style.Light : Style.Dark })
    await StatusBar.setBackgroundColor({ color })
  } catch {
    // unavailable in web preview
  }
}

export function initTheme(): AppTheme {
  const theme = loadStoredTheme()
  applyTheme(theme)
  return theme
}
