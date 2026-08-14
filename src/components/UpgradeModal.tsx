import { useEffect, useState, type FormEvent } from 'react'
import { FREE_WINE_LIMIT, PRO_CONFIG } from '../config'
import { redeemUnlockCode } from '../pro'

interface Props {
  reason: 'limit' | 'insights' | 'export' | 'generic'
  onUnlocked: () => void
  onClose: () => void
}

const REASON_COPY: Record<Props['reason'], string> = {
  limit: `You've hit the free plan limit of ${FREE_WINE_LIMIT} wines. Upgrade to keep building your cellar.`,
  insights: 'Insights is a Pro feature. Upgrade to see where your money and taste buds agree.',
  export: 'Export and import are Pro features. Upgrade to back up and move your cellar anywhere.',
  generic: 'Unlock everything Cellar Rank has to offer.',
}

const FEATURES = [
  ['∞', 'Unlimited wines', `Free plan is capped at ${FREE_WINE_LIMIT} bottles`],
  ['📊', 'Insights dashboard', 'Spending, best-value bottles, and your taste profile'],
  ['💾', 'Export & import', 'Back up your cellar or move it between devices'],
  ['🍷', 'Support development', 'Keep the corkscrew turning'],
] as const

export function UpgradeModal({ reason, onUnlocked, onClose }: Props) {
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [showCode, setShowCode] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleRedeem(e: FormEvent) {
    e.preventDefault()
    if (redeemUnlockCode(code)) {
      onUnlocked()
    } else {
      setCodeError('That code is not valid.')
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal upgrade-modal">
        <div className="modal-header">
          <h2>
            Cellar Rank <span className="pro-badge inline">PRO</span>
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p className="upgrade-reason">{REASON_COPY[reason]}</p>

        <ul className="upgrade-features">
          {FEATURES.map(([icon, title, detail]) => (
            <li key={title}>
              <span className="feature-icon" aria-hidden="true">
                {icon}
              </span>
              <div>
                <strong>{title}</strong>
                <p>{detail}</p>
              </div>
            </li>
          ))}
        </ul>

        {PRO_CONFIG.paymentUrl ? (
          <a
            className="btn primary upgrade-cta"
            href={PRO_CONFIG.paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Upgrade — {PRO_CONFIG.priceLabel}
          </a>
        ) : (
          <div className="upgrade-cta-placeholder">
            <button className="btn primary upgrade-cta" disabled>
              Upgrade — {PRO_CONFIG.priceLabel}
            </button>
            <p className="upgrade-note">
              Checkout isn't connected yet. Have an unlock code? Redeem it below.
            </p>
          </div>
        )}

        {showCode ? (
          <form className="code-row" onSubmit={handleRedeem}>
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setCodeError('')
              }}
              placeholder="Unlock code"
              autoFocus
            />
            <button type="submit" className="btn ghost">
              Redeem
            </button>
          </form>
        ) : (
          <button type="button" className="link-btn" onClick={() => setShowCode(true)}>
            Have an unlock code?
          </button>
        )}
        {codeError && <p className="form-error">{codeError}</p>}
      </div>
    </div>
  )
}
