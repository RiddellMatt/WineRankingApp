import { useEffect } from 'react'
import { createPortal } from 'react-dom'

const XP_TOAST_MS = 2800
const LEVEL_TOAST_MS = 4200

export interface XpGainToastItem {
  kind: 'xp'
  toastId: string
  amount: number
}

export interface LevelUpToastItem {
  kind: 'level'
  toastId: string
  level: number
  title: string
  gained: number
}

export type XpFeedbackToastItem = XpGainToastItem | LevelUpToastItem

interface Props {
  items: XpFeedbackToastItem[]
  onDismiss: (toastId: string) => void
}

export function createXpGainToast(amount: number): XpGainToastItem {
  return {
    kind: 'xp',
    toastId: `xp-${amount}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    amount,
  }
}

export function createLevelUpToast(
  level: number,
  title: string,
  gained: number,
): LevelUpToastItem {
  return {
    kind: 'level',
    toastId: `level-${level}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    level,
    title,
    gained,
  }
}

export function XpFeedbackToasts({ items, onDismiss }: Props) {
  if (items.length === 0) return null

  return createPortal(
    <div className="xp-toast-stack" aria-live="polite" aria-atomic="false">
      {items.map((item) =>
        item.kind === 'xp' ? (
          <XpGainToast key={item.toastId} item={item} onDismiss={onDismiss} />
        ) : (
          <LevelUpToast key={item.toastId} item={item} onDismiss={onDismiss} />
        ),
      )}
    </div>,
    document.body,
  )
}

function XpGainToast({
  item,
  onDismiss,
}: {
  item: XpGainToastItem
  onDismiss: (toastId: string) => void
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(item.toastId), XP_TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [item.toastId, onDismiss])

  return (
    <button
      type="button"
      className="xp-toast xp-toast-gain"
      onClick={() => onDismiss(item.toastId)}
    >
      +{item.amount} points
    </button>
  )
}

function LevelUpToast({
  item,
  onDismiss,
}: {
  item: LevelUpToastItem
  onDismiss: (toastId: string) => void
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(item.toastId), LEVEL_TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [item.toastId, onDismiss])

  return (
    <button
      type="button"
      className="xp-toast xp-toast-level"
      onClick={() => onDismiss(item.toastId)}
    >
      <span className="xp-toast-level-kicker">Level up</span>
      <span className="xp-toast-level-title">
        Level {item.level} · {item.title}
      </span>
      {item.gained > 0 && (
        <span className="xp-toast-level-xp">+{item.gained} points</span>
      )}
    </button>
  )
}
