import { readFunctionError } from './functionError'
import { isNativeApp } from './platform'
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

function checkoutBody(): { platform: 'mobile' | 'web' } | undefined {
  return isNativeApp() ? { platform: 'mobile' } : undefined
}

export async function createProCheckout(): Promise<string> {
  const body = checkoutBody()
  return readCheckoutUrl(() =>
    getSupabase().functions.invoke('create-pro-checkout', { body }),
  )
}

export async function createBillingPortal(): Promise<string> {
  const body = checkoutBody()
  return readCheckoutUrl(() =>
    getSupabase().functions.invoke('create-billing-portal', { body }),
  )
}

interface SyncProPayload {
  isPro?: boolean
  synced?: boolean
  reason?: string
  error?: string
}

/** Verify an active Stripe subscription and grant Pro when webhooks lag or fail. */
export async function syncProSubscription(): Promise<SyncProPayload> {
  const { data, error } = await getSupabase().functions.invoke('sync-pro-subscription')
  if (error) {
    const { message } = await readFunctionError(error, data)
    throw new Error(message)
  }
  return (data ?? {}) as SyncProPayload
}
