import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { resolveScanAllowance } from './scanQuota.ts'

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
  limit: number
}

export async function assertProAndScanQuota(
  admin: SupabaseClient,
  userId: string,
  usageTable: 'label_scan_usage' | 'menu_scan_usage',
  monthlyLimit: number,
  proRequiredCode: string,
  quotaExceededCode: string,
  freeAllowance = 0,
): Promise<ScanQuotaResult> {
  const full = await admin
    .from('profiles')
    .select('is_pro, pro_until')
    .eq('id', userId)
    .maybeSingle()

  let profile: { is_pro?: boolean | null; pro_until?: string | null } | null = null
  if (full.error && /pro_until/.test(full.error.message)) {
    const basic = await admin.from('profiles').select('is_pro').eq('id', userId).maybeSingle()
    if (basic.error) throw new Error(basic.error.message)
    profile = basic.data
  } else if (full.error) {
    throw new Error(full.error.message)
  } else {
    profile = full.data
  }

  const until = profile?.pro_until ? Date.parse(profile.pro_until) : Number.NaN
  const invitePro = Number.isFinite(until) && until > Date.now()
  const isPro = Boolean(profile?.is_pro) || invitePro

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

  const used = count ?? 0
  const allowance = resolveScanAllowance({
    isPro,
    used,
    monthlyLimit,
    freeAllowance,
  })
  if (!allowance.allowed) {
    throw new ScanPreflightError(
      allowance.code === 'quota_exceeded' ? 'Quota exceeded' : 'Pro required',
      allowance.code === 'quota_exceeded' ? quotaExceededCode : proRequiredCode,
    )
  }

  return { count: used, limit: allowance.limit }
}