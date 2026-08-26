import { STORAGE_PREFIX } from '../brand'
import { isNativeApp } from './platform'

export type AppTheme = 'classic' | 'navy' | 'light'

export const THEME_STORAGE_KEY = `${STORAGE_PREFIX}.theme`
export const THEME_CHANGE_EVENT = 'decanti:theme-change'

const brandBase = `${import.meta.env.BASE_URL}brand`

export const THEME_OPTIONS: {
  id: AppTheme
  label: string
  description: string
  swatches: [string, string, string]
  previewSrc: string
  logoSrc?: string
}[] = [
  {
    id: 'classic',
    label: 'Cellar',
    description: 'Deep burgundy with gold accents',
    swatches: ['#12080c', '#c41e3a', '#e8b04b'],
    previewSrc: `${brandBase}/theme-preview-classic.svg`,
  },
  {
    id: 'navy',
    label: 'Navy',
    description: 'Logo navy with champagne gold accents',
    swatches: ['#1a3674', '#d4af6a', '#ffffff'],
    previewSrc: `${brandBase}/logo-navy.png`,
    logoSrc: `${brandBase}/logo-navy.png`,
  },
  {
    id: 'light',
    label: 'Daylight',
    description: 'White canvas with terracotta',
    swatches: ['#ffffff', '#a35447', '#231f20'],
    previewSrc: `${brandBase}/logo-light.png`,
    logoSrc: `${brandBase}/logo-light.png`,
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

  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: theme }))
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
