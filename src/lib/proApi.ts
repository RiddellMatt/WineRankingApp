import { getSupabase } from './supabase'

interface RedeemPayload {
  error?: string
  ok?: boolean
}

export async function redeemProOnServer(code: string): Promise<void> {
  const { data, error } = await getSupabase().functions.invoke('redeem-pro', {
    body: { code: code.trim() },
  })

  const payload = (data ?? {}) as RedeemPayload
  if (payload.error) throw new Error(payload.error)
  if (error) throw new Error(error.message)
  if (!payload.ok) throw new Error('Could not redeem code.')
}
