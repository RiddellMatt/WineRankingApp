import { Avatar } from './Avatar'
import { friendDisplayLabel, type FriendProfile } from '../lib/friendsDb'
import { MAX_WITH_FRIENDS } from '../lib/wineWithFriends'

interface Props {
  friends: FriendProfile[]
  selected: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

export function WithFriendsPicker({ friends, selected, onChange, disabled }: Props) {
  if (friends.length === 0) {
    return (
      <p className="with-friends-hint muted">
        Add friends on the Social tab to tag who you drank with.
      </p>
    )
  }

  function toggle(id: string) {
    if (disabled) return
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id))
      return
    }
    if (selected.length >= MAX_WITH_FRIENDS) return
    onChange([...selected, id])
  }

  return (
    <div className="with-friends-picker">
      <p className="with-friends-hint">
        Tap friends you tried this with — they&apos;ll get a heads-up in Social.
      </p>
      <ul className="with-friends-chips">
        {friends.map((friend) => {
          const active = selected.includes(friend.id)
          const name = friendDisplayLabel(friend)
          return (
            <li key={friend.id}>
              <button
                type="button"
                className={`with-friends-chip ${active ? 'active' : ''}`}
                disabled={disabled || (!active && selected.length >= MAX_WITH_FRIENDS)}
                aria-pressed={active}
                onClick={() => toggle(friend.id)}
              >
                <Avatar
                  displayName={name}
                  email={friend.email}
                  avatarUrl={friend.avatarUrl}
                  seed={friend.id}
                  size="sm"
                />
                <span>{name}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}