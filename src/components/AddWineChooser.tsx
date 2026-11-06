import { useState } from 'react'

export type AddWineDestination = 'tried' | 'wishlist'

interface Props {
  onClose: () => void
  onChoose: (destination: AddWineDestination, openScan: boolean) => void
  cellarLimitReached?: boolean
  wishlistLimitReached?: boolean
}

export function AddWineChooser({
  onClose,
  onChoose,
  cellarLimitReached = false,
  wishlistLimitReached = false,
}: Props) {
  const [destination, setDestination] = useState<AddWineDestination | null>(null)

  function close() {
    setDestination(null)
    onClose()
  }

  function pickDest(dest: AddWineDestination) {
    setDestination(dest)
  }

  function back() {
    setDestination(null)
  }

  const destLabel = destination === 'wishlist' ? 'Wishlist' : 'Cellar'

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        className="modal add-wine-chooser"
        role="dialog"
        aria-labelledby="add-wine-chooser-title"
      >
        <div className="modal-header">
          <h2 id="add-wine-chooser-title">
            {destination ? `Add to ${destLabel.toLowerCase()}` : 'Add wine'}
          </h2>
          <button type="button" className="icon-btn" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>

        {!destination ? (
          <>
            <p className="add-wine-chooser-lead">Where should this bottle go?</p>
            <div className="add-wine-chooser-list">
              <button
                type="button"
                className="add-wine-chooser-card"
                disabled={cellarLimitReached}
                onClick={() => pickDest('tried')}
              >
                <span className="add-wine-chooser-card-title">My cellar</span>
                <span className="add-wine-chooser-card-desc">
                  {cellarLimitReached
                    ? 'Free cellar limit reached — upgrade in Profile'
                    : "Wines you've tried and rated"}
                </span>
              </button>
              <button
                type="button"
                className="add-wine-chooser-card"
                disabled={wishlistLimitReached}
                onClick={() => pickDest('wishlist')}
              >
                <span className="add-wine-chooser-card-title">My wishlist</span>
                <span className="add-wine-chooser-card-desc">
                  {wishlistLimitReached
                    ? 'Free wishlist limit reached — upgrade in Profile'
                    : 'Bottles you want to try later'}
                </span>
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="add-wine-chooser-lead">How do you want to add it?</p>
            <div className="add-wine-chooser-list">
              <button
                type="button"
                className="add-wine-chooser-card"
                onClick={() => onChoose(destination, false)}
              >
                <span className="add-wine-chooser-card-title">Enter manually</span>
                <span className="add-wine-chooser-card-desc">Type name, ratings, and notes</span>
              </button>
              <button
                type="button"
                className="add-wine-chooser-card"
                onClick={() => onChoose(destination, true)}
              >
                <span className="add-wine-chooser-card-title">Scan label</span>
                <span className="add-wine-chooser-card-desc">Use a photo of the bottle label</span>
              </button>
            </div>
            <button type="button" className="btn ghost add-wine-chooser-back" onClick={back}>
              ← Back
            </button>
          </>
        )}
      </div>
    </div>
  )
}
