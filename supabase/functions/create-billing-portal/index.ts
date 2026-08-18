import { requireUser } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  mobilePortalReturnUrl,
  readRequestPlatform,
  webPortalReturnUrl,
} from '../_shared/mobileUrls.ts'

function stripeSecret(): string {
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) throw new Error('Stripe is not configured.')
  return key
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const platform = await readRequestPlatform(req)
    const auth = await requireUser(req)
    if (auth instanceof Response) return auth
    const { user, admin } = auth

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      return jsonResponse({ error: profileError.message }, 500)
    }
    if (!profile?.stripe_customer_id) {
      return jsonResponse({ error: 'No billing account found for this user.' }, 400)
    }

    const returnUrl =
      platform === 'mobile' ? mobilePortalReturnUrl() : webPortalReturnUrl()

    const params = new URLSearchParams({
      customer: profile.stripe_customer_id,
      return_url: returnUrl,
    })

    const stripeRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecret()}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })

    const session = await stripeRes.json()
    if (!stripeRes.ok) {
      return jsonResponse(
        { error: session.error?.message ?? 'Could not open billing portal.' },
        502,
      )
    }

    return jsonResponse({ url: session.url })
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500)
  }
})
