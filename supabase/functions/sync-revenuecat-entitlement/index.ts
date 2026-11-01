import { requireUser } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { grantPro, revokeProIfIapOnly } from '../_shared/profiles.ts'

const ENTITLEMENT_ID = Deno.env.get('REVENUECAT_ENTITLEMENT_ID')?.trim() || 'pro'

function revenueCatSecretKey(): string {
  const key = Deno.env.get('REVENUECAT_SECRET_API_KEY')
  if (!key) throw new Error('RevenueCat server API is not configured.')
  return key
}

interface RcEntitlement {
  expires_date: string | null
  grace_period_expires_date?: string | null
  product_identifier?: string
}

interface RcSubscriberResponse {
  subscriber?: {
    entitlements?: Record<string, RcEntitlement>
  }
}

function entitlementIsActive(ent: RcEntitlement | undefined): boolean {
  if (!ent) return false
  const expires = ent.expires_date
  if (!expires) return true
  return Date.parse(expires) > Date.now()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const auth = await requireUser(req)
    if (auth instanceof Response) return auth
    const { user, admin } = auth

    const rcRes = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`,
      {
        headers: {
          Authorization: `Bearer ${revenueCatSecretKey()}`,
          'Content-Type': 'application/json',
        },
      },
    )

    if (rcRes.status === 404) {
      await revokeProIfIapOnly(admin, user.id)
      return jsonResponse({ synced: true, isPro: false })
    }

    if (!rcRes.ok) {
      const text = await rcRes.text()
      console.error('RevenueCat subscriber fetch failed:', rcRes.status, text)
      return jsonResponse({ error: 'Could not verify subscription status.' }, 502)
    }

    const body = (await rcRes.json()) as RcSubscriberResponse
    const ent = body.subscriber?.entitlements?.[ENTITLEMENT_ID]
    const active = entitlementIsActive(ent)

    if (active) {
      await grantPro(admin, user.id)
      return jsonResponse({ synced: true, isPro: true })
    }

    await revokeProIfIapOnly(admin, user.id)
    return jsonResponse({ synced: true, isPro: false })
  } catch (err) {
    console.error(err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
