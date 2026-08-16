import { readFunctionError } from './functionError'
import { getSupabase } from './supabase'

interface RedeemPayload {
  error?: string
  ok?: boolean
}

export async function redeemProOnServer(code: string): Promise<void> {
  const { data, error } = await getSupabase().functions.invoke('redeem-pro', {
    body: { code: code.trim() },
  })

  if (error) {
    const { message } = await readFunctionError(error, data)
    throw new Error(message)
  }

  const payload = (data ?? {}) as RedeemPayload
  if (payload.error) throw new Error(payload.error)
  if (!payload.ok) throw new Error('Could not redeem code.')
}
