import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityFeed } from './ActivityFeed'
import { Avatar } from './Avatar'
import {
  applyReactionToggle,
  attachReactionsToEvents,
  toggleActivityReaction,
  toggleMilestoneReaction,
  type ReactionType,
} from '../lib/activityReactions'
import {
  fetchFriendActivity,
  socialActivityCaption,
  withoutOwnActivity,
  type ActivityEvent,
  type WineActivityEventType,
} from '../lib/activityFeed'
import { blockUser, listMyBlocks, unblockUser, type BlockedPerson } from '../lib/blocksDb'
import {
  fetchFriendships,
  findProfileByEmail,
  friendDisplayLabel,
  removeFriendship,
  respondToRequest,
  sendFriendRequest,
  type Friendship,
} from '../lib/friendsDb'
import { requestNotificationsRefresh } from '../lib/notificationsRefresh'
import type { RankingPreference, Wine } from '../types'

interface Props {
  userId: string
  rankingPreference: RankingPreference
  onViewCellar: (friendId: string, friendName: string, avatarUrl?: string) => void
  onSaveToWishlist?: (wine: Wine, friendName: string) => void | Promise<void>
  isWishlistSaved?: (wine: Pick<Wine, 'name' | 'winery' | 'vintage'>) => boolean
  savingWishlistKey?: string | null
  onFriendshipsChanged?: (friendCount: number) => void
  requestedTab?: FriendsTab | null
  onRequestedTabHandled?: () => void
}

type FriendsTab = 'feed' | 'manage'

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
  rankingPreference,
  onViewCellar,
  onSaveToWishlist,
  isWishlistSaved,
  savingWishlistKey = null,
  onFriendshipsChanged,
  requestedTab = null,
  onRequestedTabHandled,
}: Props) {
  const [tab, setTab] = useState<FriendsTab>('feed')
  const [friendships, setFriendships] = useState<Friendship[]>([])
  const [blocked, setBlocked] = useState<BlockedPerson[]>([])
  const [friendshipsLoaded, setFriendshipsLoaded] = useState(false)
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [togglingReactionKey, setTogglingReactionKey] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    const [rows, blocks] = await Promise.all([fetchFriendships(userId), listMyBlocks()])
    setFriendships(rows)
    setBlocked(blocks)
    const count = rows.filter((f) => f.status === 'accepted').length
    onFriendshipsChanged?.(count)
    setFriendshipsLoaded(true)
  }, [userId, onFriendshipsChanged])

  useEffect(() => {
    reload().catch((e) => setError(String(e.message ?? e)))
  }, [reload])

  useEffect(() => {
    if (!requestedTab) return
    setTab(requestedTab)
    onRequestedTabHandled?.()
  }, [requestedTab, onRequestedTabHandled])

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
    if (!friendshipsLoaded) {
      setActivity([])
      setActivityLoading(true)
      return
    }
    if (friendIds.length === 0) {
      setActivity([])
      setActivityLoading(false)
      return
    }
    setActivity([])
    setActivityLoading(true)
    try {
      const events = await fetchFriendActivity(friendIds, 30)
      const withReactions = await attachReactionsToEvents(events, userId)
      setActivity(withoutOwnActivity(withReactions, userId))
    } catch (e) {
      setError(String((e as Error).message ?? e))
      setActivity([])
    } finally {
      setActivityLoading(false)
    }
  }, [
    friendshipsLoaded,
    friendIds,
    userId,
  ])

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

  const feedEmptyHint = !friendshipsLoaded
    ? 'Loading activity…'
    : friendIds.length === 0
      ? 'Add a friend to see activity here.'
      : 'No friend activity yet.'

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

  async function handleBlock(friendId: string, name: string) {
    if (
      !window.confirm(
        `Block ${name}? They disappear from your friends, feed, and notifications until you unblock them.`,
      )
    ) {
      return
    }
    setError('')
    setInfo('')
    try {
      await blockUser(friendId)
      requestNotificationsRefresh()
      await reload()
      setInfo(`${name} is blocked.`)
    } catch (e) {
      setError(String((e as Error).message ?? e))
    }
  }

  async function handleUnblock(person: BlockedPerson) {
    setError('')
    setInfo('')
    try {
      await unblockUser(person.id)
      requestNotificationsRefresh()
      await reload()
      setInfo(`${person.displayName} is unblocked.`)
    } catch (e) {
      setError(String((e as Error).message ?? e))
    }
  }

  async function handleToggleReaction(event: ActivityEvent, reaction: ReactionType) {
    const isMilestone =
      event.type === 'badge_unlock' || event.type === 'journey_complete'
    if (!event.wine && !isMilestone) return
    setError('')
    const previous = activity
    setTogglingReactionKey(event.id)
    setActivity(applyReactionToggle(activity, event.id, reaction))
    try {
      if (isMilestone) {
        await toggleMilestoneReaction({
          targetUserId: event.actor.id,
          milestoneEventId: event.id,
          reaction,
          currentReaction: event.reactions?.myReaction ?? null,
        })
      } else {
        await toggleActivityReaction({
          targetUserId: event.actor.id,
          wineId: event.wine!.id,
          eventType: event.type as WineActivityEventType,
          reaction,
          currentReaction: event.reactions?.myReaction ?? null,
        })
      }
      requestNotificationsRefresh()
    } catch (e) {
      setActivity(previous)
      setError(String((e as Error).message ?? e))
    } finally {
      setTogglingReactionKey(null)
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
          <p className="friends-hint">{socialActivityCaption(friendshipsLoaded)}</p>
          <ActivityFeed
            events={activity}
            viewerId={userId}
            rankingPreference={rankingPreference}
            loading={activityLoading}
            emptyHint={feedEmptyHint}
            reactionsEnabled={friendIds.length > 0}
            onViewCellar={onViewCellar}
            onSaveToWishlist={onSaveToWishlist}
            isWishlistSaved={isWishlistSaved}
            savingWishlistKey={savingWishlistKey}
            onToggleReaction={handleToggleReaction}
            togglingReactionKey={togglingReactionKey}
          />
        </section>
      ) : (
        <>
          <section className="friends-add">
            <h2>Add a friend</h2>
            <p className="friends-hint">Invite with their Decanti sign-in email.</p>
            <div className="friends-add-row">
              <input
                type="email"
                placeholder="friend@example.com"
                value={email}
                enterKeyHint="send"
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddFriend()
                  }
                }}
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
                        <button className="btn ghost small" onClick={() => handleBlock(friendId, name)}>
                          Block
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

          <section className="friends-section">
            <h3>Blocked</h3>
            {blocked.length === 0 ? (
              <p className="friends-empty">No one is blocked.</p>
            ) : (
              <ul className="friends-list">
                {blocked.map((person) => (
                  <li className="friends-row" key={person.id}>
                    <div className="friends-row-main">
                      <Avatar
                        displayName={person.displayName}
                        avatarUrl={person.avatarUrl}
                        seed={person.id}
                        size="sm"
                      />
                      <div className="friends-identity">
                        <span className="friends-name">{person.displayName}</span>
                      </div>
                    </div>
                    <button className="btn ghost small" onClick={() => void handleUnblock(person)}>
                      Unblock
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {tab === 'feed' && error && <p className="form-error">{error}</p>}
    </div>
  )
}
