import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import {
  blendSamplesForRanking,
  modelsToProbe,
  probeGeminiModels,
  rankVisionModels,
  VISION_SAMPLE_WINDOW_MS,
  type ModelSample,
  type RankedVisionModel,
  type VisionAttemptSample,
  type VisionOutcome,
} from './geminiVision.ts'

const OUTCOMES = new Set<VisionOutcome>(['success', 'overload', 'timeout', 'error', 'unavailable'])

/** Recent vision attempts, newest first. Empty when the table is not ready yet. */
export async function loadRecentVisionSamples(
  admin: SupabaseClient,
  nowMs = Date.now(),
): Promise<ModelSample[]> {
  const since = new Date(nowMs - VISION_SAMPLE_WINDOW_MS).toISOString()
  const { data, error } = await admin
    .from('gemini_model_samples')
    .select('model, outcome, duration_ms, created_at, source')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.warn('[gemini_model_samples] read failed:', error.message)
    return []
  }

  const samples: ModelSample[] = []
  for (const row of data ?? []) {
    const outcome = String(row.outcome ?? '')
    if (!OUTCOMES.has(outcome as VisionOutcome)) continue
    const atMs = Date.parse(String(row.created_at ?? ''))
    if (!Number.isFinite(atMs)) continue
    const source = row.source === 'probe' ? 'probe' : 'vision'
    samples.push({
      model: String(row.model ?? ''),
      outcome: outcome as VisionOutcome,
      durationMs: Number(row.duration_ms ?? 0),
      atMs,
      source,
    })
  }
  return samples
}

/** Remember how each model did so the next scan can avoid the ones under load. */
export async function saveVisionSamples(
  admin: SupabaseClient,
  samples: VisionAttemptSample[],
  source: 'vision' | 'probe' = 'vision',
): Promise<void> {
  if (samples.length === 0) return
  const rows = samples.map((sample) => ({
    model: sample.model,
    outcome: sample.outcome,
    duration_ms: Math.max(0, Math.round(sample.durationMs)),
    source,
  }))
  const { error } = await admin.from('gemini_model_samples').insert(rows)
  if (error) {
    console.warn('[gemini_model_samples] insert failed:', error.message)
  }
}

/**
 * Order models for this photo. With fewer than 8 real scans in the window,
 * a 2s parallel check of the models themselves fills in who is actually up.
 */
export async function rankModelsForScan(
  admin: SupabaseClient,
  apiKey: string,
  configured: string | undefined,
  signal?: AbortSignal,
): Promise<RankedVisionModel[]> {
  const nowMs = Date.now()
  const loaded = await loadRecentVisionSamples(admin, nowMs)
  const blend = blendSamplesForRanking(loaded, nowMs)
  const probed: ModelSample[] = []

  if (blend.needsLiveProbe && !signal?.aborted) {
    const models = modelsToProbe(configured, loaded, nowMs)
    console.log(`Vision probe: checking ${models.join(', ')}`)
    try {
      const results = await probeGeminiModels(apiKey, models, signal)
      probed.push(...results)
      console.log(
        `Vision probe: ${results
          .map((sample) => `${sample.model} ${sample.outcome} ${sample.durationMs}ms`)
          .join(' | ')}`,
      )
      await saveVisionSamples(
        admin,
        results.map((sample) => ({
          model: sample.model,
          outcome: sample.outcome,
          durationMs: sample.durationMs,
        })),
        'probe',
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.startsWith('Vision API auth failed')) throw error
      console.warn('[gemini_model_samples] probe failed:', message.slice(0, 200))
    }
  }

  const ranked = rankVisionModels({
    configured,
    nowMs,
    samples: [...blend.samples, ...probed],
  })
  console.log(
    `Vision rank: ${ranked
      .map(
        (entry) =>
          `${entry.model} p=${entry.completion.toFixed(2)} ${Math.round(entry.expectedAttemptMs)}ms${entry.exhausted ? ' tired' : ''}`,
      )
      .join(' | ')}`,
  )
  return ranked
}
