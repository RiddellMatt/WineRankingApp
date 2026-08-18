import { useEffect, useRef, useState, type FormEvent } from 'react'
import { LABEL_SCAN_CONFIG } from '../config'
import { WINE_TYPES, type TasteProfile, type Wine, type WineType } from '../types'
import { StarInput } from './StarRating'
import { TasteInput } from './TasteProfile'
import { hasTaste, lookupTaste } from '../tasteData'
import type { ScanResult } from '../scanner'
import { aiLabelToScanResult, LabelScanError, scanLabelWithAi } from '../lib/labelScanApi'

interface Props {
  initial: Wine | null
  onSave: (wine: Wine) => void
  onClose: () => void
  pro?: boolean
  signedIn?: boolean
  cloudConfigured?: boolean
}

export function WineForm({
  initial,
  onSave,
  onClose,
  pro = false,
  signedIn = false,
  cloudConfigured = false,
}: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [winery, setWinery] = useState(initial?.winery ?? '')
  const [vintage, setVintage] = useState(initial?.vintage?.toString() ?? '')
  const [type, setType] = useState<WineType>(initial?.type ?? 'Red')
  const [varietal, setVarietal] = useState(initial?.varietal ?? '')
  const [region, setRegion] = useState(initial?.region ?? '')
  const [price, setPrice] = useState(initial?.price?.toString() ?? '')
  const [purchasedAt, setPurchasedAt] = useState(initial?.purchasedAt ?? '')
  const [rating, setRating] = useState(initial?.rating ?? 0)
  const [taste, setTaste] = useState<TasteProfile>(initial?.taste ?? {})
  // Wines whose taste was customized keep it; otherwise the reference
  // profile tracks the varietal/type as the user types.
  const [tasteTouched, setTasteTouched] = useState(
    hasTaste(initial?.taste) && initial?.tasteSource !== 'typical',
  )
  const [tasteBasedOn, setTasteBasedOn] = useState('')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [error, setError] = useState('')
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'done' | 'failed'>('idle')
  const [scanMode, setScanMode] = useState<'ai' | 'basic'>('basic')
  const [scanPct, setScanPct] = useState(0)
  const [scanSummary, setScanSummary] = useState('')
  const scanInputRef = useRef<HTMLInputElement>(null)
  const aiAvailable = pro && signedIn && cloudConfigured

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
    if (rating === 0) {
      setError('Pick a rating — that is the whole point!')
      return
    }
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      winery: winery.trim(),
      vintage: vintage ? Number(vintage) : null,
      type,
      varietal: varietal.trim(),
      region: region.trim(),
      price: price ? Number(price) : null,
      rating,
      notes: notes.trim(),
      purchasedAt: purchasedAt.trim(),
      taste,
      tasteSource: tasteTouched ? 'custom' : 'typical',
      addedAt: initial?.addedAt ?? Date.now(),
    })
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-header">
          <h2>{initial ? 'Edit wine' : 'Add a wine'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

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
                  ? 'AI is reading your label…'
                  : `Reading label… ${scanPct}%`
                : aiAvailable
                  ? '📷 Scan wine label (AI)'
                  : '📷 Scan wine label'}
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

        <div className="form-rating">
          <label>Your rating</label>
          <StarInput value={rating} onChange={setRating} />
        </div>

        <div className="form-grid">
          <label className="field span-2">
            <span>Wine name *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Barolo Riserva"
              autoFocus
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
            <input
              value={varietal}
              onChange={(e) => setVarietal(e.target.value)}
              placeholder="e.g. Nebbiolo"
            />
          </label>
          <label className="field">
            <span>Region</span>
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. Piedmont, Italy"
            />
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
            <span>Purchased at</span>
            <input
              value={purchasedAt}
              onChange={(e) => setPurchasedAt(e.target.value)}
              placeholder="e.g. Trader Joe's, restaurant, winery visit…"
            />
          </label>
        </div>

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

        <div className="form-grid">
          <label className="field span-2">
            <span>Tasting notes</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did it taste like? Would you buy it again?"
            />
          </label>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            {initial ? 'Save changes' : 'Add wine'}
          </button>
        </div>
      </form>
    </div>
  )
}
