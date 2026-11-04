import { useEffect, useState } from 'react'
import { saveWineCardToPhotos } from '../lib/saveWineCardToPhotos'
import {
  SHARE_CARD_FORMATS,
  type ShareCardFormatId,
} from '../lib/shareCardFormats'
import { shareWineCard, type ShareWineCardInput } from '../lib/shareWineCard'

interface Props {
  open: boolean
  input: ShareWineCardInput | null
  onClose: () => void
}

export function ShareWineCardSheet({ open, input, onClose }: Props) {
  const [formatId, setFormatId] = useState<ShareCardFormatId>('instagram-post')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setFormatId('instagram-post')
  }, [open])

  if (!open || !input) return null

  async function runShare() {
    setBusy(true)
    try {
      const result = await shareWineCard(input!, formatId)
      if (result === 'downloaded') {
        window.alert('Share card saved to your downloads.')
      }
      onClose()
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        window.alert((e as Error).message || 'Could not share this wine card.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function runSave() {
    setBusy(true)
    try {
      await saveWineCardToPhotos(input!, formatId)
      window.alert('Saved to Photos.')
      onClose()
    } catch (e) {
      window.alert((e as Error).message || 'Could not save to Photos.')
    } finally {
      setBusy(false)
    }
  }

  const wineTitle = input.wine.vintage
    ? `${input.wine.name} ${input.wine.vintage}`
    : input.wine.name

  return (
    <div
      className="share-sheet-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        className="share-sheet-panel"
        role="dialog"
        aria-labelledby="share-sheet-title"
        aria-modal="true"
      >
        <div className="share-sheet-grab" aria-hidden="true" />
        <h2 id="share-sheet-title" className="share-sheet-title">
          Share this wine
        </h2>
        <p className="share-sheet-lead">
          Choose a size for {wineTitle}, then share or save — like Beli&apos;s IG Post vs Story options.
        </p>

        <div className="share-format-row" role="list">
          {SHARE_CARD_FORMATS.map((format) => (
            <button
              key={format.id}
              type="button"
              role="listitem"
              className={`share-format-chip ${formatId === format.id ? 'active' : ''}`}
              disabled={busy}
              onClick={() => setFormatId(format.id)}
            >
              <span className="share-format-aspect">{format.aspectLabel}</span>
              <span className="share-format-label">{format.label}</span>
            </button>
          ))}
        </div>

        <p className="share-sheet-hint account-hint">
          Selected: {SHARE_CARD_FORMATS.find((f) => f.id === formatId)?.label} (
          {SHARE_CARD_FORMATS.find((f) => f.id === formatId)?.aspectLabel})
        </p>

        <div className="share-sheet-actions">
          <button type="button" className="btn primary" disabled={busy} onClick={() => void runShare()}>
            {busy ? 'Preparing…' : 'Share…'}
          </button>
          <button type="button" className="btn ghost" disabled={busy} onClick={() => void runSave()}>
            Save to Photos
          </button>
          <button type="button" className="link-btn share-sheet-cancel" disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
