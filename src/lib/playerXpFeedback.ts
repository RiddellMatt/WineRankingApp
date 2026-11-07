import type { BadgeInput } from './badges'
import { computePlayerLevel, computeTotalXp, type PlayerLevelInput } from './playerLevel'

export interface PlayerXpDelta {
  gained: number
  leveledUp: boolean
  previousLevel: number
  newLevel: number
  newTitle: string
}

function toLevelInput(input: BadgeInput): PlayerLevelInput {
  return {
    wines: input.wines,
    friendCount: input.friendCount,
    completedJourneys: input.completedJourneys ?? new Set<string>(),
  }
}

export function computePlayerXpDelta(previous: BadgeInput, next: BadgeInput): PlayerXpDelta {
  const prevTotal = computeTotalXp(toLevelInput(previous))
  const nextTotal = computeTotalXp(toLevelInput(next))
  const gained = Math.max(0, nextTotal - prevTotal)
  const previousLevel = computePlayerLevel(toLevelInput(previous))
  const newLevel = computePlayerLevel(toLevelInput(next))
  const leveledUp = newLevel.level > previousLevel.level

  return {
    gained,
    leveledUp,
    previousLevel: previousLevel.level,
    newLevel: newLevel.level,
    newTitle: newLevel.title,
  }
}
