import { Capacitor } from '@capacitor/core'
import { STORAGE_PREFIX } from '../brand'
import { isNativeApp } from './platform'

export type AppIconVariant = 'white' | 'red'

/** Must match iOS alternate app icon set name in Assets.xcassets (burgundy “red” theme). */
const IOS_ALTERNATE_RED = 'AppIconNavy'

export const APP_ICON_STORAGE_KEY = `${STORAGE_PREFIX}.app-icon`
export const APP_ICON_CHANGE_EVENT = 'decanti:app-icon-change'

export const APP_ICON_OPTIONS: {
  id: AppIconVariant
  label: string
  description: string
  previewSrc: string
}[] = [
  {
    id: 'white',
    label: 'White',
    description: 'Light home screen icon (default)',
    previewSrc: `${import.meta.env.BASE_URL}brand/app-icon-white-preview.jpg`,
  },
  {
    id: 'red',
    label: 'Red',
    description: 'Burgundy home screen icon (matches Red theme)',
    previewSrc: `${import.meta.env.BASE_URL}brand/app-icon-red-preview.jpg`,
  },
]

export function isAppIconVariant(value: string | null | undefined): value is AppIconVariant {
  return value === 'white' || value === 'red'
}

export function loadStoredAppIcon(): AppIconVariant {
  try {
    const stored = localStorage.getItem(APP_ICON_STORAGE_KEY)
    if (stored === 'navy') return 'red'
    if (isAppIconVariant(stored)) return stored
  } catch {
    // ignore
  }
  return 'white'
}

function updateWebIcons(variant: AppIconVariant): void {
  const suffix = variant === 'red' ? '-navy' : ''
  const touch = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
  if (touch) {
    touch.href = `${import.meta.env.BASE_URL}icons/apple-touch-icon${suffix}.png`
  }
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (icon && icon.href.includes('/icons/')) {
    icon.href = `${import.meta.env.BASE_URL}icons/pwa-192${suffix}.png`
  }
}

async function applyNativeAppIcon(variant: AppIconVariant): Promise<void> {
  if (!isNativeApp()) return
  const { AppIcon } = await import('@capacitor-community/app-icon')
  const platform = Capacitor.getPlatform()

  if (platform === 'ios') {
    if (variant === 'red') {
      await AppIcon.change({ name: IOS_ALTERNATE_RED })
    } else {
      await AppIcon.reset({})
    }
    return
  }

  if (platform === 'android') {
    if (variant === 'red') {
      await AppIcon.change({ name: 'navy', disable: ['white', 'navy'] })
    } else {
      await AppIcon.change({ name: 'white', disable: ['navy'] })
    }
  }
}

export async function applyAppIcon(variant: AppIconVariant): Promise<void> {
  try {
    localStorage.setItem(APP_ICON_STORAGE_KEY, variant)
  } catch {
    // ignore
  }
  updateWebIcons(variant)
  try {
    await applyNativeAppIcon(variant)
  } catch {
    // native icons not configured on this build
  }
  window.dispatchEvent(new CustomEvent(APP_ICON_CHANGE_EVENT, { detail: variant }))
}

export async function initAppIcon(): Promise<AppIconVariant> {
  const variant = loadStoredAppIcon()
  updateWebIcons(variant)
  if (isNativeApp()) {
    try {
      await applyNativeAppIcon(variant)
    } catch {
      // ignore
    }
  }
  return variant
}

export async function isAppIconChangeSupported(): Promise<boolean> {
  if (!isNativeApp()) return false
  try {
    const { AppIcon } = await import('@capacitor-community/app-icon')
    const { value } = await AppIcon.isSupported()
    return value
  } catch {
    return false
  }
}