import { useEffect, useMemo, useRef, useState } from 'react'
import { WINE_TYPES, type SortKey, type Wine, type WineType } from './types'
import { loadWines, saveWines, SAMPLE_WINES } from './storage'
import { FREE_WINE_LIMIT } from './config'
import { loadProStatus } from './pro'
import { WineCard } from './components/WineCard'
import { WineForm } from './components/WineForm'
import { UpgradeModal } from './components/UpgradeModal'
import { Insights } from './components/Insights'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'rating', label: 'Rating' },
  { key: 'price', label: 'Price' },
  { key: 'vintage', label: 'Vintage' },
  { key: 'name', label: 'Name' },
  { key: 'addedAt', label: 'Recently added' },
]

type View = 'cellar' | 'insights'
type UpgradeReason = 'limit' | 'insights' | 'export' | 'generic'

export default function App() {
  const [wines, setWines] = useState<Wine[]>(loadWines)
  const [pro, setPro] = useState<boolean>(loadProStatus)
  const [view, setView] = useState<View>('cellar')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<WineType | 'All'>('All')
  const [sortKey, setSortKey] = useState<SortKey>('rating')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Wine | null>(null)
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

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
      return [w.name, w.winery, w.varietal, w.region, w.notes, w.purchasedAt]
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

  const atFreeLimit = !pro && wines.length >= FREE_WINE_LIMIT

  function openAddForm() {
    if (atFreeLimit) {
      setUpgradeReason('limit')
      return
    }
    setEditing(null)
    setFormOpen(true)
  }

  function handleSave(wine: Wine) {
    setWines((prev) => {
      const exists = prev.some((w) => w.id === wine.id)
      if (!exists && !pro && prev.length >= FREE_WINE_LIMIT) return prev
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

  function handleExport() {
    if (!pro) {
      setUpgradeReason('export')
      return
    }
    const blob = new Blob([JSON.stringify(wines, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cellar-rank-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportClick() {
    if (!pro) {
      setUpgradeReason('export')
      return
    }
    importInputRef.current?.click()
  }

  async function handleImportFile(file: File) {
    try {
      const imported = JSON.parse(await file.text())
      if (!Array.isArray(imported)) throw new Error('not an array')
      setWines((prev) => {
        const byId = new Map(prev.map((w) => [w.id, w]))
        for (const w of imported as Wine[]) {
          if (w && typeof w.id === 'string' && typeof w.name === 'string') byId.set(w.id, w)
        }
        return [...byId.values()]
      })
    } catch {
      window.alert("That file doesn't look like a Cellar Rank export.")
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
              <h1>
                Cellar Rank
                {pro && <span className="pro-badge inline"> PRO</span>}
              </h1>
              <p className="tagline">Every bottle you've tried, ranked.</p>
            </div>
          </div>
          <div className="header-actions">
            {!pro && (
              <button className="btn ghost" onClick={() => setUpgradeReason('generic')}>
                Go Pro
              </button>
            )}
            <button className="btn primary" onClick={openAddForm}>
              + Add wine
            </button>
          </div>
        </div>
        <nav className="tabs">
          <button
            className={`tab ${view === 'cellar' ? 'active' : ''}`}
            onClick={() => setView('cellar')}
          >
            My cellar
          </button>
          <button
            className={`tab ${view === 'insights' ? 'active' : ''}`}
            onClick={() => setView('insights')}
          >
            Insights {!pro && <span className="pro-badge">PRO</span>}
          </button>
        </nav>
      </header>

      <main className="content">
        {view === 'insights' ? (
          pro ? (
            <Insights wines={wines} />
          ) : (
            <section className="empty locked">
              <span className="empty-icon" aria-hidden="true">
                📊
              </span>
              <h2>Your cellar, decoded</h2>
              <p>
                Total spend, best-value bottles, rating distribution, and your taste profile by
                type, region, and varietal — all in Cellar Rank Pro.
              </p>
              <div className="empty-actions">
                <button className="btn primary" onClick={() => setUpgradeReason('insights')}>
                  Unlock Insights
                </button>
              </div>
            </section>
          )
        ) : (
          <>
            {stats && (
              <section className="stats">
                <div className="stat">
                  <span className="stat-value">
                    {stats.count}
                    {!pro && <span className="stat-limit"> / {FREE_WINE_LIMIT}</span>}
                  </span>
                  <span className="stat-label">
                    {stats.count === 1 ? 'wine tried' : 'wines tried'}
                  </span>
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

            {atFreeLimit && (
              <div className="limit-banner">
                <span>
                  You've reached the free limit of {FREE_WINE_LIMIT} wines.
                </span>
                <button className="btn primary small" onClick={() => setUpgradeReason('limit')}>
                  Go Pro for unlimited
                </button>
              </div>
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
                <div className="toolbar-bottom">
                  <div className="data-actions">
                    <button className="link-btn" onClick={handleExport}>
                      Export{!pro && ' 🔒'}
                    </button>
                    <button className="link-btn" onClick={handleImportClick}>
                      Import{!pro && ' 🔒'}
                    </button>
                    <input
                      ref={importInputRef}
                      type="file"
                      accept="application/json"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleImportFile(file)
                        e.target.value = ''
                      }}
                    />
                  </div>
                  <label className="sort-control">
                    Sort by
                    <select
                      value={sortKey}
                      onChange={(e) => setSortKey(e.target.value as SortKey)}
                    >
                      {SORT_OPTIONS.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
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
                  <button className="btn primary" onClick={openAddForm}>
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
          </>
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

      {upgradeReason && (
        <UpgradeModal
          reason={upgradeReason}
          onUnlocked={() => {
            setPro(true)
            setUpgradeReason(null)
          }}
          onClose={() => setUpgradeReason(null)}
        />
      )}
    </div>
  )
}
