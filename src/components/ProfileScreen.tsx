import { AccountPanel } from './AccountPanel'
import { ProfilePanel } from './ProfilePanel'
import type { Wine } from '../types'
import type { ComponentProps } from 'react'

type AccountPanelProps = ComponentProps<typeof AccountPanel>

export type ProfileScreenMode = 'preview' | 'edit'

interface Props extends AccountPanelProps {
  mode: ProfileScreenMode
  onModeChange: (mode: ProfileScreenMode) => void
  wines: Wine[]
  completedJourneys?: Set<string>
  onViewFriendCellar: (friendId: string, friendName: string, avatarUrl?: string) => void
}

export function ProfileScreen({
  mode,
  onModeChange,
  profile,
  signedIn,
  wines,
  completedJourneys = new Set(),
  onViewFriendCellar,
  ...accountProps
}: Props) {
  if (signedIn && profile && mode === 'preview') {
    return (
      <ProfilePanel
        profile={profile}
        email={accountProps.email}
        wines={wines}
        completedJourneys={completedJourneys}
        rankingPreference={accountProps.rankingPreference}
        onEditProfile={() => onModeChange('edit')}
        onViewFriendCellar={onViewFriendCellar}
      />
    )
  }

  return (
    <AccountPanel
      profile={profile}
      signedIn={signedIn}
      {...accountProps}
      onBackToProfile={signedIn && profile ? () => onModeChange('preview') : undefined}
    />
  )
}
