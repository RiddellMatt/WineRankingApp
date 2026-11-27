import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { regionComboboxOptions } from '../lib/wineRegionsCatalog'

interface Props {
  value: string
  onChange: (value: string) => void
  suggestionChips?: string[]
}

export function RegionPicker({ value, onChange, suggestionChips = [] }: Props) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const textRef = useRef(value)
  const committedRef = useRef(value)
  const [text, setText] = useState(value)
  const [open, setOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [active, setActive] = useState(0)
  const [armed, setArmed] = useState(false)

  function setTyped(next: string) {
    textRef.current = next
    setText(next)
  }

  useEffect(() => {
    if (!dirty && value !== committedRef.current) {
      committedRef.current = value
      setTyped(value)
    }
  }, [value, dirty])

  const options = open ? regionComboboxOptions(dirty ? text : '', suggestionChips) : []
  const listOpen = open && options.length > 0

  function commit(label: string) {
    const next = label.trim()
    committedRef.current = next
    textRef.current = next
    onChange(next)
    setText(next)
    setDirty(false)
    setOpen(false)
    setActive(0)
    setArmed(false)
  }

  function acceptTyped() {
    const next = textRef.current.trim()
    if (next !== committedRef.current.trim()) commit(next)
    else {
      setText(next)
      setDirty(false)
      setOpen(false)
    }
  }

  function clearValue() {
    commit('')
    setOpen(true)
    inputRef.current?.focus()
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && options.length > 0) {
      e.preventDefault()
      e.stopPropagation()
      setOpen(true)
      setArmed(true)
      setActive((index) => Math.min(options.length - 1, index + 1))
      return
    }
    if (e.key === 'ArrowUp' && options.length > 0) {
      e.preventDefault()
      e.stopPropagation()
      setArmed(true)
      setActive((index) => Math.max(0, index - 1))
      return
    }
    if (e.key === 'Escape') {
      if (!open && !dirty) return
      e.preventDefault()
      e.stopPropagation()
      setTyped(committedRef.current)
      setDirty(false)
      setOpen(false)
      return
    }
    if (e.key !== 'Enter' || !listOpen || (!dirty && !armed)) return
    e.preventDefault()
    e.stopPropagation()
    const option = options[Math.min(active, options.length - 1)]
    if (option) commit(option.label)
  }

  return (
    <div className="region-picker" data-combobox-open={listOpen ? 'true' : undefined}>
      <div className="combo-field">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={listOpen ? `${listId}-opt-${active}` : undefined}
          value={text}
          placeholder="Search a region or country"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          onPointerDown={(e) => {
            if (document.activeElement !== inputRef.current || open) return
            e.preventDefault()
            setTyped(committedRef.current)
            setDirty(false)
            setOpen(true)
            setActive(0)
            setArmed(false)
            inputRef.current?.select()
          }}
          onFocus={() => {
            setOpen(true)
            setActive(0)
            setArmed(false)
            if (!dirty) setTyped(committedRef.current)
          }}
          onBlur={acceptTyped}
          onChange={(e) => {
            const next = e.target.value
            setTyped(next)
            setDirty(true)
            setOpen(true)
            setActive(0)
            setArmed(false)
            if (!next.trim()) {
              commit('')
              setOpen(true)
            }
          }}
          onKeyDown={onKeyDown}
        />
        {text.trim() && (
          <button
            type="button"
            className="combo-clear"
            aria-label="Clear region"
            onPointerDown={(e) => e.preventDefault()}
            onClick={clearValue}
          >
            ×
          </button>
        )}
      </div>
      {listOpen && (
        <ul className="region-picker-results" id={listId} role="listbox" aria-label="Regions">
          {options.map((option, index) => (
            <li key={`${option.custom ? 'custom' : 'match'}-${option.label}`}>
              <button
                type="button"
                id={`${listId}-opt-${index}`}
                role="option"
                aria-selected={index === active}
                className={`region-picker-result${index === active ? ' active' : ''}`}
                onPointerDown={(e) => {
                  e.preventDefault()
                  commit(option.label)
                }}
                onClick={() => commit(option.label)}
              >
                {option.custom ? `Use “${option.label}”` : option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
