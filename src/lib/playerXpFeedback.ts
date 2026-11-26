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

export type XpCellarFeedbackAction = 'wait' | 'arm' | 'ignore' | 'award'

export interface XpCellarFeedbackState {
  /** Badge sync for the signed-in cellar has finished. State, so it can still be true from the previous session on the commit that switches accounts. */
  badgeReady: boolean
  /** Same flag as a ref, cleared synchronously when the account changes. */
  progressSynced: boolean
  /** This session has already taken its opening cellar as the baseline. */
  feedbackArmed: boolean
  /** Cellar already counted. Null until the opening cellar is recorded. */
  baseline: unknown
  /** Cellar currently on screen. */
  wines: unknown
}

/**
 * Points announce only after the cellar that was already saved is recorded.
 * The opening snapshot is silent. A later, different cellar is an award.
 * While account sync is cleared, wait — the on-screen list may still be the
 * empty cellar from before sign-in.
 */
export function decideXpCellarFeedback(state: XpCellarFeedbackState): XpCellarFeedbackAction {
  if (!state.badgeReady || !state.progressSynced) return 'wait'
  if (!state.feedbackArmed || state.baseline == null) return 'arm'
  if (state.baseline === state.wines) return 'ignore'
  return 'award'
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
