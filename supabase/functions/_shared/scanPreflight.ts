import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

export class ScanPreflightError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'ScanPreflightError'
    this.code = code
  }
}

export interface ScanQuotaResult {
  count: number
}

export async function assertProAndScanQuota(
  admin: SupabaseClient,
  userId: string,
  usageTable: 'label_scan_usage' | 'menu_scan_usage',
  monthlyLimit: number,
  proRequiredCode: string,
  quotaExceededCode: string,
): Promise<ScanQuotaResult> {
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('is_pro')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) {
    throw new Error(profileError.message)
  }
  if (!profile?.is_pro) {
    throw new ScanPreflightError('Pro required', proRequiredCode)
  }

  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)

  const { count, error: countError } = await admin
    .from(usageTable)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', monthStart.toISOString())

  if (countError) {
    throw new Error(countError.message)
  }
  if ((count ?? 0) >= monthlyLimit) {
    throw new ScanPreflightError('Quota exceeded', quotaExceededCode)
  }

  return { count: count ?? 0 }
}