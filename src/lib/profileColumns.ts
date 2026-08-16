import type { PostgrestError } from '@supabase/supabase-js'

export const PROFILE_COLUMNS_FULL =
  'id, display_name, email, avatar_url, is_pro, stripe_customer_id'
export const PROFILE_COLUMNS_NO_STRIPE = 'id, display_name, email, avatar_url, is_pro'
export const PROFILE_COLUMNS_NO_PRO = 'id, display_name, email, avatar_url'
export const PROFILE_COLUMNS_NO_AVATAR = 'id, display_name, email, is_pro'
export const PROFILE_COLUMNS_BASE = 'id, display_name, email'

export function isMissingAvatarColumn(error: PostgrestError | null): boolean {
  if (!error) return false
  return error.code === '42703' || error.message.includes('avatar_url')
}

export function isMissingProColumn(error: PostgrestError | null): boolean {
  if (!error) return false
  return error.code === '42703' || error.message.includes('is_pro')
}

export function isMissingStripeColumn(error: PostgrestError | null): boolean {
  if (!error) return false
  return error.code === '42703' || error.message.includes('stripe_customer_id')
}
