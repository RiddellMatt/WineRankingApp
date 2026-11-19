import { Capacitor } from '@capacitor/core'

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

export function nativePlatform(): 'ios' | 'android' | 'web' {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web'
}

/** Wine-Searcher stays on web and Android. iOS hides it for App Review. */
export function showsShopLink(platform: 'ios' | 'android' | 'web' = nativePlatform()): boolean {
  return platform !== 'ios'
}
