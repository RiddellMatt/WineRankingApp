import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { loadRecentVisionSamples, saveVisionSamples } from '../_shared/geminiModelHealth.ts'
import { callGeminiVision, rankVisionModels, type VisionAttemptSample } from '../_shared/geminiVision.ts'
import { recordScanEvent } from '../_shared/scanMetrics.ts'
import { assertProAndScanQuota, ScanPreflightError } from '../_shared/scanPreflight.ts'
import { deleteScanUpload, resolveScanImageFromBody } from '../_shared/scanImage.ts'

const MONTHLY_LIMIT = 30
const MAX_IMAGE_CHARS = 6_000_000

const MENU_PROMPT = `You extract wines from restaurant menu photos.

Return ONLY valid JSON matching this schema:
{"wines":[{"vintage":"2020 or NV","winery":"producer/winery name only","name":"wine or cuvée name only","price":"$45 or null","description":"optional menu blurb or null"}]}

Rules:
- Include every wine by the glass or bottle with a price when visible.
- vintage: use "NV" when non-vintage.
- winery: producer or winery ONLY — do not include the cuvée, grape, or appellation here.
- name: wine/cuvée name ONLY — do not repeat the producer; do not include vintage or price.
- If the menu shows "Producer, Wine Name", put them in separate winery and name fields.
- Ignore food dishes, cocktails, beer, section headers, and footer text.
- For two-column menus, read each column top-to-bottom; do not merge unrelated wines.
- If no wines found, return {"wines":[]}.`

interface AiWine {
  vintage?: string
  winery?: string
  name?: string
  price?: string | null
  description?: string | null
}

function parseJsonFromModel(text: string): { wines?: AiWine[] } {
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

  throw new Error('Could not parse menu results.')
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
    winesCount?: number
    errorCode?: string
  } = {}

  async function flushMetrics(status: 'success' | 'no_data' | 'error') {
    if (!admin || !userId) return
    await recordScanEvent(admin, {
      userId,
      scanType: 'menu',
      status,
      model: metrics.model,
      fallbackAttempts: metrics.fallbackAttempts,
      durationMsTotal: Date.now() - requestStarted,
      durationMsPreflight: metrics.durationMsPreflight,
      durationMsImage: metrics.durationMsImage,
      durationMsGemini: metrics.durationMsGemini,
      imageBytes: metrics.imageBytes,
      winesCount: metrics.winesCount,
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
          'menu_scan_usage',
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
            { error: 'AI menu scan is a Pro feature.', code: 'pro_required' },
            403,
          )
        }
        return jsonResponse(
          {
            error: `You've used all ${MONTHLY_LIMIT} AI menu scans this month.`,
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
    const attemptSamples: VisionAttemptSample[] = []
    try {
      const ranked = rankVisionModels({
        configured: Deno.env.get('GEMINI_MODEL'),
        samples: await loadRecentVisionSamples(admin),
      })
      console.log(
        `Vision rank: ${ranked
          .map(
            (entry) =>
              `${entry.model} p=${entry.completion.toFixed(2)} ${Math.round(entry.expectedAttemptMs)}ms${entry.exhausted ? ' tired' : ''}`,
          )
          .join(' | ')}`,
      )
      vision = await callGeminiVision(geminiKey, mimeType, imageBase64, MENU_PROMPT, req.signal, {
        models: ranked.map((entry) => entry.model),
        onSample: (sample) => attemptSamples.push(sample),
      })
      metrics.model = vision.model
      metrics.fallbackAttempts = Math.max(0, vision.attempts - 1)
      metrics.durationMsGemini = vision.durationMs
    } catch (e) {
      if (req.signal.aborted) {
        metrics.errorCode = 'client_aborted'
        await flushMetrics('error')
        return new Response(null, { status: 499 })
      }
      metrics.errorCode = 'gemini_failed'
      await flushMetrics('error')
      const message = e instanceof Error && e.message ? e.message : String(e)
      return jsonResponse({ error: message }, 502)
    } finally {
      await saveVisionSamples(admin, attemptSamples)
      await deleteScanUpload(admin, cleanupPath)
    }

    let parsed: { wines?: AiWine[] }
    try {
      parsed = parseJsonFromModel(vision.text)
    } catch {
      metrics.errorCode = 'parse_failed'
      await flushMetrics('error')
      return jsonResponse({ error: 'Could not parse menu results.' }, 502)
    }

    const wines = (parsed.wines ?? [])
      .map((w) => {
        const name = String(w.name ?? '').trim()
        const winery = String(w.winery ?? '').trim()
        return {
          vintage: String(w.vintage ?? 'NV').trim() || 'NV',
          winery,
          name,
          price: w.price != null && String(w.price).trim() ? String(w.price).trim() : null,
          description:
            w.description != null && String(w.description).trim()
              ? String(w.description).trim()
              : null,
        }
      })
      .filter((w) => w.name.length >= 2 || w.winery.length >= 2)
      .map((w) => (w.name.length >= 2 ? w : { ...w, name: w.winery, winery: '' }))

    metrics.winesCount = wines.length
    const status = wines.length === 0 ? 'no_data' : 'success'
    if (wines.length === 0) {
      metrics.errorCode = 'no_wines'
    }

    if (req.signal.aborted) {
      metrics.errorCode = 'client_aborted'
      await flushMetrics('error')
      return new Response(null, { status: 499 })
    }

    await admin.from('menu_scan_usage').insert({ user_id: user.id })

    const remaining = MONTHLY_LIMIT - quotaCount - 1
    await flushMetrics(status)

    return jsonResponse({ wines, remaining })
  } catch (e) {
    metrics.errorCode = 'unexpected'
    await flushMetrics('error')
    return jsonResponse({ error: String(e) }, 500)
  }
})