import type { ReactNode } from 'react'
import { APP_NAME, APP_NAME_PRO } from '../brand'
import { legalDocHref, onLegalDocClick, type LegalDoc } from '../lib/legalDocs'
import { THEME_OPTIONS, type AppTheme } from '../lib/themes'
import type { AccountSettingsSection } from './accountSettings'

export type SettingsGroupId = 'cellar' | 'preferences' | 'account' | 'help'

type SectionId = Exclude<AccountSettingsSection, 'menu'>

interface NavRow {
  kind: 'nav'
  id: SectionId
  label: string
  detail?: string
  icon: ReactNode
  proMark?: boolean
}

interface LinkRow {
  kind: 'link'
  id: string
  label: string
  file: LegalDoc
  icon: ReactNode
}

interface ActionRow {
  kind: 'action'
  id: 'sign-out' | 'sign-in' | 'tour'
  label: string
  detail?: string
  icon: ReactNode
}

type MenuRow = NavRow | LinkRow | ActionRow

interface Props {
  signedIn: boolean
  pro: boolean
  cloudConfigured: boolean
  theme: AppTheme
  openGroups: SettingsGroupId[]
  onOpenGroupsChange: (
    groups: SettingsGroupId[] | ((current: SettingsGroupId[]) => SettingsGroupId[]),
  ) => void
  onSelect: (section: SectionId) => void
  onThemeChange: (theme: AppTheme) => void
  onSignOut?: () => void
  onSignIn?: () => void
  onReplayGuide?: () => void
}

export function SettingsMenu({
  signedIn,
  pro,
  cloudConfigured,
  theme,
  openGroups,
  onOpenGroupsChange,
  onSelect,
  onThemeChange,
  onSignOut,
  onSignIn,
  onReplayGuide,
}: Props) {
  const cellarRows: MenuRow[] = [
    ...(signedIn
      ? [
          {
            kind: 'nav' as const,
            id: 'notifications' as const,
            label: 'Notifications',
            detail: 'Friend requests, reactions, and milestones',
            icon: <IconBell />,
          },
        ]
      : []),
    {
      kind: 'nav',
      id: 'ranking',
      label: 'Ranking preference',
      detail: 'How wines are scored',
      icon: <IconRank />,
    },
  ]

  const accountRows: MenuRow[] = [
    ...(signedIn
      ? [
          {
            kind: 'nav' as const,
            id: 'profile' as const,
            label: 'Edit profile',
            detail: 'Name, photo, email, and account deletion',
            icon: <IconUser />,
          },
        ]
      : []),
    {
      kind: 'nav',
      id: 'subscription',
      label: 'Manage subscription',
      detail: pro ? APP_NAME_PRO : 'Free plan',
      icon: <IconCard />,
      proMark: pro,
    },
    ...(!signedIn && cloudConfigured && onSignIn
      ? [
          {
            kind: 'action' as const,
            id: 'sign-in' as const,
            label: 'Sign in',
            detail: 'Sync your cellar across devices',
            icon: <IconUser />,
          },
        ]
      : []),
    ...(signedIn && onSignOut
      ? [
          {
            kind: 'action' as const,
            id: 'sign-out' as const,
            label: 'Sign out',
            icon: <IconSignOut />,
          },
        ]
      : []),
  ]

  const helpRows: MenuRow[] = [
    ...(signedIn && onReplayGuide
      ? [
          {
            kind: 'action' as const,
            id: 'tour' as const,
            label: 'App tour',
            detail: 'A quick walk through the screens',
            icon: <IconRoute />,
          },
        ]
      : []),
    {
      kind: 'link',
      id: 'terms',
      label: 'Terms of use',
      file: 'terms.html',
      icon: <IconDoc />,
    },
    {
      kind: 'link',
      id: 'privacy',
      label: 'Privacy policy',
      file: 'privacy.html',
      icon: <IconShield />,
    },
  ]

  function toggle(id: SettingsGroupId) {
    onOpenGroupsChange((current) =>
      current.includes(id) ? current.filter((group) => group !== id) : [...current, id],
    )
  }

  function runAction(id: ActionRow['id']) {
    if (id === 'sign-out') onSignOut?.()
    if (id === 'sign-in') onSignIn?.()
    if (id === 'tour') onReplayGuide?.()
  }

  return (
    <nav className="settings-menu" aria-label="Settings">
      {signedIn && onSignOut && (
        <div className="settings-menu-bar">
          <button type="button" className="settings-menu-bar-action" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      )}

      <SettingsGroup
        id="cellar"
        label={`Your ${APP_NAME}`}
        open={openGroups.includes('cellar')}
        onToggle={toggle}
      >
        <RowList rows={cellarRows} onSelect={onSelect} onAction={runAction} />
      </SettingsGroup>

      <SettingsGroup
        id="preferences"
        label="Preferences"
        open={openGroups.includes('preferences')}
        onToggle={toggle}
      >
        <ul className="settings-group-list">
          <li>
            <div className="settings-menu-row settings-menu-row-static">
              <span className="settings-menu-row-icon" aria-hidden="true">
                <IconTheme />
              </span>
              <span className="settings-menu-row-copy">
                <span className="settings-menu-row-label">Theme</span>
              </span>
              <div className="settings-theme-switch" role="group" aria-label="Theme">
                {THEME_OPTIONS.map((option) => {
                  const selected = theme === option.id
                  const light = option.id === 'light'
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`settings-theme-choice${selected ? ' is-selected' : ''}`}
                      aria-pressed={selected}
                      aria-label={`${option.label} theme`}
                      onClick={() => onThemeChange(option.id)}
                      style={{
                        background: option.swatches[0],
                        color: light ? '#231f20' : '#f7eef1',
                      }}
                    >
                      {light ? <IconSun /> : <IconMoon />}
                    </button>
                  )
                })}
              </div>
            </div>
          </li>
          <li>
            <NavButton
              label="Home screen icon"
              detail="White or red"
              icon={<IconGrid />}
              onClick={() => onSelect('appearance')}
            />
          </li>
        </ul>
      </SettingsGroup>

      <SettingsGroup
        id="account"
        label="Account"
        open={openGroups.includes('account')}
        onToggle={toggle}
      >
        <RowList rows={accountRows} onSelect={onSelect} onAction={runAction} />
      </SettingsGroup>

      <SettingsGroup id="help" label="Help & about" open={openGroups.includes('help')} onToggle={toggle}>
        <RowList rows={helpRows} onSelect={onSelect} onAction={runAction} />
      </SettingsGroup>
    </nav>
  )
}

function SettingsGroup({
  id,
  label,
  open,
  onToggle,
  children,
}: {
  id: SettingsGroupId
  label: string
  open: boolean
  onToggle: (id: SettingsGroupId) => void
  children: ReactNode
}) {
  const bodyId = `settings-group-${id}`
  return (
    <section className={`settings-group${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="settings-group-toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => onToggle(id)}
      >
        <span>{label}</span>
        <IconChevron className="settings-group-chevron" />
      </button>
      <div id={bodyId} className="settings-group-body" hidden={!open}>
        {children}
      </div>
    </section>
  )
}

function RowList({
  rows,
  onSelect,
  onAction,
}: {
  rows: MenuRow[]
  onSelect: (section: SectionId) => void
  onAction: (id: ActionRow['id']) => void
}) {
  return (
    <ul className="settings-group-list">
      {rows.map((row) => (
        <li key={row.id}>
          {row.kind === 'nav' && (
            <NavButton
              label={row.label}
              detail={row.detail}
              icon={row.icon}
              proMark={row.proMark}
              onClick={() => onSelect(row.id)}
            />
          )}
          {row.kind === 'link' && (
            <a
              className="settings-menu-row"
              href={legalDocHref(row.file)}
              onClick={(event) => onLegalDocClick(event, row.file)}
            >
              <RowBody icon={row.icon} label={row.label} />
              <IconChevron className="settings-menu-row-chevron" />
            </a>
          )}
          {row.kind === 'action' && (
            <button type="button" className="settings-menu-row" onClick={() => onAction(row.id)}>
              <RowBody icon={row.icon} label={row.label} detail={row.detail} />
              <IconChevron className="settings-menu-row-chevron" />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

function NavButton({
  label,
  detail,
  icon,
  proMark = false,
  onClick,
}: {
  label: string
  detail?: string
  icon: ReactNode
  proMark?: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className="settings-menu-row" onClick={onClick}>
      <RowBody icon={icon} label={label} detail={detail} />
      <span className="settings-menu-row-aside">
        {proMark && (
          <span className="settings-menu-crown" aria-label="Pro">
            <IconCrown />
          </span>
        )}
        <IconChevron className="settings-menu-row-chevron" />
      </span>
    </button>
  )
}

function RowBody({ icon, label, detail }: { icon: ReactNode; label: string; detail?: string }) {
  return (
    <>
      <span className="settings-menu-row-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="settings-menu-row-copy">
        <span className="settings-menu-row-label">{label}</span>
        {detail && <span className="settings-menu-row-detail">{detail}</span>}
      </span>
    </>
  )
}

function IconChevron({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconBell() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function IconRank() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m12 3 2.1 4.6 5 .6-3.7 3.4.9 5L12 14.8 7.7 16.6l.9-5L4.9 8.2l5-.6L12 3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconTheme() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 4a8 8 0 0 0 0 16V4Z" fill="currentColor" />
    </svg>
  )
}

function IconSun() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconMoon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16.5 14.5A6.5 6.5 0 0 1 9 6.2 7 7 0 1 0 16.5 14.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconGrid() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.4" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4" stroke="currentColor" strokeWidth="1.75" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  )
}

function IconUser() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function IconCard() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="6" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3.5 10h17" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  )
}

function IconSignOut() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 7V5.5A1.5 1.5 0 0 1 11.5 4h7A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 10 18.5V17" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M13.5 12H4M6.5 9.5 4 12l2.5 2.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconDoc() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 3.5h7l4.5 4.5V20a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M14 3.5V8h4.5M8.5 12.5h7M8.5 16h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function IconRoute() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="2.2" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="18" cy="18" r="2.2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 7.2C12 7.2 12 16.8 16 16.8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3.5 19 6.2v5.3c0 4.2-2.8 7.2-7 8.9-4.2-1.7-7-4.7-7-8.9V6.2L12 3.5Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  )
}

function IconCrown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3.5 17.5h17l-1.4-9-4.3 3.6L12 6.2 9.2 12.1 4.9 8.5l-1.4 9Z" />
    </svg>
  )
}
