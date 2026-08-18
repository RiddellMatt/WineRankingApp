import { useRef, useState } from 'react'
import { MENU_SCAN_CONFIG } from '../config'
import { matchMenu, matchParsedMenuWines, type MenuMatch } from '../menuMatch'
import { MenuScanError, scanMenuWithAi } from '../lib/menuScanApi'
import type { RankingPreference, Wine } from '../types'

interface Props {
  wines: Wine[]
  rankingPreference: RankingPreference
  pro: boolean
  signedIn: boolean
  cloudConfigured: boolean
  onUpgrade: () => void
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
  rankingPreference,
  pro,
  signedIn,
  cloudConfigured,
  onUpgrade,
}: Props) {
  const [state, setState] = useState<State>({ phase: 'idle' })
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
            message: 'AI menu scan is a Pro feature. Upgrade in Account to unlock it.',
          })
          return
        }
        if (err.code === 'auth_required') {
          setState({
            phase: 'failed',
            message: 'Sign in to use AI menu scan.',
          })
          return
        }
        if (err.code === 'quota_exceeded') {
          setState({
            phase: 'failed',
            message: `You've used all ${MENU_SCAN_CONFIG.monthlyLimit} AI menu scans this month.`,
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
        message: 'AI scan failed. Try again or use a different photo.',
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

  const scanningLabel =
    state.phase === 'scanning'
      ? state.mode === 'ai'
        ? 'AI sommelier is reading your menu…'
        : `Reading menu… ${state.pct}%`
      : null

  return (
    <div className="menu-scan">
      <section className="menu-scan-hero">
        <span className="empty-icon" aria-hidden="true">
          📖
        </span>
        <h2>Point me at the wine list</h2>
        {aiAvailable ? (
          <p>
            Pro AI reads the menu photo directly — even two-column lists — then ranks every wine
            against your cellar using your ratings, favorite varietals, and go-to regions.
          </p>
        ) : (
          <p>
            Photograph a restaurant menu and I&apos;ll rank it against your cellar — using your own
            ratings, favorite varietals, and go-to regions.
            {!pro && (
              <>
                {' '}
                <button type="button" className="link-btn" onClick={onUpgrade}>
                  Upgrade to Pro
                </button>{' '}
                for sharper AI menu reading ({MENU_SCAN_CONFIG.monthlyLimit}/month).
              </>
            )}
            {pro && !signedIn && (
              <> Sign in to unlock AI menu scan on this account.</>
            )}
          </p>
        )}
        {aiAvailable && state.phase === 'results' && state.remaining != null && (
          <p className="menu-scan-quota">
            {state.remaining} AI scan{state.remaining === 1 ? '' : 's'} left this month
          </p>
        )}
        {ratedCount === 0 && (
          <p className="menu-scan-warning">
            Your cellar is empty, so recommendations will be generic. Rate a few wines first for
            personal picks.
          </p>
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
          {state.matches.map((m, i) => (
            <li className="menu-result" key={`${m.line}-${i}`}>
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
              </div>
              {m.price && <span className="menu-price">{m.price}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
