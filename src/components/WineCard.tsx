import type { RankingPreference, Wine } from '../types'
import { compositeScore, isWineFavorite } from '../lib/ranking'
import { getPairings } from '../pairings'
import { hasTaste, lookupTaste } from '../tasteData'
import { ScoreReadout } from './ScoreSlider'
import { TasteDisplay } from './TasteProfile'
import { ShareWineButton } from './ShareWineButton'
import { tastingTagLabel } from '../lib/tastingTags'
import { WineTypePill } from './WineTypePill'
import { IconHeart, IconMapPin, IconPencil, IconTrash } from './icons/UiIcons'
import { ShopForWine } from './ShopForWine'
import { WinePhotoStrip } from './WinePhotoStrip'
import { formatTriedOn } from '../lib/wineMoments'
import { tastingMoments, timesTried } from '../lib/winePours'
import { formatDollars, winePriceParts } from '../lib/winePrice'

function WinePriceLines({ wine }: { wine: Wine }) {
  const parts = winePriceParts(wine)
  if (parts.length === 0) return null
  return (
    <span className="wine-price">
      {parts.map((part) => (
        <span key={part.serving}>
          {formatDollars(part.amount)} {part.serving}
        </span>
      ))}
    </span>
  )
}

function WineScore({
  score,
  taste,
  value,
}: {
  score: number
  taste: number
  value?: number | null
}) {
  const showParts = taste > 0 && (value ?? 0) > 0

  return (
    <div className="wine-rating">
      <div className="wine-rating-overall">
        <ScoreReadout value={score} />
      </div>
      {showParts && (
        <div className="rating-breakdown">
          <span className="rating-part">
            <span className="rating-part-label">Taste</span>
            <ScoreReadout value={taste} compact />
          </span>
          <span className="rating-part">
            <span className="rating-part-label">Value</span>
            <ScoreReadout value={value ?? 0} compact />
          </span>
        </div>
      )}
    </div>
  )
}

interface Props {
  wine: Wine
  rank: number
  rankingPreference: RankingPreference
  onEdit: () => void
  onDelete: () => void
  onToggleFavorite?: () => void
  readOnly?: boolean
  onSaveToWishlist?: () => void
  wishlistSaved?: boolean
  wishlistSaving?: boolean
  shareAttribution?: string
  activeTagFilter?: string | null
  onTagFilter?: (tagId: string) => void
  /** Resolved names for {@link Wine.withFriendIds}. */
  withFriendsLabel?: string | null
}

export function WineCard({
  wine,
  rank,
  rankingPreference,
  onEdit,
  onDelete,
  onToggleFavorite,
  readOnly = false,
  onSaveToWishlist,
  wishlistSaved = false,
  wishlistSaving = false,
  shareAttribution,
  activeTagFilter = null,
  onTagFilter,
  withFriendsLabel = null,
}: Props) {
  const medal = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : ''
  const meta = [wine.varietal, wine.region].filter(Boolean).join(' · ')
  const score = compositeScore(wine, rankingPreference)
  const favorited = isWineFavorite(wine)

  const reference = lookupTaste(wine.varietal, wine.name, wine.type)
  const ownTaste = hasTaste(wine.taste)
  const taste = ownTaste ? wine.taste : reference.taste
  const isTypical = !ownTaste || wine.tasteSource === 'typical'

  return (
    <li id={`wine-card-${wine.id}`} className="wine-card">
      <div className={`rank-badge ${medal}`}>{rank}</div>

      {!readOnly && onToggleFavorite && (
        <button
          type="button"
          className={`wine-favorite-btn ${favorited ? 'active' : ''}`}
          aria-label={favorited ? `Unfavorite ${wine.name}` : `Favorite ${wine.name}`}
          title={favorited ? 'Remove from favorites' : 'Add to favorites'}
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite()
          }}
        >
          <IconHeart className="wine-favorite-icon" size={20} filled={favorited} />
        </button>
      )}

      {readOnly && onSaveToWishlist && (
        <button
          type="button"
          className={`wine-favorite-btn wine-wishlist-save-btn ${wishlistSaved ? 'active' : ''}`}
          aria-label={wishlistSaved ? 'Saved to try' : `Save ${wine.name} to try`}
          title={wishlistSaved ? 'Saved to try' : 'Save to try'}
          disabled={wishlistSaved || wishlistSaving}
          onClick={(e) => {
            e.stopPropagation()
            onSaveToWishlist()
          }}
        >
          <IconHeart className="wine-favorite-icon" size={20} filled={wishlistSaved} />
        </button>
      )}

      <div className="wine-main">
        <div className="wine-title-row">
          <h3 className="wine-name">
            {wine.name}
            {wine.vintage && <span className="wine-vintage"> {wine.vintage}</span>}
          </h3>
          <WineTypePill type={wine.type} />
        </div>
        {wine.winery && <p className="wine-winery">{wine.winery}</p>}
        {meta && <p className="wine-meta">{meta}</p>}
        {wine.status !== 'wishlist' && (
          <div className="wine-tastings">
            <p className="wine-times">
              {timesTried(wine) === 1 ? 'Tried once' : `Tried ${timesTried(wine)} times`}
            </p>
            {(tastingMoments(wine).length > 1 || tastingMoments(wine).some((moment) => moment.triedOn)) && (
              <ul className="wine-tasting-dates">
                {[...tastingMoments(wine)].reverse().map((moment, index) => (
                  <li key={`${moment.triedOn ?? 'undated'}-${index}`}>
                    {moment.triedOn ? formatTriedOn(moment.triedOn) : 'Date not recorded'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {wine.purchasedAt && (
          <p className="wine-purchased">
            <IconMapPin className="wine-purchased-icon" />
            {wine.purchasedAt}
          </p>
        )}
        <WinePhotoStrip photos={wine.photos ?? []} />
        {withFriendsLabel && (
          <p className="wine-with-friends">
            <span className="wine-with-friends-icon" aria-hidden="true">
              🥂
            </span>
            {withFriendsLabel}
          </p>
        )}
        {wine.notes && <p className="wine-notes">“{wine.notes}”</p>}
        {(wine.tastingTags?.length ?? 0) > 0 && (
          <div
            className="tasting-tags-display"
            onClick={onTagFilter ? (e) => e.stopPropagation() : undefined}
          >
            {wine.tastingTags!.map((id) =>
              onTagFilter ? (
                <button
                  type="button"
                  key={id}
                  className={`tasting-tag-pill tasting-tag-pill-btn ${activeTagFilter === id ? 'active' : ''}`}
                  onClick={() => onTagFilter(id)}
                >
                  {tastingTagLabel(id)}
                </button>
              ) : (
                <span className="tasting-tag-pill" key={id}>
                  {tastingTagLabel(id)}
                </span>
              ),
            )}
          </div>
        )}
        <TasteDisplay taste={taste} />
        {isTypical && (
          <p className="taste-source-caption">Typical {reference.basedOn} profile</p>
        )}
        <div className="pairings">
          <span className="pairings-label">Pairs with</span>
          {getPairings(wine).map((dish) => (
            <span className="pairing-chip" key={dish}>
              {dish}
            </span>
          ))}
        </div>
        {favorited && !readOnly && (
          <div className="wine-find-again">
            <ShopForWine target={wine} wineName={wine.name} variant="text" />
          </div>
        )}
      </div>

      <div className="wine-side">
        <WineScore
          score={score}
          taste={wine.ratingEnjoyment}
          value={wine.ratingValue}
        />
        <WinePriceLines wine={wine} />
        {readOnly ? (
          <div className="wine-readonly-actions">
            <ShareWineButton wine={wine} score={score} attribution={shareAttribution} />
          </div>
        ) : (
          <div className="wine-actions">
            <ShareWineButton wine={wine} score={score} />
            <button className="icon-btn" onClick={onEdit} aria-label={`Edit ${wine.name}`} title="Edit">
              <IconPencil />
            </button>
            <button
              className="icon-btn danger"
              onClick={onDelete}
              aria-label={`Delete ${wine.name}`}
              title="Delete"
            >
              <IconTrash />
            </button>
            <ShopForWine target={wine} wineName={wine.name} variant="icon" />
          </div>
        )}
      </div>
    </li>
  )
}
