import { AccountPanel } from './AccountPanel'
import { ProfilePanel } from './ProfilePanel'
import type { AccountSettingsSection } from './accountSettings'
import type { RankingPreference, Wine } from '../types'
import type { ComponentProps } from 'react'

type AccountPanelProps = ComponentProps<typeof AccountPanel>

export type ProfileSurface = 'profile' | 'more'

interface Props extends AccountPanelProps {
  rankingPreference: RankingPreference
  onRankingPreferenceSaved: (preference: RankingPreference) => Promise<void>
  surface: ProfileSurface
  profileLoaded: boolean
  settingsSection: AccountSettingsSection
  onSettingsSectionChange: (section: AccountSettingsSection) => void
  wines: Wine[]
  completedJourneys?: Set<string>
  onViewFriendCellar: (friendId: string, friendName: string, avatarUrl?: string) => void
}

export function ProfileScreen({
  surface,
  profileLoaded,
  settingsSection,
  onSettingsSectionChange,
  profile,
  signedIn,
  wines,
  completedJourneys = new Set(),
  onViewFriendCellar,
  rankingPreference,
  onRankingPreferenceSaved,
  offlineMode,
  cloudConfigured,
  onSignIn,
  ...accountProps
}: Props) {
  if (surface === 'profile') {
    if (signedIn && !profileLoaded) {
      return <p className="auth-info">Loading profile…</p>
    }

    if (signedIn && profile) {
      return (
        <ProfilePanel
          profile={profile}
          email={accountProps.email}
          pro={accountProps.pro}
          wines={wines}
          completedJourneys={completedJourneys}
          rankingPreference={rankingPreference}
          onViewFriendCellar={onViewFriendCellar}
        />
      )
    }

    return (
      <section className="empty">
        <h2>Your profile</h2>
        <p>Sign in to see your activity, badges, and passport.</p>
        {offlineMode && cloudConfigured && (
          <div className="empty-actions">
            <button type="button" className="btn primary" onClick={onSignIn}>
              Sign in or create account
            </button>
          </div>
        )}
      </section>
    )
  }

  return (
    <AccountPanel
      profile={profile}
      signedIn={signedIn}
      offlineMode={offlineMode}
      cloudConfigured={cloudConfigured}
      onSignIn={onSignIn}
      rankingPreference={rankingPreference}
      onRankingPreferenceSaved={onRankingPreferenceSaved}
      {...accountProps}
      settingsSection={settingsSection}
      onSettingsSectionChange={onSettingsSectionChange}
      onBack={settingsSection !== 'menu' ? () => onSettingsSectionChange('menu') : undefined}
      backLabel="← More"
    />
  )
}
