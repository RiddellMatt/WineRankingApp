import { useEffect, useMemo, useState } from 'react'
import {
  parseRegionLabel,
  regionsForCountry,
  searchWineRegions,
  WINE_REGION_COUNTRIES,
  type WineRegionEntry,
} from '../lib/wineRegionsCatalog'

function labelOf(entry: WineRegionEntry): string {
  return `${entry.region}, ${entry.country}`
}

interface Props {
  value: string
  onChange: (value: string) => void
  suggestionChips?: string[]
}

export function RegionPicker({ value, onChange, suggestionChips = [] }: Props) {
  const parsed = useMemo(() => parseRegionLabel(value), [value])
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState(parsed?.country ?? '')
  const [regionOnly, setRegionOnly] = useState(parsed?.region ?? '')

  useEffect(() => {
    const p = parseRegionLabel(value)
    if (p) {
      setCountry(p.country)
      setRegionOnly(p.region)
    }
  }, [value])

  const searching = search.trim().length > 0
  const searchHits = useMemo(() => searchWineRegions(search, 20), [search])

  const regionsInCountry = useMemo(
    () => (country ? regionsForCountry(country) : []),
    [country],
  )

  const commitManual = () => {
    const r = regionOnly.trim()
    const c = country.trim()
    if (r && c) onChange(`${r}, ${c}`)
    else if (r) onChange(r)
  }

  return (
    <div className="region-picker">
      <label className="region-picker-search">
        <span className="region-picker-search-label">Search regions</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="e.g. Barolo or Italy"
          autoComplete="off"
          enterKeyHint="search"
        />
      </label>

      {searching ? (
        <ul className="region-picker-results" role="listbox">
          {searchHits.length === 0 ? (
            <li className="region-picker-empty">No matches — pick country and region below.</li>
          ) : (
            searchHits.map((label) => (
              <li key={label}>
                <button
                  type="button"
                  className="region-picker-result"
                  onClick={() => {
                    onChange(label)
                    setSearch('')
                  }}
                >
                  {label}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : (
        <div className="region-picker-nested">
          <label className="field region-picker-field">
            <span>Country</span>
            <select
              value={country}
              onChange={(e) => {
                const next = e.target.value
                setCountry(next)
                setRegionOnly('')
                if (!next) onChange('')
              }}
            >
              <option value="">Select country…</option>
              {WINE_REGION_COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="field region-picker-field">
            <span>Region</span>
            <select
              value={regionOnly}
              disabled={!country}
              onChange={(e) => {
                const next = e.target.value
                setRegionOnly(next)
                if (next && country) onChange(`${next}, ${country}`)
              }}
            >
              <option value="">{country ? 'Select region…' : 'Choose country first'}</option>
              {regionsInCountry.map((entry) => (
                <option key={entry.region} value={entry.region}>
                  {entry.region}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {!searching && value.trim() && !regionsInCountry.some((e) => labelOf(e) === value.trim()) && (
        <label className="field region-picker-custom">
          <span>Custom label</span>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={commitManual}
            placeholder="Region, Country"
          />
        </label>
      )}

      {suggestionChips.length > 0 && !value.trim() && (
        <div className="region-suggestions">
          {suggestionChips.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="region-suggestion-chip"
              onClick={() => onChange(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
