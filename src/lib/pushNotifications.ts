import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { getSupabase } from './supabase'
import { isNativeApp } from './platform'
import { parseFriendsDeepLink } from './mobileDeepLinks'

type PlatformToken = 'ios' | 'android'

let startedForUser: string | null = null
let lastToken: string | null = null
let handles: PluginListenerHandle[] = []

async function registerTokenWithServer(token: string, platform: PlatformToken): Promise<void> {
  lastToken = token
  const { error } = await getSupabase().functions.invoke('register-push-token', {
    body: { token, platform },
  })
  if (error) {
    console.warn('register-push-token failed', error)
  }
}

async function removeTokenFromServer(token: string | null): Promise<void> {
  if (!token) return
  await getSupabase().functions.invoke('register-push-token', {
    body: { token, remove: true },
  })
}

export const PUSH_NAV_EVENT = 'decanti:push-navigate'

function emitPushNavigation(tab: 'feed' | 'manage'): void {
  window.dispatchEvent(new CustomEvent(PUSH_NAV_EVENT, { detail: { tab } }))
}

function handleNotificationAction(data: Record<string, unknown> | undefined): void {
  const deepLink = typeof data?.deepLink === 'string' ? data.deepLink : ''
  const tab = parseFriendsDeepLink(deepLink)
  if (tab) emitPushNavigation(tab)
}

/**
 * Register for iOS (APNs) and Android (FCM) push. No-op on web/PWA.
 */
export async function startPushNotifications(userId: string): Promise<void> {
  if (!isNativeApp() || !Capacitor.isNativePlatform()) return
  if (startedForUser === userId) return

  await stopPushNotifications()
  startedForUser = userId

  const platform: PlatformToken = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'

  let perm = await PushNotifications.checkPermissions()
  if (perm.receive === 'prompt') {
    perm = await PushNotifications.requestPermissions()
  }
  if (perm.receive !== 'granted') {
    startedForUser = null
    return
  }

  handles.push(
    await PushNotifications.addListener('registration', (ev) => {
      void registerTokenWithServer(ev.value, platform)
    }),
  )

  handles.push(
    await PushNotifications.addListener('registrationError', (err) => {
      console.warn('Push registration error', err)
    }),
  )

  handles.push(
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      handleNotificationAction(action.notification.data as Record<string, unknown>)
    }),
  )

  handles.push(
    await PushNotifications.addListener('pushNotificationReceived', (n) => {
      if (Capacitor.getPlatform() === 'android') {
        handleNotificationAction(n.data as Record<string, unknown>)
      }
    }),
  )

  await PushNotifications.register()
}

export async function stopPushNotifications(): Promise<void> {
  const token = lastToken
  lastToken = null
  startedForUser = null
  for (const h of handles) {
    await h.remove()
  }
  handles = []
  if (token) {
    await removeTokenFromServer(token)
  }
}
