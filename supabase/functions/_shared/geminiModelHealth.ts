import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import {
  VISION_SAMPLE_WINDOW_MS,
  type ModelSample,
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
    .select('model, outcome, duration_ms, created_at')
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
    samples.push({
      model: String(row.model ?? ''),
      outcome: outcome as VisionOutcome,
      durationMs: Number(row.duration_ms ?? 0),
      atMs,
    })
  }
  return samples
}

/** Remember how each model did so the next scan can avoid the ones under load. */
export async function saveVisionSamples(
  admin: SupabaseClient,
  samples: VisionAttemptSample[],
): Promise<void> {
  if (samples.length === 0) return
  const rows = samples.map((sample) => ({
    model: sample.model,
    outcome: sample.outcome,
    duration_ms: Math.max(0, Math.round(sample.durationMs)),
  }))
  const { error } = await admin.from('gemini_model_samples').insert(rows)
  if (error) {
    console.warn('[gemini_model_samples] insert failed:', error.message)
  }
}
