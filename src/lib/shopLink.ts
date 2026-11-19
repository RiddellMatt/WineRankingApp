import { SHOP_CONFIG } from '../config'

/** A bottle we can look up. Vintage may be a year or a menu-scan string. */
export type ShopTarget = {
  name: string
  winery?: string
  vintage?: number | string | null
}

/**
 * Wine-Searcher credits affiliates with `?Xaff=`. Accept a bare id or a full
 * suffix (`?Xaff=abc` / `&Xaff=abc`) so a mistaken paste still works.
 */
export function normalizeAffiliateSuffix(raw: string | undefined | null): string {
  const value = raw?.trim() ?? ''
  if (!value) return ''
  if (value.startsWith('?') || value.startsWith('&')) {
    return value.startsWith('&') ? `?${value.slice(1)}` : value
  }
  return `?Xaff=${encodeURIComponent(value)}`
}

export function resolveAffiliateSuffix(): string {
  const fromEnv = import.meta.env.VITE_WINE_SEARCHER_AFFILIATE_ID as string | undefined
  const normalized = normalizeAffiliateSuffix(fromEnv)
  if (normalized) return normalized
  return normalizeAffiliateSuffix(SHOP_CONFIG.affiliateSuffix)
}

export function shopLinksAreAffiliate(): boolean {
  return resolveAffiliateSuffix() !== ''
}

export function shopSearchText(target: ShopTarget): string {
  return [target.winery, target.name, target.vintage ?? ''].filter(Boolean).join(' ').trim()
}

export function buildShopUrl(target: ShopTarget, suffix: string): string {
  const query = encodeURIComponent(shopSearchText(target))
  const base = SHOP_CONFIG.urlTemplate.replace('{query}', query)
  if (!suffix) return base
  if (suffix.startsWith('?') && base.includes('?')) return `${base}&${suffix.slice(1)}`
  if (suffix.startsWith('&') && !base.includes('?')) return `${base}?${suffix.slice(1)}`
  return base + suffix
}

export function shopUrl(target: ShopTarget): string {
  return buildShopUrl(target, resolveAffiliateSuffix())
}
