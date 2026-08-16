import { useEffect, useState, type FormEvent } from 'react'
import { updateDisplayName, type UserProfile } from '../lib/profileDb'

interface Props {
  profile: UserProfile
  onSaved: (profile: UserProfile) => void
  onClose: () => void
}

export function ProfileModal({ profile, onSaved, onClose }: Props) {
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setDisplayName(profile.displayName)
  }, [profile.displayName])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const next = await updateDisplayName(displayName)
      onSaved(next)
      onClose()
    } catch (err) {
      setError(String((err as Error).message ?? err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Your profile</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <label className="field">
            <span>Display name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How friends see you"
              minLength={2}
              maxLength={40}
              required
            />
          </label>
          <p className="profile-email">Account: {profile.email}</p>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
