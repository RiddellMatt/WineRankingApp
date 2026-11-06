import {
  activityEventLabel,
  formatActivityTime,
  milestoneHeadline,
  type ActivityEvent,
} from '../lib/activityFeed'
import { compositeScore } from '../lib/ranking'
import { isWishlist } from '../lib/wishlist'
import type { RankingPreference } from '../types'

interface Props {
  events: ActivityEvent[]
  rankingPreference: RankingPreference
  emptyHint: string
}

function wineLine(event: ActivityEvent, rankingPreference: RankingPreference): string {
  const wine = event.wine!
  const title = [wine.name, wine.vintage].filter(Boolean).join(' ')
  if (event.type === 'saved_to_try') {
    return `Saved ${title} to try`
  }
  const score = compositeScore(wine, rankingPreference)
  if (!isWishlist(wine) && score > 0) {
    return `Rated ${title} · ${score.toFixed(1)}`
  }
  return `Logged ${title}`
}

export function OwnActivityFeed({ events, rankingPreference, emptyHint }: Props) {
  if (events.length === 0) {
    return (
      <section className="activity-empty own-activity-empty">
        <p>{emptyHint}</p>
      </section>
    )
  }

  return (
    <ol className="own-activity-feed">
      {events.map((event) => {
        const isMilestone = event.type === 'badge_unlock' || event.type === 'journey_complete'
        if (isMilestone) {
          const headline = milestoneHeadline(event)
          return (
            <li className="own-activity-item" key={event.id}>
              <p className="own-activity-line">
                {activityEventLabel(event.type)}
                {headline ? ` — ${headline}` : ''}
              </p>
              <span className="own-activity-time">{formatActivityTime(event.at)}</span>
            </li>
          )
        }
        return (
          <li className="own-activity-item" key={event.id}>
            <p className="own-activity-line">{wineLine(event, rankingPreference)}</p>
            {event.wine?.winery?.trim() && (
              <p className="own-activity-sub">{event.wine.winery.trim()}</p>
            )}
            <span className="own-activity-time">{formatActivityTime(event.at)}</span>
          </li>
        )
      })}
    </ol>
  )
}
