import { JOURNEY_DEFINITIONS, matchingJourneyWines } from './journeys'
import type { PassportStamp } from './passportAtlas'
import { wineOriginCountry } from './wineGeo'
import { triedWines } from './wishlist'
import type { Wine } from '../types'

export function winesForPassportStamp(stamp: PassportStamp, wines: Wine[]): Wine[] {
  const tried = triedWines(wines)
  if (stamp.kind === 'country') {
    return tried
      .filter((w) => wineOriginCountry(w) === stamp.label)
      .sort((a, b) => b.addedAt - a.addedAt)
  }

  const journeyId = stamp.id.replace(/^journey-/, '')
  const def = JOURNEY_DEFINITIONS.find((j) => j.id === journeyId)
  if (!def) return []
  return matchingJourneyWines(tried, def).sort((a, b) => b.addedAt - a.addedAt)
}
