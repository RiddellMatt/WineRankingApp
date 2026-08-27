import { Avatar } from './Avatar'
import { ShareWineButton } from './ShareWineButton'
import {
  ACTIVITY_REACTIONS,
  type ReactionType,
} from '../lib/activityReactions'
import {
  activityEventLabel,
  actorLabel,
  formatActivityTime,
  type ActivityEvent,
  wineActivitySubtitle,
  wineActivityTitle,
} from '../lib/activityFeed'
import { compositeScore } from '../lib/ranking'
import { isWishlist, wishlistIdentityKey } from '../lib/wishlist'
import type { RankingPreference, Wine } from '../types'

interface Props {
  events: ActivityEvent[]
  viewerId: string
  rankingPreference: RankingPreference
  loading?: boolean
  emptyHint: string
  reactionsEnabled?: boolean
  onViewCellar: (friendId: string, friendName: string, avatarUrl?: string) => void
  onSaveToWishlist?: (wine: Wine, friendName: string) => void | Promise<void>
  isWishlistSaved?: (wine: Pick<Wine, 'name' | 'winery' | 'vintage'>) => boolean
  savingWishlistKey?: string | null
  onToggleReaction?: (event: ActivityEvent, reaction: ReactionType) => void | Promise<void>
  togglingReactionKey?: string | null
}

export function ActivityFeed({
  events,
  viewerId,
  rankingPreference,
  loading = false,
  emptyHint,
  reactionsEnabled = false,
  onViewCellar,
  onSaveToWishlist,
  isWishlistSaved,
  savingWishlistKey = null,
  onToggleReaction,
  togglingReactionKey = null,
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
        const canSave =
          !isOwn &&
          event.type === 'logged' &&
          !isWishlist(event.wine) &&
          Boolean(onSaveToWishlist)
        const canShare =
          event.type === 'logged' && !isWishlist(event.wine) && score > 0
        const shareAttribution = isOwn ? undefined : `${name}'s pick`
        const saved = canSave && (isWishlistSaved?.(event.wine) ?? false)
        const saving = canSave && savingWishlistKey === wishlistIdentityKey(event.wine)
        const canReact =
          reactionsEnabled && !isOwn && Boolean(onToggleReaction)
        const reactions = event.reactions
        const reactionBusy = togglingReactionKey === event.id

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
                {canShare && (
                  <ShareWineButton
                    wine={event.wine}
                    score={score}
                    attribution={shareAttribution}
                    compact
                  />
                )}
                {canSave && (
                  <button
                    type="button"
                    className={`link-btn activity-save-btn ${saved ? 'saved' : ''}`}
                    disabled={saved || saving}
                    onClick={() => onSaveToWishlist!(event.wine, name)}
                  >
                    {saved ? 'Saved to try ✓' : saving ? 'Saving…' : '♡ Save to try'}
                  </button>
                )}
              </div>
              {canReact && (
                <div className="activity-reactions" role="group" aria-label="React to this activity">
                  {ACTIVITY_REACTIONS.map(({ type, emoji, label }) => {
                    const count = reactions?.counts[type] ?? 0
                    const active = reactions?.myReaction === type
                    return (
                      <button
                        key={type}
                        type="button"
                        className={`activity-reaction-btn ${active ? 'active' : ''}`}
                        disabled={reactionBusy}
                        aria-pressed={active}
                        aria-label={`${label}${count > 0 ? `, ${count}` : ''}`}
                        title={label}
                        onClick={() => onToggleReaction!(event, type)}
                      >
                        <span className="activity-reaction-emoji" aria-hidden="true">
                          {emoji}
                        </span>
                        {count > 0 && (
                          <span className="activity-reaction-count">{count}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
