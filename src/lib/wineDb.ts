import type { Wine, WineType, TasteProfile, RankingPreference, WineStatus } from '../types'
import { normalizeWithFriendIds } from './wineWithFriends'
import { withSupabaseAuthRetry } from './supabaseAuthRetry'
import { getSupabase, type WineRow } from './supabase'
import { assertCleanText } from './contentFilter'
import { applyCompositeRating, resolveRankingPreference, wineEnjoyment } from './ranking'
import { normalizeTriedOn, normalizeWinePhotos } from './wineMoments'
import { normalizePours } from './winePours'
import { persistWinePhotos, removeWinePhotoFolder } from './winePhotos'

function wineStatusFromRow(raw: string | null | undefined): WineStatus {
  return raw === 'wishlist' ? 'wishlist' : 'tried'
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function ensureWineId(wine: Wine): Wine {
  if (UUID_RE.test(wine.id)) return wine
  return { ...wine, id: crypto.randomUUID() }
}

export function wineFromRow(row: WineRow): Wine {
  const enjoyment = row.rating_enjoyment != null ? Number(row.rating_enjoyment) : Number(row.rating)
  const wine: Wine = {
    id: row.id,
    name: row.name,
    winery: row.winery,
    vintage: row.vintage,
    type: row.type as WineType,
    varietal: row.varietal,
    region: row.region,
    price: row.price != null ? Number(row.price) : null,
    ratingEnjoyment: enjoyment,
    ratingValue: row.rating_value != null ? Number(row.rating_value) : null,
    ratingBuyAgain: row.rating_buy_again != null ? Number(row.rating_buy_again) : null,
    rating: Number(row.rating),
    notes: row.notes,
    tastingTags: Array.isArray(row.tasting_tags) ? row.tasting_tags : [],
    withFriendIds: normalizeWithFriendIds(row.with_friend_ids),
    purchasedAt: row.purchased_at,
    triedOn: normalizeTriedOn(row.tried_on),
    pours: normalizePours(row.pours),
    photos: normalizeWinePhotos(row.photo_urls),
    taste: (row.taste ?? {}) as TasteProfile,
    tasteSource: row.taste_source === 'custom' ? 'custom' : row.taste_source === 'typical' ? 'typical' : undefined,
    status: wineStatusFromRow(row.status),
    addedAt: row.added_at,
  }
  return applyCompositeRating(wine, resolveRankingPreference())
}

export function wineToRow(
  userId: string,
  wine: Wine,
  pref: RankingPreference = resolveRankingPreference(),
): Omit<WineRow, 'user_id'> & { user_id: string } {
  const normalized = applyCompositeRating(wine, pref)
  return {
    id: normalized.id,
    user_id: userId,
    name: normalized.name,
    winery: normalized.winery,
    vintage: normalized.vintage,
    type: normalized.type,
    varietal: normalized.varietal,
    region: normalized.region,
    price: normalized.price,
    rating: normalized.rating,
    rating_enjoyment: wineEnjoyment(normalized),
    rating_value: normalized.ratingValue ?? null,
    rating_buy_again: normalized.ratingBuyAgain ?? null,
    notes: normalized.notes,
    tasting_tags: normalized.tastingTags ?? [],
    with_friend_ids: normalizeWithFriendIds(normalized.withFriendIds),
    purchased_at: normalized.purchasedAt,
    tried_on: normalizeTriedOn(normalized.triedOn),
    pours: normalizePours(normalized.pours),
    photo_urls: normalizeWinePhotos(normalized.photos),
    taste: (normalized.taste ?? {}) as Record<string, number>,
    taste_source: normalized.tasteSource ?? null,
    status: normalized.status === 'wishlist' ? 'wishlist' : 'tried',
    added_at: normalized.addedAt,
  }
}

export async function fetchWines(userId: string): Promise<Wine[]> {
  return withSupabaseAuthRetry(async () => {
    const { data, error } = await getSupabase()
      .from('wines')
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false })
    if (error) throw error
    return (data as WineRow[]).map(wineFromRow)
  })
}

export async function upsertWine(userId: string, wine: Wine, pref?: RankingPreference): Promise<Wine> {
  assertCleanText(wine.notes)
  const normalized = await persistWinePhotos(userId, ensureWineId(wine))
  const resolved = pref ?? resolveRankingPreference()
  const row = wineToRow(userId, normalized, resolved)
  const { error } = await getSupabase().from('wines').upsert(row)
  if (error) throw error
  return applyCompositeRating(normalized, resolved)
}

export async function deleteWine(wineId: string): Promise<void> {
  const {
    data: { user },
  } = await getSupabase().auth.getUser()
  const { error } = await getSupabase().from('wines').delete().eq('id', wineId)
  if (error) throw error
  if (user) {
    try {
      await removeWinePhotoFolder(user.id, wineId)
    } catch {
      // The bottle is already gone. A leftover file can be cleaned up later.
    }
  }
}

export async function bulkUpsertWines(
  userId: string,
  wines: Wine[],
  pref?: RankingPreference,
): Promise<Wine[]> {
  if (wines.length === 0) return []
  for (const wine of wines) assertCleanText(wine.notes)
  const prepared = wines.map(ensureWineId)
  const normalized: Wine[] = []
  for (const wine of prepared) {
    normalized.push(await persistWinePhotos(userId, wine))
  }
  const resolved = pref ?? resolveRankingPreference()
  const rows = normalized.map((w) => wineToRow(userId, w, resolved))
  const { error } = await getSupabase().from('wines').upsert(rows)
  if (error) throw error
  return normalized.map((w) => applyCompositeRating(w, resolved))
}
