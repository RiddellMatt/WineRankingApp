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
  const [sortPicked, setSortPicked] = useState(false)
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
  const isBar = layout === 'bar'
  const barLabel = sortPicked ? activeLabel : 'Category'

  return (
    <div
      className={`cellar-sort-menu ${isBar ? 'cellar-sort-menu--bar' : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        className={`cellar-sort-trigger ${isBar ? 'cellar-sort-trigger--bar cellar-filter-category' : ''} ${open ? 'open' : ''} ${isBar && sortPicked ? 'active' : ''}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={isBar ? `Sort by, ${barLabel}` : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {isBar ? (
          <span className="cellar-filter-category-name">{barLabel}</span>
        ) : (
          <>
            <span className="cellar-sort-trigger-label">Sort by</span>
            <span className="cellar-sort-trigger-value">{activeLabel}</span>
          </>
        )}
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
                setSortPicked(true)
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
