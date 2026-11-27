import type { MenuMatch } from '../menuMatch'
import type { ShareWineCardInput } from './shareWineCard'
import { menuMatchToTriedDraft } from './wishlist'

/** A menu pick is a match out of 100, not a bottle the person has already scored out of 10. */
export function menuMatchShareInput(match: MenuMatch): ShareWineCardInput {
  const wine = menuMatchToTriedDraft(match)
  const notes = match.reasons.filter(Boolean).slice(0, 2).join(' ')
  return {
    wine: { ...wine, notes },
    score: match.score,
    scoreMax: 100,
    scoreLabel: `${match.score} match`,
  }
}
