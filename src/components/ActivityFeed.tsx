import { Avatar } from './Avatar'
import {
  activityEventLabel,
  actorLabel,
  formatActivityTime,
  type ActivityEvent,
  wineActivitySubtitle,
  wineActivityTitle,
} from '../lib/activityFeed'
import { compositeScore } from '../lib/ranking'
import { isWishlist } from '../lib/wishlist'
import type { RankingPreference } from '../types'

interface Props {
  events: ActivityEvent[]
  viewerId: string
  rankingPreference: RankingPreference
  loading?: boolean
  emptyHint: string
  onViewCellar: (friendId: string, friendName: string, avatarUrl?: string) => void
}

export function ActivityFeed({
  events,
  viewerId,
  rankingPreference,
  loading = false,
  emptyHint,
  onViewCellar,
}: Props) {
  if (loading) {
    return <p className="auth-info activity-loading">Loading activity…</p>
  }

  if (events.length === 0) {
    return (
      <section className="activity-empty">
        <span className="empty-icon" aria-hidden="true">
          🥂
        </span>
        <p>{emptyHint}</p>
      </section>
    )
  }

  return (
    <ol className="activity-feed">
      {events.map((event) => {
        const name = actorLabel(event.actor, viewerId)
        const title = wineActivityTitle(event.wine)
        const subtitle = wineActivitySubtitle(event.wine)
        const score = compositeScore(event.wine, rankingPreference)
        const isOwn = event.actor.id === viewerId

        return (
          <li className="activity-item" key={event.id}>
            <Avatar
              displayName={name}
              email={event.actor.email}
              avatarUrl={event.actor.avatarUrl}
              seed={event.actor.id}
              size="sm"
            />
            <div className="activity-body">
              <p className="activity-line">
                <strong>{name}</strong> {activityEventLabel(event.type)}{' '}
                <span className="activity-wine">{title}</span>
                {event.type === 'logged' && !isWishlist(event.wine) && score > 0 && (
                  <span className="activity-rating"> · {score.toFixed(1)}★</span>
                )}
              </p>
              {subtitle && <p className="activity-sub">{subtitle}</p>}
              <div className="activity-meta">
                <span>{formatActivityTime(event.at)}</span>
                {!isOwn && (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() =>
                      onViewCellar(
                        event.actor.id,
                        actorLabel(event.actor, viewerId),
                        event.actor.avatarUrl,
                      )
                    }
                  >
                    View cellar
                  </button>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
