import { APP_ID, APP_SCHEME, APP_STORE_URL, PLAY_STORE_URL } from '../brand.ts'
import { storeRoutingBrowserScript } from './storeRoutingCore.js'

export { openInAppHref, storeLinksForPlatform, storePlatform } from './storeRoutingCore.js'
export type {
  OpenInAppInput,
  StoreChoice,
  StoreListings,
  StorePlatform,
  StorePlatformHints,
} from './storeRoutingCore.js'

/** Listing URLs the share pages are allowed to publish. Empty until the store page is real. */
export const SHARE_APP_STORE_URL = APP_STORE_URL
export const SHARE_PLAY_STORE_URL = PLAY_STORE_URL

export function sharePageRoutingScript(): string {
  return storeRoutingBrowserScript({ scheme: APP_SCHEME, packageId: APP_ID })
}
