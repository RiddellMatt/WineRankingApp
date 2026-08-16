import { useEffect, useState, type FormEvent } from 'react'
import { WINE_TYPES, type Wine, type WineType } from '../types'
import { StarInput } from './StarRating'

interface Props {
  initial: Wine | null
  onSave: (wine: Wine) => void
  onClose: () => void
}

export function WineForm({ initial, onSave, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [winery, setWinery] = useState(initial?.winery ?? '')
  const [vintage, setVintage] = useState(initial?.vintage?.toString() ?? '')
  const [type, setType] = useState<WineType>(initial?.type ?? 'Red')
  const [varietal, setVarietal] = useState(initial?.varietal ?? '')
  const [region, setRegion] = useState(initial?.region ?? '')
  const [price, setPrice] = useState(initial?.price?.toString() ?? '')
  const [rating, setRating] = useState(initial?.rating ?? 0)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Give the wine a name.')
      return
    }
    if (rating === 0) {
      setError('Pick a rating — that is the whole point!')
      return
    }
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      winery: winery.trim(),
      vintage: vintage ? Number(vintage) : null,
      type,
      varietal: varietal.trim(),
      region: region.trim(),
      price: price ? Number(price) : null,
      rating,
      notes: notes.trim(),
      addedAt: initial?.addedAt ?? Date.now(),
    })
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-header">
          <h2>{initial ? 'Edit wine' : 'Add a wine'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="form-rating">
          <label>Your rating</label>
          <StarInput value={rating} onChange={setRating} />
        </div>

        <div className="form-grid">
          <label className="field span-2">
            <span>Wine name *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Barolo Riserva"
              autoFocus
            />
          </label>
          <label className="field">
            <span>Winery</span>
            <input
              value={winery}
              onChange={(e) => setWinery(e.target.value)}
              placeholder="e.g. Marchesi di Barolo"
            />
          </label>
          <label className="field">
            <span>Vintage</span>
            <input
              type="number"
              min="1900"
              max="2100"
              value={vintage}
              onChange={(e) => setVintage(e.target.value)}
              placeholder="e.g. 2019"
            />
          </label>
          <label className="field">
            <span>Type</span>
            <select value={type} onChange={(e) => setType(e.target.value as WineType)}>
              {WINE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Varietal</span>
            <input
              value={varietal}
              onChange={(e) => setVarietal(e.target.value)}
              placeholder="e.g. Nebbiolo"
            />
          </label>
          <label className="field">
            <span>Region</span>
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. Piedmont, Italy"
            />
          </label>
          <label className="field">
            <span>Price ($)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 45"
            />
          </label>
          <label className="field span-2">
            <span>Tasting notes</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did it taste like? Would you buy it again?"
            />
          </label>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            {initial ? 'Save changes' : 'Add wine'}
          </button>
        </div>
      </form>
    </div>
  )
}
