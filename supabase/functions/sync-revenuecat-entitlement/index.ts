import { requireUser } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { grantPro } from '../_shared/profiles.ts'
import { revenueCatUserHasPro } from '../_shared/revenuecat.ts'

const ENTITLEMENT_ID = Deno.env.get('REVENUECAT_ENTITLEMENT_ID')?.trim() || 'pro'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const auth = await requireUser(req)
    if (auth instanceof Response) return auth
    const { user, admin } = auth

    const active = await revenueCatUserHasPro(user.id, ENTITLEMENT_ID)

    if (active) {
      await grantPro(admin, user.id)
      return jsonResponse({ synced: true, isPro: true })
    }

    // Do not revoke when RevenueCat check returned false — may be API misconfig while Apple still shows Pro.
    return jsonResponse({
      synced: true,
      isPro: false,
      hint: 'RevenueCat reported no active Pro for this Supabase user id. In RevenueCat → Customers, search this user uuid and confirm app_user_id matches.',
    })
  } catch (err) {
    console.error(err)
    const message = String(err)
    if (message.includes('REVENUECAT_PROJECT_ID')) {
      return jsonResponse({ error: message }, 503)
    }
    if (message.includes('No profile row')) {
      return jsonResponse({ error: message }, 404)
    }
    return jsonResponse({ error: 'Could not verify subscription status.' }, 502)
  }
})
