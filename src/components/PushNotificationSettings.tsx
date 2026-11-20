import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_PUSH_PREFS,
  fetchPushNotificationPrefs,
  savePushNotificationPrefs,
  type PushNotificationPrefs,
} from '../lib/pushPrefs'
import { isNativeApp } from '../lib/platform'
import { SettingsCommitBar } from './SettingsCommitBar'

interface Props {
  userId: string
  signedIn: boolean
  cloudConfigured: boolean
}

function samePrefs(a: PushNotificationPrefs, b: PushNotificationPrefs): boolean {
  return (
    a.enabled === b.enabled &&
    a.friend_requests === b.friend_requests &&
    a.friend_accepted === b.friend_accepted &&
    a.reactions === b.reactions &&
    a.friend_milestones === b.friend_milestones
  )
}

export function PushNotificationSettings({ userId, signedIn, cloudConfigured }: Props) {
  const native = isNativeApp()
  const [savedPrefs, setSavedPrefs] = useState<PushNotificationPrefs>(DEFAULT_PUSH_PREFS)
  const [draft, setDraft] = useState<PushNotificationPrefs>(DEFAULT_PUSH_PREFS)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const saveLock = useRef(false)

  useEffect(() => {
    if (!native || !signedIn || !cloudConfigured) return
    let cancelled = false
    setLoading(true)
    fetchPushNotificationPrefs(userId)
      .then((next) => {
        if (cancelled) return
        setSavedPrefs(next)
        setDraft(next)
      })
      .catch((e) => {
        if (!cancelled) setError(String((e as Error).message ?? e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [native, signedIn, cloudConfigured, userId])

  if (!native || !signedIn || !cloudConfigured) return null

  const dirty = !samePrefs(draft, savedPrefs)

  function update<K extends keyof PushNotificationPrefs>(key: K, value: boolean) {
    setError('')
    setSaved(false)
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function cancel() {
    setDraft(savedPrefs)
    setError('')
    setSaved(false)
  }

  async function save() {
    if (!dirty || saveLock.current) return
    saveLock.current = true
    setError('')
    setSaved(false)
    setBusy(true)
    try {
      await savePushNotificationPrefs(userId, draft)
      setSavedPrefs(draft)
      setSaved(true)
    } catch (e) {
      setError(String((e as Error).message ?? e))
    } finally {
      saveLock.current = false
      setBusy(false)
    }
  }

  return (
    <section className="account-section push-settings" aria-labelledby="push-settings-title">
      <h3 id="push-settings-title">Push notifications</h3>
      <p className="account-hint">Choose what reaches your lock screen.</p>
      {loading && <p className="auth-info">Loading…</p>}
      <ul className="push-settings-list">
        <li>
          <label className="push-settings-row">
            <input
              type="checkbox"
              checked={draft.enabled}
              disabled={loading || busy}
              onChange={(e) => update('enabled', e.target.checked)}
            />
            <span>Allow push notifications</span>
          </label>
        </li>
        <li>
          <label className="push-settings-row">
            <input
              type="checkbox"
              checked={draft.friend_requests}
              disabled={loading || busy || !draft.enabled}
              onChange={(e) => update('friend_requests', e.target.checked)}
            />
            <span>Friend requests</span>
          </label>
        </li>
        <li>
          <label className="push-settings-row">
            <input
              type="checkbox"
              checked={draft.friend_accepted}
              disabled={loading || busy || !draft.enabled}
              onChange={(e) => update('friend_accepted', e.target.checked)}
            />
            <span>Request accepted</span>
          </label>
        </li>
        <li>
          <label className="push-settings-row">
            <input
              type="checkbox"
              checked={draft.reactions}
              disabled={loading || busy || !draft.enabled}
              onChange={(e) => update('reactions', e.target.checked)}
            />
            <span>Reactions on your wines</span>
          </label>
        </li>
        <li>
          <label className="push-settings-row">
            <input
              type="checkbox"
              checked={draft.friend_milestones}
              disabled={loading || busy || !draft.enabled}
              onChange={(e) => update('friend_milestones', e.target.checked)}
            />
            <span>Friend badges &amp; journeys</span>
          </label>
        </li>
      </ul>
      <SettingsCommitBar
        hint="Save changes to update these."
        dirty={dirty}
        busy={busy || loading}
        saved={saved}
        error={error}
        onSave={() => void save()}
        onCancel={cancel}
      />
    </section>
  )
}
