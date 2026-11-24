import { SITE_URL } from '../brand'
import { isNativeApp } from './platform'
import { getSupabase } from './supabase'

const CODE_RE = /^[A-Z0-9]{6,12}$/
const DEVICE_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const REFERRAL_PRO_DAYS = 30
export const REFERRAL_PRO_MS = REFERRAL_PRO_DAYS * 24 * 60 * 60 * 1000

const REMEMBERED_CODE_KEY = 'decanti.referral-code'
const DEVICE_ID_KEY = 'decanti.device-id'

export type ReferralStatus = 'pending' | 'qualified' | 'rejected'
export type AttachReferralResult = 'attached' | 'already_set' | 'closed' | 'invalid' | 'unavailable'

export interface ReferralProClock {
  isPro: boolean
  proUntil: string | null
  bonusProDays: number
}

export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!CODE_RE.test(cleaned)) return null
  return cleaned
}

export function referralInviteUrl(code: string, origin = SITE_URL): string {
  const normalized = normalizeReferralCode(code)
  if (!normalized) throw new Error('Invalid referral code.')
  const url = new URL(origin)
  url.searchParams.set('ref', normalized)
  return url.toString()
}

export function hasProAccess(
  isPro: boolean | null | undefined,
  proUntil: string | null | undefined,
  now = Date.now(),
): boolean {
  if (isPro) return true
  if (!proUntil) return false
  const ends = Date.parse(proUntil)
  return Number.isFinite(ends) && ends > now
}

/** One qualified invite adds 30 days. Paid Pro banks those days. There is no cap. */
export function grantReferralMonth(clock: ReferralProClock, nowMs: number): ReferralProClock {
  if (clock.isPro) {
    return { ...clock, bonusProDays: clock.bonusProDays + REFERRAL_PRO_DAYS }
  }
  const existing = clock.proUntil ? Date.parse(clock.proUntil) : Number.NaN
  const base = Math.max(Number.isFinite(existing) ? existing : 0, nowMs)
  return { ...clock, proUntil: new Date(base + REFERRAL_PRO_MS).toISOString() }
}

/** When a paid subscription ends, banked invite days start from the later of now and proUntil. */
export function endPaidSubscription(clock: ReferralProClock, nowMs: number): ReferralProClock {
  if (clock.bonusProDays <= 0) {
    return { ...clock, isPro: false }
  }
  const existing = clock.proUntil ? Date.parse(clock.proUntil) : Number.NaN
  const base = Math.max(Number.isFinite(existing) ? existing : 0, nowMs)
  return {
    isPro: false,
    bonusProDays: 0,
    proUntil: new Date(base + clock.bonusProDays * 24 * 60 * 60 * 1000).toISOString(),
  }
}

export function referralProNote(input: {
  isPro?: boolean
  proUntil?: string | null
  bonusProDays?: number
  now?: number
}): string | null {
  const now = input.now ?? Date.now()
  const bonus = input.bonusProDays ?? 0
  const until = input.proUntil ? Date.parse(input.proUntil) : Number.NaN
  const untilLabel = Number.isFinite(until)
    ? new Date(until).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  if (input.isPro && bonus > 0) {
    const days = bonus === 1 ? '1 day' : `${bonus} days`
    return `${days} of Pro from invites are saved for when your subscription ends.`
  }
  if (!input.isPro && untilLabel && until > now) {
    return `Pro from invites through ${untilLabel}.`
  }
  return null
}

/**
 * The signup device of a second account is ignored when that device is already
 * on another account. Later devices this person uses do not count.
 */
export function signupDeviceBlocksReferral(
  signupDeviceId: string | null | undefined,
  devicesOnOtherAccounts: readonly string[],
): boolean {
  if (!signupDeviceId) return false
  return devicesOnOtherAccounts.includes(signupDeviceId)
}

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY)
    if (existing && DEVICE_RE.test(existing)) return existing.toLowerCase()
    const created = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, created)
    return created
  } catch {
    return crypto.randomUUID()
  }
}

export function rememberReferralCode(raw: string | null | undefined): void {
  const normalized = normalizeReferralCode(raw)
  if (!normalized) return
  try {
    localStorage.setItem(REMEMBERED_CODE_KEY, normalized)
  } catch {
    // Signup still sends the code in the form state.
  }
}

export function loadRememberedReferralCode(): string {
  try {
    return normalizeReferralCode(localStorage.getItem(REMEMBERED_CODE_KEY)) ?? ''
  } catch {
    return ''
  }
}

export function clearRememberedReferralCode(): void {
  try {
    localStorage.removeItem(REMEMBERED_CODE_KEY)
  } catch {
    // Ignore storage failures.
  }
}

export function captureReferralFromLocation(search = window.location.search): void {
  const ref = new URLSearchParams(search).get('ref')
  if (ref) rememberReferralCode(ref)
}

function isMissingReferralRpc(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === 'PGRST202' || /register_my_device|attach_referral_code|retry_referral_qualification/i.test(error.message ?? '')
}

export async function registerMyDevice(deviceId = getDeviceId()): Promise<void> {
  const { error } = await getSupabase().rpc('register_my_device', { device_id: deviceId })
  if (error && !isMissingReferralRpc(error)) throw error
}

export async function attachReferralCode(code: string): Promise<AttachReferralResult> {
  const normalized = normalizeReferralCode(code)
  if (!normalized) return 'invalid'
  const { data, error } = await getSupabase().rpc('attach_referral_code', { code: normalized })
  if (error) {
    if (isMissingReferralRpc(error)) return 'unavailable'
    throw error
  }
  if (
    data === 'attached' ||
    data === 'already_set' ||
    data === 'closed' ||
    data === 'invalid'
  ) {
    return data
  }
  return 'invalid'
}

export async function retryReferralQualification(): Promise<void> {
  const { error } = await getSupabase().rpc('retry_referral_qualification')
  if (error && !isMissingReferralRpc(error)) throw error
}

/** Register this install and attach a saved invite code before a wine can qualify it. */
export async function prepareReferralForSession(): Promise<void> {
  try {
    await registerMyDevice()
  } catch {
    // The wine still saves. Qualification waits until the device row exists.
  }
  const code = loadRememberedReferralCode()
  if (!code) return
  try {
    const result = await attachReferralCode(code)
    if (result !== 'unavailable') clearRememberedReferralCode()
  } catch {
    // Keep the code and try on the next save.
  }
}

export function referralShareText(url: string): string {
  return `Rank wines with me on Decanti. Join with my invite and we both get a month of Pro after you rate a bottle. ${url}`
}

export async function shareReferralInvite(code: string): Promise<'shared' | 'copied'> {
  const url = referralInviteUrl(code)
  const text = referralShareText(url)
  if (isNativeApp()) {
    const { Share } = await import('@capacitor/share')
    await Share.share({
      title: 'Join me on Decanti',
      text,
      url,
      dialogTitle: 'Invite a friend',
    })
    return 'shared'
  }
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Join me on Decanti', text, url })
      return 'shared'
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'shared'
    }
  }
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    throw new Error('Could not copy the invite link.')
  }
  await navigator.clipboard.writeText(url)
  return 'copied'
}
