import { useState } from 'react'
import { shareWineCard } from '../lib/shareWineCard'
import type { Wine } from '../types'

interface Props {
  wine: Wine
  score: number
  attribution?: string
  className?: string
  compact?: boolean
}

export function ShareWineButton({ wine, score, attribution, className = '', compact = false }: Props) {
  const [busy, setBusy] = useState(false)

  async function handleShare() {
    if (busy || score <= 0) return
    setBusy(true)
    try {
      const result = await shareWineCard({ wine, score, attribution })
      if (result === 'downloaded') {
        window.alert('Share card saved to your downloads.')
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        window.alert(`Could not share: ${(e as Error).message}`)
      }
    } finally {
      setBusy(false)
    }
  }

  if (score <= 0) return null

  if (compact) {
    return (
      <button
        type="button"
        className={`link-btn activity-share-btn ${className}`.trim()}
        disabled={busy}
        onClick={handleShare}
      >
        {busy ? 'Preparing…' : 'Share card'}
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`icon-btn share-wine-btn ${className}`.trim()}
      disabled={busy}
      onClick={handleShare}
      aria-label={`Share ${wine.name}`}
      title={busy ? 'Preparing share card…' : 'Share wine card'}
    >
      {busy ? '…' : '↗'}
    </button>
  )
}
