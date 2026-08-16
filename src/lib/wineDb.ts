import type { Wine, WineType, TasteProfile } from '../types'
import { getSupabase, type WineRow } from './supabase'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function ensureWineId(wine: Wine): Wine {
  if (UUID_RE.test(wine.id)) return wine
  return { ...wine, id: crypto.randomUUID() }
}

export function wineFromRow(row: WineRow): Wine {
  return {
    id: row.id,
    name: row.name,
    winery: row.winery,
    vintage: row.vintage,
    type: row.type as WineType,
    varietal: row.varietal,
    region: row.region,
    price: row.price != null ? Number(row.price) : null,
    rating: Number(row.rating),
    notes: row.notes,
    purchasedAt: row.purchased_at,
    taste: (row.taste ?? {}) as TasteProfile,
    tasteSource: row.taste_source === 'custom' ? 'custom' : row.taste_source === 'typical' ? 'typical' : undefined,
    addedAt: row.added_at,
  }
}

export function wineToRow(userId: string, wine: Wine): Omit<WineRow, 'user_id'> & { user_id: string } {
  return {
    id: wine.id,
    user_id: userId,
    name: wine.name,
    winery: wine.winery,
    vintage: wine.vintage,
    type: wine.type,
    varietal: wine.varietal,
    region: wine.region,
    price: wine.price,
    rating: wine.rating,
    notes: wine.notes,
    purchased_at: wine.purchasedAt,
    taste: (wine.taste ?? {}) as Record<string, number>,
    taste_source: wine.tasteSource ?? null,
    added_at: wine.addedAt,
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

export async function upsertWine(userId: string, wine: Wine): Promise<Wine> {
  const normalized = ensureWineId(wine)
  const row = wineToRow(userId, normalized)
  const { error } = await getSupabase().from('wines').upsert(row)
  if (error) throw error
  return normalized
}

export async function deleteWine(wineId: string): Promise<void> {
  const { error } = await getSupabase().from('wines').delete().eq('id', wineId)
  if (error) throw error
}

export async function bulkUpsertWines(userId: string, wines: Wine[]): Promise<Wine[]> {
  if (wines.length === 0) return []
  const normalized = wines.map(ensureWineId)
  const rows = normalized.map((w) => wineToRow(userId, w))
  const { error } = await getSupabase().from('wines').upsert(rows)
  if (error) throw error
  return normalized
}
