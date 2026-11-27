import { MenuScan } from './MenuScan'
import { IconWineBottle } from './icons/UiIcons'
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
  onAddToCellar?: (wine: Wine) => void
  isInCellar?: (wine: Pick<Wine, 'name' | 'winery' | 'vintage'>) => boolean
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
  onAddToCellar,
  isInCellar,
  onAddWine,
}: Props) {
  return (
    <div className="scan-hub">
      <section className="scan-hub-add" aria-labelledby="scan-hub-add-title">
        <div className="scan-hub-add-head">
          <span className="scan-hub-icon" aria-hidden="true">
            <IconWineBottle />
          </span>
          <div className="scan-hub-add-copy">
            <h2 id="scan-hub-add-title">Add a bottle</h2>
            <p className="scan-hub-add-lead">Cellar or wishlist</p>
          </div>
        </div>
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
        onAddToCellar={onAddToCellar}
        isInCellar={isInCellar}
      />
    </div>
  )
}
