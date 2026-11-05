import type { ScanResult } from '../scanner'
import type { WineType } from '../types'
import { WINE_TYPES } from '../types'
import { buildAiScanInvokeBody } from './aiScanRequest'
import { readFunctionError } from './functionError'
import { invokeEdgeFunction } from './invokeEdgeFunction'

export class LabelScanError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'LabelScanError'
    this.code = code
  }
}

export interface AiLabelScan {
  name: string | null
  winery: string | null
  vintage: number | null
  varietal: string | null
  region: string | null
  type: WineType | null
}

export interface LabelScanResult {
  label: AiLabelScan
  remaining: number
}

interface ScanLabelPayload {
  error?: string
  code?: string
  label?: Partial<AiLabelScan>
  remaining?: number
}

function parsePayload(data: unknown): ScanLabelPayload {
  if (data && typeof data === 'object') return data as ScanLabelPayload
  return {}
}

function normalizeWineType(raw: unknown): WineType | null {
  const text = String(raw ?? '').trim()
  if ((WINE_TYPES as readonly string[]).includes(text)) {
    return text as WineType
  }
  return null
}

export function aiLabelToScanResult(label: AiLabelScan): ScanResult {
  return {
    name: label.name ?? undefined,
    winery: label.winery ?? undefined,
    vintage: label.vintage ?? undefined,
    varietal: label.varietal ?? undefined,
    region: label.region ?? undefined,
    type: label.type ?? undefined,
    rawText: '',
  }
}

export async function scanLabelWithAi(file: File): Promise<LabelScanResult> {
  const body = await buildAiScanInvokeBody(file)
  const { data, error } = await invokeEdgeFunction<ScanLabelPayload>('scan-label', body)

  if (error) {
    const { message, code } = await readFunctionError(error, data)
    throw new LabelScanError(message, code)
  }

  const payload = parsePayload(data)
  if (payload.error) {
    throw new LabelScanError(payload.error, payload.code)
  }

  const raw = payload.label ?? {}
  return {
    label: {
      name: raw.name ?? null,
      winery: raw.winery ?? null,
      vintage: typeof raw.vintage === 'number' ? raw.vintage : null,
      varietal: raw.varietal ?? null,
      region: raw.region ?? null,
      type: normalizeWineType(raw.type),
    },
    remaining: payload.remaining ?? 0,
  }
}
