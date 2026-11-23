import { useState } from 'react'
import type { Wine } from '../types'
import { formatTriedOn, isoDateFromLocal } from '../lib/wineMoments'
import { tastingMoments, timesTried } from '../lib/winePours'

interface Props {
  existing: Wine
  onView: () => void
  onLogAnyway: () => void
  onHadAgain: (triedOn: string | null) => void
  onDismiss: () => void
}

export function DuplicateWineDialog({ existing, onView, onLogAnyway, onHadAgain, onDismiss }: Props) {
  const today = isoDateFromLocal(new Date())
  const [triedOn, setTriedOn] = useState(today)
  const times = timesTried(existing)
  const dated = tastingMoments(existing).filter((moment) => moment.triedOn)
  const who = existing.winery ? `${existing.name} · ${existing.winery}` : existing.name

  return (
    <div className="modal-backdrop duplicate-wine-backdrop">
      <div
        className="modal duplicate-wine-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="duplicate-wine-title"
      >
        <h2 id="duplicate-wine-title">Already in your cellar</h2>
        <p className="duplicate-wine-name">{who}{existing.vintage ? ` ${existing.vintage}` : ''}</p>
        <p className="duplicate-wine-count">
          {times === 1 ? 'You have tried this once.' : `You have tried this ${times} times.`}
        </p>
        {dated.length > 0 && (
          <ul className="duplicate-wine-dates">
            {dated.map((moment, index) => (
              <li key={`${moment.triedOn}-${index}`}>{formatTriedOn(moment.triedOn!)}</li>
            ))}
          </ul>
        )}
        <label className="field">
          <span>Date you had it again</span>
          <input
            type="date"
            value={triedOn}
            max={today}
            onChange={(e) => setTriedOn(e.target.value)}
          />
        </label>
        <div className="duplicate-wine-actions">
          <button type="button" className="btn primary" onClick={() => onHadAgain(triedOn || null)}>
            I had it again
          </button>
          <button type="button" className="btn" onClick={onView}>
            View the wine
          </button>
          <button type="button" className="btn ghost" onClick={onLogAnyway}>
            Save as a new bottle
          </button>
          <button type="button" className="btn ghost" onClick={onDismiss}>
            Keep editing
          </button>
        </div>
      </div>
    </div>
  )
}
