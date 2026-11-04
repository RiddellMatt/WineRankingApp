import { useEffect, useState } from 'react'
import { FriendCellarView } from './FriendCellarView'
import { ProfileMilestoneHighlights } from './ProfileMilestoneHighlights'
import {
  fetchFriendMilestoneSummaries,
  type FriendMilestoneSummary,
} from '../lib/friendMilestones'
import type { UserProfile } from '../lib/profileDb'
import type { RankingPreference, Wine } from '../types'

interface Props {
  profile: UserProfile
  wines: Wine[]
  rankingPreference: RankingPreference
  onEditProfile: () => void
}

export function ProfilePublicPreview({
  profile,
  wines,
  rankingPreference,
  onEditProfile,
}: Props) {
  const displayName =
    profile.displayName?.trim() || profile.email?.split('@')[0] || 'Wine lover'

  const [milestoneSummary, setMilestoneSummary] = useState<FriendMilestoneSummary | null>(
    null,
  )

  useEffect(() => {
    let cancelled = false
    void fetchFriendMilestoneSummaries([{ userId: profile.id, wines }]).then((map) => {
      if (!cancelled) setMilestoneSummary(map.get(profile.id) ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [profile.id, wines])

  return (
    <div className="profile-public-preview">
      <div className="profile-preview-toolbar">
        <p className="profile-preview-hint">This is how friends see your profile and cellar.</p>
        <button type="button" className="btn primary small" onClick={onEditProfile}>
          Edit profile
        </button>
      </div>
      {milestoneSummary && <ProfileMilestoneHighlights summary={milestoneSummary} />}
      <FriendCellarView
        displayName={displayName}
        avatarUrl={profile.avatarUrl}
        userId={profile.id}
        wines={wines}
        rankingPreference={rankingPreference}
        emptyMessage="You haven't logged any wines yet. Friends only see rated bottles from your cellar."
      />
    </div>
  )
}
