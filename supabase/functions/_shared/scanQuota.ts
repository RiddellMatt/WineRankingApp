/** Free signed-in accounts can run this many AI menu scans before Pro. Label scans stay on Pro. */
export const FREE_MENU_SCANS = 2

export function resolveScanAllowance(input: {
  isPro: boolean
  used: number
  monthlyLimit: number
  freeAllowance?: number
}): { allowed: boolean; limit: number; code?: 'pro_required' | 'quota_exceeded' } {
  const freeAllowance = input.freeAllowance ?? 0
  if (!input.isPro && freeAllowance <= 0) {
    return { allowed: false, limit: 0, code: 'pro_required' }
  }
  const limit = input.isPro ? input.monthlyLimit : freeAllowance
  if (input.used >= limit) {
    return {
      allowed: false,
      limit,
      code: input.isPro ? 'quota_exceeded' : 'pro_required',
    }
  }
  return { allowed: true, limit }
}
