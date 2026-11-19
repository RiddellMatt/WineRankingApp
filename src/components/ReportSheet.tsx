import { useEffect, useState, type FormEvent } from 'react'
import { lockAppScroll } from '../lib/lockAppScroll'
import { REPORT_REASONS, submitReport, type ReportReason } from '../lib/reportsDb'

interface Props {
  targetUserId: string
  targetName: string
  wineId?: string
  onClose: () => void
}

export function ReportControl({
  targetUserId,
  targetName,
  wineId,
}: {
  targetUserId: string
  targetName: string
  wineId?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="link-btn"
        onClick={(event) => {
          event.stopPropagation()
          setOpen(true)
        }}
      >
        Report
      </button>
      {open && (
        <ReportSheet
          targetUserId={targetUserId}
          targetName={targetName}
          wineId={wineId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function ReportSheet({ targetUserId, targetName, wineId, onClose }: Props) {
  const [reason, setReason] = useState<ReportReason | ''>('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => lockAppScroll(), [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!reason) {
      setError('Choose a reason.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await submitReport({ targetUserId, wineId, reason, note })
      setSent(true)
    } catch (err) {
      setError(String((err as Error).message ?? err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="modal report-sheet" role="dialog" aria-labelledby="report-sheet-title">
        <div className="modal-header">
          <h2 id="report-sheet-title">Report {targetName}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {sent ? (
          <>
            <p>Thanks. We’ll review this report.</p>
            <div className="modal-actions">
              <button type="button" className="btn primary" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <fieldset className="report-reasons">
              <legend>Why are you reporting this?</legend>
              {REPORT_REASONS.map((item) => (
                <label key={item.id}>
                  <input
                    type="radio"
                    name="report-reason"
                    value={item.id}
                    checked={reason === item.id}
                    onChange={() => {
                      setReason(item.id)
                      setError('')
                    }}
                  />
                  {item.label}
                </label>
              ))}
            </fieldset>
            <label className="report-note">
              <span>Note, optional</span>
              <textarea
                value={note}
                maxLength={500}
                onChange={(event) => setNote(event.target.value)}
                placeholder="What should we look at?"
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={busy || !reason}>
                {busy ? 'Sending…' : 'Submit report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
