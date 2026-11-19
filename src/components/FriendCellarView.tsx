import { useEffect, useMemo, useState } from 'react'
import { blockUser } from '../lib/blocksDb'
import { Avatar } from './Avatar'
import { ReportControl } from './ReportSheet'
import { ProfileLevelBar } from './ProfileLevelBar'
import { WineCard } from './WineCard'
import { computePlayerLevel } from '../lib/playerLevel'
import { compareByRank } from '../lib/ranking'
import { triedWines, wishlistIdentityKey, wishlistWines } from '../lib/wishlist'
import { formatWithFriendsNames } from '../lib/wineWithFriends'
import type { RankingPreference, Wine } from '../types'

function sortWinesByRating(wines: Wine[], rankingPreference: RankingPreference): Wine[] {
  return [...wines].sort((a, b) => compareByRank(a, b, rankingPreference))
}

export interface FriendCellarViewProps {
  displayName: string
  avatarUrl?: string
  userId: string
  wines: Wine[]
  /** Scroll to and emphasize this bottle when opening from activity feed. */
  highlightWineId?: string
  rankingPreference: RankingPreference
  shareAttribution?: string
  backButton?: { label: string; onClick: () => void }
  toolbar?: React.ReactNode
  onSaveToWishlist?: (wine: Wine) => void | Promise<void>
  isWishlistSaved?: (wine: Pick<Wine, 'name' | 'winery' | 'vintage'>) => boolean
  wishlistSavingKey?: string | null
  emptyMessage?: string
  completedJourneys?: ReadonlySet<string>
  friendCount?: number
  friendNameById?: Map<string, string>
  /** Report and block. Omitted on the owner's own preview. */
  canModerate?: boolean
  onBlocked?: () => void
}

export function FriendCellarView({
  displayName,
  avatarUrl,
  userId,
  wines,
  highlightWineId,
  rankingPreference,
  shareAttribution,
  backButton,
  toolbar,
  onSaveToWishlist,
  isWishlistSaved,
  wishlistSavingKey = null,
  emptyMessage = "They haven't logged any wines yet.",
  completedJourneys = new Set(),
  friendCount = 0,
  friendNameById,
  canModerate = false,
  onBlocked,
}: FriendCellarViewProps) {
  const [safetyError, setSafetyError] = useState('')
  const [blockBusy, setBlockBusy] = useState(false)
  const rankById = useMemo(() => {
    const tried = triedWines(wines)
    const ordered = sortWinesByRating(tried, rankingPreference)
    return new Map(ordered.map((w, i) => [w.id, i + 1]))
  }, [wines, rankingPreference])

  const tried = triedWines(wines)
  const wishlist = wishlistWines(wines)
  const sorted = sortWinesByRating(tried, rankingPreference)
  const highlightInWishlist = Boolean(
    highlightWineId && wishlist.some((w) => w.id === highlightWineId),
  )

  useEffect(() => {
    if (!highlightWineId) return
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`wine-card-${highlightWineId}`)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el?.classList.add('wine-card-highlight')
    }, 150)
    return () => {
      window.clearTimeout(timer)
      document.getElementById(`wine-card-${highlightWineId}`)?.classList.remove('wine-card-highlight')
    }
  }, [highlightWineId, wines])
  const possessive = displayName.endsWith('s') ? `${displayName}'` : `${displayName}'s`
  const playerLevel = useMemo(
    () => computePlayerLevel({ wines, friendCount, completedJourneys }),
    [wines, friendCount, completedJourneys],
  )

  return (
    <>
      {backButton && (
        <button type="button" className="btn ghost friend-back" onClick={backButton.onClick}>
          {backButton.label}
        </button>
      )}
      {toolbar}
      <div className="friend-cellar-header">
        <Avatar
          displayName={displayName}
          avatarUrl={avatarUrl}
          seed={userId}
          size="lg"
        />
        <div className="friend-cellar-identity">
          <h2 className="friend-cellar-title">{possessive} cellar</h2>
          <ProfileLevelBar level={playerLevel} compact />
          {canModerate && (
            <div className="friend-cellar-safety">
              <ReportControl targetUserId={userId} targetName={displayName} />
              <button
                type="button"
                className="link-btn"
                disabled={blockBusy}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Block ${displayName}? They disappear from your friends, feed, and notifications until you unblock them.`,
                    )
                  ) {
                    return
                  }
                  setBlockBusy(true)
                  setSafetyError('')
                  void blockUser(userId)
                    .then(() => onBlocked?.())
                    .catch((err: unknown) => {
                      setSafetyError(err instanceof Error ? err.message : 'Could not block this person.')
                      setBlockBusy(false)
                    })
                }}
              >
                {blockBusy ? 'Blocking…' : 'Block'}
              </button>
            </div>
          )}
          {safetyError && <p className="form-error">{safetyError}</p>}
        </div>
      </div>
      {tried.length === 0 && wishlist.length === 0 ? (
        <section className="empty">
          <p>{emptyMessage}</p>
        </section>
      ) : (
        <>
          {tried.length > 0 && (
            <ol className="wine-list">
              {sorted.map((wine) => (
                <WineCard
                  key={wine.id}
                  wine={wine}
                  rank={rankById.get(wine.id) ?? 0}
                  rankingPreference={rankingPreference}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  readOnly
                  shareAttribution={shareAttribution}
                  onSaveToWishlist={onSaveToWishlist ? () => onSaveToWishlist(wine) : undefined}
                  wishlistSaved={isWishlistSaved?.(wine)}
                  wishlistSaving={
                    wishlistSavingKey != null && wishlistSavingKey === wishlistIdentityKey(wine)
                  }
                  withFriendsLabel={
                    friendNameById ? formatWithFriendsNames(wine, friendNameById) : null
                  }
                />
              ))}
            </ol>
          )}
          {wishlist.length > 0 && (highlightInWishlist || tried.length === 0) && (
            <section className="friend-cellar-wishlist" aria-label="Want to try">
              <h3 className="friend-cellar-wishlist-title">Want to try</h3>
              <ol className="wine-list">
                {wishlist.map((wine) => (
                  <WineCard
                    key={wine.id}
                    wine={wine}
                    rank={0}
                    rankingPreference={rankingPreference}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    readOnly
                    shareAttribution={shareAttribution}
                    onSaveToWishlist={onSaveToWishlist ? () => onSaveToWishlist(wine) : undefined}
                    wishlistSaved={isWishlistSaved?.(wine)}
                    wishlistSaving={
                      wishlistSavingKey != null && wishlistSavingKey === wishlistIdentityKey(wine)
                    }
                    withFriendsLabel={
                      friendNameById ? formatWithFriendsNames(wine, friendNameById) : null
                    }
                  />
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </>
  )
}
