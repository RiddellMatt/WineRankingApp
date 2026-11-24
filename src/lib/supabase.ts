import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createNativeAuthStorage } from './capacitorAuthStorage'
import { createJwtFutureRetryFetch } from './jwtFutureRetry'
import { getSupabaseEnv, looksLikePlaceholderConfig } from './supabaseConfig'

const { url, anonKey } = getSupabaseEnv()

export const isSupabaseConfigured =
  Boolean(url && anonKey) && !looksLikePlaceholderConfig(url, anonKey)

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }
  if (!client) {
    const nativeStorage = createNativeAuthStorage()
    client = createClient(url!, anonKey!, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        ...(nativeStorage ? { storage: nativeStorage } : {}),
      },
      global: {
        fetch: createJwtFutureRetryFetch(),
      },
    })
  }
  return client
}

export interface ProfileRow {
  id: string
  display_name: string
  email: string
  avatar_url: string | null
  is_pro?: boolean | null
  pro_until?: string | null
  bonus_pro_days?: number | null
  referral_code?: string | null
  referral_status?: string | null
  qualified_referral_count?: number | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  ranking_preference?: string | null
}

export interface WineRow {
  id: string
  user_id: string
  name: string
  winery: string
  vintage: number | null
  type: string
  varietal: string
  region: string
  price: number | null
  rating: number
  rating_enjoyment?: number | null
  rating_value?: number | null
  rating_buy_again?: number | null
  /** 5 = legacy half stars. 10 = quarter steps out of 10. */
  rating_scale?: number | null
  notes: string
  tasting_tags?: string[] | null
  with_friend_ids?: string[] | null
  purchased_at: string
  tried_on?: string | null
  pours?: { triedOn?: string | null; tried_on?: string | null }[] | null
  photo_urls?: string[] | null
  taste: Record<string, number>
  taste_source: string | null
  status?: string | null
  added_at: number
}

export interface FriendshipRow {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
}
