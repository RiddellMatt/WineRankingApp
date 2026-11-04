import { useState } from 'react'
import { saveWineCardToPhotos } from '../lib/saveWineCardToPhotos'
import {
  SHARE_DESTINATIONS,
  shareCardFormatById,
  type ShareCardFormatId,
} from '../lib/shareCardFormats'
import { presentWineCardShareSheet } from '../lib/shareWineCardPresent'
import type { ShareWineCardInput } from '../lib/shareWineCard'

interface Props {
  open: boolean
  input: ShareWineCardInput | null
  onClose: () => void
}

function DestinationIcon({ destId, variant }: { destId: string; variant: string }) {
  if (destId === 'ig-story') {
    return (
      <span className="share-destination-icon share-destination-icon-story" aria-hidden="true">
        <span className="share-destination-ig-glyph">IG</span>
        <span className="share-destination-story-plus">+</span>
      </span>
    )
  }
  if (variant === 'instagram') {
    return (
      <span className="share-destination-icon share-destination-icon-instagram" aria-hidden="true">
        IG
      </span>
    )
  }
  if (variant === 'tiktok') {
    return (
      <span className="share-destination-icon share-destination-icon-tiktok" aria-hidden="true">
        TT
      </span>
    )
  }
  if (variant === 'messages') {
    return (
      <span className="share-destination-icon share-destination-icon-messages" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 3c5.52 0 10 3.58 10 8s-4.48 8-10 8c-1.04 0-2.04-.14-2.98-.4L4 21l2.4-5.02A9.7 9.7 0 0 1 2 11c0-4.42 4.48-8 10-8z" />
        </svg>
      </span>
    )
  }
  return (
    <span className="share-destination-icon share-destination-icon-more" aria-hidden="true">
      ···
    </span>
  )
}

export function ShareWineCardSheet({ open, input, onClose }: Props) {
  const [busy, setBusy] = useState(false)
  const [saveFormat, setSaveFormat] = useState<ShareCardFormatId>('instagram-post')

  if (!open || !input) return null

  async function shareVia(formatId: ShareCardFormatId) {
    setBusy(true)
    setSaveFormat(formatId)
    try {
      const result = await presentWineCardShareSheet(input!, formatId)
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

  async function saveCurrentSize() {
    setBusy(true)
    try {
      await saveWineCardToPhotos(input!, saveFormat)
      window.alert('Saved to Photos.')
      onClose()
    } catch (e) {
      window.alert((e as Error).message || 'Could not save to Photos.')
    } finally {
      setBusy(false)
    }
  }

  const saveLabel = shareCardFormatById(saveFormat).label

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
          Share this page
        </h2>
        <p className="share-sheet-lead">
          Tap a destination — we&apos;ll size the card, then you&apos;ll get Apple&apos;s share sheet
          to pick Instagram, Messages, or another app.
        </p>

        <div className="share-destination-row" role="list">
          {SHARE_DESTINATIONS.map((dest) => (
            <button
              key={dest.id}
              type="button"
              role="listitem"
              className="share-destination-btn"
              disabled={busy}
              title={`${dest.label} (${shareCardFormatById(dest.formatId).aspectLabel})`}
              onClick={() => void shareVia(dest.formatId)}
            >
              <DestinationIcon destId={dest.id} variant={dest.variant} />
              <span className="share-destination-label">{dest.label}</span>
            </button>
          ))}
        </div>

        <div className="share-sheet-secondary">
          <button
            type="button"
            className="link-btn share-sheet-save"
            disabled={busy}
            onClick={() => void saveCurrentSize()}
          >
            Save to Photos ({saveLabel})
          </button>
          <button type="button" className="link-btn share-sheet-cancel" disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
