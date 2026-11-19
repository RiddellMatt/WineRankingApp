export type PurchasePath = 'storekit' | 'unavailable' | 'external'

/**
 * iOS digital subscriptions go through StoreKit. A build without the RevenueCat
 * key must not open Stripe or any other external checkout.
 */
export function purchasePath(
  platform: 'ios' | 'android' | 'web',
  storeKitConfigured: boolean,
): PurchasePath {
  if (platform === 'ios') return storeKitConfigured ? 'storekit' : 'unavailable'
  return 'external'
}
