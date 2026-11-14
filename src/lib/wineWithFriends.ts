import type { ActivityEvent } from './activityFeed'
import type { Wine } from '../types'
import { friendDisplayLabel, type FriendProfile } from './friendsDb'

export const MAX_WITH_FRIENDS = 8

export function normalizeWithFriendIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))].slice(
    0,
    MAX_WITH_FRIENDS,
  )
}

/** "With Alex" / "With Alex and Jordan" / "With Alex, Jordan, and Sam" */
export function formatWithFriendsNames(
  wine: Pick<Wine, 'withFriendIds'>,
  nameById: Map<string, string>,
): string | null {
  const ids = wine.withFriendIds ?? []
  if (ids.length === 0) return null
  const names = ids.map((id) => nameById.get(id) ?? 'a friend')
  if (names.length === 1) return `With ${names[0]}`
  if (names.length === 2) return `With ${names[0]} and ${names[1]}`
  return `With ${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

export function friendNameMapFromProfiles(profiles: FriendProfile[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const p of profiles) {
    map.set(p.id, friendDisplayLabel(p))
  }
  return map
}

export function enrichActivityWithFriends(
  events: ActivityEvent[],
  profiles: Map<string, FriendProfile>,
): ActivityEvent[] {
  return events.map((event) => {
    const ids = event.wine?.withFriendIds ?? []
    if (ids.length === 0) return event
    const withFriends = ids.map((id) => profiles.get(id)).filter((p): p is FriendProfile => Boolean(p))
    if (withFriends.length === 0) return event
    return { ...event, withFriends }
  })
}

export function activityWithFriendsClause(
  withFriends: FriendProfile[] | undefined,
  viewerId: string,
): string | null {
  if (!withFriends?.length) return null
  const names = withFriends.map((f) =>
    f.id === viewerId ? 'you' : friendDisplayLabel(f),
  )
  if (names.length === 1) return `with ${names[0]}`
  if (names.length === 2) return `with ${names[0]} and ${names[1]}`
  return `with ${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}