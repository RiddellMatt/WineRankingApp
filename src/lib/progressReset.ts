import { STORAGE_PREFIX } from '../brand'
import { clearLocalProgressData } from './clearLocalAccount'
import { progressGenerationIsNewer } from './progressGeneration'
import { getSupabase } from './supabase'

const GENERATION_KEY = `${STORAGE_PREFIX}.progress-generation.v1`

interface GenerationMap {
  [userId: string]: number
}

const pending = new Map<string, Promise<boolean>>()
/** Once this page load has discarded a generation, later checks must keep saying so.
 *  The generation write makes a second call look current, and that call used to
 *  upload the badge cache the first call had just deleted. */
const discardedThisPageLoad = new Set<string>()

function readMap(): GenerationMap {
  try {
    const raw = localStorage.getItem(GENERATION_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as GenerationMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function localProgressGeneration(userId: string): number {
  const value = readMap()[userId]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function writeLocalGeneration(userId: string, generation: number): void {
  try {
    const map = readMap()
    map[userId] = generation
    localStorage.setItem(GENERATION_KEY, JSON.stringify(map))
  } catch {
    // Private mode. The server rows are already gone; the next launch retries.
  }
}

function generationFromRow(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

async function fetchProgressGeneration(userId: string): Promise<number | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('progress_generation')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    const missing =
      error.code === '42703' || /progress_generation/i.test(error.message ?? '')
    if (missing) return null
    throw error
  }

  if (!data) return 0
  return generationFromRow(data.progress_generation) ?? 0
}

async function discardOnce(userId: string): Promise<boolean> {
  if (discardedThisPageLoad.has(userId)) return true
  const server = await fetchProgressGeneration(userId)
  if (!progressGenerationIsNewer(server, localProgressGeneration(userId))) return false
  clearLocalProgressData(userId)
  writeLocalGeneration(userId, server as number)
  discardedThisPageLoad.add(userId)
  return true
}

/**
 * After scripts/reset-profile.sql bumps profiles.progress_generation, drop this
 * device's cached cellar, badges, and journeys before they merge back up.
 * Returns false when the column is not migrated yet or this device is current.
 */
export function discardLocalProgressIfReset(userId: string): Promise<boolean> {
  const existing = pending.get(userId)
  if (existing) return existing
  const run = discardOnce(userId).finally(() => {
    pending.delete(userId)
  })
  pending.set(userId, run)
  return run
}
