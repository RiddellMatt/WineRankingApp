import type { Wine } from './types'

/**
 * Monetization settings. Fill these in when the corresponding accounts exist;
 * everything degrades gracefully while they are empty.
 */

/** Free plan cap. Users must upgrade to Pro to log more wines than this. */
export const FREE_WINE_LIMIT = 20

export const PRO_CONFIG = {
  priceLabel: '$3.99/month',
  /**
   * Optional legacy Stripe Payment Link. Prefer signed-in checkout via
   * create-pro-checkout Edge Function when Supabase is configured.
   */
  paymentUrl: '',
}

export const MENU_SCAN_CONFIG = {
  /** Monthly AI menu scans per Pro account (must match scan-menu Edge Function). */
  monthlyLimit: 30,
}

export const SHOP_CONFIG = {
  /** Retailer search URL. `{query}` is replaced with the wine description. */
  urlTemplate: 'https://www.wine-searcher.com/find/{query}',
  /**
   * Affiliate/partner tag appended to every shop link, e.g. '?Xaff=YOUR_ID'.
   * Sign up at https://www.wine-searcher.com/affiliates
   */
  affiliateSuffix: '',
}

export function shopUrl(wine: Wine): string {
  const query = encodeURIComponent(
    [wine.winery, wine.name, wine.vintage ?? ''].filter(Boolean).join(' '),
  )
  return SHOP_CONFIG.urlTemplate.replace('{query}', query) + SHOP_CONFIG.affiliateSuffix
}
