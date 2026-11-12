import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { WINE_TYPES, type SortKey, type WineType, type Wine } from '../types'
import type { TastingTagDef } from '../lib/tastingTags'
import { tastingTagLabel } from '../lib/tastingTags'
import { CellarSortMenu, type CellarSortOption } from './CellarSortMenu'

export interface PriceBounds {
  min: number
  max: number
}

export interface PriceFilterRange {
  min: number
  max: number
}

type FilterPanel = 'type' | 'price' | 'tags' | 'favorites'

interface Props {
  search: string
  onSearchChange: (value: string) => void
  sortKey: SortKey
  sortOptions: CellarSortOption[]
  onSortChange: (key: SortKey) => void
  typeFilter: WineType | 'All'
  onTypeFilter: (type: WineType | 'All') => void
  tagFilter: string | null
  onTagFilter: (tagId: string | null) => void
  tagOptions: TastingTagDef[]
  showTagFilter: boolean
  favoriteFilter: boolean
  onFavoriteFilterChange: (onlyFavorites: boolean) => void
  showFavoriteFilter: boolean
  priceBounds: PriceBounds | null
  priceFilter: PriceFilterRange | null
  onPriceFilterChange: (range: PriceFilterRange | null) => void
  exportImport: React.ReactNode
}

function isPriceFilterActive(
  filter: PriceFilterRange | null,
  bounds: PriceBounds | null,
): boolean {
  if (!filter || !bounds) return false
  return filter.min > bounds.min || filter.max < bounds.max
}

export function CellarFilterBar({
  search,
  onSearchChange,
  sortKey,
  sortOptions,
  onSortChange,
  typeFilter,
  onTypeFilter,
  tagFilter,
  onTagFilter,
  tagOptions,
  showTagFilter,
  favoriteFilter,
  onFavoriteFilterChange,
  showFavoriteFilter,
  priceBounds,
  priceFilter,
  onPriceFilterChange,
  exportImport,
}: Props) {
  const [openPanel, setOpenPanel] = useState<FilterPanel | null>(null)
  const barRef = useRef<HTMLElement>(null)
  const priceLoId = useId()
  const priceHiId = useId()

  const typeActive = typeFilter !== 'All'
  const tagsActive = tagFilter != null
  const favoritesActive = favoriteFilter
  const priceActive = isPriceFilterActive(priceFilter, priceBounds)

  const typeSummary = typeFilter === 'All' ? 'Any' : typeFilter
  const tagSummary = tagFilter ? tastingTagLabel(tagFilter) : 'Any'
  const favoritesSummary = favoriteFilter ? 'Only' : 'Any'
  const priceSummary = useMemo(() => {
    if (!priceActive || !priceFilter) return 'Any'
    if (priceFilter.min === priceFilter.max) return `$${priceFilter.min}`
    return `$${priceFilter.min}–$${priceFilter.max}`
  }, [priceActive, priceFilter])

  const priceLo = priceFilter?.min ?? priceBounds?.min ?? 0
  const priceHi = priceFilter?.max ?? priceBounds?.max ?? 0

  useEffect(() => {
    if (!openPanel) return
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (barRef.current?.contains(target)) return
      setOpenPanel(null)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenPanel(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openPanel])

  function togglePanel(panel: FilterPanel) {
    setOpenPanel((current) => (current === panel ? null : panel))
  }

  function applyPriceRange(min: number, max: number) {
    if (!priceBounds) return
    const lo = Math.min(min, max)
    const hi = Math.max(min, max)
    if (lo <= priceBounds.min && hi >= priceBounds.max) {
      onPriceFilterChange(null)
      return
    }
    onPriceFilterChange({ min: lo, max: hi })
  }

  return (
    <section className="toolbar cellar-toolbar" ref={barRef}>
      <input
        className="search"
        type="search"
        placeholder="Search…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            ;(e.currentTarget as HTMLInputElement).blur()
          }
        }}
      />

      <CellarSortMenu
        value={sortKey}
        options={sortOptions}
        onChange={onSortChange}
        layout="bar"
      />

      <div className="cellar-filter-categories" role="toolbar" aria-label="Filter cellar">
        <button
          type="button"
          className={`cellar-filter-category ${openPanel === 'type' ? 'open' : ''} ${typeActive ? 'active' : ''}`}
          aria-expanded={openPanel === 'type'}
          onClick={() => togglePanel('type')}
        >
          <span className="cellar-filter-category-name">Type</span>
          <span className="cellar-filter-category-value">{typeSummary}</span>
        </button>
        {priceBounds && (
          <button
            type="button"
            className={`cellar-filter-category ${openPanel === 'price' ? 'open' : ''} ${priceActive ? 'active' : ''}`}
            aria-expanded={openPanel === 'price'}
            onClick={() => togglePanel('price')}
          >
            <span className="cellar-filter-category-name">Price</span>
            <span className="cellar-filter-category-value">{priceSummary}</span>
          </button>
        )}
        {showTagFilter && tagOptions.length > 0 && (
          <button
            type="button"
            className={`cellar-filter-category ${openPanel === 'tags' ? 'open' : ''} ${tagsActive ? 'active' : ''}`}
            aria-expanded={openPanel === 'tags'}
            onClick={() => togglePanel('tags')}
          >
            <span className="cellar-filter-category-name">Tags</span>
            <span className="cellar-filter-category-value">{tagSummary}</span>
          </button>
        )}
        {showFavoriteFilter && (
          <button
            type="button"
            className={`cellar-filter-category ${openPanel === 'favorites' ? 'open' : ''} ${favoritesActive ? 'active' : ''}`}
            aria-expanded={openPanel === 'favorites'}
            onClick={() => togglePanel('favorites')}
          >
            <span className="cellar-filter-category-name">Favorites</span>
            <span className="cellar-filter-category-value">{favoritesSummary}</span>
          </button>
        )}
      </div>

      {openPanel && (
        <div className="cellar-filter-sheet" role="region" aria-label={`${openPanel} filter`}>
          {openPanel === 'type' && (
            <ul className="cellar-filter-sheet-list">
              {(['All', ...WINE_TYPES] as const).map((t) => (
                <li key={t}>
                  <button
                    type="button"
                    className={`cellar-filter-sheet-option ${typeFilter === t ? 'active' : ''}`}
                    onClick={() => {
                      onTypeFilter(t)
                      setOpenPanel(null)
                    }}
                  >
                    {t === 'All' ? 'All types' : t}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {openPanel === 'price' && priceBounds && (
            <div className="cellar-filter-price">
              <p className="cellar-filter-price-readout">
                ${priceLo} – ${priceHi}
                {!priceActive && <span className="cellar-filter-price-hint"> (full range)</span>}
              </p>
              <label className="cellar-filter-range-label" htmlFor={priceLoId}>
                Minimum
              </label>
              <input
                id={priceLoId}
                type="range"
                min={priceBounds.min}
                max={priceBounds.max}
                step={1}
                value={priceLo}
                onChange={(e) => applyPriceRange(Number(e.target.value), priceHi)}
              />
              <label className="cellar-filter-range-label" htmlFor={priceHiId}>
                Maximum
              </label>
              <input
                id={priceHiId}
                type="range"
                min={priceBounds.min}
                max={priceBounds.max}
                step={1}
                value={priceHi}
                onChange={(e) => applyPriceRange(priceLo, Number(e.target.value))}
              />
              <p className="cellar-filter-price-note">
                Wines without a price are hidden while a price range is set.
              </p>
              <button
                type="button"
                className="btn ghost cellar-filter-reset"
                onClick={() => {
                  onPriceFilterChange(null)
                  setOpenPanel(null)
                }}
              >
                Reset price
              </button>
            </div>
          )}

          {openPanel === 'tags' && (
            <ul className="cellar-filter-sheet-list">
              <li>
                <button
                  type="button"
                  className={`cellar-filter-sheet-option ${tagFilter === null ? 'active' : ''}`}
                  onClick={() => {
                    onTagFilter(null)
                    setOpenPanel(null)
                  }}
                >
                  All tags
                </button>
              </li>
              {tagOptions.map((tag) => (
                <li key={tag.id}>
                  <button
                    type="button"
                    className={`cellar-filter-sheet-option ${tagFilter === tag.id ? 'active' : ''}`}
                    onClick={() => {
                      onTagFilter(tag.id)
                      setOpenPanel(null)
                    }}
                  >
                    {tag.label}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {openPanel === 'favorites' && (
            <ul className="cellar-filter-sheet-list">
              <li>
                <button
                  type="button"
                  className={`cellar-filter-sheet-option ${!favoriteFilter ? 'active' : ''}`}
                  onClick={() => {
                    onFavoriteFilterChange(false)
                    setOpenPanel(null)
                  }}
                >
                  All wines
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`cellar-filter-sheet-option ${favoriteFilter ? 'active' : ''}`}
                  onClick={() => {
                    onFavoriteFilterChange(true)
                    setOpenPanel(null)
                  }}
                >
                  Favorites only
                </button>
              </li>
            </ul>
          )}
        </div>
      )}

      <div className="toolbar-row toolbar-row-meta">{exportImport}</div>
    </section>
  )
}

export function priceBoundsFromWines(wines: Wine[]): PriceBounds | null {
  const prices = wines
    .map((w) => w.price)
    .filter((p): p is number => p != null && p > 0)
  if (prices.length === 0) return null
  const min = Math.floor(Math.min(...prices))
  let max = Math.ceil(Math.max(...prices))
  if (min === max) max = min + 1
  return { min, max }
}

export function wineMatchesPriceFilter(
  wine: Wine,
  filter: PriceFilterRange | null,
  bounds: PriceBounds | null,
): boolean {
  if (!isPriceFilterActive(filter, bounds) || !filter) return true
  const p = wine.price
  if (p == null || p <= 0) return false
  return p >= filter.min && p <= filter.max
}
