import { getSupabase, type ProfileRow } from './supabase'

export interface UserProfile {
  id: string
  displayName: string
  email: string
}

function mapProfile(row: ProfileRow): UserProfile {
  return { id: row.id, displayName: row.display_name, email: row.email }
}

export async function fetchMyProfile(): Promise<UserProfile | null> {
  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user) return null

  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, display_name, email')
    .eq('id', user.id)
    .maybeSingle()
  if (error) throw error
  return data ? mapProfile(data as ProfileRow) : null
}

export async function updateDisplayName(displayName: string): Promise<UserProfile> {
  const trimmed = displayName.trim()
  if (trimmed.length < 2) throw new Error('Display name must be at least 2 characters.')

  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user) throw new Error('Not signed in')

  const { data, error } = await getSupabase()
    .from('profiles')
    .update({ display_name: trimmed })
    .eq('id', user.id)
    .select('id, display_name, email')
    .single()
  if (error) throw error
  return mapProfile(data as ProfileRow)
}
