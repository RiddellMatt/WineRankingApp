import { useEffect, useRef, useState } from 'react'
import type { SortKey } from '../types'

export interface CellarSortOption {
  key: SortKey
  label: string
}

interface Props {
  value: SortKey
  options: CellarSortOption[]
  onChange: (key: SortKey) => void
  layout?: 'compact' | 'bar'
}

export function CellarSortMenu({ value, options, onChange, layout = 'compact' }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const activeLabel = options.find((o) => o.key === value)?.label ?? 'Rating'

  return (
    <div
      className={`cellar-sort-menu ${layout === 'bar' ? 'cellar-sort-menu--bar' : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        className={`cellar-sort-trigger ${layout === 'bar' ? 'cellar-sort-trigger--bar' : ''} ${open ? 'open' : ''}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="cellar-sort-trigger-label">Sort by</span>
        <span className="cellar-sort-trigger-value">{activeLabel}</span>
      </button>
      {open && (
        <div
          className={`cellar-sort-popover ${layout === 'bar' ? 'cellar-sort-popover--sheet' : ''}`}
          role="listbox"
          aria-label="Sort cellar"
        >
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              role="option"
              aria-selected={value === o.key}
              className={`cellar-sort-option ${value === o.key ? 'active' : ''}`}
              onClick={() => {
                onChange(o.key)
                setOpen(false)
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
