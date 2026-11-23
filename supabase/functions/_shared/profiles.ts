import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

export async function grantPro(
  admin: SupabaseClient,
  userId: string,
  opts: {
    stripeCustomerId?: string
    stripeSubscriptionId?: string | null
    /** Webhooks for a deleted account should succeed without recreating the profile. */
    allowMissing?: boolean
  } = {},
): Promise<boolean> {
  const patch: Record<string, unknown> = { is_pro: true }
  if (opts.stripeCustomerId) patch.stripe_customer_id = opts.stripeCustomerId
  if (opts.stripeSubscriptionId !== undefined) {
    patch.stripe_subscription_id = opts.stripeSubscriptionId
  }
  const { data, error } = await admin.from('profiles').update(patch).eq('id', userId).select('id')
  if (error) throw error
  if (!data?.length) {
    if (opts.allowMissing) return false
    throw new Error(`No profile row for user ${userId}`)
  }
  return true
}

/**
 * Banked invite days start when paid Pro ends.
 * Keep the day math aligned with endPaidSubscription in src/lib/referrals.ts.
 */
function endPaidProPatch(profile: {
  pro_until?: string | null
  bonus_pro_days?: number | null
}): {
  is_pro: false
  stripe_subscription_id: null
  pro_until?: string
  bonus_pro_days?: number
} {
  const bonus = profile.bonus_pro_days ?? 0
  const patch: {
    is_pro: false
    stripe_subscription_id: null
    pro_until?: string
    bonus_pro_days?: number
  } = {
    is_pro: false,
    stripe_subscription_id: null,
  }
  if (bonus > 0) {
    const existing = profile.pro_until ? Date.parse(profile.pro_until) : Number.NaN
    const base = Math.max(Number.isFinite(existing) ? existing : 0, Date.now())
    patch.pro_until = new Date(base + bonus * 24 * 60 * 60 * 1000).toISOString()
    patch.bonus_pro_days = 0
  }
  return patch
}

async function endPaidPro(
  admin: SupabaseClient,
  column: 'id' | 'stripe_customer_id' | 'stripe_subscription_id',
  value: string,
): Promise<void> {
  const { data, error } = await admin
    .from('profiles')
    .select('id, pro_until, bonus_pro_days')
    .eq(column, value)
    .maybeSingle()

  if (error) {
    if (/pro_until|bonus_pro_days/.test(error.message)) {
      const { error: fallback } = await admin
        .from('profiles')
        .update({ is_pro: false, stripe_subscription_id: null })
        .eq(column, value)
      if (fallback) throw fallback
      return
    }
    throw error
  }
  if (!data?.id) return

  const { error: updateError } = await admin
    .from('profiles')
    .update(endPaidProPatch(data))
    .eq('id', data.id)
  if (updateError) throw updateError
}

export async function revokePro(admin: SupabaseClient, userId: string): Promise<void> {
  await endPaidPro(admin, 'id', userId)
}

/** Revoke Pro when IAP lapses but keep access for active Stripe subscriptions. */
export async function revokeProIfIapOnly(admin: SupabaseClient, userId: string): Promise<void> {
  const { data: profile, error: readError } = await admin
    .from('profiles')
    .select('stripe_subscription_id')
    .eq('id', userId)
    .maybeSingle()
  if (readError) throw readError
  if (profile?.stripe_subscription_id) return
  await endPaidPro(admin, 'id', userId)
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
  await endPaidPro(admin, 'stripe_customer_id', stripeCustomerId)
}

export async function revokeProBySubscription(
  admin: SupabaseClient,
  subscriptionId: string,
): Promise<void> {
  await endPaidPro(admin, 'stripe_subscription_id', subscriptionId)
}

export function subscriptionIsActive(status: string): boolean {
  return status === 'active' || status === 'trialing'
}
