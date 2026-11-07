import { STORAGE_PREFIX } from '../brand'
import type { Wine } from '../types'
import { triedWines } from './wishlist'
import { wineOriginCountry } from './wineGeo'
import { JOURNEY_DEFINITIONS, wineMatchesJourney } from './journeys'

const JOIN_KEY = `${STORAGE_PREFIX}.monthly-challenge-join.v1`

export type MonthlyChallengeKind = 'log_tried' | 'new_countries' | 'tagged_tasting' | 'journey_wines'

export interface MonthlyChallengeDefinition {
  id: string
  kind: MonthlyChallengeKind
  icon: string
  title: string
  description: string
  target: number
}

export interface MonthlyChallengeProgress {
  current: number
  target: number
  complete: boolean
  percent: number
  progressLabel: string
}

export interface MonthlyChallengeFriendRow {
  id: string
  name: string
  avatarUrl?: string
  percent: number
  current: number
  target: number
  complete: boolean
  isYou: boolean
}

const CATALOG: MonthlyChallengeDefinition[] = [
  {
    id: 'monthly-log',
    kind: 'log_tried',
    icon: '🍷',
    title: 'Keep the streak',
    description: 'Log tried wines this month',
    target: 4,
  },
  {
    id: 'monthly-countries',
    kind: 'new_countries',
    icon: '🌍',
    title: 'New horizons',
    description: 'Try wines from countries you had not logged before this month',
    target: 2,
  },
  {
    id: 'monthly-tags',
    kind: 'tagged_tasting',
    icon: '🏷️',
    title: 'Flavor notes',
    description: 'Rate tried wines with at least one tasting tag',
    target: 3,
  },
  {
    id: 'monthly-journey',
    kind: 'journey_wines',
    icon: '🧭',
    title: 'Trail progress',
    description: 'Log tried wines that count toward an open regional journey',
    target: 3,
  },
]

function monthIndex(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth()
}

export function monthKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function monthDisplayLabel(date: Date = new Date()): string {
  return date.toLocaleString(undefined, { month: 'long', year: 'numeric' })
}

export function challengeForMonth(date: Date = new Date()): MonthlyChallengeDefinition {
  const idx = ((monthIndex(date) % CATALOG.length) + CATALOG.length) % CATALOG.length
  return CATALOG[idx]!
}

function monthRangeMs(key: string): { start: number; end: number } {
  const [y, m] = key.split('-').map(Number)
  const start = new Date(y!, m! - 1, 1).getTime()
  const end = new Date(y!, m!, 1).getTime()
  return { start, end }
}

function winesAddedInMonth(wines: Wine[], key: string): Wine[] {
  const { start, end } = monthRangeMs(key)
  return triedWines(wines).filter((w) => w.addedAt >= start && w.addedAt < end)
}

function countriesBeforeMonth(wines: Wine[], key: string): Set<string> {
  const { start } = monthRangeMs(key)
  const countries = new Set<string>()
  for (const w of triedWines(wines)) {
    if (w.addedAt >= start) continue
    const c = wineOriginCountry(w)
    if (c) countries.add(c)
  }
  return countries
}

function countNewCountryWinesInMonth(wines: Wine[], key: string): number {
  const before = countriesBeforeMonth(wines, key)
  const inMonth = winesAddedInMonth(wines, key)
  let count = 0
  const seenNew = new Set<string>()
  for (const w of inMonth) {
    const c = wineOriginCountry(w)
    if (!c || before.has(c) || seenNew.has(c)) continue
    seenNew.add(c)
    count += 1
  }
  return count
}

function countJourneyWinesInMonth(
  wines: Wine[],
  key: string,
  completedJourneys: ReadonlySet<string>,
): number {
  const inMonth = winesAddedInMonth(wines, key)
  const openJourneys = JOURNEY_DEFINITIONS.filter((j) => !completedJourneys.has(j.id))
  let count = 0
  for (const w of inMonth) {
    if (openJourneys.some((j) => wineMatchesJourney(w, j))) count += 1
  }
  return count
}

function progressFromCount(current: number, target: number): MonthlyChallengeProgress {
  const capped = Math.min(current, target)
  const complete = current >= target
  const percent = target > 0 ? Math.min(100, Math.round((capped / target) * 100)) : 0
  return {
    current: capped,
    target,
    complete,
    percent,
    progressLabel: complete ? 'Complete' : `${capped} / ${target}`,
  }
}

export function computeMonthlyChallengeProgress(
  challenge: MonthlyChallengeDefinition,
  wines: Wine[],
  completedJourneys: ReadonlySet<string>,
  refDate: Date = new Date(),
): MonthlyChallengeProgress {
  const key = monthKey(refDate)
  let current = 0

  switch (challenge.kind) {
    case 'log_tried':
      current = winesAddedInMonth(wines, key).length
      break
    case 'new_countries':
      current = countNewCountryWinesInMonth(wines, key)
      break
    case 'tagged_tasting':
      current = winesAddedInMonth(wines, key).filter(
        (w) => (w.tastingTags?.length ?? 0) > 0,
      ).length
      break
    case 'journey_wines':
      current = countJourneyWinesInMonth(wines, key, completedJourneys)
      break
    default:
      current = 0
  }

  return progressFromCount(current, challenge.target)
}

export function loadMonthlyChallengeJoined(key: string): boolean {
  try {
    const raw = localStorage.getItem(JOIN_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as Record<string, boolean>
    return Boolean(parsed?.[key])
  } catch {
    return false
  }
}

export function saveMonthlyChallengeJoined(key: string, joined: boolean): void {
  try {
    const raw = localStorage.getItem(JOIN_KEY)
    const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
    if (joined) parsed[key] = true
    else delete parsed[key]
    localStorage.setItem(JOIN_KEY, JSON.stringify(parsed))
  } catch {
    // ignore quota / private mode
  }
}

export function buildMonthlyChallengeFriends(
  challenge: MonthlyChallengeDefinition,
  yourWines: Wine[],
  yourCompletedJourneys: ReadonlySet<string>,
  friends: { id: string; name: string; avatarUrl?: string; tried: Wine[] }[],
  refDate: Date = new Date(),
): MonthlyChallengeFriendRow[] {
  const you = computeMonthlyChallengeProgress(challenge, yourWines, yourCompletedJourneys, refDate)
  const rows: MonthlyChallengeFriendRow[] = [
    {
      id: 'you',
      name: 'You',
      percent: you.percent,
      current: you.current,
      target: you.target,
      complete: you.complete,
      isYou: true,
    },
    ...friends.map((f) => {
      const progress = computeMonthlyChallengeProgress(
        challenge,
        f.tried,
        new Set<string>(),
        refDate,
      )
      return {
        id: f.id,
        name: f.name,
        avatarUrl: f.avatarUrl,
        percent: progress.percent,
        current: progress.current,
        target: progress.target,
        complete: progress.complete,
        isYou: false,
      }
    }),
  ]

  rows.sort((a, b) => b.percent - a.percent || b.current - a.current || a.name.localeCompare(b.name))
  return rows
}

/** Exposed for tests / logging hints. */
export function monthlyChallengeDetailLine(challenge: MonthlyChallengeDefinition): string {
  const n = challenge.target
  switch (challenge.kind) {
    case 'log_tried':
      return `Log ${n} tried wines in ${monthDisplayLabel()}`
    case 'new_countries':
      return `Try ${n} new origin ${n === 1 ? 'country' : 'countries'} this month`
    case 'tagged_tasting':
      return `Rate ${n} wines with tasting tags this month`
    case 'journey_wines':
      return `Log ${n} tried wines toward an open journey this month`
    default:
      return challenge.description
  }
}
