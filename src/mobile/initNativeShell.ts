import { App } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { getSupabase } from '../lib/supabase'
import { isNativeApp } from '../lib/platform'
import {
  emitMobileDeepLinkEvent,
  MOBILE_AUTH_REDIRECT,
  parseMobileDeepLink,
} from '../lib/mobileDeepLinks'

async function handleDeepLink(url: string): Promise<void> {
  const kind = parseMobileDeepLink(url)
  if (kind === 'auth' || url.startsWith(MOBILE_AUTH_REDIRECT)) {
    const { error } = await getSupabase().auth.exchangeCodeForSession(url)
    if (error) console.error('OAuth deep link failed:', error.message)
    return
  }
  emitMobileDeepLinkEvent(kind)
}

export async function initNativeShell(): Promise<void> {
  if (!isNativeApp()) return

  document.documentElement.classList.add('native-app')
  document.body.classList.add('native-app')

  try {
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: '#16090d' })
  } catch {
    // Status bar plugin is unavailable in some web previews.
  }

  const launch = await App.getLaunchUrl()
  if (launch?.url) {
    await handleDeepLink(launch.url)
  }

  await App.addListener('appUrlOpen', ({ url }) => {
    void handleDeepLink(url)
  })

  await SplashScreen.hide()
}
