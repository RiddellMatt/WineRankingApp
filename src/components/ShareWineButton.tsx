import { useState } from 'react'
import type { ShareWineCardInput } from '../lib/shareWineCard'
import type { Wine } from '../types'
import { ShareWineCardSheet } from './ShareWineCardSheet'

function IconShare() {
  return (
    <svg
      className="ui-icon"
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v9" />
      <path d="m8 9 4-4 4 4" />
      <path d="M6 15h12" />
      <path d="M6 15v3a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}

interface Props {
  wine: Wine
  score: number
  attribution?: string
  className?: string
  compact?: boolean
}

export function ShareWineButton({ wine, score, attribution, className = '', compact = false }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)

  const input: ShareWineCardInput = { wine, score, attribution }

  if (score <= 0) return null

  if (compact) {
    return (
      <>
        <button
          type="button"
          className={`link-btn activity-share-btn ${className}`.trim()}
          onClick={() => setSheetOpen(true)}
        >
          Share card
        </button>
        <ShareWineCardSheet
          open={sheetOpen}
          input={input}
          onClose={() => setSheetOpen(false)}
        />
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        className={`icon-btn share-wine-btn ${className}`.trim()}
        onClick={() => setSheetOpen(true)}
        aria-label={`Share ${wine.name}`}
        title="Share wine card"
      >
        <IconShare />
      </button>
      <ShareWineCardSheet open={sheetOpen} input={input} onClose={() => setSheetOpen(false)} />
    </>
  )
}
