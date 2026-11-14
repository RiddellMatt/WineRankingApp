import type { WineType } from '../types'
import type { AiLabelScan } from './labelScanApi'
import { invokeEdgeFunction } from './invokeEdgeFunction'

export interface LabelScanBaseline {
  name: string | null
  winery: string | null
  vintage: number | null
  varietal: string | null
  region: string | null
  type: WineType | null
}

export function baselineFromAiLabel(label: AiLabelScan): LabelScanBaseline {
  return {
    name: label.name,
    winery: label.winery,
    vintage: label.vintage,
    varietal: label.varietal,
    region: label.region,
    type: label.type,
  }
}

/** Fire-and-forget: which AI-prefilled fields the user changed before save. */
export function reportLabelScanCorrection(
  baseline: LabelScanBaseline,
  final: {
    name: string
    winery: string
    vintage: number | null
    varietal: string
    region: string
    type: WineType
  },
): void {
  void invokeEdgeFunction('log-scan-correction', {
    scanType: 'label',
    baseline,
    final,
  }).catch(() => {
    // Best-effort telemetry only.
  })
}