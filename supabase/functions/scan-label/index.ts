import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { callGeminiVision } from '../_shared/geminiVision.ts'
import { recordScanEvent } from '../_shared/scanMetrics.ts'
import { assertProAndScanQuota, ScanPreflightError } from '../_shared/scanPreflight.ts'
import { deleteScanUpload, resolveScanImageFromBody } from '../_shared/scanImage.ts'

const MONTHLY_LIMIT = 30
const MAX_IMAGE_CHARS = 6_000_000

const WINE_TYPES = ['Red', 'White', 'Rosé', 'Sparkling', 'Orange', 'Dessert', 'Fortified'] as const

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

function inferTypeFromVarietal(varietal: string): (typeof WINE_TYPES)[number] | null {
  const lower = varietal.toLowerCase()
  if (
    lower.includes('cabernet') ||
    lower.includes('merlot') ||
    lower.includes('pinot noir') ||
    lower.includes('syrah') ||
    lower.includes('shiraz') ||
    lower.includes('malbec') ||
    lower.includes('sangiovese') ||
    lower.includes('nebbiolo') ||
    lower.includes('tempranillo') ||
    lower.includes('zinfandel')
  ) {
    return 'Red'
  }
  if (
    lower.includes('chardonnay') ||
    lower.includes('sauvignon blanc') ||
    lower.includes('riesling') ||
    lower.includes('pinot grigio') ||
    lower.includes('pinot gris') ||
    lower.includes('viognier')
  ) {
    return 'White'
  }
  if (lower.includes('rosé') || lower.includes('rosado')) return 'Rosé'
  if (lower.includes('prosecco') || lower.includes('champagne')) return 'Sparkling'
  return null
}

function cleanText(raw: unknown): string | null {
  const text = String(raw ?? '').trim()
  return text.length >= 2 ? text : null
}

function countLabelFields(label: Record<string, unknown>): number {
  return ['name', 'winery', 'vintage', 'varietal', 'region', 'type'].filter((k) => label[k] != null).length
}

function approxImageBytes(base64Length: number): number {
  return Math.max(0, Math.floor((base64Length * 3) / 4))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const requestStarted = Date.now()
  let userId: string | null = null
  let admin: ReturnType<typeof createClient> | null = null
  const metrics: {
    durationMsPreflight?: number
    durationMsImage?: number
    durationMsGemini?: number
    model?: string
    fallbackAttempts?: number
    imageBytes?: number
    fieldsExtracted?: number
    errorCode?: string
  } = {}

  async function flushMetrics(status: 'success' | 'no_data' | 'error') {
    if (!admin || !userId) return
    await recordScanEvent(admin, {
      userId,
      scanType: 'label',
      status,
      model: metrics.model,
      fallbackAttempts: metrics.fallbackAttempts,
      durationMsTotal: Date.now() - requestStarted,
      durationMsPreflight: metrics.durationMsPreflight,
      durationMsImage: metrics.durationMsImage,
      durationMsGemini: metrics.durationMsGemini,
      imageBytes: metrics.imageBytes,
      fieldsExtracted: metrics.fieldsExtracted,
      errorCode: metrics.errorCode ?? null,
    })
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
    userId = user.id
    admin = createClient(supabaseUrl, serviceKey)

    const body = await req.json()
    const preflightStart = Date.now()

    let quotaCount = 0
    let imageBase64: string
    let mimeType: string
    let cleanupPath: string | undefined

    try {
      const [quota, resolved] = await Promise.all([
        assertProAndScanQuota(
          admin,
          user.id,
          'label_scan_usage',
          MONTHLY_LIMIT,
          'pro_required',
          'quota_exceeded',
        ),
        resolveScanImageFromBody(admin, user.id, body),
      ])
      quotaCount = quota.count
      imageBase64 = resolved.imageBase64
      mimeType = resolved.mimeType
      cleanupPath = resolved.cleanupPath
      metrics.durationMsPreflight = Date.now() - preflightStart
      metrics.durationMsImage = Date.now() - preflightStart
      metrics.imageBytes = approxImageBytes(imageBase64.length)
    } catch (e) {
      if (e instanceof ScanPreflightError) {
        metrics.errorCode = e.code
        metrics.durationMsPreflight = Date.now() - preflightStart
        await flushMetrics('error')
        if (e.code === 'pro_required') {
          return jsonResponse(
            { error: 'AI label scan is a Pro feature.', code: 'pro_required' },
            403,
          )
        }
        return jsonResponse(
          {
            error: `You've used all ${MONTHLY_LIMIT} AI label scans this month.`,
            code: 'quota_exceeded',
            remaining: 0,
          },
          429,
        )
      }
      await flushMetrics('error')
      return jsonResponse({ error: String(e) }, 400)
    }

    if (!imageBase64 || imageBase64.length > MAX_IMAGE_CHARS) {
      await deleteScanUpload(admin, cleanupPath)
      metrics.errorCode = 'image_too_large'
      await flushMetrics('error')
      return jsonResponse({ error: 'Image is missing or too large.' }, 400)
    }
    if (!mimeType.startsWith('image/')) {
      await deleteScanUpload(admin, cleanupPath)
      metrics.errorCode = 'bad_mime'
      await flushMetrics('error')
      return jsonResponse({ error: 'File must be an image.' }, 400)
    }

    let vision
    try {
      vision = await callGeminiVision(geminiKey, mimeType, imageBase64, LABEL_PROMPT)
      metrics.model = vision.model
      metrics.fallbackAttempts = Math.max(0, vision.attempts - 1)
      metrics.durationMsGemini = vision.durationMs
    } catch (e) {
      metrics.errorCode = 'gemini_failed'
      await flushMetrics('error')
      return jsonResponse({ error: String(e) }, 502)
    } finally {
      await deleteScanUpload(admin, cleanupPath)
    }

    let parsed: { label?: AiLabel } & AiLabel
    try {
      parsed = parseJsonFromModel(vision.text)
    } catch {
      metrics.errorCode = 'parse_failed'
      await flushMetrics('error')
      return jsonResponse({ error: 'Could not parse label results.' }, 502)
    }

    const raw = parsed.label ?? parsed
    let type = normalizeType(raw.type)
    const varietal = cleanText(raw.varietal)
    if (!type && varietal) {
      type = inferTypeFromVarietal(varietal)
    }

    const label = {
      name: cleanText(raw.name),
      winery: cleanText(raw.winery),
      vintage: normalizeVintage(raw.vintage),
      varietal,
      region: cleanText(raw.region),
      type,
    }

    metrics.fieldsExtracted = countLabelFields(label)

    if (!label.name && !label.winery && !label.varietal) {
      metrics.errorCode = 'no_data'
      await flushMetrics('no_data')
      return jsonResponse(
        { error: 'Could not read anything useful from that label photo.', code: 'no_data' },
        422,
      )
    }

    await admin.from('label_scan_usage').insert({ user_id: user.id })

    const remaining = MONTHLY_LIMIT - quotaCount - 1
    await flushMetrics('success')

    return jsonResponse({ label, remaining })
  } catch (e) {
    metrics.errorCode = 'unexpected'
    await flushMetrics('error')
    return jsonResponse({ error: String(e) }, 500)
  }
})