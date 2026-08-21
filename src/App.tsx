import { useEffect, useMemo, useRef, useState } from 'react'
import { WINE_TYPES, type RankingPreference, type SortKey, type Wine, type WineType } from './types'
import { loadWines, saveWines, SAMPLE_WINES } from './storage'
import { FREE_WINE_LIMIT, FREE_WISHLIST_LIMIT } from './config'
import { syncProSubscription } from './lib/checkoutApi'
import { loadProStatus, syncProFromServer } from './pro'
import { isCheckoutSuccessUrl } from './lib/authRedirect'
import { ACCOUNT_EVENT, CHECKOUT_SUCCESS_EVENT } from './lib/mobileDeepLinks'
import { isNativeApp } from './lib/platform'
import { useAuth } from './context/AuthContext'
import { AuthScreen } from './components/AuthScreen'
import { WineCard } from './components/WineCard'
import { WishlistCard } from './components/WishlistCard'
import { WineForm } from './components/WineForm'
import { Insights } from './components/Insights'
import { MenuScan } from './components/MenuScan'
import { FriendsPanel } from './components/FriendsPanel'
import { AccountPanel } from './components/AccountPanel'
import { RankingPreferenceModal } from './components/RankingPreferenceModal'
import { Avatar } from './components/Avatar'
import { bulkUpsertWines, deleteWine, fetchWines, upsertWine } from './lib/wineDb'
import { fetchMyProfile, updateRankingPreference, type UserProfile } from './lib/profileDb'
import { isSupabaseConfigured } from './lib/supabase'
import {
  applyCompositeRating,
  compareByRank,
  compositeScore,
  needsRankingPreferenceSetup,
  normalizeWine,
  resolveRankingPreference,
  saveLocalRankingPreference,
} from './lib/ranking'
import {
  friendWineToWishlist,
  isWishlistDuplicate,
  triedCount,
  triedWines,
  wishlistCount,
  wishlistIdentityKey,
  wishlistWines,
} from './lib/wishlist'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'rating', label: 'Rating' },
  { key: 'price', label: 'Price' },
  { key: 'vintage', label: 'Vintage' },
  { key: 'name', label: 'Name' },
  { key: 'addedAt', label: 'Recently added' },
]

type View = 'cellar' | 'sommelier' | 'insights' | 'friends' | 'account'
type CellarSegment = 'tried' | 'wishlist'

function sortWines(list: Wine[], sortKey: SortKey, rankingPreference: RankingPreference): Wine[] {
  return [...list].sort((a, b) => {
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
        return compareByRank(a, b, rankingPreference)
    }
  })
}

export default function App() {
  const {
    loading: authLoading,
    user,
    offlineMode,
    signOut,
    exitOffline,
    configured,
  } = useAuth()
  const cloudUser = user && !offlineMode ? user : null

  const [wines, setWines] = useState<Wine[]>(() => (offlineMode ? loadWines() : []))
  const [friendWines, setFriendWines] = useState<Wine[]>([])
  const [friendView, setFriendView] = useState<{
    id: string
    name: string
    avatarUrl?: string
  } | null>(null)
  const [cellarLoading, setCellarLoading] = useState(false)
  const [pro, setPro] = useState<boolean>(loadProStatus)
  const [view, setView] = useState<View>('cellar')
  const [accountHighlight, setAccountHighlight] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<WineType | 'All'>('All')
  const [sortKey, setSortKey] = useState<SortKey>('rating')
  const [cellarSegment, setCellarSegment] = useState<CellarSegment>('tried')
  const [formMode, setFormMode] = useState<'tried' | 'wishlist'>('tried')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Wine | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [rankingSetupOpen, setRankingSetupOpen] = useState(false)
  const [rankingSetupBusy, setRankingSetupBusy] = useState(false)
  const [savingFriendWishlistKey, setSavingFriendWishlistKey] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const rankingPreference = resolveRankingPreference(profile?.rankingPreference)

  const cellarTried = useMemo(() => triedWines(wines), [wines])
  const cellarWishlist = useMemo(() => wishlistWines(wines), [wines])

  function goToAccount(highlightSubscription = false) {
    setFriendView(null)
    setView('account')
    setAccountHighlight(highlightSubscription)
  }

  // Load cloud cellar when signed in.
  useEffect(() => {
    if (!cloudUser) {
      if (offlineMode) setWines(loadWines())
      return
    }
    let cancelled = false
    setCellarLoading(true)
    ;(async () => {
      try {
        const cloud = await fetchWines(cloudUser.id)
        const local = loadWines()
        if (!cancelled && cloud.length === 0 && local.length > 0) {
          const upload = window.confirm(
            `Upload ${local.length} wine${local.length === 1 ? '' : 's'} from this device to your account?`,
          )
          if (upload) {
            const uploaded = await bulkUpsertWines(cloudUser.id, local)
            if (!cancelled) setWines(uploaded)
            return
          }
        }
        if (!cancelled) setWines(cloud.length > 0 ? cloud : local)
      } catch (e) {
        if (!cancelled) {
          window.alert(`Could not load your cellar: ${(e as Error).message}`)
          setWines(loadWines())
        }
      } finally {
        if (!cancelled) setCellarLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cloudUser?.id, offlineMode])

  // Load profile for signed-in users.
  useEffect(() => {
    if (!cloudUser) {
      setProfile(null)
      setProfileLoaded(true)
      return
    }
    setProfileLoaded(false)
    let cancelled = false
    fetchMyProfile()
      .then((p) => {
        if (!cancelled) {
          setProfile(p)
          setPro(syncProFromServer(p?.isPro, true))
        }
      })
      .catch(() => {
        if (!cancelled) setProfile(null)
      })
      .finally(() => {
        if (!cancelled) setProfileLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [cloudUser?.id])

  // Nudge existing accounts that still use the auto-generated email prefix as their name.
  useEffect(() => {
    if (!cloudUser?.email || !profile?.displayName) return
    const emailPrefix = cloudUser.email.split('@')[0]?.toLowerCase()
    if (!emailPrefix || profile.displayName.toLowerCase() !== emailPrefix) return
    const key = 'cellar-rank.profile-name-prompt'
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    goToAccount(false)
  }, [cloudUser?.email, profile?.displayName])

  useEffect(() => {
    setRankingSetupOpen(
      needsRankingPreferenceSetup(profile?.rankingPreference, {
        profilePending: Boolean(cloudUser) && !profileLoaded,
      }),
    )
  }, [profile?.rankingPreference, cloudUser, profileLoaded])

  useEffect(() => {
    if (view !== 'account') setAccountHighlight(false)
  }, [view])

  // After Stripe checkout, poll profile until webhook grants Pro (or timeout).
  useEffect(() => {
    if (!cloudUser) return

    let cancelled = false
    let attempts = 0

    async function pollPro() {
      try {
        if (attempts === 0) {
          try {
            await syncProSubscription()
          } catch {
            // Webhook may still grant Pro; keep polling profile.
          }
        }

        const p = await fetchMyProfile()
        if (cancelled) return
        setProfile(p)
        const isPro = syncProFromServer(p?.isPro, true)
        setPro(isPro)
        if (isPro || attempts >= 10) {
          goToAccount(true)
          if (isPro) {
            setProfile((prev) => prev ?? p)
          }
          if (!isNativeApp()) {
            const url = new URL(window.location.href)
            url.searchParams.delete('checkout')
            window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
          }
          return
        }
        attempts += 1
        setTimeout(pollPro, 1500)
      } catch {
        if (!cancelled && attempts >= 10) {
          goToAccount(true)
        }
      }
    }

    function startCheckoutPoll() {
      attempts = 0
      pollPro()
    }

    if (isCheckoutSuccessUrl()) startCheckoutPoll()

    window.addEventListener(CHECKOUT_SUCCESS_EVENT, startCheckoutPoll)
    return () => {
      cancelled = true
      window.removeEventListener(CHECKOUT_SUCCESS_EVENT, startCheckoutPoll)
    }
  }, [cloudUser?.id])

  // Return URL from Stripe billing portal (web query param or mobile deep link).
  useEffect(() => {
    if (!cloudUser) return

    function openAccountFromReturn() {
      goToAccount(false)
      if (!isNativeApp()) {
        const url = new URL(window.location.href)
        url.searchParams.delete('view')
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
      }
    }

    const params = new URLSearchParams(window.location.search)
    if (params.get('view') === 'account') openAccountFromReturn()

    window.addEventListener(ACCOUNT_EVENT, openAccountFromReturn)
    return () => window.removeEventListener(ACCOUNT_EVENT, openAccountFromReturn)
  }, [cloudUser?.id])

  // Persist offline cellar locally.
  useEffect(() => {
    if (offlineMode) saveWines(wines)
  }, [wines, offlineMode])

  const rankById = useMemo(() => {
    const ordered = [...cellarTried].sort((a, b) => compareByRank(a, b, rankingPreference))
    return new Map(ordered.map((w, i) => [w.id, i + 1]))
  }, [cellarTried, rankingPreference])

  const friendRankById = useMemo(() => {
    const tried = triedWines(friendWines)
    const ordered = [...tried].sort((a, b) => compareByRank(a, b, rankingPreference))
    return new Map(ordered.map((w, i) => [w.id, i + 1]))
  }, [friendWines, rankingPreference])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = cellarSegment === 'wishlist' ? cellarWishlist : cellarTried
    let list = base.filter((w) => {
      if (typeFilter !== 'All' && w.type !== typeFilter) return false
      if (!q) return true
      return [w.name, w.winery, w.varietal, w.region, w.notes, w.purchasedAt]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
    const effectiveSort = cellarSegment === 'wishlist' && sortKey === 'rating' ? 'addedAt' : sortKey
    return sortWines(list, effectiveSort, rankingPreference)
  }, [cellarSegment, cellarTried, cellarWishlist, search, typeFilter, sortKey, rankingPreference])

  const stats = useMemo(() => {
    if (cellarTried.length === 0) return null
    const avg =
      cellarTried.reduce((sum, w) => sum + compositeScore(w, rankingPreference), 0) /
      cellarTried.length
    const best = [...cellarTried].sort((a, b) => compareByRank(a, b, rankingPreference))[0]
    return { count: cellarTried.length, avg, best }
  }, [cellarTried, rankingPreference])

  const atFreeLimit = !pro && triedCount(wines) >= FREE_WINE_LIMIT
  const atWishlistLimit = !pro && wishlistCount(wines) >= FREE_WISHLIST_LIMIT

  function openAddForm() {
    if (atFreeLimit) {
      goToAccount(true)
      return
    }
    setFormMode('tried')
    setEditing(null)
    setFormOpen(true)
  }

  function openAddWishlistForm() {
    if (atWishlistLimit) {
      goToAccount(true)
      return
    }
    setFormMode('wishlist')
    setEditing(null)
    setFormOpen(true)
  }

  async function applyRankingPreference(preference: RankingPreference) {
    saveLocalRankingPreference(preference)
    if (cloudUser) {
      const updatedProfile = await updateRankingPreference(preference)
      setProfile(updatedProfile)
    }
    setWines((prev) => {
      const next = prev.map((w) => applyCompositeRating(w, preference))
      if (cloudUser) {
        bulkUpsertWines(cloudUser.id, next, preference).catch(() => {
          // Local ranks still updated; cloud sync can retry on next save.
        })
      }
      return next
    })
    setRankingSetupOpen(false)
  }

  async function handleRankingPreferenceChoose(preference: RankingPreference) {
    setRankingSetupBusy(true)
    try {
      await applyRankingPreference(preference)
    } catch (e) {
      window.alert(`Could not save ranking preference: ${(e as Error).message}`)
    } finally {
      setRankingSetupBusy(false)
    }
  }

  async function persistWine(wine: Wine) {
    setWines((prev) => {
      const exists = prev.some((w) => w.id === wine.id)
      return exists ? prev.map((w) => (w.id === wine.id ? wine : w)) : [...prev, wine]
    })
    if (cloudUser) {
      try {
        const synced = await upsertWine(cloudUser.id, wine, rankingPreference)
        if (synced.id !== wine.id) {
          setWines((prev) => prev.map((w) => (w.id === wine.id ? synced : w)))
        }
      } catch (e) {
        window.alert(`Saved locally but cloud sync failed: ${(e as Error).message}`)
      }
    }
  }

  async function handleSave(wine: Wine) {
    const savingWishlist = wine.status === 'wishlist'
    const exists = wines.some((w) => w.id === wine.id)
    const wasWishlist = exists && wines.find((w) => w.id === wine.id)?.status === 'wishlist'

    if (savingWishlist) {
      if (!exists && !pro && wishlistCount(wines) >= FREE_WISHLIST_LIMIT) {
        goToAccount(true)
        return
      }
    } else if (!exists && !pro && triedCount(wines) >= FREE_WINE_LIMIT) {
      goToAccount(true)
      return
    }

    const normalized = applyCompositeRating(
      { ...wine, status: savingWishlist ? 'wishlist' : 'tried' },
      rankingPreference,
    )
    await persistWine(normalized)
    setFormOpen(false)
    setEditing(null)
    if (!savingWishlist && wasWishlist) {
      setCellarSegment('tried')
    }
  }

  async function handleSaveWishlistFromMenu(wine: Wine) {
    if (!pro) {
      goToAccount(true)
      return
    }
    if (isWishlistDuplicate(wines, wine)) return
    const normalized = applyCompositeRating({ ...wine, status: 'wishlist' }, rankingPreference)
    await persistWine(normalized)
  }

  async function handleSaveWishlistFromFriend(wine: Wine, friendName: string) {
    if (isWishlistDuplicate(wines, wine)) return
    if (!pro && wishlistCount(wines) >= FREE_WISHLIST_LIMIT) {
      goToAccount(true)
      return
    }
    const key = wishlistIdentityKey(wine)
    setSavingFriendWishlistKey(key)
    try {
      const stub = friendWineToWishlist(wine, friendName)
      const normalized = applyCompositeRating(stub, rankingPreference)
      await persistWine(normalized)
    } finally {
      setSavingFriendWishlistKey(null)
    }
  }

  async function handleDelete(wine: Wine) {
    const label = wine.status === 'wishlist' ? 'wishlist' : 'cellar'
    if (!window.confirm(`Remove “${wine.name}” from your ${label}?`)) return
    setWines((prev) => prev.filter((w) => w.id !== wine.id))
    if (cloudUser) {
      try {
        await deleteWine(wine.id)
      } catch (e) {
        window.alert(`Removed locally but cloud delete failed: ${(e as Error).message}`)
      }
    }
  }

  function handleExport() {
    if (!pro) {
      goToAccount(true)
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
      goToAccount(true)
      return
    }
    importInputRef.current?.click()
  }

  async function handleImportFile(file: File) {
    try {
      const imported = JSON.parse(await file.text())
      if (!Array.isArray(imported)) throw new Error('not an array')
      const merged = [...wines]
      const byId = new Map(merged.map((w) => [w.id, w]))
      for (const w of imported as Partial<Wine>[]) {
        if (w && typeof w.id === 'string' && typeof w.name === 'string') {
          byId.set(w.id, normalizeWine(w))
        }
      }
      const next = [...byId.values()].map((w) => applyCompositeRating(w, rankingPreference))
      setWines(next)
      if (cloudUser) {
        const synced = await bulkUpsertWines(cloudUser.id, next, rankingPreference)
        setWines(synced)
      }
    } catch {
      window.alert("That file doesn't look like a Cellar Rank export.")
    }
  }

  async function viewFriendCellar(friendId: string, friendName: string, avatarUrl?: string) {
    setCellarLoading(true)
    try {
      const list = await fetchWines(friendId)
      setFriendWines(list)
      setFriendView({ id: friendId, name: friendName, avatarUrl })
      setView('friends')
    } catch (e) {
      window.alert(`Could not load their cellar: ${(e as Error).message}`)
    } finally {
      setCellarLoading(false)
    }
  }

  if (configured && authLoading) {
    return (
      <div className="auth-screen">
        <p className="auth-tagline">Loading…</p>
      </div>
    )
  }

  if (configured && !offlineMode && !user) {
    return <AuthScreen />
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
              <p className="tagline">Every bottle you&apos;ve tried, ranked.</p>
            </div>
          </div>
          <div className="header-actions">
            {!friendView && view === 'cellar' && cellarSegment === 'wishlist' ? (
              <button className="btn primary" onClick={openAddWishlistForm}>
                + Add to wishlist
              </button>
            ) : (
              !friendView && (
                <button className="btn primary" onClick={openAddForm}>
                  + Add wine
                </button>
              )
            )}
          </div>
        </div>
      </header>

      <main className="content">
        {cellarLoading && view !== 'account' && (
          <p className="auth-info">Syncing cellar…</p>
        )}

        {view === 'account' ? (
          <AccountPanel
            profile={profile}
            email={cloudUser?.email}
            signedIn={Boolean(cloudUser)}
            offlineMode={offlineMode}
            cloudConfigured={configured}
            pro={pro}
            wineCount={triedCount(wines)}
            wines={wines}
            rankingPreference={rankingPreference}
            highlightSubscription={accountHighlight}
            onProfileSaved={setProfile}
            onRankingPreferenceSaved={applyRankingPreference}
            onProUnlocked={async () => {
              const p = await fetchMyProfile()
              setProfile(p)
              setPro(syncProFromServer(p?.isPro, true))
            }}
            onSignOut={() => signOut()}
            onSignIn={() => exitOffline()}
          />
        ) : view === 'friends' && cloudUser ? (
          friendView ? (
            <>
              <button className="btn ghost friend-back" onClick={() => setFriendView(null)}>
                ← Back to friends
              </button>
              <div className="friend-cellar-header">
                <Avatar
                  displayName={friendView.name}
                  avatarUrl={friendView.avatarUrl}
                  seed={friendView.id}
                  size="lg"
                />
                <h2 className="friend-cellar-title">{friendView.name}&apos;s cellar</h2>
              </div>
              {friendWines.length === 0 || triedWines(friendWines).length === 0 ? (
                <section className="empty">
                  <p>They haven&apos;t logged any wines yet.</p>
                </section>
              ) : (
                <ol className="wine-list">
                  {sortWines(triedWines(friendWines), 'rating', rankingPreference).map((wine) => (
                    <WineCard
                      key={wine.id}
                      wine={wine}
                      rank={friendRankById.get(wine.id) ?? 0}
                      rankingPreference={rankingPreference}
                      onEdit={() => {}}
                      onDelete={() => {}}
                      readOnly
                      onSaveToWishlist={() =>
                        handleSaveWishlistFromFriend(wine, friendView.name)
                      }
                      wishlistSaved={isWishlistDuplicate(wines, wine)}
                      wishlistSaving={savingFriendWishlistKey === wishlistIdentityKey(wine)}
                    />
                  ))}
                </ol>
              )}
            </>
          ) : (
            <FriendsPanel
              userId={cloudUser.id}
              userEmail={cloudUser.email}
              userDisplayName={profile?.displayName}
              userAvatarUrl={profile?.avatarUrl}
              wines={wines}
              rankingPreference={rankingPreference}
              onViewCellar={viewFriendCellar}
              onSaveToWishlist={handleSaveWishlistFromFriend}
              isWishlistSaved={(wine) => isWishlistDuplicate(wines, wine)}
              savingWishlistKey={savingFriendWishlistKey}
            />
          )
        ) : view === 'sommelier' ? (
          <MenuScan
            wines={cellarTried}
            wishlist={cellarWishlist}
            rankingPreference={rankingPreference}
            pro={pro}
            signedIn={Boolean(cloudUser)}
            cloudConfigured={configured}
            onUpgrade={() => goToAccount(true)}
            onSaveWishlist={handleSaveWishlistFromMenu}
          />
        ) : view === 'insights' ? (
          pro ? (
            <Insights wines={cellarTried} rankingPreference={rankingPreference} />
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
                <button className="btn primary" onClick={() => goToAccount(true)}>
                  View subscription
                </button>
              </div>
            </section>
          )
        ) : (
          <>
            <section className="cellar-segment" aria-label="Cellar view">
              <button
                type="button"
                className={`cellar-segment-btn ${cellarSegment === 'tried' ? 'active' : ''}`}
                onClick={() => setCellarSegment('tried')}
              >
                Tried ({cellarTried.length})
              </button>
              <button
                type="button"
                className={`cellar-segment-btn ${cellarSegment === 'wishlist' ? 'active' : ''}`}
                onClick={() => setCellarSegment('wishlist')}
              >
                Want to try ({cellarWishlist.length})
              </button>
            </section>

            {cellarSegment === 'tried' && stats && (
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

            {cellarSegment === 'tried' && atFreeLimit && (
              <div className="limit-banner">
                <span>You&apos;ve reached the free limit of {FREE_WINE_LIMIT} wines.</span>
                <button className="btn primary small" onClick={() => goToAccount(true)}>
                  Upgrade in Account
                </button>
              </div>
            )}

            {cellarSegment === 'wishlist' && atWishlistLimit && (
              <div className="limit-banner">
                <span>
                  You&apos;ve reached the free wishlist limit of {FREE_WISHLIST_LIMIT} wines.
                </span>
                <button className="btn primary small" onClick={() => goToAccount(true)}>
                  Upgrade in Account
                </button>
              </div>
            )}

            {(cellarSegment === 'tried' ? cellarTried : cellarWishlist).length > 0 && (
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

            {cellarSegment === 'tried' && cellarTried.length === 0 ? (
              <section className="empty">
                <span className="empty-icon" aria-hidden="true">
                  🍇
                </span>
                <h2>Your cellar is empty</h2>
                <p>Add the wines you&apos;ve tried and rate them to build your personal ranking.</p>
                <div className="empty-actions">
                  <button className="btn primary" onClick={openAddForm}>
                    Add your first wine
                  </button>
                  <button
                    className="btn ghost"
                    onClick={async () => {
                      setWines(SAMPLE_WINES)
                      if (cloudUser) {
                        try {
                          const synced = await bulkUpsertWines(cloudUser.id, SAMPLE_WINES)
                          setWines(synced)
                        } catch (e) {
                          window.alert(`Loaded samples but cloud sync failed: ${(e as Error).message}`)
                        }
                      }
                    }}
                  >
                    Load sample wines
                  </button>
                </div>
              </section>
            ) : cellarSegment === 'wishlist' && cellarWishlist.length === 0 ? (
              <section className="empty">
                <span className="empty-icon" aria-hidden="true">
                  ♡
                </span>
                <h2>Nothing on your radar yet</h2>
                <p>
                  Save wines from the menu sommelier (Pro) or add bottles you want to try later.
                </p>
                <div className="empty-actions">
                  <button className="btn primary" onClick={openAddWishlistForm}>
                    Add to wishlist
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => {
                      setFriendView(null)
                      setView('sommelier')
                    }}
                  >
                    Scan a menu
                  </button>
                </div>
              </section>
            ) : visible.length === 0 ? (
              <section className="empty">
                <h2>No matches</h2>
                <p>No wines match your search or filter.</p>
              </section>
            ) : cellarSegment === 'wishlist' ? (
              <ol className="wishlist-list">
                {visible.map((wine) => (
                  <WishlistCard
                    key={wine.id}
                    wine={wine}
                    onMarkTried={() => {
                      if (atFreeLimit) {
                        goToAccount(true)
                        return
                      }
                      setFormMode('tried')
                      setEditing(wine)
                      setFormOpen(true)
                    }}
                    onEdit={() => {
                      setFormMode('wishlist')
                      setEditing(wine)
                      setFormOpen(true)
                    }}
                    onDelete={() => handleDelete(wine)}
                  />
                ))}
              </ol>
            ) : (
              <ol className="wine-list">
                {visible.map((wine) => (
                  <WineCard
                    key={wine.id}
                    wine={wine}
                    rank={rankById.get(wine.id) ?? 0}
                    rankingPreference={rankingPreference}
                    onEdit={() => {
                      setFormMode('tried')
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

      <nav className="tabs" aria-label="Main">
        <button
          className={`tab ${view === 'cellar' ? 'active' : ''}`}
          onClick={() => {
            setFriendView(null)
            setView('cellar')
          }}
        >
          <span className="tab-text-long">My cellar</span>
          <span className="tab-text-short">Cellar</span>
        </button>
        <button
          className={`tab ${view === 'sommelier' ? 'active' : ''}`}
          onClick={() => {
            setFriendView(null)
            setView('sommelier')
          }}
        >
          <span className="tab-text-long">Sommelier</span>
          <span className="tab-text-short">Scan</span>
        </button>
        {cloudUser && (
          <button
            className={`tab ${view === 'friends' ? 'active' : ''}`}
            onClick={() => setView('friends')}
          >
            Friends
          </button>
        )}
        <button
          className={`tab ${view === 'insights' ? 'active' : ''}`}
          onClick={() => {
            setFriendView(null)
            setView('insights')
          }}
        >
          <span className="tab-text-long">Insights</span>
          <span className="tab-text-short">Stats</span>
          {!pro && <span className="pro-badge">PRO</span>}
        </button>
        <button
          className={`tab ${view === 'account' ? 'active' : ''}`}
          onClick={() => {
            setFriendView(null)
            setView('account')
          }}
        >
          Account
        </button>
      </nav>

      {formOpen && (
        <WineForm
          initial={editing}
          formMode={formMode}
          onSave={handleSave}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
          rankingPreference={rankingPreference}
          pro={pro}
          signedIn={Boolean(cloudUser)}
          cloudConfigured={isSupabaseConfigured}
        />
      )}

      {rankingSetupOpen && (
        <RankingPreferenceModal onChoose={handleRankingPreferenceChoose} busy={rankingSetupBusy} />
      )}

      {!isSupabaseConfigured && (
        <p className="auth-offline-note app-footer-note">
          Cloud sync disabled — add Supabase keys to enable accounts and friends.
        </p>
      )}
    </div>
  )
}
