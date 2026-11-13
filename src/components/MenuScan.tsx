import { useRef, useState } from 'react'
import { isWishlistDuplicate, menuMatchToWishlist } from '../lib/wishlist'
import { matchMenu, matchParsedMenuWines, type MenuMatch } from '../menuMatch'
import { MenuScanError, scanMenuWithAi } from '../lib/menuScanApi'
import type { RankingPreference, Wine } from '../types'
import { ScanPourOverlay } from './ScanPourOverlay'

interface Props {
  wines: Wine[]
  wishlist: Wine[]
  rankingPreference: RankingPreference
  pro: boolean
  signedIn: boolean
  cloudConfigured: boolean
  onUpgrade: () => void
  onSaveWishlist: (wine: Wine) => void | Promise<void>
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
}: Props) {
  const [state, setState] = useState<State>({ phase: 'idle' })
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set())
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const ratedCount = wines.length
  const aiAvailable = pro && signedIn && cloudConfigured

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
    setState({ phase: 'scanning', pct: 15, mode: 'ai' })
    try {
      const { wines: parsed, remaining } = await scanMenuWithAi(file)
      setState({ phase: 'scanning', pct: 85, mode: 'ai' })
      const matches = matchParsedMenuWines(parsed, wines, rankingPreference)
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
          onUpgrade()
          setState({
            phase: 'failed',
            message: 'Menu scan is a Pro feature. Upgrade in Account.',
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
      <ScanPourOverlay open={aiScanning} message="Reading menu…" />
      <section className="menu-scan-hero">
        <h2 className="menu-scan-section-title">Scan a menu</h2>
        <p className="menu-scan-section-lead">Point your camera at the wine list</p>
        {aiAvailable ? (
          <p>Photo the wine list — we&apos;ll rank picks against your cellar.</p>
        ) : (
          <p>
            Snap the list to see what matches your taste.
            {!pro && (
              <>
                {' '}
                <button type="button" className="link-btn" onClick={onUpgrade}>
                  Upgrade
                </button>{' '}
                for AI menu scan.
              </>
            )}
            {pro && !signedIn && <> Sign in to use AI menu scan.</>}
          </p>
        )}
        {aiAvailable && state.phase === 'results' && state.remaining != null && (
          <p className="menu-scan-quota">
            {state.remaining} AI scan{state.remaining === 1 ? '' : 's'} left this month
          </p>
        )}
        {ratedCount === 0 && (
          <p className="menu-scan-warning">Rate a few wines first for picks tailored to you.</p>
        )}
        {!aiAvailable && pro && signedIn && (
          <p className="menu-scan-note">Using on-device OCR — connect Supabase for AI menu scan.</p>
        )}
        <button
          className="btn primary"
          disabled={state.phase === 'scanning'}
          onClick={() => inputRef.current?.click()}
        >
          {state.phase === 'scanning' ? scanningLabel : aiAvailable ? '✨ Scan with AI' : '📷 Scan a menu'}
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
        {state.phase === 'failed' && <p className="form-error">{state.message}</p>}
      </section>

      {state.phase === 'results' && (
        <ol className="menu-results">
          {state.matches.map((m, i) => {
            const key = matchKey(m, i)
            const saved = isSaved(m) || savedKeys.has(key)
            const saving = savingKey === key
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
                <button
                  type="button"
                  className={`btn ghost small menu-save-btn ${saved ? 'saved' : ''}`}
                  disabled={saved || saving}
                  onClick={() => handleSaveToWishlist(m, key)}
                >
                  {saved ? 'Saved to try ✓' : saving ? 'Saving…' : pro ? '♡ Save to try' : '♡ Save to try · Pro'}
                </button>
              </div>
              {m.price && <span className="menu-price">{m.price}</span>}
            </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
