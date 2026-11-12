import { useMemo } from 'react'
import { Avatar } from './Avatar'
import { ProfileLevelBar } from './ProfileLevelBar'
import { WineCard } from './WineCard'
import { computePlayerLevel } from '../lib/playerLevel'
import { compareByRank } from '../lib/ranking'
import { triedWines, wishlistIdentityKey } from '../lib/wishlist'
import type { RankingPreference, Wine } from '../types'

function sortWinesByRating(wines: Wine[], rankingPreference: RankingPreference): Wine[] {
  return [...wines].sort((a, b) => compareByRank(a, b, rankingPreference))
}

export interface FriendCellarViewProps {
  displayName: string
  avatarUrl?: string
  userId: string
  wines: Wine[]
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
}

export function FriendCellarView({
  displayName,
  avatarUrl,
  userId,
  wines,
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
}: FriendCellarViewProps) {
  const rankById = useMemo(() => {
    const tried = triedWines(wines)
    const ordered = sortWinesByRating(tried, rankingPreference)
    return new Map(ordered.map((w, i) => [w.id, i + 1]))
  }, [wines, rankingPreference])

  const tried = triedWines(wines)
  const sorted = sortWinesByRating(tried, rankingPreference)
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
        </div>
      </div>
      {tried.length === 0 ? (
        <section className="empty">
          <p>{emptyMessage}</p>
        </section>
      ) : (
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
            />
          ))}
        </ol>
      )}
    </>
  )
}
