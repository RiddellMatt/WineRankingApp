import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }
  if (!client) {
    client = createClient(url!, anonKey!)
  }
  return client
}

export interface ProfileRow {
  id: string
  display_name: string
  email: string
  avatar_url: string | null
  is_pro?: boolean | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
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
  notes: string
  purchased_at: string
  taste: Record<string, number>
  taste_source: string | null
  added_at: number
}

export interface FriendshipRow {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
}
