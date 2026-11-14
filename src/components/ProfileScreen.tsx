import { AccountPanel } from './AccountPanel'
import { ProfilePanel } from './ProfilePanel'
import type { AccountSettingsSection } from './accountSettings'
import type { RankingPreference, Wine } from '../types'
import type { ComponentProps } from 'react'

type AccountPanelProps = ComponentProps<typeof AccountPanel>

export type ProfileScreenMode = 'preview' | 'settings'

interface Props extends AccountPanelProps {
  rankingPreference: RankingPreference
  onRankingPreferenceSaved: (preference: RankingPreference) => Promise<void>
  mode: ProfileScreenMode
  onModeChange: (mode: ProfileScreenMode) => void
  settingsSection: AccountSettingsSection
  onSettingsSectionChange: (section: AccountSettingsSection) => void
  wines: Wine[]
  completedJourneys?: Set<string>
  onViewFriendCellar: (friendId: string, friendName: string, avatarUrl?: string) => void
}

export function ProfileScreen({
  mode,
  onModeChange,
  settingsSection,
  onSettingsSectionChange,
  profile,
  signedIn,
  wines,
  completedJourneys = new Set(),
  onViewFriendCellar,
  rankingPreference,
  onRankingPreferenceSaved,
  ...accountProps
}: Props) {
  function openSettingsMenu() {
    onModeChange('settings')
    onSettingsSectionChange('menu')
  }

  function handleSettingsBack() {
    if (settingsSection !== 'menu') {
      onSettingsSectionChange('menu')
      return
    }
    if (signedIn && profile) {
      onModeChange('preview')
    }
  }

  if (signedIn && profile && mode === 'preview') {
    return (
      <ProfilePanel
        profile={profile}
        email={accountProps.email}
        wines={wines}
        completedJourneys={completedJourneys}
        rankingPreference={rankingPreference}
        onOpenSettings={openSettingsMenu}
        onViewFriendCellar={onViewFriendCellar}
      />
    )
  }

  const showSettingsBack = mode === 'settings' && (settingsSection !== 'menu' || Boolean(signedIn && profile))

  return (
    <AccountPanel
      profile={profile}
      signedIn={signedIn}
      rankingPreference={rankingPreference}
      onRankingPreferenceSaved={onRankingPreferenceSaved}
      {...accountProps}
      settingsSection={settingsSection}
      onSettingsSectionChange={onSettingsSectionChange}
      onBack={showSettingsBack ? handleSettingsBack : undefined}
      backLabel={settingsSection === 'menu' ? '← Profile' : '← Settings'}
    />
  )
}