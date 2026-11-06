import { MenuScan } from './MenuScan'
import type { RankingPreference, Wine } from '../types'

interface Props {
  wines: Wine[]
  wishlist: Wine[]
  rankingPreference: RankingPreference
  pro: boolean
  signedIn: boolean
  cloudConfigured: boolean
  onUpgrade: () => void
  onSaveWishlist: (wine: Wine) => void | Promise<void>
  onAddWine: () => void
}

export function ScanHub({
  wines,
  wishlist,
  rankingPreference,
  pro,
  signedIn,
  cloudConfigured,
  onUpgrade,
  onSaveWishlist,
  onAddWine,
}: Props) {
  return (
    <div className="scan-hub">
      <section className="scan-hub-add" aria-labelledby="scan-hub-add-title">
        <h2 id="scan-hub-add-title">Add a bottle</h2>
        <p className="scan-hub-add-lead">
          Scan a wine label or enter details manually — add to your cellar or wishlist.
        </p>
        <button type="button" className="btn primary scan-hub-add-btn" onClick={onAddWine}>
          Add wine
        </button>
      </section>

      <MenuScan
        wines={wines}
        wishlist={wishlist}
        rankingPreference={rankingPreference}
        pro={pro}
        signedIn={signedIn}
        cloudConfigured={cloudConfigured}
        onUpgrade={onUpgrade}
        onSaveWishlist={onSaveWishlist}
      />
    </div>
  )
}
