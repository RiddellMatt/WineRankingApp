import { containsPhrase } from '../textMatch'
import { triedWines } from './wishlist'
import type { Wine } from '../types'

export interface JourneyDefinition {
  id: string
  title: string
  description: string
  icon: string
  /** Display label for the region focus */
  regionLabel: string
  /** Keywords matched against wine region text (longest wins for display) */
  keywords: readonly string[]
  /** Tried wines needed to complete */
  requiredWines: number
}

export interface JourneyProgress {
  id: string
  title: string
  description: string
  icon: string
  regionLabel: string
  requiredWines: number
  current: number
  completed: boolean
  /** Permanent completion from earned ledger */
  earnedComplete: boolean
  progressLabel: string
  /** Short in-progress line for passport cards */
  nudge: string | null
  matchingWines: Wine[]
}

export interface JourneyFormHint {
  id: string
  icon: string
  title: string
  line: string
}

export const JOURNEY_DEFINITIONS: JourneyDefinition[] = [
  {
    id: 'tuscany',
    title: 'Tuscan Trail',
    description: 'Log 3 tried wines from Tuscany',
    icon: '🌄',
    regionLabel: 'Tuscany',
    keywords: ['tuscany', 'toscana', 'chianti', 'brunello di montalcino', 'brunello'],
    requiredWines: 3,
  },
  {
    id: 'burgundy',
    title: 'Burgundy Bound',
    description: 'Log 3 tried wines from Burgundy',
    icon: '🍇',
    regionLabel: 'Burgundy',
    keywords: ['burgundy', 'bourgogne', 'chablis', 'beaujolais', 'meursault', 'pommard'],
    requiredWines: 3,
  },
  {
    id: 'rioja',
    title: 'Rioja Ramble',
    description: 'Log 3 tried wines from Rioja',
    icon: '🏰',
    regionLabel: 'Rioja',
    keywords: ['rioja', 'ribera del duero'],
    requiredWines: 3,
  },
  {
    id: 'piedmont',
    title: 'Piedmont Pass',
    description: 'Log 3 tried wines from Piedmont',
    icon: '🏔️',
    regionLabel: 'Piedmont',
    keywords: ['piedmont', 'piemonte', 'barolo', 'barbaresco', 'langhe', 'nebbiolo d alba'],
    requiredWines: 3,
  },
  {
    id: 'marlborough',
    title: 'Marlborough Miles',
    description: 'Log 3 tried wines from Marlborough',
    icon: '🥝',
    regionLabel: 'Marlborough',
    keywords: ['marlborough'],
    requiredWines: 3,
  },
  {
    id: 'napa',
    title: 'Napa Cruise',
    description: 'Log 3 tried wines from Napa Valley',
    icon: '🚗',
    regionLabel: 'Napa Valley',
    keywords: ['napa valley', 'napa', 'oakville', 'rutherford', 'st. helena', 'st helena'],
    requiredWines: 3,
  },
  {
    id: 'champagne',
    title: 'Champagne Chase',
    description: 'Log 3 tried wines from Champagne',
    icon: '🥂',
    regionLabel: 'Champagne',
    keywords: ['champagne', 'reims', 'épernay', 'epernay'],
    requiredWines: 3,
  },
  {
    id: 'douro',
    title: 'Douro Drift',
    description: 'Log 3 tried wines from the Douro',
    icon: '🌊',
    regionLabel: 'Douro',
    keywords: ['douro', 'porto', 'vinho do porto', 'port wine'],
    requiredWines: 3,
  },
  {
    id: 'mosel',
    title: 'Mosel March',
    description: 'Log 3 tried wines from the Mosel',
    icon: '🏞️',
    regionLabel: 'Mosel',
    keywords: ['mosel', 'mosel-saar-ruwer', 'mosel saar ruwer'],
    requiredWines: 3,
  },
  {
    id: 'barossa',
    title: 'Barossa Beat',
    description: 'Log 3 tried wines from Barossa',
    icon: '🦘',
    regionLabel: 'Barossa',
    keywords: ['barossa', 'barossa valley', 'eden valley'],
    requiredWines: 3,
  },
]

const JOURNEY_COMPLETE_LINES: Record<string, string> = {
  tuscany: 'Tuscan Trail complete — three pours, one happy passport.',
  burgundy: 'Burgundy Bound done. Pinot pilgrimage achieved.',
  rioja: 'Rioja Ramble wrapped. Tempranillo territory conquered.',
  piedmont: 'Piedmont Pass cleared. Nebbiolo nods approvingly.',
  marlborough: 'Marlborough Miles done. Sauvignon squad assembled.',
  napa: 'Napa Cruise parked. Cab country logged.',
  champagne: 'Champagne Chase finished. Bubbles badge earned.',
  douro: 'Douro Drift complete. Port path sealed.',
  mosel: 'Mosel March done. Riesling route recorded.',
  barossa: 'Barossa Beat complete. Shiraz stamp acquired.',
}

export function wineMatchesJourney(
  wine: Pick<Wine, 'region'>,
  journey: Pick<JourneyDefinition, 'keywords'>,
): boolean {
  const text = wine.region.trim().toLowerCase()
  if (!text) return false
  return journey.keywords.some((keyword) => containsPhrase(text, keyword))
}

export function matchingJourneyWines(
  wines: Wine[],
  journey: JourneyDefinition,
): Wine[] {
  return triedWines(wines).filter((wine) => wineMatchesJourney(wine, journey))
}

function countTowardJourney(
  wines: Wine[],
  journey: JourneyDefinition,
  options?: { excludeWineId?: string; extraRegion?: string },
): number {
  let count = matchingJourneyWines(wines, journey).length
  if (options?.excludeWineId) {
    const excluded = wines.find((w) => w.id === options.excludeWineId)
    if (excluded && wineMatchesJourney(excluded, journey)) {
      count = Math.max(0, count - 1)
    }
  }
  if (options?.extraRegion && wineMatchesJourney({ region: options.extraRegion }, journey)) {
    count += 1
  }
  return count
}

export function journeyPassportNudge(progress: Pick<
  JourneyProgress,
  'earnedComplete' | 'current' | 'requiredWines' | 'regionLabel' | 'title'
>): string | null {
  if (progress.earnedComplete) return null
  const { current, requiredWines, regionLabel, title } = progress
  if (current === 0) return `Add ${regionLabel} on 3 tried wines to finish`
  const remaining = requiredWines - current
  if (remaining <= 0) return null
  if (remaining === 1) return `One more ${regionLabel} wine finishes ${title}`
  return `${current}/${requiredWines} logged — ${remaining} to go`
}

export function journeyCompleteMessage(journey: JourneyDefinition): string {
  return JOURNEY_COMPLETE_LINES[journey.id] ?? `${journey.title} complete!`
}

/** Hints while logging a tried wine — shows projected journey progress after save. */
export function journeyFormHints(
  region: string,
  cellarWines: Wine[],
  completedJourneys: ReadonlySet<string>,
  options?: { excludeWineId?: string },
): JourneyFormHint[] {
  const trimmed = region.trim()
  if (!trimmed) return []

  const hints: JourneyFormHint[] = []
  for (const def of JOURNEY_DEFINITIONS) {
    if (completedJourneys.has(def.id)) continue
    if (!wineMatchesJourney({ region: trimmed }, def)) continue

    const afterSave = countTowardJourney(cellarWines, def, {
      excludeWineId: options?.excludeWineId,
      extraRegion: trimmed,
    })
    const display = Math.min(afterSave, def.requiredWines)

    hints.push({
      id: def.id,
      icon: def.icon,
      title: def.title,
      line:
        afterSave >= def.requiredWines
          ? `Finishes ${def.title} when you save`
          : `${def.title} · ${display}/${def.requiredWines} after save`,
    })
  }

  return hints.sort((a, b) => a.title.localeCompare(b.title))
}

export function computeJourneyProgress(
  wines: Wine[],
  earnedCompletions: ReadonlySet<string>,
): JourneyProgress[] {
  return JOURNEY_DEFINITIONS.map((def) => {
    const matchingWines = matchingJourneyWines(wines, def)
    const current = matchingWines.length
    const liveComplete = current >= def.requiredWines
    const earnedComplete = earnedCompletions.has(def.id)
    const completed = earnedComplete || liveComplete
    const progressLabel = earnedComplete
      ? 'Complete ✓'
      : completed
        ? 'Complete ✓'
        : `${Math.min(current, def.requiredWines)} / ${def.requiredWines}`

    const base = {
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      regionLabel: def.regionLabel,
      requiredWines: def.requiredWines,
      current,
      completed,
      earnedComplete,
      progressLabel,
      matchingWines,
    }

    return {
      ...base,
      nudge: journeyPassportNudge(base),
    }
  })
}

export function detectNewJourneyCompletions(
  wines: Wine[],
  earnedCompletions: ReadonlySet<string>,
): JourneyDefinition[] {
  const newlyComplete: JourneyDefinition[] = []
  for (const def of JOURNEY_DEFINITIONS) {
    if (earnedCompletions.has(def.id)) continue
    const count = matchingJourneyWines(wines, def).length
    if (count >= def.requiredWines) newlyComplete.push(def)
  }
  return newlyComplete
}

export function completedJourneyCount(earnedCompletions: ReadonlySet<string>): number {
  return JOURNEY_DEFINITIONS.filter((def) => earnedCompletions.has(def.id)).length
}

export function journeyById(id: string): JourneyDefinition | undefined {
  return JOURNEY_DEFINITIONS.find((def) => def.id === id)
}
