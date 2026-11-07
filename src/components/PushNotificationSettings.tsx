import { useEffect, useState } from 'react'
import {
  DEFAULT_PUSH_PREFS,
  fetchPushNotificationPrefs,
  savePushNotificationPrefs,
  type PushNotificationPrefs,
} from '../lib/pushPrefs'
import { isNativeApp } from '../lib/platform'

interface Props {
  userId: string
  signedIn: boolean
  cloudConfigured: boolean
}

export function PushNotificationSettings({ userId, signedIn, cloudConfigured }: Props) {
  const native = isNativeApp()
  const [prefs, setPrefs] = useState<PushNotificationPrefs>(DEFAULT_PUSH_PREFS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!native || !signedIn || !cloudConfigured) return
    setLoading(true)
    fetchPushNotificationPrefs(userId)
      .then(setPrefs)
      .catch((e) => setError(String((e as Error).message ?? e)))
      .finally(() => setLoading(false))
  }, [native, signedIn, cloudConfigured, userId])

  if (!native || !signedIn || !cloudConfigured) return null

  async function toggle<K extends keyof PushNotificationPrefs>(key: K, value: boolean) {
    setError('')
    setSaved(false)
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    try {
      await savePushNotificationPrefs(userId, next)
      setSaved(true)
    } catch (e) {
      setError(String((e as Error).message ?? e))
      setPrefs(prefs)
    }
  }

  return (
    <section className="account-section push-settings" aria-labelledby="push-settings-title">
      <h3 id="push-settings-title">Push notifications</h3>
      <p className="account-hint">
        iOS and Android only. Uses the same events as the Social bell — tune what reaches your
        lock screen.
      </p>
      {loading && <p className="auth-info">Loading…</p>}
      {error && <p className="form-error">{error}</p>}
      {saved && !error && <p className="auth-info">Saved.</p>}
      <ul className="push-settings-list">
        <li>
          <label className="push-settings-row">
            <input
              type="checkbox"
              checked={prefs.enabled}
              disabled={loading}
              onChange={(e) => void toggle('enabled', e.target.checked)}
            />
            <span>Allow push notifications</span>
          </label>
        </li>
        <li>
          <label className="push-settings-row">
            <input
              type="checkbox"
              checked={prefs.friend_requests}
              disabled={loading || !prefs.enabled}
              onChange={(e) => void toggle('friend_requests', e.target.checked)}
            />
            <span>Friend requests</span>
          </label>
        </li>
        <li>
          <label className="push-settings-row">
            <input
              type="checkbox"
              checked={prefs.friend_accepted}
              disabled={loading || !prefs.enabled}
              onChange={(e) => void toggle('friend_accepted', e.target.checked)}
            />
            <span>Request accepted</span>
          </label>
        </li>
        <li>
          <label className="push-settings-row">
            <input
              type="checkbox"
              checked={prefs.reactions}
              disabled={loading || !prefs.enabled}
              onChange={(e) => void toggle('reactions', e.target.checked)}
            />
            <span>Reactions on your wines</span>
          </label>
        </li>
        <li>
          <label className="push-settings-row">
            <input
              type="checkbox"
              checked={prefs.friend_milestones}
              disabled={loading || !prefs.enabled}
              onChange={(e) => void toggle('friend_milestones', e.target.checked)}
            />
            <span>Friend badges &amp; journeys</span>
          </label>
        </li>
      </ul>
    </section>
  )
}
