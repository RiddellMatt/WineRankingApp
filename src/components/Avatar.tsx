import { avatarHue, avatarInitial } from '../lib/avatar'

interface Props {
  displayName: string
  email?: string
  /** Used for background color; defaults to email or display name. */
  seed?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Avatar({
  displayName,
  email,
  seed,
  size = 'md',
  className = '',
}: Props) {
  const initial = avatarInitial(displayName, email)
  const colorSeed = seed || email || displayName || initial
  const hue = avatarHue(colorSeed)
  const label = displayName.trim() || email || 'User'

  return (
    <span
      className={`avatar avatar-${size} ${className}`.trim()}
      style={{ background: `hsl(${hue} 45% 38%)` }}
      aria-hidden={label ? undefined : true}
      title={label}
    >
      {initial}
    </span>
  )
}
