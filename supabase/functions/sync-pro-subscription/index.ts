import { requireUser } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { grantPro, subscriptionIsActive } from '../_shared/profiles.ts'

function stripeSecret(): string {
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) throw new Error('Stripe is not configured.')
  return key
}

async function stripeGet<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${stripeSecret()}` },
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error?.message ?? `Stripe API error (${res.status})`)
  }
  return json as T
}

interface StripeList<T> {
  data: T[]
}

interface StripeCustomer {
  id: string
}

interface StripeSubscription {
  id: string
  status: string
}

/** Fallback when webhook delivery fails: verify active Stripe sub and grant Pro. */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const auth = await requireUser(req)
    if (auth instanceof Response) return auth
    const { user, admin } = auth

    if (!user.email) {
      return jsonResponse({ error: 'Account email is required.' }, 400)
    }

    const customers = await stripeGet<StripeList<StripeCustomer>>(
      `/customers?email=${encodeURIComponent(user.email)}&limit=1`,
    )
    const customer = customers.data[0]
    if (!customer) {
      return jsonResponse({ isPro: false, synced: false, reason: 'no_customer' })
    }

    const subs = await stripeGet<StripeList<StripeSubscription>>(
      `/subscriptions?customer=${customer.id}&status=all&limit=10`,
    )
    const active = subs.data.find((s) => subscriptionIsActive(s.status))

    if (!active) {
      return jsonResponse({ isPro: false, synced: false, reason: 'no_active_subscription' })
    }

    await grantPro(admin, user.id, {
      stripeCustomerId: customer.id,
      stripeSubscriptionId: active.id,
    })

    return jsonResponse({ isPro: true, synced: true })
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500)
  }
})
