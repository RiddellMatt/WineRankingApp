/**
 * Monetization settings. Fill these in when the corresponding accounts exist;
 * everything degrades gracefully while they are empty.
 */

/** Free plan cap. Users must upgrade to Pro to log more wines than this. */
export const FREE_WINE_LIMIT = 20

/** Free wishlist cap. Pro unlocks unlimited wishlist + save-from-menu. */
export const FREE_WISHLIST_LIMIT = 5

export const PRO_CONFIG = {
  /** Fallback when StoreKit/RevenueCat price is unavailable (web Stripe checkout). */
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

export const LABEL_SCAN_CONFIG = {
  /** Monthly AI label scans per Pro account (must match scan-label Edge Function). */
  monthlyLimit: 30,
}

export const SHOP_CONFIG = {
  /** Retailer search URL. `{query}` is replaced with the wine description. */
  urlTemplate: 'https://www.wine-searcher.com/find/{query}',
  /**
   * Optional fallback when `VITE_WINE_SEARCHER_AFFILIATE_ID` is unset.
   * Bare id (`abc`) or a full suffix (`?Xaff=abc`).
   * Wine-Searcher invites affiliates after a site sends them traffic:
   * https://www.wine-searcher.com/trade/wine-link
   */
  affiliateSuffix: '',
}
