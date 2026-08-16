import { useRef, useState } from 'react'
import type { Wine } from '../types'
import { matchMenu, type MenuMatch } from '../menuMatch'

interface Props {
  wines: Wine[]
}

type State =
  | { phase: 'idle' }
  | { phase: 'scanning'; pct: number }
  | { phase: 'results'; matches: MenuMatch[] }
  | { phase: 'failed'; message: string }

function scoreClass(score: number): string {
  if (score >= 85) return 'great'
  if (score >= 70) return 'good'
  return ''
}

export function MenuScan({ wines }: Props) {
  const [state, setState] = useState<State>({ phase: 'idle' })
  const inputRef = useRef<HTMLInputElement>(null)
  const ratedCount = wines.length

  async function handleFile(file: File) {
    setState({ phase: 'scanning', pct: 0 })
    try {
      const { ocrImage } = await import('../scanner')
      const text = await ocrImage(file, (pct) => setState({ phase: 'scanning', pct }))
      const matches = matchMenu(text, wines)
      if (matches.length === 0) {
        setState({
          phase: 'failed',
          message:
            "Couldn't spot any wines on that photo. Try a closer, straighter shot of the wine list in good light.",
        })
      } else {
        setState({ phase: 'results', matches })
      }
    } catch {
      setState({
        phase: 'failed',
        message: 'Scanning failed on this device. Try again or use a different photo.',
      })
    }
  }

  return (
    <div className="menu-scan">
      <section className="menu-scan-hero">
        <span className="empty-icon" aria-hidden="true">
          📖
        </span>
        <h2>Point me at the wine list</h2>
        <p>
          Photograph a restaurant menu and I'll rank it against your cellar — using your own
          ratings, favorite varietals, and go-to regions.
        </p>
        {ratedCount === 0 && (
          <p className="menu-scan-warning">
            Your cellar is empty, so recommendations will be generic. Rate a few wines first for
            personal picks.
          </p>
        )}
        <button
          className="btn primary"
          disabled={state.phase === 'scanning'}
          onClick={() => inputRef.current?.click()}
        >
          {state.phase === 'scanning'
            ? `Reading menu… ${state.pct}%`
            : '📷 Scan a menu'}
        </button>
        {/* No `capture` attr: mobile browsers then offer camera roll AND camera. */}
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
