import type { RankingPreference, Wine } from '../types'
import { shopUrl } from '../config'
import { compositeScore, isWineFavorite } from '../lib/ranking'
import { getPairings } from '../pairings'
import { hasTaste, lookupTaste } from '../tasteData'
import { StarDisplay } from './StarRating'
import { TasteDisplay } from './TasteProfile'
import { ShareWineButton } from './ShareWineButton'
import { tastingTagLabel } from '../lib/tastingTags'
import { IconGlobe, IconHeart, IconMapPin, IconPencil, IconTrash } from './icons/UiIcons'

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
}

const TYPE_CLASS: Record<string, string> = {
  Red: 'type-red',
  White: 'type-white',
  'Rosé': 'type-rose',
  Sparkling: 'type-sparkling',
  Orange: 'type-orange',
  Dessert: 'type-dessert',
  Fortified: 'type-fortified',
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
}: Props) {
  const medal = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : ''
  const meta = [wine.varietal, wine.region].filter(Boolean).join(' · ')
  const score = compositeScore(wine, rankingPreference)
  const favorited = isWineFavorite(wine)

  // Show the wine's own profile when it has one; otherwise fall back to the
  // reference profile for its varietal/type so stats are always available.
  const reference = lookupTaste(wine.varietal, wine.name, wine.type)
  const ownTaste = hasTaste(wine.taste)
  const taste = ownTaste ? wine.taste : reference.taste
  const isTypical = !ownTaste || wine.tasteSource === 'typical'

  return (
    <li
      id={`wine-card-${wine.id}`}
      className={`wine-card ${readOnly ? '' : 'clickable'}`}
      onClick={readOnly ? undefined : onEdit}
      onKeyDown={
        readOnly
          ? undefined
          : (e) => {
              if (e.key === 'Enter' && e.target === e.currentTarget) onEdit()
            }
      }
      tabIndex={readOnly ? undefined : 0}
      aria-label={readOnly ? undefined : `Edit ${wine.name}`}
    >
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

      <div className="wine-main">
        <div className="wine-title-row">
          <h3 className="wine-name">
            {wine.name}
            {wine.vintage && <span className="wine-vintage"> {wine.vintage}</span>}
          </h3>
          <span className={`type-pill ${TYPE_CLASS[wine.type] ?? ''}`}>{wine.type}</span>
        </div>
        {wine.winery && <p className="wine-winery">{wine.winery}</p>}
        {meta && <p className="wine-meta">{meta}</p>}
        {wine.purchasedAt && (
          <p className="wine-purchased">
            <IconMapPin className="wine-purchased-icon" />
            {wine.purchasedAt}
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
      </div>

      <div className="wine-side" onClick={readOnly ? undefined : (e) => e.stopPropagation()}>
        <div className="wine-rating">
          <StarDisplay value={score} />
          <span className="rating-number">{score.toFixed(1)}</span>
          {(wine.ratingValue ?? 0) > 0 && (
            <span className="rating-breakdown">
              T {wine.ratingEnjoyment.toFixed(1)} · V {wine.ratingValue!.toFixed(1)}
            </span>
          )}
        </div>
        {wine.price != null && <span className="wine-price">${wine.price.toFixed(0)}</span>}
        {readOnly && onSaveToWishlist ? (
          <div className="wine-readonly-actions">
            <ShareWineButton
              wine={wine}
              score={score}
              attribution={shareAttribution}
            />
            <button
              type="button"
              className={`btn ghost small wine-save-wishlist-btn ${wishlistSaved ? 'saved' : ''}`}
              disabled={wishlistSaved || wishlistSaving}
              onClick={(e) => {
                e.stopPropagation()
                onSaveToWishlist()
              }}
            >
              {wishlistSaved ? (
                'Saved to try ✓'
              ) : wishlistSaving ? (
                'Saving…'
              ) : (
                <>
                  <IconHeart className="wine-wishlist-icon" /> Save to try
                </>
              )}
            </button>
          </div>
        ) : !readOnly ? (
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
          <a
            className="icon-btn"
            href={shopUrl(wine)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Shop for ${wine.name}`}
            title="Find this wine online"
          >
            <IconGlobe />
          </a>
        </div>
        ) : null}
      </div>
    </li>
  )
}
