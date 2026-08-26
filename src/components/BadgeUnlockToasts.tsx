import { useCallback, useEffect, useRef, useState } from 'react'
import type { BadgeTier } from '../lib/badges'
import { tierLabel } from '../lib/badges'
import type { BadgeUnlock } from '../lib/badgeUnlocks'
import { unlockDetail, unlockHeadline } from '../lib/badgeUnlocks'

const TOAST_MS = 4500

const TIER_CLASS: Record<BadgeTier, string> = {
  locked: 'badge-tier-locked',
  bronze: 'badge-tier-bronze',
  silver: 'badge-tier-silver',
  gold: 'badge-tier-gold',
  diamond: 'badge-tier-diamond',
}

interface ToastItem extends BadgeUnlock {
  toastId: string
}

interface Props {
  unlocks: BadgeUnlock[]
  onConsumed: () => void
}

export function BadgeUnlockToasts({ unlocks, onConsumed }: Props) {
  const [visible, setVisible] = useState<ToastItem[]>([])
  const consumedKeyRef = useRef('')

  useEffect(() => {
    if (unlocks.length === 0) return
    const key = unlocks.map((unlock) => `${unlock.id}:${unlock.tier}`).join('|')
    if (key === consumedKeyRef.current) return
    consumedKeyRef.current = key

    const next = unlocks.map((unlock) => ({
      ...unlock,
      toastId: `${unlock.id}-${unlock.tier}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    }))
    setVisible((prev) => [...prev, ...next])
    onConsumed()
  }, [unlocks, onConsumed])

  const dismiss = useCallback((toastId: string) => {
    setVisible((prev) => prev.filter((item) => item.toastId !== toastId))
  }, [])

  useEffect(() => {
    if (visible.length === 0) return
    const timers = visible.map((item) =>
      window.setTimeout(() => dismiss(item.toastId), TOAST_MS),
    )
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [visible, dismiss])

  if (visible.length === 0) return null

  return (
    <div className="badge-toast-stack" aria-live="polite" aria-atomic="false">
      {visible.map((item) => (
        <button
          key={item.toastId}
          type="button"
          className="badge-toast"
          onClick={() => dismiss(item.toastId)}
        >
          <span
            className={`badge-toast-medal badge-medal ${TIER_CLASS[item.tier]}`}
            aria-hidden="true"
          >
            <span className="badge-medal-icon">{item.icon}</span>
            <span className="badge-medal-tier">{tierLabel(item.tier)}</span>
          </span>
          <span className="badge-toast-copy">
            <span className="badge-toast-title">{unlockHeadline(item)}</span>
            <span className="badge-toast-desc">{unlockDetail(item)}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
