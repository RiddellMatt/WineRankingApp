import type { PlayerLevelState } from '../lib/playerLevel'

interface Props {
  level: PlayerLevelState
  compact?: boolean
}

export function ProfileLevelBar({ level, compact = false }: Props) {
  const atMax = level.level >= 50

  return (
    <div
      className={`profile-level ${compact ? 'profile-level-compact' : ''}`}
      aria-label={`Level ${level.level}, ${level.title}`}
    >
      <div className="profile-level-meta">
        <span className="profile-level-title">{level.title}</span>
        <span className="profile-level-num">
          Level {level.level}
          {!compact && !atMax && (
            <span className="profile-level-xp-delta">
              {' '}
              · {level.xpIntoLevel} / {level.xpForNextLevel} pts
            </span>
          )}
        </span>
      </div>
      <div className="profile-level-track" role="progressbar" aria-valuenow={level.progressPercent} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="profile-level-fill"
          style={{ width: `${atMax ? 100 : level.progressPercent}%` }}
        />
      </div>
    </div>
  )
}
