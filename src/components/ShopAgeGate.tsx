import { useEffect } from 'react'
import { lockAppScroll } from '../lib/lockAppScroll'

interface Props {
  wineName: string
  onConfirm: () => void
  onClose: () => void
}

export function ShopAgeGate({ wineName, onConfirm, onClose }: Props) {
  useEffect(() => lockAppScroll(), [])

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="modal shop-age-gate" role="dialog" aria-labelledby="shop-age-title">
        <div className="modal-header">
          <h2 id="shop-age-title">Are you 21 or older?</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p>
          Wine-Searcher is a retailer search for {wineName}. Confirm once on this device to open
          it.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Not now
          </button>
          <button type="button" className="btn primary" onClick={onConfirm}>
            I am 21 or older
          </button>
        </div>
      </div>
    </div>
  )
}
