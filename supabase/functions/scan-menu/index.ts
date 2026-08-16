import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const MONTHLY_LIMIT = 30
const MAX_IMAGE_CHARS = 6_000_000

const MENU_PROMPT = `You extract wines from restaurant menu photos.

Return ONLY valid JSON matching this schema:
{"wines":[{"vintage":"2020 or NV","name":"producer and wine name","price":"$45 or null","description":"optional menu blurb or null"}]}

Rules:
- Include every wine by the glass or bottle with a price when visible.
- vintage: use "NV" when non-vintage.
- name: combine producer/winery and cuvée; do not include vintage or price in name.
- Ignore food dishes, cocktails, beer, section headers, and footer text.
- For two-column menus, read each column top-to-bottom; do not merge unrelated wines.
- If no wines found, return {"wines":[]}.`

interface AiWine {
  vintage?: string
  name?: string
  price?: string | null
  description?: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Sign in required.', code: 'auth_required' }, 401)
    }

    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) {
      return jsonResponse({ error: 'Menu scan is not configured yet.', code: 'not_configured' }, 503)
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
      return jsonResponse({ error: 'Invalid session.', code: 'auth_required' }, 401)
    }

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('is_pro')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      return jsonResponse({ error: profileError.message }, 500)
    }
    if (!profile?.is_pro) {
      return jsonResponse(
        { error: 'AI menu scan is a Pro feature.', code: 'pro_required' },
        403,
      )
    }

    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)

    const { count, error: countError } = await admin
      .from('menu_scan_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', monthStart.toISOString())

    if (countError) {
      return jsonResponse({ error: countError.message }, 500)
    }
    if ((count ?? 0) >= MONTHLY_LIMIT) {
      return jsonResponse(
        {
          error: `You've used all ${MONTHLY_LIMIT} AI menu scans this month.`,
          code: 'quota_exceeded',
          remaining: 0,
        },
        429,
      )
    }

    const body = await req.json()
    const imageBase64 = String(body.imageBase64 ?? '')
    const mimeType = String(body.mimeType ?? 'image/jpeg')

    if (!imageBase64 || imageBase64.length > MAX_IMAGE_CHARS) {
      return jsonResponse({ error: 'Image is missing or too large.' }, 400)
    }
    if (!mimeType.startsWith('image/')) {
      return jsonResponse({ error: 'File must be an image.' }, 400)
    }

    const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.0-flash'
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: MENU_PROMPT },
                { inline_data: { mime_type: mimeType, data: imageBase64 } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      },
    )

    if (!geminiRes.ok) {
      const detail = await geminiRes.text()
      return jsonResponse({ error: `Vision API failed: ${detail.slice(0, 200)}` }, 502)
    }

    const geminiJson = await geminiRes.json()
    const textPart = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!textPart) {
      return jsonResponse({ error: 'No response from vision model.' }, 502)
    }

    let parsed: { wines?: AiWine[] }
    try {
      parsed = JSON.parse(textPart)
    } catch {
      return jsonResponse({ error: 'Could not parse menu results.' }, 502)
    }

    const wines = (parsed.wines ?? [])
      .map((w) => ({
        vintage: String(w.vintage ?? 'NV').trim() || 'NV',
        name: String(w.name ?? '').trim(),
        price: w.price != null && String(w.price).trim() ? String(w.price).trim() : null,
        description:
          w.description != null && String(w.description).trim()
            ? String(w.description).trim()
            : null,
      }))
      .filter((w) => w.name.length >= 2)

    await admin.from('menu_scan_usage').insert({ user_id: user.id })

    const remaining = MONTHLY_LIMIT - (count ?? 0) - 1

    return jsonResponse({ wines, remaining })
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500)
  }
})
