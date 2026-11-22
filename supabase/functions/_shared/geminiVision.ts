const DEFAULT_FALLBACKS = [
  // gemini-3.6-flash is the model that has actually been returning labels.
  // gemini-3.7-flash is currently 503ing and sometimes hangs for minutes, so it
  // stays later in the list instead of blocking the scan.
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
] as const

/** When GEMINI_MODEL is set, use at most one emergency fallback to limit latency and cost. */
const PINNED_EMERGENCY_FALLBACK = 'gemini-flash-latest'

/**
 * iOS WKWebView aborts a fetch that receives no response bytes for about 60s
 * ("Fetch is aborted"). The whole vision race must finish well inside that,
 * or the phone gives up while this function is still waiting on Gemini.
 */
export const VISION_ATTEMPT_TIMEOUT_MS = 22_000
export const VISION_HEDGE_DELAY_MS = 8_000
export const VISION_DEADLINE_MS = 45_000
const MAX_IN_FLIGHT = 2

export function geminiModelsToTry(): string[] {
  const configured = Deno.env.get('GEMINI_MODEL')?.trim()
  if (configured) {
    if (configured === PINNED_EMERGENCY_FALLBACK) {
      return [configured]
    }
    return [configured, PINNED_EMERGENCY_FALLBACK]
  }
  return [...DEFAULT_FALLBACKS]
}

export interface GeminiVisionResult {
  text: string
  model: string
  attempts: number
  durationMs: number
}

export type VisionAttempt =
  | { ok: true; text: string }
  | { ok: false; detail: string; fatal?: boolean }

export interface VisionRaceOptions {
  models: string[]
  call: (model: string, signal: AbortSignal) => Promise<VisionAttempt>
  signal?: AbortSignal
  hedgeDelayMs?: number
  deadlineMs?: number
  maxInFlight?: number
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  const live = signals.filter(Boolean)
  if (live.length === 0) return new AbortController().signal
  if (live.length === 1) return live[0]!
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(live)
  const controller = new AbortController()
  for (const signal of live) {
    if (signal.aborted) {
      controller.abort()
      return controller.signal
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  return controller.signal
}

function isBusyDetail(detail: string): boolean {
  return /503|429|timed out|timeout|unavailable|high demand|resource exhausted|cancelled|aborted/i.test(
    detail,
  )
}

/**
 * Start one model, then start another if it has not answered yet.
 * The first usable response wins. A hung or overloaded model cannot
 * hold the scan open until the phone aborts the request.
 */
export function raceVisionModels(options: VisionRaceOptions): Promise<GeminiVisionResult> {
  const models = options.models.filter((model) => model.trim().length > 0)
  const hedgeDelayMs = options.hedgeDelayMs ?? VISION_HEDGE_DELAY_MS
  const deadlineMs = options.deadlineMs ?? VISION_DEADLINE_MS
  const maxInFlight = options.maxInFlight ?? MAX_IN_FLIGHT
  const started = Date.now()

  if (models.length === 0) {
    return Promise.reject(new Error('The scan service is busy right now. Try again in a moment.'))
  }

  return new Promise((resolve, reject) => {
    const parent = new AbortController()
    const onExternalAbort = () => parent.abort()
    options.signal?.addEventListener('abort', onExternalAbort)
    const deadline = setTimeout(() => parent.abort(), deadlineMs)
    const errors: string[] = []
    let nextIndex = 0
    let inFlight = 0
    let attempts = 0
    let settled = false
    let hedge: ReturnType<typeof setInterval> | undefined

    const cleanup = () => {
      if (hedge) clearInterval(hedge)
      clearTimeout(deadline)
      options.signal?.removeEventListener('abort', onExternalAbort)
    }

    const fail = () => {
      if (settled) return
      settled = true
      const hard = errors.find((detail) => !isBusyDetail(detail))
      parent.abort()
      cleanup()
      if (hard) {
        reject(new Error(`Vision API failed: ${hard.slice(0, 200)}`))
        return
      }
      reject(new Error('The scan service is busy right now. Try again in a moment.'))
    }

    const launchOne = () => {
      if (settled || parent.signal.aborted) return
      if (inFlight >= maxInFlight || nextIndex >= models.length) return
      const model = models[nextIndex]!
      nextIndex += 1
      inFlight += 1
      attempts += 1
      void Promise.resolve()
        .then(() => options.call(model, parent.signal))
        .then(
        (attempt) => {
          inFlight -= 1
          if (settled) return
          if (attempt.ok && attempt.text.trim()) {
            settled = true
            const result: GeminiVisionResult = {
              text: attempt.text,
              model,
              attempts,
              durationMs: Date.now() - started,
            }
            parent.abort()
            cleanup()
            resolve(result)
            return
          }
          const detail = attempt.ok ? 'No response from vision model.' : attempt.detail
          errors.push(detail)
          console.error(`Gemini ${model}:`, detail.slice(0, 300))
          if (!attempt.ok && attempt.fatal) {
            settled = true
            parent.abort()
            cleanup()
            reject(new Error(`Vision API auth failed: ${detail.slice(0, 200)}`))
            return
          }
          if (parent.signal.aborted || (nextIndex >= models.length && inFlight === 0)) {
            if (inFlight === 0) fail()
            return
          }
          launchOne()
        },
        (error: unknown) => {
          inFlight -= 1
          if (settled) return
          const thrown = error instanceof Error ? error.message : String(error)
          errors.push(thrown)
          console.error(`Gemini ${model}:`, thrown.slice(0, 300))
          if (parent.signal.aborted || (nextIndex >= models.length && inFlight === 0)) {
            if (inFlight === 0) fail()
            return
          }
          launchOne()
        },
      )
    }

    launchOne()
    hedge = setInterval(() => {
      if (settled || parent.signal.aborted) return
      launchOne()
    }, hedgeDelayMs)

    parent.signal.addEventListener('abort', () => {
      if (settled) return
      // Let in-flight calls reject, then fail once nothing is left running.
      if (inFlight === 0) fail()
    })
  })
}

async function callModel(
  apiKey: string,
  model: string,
  mimeType: string,
  imageBase64: string,
  prompt: string,
  signal: AbortSignal,
): Promise<VisionAttempt> {
  const timeout = new AbortController()
  const timeoutId = setTimeout(() => timeout.abort(), VISION_ATTEMPT_TIMEOUT_MS)
  const signalCombined = anySignal([signal, timeout.signal])
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal: signalCombined,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
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
      if (typeof text === 'string' && text.trim()) return { ok: true, text }
      return { ok: false, detail: 'No response from vision model.' }
    }

    const detail = await res.text()
    if (res.status === 401 || res.status === 403) {
      return { ok: false, detail, fatal: true }
    }
    return { ok: false, detail: `${res.status} ${detail.slice(0, 180)}` }
  } catch (error) {
    if (signal.aborted) return { ok: false, detail: 'cancelled' }
    if (timeout.signal.aborted) return { ok: false, detail: `timed out after ${VISION_ATTEMPT_TIMEOUT_MS}ms` }
    return { ok: false, detail: error instanceof Error ? error.message : String(error) }
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function callGeminiVision(
  apiKey: string,
  mimeType: string,
  imageBase64: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<GeminiVisionResult> {
  const result = await raceVisionModels({
    models: geminiModelsToTry(),
    signal,
    call: (model, attemptSignal) =>
      callModel(apiKey, model, mimeType, imageBase64, prompt, attemptSignal),
  })
  console.log(`Gemini success via ${result.model} after ${result.attempts} attempt(s)`)
  return result
}
