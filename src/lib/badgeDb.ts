import type { PostgrestError } from '@supabase/supabase-js'
import {
  BADGE_DEFINITIONS,
  type BadgeTier,
} from './badges'
import {
  lockedBadgeSnapshot,
  maxTierSnapshot,
  type BadgeTierSnapshot,
} from './badgeUnlocks'
import { getSupabase } from './supabase'

interface BadgeTierRow {
  user_id: string
  badge_id: string
  tier: BadgeTier
  updated_at: string
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
  return BADGE_DEFINITIONS.map((def) => ({
    user_id: userId,
    badge_id: def.id,
    tier: snapshot[def.id] ?? 'locked',
    updated_at: new Date().toISOString(),
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

/** Merge local + cloud earned tiers, preferring higher tier. Upload if local wins. */
export async function syncEarnedBadgeTiers(
  userId: string,
  localSnapshot: BadgeTierSnapshot | null,
): Promise<BadgeTierSnapshot> {
  const cloud = await fetchEarnedBadgeTiers(userId)
  if (cloud === null) {
    return localSnapshot ?? lockedBadgeSnapshot()
  }

  const merged = maxTierSnapshot(cloud, localSnapshot ?? lockedBadgeSnapshot())

  if (localSnapshot) {
    const localWins = BADGE_DEFINITIONS.some((def) => {
      const localTier = localSnapshot[def.id] ?? 'locked'
      const cloudTier = cloud[def.id] ?? 'locked'
      return localTier !== cloudTier && merged[def.id] === localTier
    })
    if (localWins) {
      await saveEarnedBadgeTiersCloud(userId, merged)
    }
  }

  return merged
}
