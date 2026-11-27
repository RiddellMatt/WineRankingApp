import { useRef, useState } from 'react'
import { findCellarDuplicate } from '../lib/winePours'
import {
  isWishlistDuplicate,
  menuMatchTaste,
  menuMatchToTriedDraft,
  menuMatchToWishlist,
} from '../lib/wishlist'
import { TasteDisplay } from './TasteProfile'
import { matchMenu, matchParsedMenuWines, type MenuMatch } from '../menuMatch'
import { ShopForWine } from './ShopForWine'
import { MenuScanError, scanMenuWithAi } from '../lib/menuScanApi'
import { menuMatchShareInput } from '../lib/menuShare'
import { FREE_MENU_SCANS } from '../../supabase/functions/_shared/scanQuota'
import { MENU_SCAN_CONFIG } from '../config'
import type { RankingPreference, Wine } from '../types'
import type { ShareWineCardInput } from '../lib/shareWineCard'
import { ScanPourOverlay } from './ScanPourOverlay'
import { ShareWineCardSheet } from './ShareWineCardSheet'
import { IconChevron, IconWineList } from './icons/UiIcons'

interface Props {
  wines: Wine[]
  wishlist: Wine[]
  rankingPreference: RankingPreference
  pro: boolean
  signedIn: boolean
  cloudConfigured: boolean
  onUpgrade: () => void
  onSaveWishlist: (wine: Wine) => void | Promise<void>
  onAddToCellar?: (wine: Wine) => void
  isInCellar?: (wine: Pick<Wine, 'name' | 'winery' | 'vintage'>) => boolean
}

type State =
  | { phase: 'idle' }
  | { phase: 'scanning'; pct: number; mode: 'ai' | 'basic' }
  | { phase: 'results'; matches: MenuMatch[]; remaining?: number }
  | { phase: 'failed'; message: string }

function scoreClass(score: number): string {
  if (score >= 85) return 'great'
  if (score >= 70) return 'good'
  return ''
}

export function MenuScan({
  wines,
  wishlist,
  rankingPreference,
  pro,
  signedIn,
  cloudConfigured,
  onUpgrade,
  onSaveWishlist,
  onAddToCellar,
  isInCellar,
}: Props) {
  const [state, setState] = useState<State>({ phase: 'idle' })
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set())
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [aiPreviewUrl, setAiPreviewUrl] = useState<string | null>(null)
  const [freeRemaining, setFreeRemaining] = useState(FREE_MENU_SCANS)
  const [shareInput, setShareInput] = useState<ShareWineCardInput | null>(null)
  const ratedCount = wines.length
  const aiAvailable = signedIn && cloudConfigured && (pro || freeRemaining > 0)

  async function runBasicScan(file: File) {
    setState({ phase: 'scanning', pct: 0, mode: 'basic' })
    const { ocrImage } = await import('../scanner')
    const text = await ocrImage(file, (pct) => setState({ phase: 'scanning', pct, mode: 'basic' }))
    const matches = matchMenu(text, wines, rankingPreference)
    if (matches.length === 0) {
      setState({
        phase: 'failed',
        message:
          "Couldn't spot any wines on that photo. Try a closer, straighter shot of the wine list in good light.",
      })
    } else {
      setState({ phase: 'results', matches })
    }
  }

  async function runAiScan(file: File) {
    const preview = URL.createObjectURL(file)
    setAiPreviewUrl(preview)
    setState({ phase: 'scanning', pct: 15, mode: 'ai' })
    try {
      const { wines: parsed, remaining } = await scanMenuWithAi(file)
      setState({ phase: 'scanning', pct: 85, mode: 'ai' })
      const matches = matchParsedMenuWines(parsed, wines, rankingPreference)
      if (!pro) setFreeRemaining(remaining)
      if (matches.length === 0) {
        setState({
          phase: 'failed',
          message:
            "Couldn't spot any wines on that photo. Try a closer, straighter shot of the wine list in good light.",
        })
      } else {
        setState({ phase: 'results', matches, remaining })
      }
    } catch (err) {
      if (err instanceof MenuScanError) {
        if (err.code === 'pro_required') {
          setFreeRemaining(0)
          onUpgrade()
          setState({
            phase: 'failed',
            message: err.message || 'Menu scan is a Pro feature. Upgrade in Account.',
          })
          return
        }
        if (err.code === 'auth_required') {
          setState({
            phase: 'failed',
            message: 'Sign in to use menu scan.',
          })
          return
        }
        if (err.code === 'quota_exceeded') {
          setState({
            phase: 'failed',
            message: 'No AI menu scans left this month.',
          })
          return
        }
        if (err.code === 'not_configured') {
          await runBasicScan(file)
          return
        }
        setState({ phase: 'failed', message: err.message })
        return
      }
      setState({
        phase: 'failed',
        message: 'Menu scan failed. Try another photo.',
      })
    } finally {
      URL.revokeObjectURL(preview)
      setAiPreviewUrl(null)
    }
  }

  async function handleFile(file: File) {
    try {
      if (aiAvailable) {
        await runAiScan(file)
      } else {
        await runBasicScan(file)
      }
    } catch {
      setState({
        phase: 'failed',
        message: 'Scanning failed on this device. Try again or use a different photo.',
      })
    }
  }

  const aiScanning = state.phase === 'scanning' && state.mode === 'ai'

  const scanningLabel =
    state.phase === 'scanning'
      ? state.mode === 'ai'
        ? 'Scanning…'
        : `Reading menu… ${state.pct}%`
      : null

  const showQuota = aiAvailable && state.phase === 'results' && state.remaining != null
  const showFreeNote = aiAvailable && !pro && !showQuota
  const showUpgrade = !aiAvailable && !pro && signedIn && freeRemaining <= 0
  const showSignIn = !signedIn && cloudConfigured
  const showOcrNote = !aiAvailable && pro && signedIn
  const showStatus =
    showFreeNote ||
    showUpgrade ||
    showSignIn ||
    showQuota ||
    ratedCount === 0 ||
    showOcrNote ||
    state.phase === 'failed'

  function matchKey(match: MenuMatch, index: number): string {
    return `${match.line}|${match.price ?? ''}|${index}`
  }

  function isSaved(match: MenuMatch): boolean {
    const stub = menuMatchToWishlist(match)
    return isWishlistDuplicate(wishlist, stub)
  }

  async function handleSaveToWishlist(match: MenuMatch, key: string) {
    if (!pro) {
      onUpgrade()
      return
    }
    if (isSaved(match)) return
    setSavingKey(key)
    try {
      await onSaveWishlist(menuMatchToWishlist(match))
      setSavedKeys((prev) => new Set(prev).add(key))
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="menu-scan">
      <ScanPourOverlay
        open={aiScanning}
        variant="menu"
        previewUrl={aiPreviewUrl}
        progress={state.phase === 'scanning' && state.mode === 'ai' ? state.pct : undefined}
      />
      <section className="scan-hub-scan" aria-labelledby="scan-hub-menu-title">
        <button
          type="button"
          className="scan-hub-row"
          disabled={state.phase === 'scanning'}
          onClick={() => inputRef.current?.click()}
        >
          <span className="scan-hub-icon scan-hub-icon-muted" aria-hidden="true">
            <IconWineList />
          </span>
          <span className="scan-hub-row-copy">
            <span className="scan-hub-row-title" id="scan-hub-menu-title">
              Scan a menu
            </span>
            <span className="scan-hub-row-detail">
              {scanningLabel ?? 'Rank the list against your cellar'}
            </span>
          </span>
          <IconChevron className="scan-hub-row-chevron" size={16} />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />
        {showStatus && (
          <div className="menu-scan-status">
            {showFreeNote && (
              <p className="menu-scan-note">
                {freeRemaining} free AI scan{freeRemaining === 1 ? '' : 's'} left. Pro includes{' '}
                {MENU_SCAN_CONFIG.monthlyLimit} a month.
              </p>
            )}
            {showUpgrade && (
              <p className="menu-scan-note">
                <button type="button" className="link-btn" onClick={onUpgrade}>
                  Upgrade
                </button>{' '}
                for more AI menu scans.
              </p>
            )}
            {showSignIn && <p className="menu-scan-note">Sign in to use AI menu scan.</p>}
            {showQuota && state.phase === 'results' && (
              <p className="menu-scan-quota">
                {state.remaining} AI scan{state.remaining === 1 ? '' : 's'} left this month
              </p>
            )}
            {ratedCount === 0 && (
              <p className="menu-scan-warning">Rate a few wines first for picks tailored to you.</p>
            )}
            {showOcrNote && (
              <p className="menu-scan-note">Using on-device OCR — connect Supabase for AI menu scan.</p>
            )}
            {state.phase === 'failed' && <p className="form-error">{state.message}</p>}
          </div>
        )}
      </section>

      {state.phase === 'results' && (
        <ol className="menu-results">
          {state.matches.map((m, i) => {
            const key = matchKey(m, i)
            const saved = isSaved(m) || savedKeys.has(key)
            const saving = savingKey === key
            const taste = menuMatchTaste(m)
            const cellarDraft = menuMatchToTriedDraft(m)
            const inCellar =
              isInCellar?.(cellarDraft) ??
              Boolean(findCellarDuplicate(wines, { ...cellarDraft, id: 'draft' }))
            return (
            <li className="menu-result" key={key}>
              <div className={`menu-score ${scoreClass(m.score)}`}>
                {m.score}
                <span className="menu-score-label">match</span>
              </div>
              <div className="menu-result-main">
                <p className="menu-line">
                  {i === 0 && <span className="best-pick">Top pick</span>}
                  {m.line}
                </p>
                {m.description && <p className="menu-desc">{m.description}</p>}
                <div className="menu-reasons">
                  {m.reasons.map((r) => (
                    <span className="menu-reason" key={r}>
                      {r}
                    </span>
                  ))}
                </div>
                <div className="menu-taste">
                  <p className="menu-taste-caption">Typical {taste.basedOn}</p>
                  <TasteDisplay taste={taste.taste} />
                </div>
                <div className="menu-result-actions">
                  {onAddToCellar && (
                    <button
                      type="button"
                      className={`btn ghost small menu-save-btn ${inCellar ? 'saved' : ''}`}
                      disabled={inCellar}
                      onClick={() => onAddToCellar(cellarDraft)}
                    >
                      {inCellar ? 'In your cellar' : 'Add to cellar'}
                    </button>
                  )}
                  <button
                    type="button"
                    className={`btn ghost small menu-save-btn ${saved ? 'saved' : ''}`}
                    disabled={saved || saving}
                    onClick={() => handleSaveToWishlist(m, key)}
                  >
                    {saved ? 'Saved to try ✓' : saving ? 'Saving…' : pro ? '♡ Save to try' : '♡ Save to try · Pro'}
                  </button>
                  {i === 0 && (
                    <button
                      type="button"
                      className="btn ghost small menu-save-btn"
                      onClick={() => setShareInput(menuMatchShareInput(m))}
                    >
                      Share this pick
                    </button>
                  )}
                  <ShopForWine
                    target={{
                      name: m.wineName || m.line,
                      winery: m.winery,
                      vintage: m.vintage,
                    }}
                    wineName={m.wineName || m.line}
                    variant="text"
                  />
                </div>
              </div>
              {m.price && <span className="menu-price">{m.price}</span>}
            </li>
            )
          })}
        </ol>
      )}
      <ShareWineCardSheet
        open={shareInput != null}
        input={shareInput}
        onClose={() => setShareInput(null)}
      />
    </div>
  )
}
