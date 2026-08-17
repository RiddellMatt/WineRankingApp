import { Browser } from '@capacitor/browser'
import { isNativeApp } from './platform'

/** Open Stripe checkout and other external flows in the system browser on native. */
export async function openExternalUrl(url: string): Promise<void> {
  if (isNativeApp()) {
    await Browser.open({ url, presentationStyle: 'popover' })
    return
  }
  window.location.href = url
}
