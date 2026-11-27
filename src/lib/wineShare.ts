import { APP_NAME, SITE_URL } from '../brand'
import { formatScoreOutOf } from './scoreScale'
import { getSupabaseEnv } from './supabaseConfig'
import { getSupabase, isSupabaseConfigured } from './supabase'
import { normalizeReferralCode } from './referrals'
import type { ShareWineCardInput } from './shareWineCard'

export interface WineShareTarget {
  wineName: string
  winery?: string
  vintage?: string | number | null
  scoreLabel: string
  referralCode?: string | null
}

export function wineShareCaption(title: string, scoreLabel: string): string {
  return `${title} — ${scoreLabel} on ${APP_NAME}`
}

/** Branded page on decantiwine.com. Works before the share function is deployed. */
export function wineSharePageUrl(target: WineShareTarget, origin = SITE_URL): string {
  const url = new URL('share.html', origin.endsWith('/') ? origin : `${origin}/`)
  const code = normalizeReferralCode(target.referralCode)
  if (code) url.searchParams.set('ref', code)
  url.searchParams.set('wine', target.wineName)
  const winery = target.winery?.trim()
  if (winery) url.searchParams.set('winery', winery)
  if (target.vintage != null && String(target.vintage).trim()) {
    url.searchParams.set('vintage', String(target.vintage))
  }
  url.searchParams.set('score', target.scoreLabel)
  return url.toString()
}

/** Public HTML with the card as the link preview. Requires the wine-share function. */
export function wineShareFunctionUrl(projectUrl: string, id: string): string {
  const base = projectUrl.replace(/\/$/, '')
  return `${base}/functions/v1/wine-share?id=${encodeURIComponent(id)}`
}

function shareTarget(input: ShareWineCardInput, referralCode?: string | null): WineShareTarget {
  return {
    wineName: input.wine.name,
    winery: input.wine.winery,
    vintage: input.wine.vintage,
    scoreLabel: input.scoreLabel ?? formatScoreOutOf(input.score),
    referralCode,
  }
}

/**
 * Upload the card and return a preview URL when the account is signed in.
 * Any failure falls back to the public share page so the send still has a link.
 */
export async function publishWineShare(blob: Blob, input: ShareWineCardInput): Promise<string> {
  const fallback = wineSharePageUrl(shareTarget(input))
  if (!isSupabaseConfigured) return fallback

  try {
    const supabase = getSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return fallback

    const { data: profile } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('id', user.id)
      .maybeSingle()
    const code = normalizeReferralCode(profile?.referral_code)
    const page = wineSharePageUrl(shareTarget(input, code))

    const id = crypto.randomUUID()
    const path = `${user.id}/${id}.png`
    const upload = await supabase.storage.from('share-cards').upload(path, blob, {
      contentType: 'image/png',
      upsert: false,
    })
    if (upload.error) return page

    const inserted = await supabase.from('wine_shares').insert({
      id,
      user_id: user.id,
      referral_code: code,
      wine_name: input.wine.name,
      winery: input.wine.winery ?? '',
      vintage: input.wine.vintage != null ? String(input.wine.vintage) : '',
      score_label: input.scoreLabel ?? formatScoreOutOf(input.score),
      image_path: path,
    })
    if (inserted.error) return page

    const { url } = getSupabaseEnv()
    if (!url || !url.includes('.supabase.co')) return page
    return wineShareFunctionUrl(url, id)
  } catch {
    return fallback
  }
}
