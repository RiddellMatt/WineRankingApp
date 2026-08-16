/** First letter shown in avatar circles when no photo is set. */
export function avatarInitial(displayName: string, email?: string): string {
  const source = displayName.trim() || email?.split('@')[0] || '?'
  return source.charAt(0).toUpperCase()
}

/** Stable hue (0–359) from a user id or name so avatars are visually distinct. */
export function avatarHue(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % 360
}
