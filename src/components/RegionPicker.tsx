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
  const [text, setText] = useState(value)
  const [open, setOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [active, setActive] = useState(0)
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!dirty) setText(value)
  }, [value, dirty])

  const options = open ? regionComboboxOptions(dirty ? text : '', suggestionChips) : []
  const listOpen = open && options.length > 0

  function commit(label: string) {
    onChange(label)
    setText(label)
    setDirty(false)
    setOpen(false)
    setActive(0)
    requestAnimationFrame(() => inputRef.current?.select())
  }

  function clearValue() {
    onChange('')
    setText('')
    setDirty(false)
    setOpen(true)
    setActive(0)
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
      e.preventDefault()
      e.stopPropagation()
      setText(value)
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
    <div className="region-picker">
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
            setText(value)
            setDirty(false)
            setOpen(true)
            setActive(0)
            setArmed(false)
            inputRef.current?.select()
          }}
          onFocus={() => {
            setDirty(false)
            setOpen(true)
            setActive(0)
            setArmed(false)
            setText((current) => (current.trim() === '' && value.trim() !== '' ? current : value))
            requestAnimationFrame(() => inputRef.current?.select())
          }}
          onBlur={() => {
            setOpen(false)
            setText(value)
            setDirty(false)
          }}
          onChange={(e) => {
            const next = e.target.value
            setText(next)
            setDirty(true)
            setOpen(true)
            setActive(0)
            if (!next.trim()) onChange('')
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
                onPointerDown={(e) => e.preventDefault()}
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
