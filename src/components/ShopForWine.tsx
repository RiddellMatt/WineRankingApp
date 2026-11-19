import { useState } from 'react'
import { shopLinksAreAffiliate, shopUrl, type ShopTarget } from '../lib/shopLink'
import { openExternalUrl } from '../lib/openUrl'
import { nativePlatform } from '../lib/platform'
import { confirmShopAge, hasShopAgeConfirmation, shopTapAction } from '../lib/shopAge'
import { ShopAgeGate } from './ShopAgeGate'
import { IconGlobe } from './icons/UiIcons'

interface Props {
  target: ShopTarget
  wineName: string
  variant: 'icon' | 'text'
}

export function ShopForWine({ target, wineName, variant }: Props) {
  const [gateOpen, setGateOpen] = useState(false)
  const href = shopUrl(target)
  const accessibleName =
    variant === 'icon' ? `Find ${wineName} on Wine-Searcher` : `Find a bottle, ${wineName}`

  async function openShop() {
    await openExternalUrl(href)
  }

  function onIosShop() {
    const action = shopTapAction('ios', hasShopAgeConfirmation())
    if (action === 'open') {
      void openShop()
      return
    }
    setGateOpen(true)
  }

  const className = variant === 'icon' ? 'icon-btn' : 'link-btn shop-find-btn'
  const title = `Find ${wineName} on Wine-Searcher`

  const control =
    nativePlatform() === 'ios' ? (
      <button type="button" className={className} aria-label={accessibleName} title={title} onClick={onIosShop}>
        {variant === 'icon' ? <IconGlobe /> : 'Find a bottle'}
      </button>
    ) : (
      <a
        className={className}
        href={href}
        target="_blank"
        rel={
          shopLinksAreAffiliate() ? 'noopener noreferrer sponsored' : 'noopener noreferrer'
        }
        aria-label={accessibleName}
        title={title}
      >
        {variant === 'icon' ? <IconGlobe /> : 'Find a bottle'}
      </a>
    )

  return (
    <>
      {control}
      {gateOpen && (
        <ShopAgeGate
          wineName={wineName}
          onConfirm={() => {
            confirmShopAge()
            setGateOpen(false)
            void openShop()
          }}
          onClose={() => setGateOpen(false)}
        />
      )}
    </>
  )
}
