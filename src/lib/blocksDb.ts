import { getSupabase } from './supabase'

export interface BlockedPerson {
  id: string
  displayName: string
  avatarUrl?: string
  createdAt: string
}

interface BlockRow {
  blocked_id: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
}

export async function listMyBlocks(): Promise<BlockedPerson[]> {
  const { data, error } = await getSupabase().rpc('list_my_blocks')
  if (error) throw error
  return ((data ?? []) as BlockRow[]).map((row) => ({
    id: row.blocked_id,
    displayName: row.display_name?.trim() || 'Blocked user',
    avatarUrl: row.avatar_url ?? undefined,
    createdAt: row.created_at,
  }))
}

export async function blockUser(blockedId: string): Promise<void> {
  const {
    data: { user },
  } = await getSupabase().auth.getUser()
  if (!user) throw new Error('Not signed in')
  const { error } = await getSupabase().from('user_blocks').insert({
    blocker_id: user.id,
    blocked_id: blockedId,
  })
  if (error) {
    if (error.code === '23505') throw new Error('Already blocked.')
    throw error
  }
}

export async function unblockUser(blockedId: string): Promise<void> {
  const {
    data: { user },
  } = await getSupabase().auth.getUser()
  if (!user) throw new Error('Not signed in')
  const { error } = await getSupabase()
    .from('user_blocks')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', blockedId)
  if (error) throw error
}
