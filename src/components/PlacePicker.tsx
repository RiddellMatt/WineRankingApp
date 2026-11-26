import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  mapPlaceAt,
  readCurrentCoordinates,
  searchMapPlaces,
  type MapPlace,
} from '../lib/placeSearch'
import { IconMapPin } from './icons/UiIcons'

interface Props {
  value: string
  onChange: (value: string) => void
  labelledBy: string
  recentPlaces?: string[]
}

type MenuItem =
  | { kind: 'locate' }
  | { kind: 'recent'; label: string }
  | { kind: 'place'; place: MapPlace }

function isAbort(err: unknown): boolean {
  return err instanceof DOMException
    ? err.name === 'AbortError'
    : err instanceof Error && err.name === 'AbortError'
}

export function PlacePicker({ value, onChange, labelledBy, recentPlaces = [] }: Props) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(value)
  const [open, setOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [results, setResults] = useState<MapPlace[]>([])
  const [active, setActive] = useState(0)
  const [armed, setArmed] = useState(false)
  const [status, setStatus] = useState('')
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [bias, setBias] = useState<{ lat: number; lng: number } | null>(null)
  const locateGen = useRef(0)
  const locatingRef = useRef(false)

  useEffect(() => {
    if (!dirty) setText(value)
  }, [value, dirty])

  useEffect(() => {
    if (!open || !dirty) {
      setResults([])
      setSearching(false)
      if (!locatingRef.current) setStatus('')
      return
    }
    const q = text.trim()
    if (q.length < 2) {
      setResults([])
      setSearching(false)
      if (!locatingRef.current) setStatus('')
      return
    }

    const controller = new AbortController()
    setSearching(true)
    setStatus('Searching…')
    const timer = window.setTimeout(() => {
      void searchMapPlaces(q, { lat: bias?.lat, lng: bias?.lng, signal: controller.signal })
        .then((places) => {
          if (controller.signal.aborted) return
          setResults(places)
          setActive(0)
          setSearching(false)
          setStatus(places.length === 0 ? 'No matching places. Try a city, restaurant, or winery.' : '')
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted || isAbort(err)) return
          setResults([])
          setSearching(false)
          setStatus("Couldn't load map places. Check your connection.")
        })
    }, 320)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [text, open, dirty, bias])

  const recent = recentPlaces
    .map((place) => place.trim())
    .filter((place, index, all) => {
      if (!place) return false
      if (place.toLowerCase() === value.trim().toLowerCase()) return false
      return all.findIndex((item) => item.toLowerCase() === place.toLowerCase()) === index
    })
    .filter((place) => {
      const q = dirty ? text.trim().toLowerCase() : ''
      if (q.length === 0 || q.length >= 2) return q.length === 0 || place.toLowerCase().includes(q)
      return place.toLowerCase().includes(q)
    })
    .slice(0, 4)

  const showResults = dirty && text.trim().length >= 2
  const choices: MenuItem[] = showResults
    ? results.map((place) => ({ kind: 'place' as const, place }))
    : recent.map((label) => ({ kind: 'recent' as const, label }))
  const items: MenuItem[] = [...choices, { kind: 'locate' }]

  function commit(label: string) {
    onChange(label)
    setText(label)
    setDirty(false)
    setResults([])
    setStatus('')
    setSearching(false)
    setOpen(false)
    setActive(0)
    requestAnimationFrame(() => inputRef.current?.select())
  }

  function clearValue() {
    onChange('')
    setText('')
    setDirty(false)
    setResults([])
    setStatus('')
    setOpen(true)
    setActive(0)
    inputRef.current?.focus()
  }

  function chooseItem(item: MenuItem) {
    if (item.kind === 'locate') {
      void tagCurrentLocation()
      return
    }
    if (item.kind === 'recent') commit(item.label)
    else commit(item.place.label)
  }

  async function tagCurrentLocation() {
    const gen = ++locateGen.current
    locatingRef.current = true
    setLocating(true)
    setOpen(true)
    setStatus('Finding your location…')
    try {
      const coords = await readCurrentCoordinates()
      if (gen !== locateGen.current) return
      setBias(coords)
      const place = await mapPlaceAt(coords.lat, coords.lng)
      if (gen !== locateGen.current) return
      if (!place) {
        setStatus('No mapped place at your location. Search by name instead.')
        return
      }
      commit(place.label)
    } catch (err) {
      if (gen !== locateGen.current) return
      setStatus(err instanceof Error ? err.message : "Couldn't find your location. Search for the place instead.")
      setOpen(true)
    } finally {
      if (gen === locateGen.current) {
        locatingRef.current = false
        setLocating(false)
      }
    }
  }

  function onSearchKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && items.length > 0) {
      e.preventDefault()
      e.stopPropagation()
      setOpen(true)
      setArmed(true)
      setActive((index) => Math.min(items.length - 1, index + 1))
      return
    }
    if (e.key === 'ArrowUp' && items.length > 0) {
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
      setResults([])
      setStatus('')
      setOpen(false)
      return
    }
    if (e.key !== 'Enter' || !open || items.length === 0) return
    const item = items[Math.min(active, items.length - 1)]
    if (!item || (!dirty && !armed && item.kind !== 'locate')) return
    e.preventDefault()
    e.stopPropagation()
    chooseItem(item)
  }

  const listOpen = open && (items.length > 0 || Boolean(status))

  return (
    <div className="place-picker">
      <div className="combo-field">
        <IconMapPin className="combo-field-pin" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-labelledby={labelledBy}
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={listOpen ? `${listId}-opt-${active}` : undefined}
          aria-busy={searching || locating}
          value={text}
          placeholder="City, restaurant, or winery"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
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
            setResults([])
            if (!locatingRef.current) setStatus('')
          }}
          onChange={(e) => {
            const next = e.target.value
            setText(next)
            setDirty(true)
            setOpen(true)
            setActive(0)
            if (!next.trim()) onChange('')
          }}
          onKeyDown={onSearchKeyDown}
        />
        {value.trim() && !dirty && (
          <button
            type="button"
            className="combo-clear"
            aria-label="Clear place"
            onPointerDown={(e) => e.preventDefault()}
            onClick={clearValue}
          >
            ×
          </button>
        )}
      </div>

      {listOpen && (
        <ul className="place-picker-results" id={listId} role="listbox" aria-label="Map places">
          {items.map((item, index) => {
            const selected = index === active
            if (item.kind === 'locate') {
              return (
                <li key="locate">
                  <button
                    type="button"
                    id={`${listId}-opt-${index}`}
                    role="option"
                    aria-selected={selected}
                    className={`place-picker-result${selected ? ' active' : ''}`}
                    disabled={locating}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => chooseItem(item)}
                  >
                    <span className="place-picker-result-title">
                      {locating ? 'Finding your location…' : 'Use current location'}
                    </span>
                  </button>
                </li>
              )
            }
            if (item.kind === 'recent') {
              return (
                <li key={`recent-${item.label}`}>
                  <button
                    type="button"
                    id={`${listId}-opt-${index}`}
                    role="option"
                    aria-selected={selected}
                    className={`place-picker-result${selected ? ' active' : ''}`}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => chooseItem(item)}
                  >
                    <span className="place-picker-result-title">{item.label}</span>
                    <span className="place-picker-result-sub">Recent</span>
                  </button>
                </li>
              )
            }
            return (
              <li key={item.place.id}>
                <button
                  type="button"
                  id={`${listId}-opt-${index}`}
                  role="option"
                  aria-selected={selected}
                  className={`place-picker-result${selected ? ' active' : ''}`}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => chooseItem(item)}
                >
                  <span className="place-picker-result-title">{item.place.title}</span>
                  {item.place.subtitle && <span className="place-picker-result-sub">{item.place.subtitle}</span>}
                </button>
              </li>
            )
          })}
          {status && showResults && results.length === 0 && (
            <li className="place-picker-result-sub combo-status" role="status">
              {status}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
