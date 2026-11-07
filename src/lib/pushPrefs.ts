import { getSupabase } from './supabase'

export interface PushNotificationPrefs {
  enabled: boolean
  friend_requests: boolean
  friend_accepted: boolean
  reactions: boolean
  friend_milestones: boolean
}

export const DEFAULT_PUSH_PREFS: PushNotificationPrefs = {
  enabled: true,
  friend_requests: true,
  friend_accepted: true,
  reactions: true,
  friend_milestones: false,
}

function normalizePrefs(raw: unknown): PushNotificationPrefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PUSH_PREFS }
  const o = raw as Record<string, unknown>
  return {
    enabled: o.enabled !== false,
    friend_requests: o.friend_requests !== false,
    friend_accepted: o.friend_accepted !== false,
    reactions: o.reactions !== false,
    friend_milestones: o.friend_milestones === true,
  }
}

export async function fetchPushNotificationPrefs(
  userId: string,
): Promise<PushNotificationPrefs> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('profiles')
    .select('push_notification_prefs')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    if (error.code === '42703' || /push_notification_prefs/i.test(error.message ?? '')) {
      return { ...DEFAULT_PUSH_PREFS }
    }
    throw error
  }

  return normalizePrefs(data?.push_notification_prefs)
}

export async function savePushNotificationPrefs(
  userId: string,
  prefs: PushNotificationPrefs,
): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('profiles')
    .update({ push_notification_prefs: prefs })
    .eq('id', userId)

  if (error) {
    if (error.code === '42703' || /push_notification_prefs/i.test(error.message ?? '')) {
      throw new Error('Push settings need a database update — run the latest Supabase migration.')
    }
    throw error
  }
}
