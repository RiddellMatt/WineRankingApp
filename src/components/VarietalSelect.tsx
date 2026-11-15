import {
  VARIETAL_CUSTOM,
  varietalMatchesOption,
  WINE_VARIETAL_OPTIONS,
} from '../lib/wineVarietals'

interface Props {
  value: string
  onChange: (value: string) => void
  id?: string
}

function isListed(value: string): boolean {
  const v = value.trim()
  if (!v) return false
  return WINE_VARIETAL_OPTIONS.some((o) => varietalMatchesOption(v, o))
}

export function VarietalSelect({ value, onChange, id }: Props) {
  const customMode = value.trim() !== '' && !isListed(value)
  const selectValue = customMode
    ? VARIETAL_CUSTOM
    : isListed(value)
      ? (WINE_VARIETAL_OPTIONS.find((o) => varietalMatchesOption(value, o)) ?? value)
      : ''

  return (
    <div className="varietal-select">
      <select
        id={id}
        value={selectValue}
        onChange={(e) => {
          const next = e.target.value
          if (next === VARIETAL_CUSTOM) {
            onChange(value.trim() && !isListed(value) ? value : '')
            return
          }
          onChange(next)
        }}
      >
        <option value="">Select varietal…</option>
        {WINE_VARIETAL_OPTIONS.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
        <option value={VARIETAL_CUSTOM}>Other / blend…</option>
      </select>
      {(selectValue === VARIETAL_CUSTOM || customMode) && (
        <input
          className="varietal-select-custom"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type grape or blend"
          aria-label="Custom varietal"
        />
      )}
    </div>
  )
}
