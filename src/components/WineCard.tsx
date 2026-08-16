import type { Wine } from '../types'
import { shopUrl } from '../config'
import { getPairings } from '../pairings'
import { StarDisplay } from './StarRating'
import { TasteDisplay } from './TasteProfile'

interface Props {
  wine: Wine
  rank: number
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

export function WineCard({ wine, rank, onEdit, onDelete }: Props) {
  const medal = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : ''
  const meta = [wine.varietal, wine.region].filter(Boolean).join(' · ')

  return (
    <li className="wine-card">
      <div className={`rank-badge ${medal}`}>{rank}</div>

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
            <span aria-hidden="true">🛍</span> {wine.purchasedAt}
          </p>
        )}
        {wine.notes && <p className="wine-notes">“{wine.notes}”</p>}
        <TasteDisplay taste={wine.taste ?? {}} />
        <div className="pairings">
          <span className="pairings-label">Pairs with</span>
          {getPairings(wine).map((dish) => (
            <span className="pairing-chip" key={dish}>
              {dish}
            </span>
          ))}
        </div>
      </div>

      <div className="wine-side">
        <div className="wine-rating">
          <StarDisplay value={wine.rating} />
          <span className="rating-number">{wine.rating.toFixed(1)}</span>
        </div>
        {wine.price != null && <span className="wine-price">${wine.price.toFixed(0)}</span>}
        <div className="wine-actions">
          <a
            className="icon-btn"
            href={shopUrl(wine)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Shop for ${wine.name}`}
            title="Find this wine online"
          >
            🛒
          </a>
          <button className="icon-btn" onClick={onEdit} aria-label={`Edit ${wine.name}`} title="Edit">
            ✎
          </button>
          <button
            className="icon-btn danger"
            onClick={onDelete}
            aria-label={`Delete ${wine.name}`}
            title="Delete"
          >
            🗑
          </button>
        </div>
      </div>
    </li>
  )
}
