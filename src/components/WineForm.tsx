import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { LABEL_SCAN_CONFIG } from '../config'
import { aiLabelToScanResult, LabelScanError, scanLabelWithAi } from '../lib/labelScanApi'
import { applyCompositeRating, compositeScore } from '../lib/ranking'
import { suggestRegions } from '../lib/regionSuggestions'
import { journeyFormHints } from '../lib/journeys'
import type { ScanResult } from '../scanner'
import { hasTaste, lookupTaste } from '../tasteData'
import { WINE_TYPES, type RankingPreference, type TasteProfile, type Wine, type WineType } from '../types'
import { catalogTags } from '../lib/tastingTags'
import { triedWines } from '../lib/wishlist'
import { isNativeApp } from '../lib/platform'
import { Keyboard } from '@capacitor/keyboard'
import { StarInput } from './StarRating'
import { TasteInput } from './TasteProfile'
import { TastingTagsInput } from './TastingTagsInput'
import { VarietalSelect } from './VarietalSelect'
import { RegionPicker } from './RegionPicker'
import { ScanPourOverlay } from './ScanPourOverlay'

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
}: Props) {
  const wishlistForm = formMode === 'wishlist'
  const promoteFromWishlist = initial?.status === 'wishlist' && !wishlistForm
  const [name, setName] = useState(initial?.name ?? '')
  const [winery, setWinery] = useState(initial?.winery ?? '')
  const [vintage, setVintage] = useState(initial?.vintage?.toString() ?? '')
  const [type, setType] = useState<WineType>(initial?.type ?? 'Red')
  const [varietal, setVarietal] = useState(initial?.varietal ?? '')
  const [region, setRegion] = useState(initial?.region ?? '')
  const [price, setPrice] = useState(initial?.price?.toString() ?? '')
  const [purchasedAt, setPurchasedAt] = useState(initial?.purchasedAt ?? '')
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
  const [error, setError] = useState('')
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'done' | 'failed'>('idle')
  const [scanMode, setScanMode] = useState<'ai' | 'basic'>('basic')
  const [scanPct, setScanPct] = useState(0)
  const [scanSummary, setScanSummary] = useState('')
  const scanInputRef = useRef<HTMLInputElement>(null)
  const aiAvailable = pro && signedIn && cloudConfigured
  const triedCellar = useMemo(() => triedWines(cellarWines), [cellarWines])

  useEffect(() => {
    if (!autoOpenScan || initial) return
    const t = window.setTimeout(() => scanInputRef.current?.click(), 120)
    return () => window.clearTimeout(t)
  }, [autoOpenScan, initial])

  useEffect(() => {
    const root = document.documentElement
    const clearInset = () => root.style.setProperty('--keyboard-inset', '0px')

    if (isNativeApp()) {
      void Keyboard.setScroll({ isDisabled: false })
      const handles: Array<{ remove: () => void }> = []
      void Keyboard.addListener('keyboardWillShow', (info) => {
        root.style.setProperty('--keyboard-inset', `${info.keyboardHeight}px`)
      }).then((h) => handles.push(h))
      void Keyboard.addListener('keyboardDidShow', (info) => {
        root.style.setProperty('--keyboard-inset', `${info.keyboardHeight}px`)
      }).then((h) => handles.push(h))
      void Keyboard.addListener('keyboardWillHide', clearInset).then((h) => handles.push(h))
      void Keyboard.addListener('keyboardDidHide', clearInset).then((h) => handles.push(h))
      return () => {
        handles.forEach((h) => h.remove())
        clearInset()
      }
    }

    const viewport = window.visualViewport
    if (!viewport) return undefined

    const syncInset = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      root.style.setProperty('--keyboard-inset', `${inset}px`)
    }
    syncInset()
    viewport.addEventListener('resize', syncInset)
    viewport.addEventListener('scroll', syncInset)
    return () => {
      viewport.removeEventListener('resize', syncInset)
      viewport.removeEventListener('scroll', syncInset)
      clearInset()
    }
  }, [])

  const formBodyRef = useRef<HTMLDivElement>(null)

  function focusField(el: HTMLElement) {
    const scrollParent = formBodyRef.current
    window.setTimeout(() => {
      if (!scrollParent) {
        el.scrollIntoView({ block: 'nearest', behavior: 'auto' })
        return
      }
      const parentRect = scrollParent.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      const margin = 20
      if (elRect.bottom > parentRect.bottom - margin || elRect.top < parentRect.top + margin) {
        el.scrollIntoView({ block: 'nearest', behavior: 'auto' })
      }
    }, 120)
  }
  const parsedPrice = price ? Number(price) : null

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
      if (e.key === 'Escape') onClose()
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
    if (scan.varietal && !varietal.trim()) {
      setVarietal(scan.varietal)
      found.push('varietal')
    }
    if (scan.region && !region.trim()) {
      setRegion(scan.region)
      found.push('region')
    }
    if (scan.type && !initial) {
      setType(scan.type)
      found.push('type')
    }
    if (found.length === 0) {
      setScanState('failed')
      setScanSummary("Couldn't read anything useful — try a straighter, closer photo in good light.")
    } else {
      setScanState('done')
      const source = mode === 'ai' ? 'AI label scan' : 'label scan'
      setScanSummary(`Filled in ${found.join(', ')} from ${source}. Double-check before saving.`)
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
    setScanMode('ai')
    setScanState('scanning')
    setScanPct(15)
    setScanSummary('')
    try {
      const { label } = await scanLabelWithAi(file)
      setScanPct(100)
      applyScan(aiLabelToScanResult(label), 'ai')
    } catch (err) {
      if (err instanceof LabelScanError) {
        if (err.code === 'not_configured') {
          await runBasicScan(file)
          return
        }
        if (err.code === 'quota_exceeded') {
          setScanState('failed')
          setScanSummary(`You've used all ${LABEL_SCAN_CONFIG.monthlyLimit} AI label scans this month.`)
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
      setScanSummary('AI label scan failed. Try again or use a different photo.')
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Give the wine a name.')
      return
    }
    if (!wishlistForm && ratingEnjoyment === 0) {
      setError('Rate how much you enjoyed it — that is the whole point!')
      return
    }
    const wine = applyCompositeRating(
      {
        id: initial?.id ?? crypto.randomUUID(),
        name: name.trim(),
        winery: winery.trim(),
        vintage: vintage ? Number(vintage) : null,
        type,
        varietal: varietal.trim(),
        region: region.trim(),
        price: parsedPrice,
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
        purchasedAt: purchasedAt.trim(),
        taste: wishlistForm ? {} : taste,
        tasteSource: wishlistForm ? undefined : tasteTouched ? 'custom' : 'typical',
        status: wishlistForm ? 'wishlist' : 'tried',
        addedAt: initial?.addedAt ?? Date.now(),
      },
      rankingPreference,
    )
    onSave(wine)
  }

  const modalTitle = promoteFromWishlist
    ? 'Mark as tried'
    : initial
      ? wishlistForm
        ? 'Edit wishlist item'
        : 'Edit wine'
      : 'Add wine'

  const destinationHint = !initial
    ? wishlistForm
      ? 'To your wishlist'
      : 'To your cellar'
    : null

  const submitLabel = promoteFromWishlist
    ? 'Save to cellar'
    : initial
      ? 'Save changes'
      : wishlistForm
        ? 'Add to wishlist'
        : 'Add to cellar'

  const aiScanning = scanState === 'scanning' && scanMode === 'ai'

  return (
    <div
      className="modal-backdrop wine-form-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <ScanPourOverlay open={aiScanning} message="AI is reading your label…" />
      <form className="modal wine-form-modal" onSubmit={handleSubmit}>
        <div className="modal-header">
          <div className="modal-header-titles">
            <h2>{modalTitle}</h2>
            {destinationHint && (
              <p className="modal-destination-hint">{destinationHint}</p>
            )}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div
          ref={formBodyRef}
          className="wine-form-body"
          onFocusCapture={(e) => {
            const target = e.target
            if (
              target instanceof HTMLInputElement ||
              target instanceof HTMLTextAreaElement ||
              target instanceof HTMLSelectElement
            ) {
              focusField(target)
            }
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

        {!wishlistForm && (
          <div className="form-ratings">
          <div className="form-rating">
            <label>Enjoyment</label>
            <p className="form-rating-hint">How much did you like drinking this?</p>
            <StarInput value={ratingEnjoyment} onChange={setRatingEnjoyment} />
          </div>
          <div className="form-rating">
            <label>Value</label>
            <p className="form-rating-hint">
              Worth it for what you paid? Optional — you can add price later.
            </p>
            <StarInput value={ratingValue} onChange={setRatingValue} />
          </div>
          {ratingEnjoyment > 0 && (
            <p className="rank-preview">
              Your rank: <strong>{previewRank.toFixed(1)}</strong>
              {ratingValue > 0 && (
                <span className="rank-preview-detail">
                  {' '}
                  (enjoyment {ratingEnjoyment.toFixed(1)} · value {ratingValue.toFixed(1)})
                </span>
              )}
            </p>
          )}
        </div>
        )}

        <div className="form-grid">
          <label className="field span-2">
            <span>Wine name *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Barolo Riserva"
              autoFocus={!initial}
            />
          </label>
          <label className="field">
            <span>Winery</span>
            <input
              value={winery}
              onChange={(e) => setWinery(e.target.value)}
              placeholder="e.g. Marchesi di Barolo"
            />
          </label>
          <label className="field">
            <span>Vintage</span>
            <input
              type="number"
              min="1900"
              max="2100"
              value={vintage}
              onChange={(e) => setVintage(e.target.value)}
              placeholder="e.g. 2019"
            />
          </label>
          <label className="field">
            <span>Type</span>
            <select value={type} onChange={(e) => setType(e.target.value as WineType)}>
              {WINE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Varietal</span>
            <VarietalSelect value={varietal} onChange={setVarietal} />
          </label>
          <label className="field">
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
            <span>Price ($)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 45"
            />
          </label>
          <label className="field span-2">
            <span>Where you drank it</span>
            <input
              value={purchasedAt}
              onChange={(e) => setPurchasedAt(e.target.value)}
              placeholder="e.g. Charleston, SC · Rome, Italy · winery visit"
            />
          </label>
        </div>

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

        {error && <p className="form-error">{error}</p>}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
