import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const LABEL_FIELDS = ['name', 'winery', 'vintage', 'varietal', 'region', 'type'] as const

type LabelField = (typeof LABEL_FIELDS)[number]

interface Body {
  scanType?: string
  baseline?: Record<string, unknown>
  final?: Record<string, unknown>
}

function normText(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase()
}

function normVintage(raw: unknown): string {
  if (raw == null || raw === '') return ''
  return String(raw).trim()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Sign in required.' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()
    if (userError || !user) {
      return jsonResponse({ error: 'Invalid session.' }, 401)
    }

    const body = (await req.json()) as Body
    if (body.scanType !== 'label') {
      return jsonResponse({ ok: true, skipped: true })
    }

    const baseline = body.baseline ?? {}
    const final = body.final ?? {}
    const changed: LabelField[] = []

    for (const field of LABEL_FIELDS) {
      const a =
        field === 'vintage'
          ? normVintage(baseline[field])
          : normText(baseline[field])
      const b =
        field === 'vintage' ? normVintage(final[field]) : normText(final[field])
      if (a && a !== b) {
        changed.push(field)
      }
    }

    if (changed.length === 0) {
      return jsonResponse({ ok: true, changed: [] })
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { error } = await admin.from('ai_scan_corrections').insert({
      user_id: user.id,
      scan_type: 'label',
      changed_fields: changed,
    })
    if (error) {
      console.warn('[ai_scan_corrections]', error.message)
    }

    return jsonResponse({ ok: true, changed })
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500)
  }
})