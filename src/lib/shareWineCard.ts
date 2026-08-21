import { APP_NAME, APP_TAGLINE } from '../brand'
import type { Wine } from '../types'

export interface ShareWineCardInput {
  wine: Wine
  score: number
  /** e.g. "From Alex's cellar" — shown under the wine details. */
  attribution?: string
}

const CARD_WIDTH = 1080
const CARD_HEIGHT = 1350

const COLORS = {
  bgTop: '#1c0e14',
  bgBottom: '#12080c',
  surface: '#26141c',
  border: '#4a2834',
  text: '#f7eef1',
  textMuted: '#c4a8b0',
  gold: '#e8b04b',
  goldSoft: '#f4d58d',
  accent: '#c41e3a',
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const lines: string[] = []
  let line = words[0]!
  for (let i = 1; i < words.length; i++) {
    const next = `${line} ${words[i]}`
    if (ctx.measureText(next).width <= maxWidth) {
      line = next
    } else {
      lines.push(line)
      line = words[i]!
    }
  }
  lines.push(line)
  return lines
}

function drawDecanterMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)

  const grad = ctx.createLinearGradient(-20, -30, 20, 30)
  grad.addColorStop(0, COLORS.goldSoft)
  grad.addColorStop(0.45, COLORS.gold)
  grad.addColorStop(1, COLORS.accent)

  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.moveTo(-2, -26)
  ctx.lineTo(2, -26)
  ctx.bezierCurveTo(2, -12, 0, -2, -2, 4)
  ctx.lineTo(-2, 26)
  ctx.lineTo(-8, 26)
  ctx.bezierCurveTo(-12, 26, -12, 32, -8, 32)
  ctx.lineTo(8, 32)
  ctx.bezierCurveTo(12, 32, 12, 26, 8, 26)
  ctx.lineTo(2, 26)
  ctx.lineTo(2, 4)
  ctx.bezierCurveTo(0, -2, -2, -12, -2, -26)
  ctx.fill()

  ctx.fillStyle = 'rgba(247, 238, 241, 0.2)'
  ctx.fillRect(-1, -18, 2, 22)

  ctx.restore()
}

function drawStars(ctx: CanvasRenderingContext2D, x: number, y: number, score: number, size: number) {
  const fullStars = Math.floor(score)
  const partial = score - fullStars
  const gap = size * 0.35

  for (let i = 0; i < 5; i++) {
    const cx = x + i * (size + gap) + size / 2
    const fillAmount = i < fullStars ? 1 : i === fullStars ? partial : 0
    drawStar(ctx, cx, y + size / 2, size / 2, fillAmount)
  }
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  fill: number,
) {
  const innerR = outerR * 0.45
  const points: { x: number; y: number }[] = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR
    const angle = (Math.PI / 2) * -1 + (Math.PI / 5) * i
    points.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r })
  }

  ctx.beginPath()
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.closePath()
  ctx.fillStyle = '#4a2c36'
  ctx.fill()

  if (fill > 0) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(cx - outerR, cy - outerR, outerR * 2 * fill, outerR * 2)
    ctx.clip()
    ctx.beginPath()
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
    ctx.closePath()
    ctx.fillStyle = COLORS.gold
    ctx.fill()
    ctx.restore()
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

export function shareWineCardFilename(wine: Pick<Wine, 'name'>): string {
  const slug = slugify(wine.name) || 'wine'
  return `decanti-${slug}.png`
}

/** Render a branded PNG card suitable for iMessage, Instagram stories, etc. */
export async function renderShareWineCard(input: ShareWineCardInput): Promise<Blob> {
  const { wine, score, attribution } = input
  const canvas = document.createElement('canvas')
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create share image.')

  const bgGrad = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT)
  bgGrad.addColorStop(0, COLORS.bgTop)
  bgGrad.addColorStop(1, COLORS.bgBottom)
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  ctx.fillStyle = 'rgba(196, 30, 58, 0.12)'
  ctx.beginPath()
  ctx.ellipse(CARD_WIDTH * 0.78, CARD_HEIGHT * 0.12, 280, 200, 0, 0, Math.PI * 2)
  ctx.fill()

  const panelX = 72
  const panelY = 200
  const panelW = CARD_WIDTH - panelX * 2
  const panelH = 880
  const radius = 28

  ctx.fillStyle = COLORS.surface
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 3
  roundRect(ctx, panelX, panelY, panelW, panelH, radius)
  ctx.fill()
  ctx.stroke()

  drawDecanterMark(ctx, panelX + 56, panelY + 56, 1.15)

  ctx.font = '700 52px Georgia, "Times New Roman", serif'
  const brandGrad = ctx.createLinearGradient(panelX + 90, panelY + 20, panelX + 320, panelY + 70)
  brandGrad.addColorStop(0, COLORS.goldSoft)
  brandGrad.addColorStop(1, COLORS.gold)
  ctx.fillStyle = brandGrad
  ctx.fillText(APP_NAME, panelX + 96, panelY + 64)

  ctx.font = '500 28px Inter, system-ui, sans-serif'
  ctx.fillStyle = COLORS.textMuted
  ctx.fillText(APP_TAGLINE, panelX + 96, panelY + 102)

  let y = panelY + 180
  const textX = panelX + 48
  const maxText = panelW - 96

  ctx.font = '700 64px Georgia, "Times New Roman", serif'
  ctx.fillStyle = COLORS.text
  const title = wine.vintage ? `${wine.name} ${wine.vintage}` : wine.name
  for (const line of wrapText(ctx, title, maxText)) {
    ctx.fillText(line, textX, y)
    y += 72
  }

  y += 12
  if (wine.winery.trim()) {
    ctx.font = '500 36px Inter, system-ui, sans-serif'
    ctx.fillStyle = COLORS.textMuted
    for (const line of wrapText(ctx, wine.winery, maxText)) {
      ctx.fillText(line, textX, y)
      y += 44
    }
  }

  const meta = [wine.type, wine.varietal, wine.region].filter(Boolean).join(' · ')
  if (meta) {
    y += 16
    ctx.font = '500 30px Inter, system-ui, sans-serif'
    ctx.fillStyle = COLORS.textMuted
    for (const line of wrapText(ctx, meta, maxText)) {
      ctx.fillText(line, textX, y)
      y += 38
    }
  }

  y += 36
  drawStars(ctx, textX, y, score, 44)
  ctx.font = '700 48px Inter, system-ui, sans-serif'
  ctx.fillStyle = COLORS.gold
  ctx.fillText(score.toFixed(1), textX + 5 * 44 + 4 * 15 + 24, y + 38)

  if (wine.notes.trim()) {
    y += 100
    ctx.font = 'italic 32px Georgia, "Times New Roman", serif'
    ctx.fillStyle = COLORS.textMuted
    const note = `"${wine.notes.trim()}"`
    for (const line of wrapText(ctx, note, maxText)) {
      ctx.fillText(line, textX, y)
      y += 42
    }
  }

  if (attribution) {
    ctx.font = '600 28px Inter, system-ui, sans-serif'
    ctx.fillStyle = COLORS.gold
    ctx.fillText(attribution, textX, panelY + panelH - 48)
  }

  ctx.font = '500 24px Inter, system-ui, sans-serif'
  ctx.fillStyle = COLORS.textMuted
  ctx.textAlign = 'center'
  ctx.fillText(`Shared from ${APP_NAME}`, CARD_WIDTH / 2, CARD_HEIGHT - 72)
  ctx.textAlign = 'left'

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not export share image.'))),
      'image/png',
      1,
    )
  })
}

export async function shareWineCard(input: ShareWineCardInput): Promise<'shared' | 'downloaded'> {
  const blob = await renderShareWineCard(input)
  const file = new File([blob], shareWineCardFilename(input.wine), { type: 'image/png' })
  const title = input.wine.vintage ? `${input.wine.name} ${input.wine.vintage}` : input.wine.name

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title,
      text: `${title} — ${input.score.toFixed(1)}★ on ${APP_NAME}`,
    })
    return 'shared'
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
