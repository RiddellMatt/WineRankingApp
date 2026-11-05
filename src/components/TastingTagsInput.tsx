import { useMemo, useState } from 'react'
import {
  addCustomTastingTag,
  catalogTags,
  sortTagsByFrequency,
  tastingTagLabel,
  type TastingTagDef,
} from '../lib/tastingTags'
import type { Wine } from '../types'

interface Props {
  selected: string[]
  onChange: (tags: string[]) => void
  pro: boolean
  cellarWines: Wine[]
  onUpgrade?: () => void
}

export function TastingTagsInput({
  selected,
  onChange,
  pro,
  cellarWines,
  onUpgrade,
}: Props) {
  const [customDraft, setCustomDraft] = useState('')

  const catalog = useMemo(() => catalogTags(pro), [pro])
  const ordered = useMemo(
    () => sortTagsByFrequency(catalog.map((t) => t.id), cellarWines),
    [catalog, cellarWines],
  )

  const orderedCatalog: TastingTagDef[] = useMemo(() => {
    const byId = new Map(catalog.map((t) => [t.id, t]))
    return ordered.map((id) => byId.get(id)!).filter(Boolean)
  }, [catalog, ordered])

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((t) => t !== id))
    } else {
      onChange([...selected, id])
    }
  }

  function addCustom() {
    const id = addCustomTastingTag(customDraft, pro)
    if (!id) return
    if (!selected.includes(id)) onChange([...selected, id])
    setCustomDraft('')
  }

  return (
    <div className="tasting-tags-field">
      <div className="tasting-tags-header">
        <span className="tasting-tags-label">Tasting tags</span>
        <span className="tasting-tags-hint">
          Flavor notes only — use the sliders below for body, tannin, sweetness, and acidity.
        </span>
      </div>
      <div className="tasting-tags-chips" role="group" aria-label="Tasting tags">
        {orderedCatalog.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className={`chip tasting-tag-chip ${selected.includes(tag.id) ? 'active' : ''}`}
            onClick={() => toggle(tag.id)}
          >
            {tag.label}
          </button>
        ))}
      </div>
      {!pro && (
        <p className="tasting-tags-pro-note">
          Free plan uses {orderedCatalog.length} quick tags.{' '}
          <button type="button" className="link-btn" onClick={onUpgrade}>
            Upgrade to Pro
          </button>{' '}
          for detailed tags and your own labels.
        </p>
      )}
      {pro && (
        <div className="tasting-tags-custom">
          <input
            type="text"
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
            placeholder="Add your own tag (e.g. pencil shavings)"
            maxLength={40}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCustom()
              }
            }}
          />
          <button type="button" className="btn ghost small" onClick={addCustom} disabled={!customDraft.trim()}>
            Add tag
          </button>
        </div>
      )}
      {selected.length > 0 && (
        <p className="tasting-tags-selected" aria-live="polite">
          Selected: {selected.map(tastingTagLabel).join(', ')}
        </p>
      )}
    </div>
  )
}
