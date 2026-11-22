import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { lockAppScroll } from '../lib/lockAppScroll'

const PREVIEW_COUNT = 3

export function WinePhotoStrip({ photos }: { photos: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const hidden = Math.max(0, photos.length - PREVIEW_COUNT)
  const visible = expanded ? photos : photos.slice(0, PREVIEW_COUNT)

  useEffect(() => {
    if (openIndex == null) return
    const unlock = lockAppScroll()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenIndex(null)
      if (event.key === 'ArrowRight') {
        setOpenIndex((current) => (current == null ? current : (current + 1) % photos.length))
      }
      if (event.key === 'ArrowLeft') {
        setOpenIndex((current) =>
          current == null ? current : (current - 1 + photos.length) % photos.length,
        )
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      unlock()
      window.removeEventListener('keydown', onKey)
    }
  }, [openIndex, photos.length])

  if (photos.length === 0) return null

  const lightbox =
    openIndex != null
      ? createPortal(
          <div
            className="wine-photo-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={`Photo ${openIndex + 1} of ${photos.length}`}
            onClick={() => setOpenIndex(null)}
          >
            <button type="button" className="wine-photo-lightbox-close" onClick={() => setOpenIndex(null)}>
              Close
            </button>
            {photos.length > 1 && (
              <button
                type="button"
                className="wine-photo-lightbox-nav prev"
                aria-label="Previous photo"
                onClick={(event) => {
                  event.stopPropagation()
                  setOpenIndex((openIndex - 1 + photos.length) % photos.length)
                }}
              >
                ‹
              </button>
            )}
            <img
              src={photos[openIndex]}
              alt={`Photo ${openIndex + 1} of ${photos.length}`}
              onClick={(event) => event.stopPropagation()}
            />
            {photos.length > 1 && (
              <button
                type="button"
                className="wine-photo-lightbox-nav next"
                aria-label="Next photo"
                onClick={(event) => {
                  event.stopPropagation()
                  setOpenIndex((openIndex + 1) % photos.length)
                }}
              >
                ›
              </button>
            )}
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <div className="wine-photo-strip">
        {visible.map((photo, index) => (
          <button
            key={`${index}-${photo.slice(0, 24)}`}
            type="button"
            className="wine-photo-thumb"
            onClick={() => setOpenIndex(index)}
            aria-label={`Open photo ${index + 1}`}
          >
            <img src={photo} alt="" />
          </button>
        ))}
        {hidden > 0 && !expanded && (
          <button type="button" className="wine-photo-more" onClick={() => setExpanded(true)}>
            +{hidden}
          </button>
        )}
        {expanded && hidden > 0 && (
          <button type="button" className="wine-photo-more" onClick={() => setExpanded(false)}>
            Less
          </button>
        )}
      </div>
      {lightbox}
    </>
  )
}
