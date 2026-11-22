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

/**
 * Below this many real label/menu attempts in the window, ask the models
 * themselves who is up before trusting the thin scan history.
 */
export const ENOUGH_VISION_SAMPLES = 8

/** Reuse a live check for a few minutes so a second bottle does not probe again. */
export const PROBE_REUSE_MS = 3 * 60 * 1000

/** A hung model must not hold the probe open. The photo call starts after this. */
export const PROBE_TIMEOUT_MS = 2_000

export type VisionOutcome = 'success' | 'overload' | 'timeout' | 'error' | 'unavailable'

export interface ModelSample {
  model: string
  outcome: VisionOutcome
  durationMs: number
  atMs: number
  /** vision = a real label or menu photo. probe = a tiny live check. */
  source?: 'vision' | 'probe'
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
  // Measured on a real-sized label photo: these two returned the wine in about 1–2s.
  'gemini-3.6-flash': { completion: 0.92, successMs: 1_800, failureMs: 4_000 },
  'gemini-3.5-flash-lite': { completion: 0.84, successMs: 1_200, failureMs: 5_000 },
  // This alias sometimes accepts a photo and never answers. Keep it behind the two above.
  'gemini-flash-lite-latest': { completion: 0.5, successMs: 1_500, failureMs: 12_000 },
  'gemini-3.8-flash': { completion: 0.35, successMs: 6_000, failureMs: 12_000 },
  'gemini-3.7-flash': { completion: 0.08, successMs: 8_000, failureMs: 20_000 },
  'gemini-flash-latest': { completion: 0.08, successMs: 4_000, failureMs: 8_000 },
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
 * iOS WKWebView aborts a fetch that receives no response bytes for about 60s.
 * A healthy label read comes back in 1–2s. A request still silent at 10s is
 * stuck, and waiting the old 22s is how the phone gives up before a later
 * model gets a real chance. The whole race still ends well inside 60s.
 */
export const VISION_ATTEMPT_TIMEOUT_MS = 10_000
export const VISION_HEDGE_DELAY_MS = 2_500
export const VISION_DEADLINE_MS = 45_000
const MAX_IN_FLIGHT = 2

/**
 * Room for a short JSON label or a multi-wine menu, plus a little thinking.
 * This cap includes thought tokens, so it stays well above a normal answer.
 */
export const VISION_MAX_OUTPUT_TOKENS = 8_192

/**
 * Gemini 3 thinks at medium or high when this is omitted, and a temperature
 * below 1 can make that loop until the request is aborted. Label reading is
 * extraction, so ask for the lowest level every model in the pool accepts.
 */
export function labelGenerationConfig(): {
  maxOutputTokens: number
  responseMimeType: string
  thinkingConfig: { thinkingLevel: 'LOW' }
} {
  return {
    maxOutputTokens: VISION_MAX_OUTPUT_TOKENS,
    responseMimeType: 'application/json',
    thinkingConfig: { thinkingLevel: 'LOW' },
  }
}

export function probeGenerationConfig(): {
  maxOutputTokens: number
  thinkingConfig: { thinkingLevel: 'LOW' }
} {
  return {
    maxOutputTokens: 8,
    thinkingConfig: { thinkingLevel: 'LOW' },
  }
}

/** Drop one unsupported knob after a 400, so an older alias can still answer. */
export function relaxGenerationConfig(
  config: Record<string, unknown>,
  status: number,
  detail: string,
): Record<string, unknown> | null {
  if (status !== 400) return null
  if (config.thinkingConfig && /thinking/i.test(detail)) {
    const { thinkingConfig: _drop, ...rest } = config
    return rest
  }
  if (config.responseMimeType && /mime|response_schema|responseMime/i.test(detail)) {
    const { responseMimeType: _drop, ...rest } = config
    return rest
  }
  return null
}

/** The answer text. Thought parts are reasoning, not the label JSON. */
export function textFromGeminiResponse(json: unknown): string {
  if (!json || typeof json !== 'object') return ''
  const candidates = (json as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates)) return ''
  const texts: string[] = []
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    const parts = (candidate as { content?: { parts?: unknown } }).content?.parts
    if (!Array.isArray(parts)) continue
    for (const part of parts) {
      if (!part || typeof part !== 'object') continue
      const record = part as { thought?: unknown; text?: unknown }
      if (record.thought === true) continue
      if (typeof record.text === 'string' && record.text.trim()) texts.push(record.text.trim())
    }
    if (texts.length > 0) break
  }
  return texts.join('\n')
}

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
 * While real scans are scarce, mix in a recent live check.
 * Once there are enough photo attempts, those attempts are the whole score.
 */
export function blendSamplesForRanking(
  samples: ModelSample[],
  nowMs: number,
): { samples: ModelSample[]; needsLiveProbe: boolean; visionCount: number } {
  const vision = samples.filter((sample) => (sample.source ?? 'vision') === 'vision')
  const freshProbes = samples.filter((sample) => {
    if (sample.source !== 'probe') return false
    const age = nowMs - sample.atMs
    return age >= 0 && age <= PROBE_REUSE_MS
  })
  const needsLiveProbe = vision.length < ENOUGH_VISION_SAMPLES && freshProbes.length === 0
  return {
    visionCount: vision.length,
    needsLiveProbe,
    samples: vision.length >= ENOUGH_VISION_SAMPLES ? vision : [...vision, ...freshProbes],
  }
}

/** Skip models a real scan already proved are retired. */
export function modelsToProbe(
  configured: string | undefined,
  visionSamples: ModelSample[],
  nowMs: number,
): string[] {
  const retired = new Set(
    visionSamples
      .filter((sample) => {
        if ((sample.source ?? 'vision') !== 'vision') return false
        if (sample.outcome !== 'unavailable') return false
        const age = nowMs - sample.atMs
        return age >= 0 && age <= VISION_SAMPLE_WINDOW_MS
      })
      .map((sample) => sample.model),
  )
  return candidateModels(configured).filter((model) => !retired.has(model))
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
          // The deadline or a winner aborted this call. That is not evidence the model is down.
          if (detail !== 'cancelled') report(classifyVisionOutcome(detail))
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
          if (thrown !== 'cancelled') report(classifyVisionOutcome(thrown))
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

type GeneratePart = { text: string } | { inline_data: { mime_type: string; data: string } }

async function postGenerateContent(
  apiKey: string,
  model: string,
  parts: GeneratePart[],
  generationConfig: Record<string, unknown>,
  signal: AbortSignal,
): Promise<{ ok: true; json: unknown } | { ok: false; detail: string; fatal?: boolean }> {
  let config = generationConfig
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal,
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: config,
        }),
      },
    )
    if (res.ok) return { ok: true, json: await res.json() }
    const detail = await res.text()
    if (res.status === 401 || res.status === 403) {
      return { ok: false, detail, fatal: true }
    }
    const relaxed = relaxGenerationConfig(config, res.status, detail)
    if (relaxed) {
      config = relaxed
      continue
    }
    return { ok: false, detail: `${res.status} ${detail.slice(0, 180)}` }
  }
  return { ok: false, detail: '400 generation config rejected' }
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
    const posted = await postGenerateContent(
      apiKey,
      model,
      [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: imageBase64 } },
      ],
      labelGenerationConfig(),
      signalCombined,
    )
    if (!posted.ok) {
      return posted.fatal
        ? { ok: false, detail: posted.detail, fatal: true }
        : { ok: false, detail: posted.detail }
    }
    const text = textFromGeminiResponse(posted.json)
    if (text) return { ok: true, text }
    return { ok: false, detail: 'No response from vision model.' }
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
  const ranked = options?.models?.length ? options.models : geminiModelsToTry()
  // One silent call is often a stuck request. Run the list a second time so a
  // new call can land while the first one is still hung.
  const models = ranked.length > 1 ? [...ranked, ...ranked] : ranked
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

/** One-pixel JPEG. Large enough for the vision endpoint, small enough to be a load check. */
const PROBE_JPEG =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q=='

/**
 * Ask every candidate model with a tiny image, in parallel, and stop at 2s.
 * This is the live load check used until real scans fill the window.
 */
export async function probeGeminiModels(
  apiKey: string,
  models: string[],
  signal?: AbortSignal,
): Promise<ModelSample[]> {
  if (signal?.aborted || models.length === 0) return []
  const atMs = Date.now()
  const results = await Promise.all(
    models.map((model) => probeOneModel(apiKey, model, signal, atMs)),
  )
  const fatal = results.find((result) => result.fatal)
  if (fatal?.detail) {
    throw new Error(`Vision API auth failed: ${fatal.detail.slice(0, 200)}`)
  }
  return results.flatMap((result) =>
    result.sample && !signal?.aborted ? [result.sample] : [],
  )
}

async function probeOneModel(
  apiKey: string,
  model: string,
  signal: AbortSignal | undefined,
  atMs: number,
): Promise<{ sample: ModelSample | null; fatal?: boolean; detail?: string }> {
  const timeout = new AbortController()
  const timeoutId = setTimeout(() => timeout.abort(), PROBE_TIMEOUT_MS)
  const combined = signal ? anySignal([signal, timeout.signal]) : timeout.signal
  const started = Date.now()
  try {
    const posted = await postGenerateContent(
      apiKey,
      model,
      [
        { text: 'Reply with the single word ok.' },
        { inline_data: { mime_type: 'image/jpeg', data: PROBE_JPEG } },
      ],
      probeGenerationConfig(),
      combined,
    )
    const durationMs = Date.now() - started
    if (!posted.ok) {
      if (posted.fatal) return { sample: null, fatal: true, detail: posted.detail }
      return {
        sample: {
          model,
          outcome: classifyVisionOutcome(posted.detail),
          durationMs,
          atMs,
          source: 'probe',
        },
      }
    }
    const text = textFromGeminiResponse(posted.json)
    const outcome: VisionOutcome = text ? 'success' : 'error'
    return { sample: { model, outcome, durationMs, atMs, source: 'probe' } }
  } catch (error) {
    if (signal?.aborted) return { sample: null }
    const durationMs = Date.now() - started
    const detail = timeout.signal.aborted
      ? `timed out after ${PROBE_TIMEOUT_MS}ms`
      : error instanceof Error
        ? error.message
        : String(error)
    return {
      sample: {
        model,
        outcome: classifyVisionOutcome(detail),
        durationMs,
        atMs,
        source: 'probe',
      },
    }
  } finally {
    clearTimeout(timeoutId)
  }
}
