import type { Wine, WineType, TasteProfile, RankingPreference } from '../types'
import { getSupabase, type WineRow } from './supabase'
import { applyCompositeRating, resolveRankingPreference, wineEnjoyment } from './ranking'

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
    purchasedAt: row.purchased_at,
    taste: (row.taste ?? {}) as TasteProfile,
    tasteSource: row.taste_source === 'custom' ? 'custom' : row.taste_source === 'typical' ? 'typical' : undefined,
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
    purchased_at: normalized.purchasedAt,
    taste: (normalized.taste ?? {}) as Record<string, number>,
    taste_source: normalized.tasteSource ?? null,
    added_at: normalized.addedAt,
  }
}

export async function fetchWines(userId: string): Promise<Wine[]> {
  const { data, error } = await getSupabase()
    .from('wines')
    .select('*')
    .eq('user_id', userId)
    .order('added_at', { ascending: false })
  if (error) throw error
  return (data as WineRow[]).map(wineFromRow)
}

export async function upsertWine(userId: string, wine: Wine, pref?: RankingPreference): Promise<Wine> {
  const normalized = ensureWineId(wine)
  const resolved = pref ?? resolveRankingPreference()
  const row = wineToRow(userId, normalized, resolved)
  const { error } = await getSupabase().from('wines').upsert(row)
  if (error) throw error
  return applyCompositeRating(normalized, resolved)
}

export async function deleteWine(wineId: string): Promise<void> {
  const { error } = await getSupabase().from('wines').delete().eq('id', wineId)
  if (error) throw error
}

export async function bulkUpsertWines(
  userId: string,
  wines: Wine[],
  pref?: RankingPreference,
): Promise<Wine[]> {
  if (wines.length === 0) return []
  const normalized = wines.map(ensureWineId)
  const resolved = pref ?? resolveRankingPreference()
  const rows = normalized.map((w) => wineToRow(userId, w, resolved))
  const { error } = await getSupabase().from('wines').upsert(rows)
  if (error) throw error
  return normalized.map((w) => applyCompositeRating(w, resolved))
}
