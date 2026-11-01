import { readFunctionError } from './functionError'
import { getSupabase } from './supabase'

interface SyncIapPayload {
  isPro?: boolean
  synced?: boolean
  error?: string
}

/** Ask the server to read RevenueCat entitlements and update profiles.is_pro (post-purchase). */
export async function syncRevenueCatEntitlement(): Promise<SyncIapPayload> {
  const { data, error } = await getSupabase().functions.invoke('sync-revenuecat-entitlement')
  if (error) {
    const { message } = await readFunctionError(error, data)
    throw new Error(message)
  }
  return (data ?? {}) as SyncIapPayload
}
