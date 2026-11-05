import type { ParsedMenuWine } from '../menuMatch'
import { buildAiScanInvokeBody } from './aiScanRequest'
import { readFunctionError } from './functionError'
import { invokeEdgeFunction } from './invokeEdgeFunction'

export class MenuScanError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'MenuScanError'
    this.code = code
  }
}

export interface MenuScanResult {
  wines: ParsedMenuWine[]
  remaining: number
}

interface ScanMenuPayload {
  error?: string
  code?: string
  wines?: ParsedMenuWine[]
  remaining?: number
}

function parsePayload(data: unknown): ScanMenuPayload {
  if (data && typeof data === 'object') return data as ScanMenuPayload
  return {}
}

export async function scanMenuWithAi(file: File): Promise<MenuScanResult> {
  const body = await buildAiScanInvokeBody(file)
  const { data, error } = await invokeEdgeFunction<ScanMenuPayload>('scan-menu', body)

  if (error) {
    const { message, code } = await readFunctionError(error, data)
    throw new MenuScanError(message, code)
  }

  const payload = parsePayload(data)
  if (payload.error) {
    throw new MenuScanError(payload.error, payload.code)
  }

  return {
    wines: payload.wines ?? [],
    remaining: payload.remaining ?? 0,
  }
}
