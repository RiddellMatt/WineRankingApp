import type { GuideStep } from '../lib/userGuide'

interface Props {
  step: GuideStep
  index: number
  total: number
  onNext: () => void
  onBack: () => void
  onDismiss: () => void
  onTried: () => void
  onWishlist: () => void
}

export function UserGuide({ step, index, total, onNext, onBack, onDismiss, onTried, onWishlist }: Props) {
  return (
    <div className="user-guide">
      <div className="user-guide-backdrop" />
      <div
        className="user-guide-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-guide-title"
      >
        <p className="user-guide-kicker">
          {index + 1} of {total}
        </p>
        <h2 id="user-guide-title">{step.title}</h2>
        <p className="user-guide-body">{step.body}</p>
        {step.final ? (
          <div className="user-guide-actions user-guide-actions-stack">
            <button type="button" className="btn primary" onClick={onTried}>
              I've tried it
            </button>
            <button type="button" className="btn primary" onClick={onWishlist}>
              Want to try
            </button>
            <button type="button" className="btn ghost" onClick={onDismiss}>
              Not now
            </button>
          </div>
        ) : (
          <div className="user-guide-actions">
            {index > 0 && (
              <button type="button" className="btn ghost" onClick={onBack}>
                Back
              </button>
            )}
            <button type="button" className="btn ghost" onClick={onDismiss}>
              Skip
            </button>
            <button type="button" className="btn primary" onClick={onNext}>
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
