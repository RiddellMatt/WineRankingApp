import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityFeed } from './ActivityFeed'
import { Avatar } from './Avatar'
import { WinePassport } from './WinePassport'
import {
  fetchFriendActivity,
  ownRecentActivity,
  type ActivityEvent,
} from '../lib/activityFeed'
import {
  fetchFriendships,
  findProfileByEmail,
  friendDisplayLabel,
  removeFriendship,
  respondToRequest,
  sendFriendRequest,
  type Friendship,
} from '../lib/friendsDb'
import type { RankingPreference, Wine } from '../types'

interface Props {
  userId: string
  userEmail?: string
  userDisplayName?: string
  userAvatarUrl?: string
  wines: Wine[]
  rankingPreference: RankingPreference
  onViewCellar: (friendId: string, friendName: string, avatarUrl?: string) => void
  onSaveToWishlist?: (wine: Wine, friendName: string) => void | Promise<void>
  isWishlistSaved?: (wine: Pick<Wine, 'name' | 'winery' | 'vintage'>) => boolean
  savingWishlistKey?: string | null
}

type FriendsTab = 'feed' | 'passport' | 'manage'

function FriendIdentity({
  friendship,
  userId,
  fallbackLabel,
}: {
  friendship: Friendship
  userId: string
  fallbackLabel?: string
}) {
  const name = friendDisplayLabel(friendship.friend, fallbackLabel ?? 'Someone')
  const friend = friendship.friend
  const otherId =
    friend?.id ??
    (friendship.requesterId === userId ? friendship.addresseeId : friendship.requesterId)

  return (
    <div className="friends-row-main">
      <Avatar
        displayName={name}
        email={friend?.email}
        avatarUrl={friend?.avatarUrl}
        seed={otherId}
        size="sm"
      />
      <div className="friends-identity">
        <span className="friends-name">{name}</span>
        {friend?.email && <span className="friends-email">{friend.email}</span>}
      </div>
    </div>
  )
}

export function FriendsPanel({
  userId,
  userEmail = '',
  userDisplayName = '',
  userAvatarUrl,
  wines,
  rankingPreference,
  onViewCellar,
  onSaveToWishlist,
  isWishlistSaved,
  savingWishlistKey = null,
}: Props) {
  const [tab, setTab] = useState<FriendsTab>('feed')
  const [friendships, setFriendships] = useState<Friendship[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [activityLoading, setActivityLoading] = useState(false)
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

  const friends = useMemo(
    () => friendships.filter((f) => f.status === 'accepted'),
    [friendships],
  )
  const friendIds = useMemo(
    () =>
      friends.map(
        (f) => f.friend?.id ?? (f.requesterId === userId ? f.addresseeId : f.requesterId),
      ),
    [friends, userId],
  )

  const loadActivity = useCallback(async () => {
    if (friendIds.length === 0) {
      setActivity(
        ownRecentActivity(userId, userDisplayName, userEmail, userAvatarUrl, wines, 10),
      )
      return
    }
    setActivityLoading(true)
    try {
      const events = await fetchFriendActivity(friendIds, 30)
      setActivity(events)
    } catch (e) {
      setError(String((e as Error).message ?? e))
      setActivity([])
    } finally {
      setActivityLoading(false)
    }
  }, [friendIds, userId, userDisplayName, userEmail, userAvatarUrl, wines])

  useEffect(() => {
    loadActivity().catch(() => {
      // error handled in loadActivity
    })
  }, [loadActivity])

  const incoming = friendships.filter(
    (f) => f.status === 'pending' && f.addresseeId === userId,
  )
  const outgoing = friendships.filter(
    (f) => f.status === 'pending' && f.requesterId === userId,
  )

  const feedEmptyHint =
    friendIds.length === 0
      ? 'Add a friend to see what they’re drinking — or log a wine to see your own activity here.'
      : 'Your friends haven’t logged or saved any wines yet.'

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
      <section className="friends-tabs" aria-label="Friends views">
        <button
          type="button"
          className={`friends-tab ${tab === 'feed' ? 'active' : ''}`}
          onClick={() => setTab('feed')}
        >
          Feed
        </button>
        <button
          type="button"
          className={`friends-tab ${tab === 'passport' ? 'active' : ''}`}
          onClick={() => setTab('passport')}
        >
          Passport
        </button>
        <button
          type="button"
          className={`friends-tab ${tab === 'manage' ? 'active' : ''}`}
          onClick={() => setTab('manage')}
        >
          Friends
          {incoming.length > 0 && (
            <span className="friends-tab-badge">{incoming.length}</span>
          )}
        </button>
      </section>

      {tab === 'feed' ? (
        <section className="friends-section">
          <h2>Recent activity</h2>
          <p className="friends-hint">
            Logs and want-to-try saves from your friends
            {friendIds.length === 0 ? ' (showing yours until you add friends)' : ''}.
          </p>
          <ActivityFeed
            events={activity}
            viewerId={userId}
            rankingPreference={rankingPreference}
            loading={activityLoading}
            emptyHint={feedEmptyHint}
            onViewCellar={onViewCellar}
            onSaveToWishlist={onSaveToWishlist}
            isWishlistSaved={isWishlistSaved}
            savingWishlistKey={savingWishlistKey}
          />
        </section>
      ) : tab === 'passport' ? (
        <section className="friends-section">
          <h2>Wine passport</h2>
          <p className="friends-hint">
            Where your wines come from, where you drank them, and how you compare with friends.
          </p>
          <WinePassport userId={userId} wines={wines} />
        </section>
      ) : (
        <>
          <section className="friends-add">
            <h2>Add a friend</h2>
            <p className="friends-hint">
              Enter their account email — they must have signed up too.
            </p>
            <div className="friends-add-row">
              <input
                type="email"
                placeholder="friend@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                className="btn primary"
                disabled={busy || !email.trim()}
                onClick={handleAddFriend}
              >
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
                    <FriendIdentity friendship={f} userId={userId} />
                    <div className="friends-row-actions">
                      <button
                        className="btn primary small"
                        onClick={() => handleRespond(f.id, 'accepted')}
                      >
                        Accept
                      </button>
                      <button
                        className="btn ghost small"
                        onClick={() => handleRespond(f.id, 'declined')}
                      >
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
                    <FriendIdentity friendship={f} userId={userId} fallbackLabel="Pending" />
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
                  const name = friendDisplayLabel(f.friend, 'Friend')
                  const friendId =
                    f.friend?.id ?? (f.requesterId === userId ? f.addresseeId : f.requesterId)
                  return (
                    <li className="friends-row" key={f.id}>
                      <FriendIdentity friendship={f} userId={userId} fallbackLabel="Friend" />
                      <div className="friends-row-actions">
                        <button
                          className="btn primary small"
                          onClick={() => onViewCellar(friendId, name, f.friend?.avatarUrl)}
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
        </>
      )}

      {tab === 'feed' && error && <p className="form-error">{error}</p>}
    </div>
  )
}
