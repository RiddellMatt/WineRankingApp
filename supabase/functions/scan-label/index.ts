import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const MONTHLY_LIMIT = 30
const MAX_IMAGE_CHARS = 6_000_000

const WINE_TYPES = ['Red', 'White', 'Rosé', 'Sparkling', 'Orange', 'Dessert', 'Fortified'] as const

/** Tried in order when GEMINI_MODEL is unset. Newer keys may 404 on retired 2.x models. */
const MODEL_FALLBACKS = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3-flash-preview',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
] as const

const LABEL_PROMPT = `You extract structured wine data from a bottle label photo.

Return ONLY valid JSON matching this schema:
{"name":"cuvée or wine name","winery":"producer or estate","vintage":2019,"varietal":"grape variety","region":"appellation or region","type":"Red"}

Rules:
- name: the wine or cuvée name without vintage, varietal, region, or winery when those appear separately.
- winery: producer, château, estate, or brand shown on the label. Use null if not visible.
- vintage: 4-digit year as integer, or null for non-vintage (NV).
- varietal: primary grape if shown (e.g. "Cabernet Sauvignon"). null if not visible.
- region: appellation or geographic origin (e.g. "Napa Valley", "Barolo DOCG"). null if not visible.
- type: exactly one of: Red, White, Rosé, Sparkling, Orange, Dessert, Fortified. Infer from varietal or label text when not explicit.
- Ignore barcodes, government warnings, alcohol percentages, volume, and importer boilerplate.
- Labels may be in any language; return names in the original language with correct accents.
- If unreadable, return null fields in valid JSON.`

interface AiLabel {
  name?: string | null
  winery?: string | null
  vintage?: number | string | null
  varietal?: string | null
  region?: string | null
  type?: string | null
}

function modelsToTry(): string[] {
  const configured = Deno.env.get('GEMINI_MODEL')?.trim()
  if (configured) {
    return [configured, ...MODEL_FALLBACKS.filter((m) => m !== configured)]
  }
  return [...MODEL_FALLBACKS]
}

function parseJsonFromModel(text: string): { label?: AiLabel } {
  try {
    return JSON.parse(text)
  } catch {
    // Model may wrap JSON in a markdown fence.
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) {
    try {
      return JSON.parse(fenced[1]!.trim())
    } catch {
      // fall through
    }
  }

  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return JSON.parse(text.slice(start, end + 1))
  }

  throw new Error('Could not parse label results.')
}

function normalizeVintage(raw: unknown): number | null {
  if (raw == null) return null
  const text = String(raw).trim()
  if (!text || /^nv$/i.test(text)) return null
  const n = Number(text)
  const year = new Date().getFullYear()
  if (Number.isInteger(n) && n >= 1950 && n <= year) return n
  return null
}

function normalizeType(raw: unknown): (typeof WINE_TYPES)[number] | null {
  const text = String(raw ?? '').trim()
  if (!text) return null
  if ((WINE_TYPES as readonly string[]).includes(text)) {
    return text as (typeof WINE_TYPES)[number]
  }
  const lower = text.toLowerCase()
  if (lower === 'rose' || lower === 'rosé' || lower === 'rosado') return 'Rosé'
  if (lower.includes('sparkling') || lower === 'champagne' || lower === 'prosecco') return 'Sparkling'
  if (lower.includes('port') || lower.includes('sherry') || lower.includes('fortified')) return 'Fortified'
  if (lower.includes('dessert') || lower.includes('sauternes') || lower.includes('ice wine')) return 'Dessert'
  if (lower.includes('orange')) return 'Orange'
  if (lower.includes('white') || lower.includes('blanc') || lower.includes('bianco')) return 'White'
  if (lower.includes('red') || lower.includes('rouge') || lower.includes('rosso')) return 'Red'
  return null
}

function cleanText(raw: unknown): string | null {
  const text = String(raw ?? '').trim()
  return text.length >= 2 ? text : null
}

async function callGeminiVision(
  apiKey: string,
  mimeType: string,
  imageBase64: string,
): Promise<string> {
  const models = modelsToTry()
  let lastDetail = 'No models responded.'

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 800 * attempt))
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: LABEL_PROMPT },
                  { inline_data: { mime_type: mimeType, data: imageBase64 } },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
            },
          }),
        },
      )

      if (res.ok) {
        const json = await res.json()
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) {
          console.log(`Gemini success via ${model}`)
          return text
        }
        lastDetail = 'No response from vision model.'
        continue
      }

      lastDetail = await res.text()
      console.error(`Gemini ${model} attempt ${attempt + 1}:`, res.status, lastDetail.slice(0, 300))

      if (res.status === 401 || res.status === 403) {
        throw new Error(`Vision API auth failed: ${lastDetail.slice(0, 200)}`)
      }

      if (res.status === 404 || res.status === 503) {
        break
      }

      if (attempt === 1) break
    }
  }

  throw new Error(`Vision API failed: ${lastDetail.slice(0, 200)}`)
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
      return jsonResponse({ error: 'Label scan is not configured yet.', code: 'not_configured' }, 503)
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
        { error: 'AI label scan is a Pro feature.', code: 'pro_required' },
        403,
      )
    }

    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)

    const { count, error: countError } = await admin
      .from('label_scan_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', monthStart.toISOString())

    if (countError) {
      return jsonResponse({ error: countError.message }, 500)
    }
    if ((count ?? 0) >= MONTHLY_LIMIT) {
      return jsonResponse(
        {
          error: `You've used all ${MONTHLY_LIMIT} AI label scans this month.`,
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

    let textPart: string
    try {
      textPart = await callGeminiVision(geminiKey, mimeType, imageBase64)
    } catch (e) {
      return jsonResponse({ error: String(e) }, 502)
    }

    let parsed: { label?: AiLabel } & AiLabel
    try {
      parsed = parseJsonFromModel(textPart)
    } catch {
      return jsonResponse({ error: 'Could not parse label results.' }, 502)
    }

    const raw = parsed.label ?? parsed
    const label = {
      name: cleanText(raw.name),
      winery: cleanText(raw.winery),
      vintage: normalizeVintage(raw.vintage),
      varietal: cleanText(raw.varietal),
      region: cleanText(raw.region),
      type: normalizeType(raw.type),
    }

    if (!label.name && !label.winery && !label.varietal) {
      return jsonResponse(
        { error: 'Could not read anything useful from that label photo.', code: 'no_data' },
        422,
      )
    }

    await admin.from('label_scan_usage').insert({ user_id: user.id })

    const remaining = MONTHLY_LIMIT - (count ?? 0) - 1

    return jsonResponse({ label, remaining })
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500)
  }
})
