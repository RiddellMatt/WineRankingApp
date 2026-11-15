import type { AccountSettingsSection } from './accountSettings'
import { APP_NAME_PRO } from '../brand'

interface MenuItem {
  id: Exclude<AccountSettingsSection, 'menu'>
  label: string
  detail?: string
  signedInOnly?: boolean
}

const PRIMARY_MENU_ITEMS: MenuItem[] = [
  {
    id: 'profile',
    label: 'Edit profile',
    detail: 'Name, photo, and email',
    signedInOnly: true,
  },
  {
    id: 'notifications',
    label: 'Notification settings',
    signedInOnly: true,
  },
  {
    id: 'appearance',
    label: 'Appearance',
    detail: 'Theme and home screen icon',
  },
  {
    id: 'ranking',
    label: 'Ranking',
    detail: 'How wines are scored',
  },
]

const SECONDARY_MENU_ITEMS: MenuItem[] = [
  {
    id: 'subscription',
    label: 'Manage subscription',
  },
]

interface Props {
  signedIn: boolean
  pro: boolean
  onSelect: (section: Exclude<AccountSettingsSection, 'menu'>) => void
  onSignOut?: () => void
}

export function SettingsMenu({ signedIn, pro, onSelect, onSignOut }: Props) {
  const primaryItems = PRIMARY_MENU_ITEMS.filter((item) => !item.signedInOnly || signedIn)
  const secondaryItems = SECONDARY_MENU_ITEMS.filter((item) => !item.signedInOnly || signedIn)

  function renderRow(item: MenuItem) {
    const detail =
      item.id === 'subscription'
        ? pro
          ? APP_NAME_PRO
          : 'Free plan'
        : item.detail
    return (
      <li key={item.id}>
        <button type="button" className="settings-menu-row" onClick={() => onSelect(item.id)}>
          <span className="settings-menu-row-copy">
            <span className="settings-menu-row-label">{item.label}</span>
            {detail && <span className="settings-menu-row-detail">{detail}</span>}
          </span>
          <span className="settings-menu-row-chevron" aria-hidden="true">
            ›
          </span>
        </button>
      </li>
    )
  }

  return (
    <nav className="settings-menu" aria-label="Settings">
      <ul className="settings-menu-list">{primaryItems.map(renderRow)}</ul>
      {secondaryItems.length > 0 && (
        <ul className="settings-menu-list settings-menu-list-secondary">{secondaryItems.map(renderRow)}</ul>
      )}
      {signedIn && onSignOut && (
        <div className="settings-menu-footer">
          <button type="button" className="btn ghost account-signout-btn settings-menu-signout" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      )}
    </nav>
  )
}