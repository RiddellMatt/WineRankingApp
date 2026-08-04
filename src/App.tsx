import { useEffect, useMemo, useState } from 'react'
import { WINE_TYPES, type SortKey, type Wine, type WineType } from './types'
import { loadWines, saveWines, SAMPLE_WINES } from './storage'
import { WineCard } from './components/WineCard'
import { WineForm } from './components/WineForm'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'rating', label: 'Rating' },
  { key: 'price', label: 'Price' },
  { key: 'vintage', label: 'Vintage' },
  { key: 'name', label: 'Name' },
  { key: 'addedAt', label: 'Recently added' },
]

export default function App() {
  const [wines, setWines] = useState<Wine[]>(loadWines)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<WineType | 'All'>('All')
  const [sortKey, setSortKey] = useState<SortKey>('rating')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Wine | null>(null)

  useEffect(() => {
    saveWines(wines)
  }, [wines])

  // Rank against the full cellar so filtering/search doesn't renumber wines.
  const rankById = useMemo(() => {
    const ordered = [...wines].sort(
      (a, b) => b.rating - a.rating || a.name.localeCompare(b.name),
    )
    return new Map(ordered.map((w, i) => [w.id, i + 1]))
  }, [wines])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = wines.filter((w) => {
      if (typeFilter !== 'All' && w.type !== typeFilter) return false
      if (!q) return true
      return [w.name, w.winery, w.varietal, w.region, w.notes]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'vintage':
          return (b.vintage ?? 0) - (a.vintage ?? 0)
        case 'price':
          return (b.price ?? -1) - (a.price ?? -1)
        case 'addedAt':
          return b.addedAt - a.addedAt
        default:
          return b.rating - a.rating || a.name.localeCompare(b.name)
      }
    })
    return list
  }, [wines, search, typeFilter, sortKey])

  const stats = useMemo(() => {
    if (wines.length === 0) return null
    const avg = wines.reduce((sum, w) => sum + w.rating, 0) / wines.length
    const best = [...wines].sort((a, b) => b.rating - a.rating)[0]
    return { count: wines.length, avg, best }
  }, [wines])

  function handleSave(wine: Wine) {
    setWines((prev) => {
      const exists = prev.some((w) => w.id === wine.id)
      return exists ? prev.map((w) => (w.id === wine.id ? wine : w)) : [...prev, wine]
    })
    setFormOpen(false)
    setEditing(null)
  }

  function handleDelete(wine: Wine) {
    if (window.confirm(`Remove “${wine.name}” from your cellar?`)) {
      setWines((prev) => prev.filter((w) => w.id !== wine.id))
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <span className="brand-icon" aria-hidden="true">
              🍷
            </span>
            <div>
              <h1>Cellar Rank</h1>
              <p className="tagline">Every bottle you've tried, ranked.</p>
            </div>
          </div>
          <button
            className="btn primary"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            + Add wine
          </button>
        </div>
      </header>

      <main className="content">
        {stats && (
          <section className="stats">
            <div className="stat">
              <span className="stat-value">{stats.count}</span>
              <span className="stat-label">{stats.count === 1 ? 'wine tried' : 'wines tried'}</span>
            </div>
            <div className="stat">
              <span className="stat-value">{stats.avg.toFixed(1)}</span>
              <span className="stat-label">average rating</span>
            </div>
            <div className="stat">
              <span className="stat-value stat-best" title={stats.best.name}>
                {stats.best.name}
              </span>
              <span className="stat-label">current favorite</span>
            </div>
          </section>
        )}

        {wines.length > 0 && (
          <section className="toolbar">
            <input
              className="search"
              type="search"
              placeholder="Search name, winery, region, notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="type-filters">
              {(['All', ...WINE_TYPES] as const).map((t) => (
                <button
                  key={t}
                  className={`chip ${typeFilter === t ? 'active' : ''}`}
                  onClick={() => setTypeFilter(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <label className="sort-control">
              Sort by
              <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
                {SORT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </section>
        )}

        {wines.length === 0 ? (
          <section className="empty">
            <span className="empty-icon" aria-hidden="true">
              🍇
            </span>
            <h2>Your cellar is empty</h2>
            <p>Add the wines you've tried and rate them to build your personal ranking.</p>
            <div className="empty-actions">
              <button
                className="btn primary"
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
              >
                Add your first wine
              </button>
              <button className="btn ghost" onClick={() => setWines(SAMPLE_WINES)}>
                Load sample wines
              </button>
            </div>
          </section>
        ) : visible.length === 0 ? (
          <section className="empty">
            <h2>No matches</h2>
            <p>No wines match your search or filter.</p>
          </section>
        ) : (
          <ol className="wine-list">
            {visible.map((wine) => (
              <WineCard
                key={wine.id}
                wine={wine}
                rank={rankById.get(wine.id) ?? 0}
                onEdit={() => {
                  setEditing(wine)
                  setFormOpen(true)
                }}
                onDelete={() => handleDelete(wine)}
              />
            ))}
          </ol>
        )}
      </main>

      {formOpen && (
        <WineForm
          initial={editing}
          onSave={handleSave}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
