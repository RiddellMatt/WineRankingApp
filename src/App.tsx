import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type RankingPreference, type SortKey, type Wine, type WineType } from './types'
import { loadWines, saveWines } from './storage'
import { FREE_WINE_LIMIT, FREE_WISHLIST_LIMIT } from './config'
import { syncProSubscription } from './lib/checkoutApi'
import { activatePro, loadProStatus, syncProFromServer } from './pro'
import { isCheckoutSuccessUrl } from './lib/authRedirect'
import { rememberOpenApp, shouldOpenAppDirectly } from './lib/siteEntry'
import { ACCOUNT_EVENT, CHECKOUT_SUCCESS_EVENT, FRIENDS_PUSH_EVENT } from './lib/mobileDeepLinks'
import {
  PUSH_NAV_EVENT,
  startPushNotifications,
  stopPushNotifications,
} from './lib/pushNotifications'
import { hideNativeSplashOnce, onLaunchComplete } from './lib/nativeSplash'
import {
  hideNativeTabBar,
  isNativeIosTabBar,
  selectNativeTab,
  setNativeTabBarSelectHandler,
  syncNativeTabBar,
  type NativeTabId,
} from './lib/nativeTabBar'
import { adsDebugProbeEnabled, adsEnabledForAccount } from './lib/adConfig'
import { AdBannerProbe } from './components/AdBannerProbe'
import { setBannerAdDebug } from './lib/bannerAdDebug'
import { refreshBannerMargin, startBannerAds, stopBannerAds } from './lib/bannerAds'
import { isNativeApp } from './lib/platform'
import { isIosStoreKitConfigured, reconcileProWithSupabase } from './lib/revenueCat'
import { useAuth } from './context/AuthContext'
import { AddWineChooser, type AddWineDestination } from './components/AddWineChooser'
import { AuthScreen } from './components/AuthScreen'
import { MarketingPage } from './components/MarketingPage'
import {
  CellarFilterBar,
  priceBoundsFromWines,
  wineMatchesPriceFilter,
  type PriceFilterRange,
} from './components/CellarFilterBar'
import { WineCard } from './components/WineCard'
import { WishlistCard } from './components/WishlistCard'
import { WineForm } from './components/WineForm'
import { Insights } from './components/Insights'
import { ScanHub } from './components/ScanHub'
import { ScanPourOverlay } from './components/ScanPourOverlay'
import {
  IconBarChart,
  IconChatBubble,
  IconCellarList,
  IconEllipsis,
  IconLock,
  IconPlus,
} from './components/icons/UiIcons'
import { Avatar } from './components/Avatar'
import { FriendsPanel } from './components/FriendsPanel'
import { NotificationsBell } from './components/NotificationsBell'
import { FriendCellarView } from './components/FriendCellarView'
import { requestNotificationsRefresh } from './lib/notificationsRefresh'
import { ProfileScreen } from './components/ProfileScreen'
import { SETTINGS_SECTION_TITLES, type AccountSettingsSection } from './components/accountSettings'
import {
  BadgeUnlockToasts,
  createBadgeToastItems,
  createJourneyToastItems,
  type MilestoneToastItem,
} from './components/BadgeUnlockToasts'
import {
  createLevelUpToast,
  createXpGainToast,
  XpFeedbackToasts,
  type XpFeedbackToastItem,
} from './components/XpFeedbackToasts'
import { computePlayerXpDelta, decideXpCellarFeedback } from './lib/playerXpFeedback'
import { RankingPreferenceModal } from './components/RankingPreferenceModal'
import { UserGuide } from './components/UserGuide'
import {
  hasSeenUserGuide,
  markUserGuideSeen,
  USER_GUIDE_STEPS,
} from './lib/userGuide'
import { APP_NAME_PRO, STORAGE_PREFIX } from './brand'
import { bulkUpsertWines, deleteWine, fetchWines, upsertWine } from './lib/wineDb'
import { findCellarDuplicate } from './lib/winePours'
import { fetchFriendships, type FriendProfile } from './lib/friendsDb'
import { formatWithFriendsNames, friendNameMapFromProfiles } from './lib/wineWithFriends'
import { fetchCompletedJourneysForUsers } from './lib/journeyDb'
import {
  consumeCatchUpTestingFlag,
  evaluateBadgeProgressChange,
  hydrateEarnedBadgeTiers,
  loadEarnedBadgeTiers,
  lockedBadgeSnapshot,
  saveEarnedBadgeTiers,
  snapshotFromBadgeInput,
  type BadgeTierSnapshot,
  type BadgeUnlock,
} from './lib/badgeUnlocks'
import { saveEarnedBadgeTiersCloud, syncEarnedBadgeTiersWithCellar } from './lib/badgeDb'
import {
  recordBadgeUnlockEvent,
  recordJourneyCompleteEvent,
} from './lib/activityEventsDb'
import { detectNewJourneyCompletions, journeyById } from './lib/journeys'
import {
  loadCompletedJourneysLocal,
  markJourneysComplete,
  saveCompletedJourneysLocal,
  syncJourneyCompletions,
} from './lib/journeyDb'
import type { BadgeInput } from './lib/badges'
import { fetchMyProfile, updateRankingPreference, type UserProfile } from './lib/profileDb'
import { prepareReferralForSession } from './lib/referrals'
import { becameTopWine } from './lib/sharePrompt'
import { maybeRequestStoreReview } from './lib/storeReview'
import type { ShareWineCardInput } from './lib/shareWineCard'
import { ShareWineCardSheet } from './components/ShareWineCardSheet'
import { discardLocalProgressIfReset } from './lib/progressReset'
import { setActiveProgressUser } from './lib/progressStorage'
import { isSupabaseConfigured } from './lib/supabase'
import {
  applyCompositeRating,
  compareByRank,
  compositeScore,
  favoriteRatingValue,
  wineEnjoyment,
  isWineFavorite,
  needsRankingPreferenceSetup,
  normalizeWine,
  resolveRankingPreference,
  saveLocalRankingPreference,
} from './lib/ranking'
import { sortPrice } from './lib/winePrice'
import {
  filterTagsForCellar,
  tastingTagLabel,
  wineMatchesTagFilter,
} from './lib/tastingTags'
import {
  friendWineToTriedDraft,
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

type View = 'cellar' | 'scan' | 'insights' | 'friends' | 'more' | 'profile'
type CellarSegment = 'tried' | 'wishlist'

const VIEW_PAGE_TITLES: Record<View, string> = {
  cellar: 'Cellar',
  scan: 'Add',
  insights: 'Stats',
  friends: 'Social',
  more: 'More',
  profile: 'Profile',
}

function sortWines(list: Wine[], sortKey: SortKey, rankingPreference: RankingPreference): Wine[] {
  return [...list].sort((a, b) => {
    switch (sortKey) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'vintage':
        return (b.vintage ?? 0) - (a.vintage ?? 0)
      case 'price':
        return sortPrice(b) - sortPrice(a)
      case 'addedAt':
        return b.addedAt - a.addedAt
      default:
        return compareByRank(a, b, rankingPreference)
    }
  })
}

const demoScanOverlay =
  import.meta.env.DEV &&
  (new URLSearchParams(window.location.search).get('demoScan') as 'menu' | 'label' | null)

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
  setActiveProgressUser(cloudUser?.id ?? null)

  const [wines, setWines] = useState<Wine[]>(() => (offlineMode ? loadWines() : []))
  const [friendWines, setFriendWines] = useState<Wine[]>([])
  const [friendCompletedJourneys, setFriendCompletedJourneys] = useState<Set<string>>(() => new Set())
  const [friendView, setFriendView] = useState<{
    id: string
    name: string
    avatarUrl?: string
    focusWineId?: string
  } | null>(null)
  const [cellarLoading, setCellarLoading] = useState(false)
  const [cellarReady, setCellarReady] = useState(false)
  const [progressResetTick, setProgressResetTick] = useState(0)
  const [pro, setPro] = useState<boolean>(loadProStatus)
  const [view, setView] = useState<View>('cellar')
  const [accountHighlight, setAccountHighlight] = useState(false)
  const [profileSettingsSection, setProfileSettingsSection] =
    useState<AccountSettingsSection>('menu')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<WineType | 'All'>('All')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [favoriteFilter, setFavoriteFilter] = useState(false)
  const [priceFilter, setPriceFilter] = useState<PriceFilterRange | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('addedAt')
  const [cellarSegment, setCellarSegment] = useState<CellarSegment>('tried')
  const [formMode, setFormMode] = useState<'tried' | 'wishlist'>('tried')
  const [formOpen, setFormOpen] = useState(false)
  const [addWineChooserOpen, setAddWineChooserOpen] = useState(false)
  const [autoOpenScan, setAutoOpenScan] = useState(false)
  const [editing, setEditing] = useState<Wine | null>(null)
  const [formCreate, setFormCreate] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [launchComplete, setLaunchComplete] = useState(() => !isNativeApp())
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideStep, setGuideStep] = useState(0)
  const guideBootedRef = useRef(false)
  const guideOpenRef = useRef(false)
  guideOpenRef.current = guideOpen
  const forceGuide =
    import.meta.env.DEV && new URLSearchParams(window.location.search).has('guide')
  const [enteredApp, setEnteredApp] = useState(shouldOpenAppDirectly)
  const [rankingSetupOpen, setRankingSetupOpen] = useState(false)
  const [rankingSetupBusy, setRankingSetupBusy] = useState(false)
  const [savingFriendWishlistKey, setSavingFriendWishlistKey] = useState<string | null>(null)
  const [friendCount, setFriendCount] = useState(0)
  const [referralNotice, setReferralNotice] = useState('')
  const [topShare, setTopShare] = useState<ShareWineCardInput | null>(null)
  const topShareRef = useRef<ShareWineCardInput | null>(null)
  const [friendCountLoaded, setFriendCountLoaded] = useState(false)
  const [friendNameById, setFriendNameById] = useState(() => new Map<string, string>())
  const [friendsRequestedTab, setFriendsRequestedTab] = useState<'feed' | 'manage' | null>(null)
  const [badgeToastItems, setBadgeToastItems] = useState<MilestoneToastItem[]>([])
  const [xpToastItems, setXpToastItems] = useState<XpFeedbackToastItem[]>([])
  const [completedJourneys, setCompletedJourneys] = useState<Set<string>>(() =>
    loadCompletedJourneysLocal(),
  )
  const badgeHydratedRef = useRef(false)
  const badgeFriendCountRef = useRef(0)
  const earnedBadgeTiersRef = useRef<BadgeTierSnapshot | null>(null)
  const completedJourneysRef = useRef<Set<string>>(completedJourneys)
  const progressSyncedRef = useRef(false)
  const [progressSynced, setProgressSynced] = useState(false)
  const badgeCellarBaselineRef = useRef<Wine[] | null>(null)
  const xpFeedbackReadyRef = useRef(false)
  const pendingXpRef = useRef<{ previous: BadgeInput; next: BadgeInput } | null>(null)
  const winesRef = useRef(wines)
  const importInputRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLElement>(null)

  const headerPageTitle = useMemo(() => {
    if (view === 'friends' && friendView) return `${friendView.name}'s cellar`
    if (view === 'more' && profileSettingsSection !== 'menu') {
      return SETTINGS_SECTION_TITLES[profileSettingsSection]
    }
    return VIEW_PAGE_TITLES[view]
  }, [view, friendView, profileSettingsSection])

  const headerProfileLabel =
    profile?.displayName?.trim() ||
    profile?.email?.split('@')[0] ||
    cloudUser?.email?.split('@')[0] ||
    'You'

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    el.scrollTop = 0
  }, [view, friendView])

  const lastNativeTabRef = useRef<NativeTabId>(view === 'profile' ? 'cellar' : view)
  if (view !== 'profile') lastNativeTabRef.current = view

  const mainAppShell =
    !authLoading && (offlineMode || !configured || Boolean(user))
  const authGateScreen = configured && !offlineMode && !user

  const adsAllowed = adsEnabledForAccount({
    signedIn: Boolean(cloudUser),
    profileLoaded,
    profileIsPro: profile?.isPro,
    localPro: pro,
  })

  useEffect(() => onLaunchComplete(() => setLaunchComplete(true)), [])

  useEffect(() => {
    if (!isNativeIosTabBar()) return
    setNativeTabBarSelectHandler((id) => {
      if (guideOpenRef.current) return
      setFriendView(null)
      if (id === 'more') {
        setProfileSettingsSection('menu')
        setAccountHighlight(false)
      }
      setView(id)
    })
    return () => setNativeTabBarSelectHandler(null)
  }, [])

  useEffect(() => {
    if (!isNativeIosTabBar() || authLoading || !launchComplete) return
    if (!mainAppShell || authGateScreen) {
      void hideNativeTabBar()
      return
    }
    void syncNativeTabBar({
      signedIn: Boolean(cloudUser),
      pro,
      selected: lastNativeTabRef.current,
    })
  }, [authLoading, launchComplete, mainAppShell, authGateScreen, cloudUser, pro])

  useEffect(() => {
    if (view !== 'profile') void selectNativeTab(view)
    if (isNativeApp()) {
      window.setTimeout(() => {
        void refreshBannerMargin(true)
      }, 400)
    }
  }, [view])

  useEffect(() => {
    if (
      !isNativeApp() ||
      !launchComplete ||
      !mainAppShell ||
      authGateScreen ||
      !adsAllowed
    ) {
      if (isNativeApp() && adsDebugProbeEnabled()) {
        setBannerAdDebug(
          'gated',
          !launchComplete
            ? 'launch sequence'
            : authGateScreen
              ? 'sign-in required'
              : !mainAppShell
                ? 'app loading'
                : 'subscriber gate',
        )
      }
      void stopBannerAds()
      return
    }
    void startBannerAds()
    // Intentionally no cleanup — profileLoaded used to stop+restart and detach listeners mid-request.
  }, [launchComplete, mainAppShell, authGateScreen, adsAllowed])

  const cellarProgressReady =
    cellarReady && (!cloudUser || profileLoaded) && friendCountLoaded

  const badgeReady = cellarProgressReady && progressSynced

  const referralCountRef = useRef(0)

  const buildBadgeInput = useCallback(
    (cellarWines: Wine[], friends: number): BadgeInput => ({
      wines: cellarWines,
      friendCount: friends,
      completedJourneys: completedJourneysRef.current,
      referralCount: referralCountRef.current,
    }),
    [],
  )

  const ensureBadgeHydrated = useCallback(
    (options?: { seedIfMissing?: boolean }) => {
      if (badgeHydratedRef.current) return
      earnedBadgeTiersRef.current = hydrateEarnedBadgeTiers(
        buildBadgeInput(winesRef.current, badgeFriendCountRef.current),
        options,
      )
      badgeHydratedRef.current = true
    },
    [buildBadgeInput],
  )

  useEffect(() => {
    if (!isNativeApp()) return
    if (!configured || !authLoading) {
      void hideNativeSplashOnce()
    }
  }, [configured, authLoading])

  useEffect(() => {
    winesRef.current = wines
  }, [wines])

  useEffect(() => {
    completedJourneysRef.current = completedJourneys
  }, [completedJourneys])

  const rankingPreference = resolveRankingPreference(profile?.rankingPreference)

  const cellarTried = useMemo(() => triedWines(wines), [wines])
  const cellarWishlist = useMemo(() => wishlistWines(wines), [wines])

  const pushBadgeUnlocks = useCallback((unlocks: BadgeUnlock[]) => {
    if (unlocks.length === 0) return
    setBadgeToastItems((prev) => [...prev, ...createBadgeToastItems(unlocks)])
  }, [])

  const pushJourneyCompletions = useCallback(
    (journeyIds: ReturnType<typeof detectNewJourneyCompletions>) => {
      if (journeyIds.length === 0) return
      setBadgeToastItems((prev) => [...prev, ...createJourneyToastItems(journeyIds)])
    },
    [],
  )

  const persistProgressToCloud = useCallback(
    async (
      earned: BadgeTierSnapshot,
      newJourneyIds: string[],
      badgeUnlocks: BadgeUnlock[],
    ) => {
      if (!cloudUser) return
      try {
        await saveEarnedBadgeTiersCloud(cloudUser.id, earned)
        if (newJourneyIds.length > 0) {
          await markJourneysComplete(cloudUser.id, newJourneyIds)
        }
        await Promise.all([
          ...badgeUnlocks.map((unlock) =>
            recordBadgeUnlockEvent(cloudUser.id, {
              badge_id: unlock.id,
              badge_title: unlock.title,
              badge_icon: unlock.icon,
              tier: unlock.tier,
              previous_tier: unlock.previousTier,
            }),
          ),
          ...newJourneyIds.map((journeyId) => {
            const def = journeyById(journeyId)
            return recordJourneyCompleteEvent(cloudUser.id, {
              journey_id: journeyId,
              journey_title: def?.title ?? journeyId,
              journey_icon: def?.icon ?? '🧭',
            })
          }),
        ])
      } catch {
        // Cloud sync is best-effort; local state remains authoritative offline.
      }
    },
    [cloudUser],
  )

  const dismissBadgeToast = useCallback((toastId: string) => {
    setBadgeToastItems((prev) => prev.filter((item) => item.toastId !== toastId))
  }, [])

  const dismissXpToast = useCallback((toastId: string) => {
    setXpToastItems((prev) => prev.filter((item) => item.toastId !== toastId))
  }, [])

  const pushXpFeedback = useCallback(
    (previous: BadgeInput, next: BadgeInput) => {
      if (!xpFeedbackReadyRef.current) return
      const delta = computePlayerXpDelta(previous, next)
      if (delta.gained <= 0) return
      const items: XpFeedbackToastItem[] = []
      if (delta.leveledUp) {
        items.push(createLevelUpToast(delta.newLevel, delta.newTitle, delta.gained))
      } else {
        items.push(createXpGainToast(delta.gained))
      }
      setXpToastItems((prev) => [...prev, ...items])
    },
    [],
  )

  const applyBadgeProgressChange = useCallback(
    (previous: BadgeInput, next: BadgeInput) => {
      const earned =
        earnedBadgeTiersRef.current ??
        (cloudUser ? lockedBadgeSnapshot() : loadEarnedBadgeTiers() ?? lockedBadgeSnapshot())
      const catchUpAfterReset = consumeCatchUpTestingFlag()

      const newJourneys = detectNewJourneyCompletions(next.wines, completedJourneysRef.current)
      const newJourneyIds = newJourneys.map((journey) => journey.id)
      if (newJourneyIds.length > 0) {
        const nextCompleted = new Set(completedJourneysRef.current)
        for (const id of newJourneyIds) {
          nextCompleted.add(id)
        }
        completedJourneysRef.current = nextCompleted
        saveCompletedJourneysLocal(nextCompleted)
        setCompletedJourneys(nextCompleted)
        pushJourneyCompletions(newJourneys)
        window.setTimeout(() => {
          if (topShareRef.current) return
          void maybeRequestStoreReview({
            ratedCount: triedCount(next.wines),
            journeyCompleted: true,
          })
        }, 900)
      }

      const nextWithJourneys: BadgeInput = {
        ...next,
        completedJourneys: completedJourneysRef.current,
      }
      const { unlocks, earned: nextEarned } = evaluateBadgeProgressChange(
        earned,
        previous,
        nextWithJourneys,
        { catchUpAfterReset },
      )
      earnedBadgeTiersRef.current = nextEarned
      saveEarnedBadgeTiers(nextEarned)
      badgeFriendCountRef.current = next.friendCount
      pushBadgeUnlocks(unlocks)
      void persistProgressToCloud(nextEarned, newJourneyIds, unlocks)
    },
    [cloudUser, pushBadgeUnlocks, pushJourneyCompletions, persistProgressToCloud],
  )

  const applyBadgeProgressChangeRef = useRef(applyBadgeProgressChange)
  applyBadgeProgressChangeRef.current = applyBadgeProgressChange

  const handleFriendshipsChanged = useCallback(
    (count: number) => {
      setFriendCount(count)
      if (!badgeReady) return

      const previousCount = badgeFriendCountRef.current
      if (count <= previousCount) return

      ensureBadgeHydrated({ seedIfMissing: false })
      const previousInput = buildBadgeInput(winesRef.current, previousCount)
      const nextInput = buildBadgeInput(winesRef.current, count)
      applyBadgeProgressChange(previousInput, nextInput)
      pushXpFeedback(previousInput, nextInput)
    },
    [applyBadgeProgressChange, badgeReady, buildBadgeInput, ensureBadgeHydrated, pushXpFeedback],
  )

  useEffect(() => {
    if (!badgeReady) return
    const count = profile?.qualifiedReferralCount ?? 0
    if (count === referralCountRef.current) return
    ensureBadgeHydrated({ seedIfMissing: false })
    const previousInput = buildBadgeInput(winesRef.current, badgeFriendCountRef.current)
    referralCountRef.current = count
    const nextInput = buildBadgeInput(winesRef.current, badgeFriendCountRef.current)
    applyBadgeProgressChange(previousInput, nextInput)
    pushXpFeedback(previousInput, nextInput)
  }, [
    applyBadgeProgressChange,
    badgeReady,
    buildBadgeInput,
    ensureBadgeHydrated,
    profile?.qualifiedReferralCount,
    pushXpFeedback,
  ])

  function openProfile() {
    setFriendView(null)
    setView('profile')
  }

  function goToAccount(highlightSubscription = false) {
    setFriendView(null)
    setView('more')
    setProfileSettingsSection(highlightSubscription ? 'subscription' : 'menu')
    setAccountHighlight(highlightSubscription)
  }

  // Load cloud cellar when signed in.
  useEffect(() => {
    if (!cloudUser) {
      if (offlineMode) setWines(loadWines())
      setCellarReady(true)
      return
    }
    setCellarReady(false)
    let cancelled = false
    setCellarLoading(true)
    ;(async () => {
      let discarded = false
      try {
        discarded = await discardLocalProgressIfReset(cloudUser.id)
        if (discarded && !cancelled) setProgressResetTick((tick) => tick + 1)
        const cloud = await fetchWines(cloudUser.id)
        const local = discarded ? [] : loadWines()
        if (!cancelled && cloud.length === 0 && local.length > 0) {
          const upload = window.confirm(
            `Upload ${local.length} wine${local.length === 1 ? '' : 's'} to your account?`,
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
          setWines(discarded ? [] : loadWines())
        }
      } finally {
        if (!cancelled) {
          setCellarLoading(false)
          setCellarReady(true)
        }
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
    void (async () => {
      try {
        let p = await fetchMyProfile()
        if (
          !cancelled &&
          cloudUser?.id &&
          p &&
          !p.isPro &&
          isIosStoreKitConfigured()
        ) {
          const synced = await reconcileProWithSupabase(cloudUser.id)
          if (synced && !cancelled) {
            p = await fetchMyProfile()
          }
        }
        if (!cancelled && p) {
          try {
            await prepareReferralForSession()
            const refreshed = await fetchMyProfile()
            if (refreshed) p = refreshed
          } catch {
            // Invite attach retries the next time a wine is saved.
          }
        }
        if (!cancelled) {
          setProfile(p)
          setPro(syncProFromServer(p?.isPro, true, p?.proUntil))
        }
      } catch {
        if (!cancelled) setProfile(null)
      }
      finally {
        if (!cancelled) setProfileLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cloudUser?.id])

  useEffect(() => {
    if (!cloudUser) {
      setFriendCount(0)
      setFriendNameById(new Map())
      setFriendCountLoaded(true)
      return
    }
    setFriendCountLoaded(false)
    fetchFriendships(cloudUser.id)
      .then((rows) => {
        const accepted = rows.filter((f) => f.status === 'accepted' && f.friend)
        setFriendCount(accepted.length)
        const profiles = accepted.map((f) => f.friend as FriendProfile)
        const names = friendNameMapFromProfiles(profiles)
        names.set(cloudUser.id, 'You')
        setFriendNameById(names)
      })
      .catch(() => {
        setFriendCount(0)
        setFriendNameById(new Map())
      })
      .finally(() => setFriendCountLoaded(true))
  }, [cloudUser?.id])

  useEffect(() => {
    badgeHydratedRef.current = false
    badgeFriendCountRef.current = 0
    earnedBadgeTiersRef.current = null
    completedJourneysRef.current = new Set()
    setCompletedJourneys(new Set())
    progressSyncedRef.current = false
    setProgressSynced(false)
    badgeCellarBaselineRef.current = null
    xpFeedbackReadyRef.current = false
    pendingXpRef.current = null
    setXpToastItems([])
    // A signed-in cellar load sets this false, then true when the fetch finishes.
    // Clearing it here for an offline cellar leaves it false, because that load
    // is synchronous and already ran in an earlier effect.
    if (cloudUser?.id) setCellarReady(false)
  }, [cloudUser?.id, offlineMode])

  useEffect(() => {
    if (!cloudUser) {
      progressSyncedRef.current = true
      setProgressSynced(true)
      return
    }
    if (!cellarProgressReady || progressSyncedRef.current) return
    let cancelled = false
    ;(async () => {
      try {
        const discarded = await discardLocalProgressIfReset(cloudUser.id)
        if (discarded && !cancelled) setProgressResetTick((tick) => tick + 1)
        const cellar = winesRef.current
        const syncedJourneys = await syncJourneyCompletions(cloudUser.id, cellar)
        if (cancelled) return
        completedJourneysRef.current = syncedJourneys
        referralCountRef.current = profile?.qualifiedReferralCount ?? 0
        badgeFriendCountRef.current = friendCount
        const liveBadges = snapshotFromBadgeInput(
          buildBadgeInput(cellar, friendCount),
        )
        const syncedBadges = await syncEarnedBadgeTiersWithCellar(cloudUser.id, liveBadges)
        if (!cancelled) {
          earnedBadgeTiersRef.current = syncedBadges
          saveEarnedBadgeTiers(syncedBadges)
          saveCompletedJourneysLocal(syncedJourneys)
          setCompletedJourneys(syncedJourneys)
          badgeHydratedRef.current = true
          progressSyncedRef.current = true
          setProgressSynced(true)
        }
      } catch {
        if (!cancelled) {
          ensureBadgeHydrated()
          const localJourneys = loadCompletedJourneysLocal()
          completedJourneysRef.current = localJourneys
          setCompletedJourneys(localJourneys)
          progressSyncedRef.current = true
          setProgressSynced(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    cloudUser?.id,
    cloudUser,
    cellarProgressReady,
    ensureBadgeHydrated,
    buildBadgeInput,
    friendCount,
    profile?.qualifiedReferralCount,
  ])

  useEffect(() => {
    // progressSynced state lags the ref. On the commit that signs in, state is
    // still true from the signed-out session while the ref is already false.
    // Arming that frame stores the empty cellar, and the real cellar then
    // looks like a fresh points award.
    const action = decideXpCellarFeedback({
      badgeReady,
      progressSynced: progressSyncedRef.current,
      feedbackArmed: xpFeedbackReadyRef.current,
      baseline: badgeCellarBaselineRef.current,
      wines,
    })
    if (action === 'wait') return

    badgeFriendCountRef.current = friendCount
    if (action === 'ignore') return

    if (action === 'arm') {
      badgeCellarBaselineRef.current = wines
      ensureBadgeHydrated()
      xpFeedbackReadyRef.current = true
      const pending = pendingXpRef.current
      pendingXpRef.current = null
      if (pending) pushXpFeedback(pending.previous, pending.next)
      return
    }

    const previousWines = badgeCellarBaselineRef.current
    badgeCellarBaselineRef.current = wines
    if (!previousWines) return

    ensureBadgeHydrated({ seedIfMissing: false })
    const previousInput = buildBadgeInput(previousWines, badgeFriendCountRef.current)
    const nextInput = buildBadgeInput(wines, badgeFriendCountRef.current)
    applyBadgeProgressChange(previousInput, nextInput)
    pushXpFeedback(previousInput, nextInput)
  }, [
    wines,
    badgeReady,
    friendCount,
    applyBadgeProgressChange,
    buildBadgeInput,
    ensureBadgeHydrated,
    pushXpFeedback,
  ])

  // Nudge existing accounts that still use the auto-generated email prefix as their name.
  useEffect(() => {
    if (!cloudUser?.email || !profile?.displayName) return
    const emailPrefix = cloudUser.email.split('@')[0]?.toLowerCase()
    if (!emailPrefix || profile.displayName.toLowerCase() !== emailPrefix) return
    const key = `${STORAGE_PREFIX}.profile-name-prompt`
    if (sessionStorage.getItem(key) || guideOpen) return
    sessionStorage.setItem(key, '1')
    setFriendView(null)
    setView('profile')
  }, [cloudUser?.email, profile?.displayName, guideOpen])

  useEffect(() => {
    setRankingSetupOpen(
      needsRankingPreferenceSetup(profile?.rankingPreference, {
        profilePending: Boolean(cloudUser) && !profileLoaded,
      }),
    )
  }, [profile?.rankingPreference, cloudUser, profileLoaded, progressResetTick])

  useEffect(() => {
    document.documentElement.classList.toggle('user-guide-open', guideOpen)
    return () => document.documentElement.classList.remove('user-guide-open')
  }, [guideOpen])

  useEffect(() => {
    if (!guideOpen) return
    const step = USER_GUIDE_STEPS[guideStep]
    if (!step) return
    setFriendView(null)
    setProfileSettingsSection('menu')
    setView(step.tab)
    if (step.segment) setCellarSegment(step.segment)
  }, [guideOpen, guideStep])

  useEffect(() => {
    if (guideBootedRef.current) return
    if (!mainAppShell || authGateScreen) return
    if (cloudUser && !profileLoaded) return
    if (!forceGuide && !cellarReady) return
    const rankingPending =
      rankingSetupOpen ||
      needsRankingPreferenceSetup(profile?.rankingPreference, {
        profilePending: Boolean(cloudUser) && !profileLoaded,
      })
    if (rankingPending) return
    guideBootedRef.current = true
    if (forceGuide) {
      setGuideStep(0)
      setGuideOpen(true)
      return
    }
    if (!cloudUser) return
    if (hasSeenUserGuide(cloudUser.id)) return
    if (wines.length > 0) {
      markUserGuideSeen(cloudUser.id)
      return
    }
    setGuideStep(0)
    setGuideOpen(true)
  }, [
    mainAppShell,
    authGateScreen,
    rankingSetupOpen,
    cellarReady,
    profileLoaded,
    cloudUser,
    wines.length,
    forceGuide,
    profile?.rankingPreference,
  ])

  useEffect(() => {
    if (!configured || !cloudUser?.id) {
      void stopPushNotifications()
      return
    }
    void startPushNotifications(cloudUser.id)
    return () => {
      void stopPushNotifications()
    }
  }, [configured, cloudUser?.id])

  useEffect(() => {
    function onFriendsPush(e: Event) {
      const tab = (e as CustomEvent<{ tab: 'feed' | 'manage' }>).detail?.tab ?? 'feed'
      setFriendView(null)
      setView('friends')
      setFriendsRequestedTab(tab)
    }
    window.addEventListener(PUSH_NAV_EVENT, onFriendsPush)
    window.addEventListener(FRIENDS_PUSH_EVENT, onFriendsPush)
    return () => {
      window.removeEventListener(PUSH_NAV_EVENT, onFriendsPush)
      window.removeEventListener(FRIENDS_PUSH_EVENT, onFriendsPush)
    }
  }, [])

  useEffect(() => {
    if (view !== 'more') setAccountHighlight(false)
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
        const isPro = syncProFromServer(p?.isPro, true, p?.proUntil)
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

  const cellarPriceBounds = useMemo(() => {
    const base = cellarSegment === 'wishlist' ? cellarWishlist : cellarTried
    return priceBoundsFromWines(base)
  }, [cellarSegment, cellarTried, cellarWishlist])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = cellarSegment === 'wishlist' ? cellarWishlist : cellarTried
    let list = base.filter((w) => {
      if (typeFilter !== 'All' && w.type !== typeFilter) return false
      if (!wineMatchesPriceFilter(w, priceFilter, cellarPriceBounds)) return false
      if (cellarSegment === 'tried' && !wineMatchesTagFilter(w, tagFilter)) return false
      if (cellarSegment === 'tried' && favoriteFilter && !isWineFavorite(w)) return false
      if (!q) return true
      const tagText = (w.tastingTags ?? []).map(tastingTagLabel).join(' ')
      return [w.name, w.winery, w.varietal, w.region, w.notes, w.purchasedAt, tagText]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
    const effectiveSort = cellarSegment === 'wishlist' && sortKey === 'rating' ? 'addedAt' : sortKey
    return sortWines(list, effectiveSort, rankingPreference)
  }, [
    cellarSegment,
    cellarTried,
    cellarWishlist,
    search,
    typeFilter,
    tagFilter,
    favoriteFilter,
    priceFilter,
    cellarPriceBounds,
    sortKey,
    rankingPreference,
  ])

  const cellarTagFilters = useMemo(
    () => filterTagsForCellar(cellarTried, pro),
    [cellarTried, pro],
  )

  const cellarSortOptions = useMemo(
    () =>
      cellarSegment === 'wishlist'
        ? SORT_OPTIONS.filter((o) => o.key !== 'rating')
        : SORT_OPTIONS,
    [cellarSegment],
  )

  const stats = useMemo(() => {
    if (cellarTried.length === 0) return null
    const rated = cellarTried.filter((w) => wineEnjoyment(w) > 0)
    const avg =
      rated.length === 0
        ? null
        : rated.reduce((sum, w) => sum + compositeScore(w, rankingPreference), 0) / rated.length
    const best =
      rated.length === 0
        ? null
        : [...rated].sort((a, b) => compareByRank(a, b, rankingPreference))[0]
    return { count: cellarTried.length, avg, best }
  }, [cellarTried, rankingPreference])

  const atFreeLimit = !pro && triedCount(wines) >= FREE_WINE_LIMIT
  const atWishlistLimit = !pro && wishlistCount(wines) >= FREE_WISHLIST_LIMIT

  function openAddWineChooser() {
    setAddWineChooserOpen(true)
  }

  function goToAddTab() {
    setFriendView(null)
    setView('scan')
  }

  function goToInsightsTab() {
    setFriendView(null)
    setView('insights')
  }

  function showExistingWine(wine: Wine) {
    setFormOpen(false)
    setEditing(null)
    setAutoOpenScan(false)
    setAddWineChooserOpen(false)
    setFriendView(null)
    setView('cellar')
    setCellarSegment('tried')
    window.setTimeout(() => {
      document.getElementById(`wine-card-${wine.id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 60)
  }

  function openCellarWine(wine: Wine) {
    setFriendView(null)
    setView('cellar')
    setCellarSegment('tried')
    setFormMode('tried')
    setEditing(wine)
    setFormCreate(false)
    setFormOpen(true)
  }

  function finishGuide() {
    if (cloudUser) markUserGuideSeen(cloudUser.id)
    setGuideOpen(false)
  }

  function replayUserGuide() {
    setFriendView(null)
    setAddWineChooserOpen(false)
    setFormOpen(false)
    setAutoOpenScan(false)
    setGuideStep(0)
    setGuideOpen(true)
  }

  function guideScan(destination: AddWineDestination) {
    finishGuide()
    startAddWine(destination, true)
  }

  function startAddWine(destination: AddWineDestination, openScan: boolean) {
    if (destination === 'tried' && atFreeLimit) {
      setAddWineChooserOpen(false)
      goToAccount(true)
      return
    }
    if (destination === 'wishlist' && atWishlistLimit) {
      setAddWineChooserOpen(false)
      goToAccount(true)
      return
    }
    setAddWineChooserOpen(false)
    setFormMode(destination)
    setEditing(null)
    setFormCreate(false)
    setAutoOpenScan(openScan)
    setFormOpen(true)
  }

  function openTriedDraft(wine: Wine) {
    if (atFreeLimit) {
      goToAccount(true)
      return
    }
    setFormMode('tried')
    setEditing(wine)
    setFormCreate(true)
    setAutoOpenScan(false)
    setFormOpen(true)
  }

  function wineIsInCellar(wine: Pick<Wine, 'name' | 'winery' | 'vintage'>): boolean {
    return Boolean(findCellarDuplicate(wines, { ...wine, id: 'draft', status: 'tried' }))
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
    const previousWines = winesRef.current
    let nextWines: Wine[] = []
    setWines((prev) => {
      const exists = prev.some((w) => w.id === wine.id)
      nextWines = exists ? prev.map((w) => (w.id === wine.id ? wine : w)) : [...prev, wine]
      return nextWines
    })
    winesRef.current = nextWines
    badgeCellarBaselineRef.current = nextWines
    ensureBadgeHydrated({ seedIfMissing: false })
    const previousInput = buildBadgeInput(previousWines, badgeFriendCountRef.current)
    const nextInput = buildBadgeInput(nextWines, friendCount)
    applyBadgeProgressChangeRef.current(previousInput, nextInput)
    if (xpFeedbackReadyRef.current) {
      pushXpFeedback(previousInput, nextInput)
    } else {
      const pending = pendingXpRef.current
      pendingXpRef.current = pending
        ? { previous: pending.previous, next: nextInput }
        : { previous: previousInput, next: nextInput }
    }
    if (cloudUser) {
      try {
        const wasQualified = profile?.referralStatus === 'qualified'
        const synced = await upsertWine(cloudUser.id, wine, rankingPreference)
        setWines((prev) => {
          const next = prev.map((w) => (w.id === wine.id ? synced : w))
          winesRef.current = next
          // The save already announced these points. The server row is a new
          // array, not a second award.
          badgeCellarBaselineRef.current = next
          return next
        })
        if (wine.status !== 'wishlist' && wine.rating > 0) {
          const nextProfile = await fetchMyProfile()
          if (nextProfile) {
            setProfile(nextProfile)
            setPro(syncProFromServer(nextProfile.isPro, true, nextProfile.proUntil))
            if (!wasQualified && nextProfile.referralStatus === 'qualified') {
              setReferralNotice('Your invite counted. You and your friend each have a month of Pro.')
            }
          }
        }
      } catch (e) {
        window.alert(`Saved locally but cloud sync failed: ${(e as Error).message}`)
      }
    }
  }

  async function handleToggleFavorite(wine: Wine) {
    const next = {
      ...wine,
      ratingBuyAgain: favoriteRatingValue(!isWineFavorite(wine)),
    }
    await persistWine(applyCompositeRating(next, rankingPreference))
    requestAnimationFrame(() => {
      document
        .getElementById(`wine-card-${wine.id}`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
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
    const promptShare = !savingWishlist && becameTopWine(wines, normalized, rankingPreference)
    const shareInput: ShareWineCardInput | null = promptShare
      ? { wine: normalized, score: normalized.rating }
      : null
    if (shareInput) topShareRef.current = shareInput
    await persistWine(normalized)
    setFormOpen(false)
    if (shareInput) {
      setTopShare(shareInput)
    } else if (!savingWishlist) {
      const nextList = wines.some((item) => item.id === normalized.id)
        ? wines.map((item) => (item.id === normalized.id ? normalized : item))
        : [...wines, normalized]
      window.setTimeout(() => {
        if (topShareRef.current) return
        void maybeRequestStoreReview({
          ratedCount: triedCount(nextList),
          journeyCompleted: false,
        })
      }, 900)
    }
    setEditing(null)
    setFormCreate(false)
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
    a.download = `decanti-export-${new Date().toISOString().slice(0, 10)}.json`
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
      winesRef.current = next
      if (cloudUser) {
        const synced = await bulkUpsertWines(cloudUser.id, next, rankingPreference)
        setWines(synced)
        winesRef.current = synced
      }
    } catch {
      window.alert("That file doesn't look like a Decanti export.")
    }
  }

  async function viewFriendCellar(
    friendId: string,
    friendName: string,
    avatarUrl?: string,
    focusWineId?: string,
  ) {
    setCellarLoading(true)
    try {
      const [list, journeyMap] = await Promise.all([
        fetchWines(friendId),
        fetchCompletedJourneysForUsers([friendId]),
      ])
      setFriendWines(list)
      setFriendCompletedJourneys(journeyMap.get(friendId) ?? new Set())
      setFriendView({ id: friendId, name: friendName, avatarUrl, focusWineId })
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
    if (!enteredApp) {
      return (
        <MarketingPage
          onOpenApp={() => {
            rememberOpenApp()
            setEnteredApp(true)
          }}
        />
      )
    }
    return <AuthScreen />
  }

  const activeGuide = guideOpen ? USER_GUIDE_STEPS[guideStep] : undefined

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <button
            type="button"
            className={`header-profile${view === 'profile' ? ' active' : ''}`}
            aria-label="Profile"
            aria-current={view === 'profile' ? 'page' : undefined}
            onClick={openProfile}
          >
            <Avatar
              displayName={headerProfileLabel}
              email={profile?.email ?? cloudUser?.email}
              avatarUrl={profile?.avatarUrl}
              seed={profile?.id ?? cloudUser?.id}
              size="sm"
            />
          </button>
          <h1 className="header-page-title">{headerPageTitle}</h1>
          <div className="header-actions">
            {cloudUser && view === 'friends' && !friendView && (
              <NotificationsBell
                enabled
                userId={cloudUser.id}
                onNavigateFriends={(tab) => {
                  setFriendView(null)
                  setView('friends')
                  setFriendsRequestedTab(tab)
                }}
              />
            )}
          </div>
        </div>
      </header>

      <main ref={contentRef} className="content">
        {referralNotice && (
          <div className="referral-notice" role="status">
            <p>{referralNotice}</p>
            <button type="button" className="btn ghost small" onClick={() => setReferralNotice('')}>
              Dismiss
            </button>
          </div>
        )}
        {cellarLoading && view !== 'profile' && view !== 'more' && (
          <p className="auth-info">Syncing cellar…</p>
        )}

        {view === 'profile' || view === 'more' ? (
          <ProfileScreen
            surface={view}
            profileLoaded={profileLoaded}
            settingsSection={profileSettingsSection}
            onSettingsSectionChange={setProfileSettingsSection}
            profile={profile}
            email={cloudUser?.email}
            signedIn={Boolean(cloudUser)}
            offlineMode={offlineMode}
            cloudConfigured={configured}
            pro={pro}
            wineCount={triedCount(wines)}
            wines={wines}
            completedJourneys={completedJourneys}
            rankingPreference={rankingPreference}
            highlightSubscription={accountHighlight}
            onProfileSaved={setProfile}
            onRankingPreferenceSaved={applyRankingPreference}
            onProUnlocked={async (opts) => {
              const p = await fetchMyProfile()
              if (opts?.fromNativeIap) {
                activatePro()
                setProfile(p ? { ...p, isPro: true } : p)
                setPro(true)
                return
              }
              setProfile(p)
              setPro(syncProFromServer(p?.isPro, true, p?.proUntil))
            }}
            onSignOut={() => signOut()}
            onSignIn={() => exitOffline()}
            onReplayGuide={cloudUser ? replayUserGuide : undefined}
            onViewFriendCellar={(id, name, avatarUrl) => {
              void viewFriendCellar(id, name, avatarUrl)
            }}
          />
        ) : view === 'friends' ? (
          cloudUser && friendView ? (
            <FriendCellarView
              displayName={friendView.name}
              avatarUrl={friendView.avatarUrl}
              userId={friendView.id}
              wines={friendWines}
              highlightWineId={friendView.focusWineId}
              friendNameById={friendNameById}
              rankingPreference={rankingPreference}
              shareAttribution={`From ${friendView.name}'s cellar`}
              backButton={{ label: '← Back to friends', onClick: () => setFriendView(null) }}
              onSaveToWishlist={(wine) => handleSaveWishlistFromFriend(wine, friendView.name)}
              completedJourneys={friendCompletedJourneys}
              isWishlistSaved={(wine) => isWishlistDuplicate(wines, wine)}
              wishlistSavingKey={savingFriendWishlistKey}
              canModerate
              onBlocked={() => {
                requestNotificationsRefresh()
                setFriendView(null)
              }}
            />
          ) : cloudUser ? (
            <FriendsPanel
              userId={cloudUser.id}
              rankingPreference={rankingPreference}
              inviteCode={profile?.referralCode}
              qualifiedReferralCount={profile?.qualifiedReferralCount ?? 0}
              onViewCellar={viewFriendCellar}
              onSaveToWishlist={handleSaveWishlistFromFriend}
              onAddToCellar={(wine) => openTriedDraft(friendWineToTriedDraft(wine))}
              isInCellar={wineIsInCellar}
              isWishlistSaved={(wine) => isWishlistDuplicate(wines, wine)}
              savingWishlistKey={savingFriendWishlistKey}
              onFriendshipsChanged={handleFriendshipsChanged}
              requestedTab={friendsRequestedTab}
              onRequestedTabHandled={() => setFriendsRequestedTab(null)}
            />
          ) : (
            <section className="empty">
              <h2>Social</h2>
              <p>Sign in to see what friends are drinking, and save a bottle onto your want-to-try list.</p>
            </section>
          )
        ) : view === 'scan' ? (
          <ScanHub
            wines={cellarTried}
            wishlist={cellarWishlist}
            rankingPreference={rankingPreference}
            pro={pro}
            signedIn={Boolean(cloudUser)}
            cloudConfigured={configured}
            onUpgrade={() => goToAccount(true)}
            onSaveWishlist={handleSaveWishlistFromMenu}
            onAddToCellar={openTriedDraft}
            isInCellar={wineIsInCellar}
            onAddWine={openAddWineChooser}
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
                Your usual score, how each bottle-price range rates, best-value bottles, and
                your taste by type, region, and varietal — all in {APP_NAME_PRO}.
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
                className={`cellar-segment-btn ${cellarSegment === 'tried' ? 'active' : ''}${activeGuide?.segment === 'tried' ? ' tour-target' : ''}`}
                onClick={() => {
                  setCellarSegment('tried')
                }}
              >
                Tried ({cellarTried.length})
              </button>
              <button
                type="button"
                className={`cellar-segment-btn ${cellarSegment === 'wishlist' ? 'active' : ''}${activeGuide?.segment === 'wishlist' ? ' tour-target' : ''}`}
                onClick={() => {
                  setCellarSegment('wishlist')
                  setTagFilter(null)
                  setPriceFilter(null)
                  setSortKey((k) => (k === 'rating' ? 'addedAt' : k))
                }}
              >
                Want to try ({cellarWishlist.length})
              </button>
            </section>

            {cellarSegment === 'tried' && stats && (
              <section className="stats stats-cellar" aria-label="Cellar summary">
                <button
                  type="button"
                  className="stat stat-link"
                  onClick={goToInsightsTab}
                  aria-label="View stats and insights"
                >
                  <span className="stat-value">
                    {stats.count}
                    {!pro && <span className="stat-limit"> / {FREE_WINE_LIMIT}</span>}
                  </span>
                  <span className="stat-label">
                    {stats.count === 1 ? 'wine tried' : 'wines tried'}
                  </span>
                </button>
                <button
                  type="button"
                  className="stat stat-link"
                  onClick={goToInsightsTab}
                  aria-label="View average rating in insights"
                >
                  <span className="stat-value">{stats.avg == null ? '—' : `${stats.avg.toFixed(1)}/10`}</span>
                  <span className="stat-label">average rating</span>
                </button>
                {stats.best ? (
                <button
                  type="button"
                  className="stat stat-link stat-span-2"
                  onClick={() => {
                    if (stats.best) openCellarWine(stats.best)
                  }}
                  aria-label={`Open ${stats.best.name}`}
                >
                  <span className="stat-value stat-best" title={stats.best.name}>
                    {stats.best.name}
                  </span>
                  <span className="stat-label">current favorite</span>
                </button>
                ) : (
                <div className="stat stat-span-2">
                  <span className="stat-value stat-best">—</span>
                  <span className="stat-label">current favorite</span>
                </div>
                )}
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
              <CellarFilterBar
                search={search}
                onSearchChange={setSearch}
                sortKey={sortKey}
                sortOptions={cellarSortOptions}
                onSortChange={setSortKey}
                typeFilter={typeFilter}
                onTypeFilter={setTypeFilter}
                tagFilter={tagFilter}
                onTagFilter={setTagFilter}
                tagOptions={cellarTagFilters}
                showTagFilter={cellarSegment === 'tried'}
                favoriteFilter={favoriteFilter}
                onFavoriteFilterChange={setFavoriteFilter}
                showFavoriteFilter={cellarSegment === 'tried'}
                priceBounds={cellarPriceBounds}
                priceFilter={priceFilter}
                onPriceFilterChange={setPriceFilter}
                exportImport={
                  <div className="data-actions">
                    <button type="button" className="link-btn" onClick={handleExport}>
                      Export{!pro && ' 🔒'}
                    </button>
                    <button type="button" className="link-btn" onClick={handleImportClick}>
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
                }
              />
            )}

            {cellarSegment === 'tried' && cellarTried.length === 0 ? (
              <section className="empty cellar-empty">
                <p className="cellar-empty-text">No wines in your cellar yet.</p>
                <button type="button" className="btn ghost" onClick={goToAddTab}>
                  Add bottles
                </button>
              </section>
            ) : cellarSegment === 'wishlist' && cellarWishlist.length === 0 ? (
              <section className="empty cellar-empty">
                <p className="cellar-empty-text">Nothing on your wishlist yet.</p>
                <button type="button" className="btn ghost" onClick={goToAddTab}>
                  Add bottles
                </button>
              </section>
            ) : visible.length === 0 ? (
              <section className="empty">
                <h2>No matches</h2>
                <p>
                  {tagFilter
                    ? `No tried wines tagged “${tastingTagLabel(tagFilter)}”.`
                    : favoriteFilter
                      ? 'No favorites match your search or filters.'
                      : 'No wines match your search or filters.'}
                </p>
                {(tagFilter ||
                  favoriteFilter ||
                  search.trim() ||
                  typeFilter !== 'All' ||
                  priceFilter != null) && (
                  <div className="empty-actions">
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => {
                        setSearch('')
                        setTypeFilter('All')
                        setTagFilter(null)
                        setFavoriteFilter(false)
                        setPriceFilter(null)
                      }}
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
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
                      setFormCreate(false)
                      setFormOpen(true)
                    }}
                    onEdit={() => {
                      setFormMode('wishlist')
                      setEditing(wine)
                      setFormCreate(false)
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
                    withFriendsLabel={formatWithFriendsNames(wine, friendNameById)}
                    activeTagFilter={tagFilter}
                    onTagFilter={(id) => setTagFilter(tagFilter === id ? null : id)}
                    onEdit={() => {
                      setFormMode('tried')
                      setEditing(wine)
                      setFormCreate(false)
                      setFormOpen(true)
                    }}
                    onToggleFavorite={() => void handleToggleFavorite(wine)}
                    onDelete={() => handleDelete(wine)}
                  />
                ))}
              </ol>
            )}
          </>
        )}
      </main>

      {!isNativeIosTabBar() && (
      <nav className="tabs tabs-dock" aria-label="Main">
        <button
          type="button"
          className={`tab tab-icon ${view === 'cellar' ? 'active' : ''}${activeGuide?.tab === 'cellar' ? ' tour-target' : ''}`}
          aria-label="Cellar"
          aria-current={view === 'cellar' ? 'page' : undefined}
          onClick={() => {
            setFriendView(null)
            setView('cellar')
          }}
        >
          <IconCellarList className="tab-icon-svg" size={22} />
          <span className="tab-dock-label">Cellar</span>
        </button>
        {(cloudUser || activeGuide?.tab === 'friends') && (
          <button
            type="button"
            className={`tab tab-icon ${view === 'friends' ? 'active' : ''}${activeGuide?.tab === 'friends' ? ' tour-target' : ''}`}
            aria-label="Social"
            aria-current={view === 'friends' ? 'page' : undefined}
            onClick={() => {
              setFriendView(null)
              setView('friends')
            }}
          >
            <IconChatBubble className="tab-icon-svg" size={22} />
            <span className="tab-dock-label">Social</span>
          </button>
        )}
        <button
          type="button"
          className={`tab tab-icon tab-fab ${view === 'scan' ? 'active' : ''}${activeGuide?.tab === 'scan' ? ' tour-target' : ''}`}
          aria-label="Add"
          aria-current={view === 'scan' ? 'page' : undefined}
          onClick={() => {
            setFriendView(null)
            setView('scan')
          }}
        >
          <span className="tab-fab-bubble" aria-hidden="true">
            <IconPlus className="tab-fab-icon" size={28} />
          </span>
          <span className="tab-dock-label">Add</span>
        </button>
        <button
          type="button"
          className={`tab tab-icon ${view === 'insights' ? 'active' : ''}`}
          aria-label={pro ? 'Stats' : 'Stats (Pro feature)'}
          aria-current={view === 'insights' ? 'page' : undefined}
          onClick={() => {
            setFriendView(null)
            setView('insights')
          }}
        >
          <IconBarChart className="tab-icon-svg" size={22} />
          <span className="tab-dock-label">Stats</span>
          {!pro && (
            <span className="tab-lock-badge" title="Decanti Pro">
              <IconLock className="tab-lock-icon" size={10} />
            </span>
          )}
        </button>
        <button
          type="button"
          className={`tab tab-icon ${view === 'more' ? 'active' : ''}${activeGuide?.tab === 'more' ? ' tour-target' : ''}`}
          aria-label="More"
          aria-current={view === 'more' ? 'page' : undefined}
          onClick={() => {
            setFriendView(null)
            setProfileSettingsSection('menu')
            setAccountHighlight(false)
            setView('more')
          }}
        >
          <IconEllipsis className="tab-icon-svg tab-icon-more" size={22} />
          <span className="tab-dock-label">More</span>
        </button>
      </nav>
      )}

      {addWineChooserOpen && (
        <AddWineChooser
          cellarLimitReached={atFreeLimit}
          wishlistLimitReached={atWishlistLimit}
          onClose={() => setAddWineChooserOpen(false)}
          onChoose={startAddWine}
        />
      )}

      {formOpen && (
        <WineForm
          initial={editing}
          formMode={formMode}
          autoOpenScan={autoOpenScan}
          cellarWines={wines}
          completedJourneys={completedJourneys}
          onSave={handleSave}
          onViewExisting={showExistingWine}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
            setFormCreate(false)
            setAutoOpenScan(false)
          }}
          createNew={formCreate}
          rankingPreference={rankingPreference}
          pro={pro}
          signedIn={Boolean(cloudUser)}
          cloudConfigured={isSupabaseConfigured}
          userId={cloudUser?.id}
          onUpgrade={() => goToAccount(true)}
        />
      )}

      {rankingSetupOpen && (
        <RankingPreferenceModal onChoose={handleRankingPreferenceChoose} busy={rankingSetupBusy} />
      )}

      {activeGuide && (
        <UserGuide
          step={activeGuide}
          index={guideStep}
          total={USER_GUIDE_STEPS.length}
          onBack={() => setGuideStep((step) => Math.max(0, step - 1))}
          onNext={() => setGuideStep((step) => Math.min(USER_GUIDE_STEPS.length - 1, step + 1))}
          onDismiss={finishGuide}
          onTried={() => guideScan('tried')}
          onWishlist={() => guideScan('wishlist')}
        />
      )}

      <ShareWineCardSheet
        open={topShare != null}
        input={topShare}
        onClose={() => {
          topShareRef.current = null
          setTopShare(null)
        }}
      />

      <BadgeUnlockToasts items={badgeToastItems} onDismiss={dismissBadgeToast} />
      <XpFeedbackToasts items={xpToastItems} onDismiss={dismissXpToast} />

      {!isSupabaseConfigured && (
        <p className="auth-offline-note app-footer-note">
          Cloud sync disabled — add Supabase keys to enable accounts and friends.
        </p>
      )}

      <AdBannerProbe
        visible={mainAppShell && !authGateScreen && isNativeApp()}
        blockedReason={
          !adsAllowed ? `gating off (isPro=${String(profile?.isPro ?? pro)})` : undefined
        }
      />

      {demoScanOverlay === 'menu' || demoScanOverlay === 'label' ? (
        <ScanPourOverlay
          open
          variant={demoScanOverlay}
          previewUrl={`${import.meta.env.BASE_URL}brand/theme-preview-classic.svg`}
        />
      ) : null}
    </div>
  )
}
