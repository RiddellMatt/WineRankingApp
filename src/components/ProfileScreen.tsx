import { AccountPanel } from './AccountPanel'
import { ProfilePublicPreview } from './ProfilePublicPreview'
import type { Wine } from '../types'
import type { ComponentProps } from 'react'

type AccountPanelProps = ComponentProps<typeof AccountPanel>

export type ProfileScreenMode = 'preview' | 'edit'

interface Props extends AccountPanelProps {
  mode: ProfileScreenMode
  onModeChange: (mode: ProfileScreenMode) => void
  wines: Wine[]
}

export function ProfileScreen({ mode, onModeChange, profile, signedIn, wines, ...accountProps }: Props) {
  const showPreview = signedIn && profile && mode === 'preview'

  if (showPreview) {
    return (
      <ProfilePublicPreview
        profile={profile}
        wines={wines}
        rankingPreference={accountProps.rankingPreference}
        onEditProfile={() => onModeChange('edit')}
      />
    )
  }

  return (
    <AccountPanel
      profile={profile}
      signedIn={signedIn}
      wines={wines}
      {...accountProps}
      onBackToProfile={signedIn && profile ? () => onModeChange('preview') : undefined}
    />
  )
}
