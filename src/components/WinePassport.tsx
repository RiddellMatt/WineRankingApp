import { useCallback, useEffect, useMemo, useState } from 'react'
import { Avatar } from './Avatar'
import {
  buildFriendStandings,
  buildPersonalPassport,
  friendSnapshotFromWines,
  type FriendCellarSnapshot,
} from '../lib/explorerStats'
import { fetchFriendships } from '../lib/friendsDb'
import { computeJourneyProgress } from '../lib/journeys'
import { fetchWines } from '../lib/wineDb'
import type { CountEntry } from '../lib/wineGeo'
import type { Wine } from '../types'
import {
  buildPassportStamps,
  passportSocialHook,
  pickActiveJourney,
  type PassportStamp,
} from '../lib/passportAtlas'
import { MonthlyChallengeCard } from './MonthlyChallengeCard'

interface Props {
  userId: string
  wines: Wine[]
  completedJourneys: Set<string>
  viewerEmail?: string
  viewerAvatarUrl?: string
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

function ActiveJourneyCard({ journey }: { journey: NonNullable<ReturnType<typeof pickActiveJourney>> }) {
  const pct = Math.min(100, (journey.current / journey.requiredWines) * 100)
  return (
    <article className="passport-active-journey">
      <div className="passport-active-journey-head">
        <span className="passport-active-journey-icon" aria-hidden="true">
          {journey.icon}
        </span>
        <div>
          <p className="passport-active-journey-eyebrow">Active journey</p>
          <h3 className="passport-active-journey-title">{journey.title}</h3>
          <p className="passport-active-journey-desc">{journey.description}</p>
        </div>
      </div>
      {journey.nudge && <p className="passport-active-journey-nudge">{journey.nudge}</p>}
      <div className="journey-progress-row">
        <div className="journey-progress-track">
          <div className="journey-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="journey-progress-label">{journey.progressLabel}</span>
      </div>
    </article>
  )
}

function StampCell({ stamp }: { stamp: PassportStamp }) {
  return (
    <li
      className={`passport-stamp passport-stamp-${stamp.kind}`}
      title={stamp.detail}
    >
      <span className="passport-stamp-icon" aria-hidden="true">
        {stamp.icon}
      </span>
      <span className="passport-stamp-label">{stamp.label}</span>
      {stamp.kind === 'journey' && (
        <span className="passport-stamp-badge" aria-label="Journey complete">
          ✓
        </span>
      )}
      {stamp.detail && stamp.kind === 'country' && (
        <span className="passport-stamp-detail">{stamp.detail}</span>
      )}
    </li>
  )
}

export function WinePassport({
  userId,
  wines,
  completedJourneys,
  viewerEmail,
  viewerAvatarUrl,
  onViewCellar,
}: Props) {
  const [friendSnapshots, setFriendSnapshots] = useState<FriendCellarSnapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const passport = useMemo(() => buildPersonalPassport(wines), [wines])
  const journeys = useMemo(
    () => computeJourneyProgress(wines, completedJourneys),
    [wines, completedJourneys],
  )
  const stamps = useMemo(() => buildPassportStamps(passport, journeys), [passport, journeys])
  const activeJourney = useMemo(() => pickActiveJourney(journeys), [journeys])
  const completedJourneyCount = journeys.filter((j) => j.earnedComplete).length

  const loadFriends = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const friendships = await fetchFriendships(userId)
      const accepted = friendships.filter((f) => f.status === 'accepted')
      if (accepted.length === 0) {
        setFriendSnapshots([])
        return
      }

      const snapshots = await Promise.all(
        accepted.map(async (f) => {
          const friendId =
            f.friend?.id ?? (f.requesterId === userId ? f.addresseeId : f.requesterId)
          const profile = f.friend ?? { id: friendId, displayName: '', email: '' }
          const friendWines = await fetchWines(friendId)
          return friendSnapshotFromWines(profile, friendWines)
        }),
      )
      setFriendSnapshots(snapshots)
    } catch (e) {
      setError(String((e as Error).message ?? e))
      setFriendSnapshots([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadFriends().catch(() => {})
  }, [loadFriends])

  const standings = useMemo(
    () => buildFriendStandings(wines, friendSnapshots),
    [wines, friendSnapshots],
  )
  const social = useMemo(() => passportSocialHook(standings), [standings])

  if (passport.totalTried === 0) {
    return (
      <div className="wine-passport wine-passport-atlas">
        <MonthlyChallengeCard
          wines={wines}
          completedJourneys={completedJourneys}
          friendSnapshots={friendSnapshots}
          viewerId={userId}
          viewerEmail={viewerEmail}
          viewerAvatarUrl={viewerAvatarUrl}
        />
        <section className="passport-empty-state">
          <span className="empty-icon" aria-hidden="true">
            🌍
          </span>
          <p>Log a few wines to open your atlas — countries appear as stamps, journeys earn region seals.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="wine-passport wine-passport-atlas">
      {passport.highlight && (
        <section className="passport-highlight">
          <span className="passport-highlight-icon" aria-hidden="true">
            🥂
          </span>
          <p>{passport.highlight}</p>
        </section>
      )}

      <section className="passport-atlas-summary" aria-label="Atlas summary">
        <div className="passport-atlas-metric">
          <span className="passport-atlas-metric-value">{passport.countries.length}</span>
          <span className="passport-atlas-metric-label">countries stamped</span>
        </div>
        <div className="passport-atlas-metric">
          <span className="passport-atlas-metric-value">{completedJourneyCount}</span>
          <span className="passport-atlas-metric-label">journey seals</span>
        </div>
      </section>

      <MonthlyChallengeCard
        wines={wines}
        completedJourneys={completedJourneys}
        friendSnapshots={friendSnapshots}
        viewerId={userId}
        viewerEmail={viewerEmail}
        viewerAvatarUrl={viewerAvatarUrl}
      />

      {activeJourney ? (
        <ActiveJourneyCard journey={activeJourney} />
      ) : (
        <section className="passport-card passport-all-journeys-done">
          <p className="passport-empty">All current journeys complete — new regions coming in future updates.</p>
        </section>
      )}

      <section className="passport-card passport-stamps-card" aria-labelledby="passport-stamps-title">
        <h3 id="passport-stamps-title">Your stamps</h3>
        <p className="passport-journeys-intro">
          Countries from wines you&apos;ve tried; journey seals when you finish a regional trail.
        </p>
        {stamps.length === 0 ? (
          <p className="passport-empty">Add regions to your wines to collect country stamps.</p>
        ) : (
          <ol className="passport-stamp-grid">
            {stamps.map((stamp) => (
              <StampCell stamp={stamp} key={stamp.id} />
            ))}
          </ol>
        )}
      </section>

      {friendSnapshots.length > 0 && (
        <section className="passport-card passport-social-hook" aria-label="Friends">
          <h3>Among friends</h3>
          {loading ? (
            <p className="auth-info">Loading…</p>
          ) : social ? (
            <p className={`passport-social-message ${social.youLead ? 'leads' : ''}`}>{social.message}</p>
          ) : (
            <p className="passport-empty">You're tied with friends across passport stats.</p>
          )}
          {error && <p className="form-error">{error}</p>}
          <ul className="passport-friend-avatars">
            {friendSnapshots.map((f) => (
              <li key={f.id}>
                {onViewCellar ? (
                  <button
                    type="button"
                    className="passport-friend-avatar-btn"
                    title={f.name}
                    onClick={() => onViewCellar(f.id, f.name, f.avatarUrl)}
                  >
                    <Avatar displayName={f.name} avatarUrl={f.avatarUrl} seed={f.id} size="sm" />
                  </button>
                ) : (
                  <span title={f.name}>
                    <Avatar displayName={f.name} avatarUrl={f.avatarUrl} seed={f.id} size="sm" />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="passport-details">
        <summary className="passport-details-summary">Detailed breakdown</summary>
        <div className="passport-grid">
          <PassportBars
            title="Wine origins"
            data={passport.countries}
            emptyHint="Add regions to your wines to track countries of origin."
          />
          <PassportBars
            title="Where you drank it"
            data={passport.drinkLocations}
            emptyHint='Use “Where you drank it” when logging.'
          />
          {passport.regions.length > 0 && (
            <PassportBars title="Top regions" data={passport.regions} emptyHint="" />
          )}
        </div>
        <section className="passport-card journeys-card">
          <h3>All journeys</h3>
          <ul className="journey-list journey-list-compact">
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
                  <p className="journey-requirement">{journey.description}</p>
                  <span className="journey-progress-label">{journey.progressLabel}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </details>
    </div>
  )
}
