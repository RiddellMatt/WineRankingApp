import { formatWinePriceSummary } from '../lib/winePrice'
import type { Wine } from '../types'
import { formatWishlistDate } from '../lib/wishlist'
import { ShopForWine } from './ShopForWine'

interface Props {
  wine: Wine
  onMarkTried: () => void
  onEdit: () => void
  onDelete: () => void
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

export function WishlistCard({ wine, onMarkTried, onEdit, onDelete }: Props) {
  const meta = [wine.varietal, wine.region].filter(Boolean).join(' · ')
  const priceLabel = formatWinePriceSummary(wine)

  return (
    <li className="wishlist-card">
      <div className="wishlist-main">
        <div className="wine-title-row">
          <h3 className="wine-name">
            {wine.name}
            {wine.vintage && <span className="wine-vintage"> {wine.vintage}</span>}
          </h3>
          <span className={`type-pill ${TYPE_CLASS[wine.type] ?? ''}`}>{wine.type}</span>
        </div>
        {wine.winery && <p className="wine-winery">{wine.winery}</p>}
        {meta && <p className="wine-meta">{meta}</p>}
        <p className="wishlist-meta">
          {priceLabel && <span className="wishlist-price">{priceLabel}</span>}
          <span className="wishlist-saved">Saved {formatWishlistDate(wine.addedAt)}</span>
        </p>
        {wine.notes && <p className="wine-notes">“{wine.notes}”</p>}
      </div>

      <div className="wishlist-actions">
        <button type="button" className="btn primary small" onClick={onMarkTried}>
          Mark as tried
        </button>
        <button type="button" className="btn ghost small" onClick={onEdit}>
          Edit
        </button>
        <ShopForWine target={wine} wineName={wine.name} variant="text" />
        <button type="button" className="link-btn wishlist-remove" onClick={onDelete}>
          Remove
        </button>
      </div>
    </li>
  )
}
