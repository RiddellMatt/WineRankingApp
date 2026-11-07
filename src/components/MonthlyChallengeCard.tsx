import { useMemo, useState } from 'react'
import { Avatar } from './Avatar'
import type { FriendCellarSnapshot } from '../lib/explorerStats'
import {
  buildMonthlyChallengeFriends,
  challengeForMonth,
  computeMonthlyChallengeProgress,
  loadMonthlyChallengeJoined,
  monthDisplayLabel,
  monthlyChallengeDetailLine,
  monthKey,
  saveMonthlyChallengeJoined,
} from '../lib/monthlyChallenges'
import type { MonthlyChallengeFriendRow } from '../lib/monthlyChallenges'
import type { Wine } from '../types'

interface Props {
  wines: Wine[]
  completedJourneys: ReadonlySet<string>
  friendSnapshots?: FriendCellarSnapshot[]
  viewerId?: string
  viewerEmail?: string
  viewerAvatarUrl?: string
}

export function MonthlyChallengeCard({
  wines,
  completedJourneys,
  friendSnapshots = [],
  viewerId = 'you',
  viewerEmail,
  viewerAvatarUrl,
}: Props) {
  const now = useMemo(() => new Date(), [])
  const key = monthKey(now)
  const challenge = useMemo(() => challengeForMonth(now), [now])
  const [joined, setJoined] = useState(() => loadMonthlyChallengeJoined(key))

  const progress = useMemo(
    () => computeMonthlyChallengeProgress(challenge, wines, completedJourneys, now),
    [challenge, wines, completedJourneys, now],
  )

  const friendRows = useMemo(() => {
    if (friendSnapshots.length === 0) return []
    const rows = buildMonthlyChallengeFriends(
      challenge,
      wines,
      completedJourneys,
      friendSnapshots.map((f) => ({
        id: f.id,
        name: f.name,
        avatarUrl: f.avatarUrl,
        tried: f.tried,
      })),
      now,
    )
    const you = rows.find((r) => r.isYou)
    const others = rows.filter((r) => !r.isYou).slice(0, 4)
    return you ? [you, ...others] : others.slice(0, 5)
  }, [challenge, wines, completedJourneys, friendSnapshots, now])

  const pct = progress.percent

  function handleJoin() {
    saveMonthlyChallengeJoined(key, true)
    setJoined(true)
  }

  return (
    <section className="passport-card monthly-challenge-card" aria-labelledby="monthly-challenge-title">
      <div className="monthly-challenge-head">
        <span className="monthly-challenge-icon" aria-hidden="true">
          {challenge.icon}
        </span>
        <div className="monthly-challenge-head-text">
          <p className="monthly-challenge-eyebrow">{monthDisplayLabel(now)} challenge</p>
          <h3 id="monthly-challenge-title">{challenge.title}</h3>
          <p className="monthly-challenge-desc">{monthlyChallengeDetailLine(challenge)}</p>
        </div>
      </div>

      {joined ? (
        <>
          <div className="monthly-challenge-progress-row">
            <div className="journey-progress-track monthly-challenge-track">
              <div
                className={`journey-progress-fill monthly-challenge-fill ${progress.complete ? 'complete' : ''}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="journey-progress-label">{progress.progressLabel}</span>
          </div>
          {progress.complete && (
            <p className="monthly-challenge-done" role="status">
              Challenge complete — nice work this month.
            </p>
          )}
        </>
      ) : (
        <div className="monthly-challenge-join">
          <p className="monthly-challenge-join-copy">
            Optional monthly goal — join to track progress and compare with friends.
          </p>
          <button type="button" className="btn primary small" onClick={handleJoin}>
            Join challenge
          </button>
        </div>
      )}

      {joined && friendSnapshots.length > 0 && (
        <div className="monthly-challenge-friends">
          <p className="monthly-challenge-friends-label">This month among friends</p>
          <ul className="monthly-challenge-standings">
            {friendRows.map((row: MonthlyChallengeFriendRow) => (
              <li
                key={row.id}
                className={`monthly-challenge-standing ${row.isYou ? 'is-you' : ''} ${
                  row.complete ? 'complete' : ''
                }`}
              >
                {row.isYou ? (
                  <Avatar
                    displayName="You"
                    email={viewerEmail}
                    avatarUrl={viewerAvatarUrl}
                    seed={viewerId}
                    size="sm"
                  />
                ) : (
                  <Avatar
                    displayName={row.name}
                    avatarUrl={row.avatarUrl}
                    seed={row.id}
                    size="sm"
                  />
                )}
                <span className="monthly-challenge-standing-name">{row.isYou ? 'You' : row.name}</span>
                <span className="monthly-challenge-standing-pct">{row.percent}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
