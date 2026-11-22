import { useRef, useState } from 'react'
import { fileToWinePhoto } from '../lib/winePhotos'
import { MAX_WINE_PHOTOS } from '../lib/wineMoments'

export function WinePhotoField({
  photos,
  onChange,
}: {
  photos: string[]
  onChange: (next: string[]) => void
}) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const remaining = MAX_WINE_PHOTOS - photos.length

  async function addFiles(list: FileList | null) {
    const files = [...(list ?? [])]
    if (files.length === 0) return
    if (remaining <= 0) {
      setError(`You can add up to ${MAX_WINE_PHOTOS} photos.`)
      return
    }
    setBusy(true)
    setError('')
    const next = [...photos]
    try {
      for (const file of files.slice(0, remaining)) {
        next.push(await fileToWinePhoto(file))
      }
      onChange(next)
      if (files.length > remaining) {
        setError(`Only the first ${remaining} fit. A bottle can hold ${MAX_WINE_PHOTOS} photos.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that photo.')
      onChange(next)
    } finally {
      setBusy(false)
      if (cameraRef.current) cameraRef.current.value = ''
      if (libraryRef.current) libraryRef.current.value = ''
    }
  }

  return (
    <div className="wine-photo-field">
      <div className="tried-on-label">
        <span>Photos</span>
        <span className="field-optional">Optional</span>
      </div>
      <p className="wine-photo-hint">The bottle, the table, the night. Up to {MAX_WINE_PHOTOS}.</p>
      {photos.length > 0 && (
        <div className="wine-photo-editor">
          {photos.map((photo, index) => (
            <div className="wine-photo-editor-item" key={`${index}-${photo.slice(0, 32)}`}>
              <img src={photo} alt={`Photo ${index + 1}`} />
              <button
                type="button"
                className="wine-photo-remove"
                aria-label={`Remove photo ${index + 1}`}
                onClick={() => onChange(photos.filter((_, item) => item !== index))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="wine-photo-actions">
        <button
          type="button"
          className="btn ghost small"
          disabled={busy || remaining <= 0}
          onClick={() => cameraRef.current?.click()}
        >
          {busy ? 'Adding…' : 'Take photo'}
        </button>
        <button
          type="button"
          className="btn ghost small"
          disabled={busy || remaining <= 0}
          onClick={() => libraryRef.current?.click()}
        >
          Choose photos
        </button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => void addFiles(event.target.files)}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => void addFiles(event.target.files)}
      />
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}
