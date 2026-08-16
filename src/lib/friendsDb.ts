import { getSupabase, type FriendshipRow, type ProfileRow } from './supabase'

export interface FriendProfile {
  id: string
  displayName: string
  email: string
}

export interface Friendship {
  id: string
  requesterId: string
  addresseeId: string
  status: FriendshipRow['status']
  createdAt: string
  /** The other person in the relationship (not the current user). */
  friend?: FriendProfile
}

function mapProfile(row: ProfileRow): FriendProfile {
  return { id: row.id, displayName: row.display_name, email: row.email }
}

export async function findProfileByEmail(email: string): Promise<FriendProfile | null> {
  const { data, error } = await getSupabase().rpc('find_profile_by_email', {
    lookup_email: email.trim(),
  })
  if (error) throw error
  const row = (data as ProfileRow[] | null)?.[0]
  return row ? mapProfile(row) : null
}

export async function fetchFriendships(userId: string): Promise<Friendship[]> {
  const { data, error } = await getSupabase()
    .from('friendships')
    .select('*')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order('created_at', { ascending: false })
  if (error) throw error

  const rows = data as FriendshipRow[]
  const otherIds = [
    ...new Set(rows.map((r) => (r.requester_id === userId ? r.addressee_id : r.requester_id))),
  ]

  let profiles = new Map<string, FriendProfile>()
  if (otherIds.length > 0) {
    const { data: profileRows, error: profileError } = await getSupabase()
      .from('profiles')
      .select('id, display_name, email')
      .in('id', otherIds)
    if (profileError) throw profileError
    for (const p of profileRows as ProfileRow[]) {
      profiles.set(p.id, mapProfile(p))
    }
  }

  return rows.map((r) => {
    const otherId = r.requester_id === userId ? r.addressee_id : r.requester_id
    return {
      id: r.id,
      requesterId: r.requester_id,
      addresseeId: r.addressee_id,
      status: r.status,
      createdAt: r.created_at,
      friend: profiles.get(otherId),
    }
  })
}

export async function sendFriendRequest(addresseeId: string): Promise<void> {
  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user) throw new Error('Not signed in')
  const { error } = await getSupabase().from('friendships').insert({
    requester_id: user.id,
    addressee_id: addresseeId,
    status: 'pending',
  })
  if (error) throw error
}

export async function respondToRequest(
  friendshipId: string,
  status: 'accepted' | 'declined',
): Promise<void> {
  const { error } = await getSupabase()
    .from('friendships')
    .update({ status })
    .eq('id', friendshipId)
  if (error) throw error
}

export async function removeFriendship(friendshipId: string): Promise<void> {
  const { error } = await getSupabase().from('friendships').delete().eq('id', friendshipId)
  if (error) throw error
}

export async function fetchProfile(userId: string): Promise<FriendProfile | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, display_name, email')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data ? mapProfile(data as ProfileRow) : null
}
