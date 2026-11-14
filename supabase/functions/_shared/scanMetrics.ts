import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

export type ScanType = 'label' | 'menu'
export type ScanEventStatus = 'success' | 'no_data' | 'error'

export interface ScanEventInput {
  userId: string
  scanType: ScanType
  status: ScanEventStatus
  model?: string | null
  fallbackAttempts?: number
  durationMsTotal?: number
  durationMsPreflight?: number
  durationMsImage?: number
  durationMsGemini?: number
  imageBytes?: number | null
  fieldsExtracted?: number | null
  winesCount?: number | null
  errorCode?: string | null
}

export async function recordScanEvent(
  admin: SupabaseClient,
  input: ScanEventInput,
): Promise<void> {
  const row = {
    user_id: input.userId,
    scan_type: input.scanType,
    status: input.status,
    model: input.model ?? null,
    fallback_attempts: input.fallbackAttempts ?? 0,
    duration_ms_total: input.durationMsTotal ?? null,
    duration_ms_preflight: input.durationMsPreflight ?? null,
    duration_ms_image: input.durationMsImage ?? null,
    duration_ms_gemini: input.durationMsGemini ?? null,
    image_bytes: input.imageBytes ?? null,
    fields_extracted: input.fieldsExtracted ?? null,
    wines_count: input.winesCount ?? null,
    error_code: input.errorCode ?? null,
  }

  const { error } = await admin.from('ai_scan_events').insert(row)
  if (error) {
    console.warn('[ai_scan_events] insert failed:', error.message)
  }
}