export type StorePlatform = 'ios' | 'android' | 'desktop'

export interface StorePlatformHints {
  maxTouchPoints?: number
}

export interface StoreListings {
  appStoreUrl?: string | null
  playStoreUrl?: string | null
}

export interface StoreChoice {
  appStoreUrl: string | null
  playStoreUrl: string | null
}

export interface OpenInAppInput {
  platform: StorePlatform
  referralCode?: string | null
  webUrl?: string | null
  playStoreUrl?: string | null
  scheme?: string
  packageId?: string
}

export function storePlatform(userAgent: string, hints?: StorePlatformHints): StorePlatform

export function storeLinksForPlatform(platform: StorePlatform, listings: StoreListings): StoreChoice

export function openInAppHref(input: OpenInAppInput): string

export function storeRoutingBrowserScript(config?: {
  scheme?: string
  packageId?: string
}): string
