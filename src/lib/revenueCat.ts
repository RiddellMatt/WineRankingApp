import { LOG_LEVEL, Purchases } from '@revenuecat/purchases-capacitor'
import type { CustomerInfo, PurchasesPackage } from '@revenuecat/purchases-capacitor'
import { syncRevenueCatEntitlement } from './iapApi'
import {
  APPLE_SUBSCRIPTIONS_URL,
  isIosStoreKitConfigured,
  revenueCatEntitlementId,
  revenueCatIosApiKey,
} from './iapConfig'
import { openExternalUrl } from './openUrl'
import { nativePlatform } from './platform'

let configured = false
let configurePromise: Promise<void> | null = null

function isUserCancelled(error: unknown): boolean {
  const e = error as { code?: string | number; userCancelled?: boolean }
  if (e.userCancelled) return true
  const code = String(e.code ?? '')
  return code === '1' || code === 'PURCHASE_CANCELLED_ERROR'
}

async function ensureConfigured(): Promise<void> {
  if (!isIosStoreKitConfigured()) {
    throw new Error('In-app purchases are not configured on this build.')
  }
  if (configured) return
  if (configurePromise) return configurePromise

  configurePromise = (async () => {
    const apiKey = revenueCatIosApiKey()!
    await Purchases.setLogLevel({ level: import.meta.env.DEV ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO })
    await Purchases.configure({ apiKey })
    configured = true
  })()

  try {
    await configurePromise
  } catch (err) {
    configurePromise = null
    throw err
  }
}

function entitlementActive(info: CustomerInfo): boolean {
  const id = revenueCatEntitlementId()
  const ent = info.entitlements.active[id]
  return Boolean(ent?.isActive)
}

async function pickMonthlyPackage(): Promise<PurchasesPackage> {
  const offerings = await Purchases.getOfferings()
  const current = offerings.current
  if (!current) {
    throw new Error('No subscription offering is available yet. Try again later.')
  }
  const monthly =
    current.monthly ??
    current.availablePackages.find((p: PurchasesPackage) => p.packageType === 'MONTHLY') ??
    current.availablePackages[0]
  if (!monthly) {
    throw new Error('No subscription package found. Check RevenueCat offerings.')
  }
  return monthly
}

/** Call after Supabase sign-in so purchases attach to the same user id as webhooks. */
export async function syncRevenueCatUser(userId: string | null): Promise<void> {
  if (!isIosStoreKitConfigured()) return
  await ensureConfigured()
  if (userId) {
    await Purchases.logIn({ appUserID: userId })
  } else if (!(await Purchases.isAnonymous()).isAnonymous) {
    await Purchases.logOut()
  }
}

export async function purchaseDecantiPro(): Promise<void> {
  await ensureConfigured()
  const pkg = await pickMonthlyPackage()
  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg })
    if (!entitlementActive(customerInfo)) {
      throw new Error('Purchase completed but Pro is not active yet. Try Restore purchases.')
    }
    await syncRevenueCatEntitlement()
  } catch (err) {
    if (isUserCancelled(err)) return
    throw err
  }
}

export async function restoreDecantiPro(): Promise<boolean> {
  await ensureConfigured()
  const { customerInfo } = await Purchases.restorePurchases()
  if (!entitlementActive(customerInfo)) return false
  await syncRevenueCatEntitlement()
  return true
}

export async function openAppleSubscriptionManagement(): Promise<void> {
  if (nativePlatform() !== 'ios') return
  await openExternalUrl(APPLE_SUBSCRIPTIONS_URL)
}

export { isIosStoreKitConfigured }
