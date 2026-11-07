import {
  activityEventLabel,
  formatActivityTime,
  type ActivityEvent,
} from '../lib/activityFeed'
import { tierLabel, type BadgeTier } from '../lib/badges'
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
          const ms = event.milestone
          const badgeLine =
            event.type === 'badge_unlock' && ms?.badgeTitle
              ? `${ms.badgeTitle}${ms.tier && ms.tier !== 'locked' ? ` · ${tierLabel(ms.tier as BadgeTier)}` : ''}`
              : null
          const journeyLine =
            event.type === 'journey_complete' && ms?.journeyTitle ? ms.journeyTitle : null
          const prefix =
            event.type === 'badge_unlock' ? 'Earned badge' : activityEventLabel(event.type)
          const detail = badgeLine ?? journeyLine
          const icon = ms?.badgeIcon ?? ms?.journeyIcon
          return (
            <li className="own-activity-item own-activity-milestone" key={event.id}>
              <div className="own-activity-milestone-row">
                {icon && (
                  <span className="own-activity-milestone-icon" aria-hidden="true">
                    {icon}
                  </span>
                )}
                <p className="own-activity-line">
                  {prefix}
                  {detail ? ` — ${detail}` : ''}
                </p>
              </div>
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
