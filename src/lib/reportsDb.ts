import { getSupabase } from './supabase'

export const REPORT_REASONS = [
  { id: 'spam', label: 'Spam' },
  { id: 'harassment', label: 'Harassment' },
  { id: 'hate', label: 'Hate or threats' },
  { id: 'sexual', label: 'Sexual content' },
  { id: 'other', label: 'Something else' },
] as const

export type ReportReason = (typeof REPORT_REASONS)[number]['id']

const REASON_IDS = new Set<string>(REPORT_REASONS.map((reason) => reason.id))

export async function submitReport(input: {
  targetUserId: string
  wineId?: string
  reason: ReportReason
  note?: string
}): Promise<void> {
  if (!REASON_IDS.has(input.reason)) throw new Error('Choose a reason.')
  const {
    data: { user },
  } = await getSupabase().auth.getUser()
  if (!user) throw new Error('Not signed in')
  const note = (input.note ?? '').trim().slice(0, 500)
  const { error } = await getSupabase().from('user_reports').insert({
    reporter_id: user.id,
    target_user_id: input.targetUserId,
    wine_id: input.wineId ?? null,
    reason: input.reason,
    note,
  })
  if (error) throw error
}
