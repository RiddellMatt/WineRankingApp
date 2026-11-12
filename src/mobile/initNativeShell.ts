import { App } from '@capacitor/app'
import { getSupabase } from '../lib/supabase'
import { hideNativeSplashOnce, initLaunchEpoch } from '../lib/nativeSplash'
import { isNativeApp } from '../lib/platform'
import { initAppIcon } from '../lib/appIcon'
import { loadStoredTheme, THEME_META } from '../lib/themes'
import { completeOAuthFromUrl, listenForOAuthBrowserDismiss } from '../lib/mobileOAuth'
import { emitMobileDeepLinkEvent, parseMobileDeepLink } from '../lib/mobileDeepLinks'
import { StatusBar, Style } from '@capacitor/status-bar'

async function handleDeepLink(url: string): Promise<void> {
  if (await completeOAuthFromUrl(url)) return
  const kind = parseMobileDeepLink(url)
  emitMobileDeepLinkEvent(kind, url)
}

async function refreshSession(): Promise<void> {
  await getSupabase().auth.getSession()
}

export async function initNativeShell(): Promise<void> {
  if (!isNativeApp()) return

  initLaunchEpoch()
  document.documentElement.classList.add('native-app')
  document.body.classList.add('native-app')

  try {
    const theme = loadStoredTheme()
    const color = THEME_META[theme]
    await StatusBar.setStyle({ style: theme === 'light' ? Style.Light : Style.Dark })
    await StatusBar.setBackgroundColor({ color })
  } catch {
    // Status bar plugin is unavailable in some web previews.
  }

  void initAppIcon()

  const launch = await App.getLaunchUrl()
  if (launch?.url) {
    await handleDeepLink(launch.url)
  }

  listenForOAuthBrowserDismiss()

  await App.addListener('appUrlOpen', ({ url }) => {
    void handleDeepLink(url)
  })

  await App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) void refreshSession()
  })

  // Safety net if auth never resolves (App hides splash when loading finishes).
  window.setTimeout(() => {
    void hideNativeSplashOnce()
  }, 12000)
}
