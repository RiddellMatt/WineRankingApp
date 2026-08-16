import { getSupabase, type ProfileRow } from './supabase'

export const AVATAR_BUCKET = 'avatars'
const MAX_AVATAR_BYTES = 2 * 1024 * 1024

export interface UserProfile {
  id: string
  displayName: string
  email: string
  avatarUrl?: string
}

function mapProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    avatarUrl: row.avatar_url ?? undefined,
  }
}

const PROFILE_COLUMNS = 'id, display_name, email, avatar_url'

export async function fetchMyProfile(): Promise<UserProfile | null> {
  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user) return null

  const { data, error } = await getSupabase()
    .from('profiles')
    .select(PROFILE_COLUMNS)
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
    .select(PROFILE_COLUMNS)
    .single()
  if (error) throw error
  return mapProfile(data as ProfileRow)
}

function avatarExtension(file: File): string {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/gif') return 'gif'
  return 'jpg'
}

export async function uploadAvatar(file: File): Promise<UserProfile> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (JPEG, PNG, WebP, or GIF).')
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error('Image must be under 2 MB.')
  }

  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user) throw new Error('Not signed in')

  const supabase = getSupabase()
  const path = `${user.id}/avatar.${avatarExtension(file)}`

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`

  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', user.id)
    .select(PROFILE_COLUMNS)
    .single()
  if (error) throw error
  return mapProfile(data as ProfileRow)
}

export async function removeAvatar(): Promise<UserProfile> {
  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user) throw new Error('Not signed in')

  const supabase = getSupabase()
  const folder = user.id
  const { data: files } = await supabase.storage.from(AVATAR_BUCKET).list(folder)
  if (files && files.length > 0) {
    const paths = files.map((f) => `${folder}/${f.name}`)
    await supabase.storage.from(AVATAR_BUCKET).remove(paths)
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', user.id)
    .select(PROFILE_COLUMNS)
    .single()
  if (error) throw error
  return mapProfile(data as ProfileRow)
}
