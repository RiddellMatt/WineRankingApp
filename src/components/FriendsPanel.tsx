import { useCallback, useEffect, useState } from 'react'
import {
  fetchFriendships,
  findProfileByEmail,
  removeFriendship,
  respondToRequest,
  sendFriendRequest,
  type Friendship,
} from '../lib/friendsDb'

interface Props {
  userId: string
  onViewCellar: (friendId: string, friendName: string) => void
}

export function FriendsPanel({ userId, onViewCellar }: Props) {
  const [friendships, setFriendships] = useState<Friendship[]>([])
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    setFriendships(await fetchFriendships(userId))
  }, [userId])

  useEffect(() => {
    reload().catch((e) => setError(String(e.message ?? e)))
  }, [reload])

  const incoming = friendships.filter(
    (f) => f.status === 'pending' && f.addresseeId === userId,
  )
  const outgoing = friendships.filter(
    (f) => f.status === 'pending' && f.requesterId === userId,
  )
  const friends = friendships.filter((f) => f.status === 'accepted')

  async function handleAddFriend() {
    setError('')
    setInfo('')
    setBusy(true)
    try {
      const profile = await findProfileByEmail(email)
      if (!profile) {
        setError('No account found with that email.')
        return
      }
      const existing = friendships.find(
        (f) =>
          f.friend?.id === profile.id &&
          (f.status === 'pending' || f.status === 'accepted'),
      )
      if (existing) {
        setError('You already have a pending or active friendship with that person.')
        return
      }
      await sendFriendRequest(profile.id)
      setEmail('')
      setInfo(`Friend request sent to ${profile.displayName}.`)
      await reload()
    } catch (e) {
      setError(String((e as Error).message ?? e))
    } finally {
      setBusy(false)
    }
  }

  async function handleRespond(id: string, status: 'accepted' | 'declined') {
    setError('')
    try {
      await respondToRequest(id, status)
      await reload()
    } catch (e) {
      setError(String((e as Error).message ?? e))
    }
  }

  async function handleRemove(id: string) {
    if (!window.confirm('Remove this friendship?')) return
    try {
      await removeFriendship(id)
      await reload()
    } catch (e) {
      setError(String((e as Error).message ?? e))
    }
  }

  return (
    <div className="friends-panel">
      <section className="friends-add">
        <h2>Add a friend</h2>
        <p className="friends-hint">Enter their account email — they must have signed up too.</p>
        <div className="friends-add-row">
          <input
            type="email"
            placeholder="friend@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn primary" disabled={busy || !email.trim()} onClick={handleAddFriend}>
            Send request
          </button>
        </div>
        {info && <p className="auth-info">{info}</p>}
        {error && <p className="form-error">{error}</p>}
      </section>

      {incoming.length > 0 && (
        <section className="friends-section">
          <h3>Requests for you</h3>
          <ul className="friends-list">
            {incoming.map((f) => (
              <li className="friends-row" key={f.id}>
                <span>{f.friend?.displayName ?? f.friend?.email ?? 'Someone'}</span>
                <div className="friends-row-actions">
                  <button className="btn primary small" onClick={() => handleRespond(f.id, 'accepted')}>
                    Accept
                  </button>
                  <button className="btn ghost small" onClick={() => handleRespond(f.id, 'declined')}>
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="friends-section">
          <h3>Pending sent</h3>
          <ul className="friends-list">
            {outgoing.map((f) => (
              <li className="friends-row" key={f.id}>
                <span>{f.friend?.displayName ?? f.friend?.email ?? 'Pending'}</span>
                <button className="btn ghost small" onClick={() => handleRemove(f.id)}>
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="friends-section">
        <h3>Your friends</h3>
        {friends.length === 0 ? (
          <p className="friends-empty">No friends yet — add someone by email above.</p>
        ) : (
          <ul className="friends-list">
            {friends.map((f) => {
              const name = f.friend?.displayName ?? f.friend?.email ?? 'Friend'
              const friendId = f.friend?.id ?? (f.requesterId === userId ? f.addresseeId : f.requesterId)
              return (
                <li className="friends-row" key={f.id}>
                  <span>{name}</span>
                  <div className="friends-row-actions">
                    <button
                      className="btn primary small"
                      onClick={() => onViewCellar(friendId, name)}
                    >
                      View cellar
                    </button>
                    <button className="btn ghost small" onClick={() => handleRemove(f.id)}>
                      Remove
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
