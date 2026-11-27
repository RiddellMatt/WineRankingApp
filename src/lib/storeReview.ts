import { isNativeApp } from './platform'
import { shouldRequestStoreReview } from './storeReviewPrompt'

const ASKED_KEY = 'decanti.store-review-asked'

function alreadyAsked(): boolean {
  try {
    return localStorage.getItem(ASKED_KEY) === '1'
  } catch {
    return false
  }
}

function markAsked(): void {
  try {
    localStorage.setItem(ASKED_KEY, '1')
  } catch {
    // The prompt can run again next time. That is rarer than a storage failure.
  }
}

/**
 * iOS uses SKStoreReviewController. Android uses the Play In-App Review API.
 * Both no-op on the web, and both can no-op when the store listing is not live yet.
 */
export async function maybeRequestStoreReview(input: {
  ratedCount: number
  journeyCompleted: boolean
}): Promise<void> {
  if (!isNativeApp()) return
  if (!shouldRequestStoreReview({ ...input, alreadyAsked: alreadyAsked() })) return
  markAsked()
  try {
    const { InAppReview } = await import('@capacitor-community/in-app-review')
    await InAppReview.requestReview()
  } catch {
    // A missing store listing or an uninstalled plugin should not block the save.
  }
}
