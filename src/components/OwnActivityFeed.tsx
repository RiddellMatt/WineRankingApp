import {
  activityEventLabel,
  formatActivityTime,
  type ActivityEvent,
} from '../lib/activityFeed'
import { BADGE_DEFINITIONS, type BadgeTier } from '../lib/badges'
import { compositeScore } from '../lib/ranking'
import { isWishlist } from '../lib/wishlist'
import type { RankingPreference } from '../types'
import { WineTypePill } from './WineTypePill'
import { BadgeMedal } from './BadgeMedal'

interface Props {
  events: ActivityEvent[]
  rankingPreference: RankingPreference
  emptyHint: string
}

function badgeIconForEvent(event: ActivityEvent): string | null {
  const ms = event.milestone
  if (ms?.badgeIcon) return ms.badgeIcon
  const id = ms?.badgeId
  if (!id) return null
  return BADGE_DEFINITIONS.find((def) => def.id === id)?.icon ?? null
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
            event.type === 'badge_unlock' && ms?.badgeTitle ? ms.badgeTitle : null
          const journeyLine =
            event.type === 'journey_complete' && ms?.journeyTitle ? ms.journeyTitle : null
          const prefix =
            event.type === 'badge_unlock' ? 'Earned badge' : activityEventLabel(event.type)
          const detail = badgeLine ?? journeyLine
          const icon = badgeIconForEvent(event) ?? ms?.journeyIcon
          const tier =
            event.type === 'badge_unlock'
              ? ((ms?.tier && ms.tier !== 'locked' ? ms.tier : 'bronze') as BadgeTier)
              : ('gold' as BadgeTier)
          return (
            <li className="own-activity-item own-activity-milestone" key={event.id}>
              <div className="own-activity-milestone-row">
                {icon && (
                  <BadgeMedal
                    icon={icon}
                    tier={tier}
                    size="sm"
                    tierCaption={event.type === 'journey_complete' ? 'Done' : undefined}
                  />
                )}
                <div className="own-activity-milestone-copy">
                  <p className="own-activity-line">
                    {prefix}
                    {detail ? ` — ${detail}` : ''}
                  </p>
                  <span className="own-activity-time">{formatActivityTime(event.at)}</span>
                </div>
              </div>
            </li>
          )
        }
        const wine = event.wine!
        const title = [wine.name, wine.vintage].filter(Boolean).join(' ')
        let actionPrefix = 'Logged'
        if (event.type === 'saved_to_try') {
          actionPrefix = 'Saved to try'
        } else if (!isWishlist(wine) && compositeScore(wine, rankingPreference) > 0) {
          actionPrefix = 'Rated'
        }
        return (
          <li className="own-activity-item own-activity-wine" key={event.id}>
            <p className="own-activity-line">
              {actionPrefix}{' '}
              <span className="own-activity-wine-title">{title}</span>
            </p>
            {event.wine?.winery?.trim() && (
              <p className="own-activity-sub">{event.wine.winery.trim()}</p>
            )}
            <div className="own-activity-footer">
              <span className="own-activity-time">{formatActivityTime(event.at)}</span>
              {wine.type?.trim() ? <WineTypePill type={wine.type} /> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
