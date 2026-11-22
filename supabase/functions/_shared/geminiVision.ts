/**
 * Pool we are willing to send a label or menu photo to.
 * Order here does not matter; rankVisionModels picks from recent results.
 */
const VISION_POOL = [
  'gemini-3.6-flash',
  'gemini-flash-lite-latest',
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-flash-latest',
] as const

/** How many distinct models one scan will call. */
const MAX_MODELS_PER_SCAN = 4

/** Pretend we already saw this many scans, so one lucky call cannot rewrite the order. */
const PRIOR_WEIGHT = 3

/** A result from 8 minutes ago counts half as much as one from just now. */
const HALF_LIFE_MS = 8 * 60 * 1000

/** Ignore anything older than this when scoring. */
export const VISION_SAMPLE_WINDOW_MS = 30 * 60 * 1000

/** Two failures in this window, and no success, means the model is under load right now. */
export const VISION_EXHAUSTED_WINDOW_MS = 10 * 60 * 1000

export type VisionOutcome = 'success' | 'overload' | 'timeout' | 'error' | 'unavailable'

export interface ModelSample {
  model: string
  outcome: VisionOutcome
  durationMs: number
  atMs: number
}

interface ModelPrior {
  /** Chance a call returns usable text, before we have fresh samples. */
  completion: number
  successMs: number
  failureMs: number
}

/**
 * Starting belief, used until real scans replace it.
 * gemini-3.6-flash is the one that has been finishing labels.
 * gemini-3.7-flash and gemini-flash-latest are slow or fast 503s, so they
 * start at the back and only move up after they actually complete.
 */
const MODEL_PRIORS: Record<string, ModelPrior> = {
  'gemini-3.6-flash': { completion: 0.9, successMs: 5_000, failureMs: 4_000 },
  'gemini-flash-lite-latest': { completion: 0.62, successMs: 4_000, failureMs: 2_500 },
  'gemini-3.8-flash': { completion: 0.7, successMs: 5_500, failureMs: 4_000 },
  'gemini-3.5-flash-lite': { completion: 0.42, successMs: 4_500, failureMs: 3_000 },
  'gemini-3.7-flash': { completion: 0.08, successMs: 8_000, failureMs: 20_000 },
  'gemini-flash-latest': { completion: 0.08, successMs: 4_000, failureMs: 600 },
}

/** A GEMINI_MODEL pin we have no history for. Strong enough to earn a backup slot, not the lead. */
const DEFAULT_PRIOR: ModelPrior = { completion: 0.62, successMs: 6_000, failureMs: 4_000 }

export interface RankedVisionModel {
  model: string
  /** Estimated chance this call returns text. */
  completion: number
  /** Estimated time until we know whether it worked. */
  expectedAttemptMs: number
  /** completion / expectedAttemptMs. Higher is a better first try. */
  score: number
  exhausted: boolean
}

export interface VisionAttemptSample {
  model: string
  outcome: VisionOutcome
  durationMs: number
}

/**
 * iOS WKWebView aborts a fetch that receives no response bytes for about 60s
 * ("Fetch is aborted"). The whole vision race must finish well inside that,
 * or the phone gives up while this function is still waiting on Gemini.
 */
export const VISION_ATTEMPT_TIMEOUT_MS = 22_000
export const VISION_HEDGE_DELAY_MS = 4_000
export const VISION_DEADLINE_MS = 45_000
const MAX_IN_FLIGHT = 2

export function classifyVisionOutcome(detail: string): VisionOutcome {
  if (/404|no longer available|not found|not_found/i.test(detail)) return 'unavailable'
  if (/503|429|high demand|resource exhausted/i.test(detail)) return 'overload'
  if (/timed out|timeout|cancelled|aborted/i.test(detail)) return 'timeout'
  return 'error'
}

function priorFor(model: string): ModelPrior {
  return MODEL_PRIORS[model] ?? DEFAULT_PRIOR
}

function candidateModels(configured: string | undefined): string[] {
  const pin = configured?.trim() ?? ''
  const seen = new Set<string>()
  const models: string[] = []
  for (const model of pin ? [pin, ...VISION_POOL] : VISION_POOL) {
    if (!model || seen.has(model)) continue
    seen.add(model)
    models.push(model)
  }
  return models
}

/**
 * Pick the models for this scan.
 *
 * Score is the chance of a finished read divided by how long we expect to
 * wait to find out. A model that answers quickly and usually works goes
 * first. A model that 503s or hangs is pushed behind anything that is
 * still healthy, and its score falls as those failures pile up.
 */
export function rankVisionModels(options: {
  configured?: string
  samples?: ModelSample[]
  nowMs?: number
  limit?: number
}): RankedVisionModel[] {
  const nowMs = options.nowMs ?? Date.now()
  const samples = options.samples ?? []
  const limit = options.limit ?? MAX_MODELS_PER_SCAN

  const ranked = candidateModels(options.configured).map((model) => {
    const prior = priorFor(model)
    let weightSum = 0
    let successWeight = 0
    let successLatency = 0
    let failureLatency = 0
    let recentCount = 0
    let recentSuccess = 0
    let unavailable = false

    for (const sample of samples) {
      if (sample.model !== model) continue
      const age = nowMs - sample.atMs
      if (age < 0 || age > VISION_SAMPLE_WINDOW_MS) continue
      const weight = Math.exp(-age / HALF_LIFE_MS)
      weightSum += weight
      if (sample.outcome === 'success') {
        successWeight += weight
        successLatency += weight * sample.durationMs
      } else {
        failureLatency += weight * sample.durationMs
      }
      if (sample.outcome === 'unavailable') unavailable = true
      if (age <= VISION_EXHAUSTED_WINDOW_MS) {
        recentCount += 1
        if (sample.outcome === 'success') recentSuccess += 1
      }
    }

    const completion =
      (successWeight + prior.completion * PRIOR_WEIGHT) / (weightSum + PRIOR_WEIGHT)
    const successMs = successWeight > 0 ? successLatency / successWeight : prior.successMs
    const failureWeight = weightSum - successWeight
    const failureMs = failureWeight > 0 ? failureLatency / failureWeight : prior.failureMs
    const retired = unavailable
    const expectedAttemptMs = retired
      ? 60_000
      : completion * successMs + (1 - completion) * failureMs
    const exhausted = retired || (recentCount >= 2 && recentSuccess === 0)
    return {
      model,
      completion,
      expectedAttemptMs,
      score: expectedAttemptMs > 0 ? completion / expectedAttemptMs : 0,
      exhausted,
    }
  })

  const byUsefulness = (a: RankedVisionModel, b: RankedVisionModel) =>
    b.score - a.score || a.model.localeCompare(b.model)
  const fresh = ranked.filter((entry) => !entry.exhausted).sort(byUsefulness)
  const tired = ranked.filter((entry) => entry.exhausted).sort(byUsefulness)
  // A model that just failed twice stays off the lead. If those failures were
  // quick, keep it as the last slot so a short blip does not erase it. A model
  // that is hanging stays out: spending 20s on it is how scans miss the phone's
  // deadline.
  const affordable = tired.filter((entry) => entry.expectedAttemptMs <= 8_000)
  const picked = fresh.slice(0, limit)
  if (picked.length === 0) return tired.slice(0, limit)
  if (picked.length < limit) {
    picked.push(...affordable.slice(0, limit - picked.length))
  } else if (affordable[0]) {
    picked[limit - 1] = affordable[0]
  }
  return picked
}

/** Order models for one scan. `configured` is the GEMINI_MODEL secret, if set. */
export function modelsForScan(
  configured: string | undefined,
  samples: ModelSample[] = [],
  nowMs = Date.now(),
): string[] {
  return rankVisionModels({ configured, samples, nowMs }).map((entry) => entry.model)
}

export function geminiModelsToTry(): string[] {
  const configured = typeof Deno !== 'undefined' ? Deno.env.get('GEMINI_MODEL') : undefined
  return modelsForScan(configured)
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
  onSample?: (sample: VisionAttemptSample) => void
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
      const attemptStarted = Date.now()
      const report = (outcome: VisionOutcome) => {
        options.onSample?.({
          model,
          outcome,
          durationMs: Math.max(0, Date.now() - attemptStarted),
        })
      }
      void Promise.resolve()
        .then(() => options.call(model, parent.signal))
        .then(
        (attempt) => {
          inFlight -= 1
          // A winner already aborted this call. That is not a failure of the model.
          if (settled) return
          if (attempt.ok && attempt.text.trim()) {
            report('success')
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
          report(classifyVisionOutcome(detail))
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
          report(classifyVisionOutcome(thrown))
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
  options?: {
    models?: string[]
    onSample?: (sample: VisionAttemptSample) => void
  },
): Promise<GeminiVisionResult> {
  const models = options?.models?.length ? options.models : geminiModelsToTry()
  console.log(`Vision models: ${models.join(', ')}`)
  const result = await raceVisionModels({
    models,
    signal,
    onSample: options?.onSample,
    call: (model, attemptSignal) =>
      callModel(apiKey, model, mimeType, imageBase64, prompt, attemptSignal),
  })
  console.log(`Gemini success via ${result.model} after ${result.attempts} attempt(s)`)
  return result
}
