import { STORAGE_PREFIX } from '../brand'

const SHOP_AGE_KEY = `${STORAGE_PREFIX}.shop-age-ok.v1`

export type ShopTap = 'follow-link' | 'confirm' | 'open'

let confirmedThisSession = false

export function hasShopAgeConfirmation(): boolean {
  if (confirmedThisSession) return true
  try {
    return localStorage.getItem(SHOP_AGE_KEY) === 'yes'
  } catch {
    return false
  }
}

export function confirmShopAge(): void {
  confirmedThisSession = true
  try {
    localStorage.setItem(SHOP_AGE_KEY, 'yes')
  } catch {
    // The in-memory flag still covers this session.
  }
}

/** Web and Android follow the link. iOS asks once, then opens the retailer search. */
export function shopTapAction(
  platform: 'ios' | 'android' | 'web',
  confirmed: boolean,
): ShopTap {
  if (platform !== 'ios') return 'follow-link'
  return confirmed ? 'open' : 'confirm'
}
