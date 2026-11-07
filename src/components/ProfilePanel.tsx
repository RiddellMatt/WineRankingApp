import { useEffect, useMemo, useState } from 'react'
import { Avatar } from './Avatar'
import { BadgeGrid } from './BadgeGrid'
import { OwnActivityFeed } from './OwnActivityFeed'
import { WinePassport } from './WinePassport'
import { mergeOwnActivity } from '../lib/activityFeed'
import { fetchUserMilestoneEvents, type ActivityEventRow } from '../lib/activityEventsDb'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  computeDisplayedBadgeProgress,
  isBadgeTestingEnabled,
  resetEarnedBadgeProgressForTesting,
} from '../lib/badgeUnlocks'
import { fetchFriendships } from '../lib/friendsDb'
import { computePlayerLevel } from '../lib/playerLevel'
import { ProfileLevelBar } from './ProfileLevelBar'
import type { UserProfile } from '../lib/profileDb'
import type { RankingPreference, Wine } from '../types'

type ProfileTab = 'activity' | 'badges' | 'passport'

interface Props {
  profile: UserProfile
  email?: string
  wines: Wine[]
  completedJourneys: Set<string>
  rankingPreference: RankingPreference
  onEditProfile: () => void
  onViewFriendCellar: (friendId: string, friendName: string, avatarUrl?: string) => void
}

export function ProfilePanel({
  profile,
  email,
  wines,
  completedJourneys,
  rankingPreference,
  onEditProfile,
  onViewFriendCellar,
}: Props) {
  const [tab, setTab] = useState<ProfileTab>('activity')
  const [friendCount, setFriendCount] = useState(0)
  const [milestoneRows, setMilestoneRows] = useState<ActivityEventRow[]>([])

  const displayName =
    profile.displayName?.trim() || profile.email?.split('@')[0] || email?.split('@')[0] || 'Wine lover'

  useEffect(() => {
    fetchFriendships(profile.id)
      .then((rows) => setFriendCount(rows.filter((f) => f.status === 'accepted').length))
      .catch(() => setFriendCount(0))
  }, [profile.id])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setMilestoneRows([])
      return
    }
    fetchUserMilestoneEvents(profile.id, 40)
      .then(setMilestoneRows)
      .catch(() => setMilestoneRows([]))
  }, [profile.id])

  const badges = useMemo(
    () => computeDisplayedBadgeProgress({ wines, friendCount, completedJourneys }),
    [wines, friendCount, completedJourneys],
  )

  const playerLevel = useMemo(
    () => computePlayerLevel({ wines, friendCount, completedJourneys }),
    [wines, friendCount, completedJourneys],
  )

  const activity = useMemo(
    () =>
      mergeOwnActivity(
        profile.id,
        displayName,
        profile.email ?? email ?? '',
        profile.avatarUrl,
        wines,
        milestoneRows,
        40,
      ),
    [profile.id, displayName, profile.email, profile.avatarUrl, email, wines, milestoneRows],
  )

  const badgeTestingEnabled = isBadgeTestingEnabled()

  function handleResetBadgeProgress() {
    if (
      !window.confirm(
        'Reset all earned badge tiers? The page will reload and unlock toasts may appear again for tiers you already qualify for.',
      )
    ) {
      return
    }
    resetEarnedBadgeProgressForTesting()
    window.location.reload()
  }

  return (
    <div className="profile-panel">
      <header className="profile-panel-header">
        <Avatar
          displayName={displayName}
          email={profile.email ?? email}
          avatarUrl={profile.avatarUrl}
          seed={profile.id}
          size="md"
        />
        <div className="profile-panel-identity">
          <h2 className="profile-panel-name">{displayName}</h2>
          {(profile.email ?? email) && (
            <p className="profile-panel-email">{profile.email ?? email}</p>
          )}
          <ProfileLevelBar level={playerLevel} />
        </div>
        <button type="button" className="btn primary small profile-panel-edit" onClick={onEditProfile}>
          Edit
        </button>
      </header>

      <section className="profile-tabs friends-tabs" aria-label="Profile views">
        <button
          type="button"
          className={`friends-tab ${tab === 'activity' ? 'active' : ''}`}
          onClick={() => setTab('activity')}
        >
          Activity
        </button>
        <button
          type="button"
          className={`friends-tab ${tab === 'badges' ? 'active' : ''}`}
          onClick={() => setTab('badges')}
        >
          Badges
        </button>
        <button
          type="button"
          className={`friends-tab ${tab === 'passport' ? 'active' : ''}`}
          onClick={() => setTab('passport')}
        >
          Passport
        </button>
      </section>

      {tab === 'activity' && (
        <section className="profile-tab-panel">
          <p className="friends-hint">Your recent ratings, saves, and milestones.</p>
          <OwnActivityFeed
            events={activity}
            rankingPreference={rankingPreference}
            emptyHint="Rate or save wines in Scan — they'll show up here."
          />
        </section>
      )}

      {tab === 'badges' && (
        <section className="profile-tab-panel">
          <p className="friends-hint">
            Earn metallic tiers as you log wines, explore origins, and connect with friends.
          </p>
          <BadgeGrid badges={badges} />
          {badgeTestingEnabled && (
            <button
              type="button"
              className="btn ghost small account-badge-reset"
              onClick={handleResetBadgeProgress}
            >
              Reset badge progress (testing)
            </button>
          )}
        </section>
      )}

      {tab === 'passport' && (
        <section className="profile-tab-panel">
          <p className="friends-hint">
            Your wine atlas — monthly challenge, active journey, stamps, and friend standings.
          </p>
          <WinePassport
            userId={profile.id}
            wines={wines}
            completedJourneys={completedJourneys}
            rankingPreference={rankingPreference}
            viewerEmail={profile.email ?? email}
            viewerAvatarUrl={profile.avatarUrl}
            onViewCellar={onViewFriendCellar}
          />
        </section>
      )}
    </div>
  )
}
