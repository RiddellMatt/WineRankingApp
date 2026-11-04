import { tierLabel } from '../lib/badges'
import type { FriendMilestoneSummary } from '../lib/friendMilestones'

interface Props {
  summary: FriendMilestoneSummary
}

/** Top badges + summary line — same chips friends see on Social → Passport. */
export function ProfileMilestoneHighlights({ summary }: Props) {
  const hasMilestones = summary.journeyCount > 0 || summary.earnedBadgeCount > 0

  return (
    <section className="profile-milestone-strip" aria-label="Milestones visible to friends">
      <p className="profile-milestone-label">On Social → Passport, friends see</p>
      {hasMilestones ? (
        <>
          <p className="profile-milestone-summary">{summary.summaryLine}</p>
          {summary.badgeHighlights.length > 0 && (
            <div className="friend-milestone-badges">
              {summary.badgeHighlights.map((badge) => (
                <span
                  className="friend-milestone-badge"
                  key={badge.id}
                  title={`${badge.title} — ${tierLabel(badge.tier)}`}
                >
                  <span aria-hidden="true">{badge.icon}</span>
                  <span className="friend-milestone-badge-tier">{tierLabel(badge.tier)}</span>
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="profile-milestone-summary profile-milestone-empty">
          No milestones yet — log wines and complete journeys to show badges here.
        </p>
      )}
    </section>
  )
}
