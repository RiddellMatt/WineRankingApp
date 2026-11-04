import { useState } from 'react'
import type { ShareWineCardInput } from '../lib/shareWineCard'
import type { Wine } from '../types'
import { ShareWineCardSheet } from './ShareWineCardSheet'
import { IconShare } from './icons/UiIcons'

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
