import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

function validCodes(): Set<string> {
  const raw = Deno.env.get('PRO_UNLOCK_CODES') ?? ''
  return new Set(
    raw
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
  )
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

    const body = await req.json().catch(() => ({}))
    const code = String(body.code ?? '').trim().toUpperCase()
    if (!code || !validCodes().has(code)) {
      return jsonResponse({ error: 'That code is not valid.' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { error: updateError } = await admin
      .from('profiles')
      .update({ is_pro: true })
      .eq('id', user.id)

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500)
    }

    return jsonResponse({ ok: true, isPro: true })
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500)
  }
})
