import { getSupabase, type ProfileRow } from './supabase'
import {
  isMissingAvatarColumn,
  isMissingProColumn,
  PROFILE_COLUMNS_BASE,
  PROFILE_COLUMNS_FULL,
  PROFILE_COLUMNS_NO_AVATAR,
  PROFILE_COLUMNS_NO_PRO,
} from './profileColumns'

export const AVATAR_BUCKET = 'avatars'
const MAX_AVATAR_BYTES = 2 * 1024 * 1024

export const AVATAR_SETUP_MESSAGE =
  'Profile photos need a one-time database update. In Supabase → SQL Editor, run the script: supabase/migrations/20260816_avatar_storage_fix.sql'

export interface UserProfile {
  id: string
  displayName: string
  email: string
  avatarUrl?: string
  isPro?: boolean
}

export function mapProfileRow(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    avatarUrl: row.avatar_url ?? undefined,
    isPro: row.is_pro ?? undefined,
  }
}

async function selectMyProfileRow() {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { row: null as ProfileRow | null, error: null as Error | null }

  const attempts = [
    PROFILE_COLUMNS_FULL,
    PROFILE_COLUMNS_NO_PRO,
    PROFILE_COLUMNS_NO_AVATAR,
    PROFILE_COLUMNS_BASE,
  ]

  for (const columns of attempts) {
    const result = await supabase.from('profiles').select(columns).eq('id', user.id).maybeSingle()
    if (!result.error) {
      return { row: result.data as ProfileRow | null, error: null }
    }
    if (!isMissingAvatarColumn(result.error) && !isMissingProColumn(result.error)) {
      return { row: null, error: result.error }
    }
  }

  return { row: null, error: new Error('Could not load profile.') }
}

export async function fetchMyProfile(): Promise<UserProfile | null> {
  const { row, error } = await selectMyProfileRow()
  if (error) throw error
  return row ? mapProfileRow(row) : null
}

export async function updateDisplayName(displayName: string): Promise<UserProfile> {
  const trimmed = displayName.trim()
  if (trimmed.length < 2) throw new Error('Display name must be at least 2 characters.')

  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user) throw new Error('Not signed in')

  const supabase = getSupabase()
  let result = await supabase
    .from('profiles')
    .update({ display_name: trimmed })
    .eq('id', user.id)
    .select(PROFILE_COLUMNS_FULL)
    .single()

  if (isMissingAvatarColumn(result.error) || isMissingProColumn(result.error)) {
    result = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', user.id)
      .select(PROFILE_COLUMNS_NO_PRO)
      .single()
  }
  if (isMissingProColumn(result.error)) {
    result = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', user.id)
      .select(PROFILE_COLUMNS_BASE)
      .single()
  }

  if (result.error) throw result.error
  return mapProfileRow(result.data as ProfileRow)
}

function avatarExtension(file: File): string {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/gif') return 'gif'
  return 'jpg'
}

function wrapAvatarSetupError(error: { message: string }): Error {
  const msg = error.message.toLowerCase()
  if (msg.includes('bucket not found') || msg.includes('avatar_url')) {
    return new Error(AVATAR_SETUP_MESSAGE)
  }
  return error instanceof Error ? error : new Error(error.message)
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
  if (uploadError) throw wrapAvatarSetupError(uploadError)

  const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`

  let result = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', user.id)
    .select(PROFILE_COLUMNS_FULL)
    .single()

  if (isMissingProColumn(result.error)) {
    result = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id)
      .select(PROFILE_COLUMNS_NO_PRO)
      .single()
  }

  if (result.error) throw wrapAvatarSetupError(result.error)
  return mapProfileRow(result.data as ProfileRow)
}

export async function removeAvatar(): Promise<UserProfile> {
  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user) throw new Error('Not signed in')

  const supabase = getSupabase()
  const folder = user.id
  const { data: files, error: listError } = await supabase.storage.from(AVATAR_BUCKET).list(folder)
  if (listError) throw wrapAvatarSetupError(listError)

  if (files && files.length > 0) {
    const paths = files.map((f) => `${folder}/${f.name}`)
    const { error: removeError } = await supabase.storage.from(AVATAR_BUCKET).remove(paths)
    if (removeError) throw wrapAvatarSetupError(removeError)
  }

  let result = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', user.id)
    .select(PROFILE_COLUMNS_FULL)
    .single()

  if (isMissingProColumn(result.error)) {
    result = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', user.id)
      .select(PROFILE_COLUMNS_NO_PRO)
      .single()
  }

  if (result.error) throw wrapAvatarSetupError(result.error)
  return mapProfileRow(result.data as ProfileRow)
}

export async function fetchProfilesByIds(ids: string[]): Promise<ProfileRow[]> {
  if (ids.length === 0) return []

  const supabase = getSupabase()
  const attempts = [PROFILE_COLUMNS_FULL, PROFILE_COLUMNS_NO_PRO, PROFILE_COLUMNS_BASE]

  for (const columns of attempts) {
    const result = await supabase.from('profiles').select(columns).in('id', ids)
    if (!result.error) return (result.data ?? []) as unknown as ProfileRow[]
    if (!isMissingAvatarColumn(result.error) && !isMissingProColumn(result.error)) {
      throw result.error
    }
  }

  return []
}
