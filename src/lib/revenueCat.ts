import { LOG_LEVEL, Purchases } from '@revenuecat/purchases-capacitor'
import type {
  CustomerInfo,
  PurchasesPackage,
  PurchasesStoreProduct,
} from '@revenuecat/purchases-capacitor'
import { syncRevenueCatEntitlement } from './iapApi'
import {
  APPLE_SUBSCRIPTIONS_URL,
  iosProProductId,
  isIosStoreKitConfigured,
  revenueCatEntitlementId,
  revenueCatIosApiKey,
} from './iapConfig'
import { openExternalUrl } from './openUrl'
import { nativePlatform } from './platform'
import { friendlyRevenueCatError } from './revenueCatErrors'

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

const ENTITLEMENT_ALIASES: Record<string, string[]> = {
  pro: ['decanti_pro'],
  decanti_pro: ['pro'],
}

function entitlementActive(info: CustomerInfo): boolean {
  const id = revenueCatEntitlementId()
  const active = info.entitlements.active
  if (active[id]?.isActive) return true
  for (const alias of ENTITLEMENT_ALIASES[id] ?? []) {
    if (active[alias]?.isActive) return true
  }
  return false
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

async function fetchStoreProductById(productId: string): Promise<PurchasesStoreProduct | null> {
  const { products } = await Purchases.getProducts({ productIdentifiers: [productId] })
  return products[0] ?? null
}

function priceLabelFromStoreProduct(product: PurchasesStoreProduct): string | null {
  const price = product.priceString?.trim()
  return price ? `${price}/month` : null
}

export type DecantiProSubscriptionPreview = {
  priceLabel: string | null
  setupHint: string | null
}

/** StoreKit price + setup hint when RevenueCat offerings are misconfigured. */
export async function loadDecantiProSubscriptionPreview(
  supabaseUserId?: string | null,
): Promise<DecantiProSubscriptionPreview> {
  if (!isIosStoreKitConfigured()) {
    return { priceLabel: null, setupHint: null }
  }
  const productId = iosProProductId()
  try {
    await ensureConfigured()
    if (supabaseUserId) {
      await Purchases.logIn({ appUserID: supabaseUserId })
    }

    try {
      const monthly = await pickMonthlyPackage()
      const fromOffering = priceLabelFromStoreProduct(monthly.product)
      if (fromOffering) return { priceLabel: fromOffering, setupHint: null }
    } catch {
      // Offerings misconfigured — fall back to direct StoreKit product fetch.
    }

    const storeProduct = await fetchStoreProductById(productId)
    const fromStore = storeProduct ? priceLabelFromStoreProduct(storeProduct) : null
    if (fromStore) {
      return {
        priceLabel: fromStore,
        setupHint: null,
      }
    }

    return {
      priceLabel: null,
      setupHint: `Could not load ${productId} from the App Store. In RevenueCat, confirm the product is App Store (not Test Store only), In-App Purchase key is set under Apps → iOS, and remove empty Yearly/Lifetime packages from the default offering.`,
    }
  } catch (err) {
    return { priceLabel: null, setupHint: friendlyRevenueCatError(err) }
  }
}

/** @deprecated Prefer loadDecantiProSubscriptionPreview */
export async function fetchDecantiProPriceLabel(): Promise<string | null> {
  const preview = await loadDecantiProSubscriptionPreview()
  return preview.priceLabel
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

export async function purchaseDecantiPro(): Promise<string | undefined> {
  await ensureConfigured()
  const productId = iosProProductId()

  try {
    let customerInfo: CustomerInfo
    try {
      const pkg = await pickMonthlyPackage()
      ;({ customerInfo } = await Purchases.purchasePackage({ aPackage: pkg }))
    } catch (packageErr) {
      const storeProduct = await fetchStoreProductById(productId)
      if (!storeProduct) throw packageErr
      ;({ customerInfo } = await Purchases.purchaseStoreProduct({ product: storeProduct }))
    }

    if (!entitlementActive(customerInfo)) {
      throw new Error('Purchase completed but Pro is not active yet. Try Restore purchases.')
    }

    try {
      await syncRevenueCatEntitlement()
    } catch {
      return (
        'Decanti Pro is active on this device. Account sync failed — tap Restore purchases in a minute. ' +
        'If it persists, add REVENUECAT_PROJECT_ID in Supabase (RevenueCat API v2 secret keys).'
      )
    }
    return undefined
  } catch (err) {
    if (isUserCancelled(err)) return undefined
    throw new Error(friendlyRevenueCatError(err))
  }
}

export type RestoreDecantiProResult = {
  restored: boolean
  /** Pro is active in RevenueCat but Supabase sync failed. */
  syncNote?: string
}

export async function restoreDecantiPro(
  supabaseUserId?: string | null,
): Promise<RestoreDecantiProResult> {
  await ensureConfigured()
  if (supabaseUserId) {
    await Purchases.logIn({ appUserID: supabaseUserId })
  }
  const { customerInfo } = await Purchases.restorePurchases()
  if (!entitlementActive(customerInfo)) {
    return { restored: false }
  }
  try {
    await syncRevenueCatEntitlement()
  } catch {
    return {
      restored: true,
      syncNote:
        'Pro restored on this device. Account sync failed — confirm REVENUECAT_PROJECT_ID is set in Supabase and sync-revenuecat-entitlement is redeployed, then try Restore again.',
    }
  }
  return { restored: true }
}

export async function openAppleSubscriptionManagement(): Promise<void> {
  if (nativePlatform() !== 'ios') return
  await openExternalUrl(APPLE_SUBSCRIPTIONS_URL)
}

export { isIosStoreKitConfigured }
