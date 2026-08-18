import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

export async function grantPro(
  admin: SupabaseClient,
  userId: string,
  opts: { stripeCustomerId?: string; stripeSubscriptionId?: string | null } = {},
): Promise<void> {
  const patch: Record<string, unknown> = { is_pro: true }
  if (opts.stripeCustomerId) patch.stripe_customer_id = opts.stripeCustomerId
  if (opts.stripeSubscriptionId !== undefined) {
    patch.stripe_subscription_id = opts.stripeSubscriptionId
  }
  const { error } = await admin.from('profiles').update(patch).eq('id', userId)
  if (error) throw error
}

export async function revokePro(admin: SupabaseClient, userId: string): Promise<void> {
  const { error } = await admin
    .from('profiles')
    .update({ is_pro: false, stripe_subscription_id: null })
    .eq('id', userId)
  if (error) throw error
}

export async function grantProByEmail(
  admin: SupabaseClient,
  email: string,
  opts: { stripeCustomerId?: string; stripeSubscriptionId?: string | null } = {},
): Promise<boolean> {
  const trimmed = email.trim()
  if (!trimmed) return false

  const { data: rows, error: findError } = await admin
    .from('profiles')
    .select('id')
    .ilike('email', trimmed)
    .limit(1)

  if (findError) throw findError
  const profile = rows?.[0]
  if (!profile) return false

  await grantPro(admin, profile.id, opts)
  return true
}

export async function grantProByStripeCustomer(
  admin: SupabaseClient,
  stripeCustomerId: string,
  stripeSubscriptionId: string | null,
): Promise<void> {
  const { error } = await admin
    .from('profiles')
    .update({
      is_pro: true,
      stripe_subscription_id: stripeSubscriptionId,
    })
    .eq('stripe_customer_id', stripeCustomerId)
  if (error) throw error
}

export async function revokeProByStripeCustomer(
  admin: SupabaseClient,
  stripeCustomerId: string,
): Promise<void> {
  const { error } = await admin
    .from('profiles')
    .update({ is_pro: false, stripe_subscription_id: null })
    .eq('stripe_customer_id', stripeCustomerId)
  if (error) throw error
}

export async function revokeProBySubscription(
  admin: SupabaseClient,
  subscriptionId: string,
): Promise<void> {
  const { error } = await admin
    .from('profiles')
    .update({ is_pro: false, stripe_subscription_id: null })
    .eq('stripe_subscription_id', subscriptionId)
  if (error) throw error
}

export function subscriptionIsActive(status: string): boolean {
  return status === 'active' || status === 'trialing'
}
