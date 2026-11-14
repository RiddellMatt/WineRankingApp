import type { AccountSettingsSection } from './accountSettings'
import { APP_NAME_PRO } from '../brand'

interface MenuItem {
  id: Exclude<AccountSettingsSection, 'menu'>
  label: string
  detail?: string
  signedInOnly?: boolean
}

const MENU_ITEMS: MenuItem[] = [
  {
    id: 'subscription',
    label: 'Manage subscription',
  },
  {
    id: 'appearance',
    label: 'App appearance',
    detail: 'Theme and home screen icon',
  },
  {
    id: 'notifications',
    label: 'Notification settings',
    signedInOnly: true,
  },
  {
    id: 'profile',
    label: 'Edit profile',
    detail: 'Name, photo, and email',
    signedInOnly: true,
  },
]

interface Props {
  signedIn: boolean
  pro: boolean
  onSelect: (section: Exclude<AccountSettingsSection, 'menu'>) => void
}

export function SettingsMenu({ signedIn, pro, onSelect }: Props) {
  const items = MENU_ITEMS.filter((item) => !item.signedInOnly || signedIn)

  return (
    <nav className="settings-menu" aria-label="Settings">
      <ul className="settings-menu-list">
        {items.map((item) => {
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
        })}
      </ul>
    </nav>
  )
}