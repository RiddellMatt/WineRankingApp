import { requireUser } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

function stripeSecret(): string {
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) throw new Error('Stripe is not configured.')
  return key
}

function checkoutUrls(): { successUrl: string; cancelUrl: string } {
  const appUrl = Deno.env.get('APP_URL') ?? 'https://riddellmatt.github.io/WineRankingApp/'
  const base = appUrl.endsWith('/') ? appUrl : `${appUrl}/`
  const successUrl = Deno.env.get('STRIPE_SUCCESS_URL') ?? `${base}?checkout=success`
  const cancelUrl = Deno.env.get('STRIPE_CANCEL_URL') ?? `${base}?checkout=cancel`
  return { successUrl, cancelUrl }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const auth = await requireUser(req)
    if (auth instanceof Response) return auth
    const { user, admin } = auth

    const priceId = Deno.env.get('STRIPE_PRICE_ID')
    if (!priceId) {
      return jsonResponse({ error: 'Checkout is not configured yet.' }, 503)
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('is_pro, stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.is_pro) {
      return jsonResponse({ error: 'You already have Cellar Rank Pro.' }, 400)
    }

    const { successUrl, cancelUrl } = checkoutUrls()
    const params = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: successUrl,
      cancel_url: cancelUrl,
      'metadata[supabase_user_id]': user.id,
      'subscription_data[metadata][supabase_user_id]': user.id,
    })

    if (profile?.stripe_customer_id) {
      params.set('customer', profile.stripe_customer_id)
    } else if (user.email) {
      params.set('customer_email', user.email)
    }

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
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
        { error: session.error?.message ?? 'Could not start checkout.' },
        502,
      )
    }

    if (!session.url) {
      return jsonResponse({ error: 'Checkout session missing redirect URL.' }, 502)
    }

    return jsonResponse({ url: session.url })
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500)
  }
})
