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
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal add-wine-chooser"
        role="dialog"
        aria-labelledby="add-wine-chooser-title"
      >
        <div className="modal-header">
          <h2 id="add-wine-chooser-title">Add wine</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="add-wine-chooser-lead">Choose where this bottle should go.</p>

        <div className="add-wine-chooser-section">
          <span className="add-wine-chooser-section-label">Enter details</span>
          <div className="add-wine-chooser-list">
            <button
              type="button"
              className="add-wine-chooser-card"
              disabled={cellarLimitReached}
              onClick={() => onChoose('tried', false)}
            >
              <span className="add-wine-chooser-card-title">My cellar</span>
              <span className="add-wine-chooser-card-desc">
                {cellarLimitReached
                  ? 'Free cellar limit reached — upgrade in Account'
                  : "Wines you've tried and rated"}
              </span>
            </button>
            <button
              type="button"
              className="add-wine-chooser-card"
              disabled={wishlistLimitReached}
              onClick={() => onChoose('wishlist', false)}
            >
              <span className="add-wine-chooser-card-title">My wishlist</span>
              <span className="add-wine-chooser-card-desc">
                {wishlistLimitReached
                  ? 'Free wishlist limit reached — upgrade in Account'
                  : 'Bottles you want to try later'}
              </span>
            </button>
          </div>
        </div>

        <div className="add-wine-chooser-section">
          <span className="add-wine-chooser-section-label">Scan a label</span>
          <div className="add-wine-chooser-list add-wine-chooser-list-scan">
            <button
              type="button"
              className="btn ghost add-wine-chooser-scan"
              disabled={cellarLimitReached}
              onClick={() => onChoose('tried', true)}
            >
              Scan → cellar
            </button>
            <button
              type="button"
              className="btn ghost add-wine-chooser-scan"
              disabled={wishlistLimitReached}
              onClick={() => onChoose('wishlist', true)}
            >
              Scan → wishlist
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
