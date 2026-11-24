import type { PostgrestError } from '@supabase/supabase-js'
import {
  BADGE_DEFINITIONS,
  compareTiers,
  type BadgeTier,
} from './badges'
import { lockedBadgeSnapshot, maxTierSnapshot, type BadgeTierSnapshot } from './badgeUnlocks'
import { localProgressGeneration } from './progressReset'
import { getSupabase } from './supabase'

interface BadgeTierRow {
  user_id: string
  badge_id: string
  tier: BadgeTier
  updated_at: string
  earned_generation?: number
}

export function isMissingBadgeTiersTable(error: PostgrestError | null): boolean {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /user_badge_tiers/i.test(error.message ?? '')
  )
}

function snapshotFromRows(rows: BadgeTierRow[]): BadgeTierSnapshot {
  const snapshot = lockedBadgeSnapshot()
  for (const row of rows) {
    if (BADGE_DEFINITIONS.some((def) => def.id === row.badge_id)) {
      snapshot[row.badge_id] = row.tier
    }
  }
  return snapshot
}

function rowsFromSnapshot(userId: string, snapshot: BadgeTierSnapshot): BadgeTierRow[] {
  const earnedGeneration = localProgressGeneration(userId)
  return BADGE_DEFINITIONS.map((def) => ({
    user_id: userId,
    badge_id: def.id,
    tier: snapshot[def.id] ?? 'locked',
    updated_at: new Date().toISOString(),
    earned_generation: earnedGeneration,
  })).filter((row) => row.tier !== 'locked')
}

/** Fetch earned badge tiers from Supabase. Returns null if table missing. */
export async function fetchEarnedBadgeTiers(userId: string): Promise<BadgeTierSnapshot | null> {
  const { data, error } = await getSupabase()
    .from('user_badge_tiers')
    .select('user_id, badge_id, tier, updated_at')
    .eq('user_id', userId)

  if (error) {
    if (isMissingBadgeTiersTable(error)) return null
    throw error
  }

  return snapshotFromRows((data ?? []) as BadgeTierRow[])
}

/** Batch fetch earned tiers for multiple users (friends). */
export async function fetchEarnedBadgeTiersForUsers(
  userIds: string[],
): Promise<Map<string, BadgeTierSnapshot>> {
  const result = new Map<string, BadgeTierSnapshot>()
  if (userIds.length === 0) return result

  for (const userId of userIds) {
    result.set(userId, lockedBadgeSnapshot())
  }

  const { data, error } = await getSupabase()
    .from('user_badge_tiers')
    .select('user_id, badge_id, tier, updated_at')
    .in('user_id', userIds)

  if (error) {
    if (isMissingBadgeTiersTable(error)) return result
    throw error
  }

  const rowsByUser = new Map<string, BadgeTierRow[]>()
  for (const row of (data ?? []) as BadgeTierRow[]) {
    const list = rowsByUser.get(row.user_id) ?? []
    list.push(row)
    rowsByUser.set(row.user_id, list)
  }

  for (const [userId, rows] of rowsByUser) {
    result.set(userId, snapshotFromRows(rows))
  }
  return result
}

/** Upsert earned tiers — only writes badges above locked. */
export async function saveEarnedBadgeTiersCloud(
  userId: string,
  snapshot: BadgeTierSnapshot,
): Promise<void> {
  const rows = rowsFromSnapshot(userId, snapshot)
  if (rows.length === 0) return

  const { error } = await getSupabase()
    .from('user_badge_tiers')
    .upsert(rows, { onConflict: 'user_id,badge_id' })

  if (error) {
    if (isMissingBadgeTiersTable(error)) return
    throw error
  }
}

/**
 * Server ledger plus tiers this cellar currently earns.
 * The on-device snapshot is not merged in. It survived resets and was shared
 * across accounts, then uploaded with the current progress generation.
 */
export async function syncEarnedBadgeTiersWithCellar(
  userId: string,
  liveSnapshot: BadgeTierSnapshot,
): Promise<BadgeTierSnapshot> {
  const cloud = await fetchEarnedBadgeTiers(userId)
  if (cloud === null) return liveSnapshot

  const merged = maxTierSnapshot(cloud, liveSnapshot)
  const raised = BADGE_DEFINITIONS.some(
    (def) => compareTiers(merged[def.id] ?? 'locked', cloud[def.id] ?? 'locked') > 0,
  )
  if (raised) await saveEarnedBadgeTiersCloud(userId, merged)
  return merged
}
