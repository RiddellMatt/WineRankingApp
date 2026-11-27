import { compareByRank } from './ranking'
import type { RankingPreference, Wine } from '../types'

function rankedTried(list: readonly Wine[], pref: RankingPreference): Wine[] {
  return list
    .filter((wine) => wine.status !== 'wishlist' && wine.rating > 0)
    .sort((a, b) => compareByRank(a, b, pref))
}

/** True when this save newly occupies the top of the cellar. Editing the current top does not count. */
export function becameTopWine(
  before: readonly Wine[],
  saved: Wine,
  pref: RankingPreference,
): boolean {
  if (saved.status === 'wishlist' || !(saved.rating > 0)) return false
  const previousTop = rankedTried(before, pref)[0]
  const nextTop = rankedTried([...before.filter((wine) => wine.id !== saved.id), saved], pref)[0]
  return nextTop?.id === saved.id && previousTop?.id !== saved.id
}
