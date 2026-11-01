import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { jsonResponse } from '../_shared/cors.ts'
import { grantPro, revokeProIfIapOnly } from '../_shared/profiles.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ENTITLEMENT_ID = Deno.env.get('REVENUECAT_ENTITLEMENT_ID')?.trim() || 'pro'

function webhookAuthOk(req: Request): boolean {
  const expected = Deno.env.get('REVENUECAT_WEBHOOK_AUTHORIZATION')?.trim()
  if (!expected) {
    console.error('REVENUECAT_WEBHOOK_AUTHORIZATION is not set')
    return false
  }
  const header = req.headers.get('Authorization')?.trim()
  return header === expected
}

interface RcWebhookBody {
  event?: {
    type?: string
    app_user_id?: string
    entitlement_ids?: string[] | null
  }
}

const GRANT_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'REFUND_REVERSED',
  'PRODUCT_CHANGE',
  'SUBSCRIPTION_EXTENDED',
])

const REVOKE_EVENTS = new Set(['EXPIRATION'])

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  if (!webhookAuthOk(req)) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const body = (await req.json()) as RcWebhookBody
    const event = body.event
    if (!event?.type || !event.app_user_id) {
      return jsonResponse({ ok: true, skipped: 'missing event fields' })
    }

    const userId = event.app_user_id
    const entitlements = event.entitlement_ids ?? []
    const affectsPro =
      entitlements.length === 0 || entitlements.includes(ENTITLEMENT_ID)

    if (!affectsPro) {
      return jsonResponse({ ok: true, skipped: 'other entitlement' })
    }

    const admin = createClient(supabaseUrl, serviceKey)

    if (GRANT_EVENTS.has(event.type)) {
      await grantPro(admin, userId)
      console.log(`RevenueCat ${event.type}: granted Pro for ${userId}`)
    } else if (REVOKE_EVENTS.has(event.type)) {
      await revokeProIfIapOnly(admin, userId)
      console.log(`RevenueCat ${event.type}: revoked Pro (IAP-only) for ${userId}`)
    }

    return jsonResponse({ ok: true })
  } catch (err) {
    console.error('revenuecat-webhook error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
