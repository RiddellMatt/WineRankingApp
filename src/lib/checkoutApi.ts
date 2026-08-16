import { readFunctionError } from './functionError'
import { getSupabase } from './supabase'

interface CheckoutPayload {
  url?: string
  error?: string
}

async function readCheckoutUrl(
  invoke: () => ReturnType<ReturnType<typeof getSupabase>['functions']['invoke']>,
): Promise<string> {
  const { data, error } = await invoke()
  if (error) {
    const { message } = await readFunctionError(error, data)
    throw new Error(message)
  }
  const payload = (data ?? {}) as CheckoutPayload
  if (payload.error) throw new Error(payload.error)
  if (!payload.url) throw new Error('Redirect URL missing.')
  return payload.url
}

export async function createProCheckout(): Promise<string> {
  return readCheckoutUrl(() => getSupabase().functions.invoke('create-pro-checkout'))
}

export async function createBillingPortal(): Promise<string> {
  return readCheckoutUrl(() => getSupabase().functions.invoke('create-billing-portal'))
}
