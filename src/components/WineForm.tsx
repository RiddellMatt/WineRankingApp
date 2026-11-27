import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { aiLabelToScanResult, LabelScanError, scanLabelWithAi } from '../lib/labelScanApi'
import {
  baselineFromAiLabel,
  reportLabelScanCorrection,
  type LabelScanBaseline,
} from '../lib/scanCorrectionLog'
import { CONTENT_REJECTED_MESSAGE, containsBlockedPhrase } from '../lib/contentFilter'
import { applyCompositeRating, compositeScore } from '../lib/ranking'
import { suggestRegions } from '../lib/regionSuggestions'
import { journeyFormHints } from '../lib/journeys'
import type { ScanResult } from '../scanner'
import { hasTaste, lookupTaste } from '../tasteData'
import { WINE_TYPES, type RankingPreference, type TasteProfile, type Wine, type WineType } from '../types'
import { catalogTags } from '../lib/tastingTags'
import { triedWines } from '../lib/wishlist'
import {
  dismissKeyboard,
  focusNextTextField,
  isTextField,
  releaseKeyboardFrameSoon,
  shouldDismissKeyboardOnScroll,
} from '../lib/keyboardInset'
import { canonicalVarietal, isListedVarietal, typeForVarietal, varietalFitsType } from '../lib/wineVarietals'
import { ScoreReadout, ScoreSlider } from './ScoreSlider'
import { TasteInput } from './TasteProfile'
import { TastingTagsInput } from './TastingTagsInput'
import { TriedOnField } from './TriedOnField'
import { DuplicateWineDialog } from './DuplicateWineDialog'
import { findCellarDuplicate, normalizePours, type Pour } from '../lib/winePours'
import { resolveWinePrices } from '../lib/winePrice'
import { isoDateFromLocal, normalizeTriedOn } from '../lib/wineMoments'
import { WinePhotoField } from './WinePhotoField'
import { VarietalSelect } from './VarietalSelect'
import { RegionPicker } from './RegionPicker'
import { PlacePicker } from './PlacePicker'
import { ScanPourOverlay } from './ScanPourOverlay'
import { WithFriendsPicker } from './WithFriendsPicker'
import { fetchFriendships, type FriendProfile } from '../lib/friendsDb'
import { normalizeWithFriendIds } from '../lib/wineWithFriends'

interface Props {
  initial: Wine | null
  formMode?: 'tried' | 'wishlist'
  cellarWines?: Wine[]
  completedJourneys?: Set<string>
  onSave: (wine: Wine) => void
  onClose: () => void
  rankingPreference: RankingPreference
  pro?: boolean
  signedIn?: boolean
  cloudConfigured?: boolean
  onUpgrade?: () => void
  /** Open the label scan file picker once when adding a new wine. */
  autoOpenScan?: boolean
  userId?: string
  /** Close this form and show the cellar card for a wine already saved. */
  onViewExisting?: (wine: Wine) => void
  /** initial is a prefill for a new bottle, not an edit of that id. */
  createNew?: boolean
}

export function WineForm({
  initial,
  formMode = 'tried',
  cellarWines = [],
  completedJourneys = new Set(),
  onSave,
  onClose,
  rankingPreference,
  pro = false,
  signedIn = false,
  cloudConfigured = false,
  onUpgrade,
  autoOpenScan = false,
  userId,
  onViewExisting,
  createNew = false,
}: Props) {
  const wishlistForm = formMode === 'wishlist'
  const editingExisting = Boolean(initial) && !createNew
  const promoteFromWishlist = initial?.status === 'wishlist' && !wishlistForm
  const [name, setName] = useState(initial?.name ?? '')
  const [winery, setWinery] = useState(initial?.winery ?? '')
  const [vintage, setVintage] = useState(initial?.vintage?.toString() ?? '')
  const [type, setType] = useState<WineType>(initial?.type ?? 'Red')
  const [varietal, setVarietal] = useState(initial?.varietal ?? '')
  const [region, setRegion] = useState(initial?.region ?? '')
  const initialPrices = resolveWinePrices(initial ?? {})
  const [glassPrice, setGlassPrice] = useState(
    initialPrices.glassPrice != null ? String(initialPrices.glassPrice) : '',
  )
  const [bottlePrice, setBottlePrice] = useState(
    initialPrices.bottlePrice != null ? String(initialPrices.bottlePrice) : '',
  )
  const [purchasedAt, setPurchasedAt] = useState(initial?.purchasedAt ?? '')
  const [triedOn, setTriedOn] = useState<string | null>(initial?.triedOn ?? null)
  const [pours, setPours] = useState<Pour[]>(() => normalizePours(initial?.pours))
  const [duplicate, setDuplicate] = useState<Wine | null>(null)
  const allowDuplicateRef = useRef(false)
  const pendingWineRef = useRef<Wine | null>(null)
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? [])
  const [ratingEnjoyment, setRatingEnjoyment] = useState(
    initial?.ratingEnjoyment ?? initial?.rating ?? 0,
  )
  const [ratingValue, setRatingValue] = useState(initial?.ratingValue ?? 0)
  const [taste, setTaste] = useState<TasteProfile>(initial?.taste ?? {})
  // Wines whose taste was customized keep it; otherwise the reference
  // profile tracks the varietal/type as the user types.
  const [tasteTouched, setTasteTouched] = useState(
    hasTaste(initial?.taste) && initial?.tasteSource !== 'typical',
  )
  const [tasteBasedOn, setTasteBasedOn] = useState('')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [tastingTags, setTastingTags] = useState<string[]>(initial?.tastingTags ?? [])
  const [withFriendIds, setWithFriendIds] = useState<string[]>(
    normalizeWithFriendIds(initial?.withFriendIds),
  )
  const [acceptedFriends, setAcceptedFriends] = useState<FriendProfile[]>([])
  const [error, setError] = useState('')
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'done' | 'failed'>('idle')
  const [scanMode, setScanMode] = useState<'ai' | 'basic'>('basic')
  const [scanPct, setScanPct] = useState(0)
  const [scanSummary, setScanSummary] = useState('')
  const [aiPreviewUrl, setAiPreviewUrl] = useState<string | null>(null)
  const scanInputRef = useRef<HTMLInputElement>(null)
  const formBodyRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const cancelArmed = useRef(false)
  const aiScanBaselineRef = useRef<LabelScanBaseline | null>(null)
  const aiAvailable = pro && signedIn && cloudConfigured
  const triedCellar = useMemo(() => triedWines(cellarWines), [cellarWines])

  useEffect(() => {
    if (scanState !== 'done' && scanState !== 'failed') return
    dismissKeyboard()
    formBodyRef.current?.scrollTo({ top: 0 })
    // The photo picker hands focus back after it closes. Blur again so the
    // keyboard stays down until the person taps a field.
    const timers = [80, 320, 700].map((ms) => window.setTimeout(dismissKeyboard, ms))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [scanState])

  function finishClose() {
    dismissKeyboard()
    releaseKeyboardFrameSoon()
    onClose()
  }

  useEffect(() => {
    return () => releaseKeyboardFrameSoon()
  }, [])

  useEffect(() => {
    if (!autoOpenScan || initial) return
    const t = window.setTimeout(() => scanInputRef.current?.click(), 120)
    return () => window.clearTimeout(t)
  }, [autoOpenScan, initial])

  useEffect(() => {
    if (!userId || !signedIn || !cloudConfigured) {
      setAcceptedFriends([])
      return
    }
    let cancelled = false
    fetchFriendships(userId)
      .then((rows) => {
        if (cancelled) return
        const list = rows
          .filter((f) => f.status === 'accepted' && f.friend)
          .map((f) => f.friend as FriendProfile)
        setAcceptedFriends(list)
      })
      .catch(() => {
        if (!cancelled) setAcceptedFriends([])
      })
    return () => {
      cancelled = true
    }
  }, [userId, signedIn, cloudConfigured])

  function onFormKeyDown(e: ReactKeyboardEvent<HTMLFormElement>) {
    if (e.key === 'Tab') {
      const focusable = [...e.currentTarget.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex]')].filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex >= 0 && el.getClientRects().length > 0,
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
      return
    }
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    if (e.target instanceof HTMLSelectElement) {
      e.preventDefault()
      return
    }
    if (!isTextField(e.target) || e.target instanceof HTMLTextAreaElement) return
    if (focusNextTextField(e.target, e.currentTarget)) e.preventDefault()
  }

  function parseOptionalPrice(raw: string): number | null {
    const trimmed = raw.trim()
    if (!trimmed) return null
    const value = Number(trimmed)
    if (!Number.isFinite(value) || value <= 0) return null
    return value
  }

  const recentDrinkPlaces = useMemo(() => {
    const seen = new Set<string>()
    const places: string[] = []
    for (const wine of [...cellarWines].sort((a, b) => b.addedAt - a.addedAt)) {
      const place = wine.purchasedAt.trim()
      const key = place.toLowerCase()
      if (!place || seen.has(key)) continue
      seen.add(key)
      places.push(place)
      if (places.length === 4) break
    }
    return places
  }, [cellarWines])

  const previewRank = useMemo(
    () =>
      compositeScore(
        {
          ratingEnjoyment,
          ratingValue: ratingValue > 0 ? ratingValue : null,
        },
        rankingPreference,
      ),
    [ratingEnjoyment, ratingValue, rankingPreference],
  )

  const regionSuggestions = useMemo(
    () =>
      suggestRegions({
        name,
        winery,
        varietal,
        region,
      }),
    [name, winery, varietal, region],
  )

  const journeyHints = useMemo(() => {
    if (wishlistForm) return []
    return journeyFormHints(region, cellarWines, completedJourneys, {
      excludeWineId: initial?.id,
    })
  }, [wishlistForm, region, cellarWines, completedJourneys, initial?.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      dismissKeyboard()
      releaseKeyboardFrameSoon()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (tasteTouched) return
    const { taste: reference, basedOn } = lookupTaste(varietal, name, type)
    setTaste(reference)
    setTasteBasedOn(basedOn)
  }, [varietal, name, type, tasteTouched])

  function applyScan(scan: ScanResult, mode: 'ai' | 'basic') {
    const found: string[] = []
    // Prefill only; never overwrite something the user already typed.
    if (scan.name && !name.trim()) {
      setName(scan.name)
      found.push('name')
    }
    if (scan.winery && !winery.trim()) {
      setWinery(scan.winery)
      found.push('winery')
    }
    if (scan.vintage && !vintage) {
      setVintage(String(scan.vintage))
      found.push('vintage')
    }
    const scannedVarietal = !varietal.trim()
      ? scan.varietal
        ? canonicalVarietal(scan.varietal)
        : scan.name && isListedVarietal(scan.name)
          ? canonicalVarietal(scan.name)
          : ''
      : ''
    if (scan.region && !region.trim()) {
      setRegion(scan.region)
      found.push('region')
    }
    let nextType = type
    if (scan.type && !initial) {
      nextType = scan.type
      found.push('type')
    } else if (!initial && !scan.type && scannedVarietal) {
      const inferred = typeForVarietal(scannedVarietal)
      if (inferred) {
        nextType = inferred
        found.push('type')
      }
    }
    if (!initial && scannedVarietal && !varietalFitsType(scannedVarietal, nextType)) {
      const inferred = typeForVarietal(scannedVarietal)
      if (inferred) nextType = inferred
    }
    const varietalToApply =
      scannedVarietal && varietalFitsType(scannedVarietal, nextType) ? scannedVarietal : ''
    if (varietalToApply) {
      setVarietal(varietalToApply)
      found.push('varietal')
    }
    if (nextType !== type) setType(nextType)
    if (found.length === 0) {
      setScanState('failed')
      setScanSummary("Couldn't read anything useful — try a straighter, closer photo in good light.")
    } else {
      setScanState('done')
      const source = mode === 'ai' ? 'AI label scan' : 'label scan'
      setScanSummary(`Updated ${found.join(', ')} from ${source}.`)
    }
  }

  async function runBasicScan(file: File) {
    setScanMode('basic')
    setScanState('scanning')
    setScanPct(0)
    setScanSummary('')
    const { scanLabel } = await import('../scanner')
    applyScan(await scanLabel(file, setScanPct), 'basic')
  }

  async function runAiScan(file: File) {
    const preview = URL.createObjectURL(file)
    setAiPreviewUrl(preview)
    setScanMode('ai')
    setScanState('scanning')
    setScanPct(15)
    setScanSummary('')
    try {
      const { label } = await scanLabelWithAi(file)
      setScanPct(100)
      aiScanBaselineRef.current = baselineFromAiLabel(label)
      applyScan(aiLabelToScanResult(label), 'ai')
    } catch (err) {
      if (err instanceof LabelScanError) {
        if (err.code === 'not_configured') {
          await runBasicScan(file)
          return
        }
        if (err.code === 'quota_exceeded') {
          setScanState('failed')
          setScanSummary('No AI label scans left this month.')
          return
        }
        if (err.code === 'pro_required' || err.code === 'auth_required') {
          await runBasicScan(file)
          return
        }
        setScanState('failed')
        setScanSummary(err.message)
        return
      }
      setScanState('failed')
      setScanSummary('Label scan failed. Try another photo.')
    } finally {
      URL.revokeObjectURL(preview)
      setAiPreviewUrl(null)
    }
  }

  async function handleScanFile(file: File) {
    try {
      if (aiAvailable) {
        await runAiScan(file)
      } else {
        await runBasicScan(file)
      }
    } catch {
      setScanState('failed')
      setScanSummary('Scanning failed on this device. You can still enter the wine manually.')
    }
  }

  function reportError(message: string) {
    setError(message)
    window.requestAnimationFrame(() => {
      const body = formBodyRef.current
      if (!body) return
      if (!name.trim()) {
        body.scrollTo({ top: 0 })
        nameInputRef.current?.focus()
        return
      }
      body.scrollTo({ top: body.scrollHeight })
    })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      reportError('Give the wine a name.')
      return
    }
    if (containsBlockedPhrase(notes)) {
      reportError(CONTENT_REJECTED_MESSAGE)
      return
    }
    const wine = applyCompositeRating(
      {
        id: editingExisting ? initial!.id : crypto.randomUUID(),
        name: name.trim(),
        winery: winery.trim(),
        vintage: vintage ? Number(vintage) : null,
        type,
        varietal: varietal.trim(),
        region: region.trim(),
        ...resolveWinePrices({
          glassPrice: parseOptionalPrice(glassPrice),
          bottlePrice: parseOptionalPrice(bottlePrice),
        }),
        ratingEnjoyment: wishlistForm ? 0 : ratingEnjoyment,
        ratingValue: !wishlistForm && ratingValue > 0 ? ratingValue : null,
        ratingBuyAgain: !wishlistForm ? (initial?.ratingBuyAgain ?? null) : null,
        rating: 0,
        notes: notes.trim(),
        tastingTags: wishlistForm
          ? []
          : pro
            ? tastingTags
            : tastingTags.filter((id) => catalogTags(false).some((t) => t.id === id)),
        withFriendIds: wishlistForm ? [] : normalizeWithFriendIds(withFriendIds),
        purchasedAt: purchasedAt.trim(),
        triedOn: wishlistForm ? null : triedOn,
        pours: wishlistForm ? [] : normalizePours(pours),
        photos: wishlistForm ? [] : photos,
        taste: wishlistForm ? {} : taste,
        tasteSource: wishlistForm ? undefined : tasteTouched ? 'custom' : 'typical',
        status: wishlistForm ? 'wishlist' : 'tried',
        addedAt: editingExisting ? initial!.addedAt : Date.now(),
      },
      rankingPreference,
    )
    if (
      aiScanBaselineRef.current &&
      scanMode === 'ai' &&
      signedIn &&
      cloudConfigured &&
      !wishlistForm
    ) {
      reportLabelScanCorrection(aiScanBaselineRef.current, {
        name: wine.name,
        winery: wine.winery,
        vintage: wine.vintage,
        varietal: wine.varietal,
        region: wine.region,
        type: wine.type,
      })
      aiScanBaselineRef.current = null
    }
    const checkingNewTried = !wishlistForm && (!editingExisting || initial?.status === 'wishlist')
    if (checkingNewTried && !allowDuplicateRef.current) {
      const match = findCellarDuplicate(cellarWines, wine)
      if (match) {
        pendingWineRef.current = wine
        setDuplicate(match)
        return
      }
    }
    allowDuplicateRef.current = false
    setDuplicate(null)
    onSave(wine)
  }

  function recordAgain(triedOnAgain: string | null) {
    if (!duplicate) return
    const date = normalizeTriedOn(triedOnAgain)
    onSave({
      ...duplicate,
      pours: [...normalizePours(duplicate.pours), { triedOn: date }],
    })
  }

  const modalTitle = promoteFromWishlist
    ? 'Mark as tried'
    : editingExisting
      ? wishlistForm
        ? 'Edit wishlist item'
        : 'Edit wine'
      : 'Add wine'

  const destinationHint = !editingExisting
    ? wishlistForm
      ? 'To your wishlist'
      : 'To your cellar'
    : null

  const submitLabel = promoteFromWishlist
    ? 'Save to cellar'
    : editingExisting
      ? 'Save changes'
      : wishlistForm
        ? 'Add to wishlist'
        : 'Add to cellar'

  const aiScanning = scanState === 'scanning' && scanMode === 'ai'

  return (
    <div
      className="modal-backdrop wine-form-backdrop"
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return
        // The dimmed margin is not a way out. A tap there only puts the
        // keyboard away. Save and Cancel are the ways off this screen.
        if (isTextField(document.activeElement)) dismissKeyboard()
      }}
    >
      <ScanPourOverlay open={aiScanning} variant="label" previewUrl={aiPreviewUrl} />
      <form
        className="modal wine-form-modal"
        onSubmit={handleSubmit}
        onKeyDown={onFormKeyDown}
      >
        <div className="modal-header">
          <div className="modal-header-titles">
            <h2>{modalTitle}</h2>
            {destinationHint && (
              <p className="modal-destination-hint">{destinationHint}</p>
            )}
          </div>
          <button type="button" className="icon-btn" onClick={finishClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div
          className="wine-form-body"
          ref={formBodyRef}
          onScroll={() => {
            if (!shouldDismissKeyboardOnScroll()) return
            dismissKeyboard()
          }}
          onPointerDown={(e) => {
            if (!(e.target instanceof Element)) return
            if (e.target.closest('input, textarea, select, button, a, label')) return
            if (!isTextField(document.activeElement)) return
            dismissKeyboard()
          }}
        >
        {!initial && (
          <div className="scan-box">
            <button
              type="button"
              className="btn ghost scan-btn"
              disabled={scanState === 'scanning'}
              onClick={() => scanInputRef.current?.click()}
            >
              {scanState === 'scanning'
                ? scanMode === 'ai'
                  ? 'Scanning…'
                  : `Reading label… ${scanPct}%`
                : aiAvailable
                  ? '📷 Scan label (AI)'
                  : '📷 Scan label'}
            </button>
            <input
              ref={scanInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleScanFile(file)
                e.target.value = ''
              }}
            />
            {scanSummary && (
              <p className={`scan-summary ${scanState === 'failed' ? 'failed' : ''}`}>
                {scanSummary}
              </p>
            )}
          </div>
        )}

        <div className="form-grid">
          <label className="field span-2">
            <span>Wine name *</span>
            <input
              ref={nameInputRef}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (e.target.value.trim()) {
                  setError((current) => (current === 'Give the wine a name.' ? '' : current))
                }
              }}
              placeholder="e.g. Barolo Riserva"
              enterKeyHint="next"
              autoComplete="off"
              aria-invalid={error === 'Give the wine a name.' || undefined}
            />
          </label>
          <label className="field">
            <span>Winery</span>
            <input
              value={winery}
              onChange={(e) => setWinery(e.target.value)}
              placeholder="e.g. Marchesi di Barolo"
              enterKeyHint="next"
              autoComplete="organization"
            />
          </label>
          <label className="field">
            <span>Vintage</span>
            <input
              type="number"
              inputMode="numeric"
              min="1900"
              max="2100"
              value={vintage}
              onChange={(e) => setVintage(e.target.value)}
              placeholder="e.g. 2019"
              enterKeyHint="next"
            />
          </label>
          <label className="field">
            <span>Type</span>
            <select
              value={type}
              onChange={(e) => {
                const next = e.target.value as WineType
                setType(next)
                setVarietal((current) => (varietalFitsType(current, next) ? current : ''))
              }}
            >
              {WINE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Varietal</span>
            <VarietalSelect value={varietal} wineType={type} onChange={setVarietal} />
          </label>
          <label className="field span-2">
            <span>Region</span>
            <RegionPicker
              value={region}
              onChange={setRegion}
              suggestionChips={regionSuggestions.length > 0 && !region.trim() ? regionSuggestions : []}
            />
            {journeyHints.length > 0 && (
              <ul className="journey-form-hints">
                {journeyHints.map((hint) => (
                  <li className="journey-form-hint" key={hint.id}>
                    <span className="journey-form-hint-icon" aria-hidden="true">
                      {hint.icon}
                    </span>
                    <span className="journey-form-hint-line">{hint.line}</span>
                  </li>
                ))}
              </ul>
            )}
          </label>
          <label className="field">
            <span>Glass price ($)</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={glassPrice}
              onChange={(e) => setGlassPrice(e.target.value)}
              placeholder="Optional"
              enterKeyHint="next"
              aria-label="Glass price in dollars"
            />
          </label>
          <label className="field">
            <span>Bottle price ($)</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={bottlePrice}
              onChange={(e) => setBottlePrice(e.target.value)}
              placeholder="Optional"
              enterKeyHint="next"
              aria-label="Bottle price in dollars"
            />
          </label>
          <p className="form-rating-hint field span-2">Both optional. Log a glass, a bottle, or both.</p>
          <div className="field span-2">
            <span id="drink-place-label">Where you drank it</span>
            <PlacePicker
              value={purchasedAt}
              onChange={setPurchasedAt}
              labelledBy="drink-place-label"
              recentPlaces={recentDrinkPlaces}
            />
          </div>
        </div>

        {!wishlistForm && (
          <div className="form-ratings">
            <div className="form-rating">
              <label>Enjoyment</label>
              <p className="form-rating-hint">
                How much did you like it? Optional. Save the bottle now and rate it later.
              </p>
              <ScoreSlider value={ratingEnjoyment} onChange={setRatingEnjoyment} label="Enjoyment" />
            </div>
            <div className="form-rating">
              <label>Value</label>
              <p className="form-rating-hint">Worth the price? Optional. Same 0 to 10 scale.</p>
              <ScoreSlider value={ratingValue} onChange={setRatingValue} label="Value" />
            </div>
            {ratingEnjoyment > 0 && (
              <p className="rank-preview">
                Overall <ScoreReadout value={previewRank} />
                <span className="rank-preview-detail">
                  {' '}
                  Calculated from enjoyment
                  {ratingValue > 0 ? ', value,' : ''} and your ranking preference.
                </span>
              </p>
            )}
          </div>
        )}

        {!wishlistForm && (
          <>
            <TriedOnField value={triedOn} onChange={setTriedOn} />
            <div className="repeat-pours">
              <div className="tried-on-label">
                <span>Had it again</span>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() =>
                    setPours((current) => [
                      ...current,
                      { triedOn: isoDateFromLocal(new Date()) },
                    ])
                  }
                >
                  Add a date
                </button>
              </div>
              <p className="form-rating-hint">
                {pours.length === 0
                  ? 'The date above is the first time. Add a date each time you have it again.'
                  : `Tried ${1 + pours.length} times.`}
              </p>
              {pours.map((pour, index) => (
                <div className="repeat-pour-row" key={`${pour.triedOn ?? 'open'}-${index}`}>
                  <input
                    type="date"
                    aria-label={`Date for time ${index + 2}`}
                    value={pour.triedOn ?? ''}
                    max={isoDateFromLocal(new Date())}
                    onChange={(e) =>
                      setPours((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { triedOn: normalizeTriedOn(e.target.value) }
                            : item,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() =>
                      setPours((current) => current.filter((_, itemIndex) => itemIndex !== index))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <WinePhotoField photos={photos} onChange={setPhotos} />
          </>
        )}

        {!wishlistForm && (
          <div className="taste-section">
          <span className="taste-section-title">Taste characteristics</span>
          <p className="taste-caption">
            {tasteTouched ? (
              <>
                Customized to your palate.{' '}
                <button type="button" className="link-btn" onClick={() => setTasteTouched(false)}>
                  Reset to typical
                </button>
              </>
            ) : (
              `Typical ${tasteBasedOn} profile — drag to match your pour.`
            )}
          </p>
          <TasteInput
            taste={taste}
            wineType={type}
            onChange={(t) => {
              setTaste(t)
              setTasteTouched(true)
            }}
          />
          </div>
        )}

        {!wishlistForm && (
          <TastingTagsInput
            selected={tastingTags}
            onChange={setTastingTags}
            pro={pro}
            cellarWines={triedCellar}
            onUpgrade={onUpgrade}
          />
        )}

        {!wishlistForm && signedIn && cloudConfigured && (
          <div className="with-friends-field">
            <span className="with-friends-field-label">Drank with</span>
            <WithFriendsPicker
              friends={acceptedFriends}
              selected={withFriendIds}
              onChange={setWithFriendIds}
            />
          </div>
        )}

        <div className="form-grid">
          <label className="field span-2">
            <span>{wishlistForm ? 'Notes' : 'Tasting notes'}</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                wishlistForm
                  ? 'Why do you want to try it? Where did you hear about it?'
                  : 'Anything else about this pour — story, food pairing, occasion…'
              }
            />
          </label>
        </div>

        </div>

        <div className="modal-actions">
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions-buttons">
            <button
              type="button"
              className="btn ghost"
              onPointerDown={(e) => {
                // Keep the field focused so its blur cannot swallow this tap.
                e.preventDefault()
                cancelArmed.current = true
              }}
              onPointerUp={() => {
                if (!cancelArmed.current) return
                cancelArmed.current = false
                finishClose()
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                e.preventDefault()
                finishClose()
              }}
              onClick={() => {
                if (!cancelArmed.current) return
                cancelArmed.current = false
                finishClose()
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn primary">
              {submitLabel}
            </button>
          </div>
        </div>
      </form>
      {duplicate && (
        <DuplicateWineDialog
          existing={duplicate}
          onDismiss={() => setDuplicate(null)}
          onView={() => {
            const match = duplicate
            setDuplicate(null)
            if (onViewExisting) onViewExisting(match)
            else onClose()
          }}
          onLogAnyway={() => {
            allowDuplicateRef.current = true
            setDuplicate(null)
            const pending = pendingWineRef.current
            if (pending) onSave(pending)
          }}
          onHadAgain={recordAgain}
        />
      )}
    </div>
  )
}
