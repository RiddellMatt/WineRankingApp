import type { ParsedMenuWine } from '../menuMatch'
import { getSupabase } from './supabase'
import { resizeImageForUpload } from './imageResize'

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
  const { base64, mimeType } = await resizeImageForUpload(file)
  const { data, error } = await getSupabase().functions.invoke('scan-menu', {
    body: { imageBase64: base64, mimeType },
  })

  const payload = parsePayload(data)
  if (payload.error) {
    throw new MenuScanError(payload.error, payload.code)
  }
  if (error) {
    throw new MenuScanError(error.message)
  }

  return {
    wines: payload.wines ?? [],
    remaining: payload.remaining ?? 0,
  }
}
