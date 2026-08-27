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
  matchingWines: Wine[]
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
    keywords: ['rioja', 'ribera del duero', 'tempranillo rioja'],
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
    keywords: ['marlborough', 'sauvignon blanc marlborough'],
    requiredWines: 3,
  },
]

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

    return {
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
