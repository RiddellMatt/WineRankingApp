import { useCallback, useEffect, useMemo, useState } from 'react'
import { Avatar } from './Avatar'
import {
  buildFriendStandings,
  buildPersonalPassport,
  friendSnapshotFromWines,
  type FriendCellarSnapshot,
  type FriendStandingRow,
} from '../lib/explorerStats'
import { fetchFriendships } from '../lib/friendsDb'
import { fetchFriendMilestoneSummaries, type FriendMilestoneSummary } from '../lib/friendMilestones'
import { computeJourneyProgress } from '../lib/journeys'
import { fetchWines } from '../lib/wineDb'
import type { CountEntry } from '../lib/wineGeo'
import type { Wine } from '../types'
import { tierLabel } from '../lib/badges'

interface Props {
  userId: string
  wines: Wine[]
  completedJourneys: Set<string>
  onViewCellar?: (friendId: string, friendName: string, avatarUrl?: string) => void
}

function PassportBars({ title, data, emptyHint }: { title: string; data: CountEntry[]; emptyHint: string }) {
  if (data.length === 0) {
    return (
      <section className="passport-card">
        <h3>{title}</h3>
        <p className="passport-empty">{emptyHint}</p>
      </section>
    )
  }

  const max = Math.max(...data.map((d) => d.count), 1)

  return (
    <section className="passport-card">
      <h3>{title}</h3>
      <div className="passport-bars">
        {data.slice(0, 6).map((d) => (
          <div className="passport-bar-row" key={d.label}>
            <span className="passport-bar-label">{d.label}</span>
            <div className="passport-bar-track">
              <div
                className="passport-bar-fill"
                style={{ width: `${Math.max((d.count / max) * 100, 6)}%` }}
              />
            </div>
            <span className="passport-bar-value">{d.count}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function StandingRow({ row }: { row: FriendStandingRow }) {
  return (
    <li className="standing-row">
      <div className="standing-main">
        <span className="standing-category">{row.category}</span>
        <span className="standing-you">You · {row.you}</span>
      </div>
      <div className={`standing-leader ${row.youLead ? 'you-lead' : ''}`}>
        {row.youLead ? (
          <>You lead 👑</>
        ) : (
          <>
            {row.leaderName} · {row.leaderCount} 👑
          </>
        )}
      </div>
    </li>
  )
}

function FriendMilestoneRow({
  name,
  avatarUrl,
  friendId,
  summary,
  onViewCellar,
}: {
  name: string
  avatarUrl?: string
  friendId: string
  summary: FriendMilestoneSummary
  onViewCellar?: (friendId: string, friendName: string, avatarUrl?: string) => void
}) {
  return (
    <li className="friend-milestone-row">
      <Avatar displayName={name} avatarUrl={avatarUrl} seed={friendId} size="sm" />
      <div className="friend-milestone-copy">
        <span className="friend-milestone-name">{name}</span>
        <span className="friend-milestone-summary">{summary.summaryLine}</span>
        {summary.badgeHighlights.length > 0 && (
          <div className="friend-milestone-badges">
            {summary.badgeHighlights.map((badge) => (
              <span className="friend-milestone-badge" key={badge.id} title={`${badge.title} — ${tierLabel(badge.tier)}`}>
                <span aria-hidden="true">{badge.icon}</span>
                <span className="friend-milestone-badge-tier">{tierLabel(badge.tier)}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      {onViewCellar && (
        <button
          type="button"
          className="link-btn friend-milestone-view"
          onClick={() => onViewCellar(friendId, name, avatarUrl)}
        >
          Cellar
        </button>
      )}
    </li>
  )
}

export function WinePassport({ userId, wines, completedJourneys, onViewCellar }: Props) {
  const [friendSnapshots, setFriendSnapshots] = useState<FriendCellarSnapshot[]>([])
  const [friendMilestones, setFriendMilestones] = useState<Map<string, FriendMilestoneSummary>>(
    new Map(),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const passport = useMemo(() => buildPersonalPassport(wines), [wines])
  const journeys = useMemo(
    () => computeJourneyProgress(wines, completedJourneys),
    [wines, completedJourneys],
  )
  const completedCount = journeys.filter((j) => j.earnedComplete).length

  const loadFriends = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const friendships = await fetchFriendships(userId)
      const accepted = friendships.filter((f) => f.status === 'accepted')
      if (accepted.length === 0) {
        setFriendSnapshots([])
        setFriendMilestones(new Map())
        return
      }

      const snapshots = await Promise.all(
        accepted.map(async (f) => {
          const friendId =
            f.friend?.id ?? (f.requesterId === userId ? f.addresseeId : f.requesterId)
          const profile = f.friend ?? {
            id: friendId,
            displayName: '',
            email: '',
          }
          const friendWines = await fetchWines(friendId)
          return friendSnapshotFromWines(profile, friendWines)
        }),
      )
      const friendIds = snapshots.map((snapshot) => snapshot.id)
      const milestones = await fetchFriendMilestoneSummaries(friendIds)
      setFriendSnapshots(snapshots)
      setFriendMilestones(milestones)
    } catch (e) {
      setError(String((e as Error).message ?? e))
      setFriendSnapshots([])
      setFriendMilestones(new Map())
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadFriends().catch(() => {
      // handled in loadFriends
    })
  }, [loadFriends])

  const standings = useMemo(
    () => buildFriendStandings(wines, friendSnapshots),
    [wines, friendSnapshots],
  )

  if (passport.totalTried === 0) {
    return (
      <section className="passport-empty-state">
        <span className="empty-icon" aria-hidden="true">
          🌍
        </span>
        <p>Log a few wines to unlock your wine passport and friend standings.</p>
      </section>
    )
  }

  return (
    <div className="wine-passport">
      {passport.highlight && (
        <section className="passport-highlight">
          <span className="passport-highlight-icon" aria-hidden="true">
            🥂
          </span>
          <p>{passport.highlight}</p>
        </section>
      )}

      <section className="passport-stats-row">
        <div className="passport-stat">
          <span className="passport-stat-value">{passport.totalTried}</span>
          <span className="passport-stat-label">wines logged</span>
        </div>
        <div className="passport-stat">
          <span className="passport-stat-value">{passport.countries.length}</span>
          <span className="passport-stat-label">origin countries</span>
        </div>
        <div className="passport-stat">
          <span className="passport-stat-value">{passport.drinkLocations.length}</span>
          <span className="passport-stat-label">places drank</span>
        </div>
        <div className="passport-stat">
          <span className="passport-stat-value">{completedCount}</span>
          <span className="passport-stat-label">journeys done</span>
        </div>
      </section>

      <section className="passport-card journeys-card">
        <h3>Journeys</h3>
        <p className="passport-journeys-intro">
          Log tried wines from iconic regions — complete a journey with 3 matching pours.
        </p>
        <ul className="journey-list">
          {journeys.map((journey) => (
            <li
              className={`journey-card ${journey.earnedComplete ? 'complete' : ''}`}
              key={journey.id}
            >
              <span className="journey-icon" aria-hidden="true">
                {journey.icon}
              </span>
              <div className="journey-copy">
                <h4 className="journey-title">{journey.title}</h4>
                <p className="journey-desc">{journey.description}</p>
                {journey.nudge && !journey.earnedComplete && (
                  <p className="journey-nudge">{journey.nudge}</p>
                )}
                <div className="journey-progress-row">
                  <div className="journey-progress-track">
                    <div
                      className="journey-progress-fill"
                      style={{
                        width: `${Math.min(
                          100,
                          (Math.min(journey.current, journey.requiredWines) / journey.requiredWines) *
                            100,
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="journey-progress-label">{journey.progressLabel}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {friendSnapshots.length > 0 && (
        <section className="passport-card friend-milestones-card">
          <h3>Friends&apos; milestones</h3>
          <p className="passport-journeys-intro">
            Badges and journeys your friends have earned — synced from their accounts.
          </p>
          <ul className="friend-milestones-list">
            {friendSnapshots.map((friend) => {
              const summary =
                friendMilestones.get(friend.id) ??
                ({
                  userId: friend.id,
                  journeyCount: 0,
                  earnedBadgeCount: 0,
                  badgeHighlights: [],
                  summaryLine: 'No milestones yet',
                } satisfies FriendMilestoneSummary)
              return (
                <FriendMilestoneRow
                  key={friend.id}
                  friendId={friend.id}
                  name={friend.name}
                  avatarUrl={friend.avatarUrl}
                  summary={summary}
                  onViewCellar={onViewCellar}
                />
              )
            })}
          </ul>
        </section>
      )}

      <div className="passport-grid">
        <PassportBars
          title="Wine origins"
          data={passport.countries}
          emptyHint="Add regions to your wines to track countries of origin."
        />
        <PassportBars
          title="Origin + type"
          data={passport.originCombos}
          emptyHint="Regions unlock combos like “Spain · White”."
        />
        <PassportBars
          title="Where you drank it"
          data={passport.drinkLocations}
          emptyHint='Use “Where you drank it” when logging — e.g. “Charleston, SC” or “Rome, Italy”.'
        />
        {passport.regions.length > 0 && (
          <PassportBars title="Top regions" data={passport.regions} emptyHint="" />
        )}
      </div>

      <section className="passport-card standings-card">
        <h3>Among friends</h3>
        {loading ? (
          <p className="auth-info">Loading friend standings…</p>
        ) : friendSnapshots.length === 0 ? (
          <p className="passport-empty">Add friends to compare passports — personal stats still count for badges.</p>
        ) : (
          <ul className="standings-list">
            {standings.map((row) => (
              <StandingRow row={row} key={row.category} />
            ))}
          </ul>
        )}
        {error && <p className="form-error">{error}</p>}
        {friendSnapshots.length > 0 && (
          <ul className="passport-friend-avatars">
            {friendSnapshots.map((f) => (
              <li key={f.id} title={f.name}>
                <Avatar displayName={f.name} avatarUrl={f.avatarUrl} seed={f.id} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
