/** Scores are out of 10, in quarter steps. Legacy cellar data was out of 5. */

export const SCORE_MAX = 10
export const SCORE_STEP = 0.25
export const LEGACY_SCORE_MAX = 5

export interface ScoreStop {
  at: number
  h: number
  s: number
  l: number
}

/** 1 is red, 5 is yellow, 7 is green, 10 is a darker green. */
export const SCORE_STOPS: readonly ScoreStop[] = [
  { at: 0, h: 0, s: 74, l: 30 },
  { at: 1, h: 2, s: 80, l: 42 },
  { at: 5, h: 48, s: 94, l: 50 },
  { at: 7, h: 130, s: 58, l: 38 },
  { at: 10, h: 150, s: 72, l: 26 },
]

export function snapScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  const steps = Math.round(value / SCORE_STEP)
  const snapped = Math.min(SCORE_MAX, Math.max(0, steps * SCORE_STEP))
  return Math.round(snapped * 100) / 100
}

/** Map a stored score onto the 10-point scale. Scale 10 is already current. */
export function toTenPoint(value: number, scale?: number | null): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (scale === 10 || value > LEGACY_SCORE_MAX) return snapScore(value)
  return snapScore(value * (SCORE_MAX / LEGACY_SCORE_MAX))
}

export function formatScore(value: number): string {
  const snapped = snapScore(value)
  if (Number.isInteger(snapped)) return String(snapped)
  const quarters = Math.round(snapped * 4)
  if (quarters % 2 === 0) return (quarters / 4).toFixed(1)
  return (quarters / 4).toFixed(2)
}

export function formatScoreOutOf(value: number): string {
  if (!(value > 0)) return '—'
  return `${formatScore(value)}/10`
}

/** Averages are not forced onto a quarter step. */
export function formatScoreAverage(value: number): string {
  if (!(value > 0)) return '—'
  return `${(Math.round(value * 10) / 10).toFixed(1)}/10`
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function scoreStopAt(value: number): { h: number; s: number; l: number } {
  const v = Math.min(SCORE_MAX, Math.max(0, value))
  let index = 0
  while (index < SCORE_STOPS.length - 2 && SCORE_STOPS[index + 1]!.at < v) index += 1
  const left = SCORE_STOPS[index]!
  const right = SCORE_STOPS[index + 1]!
  const span = right.at - left.at
  const t = span === 0 ? 0 : (v - left.at) / span
  return {
    h: lerp(left.h, right.h, t),
    s: lerp(left.s, right.s, t),
    l: lerp(left.l, right.l, t),
  }
}

export function scoreColor(value: number): string {
  const { h, s, l } = scoreStopAt(value)
  return `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`
}

export function scoreRgb(value: number): { r: number; g: number; b: number } {
  const { h, s, l } = scoreStopAt(value)
  const sat = s / 100
  const light = l / 100
  const c = (1 - Math.abs(2 * light - 1)) * sat
  const hp = h / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r = 0
  let g = 0
  let b = 0
  if (hp < 1) [r, g, b] = [c, x, 0]
  else if (hp < 2) [r, g, b] = [x, c, 0]
  else if (hp < 3) [r, g, b] = [0, c, x]
  else if (hp < 4) [r, g, b] = [0, x, c]
  else if (hp < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const m = light - c / 2
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  }
}

export function scoreGradientCss(): string {
  const stops = SCORE_STOPS.map((stop) => {
    const pct = (stop.at / SCORE_MAX) * 100
    return `hsl(${stop.h} ${stop.s}% ${stop.l}%) ${pct}%`
  })
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

/** Pull the first number out of a typed score and snap it to a quarter. */
export function scoreFromTyped(raw: string, fallback: number): number {
  const trimmed = raw.trim()
  if (trimmed === '') return 0
  const match = trimmed.match(/\d+(?:[.,]\d+)?/)
  if (!match) return snapScore(fallback)
  return snapScore(Number(match[0].replace(',', '.')))
}
