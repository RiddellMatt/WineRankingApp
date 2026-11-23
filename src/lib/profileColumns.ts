import type { PostgrestError } from '@supabase/supabase-js'

export const PROFILE_COLUMNS_WITH_REFERRAL =
  'id, display_name, email, avatar_url, is_pro, pro_until, bonus_pro_days, stripe_customer_id, ranking_preference, referral_code, referral_status, qualified_referral_count'
export const PROFILE_COLUMNS_FULL =
  'id, display_name, email, avatar_url, is_pro, stripe_customer_id, ranking_preference'
export const PROFILE_COLUMNS_NO_RANKING =
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

export function isMissingRankingPreferenceColumn(error: PostgrestError | null): boolean {
  if (!error) return false
  return error.code === '42703' || error.message.includes('ranking_preference')
}

export function isMissingReferralColumn(error: PostgrestError | null): boolean {
  if (!error) return false
  return (
    error.code === '42703' ||
    /pro_until|bonus_pro_days|referral_code|referral_status|qualified_referral_count/.test(
      error.message,
    )
  )
}
