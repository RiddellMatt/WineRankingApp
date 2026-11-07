import type { JourneyProgress } from './journeys'
import type { PersonalPassport } from './explorerStats'
import type { FriendStandingRow } from './explorerStats'

export type PassportStampKind = 'country' | 'journey'

export interface PassportStamp {
  id: string
  kind: PassportStampKind
  label: string
  icon: string
  detail?: string
}

export function pickActiveJourney(journeys: JourneyProgress[]): JourneyProgress | null {
  const open = journeys.filter((j) => !j.earnedComplete)
  if (open.length === 0) return null
  const started = open.find((j) => j.current > 0)
  return started ?? open[0]!
}

export function buildPassportStamps(
  passport: PersonalPassport,
  journeys: JourneyProgress[],
): PassportStamp[] {
  const countryStamps: PassportStamp[] = passport.countries.map((entry) => ({
    id: `country-${entry.label}`,
    kind: 'country',
    label: entry.label,
    icon: countryIcon(entry.label),
    detail: entry.count === 1 ? '1 wine' : `${entry.count} wines`,
  }))

  const journeyStamps: PassportStamp[] = journeys
    .filter((j) => j.earnedComplete)
    .map((j) => ({
      id: `journey-${j.id}`,
      kind: 'journey',
      label: j.regionLabel,
      icon: j.icon,
      detail: j.title,
    }))

  return [...journeyStamps, ...countryStamps].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'journey' ? -1 : 1
    return a.label.localeCompare(b.label)
  })
}

function countryIcon(country: string): string {
  const map: Record<string, string> = {
    France: '🇫🇷',
    Italy: '🇮🇹',
    Spain: '🇪🇸',
    'United States': '🇺🇸',
    Argentina: '🇦🇷',
    Chile: '🇨🇱',
    Australia: '🇦🇺',
    'New Zealand': '🇳🇿',
    Portugal: '🇵🇹',
    Germany: '🇩🇪',
    'South Africa': '🇿🇦',
  }
  return map[country] ?? '🌍'
}

export function passportSocialHook(
  standings: FriendStandingRow[],
): { message: string; category: string; youLead: boolean } | null {
  if (standings.length === 0) return null

  const lead = standings.find((s) => s.youLead)
  if (lead) {
    return {
      message: `You lead your friends on ${lead.category.toLowerCase()}.`,
      category: lead.category,
      youLead: true,
    }
  }

  const chase = standings.reduce((best, row) => {
    const gap = row.leaderCount - row.you
    if (gap <= 0) return best
    if (!best || gap < best.gap) return { row, gap }
    return best
  }, null as { row: FriendStandingRow; gap: number } | null)

  if (!chase) return null

  return {
    message: `${chase.row.leaderName} leads on ${chase.row.category.toLowerCase()} (${chase.row.leaderCount} · you ${chase.row.you}).`,
    category: chase.row.category,
    youLead: false,
  }
}
