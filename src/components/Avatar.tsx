import { avatarHue, avatarInitial } from '../lib/avatar'

interface Props {
  displayName: string
  email?: string
  avatarUrl?: string | null
  /** Used for background color when no photo; defaults to email or display name. */
  seed?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Avatar({
  displayName,
  email,
  avatarUrl,
  seed,
  size = 'md',
  className = '',
}: Props) {
  const initial = avatarInitial(displayName, email)
  const colorSeed = seed || email || displayName || initial
  const hue = avatarHue(colorSeed)
  const label = displayName.trim() || email || 'User'
  const classes = `avatar avatar-${size} ${className}`.trim()

  if (avatarUrl) {
    return (
      <span className={classes} title={label}>
        <img className="avatar-img" src={avatarUrl} alt="" />
      </span>
    )
  }

  return (
    <span
      className={classes}
      style={{ background: `hsl(${hue} 45% 38%)` }}
      aria-hidden={label ? undefined : true}
      title={label}
    >
      {initial}
    </span>
  )
}
