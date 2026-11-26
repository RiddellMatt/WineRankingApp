import { useEffect, useMemo, useRef, useState } from 'react'
import { formatTriedOn, isFutureDay, isoDateFromLocal, normalizeTriedOn } from '../lib/wineMoments'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function monthCells(year: number, month: number): Array<Date | null> {
  const first = new Date(year, month, 1)
  const cells: Array<Date | null> = Array.from({ length: first.getDay() }, () => null)
  const count = new Date(year, month + 1, 0).getDate()
  for (let day = 1; day <= count; day++) cells.push(new Date(year, month, day))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function TriedOnField({
  value,
  onChange,
}: {
  value: string | null
  onChange: (next: string | null) => void
}) {
  const selected = normalizeTriedOn(value)
  const rootRef = useRef<HTMLDivElement>(null)
  const initial = selected ? selected.split('-').map(Number) : null
  const today = new Date()
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(() => ({
    year: initial?.[0] ?? today.getFullYear(),
    month: initial ? initial[1] - 1 : today.getMonth(),
  }))

  const cells = useMemo(() => monthCells(cursor.year, cursor.month), [cursor.year, cursor.month])
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      const root = rootRef.current
      if (!root || !(event.target instanceof Node) || root.contains(event.target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open])

  function shiftMonth(delta: number) {
    const next = new Date(cursor.year, cursor.month + delta, 1)
    setCursor({ year: next.getFullYear(), month: next.getMonth() })
  }

  return (
    <div className="tried-on-field" ref={rootRef}>
      <div className="tried-on-label">
        <span>Tried on</span>
        <span className="field-optional">Optional</span>
      </div>
      <div className="tried-on-controls">
        <button
          type="button"
          className="tried-on-trigger"
          aria-expanded={open}
          onClick={() => {
            if (!open && !selected) onChange(isoDateFromLocal(new Date()))
            setOpen((current) => !current)
          }}
        >
          {selected ? formatTriedOn(selected) : 'Choose a date'}
        </button>
        {selected && (
          <button type="button" className="link-btn" onClick={() => onChange(null)}>
            Clear
          </button>
        )}
      </div>
      {open && (
        <div className="tried-on-calendar" role="group" aria-label="Choose the day you tried it">
          <div className="tried-on-calendar-nav">
            <button type="button" className="tried-on-nav" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              ‹
            </button>
            <span className="tried-on-month">{monthLabel}</span>
            <button type="button" className="tried-on-nav" onClick={() => shiftMonth(1)} aria-label="Next month">
              ›
            </button>
          </div>
          <div className="tried-on-weekdays" aria-hidden="true">
            {WEEKDAYS.map((label, index) => (
              <span key={`${label}-${index}`}>{label}</span>
            ))}
          </div>
          <div className="tried-on-days">
            {cells.map((date, index) => {
              if (!date) return <span key={`empty-${index}`} />
              const iso = isoDateFromLocal(date)
              const future = isFutureDay(date)
              const isSelected = iso === selected
              return (
                <button
                  key={iso}
                  type="button"
                  className={`tried-on-day${isSelected ? ' selected' : ''}`}
                  disabled={future}
                  aria-pressed={isSelected}
                  onClick={() => {
                    onChange(iso)
                    setOpen(false)
                  }}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
