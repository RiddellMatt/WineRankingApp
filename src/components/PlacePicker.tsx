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

function isAbort(err: unknown): boolean {
  return err instanceof DOMException
    ? err.name === 'AbortError'
    : err instanceof Error && err.name === 'AbortError'
}

export function PlacePicker({ value, onChange, labelledBy, recentPlaces = [] }: Props) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MapPlace[]>([])
  const [active, setActive] = useState(0)
  const [status, setStatus] = useState('')
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [bias, setBias] = useState<{ lat: number; lng: number } | null>(null)
  const locateGen = useRef(0)
  const locatingRef = useRef(false)

  useEffect(() => {
    const q = query.trim()
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
  }, [query, bias])

  function choose(place: MapPlace) {
    onChange(place.label)
    setQuery('')
    setResults([])
    setStatus('')
    setSearching(false)
  }

  function chooseRecent(place: string) {
    onChange(place)
    setQuery('')
    setResults([])
    setStatus('')
  }

  async function tagCurrentLocation() {
    const gen = ++locateGen.current
    locatingRef.current = true
    setLocating(true)
    setQuery('')
    setResults([])
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
      onChange(place.label)
      setStatus('')
    } catch (err) {
      if (gen !== locateGen.current) return
      setStatus(err instanceof Error ? err.message : "Couldn't find your location. Search for the place instead.")
    } finally {
      if (gen === locateGen.current) {
        locatingRef.current = false
        setLocating(false)
      }
    }
  }

  function onSearchKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && results.length > 0) {
      e.preventDefault()
      e.stopPropagation()
      setActive((index) => Math.min(results.length - 1, index + 1))
      return
    }
    if (e.key === 'ArrowUp' && results.length > 0) {
      e.preventDefault()
      e.stopPropagation()
      setActive((index) => Math.max(0, index - 1))
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setQuery('')
      setResults([])
      setStatus('')
      return
    }
    if (e.key !== 'Enter') return
    if (query.trim().length === 0 && results.length === 0) return
    e.preventDefault()
    e.stopPropagation()
    const place = results[active] ?? results[0]
    if (place) choose(place)
  }

  const open = results.length > 0
  const recent = recentPlaces.filter((place) => place.trim() && place.trim().toLowerCase() !== value.trim().toLowerCase())
  const showRecent = recent.length > 0 && !value.trim() && query.trim().length === 0 && !locating

  return (
    <div className="place-picker" ref={rootRef}>
      <p className="place-picker-hint" id={`${listId}-hint`}>
        Search a city, restaurant, or winery, then pick a match.
      </p>

      {value.trim() && (
        <div className="place-picker-selected">
          <IconMapPin className="place-picker-pin" />
          <span className="place-picker-selected-label">{value}</span>
          <button type="button" className="link-btn place-picker-clear" onClick={() => onChange('')}>
            Remove
          </button>
        </div>
      )}

      <input
        type="search"
        role="combobox"
        aria-labelledby={labelledBy}
        aria-describedby={`${listId}-hint`}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listId}-opt-${active}` : undefined}
        aria-busy={searching || locating}
        value={query}
        placeholder={value.trim() ? 'Search to change' : 'e.g. Charleston or a winery'}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onSearchKeyDown}
      />

      {status && (
        <p className="place-picker-status" role="status">
          {status}
        </p>
      )}

      {open && (
        <ul className="place-picker-results" id={listId} role="listbox" aria-label="Map places">
          {results.map((place, index) => (
            <li key={place.id}>
              <button
                type="button"
                id={`${listId}-opt-${index}`}
                role="option"
                aria-selected={index === active}
                className={`place-picker-result${index === active ? ' active' : ''}`}
                onPointerDown={(e) => {
                  e.preventDefault()
                  choose(place)
                }}
              >
                <span className="place-picker-result-title">{place.title}</span>
                {place.subtitle && <span className="place-picker-result-sub">{place.subtitle}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="place-picker-actions">
        <button
          type="button"
          className="link-btn"
          onClick={() => void tagCurrentLocation()}
          disabled={locating}
        >
          Use current location
        </button>
      </div>

      {showRecent && (
        <div className="region-suggestions" aria-label="Recent places">
          {recent.slice(0, 4).map((place) => (
            <button
              key={place}
              type="button"
              className="region-suggestion-chip"
              onClick={() => chooseRecent(place)}
            >
              {place}
            </button>
          ))}
        </div>
      )}

      <p className="place-picker-credit">Map places from OpenStreetMap</p>
    </div>
  )
}
