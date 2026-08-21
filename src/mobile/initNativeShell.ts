import { App } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { getSupabase } from '../lib/supabase'
import { isNativeApp } from '../lib/platform'
import { completeOAuthFromUrl } from '../lib/mobileOAuth'
import { emitMobileDeepLinkEvent, parseMobileDeepLink } from '../lib/mobileDeepLinks'

async function handleDeepLink(url: string): Promise<void> {
  if (await completeOAuthFromUrl(url)) return
  emitMobileDeepLinkEvent(parseMobileDeepLink(url))
}

async function refreshSession(): Promise<void> {
  await getSupabase().auth.getSession()
}

export async function initNativeShell(): Promise<void> {
  if (!isNativeApp()) return

  document.documentElement.classList.add('native-app')
  document.body.classList.add('native-app')

  try {
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: '#12080c' })
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

  await App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) void refreshSession()
  })

  await SplashScreen.hide()
}
