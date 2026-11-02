import { nativePlatform } from './platform'

/** RevenueCat entitlement identifier (Dashboard → Entitlements). */
export function revenueCatEntitlementId(): string {
  return (import.meta.env.VITE_REVENUECAT_ENTITLEMENT_ID as string | undefined)?.trim() || 'pro'
}

/** Public iOS SDK key (RevenueCat → Project → API keys → Apple). Safe in the client bundle. */
export function revenueCatIosApiKey(): string | undefined {
  const key = (import.meta.env.VITE_REVENUECAT_IOS_API_KEY as string | undefined)?.trim()
  return key || undefined
}

export function isIosStoreKitConfigured(): boolean {
  return nativePlatform() === 'ios' && Boolean(revenueCatIosApiKey())
}

/** App Store Connect subscription product id (must match RevenueCat / ASC). */
export function iosProProductId(): string {
  return (import.meta.env.VITE_IOS_PRO_PRODUCT_ID as string | undefined)?.trim() || 'decanti_pro_monthly'
}

/** Apple subscription management (Settings deep link fallback). */
export const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions'
