import { APP_NAME, APP_TAGLINE } from '../brand'
import {
  layoutForShareFormat,
  type ShareCardFormatId,
  shareCardFormatById,
} from './shareCardFormats'
import { hasTaste, lookupTaste } from '../tasteData'
import { TASTE_AXES, type TasteProfile, type Wine } from '../types'

export interface ShareWineCardInput {
  wine: Wine
  score: number
  /** e.g. "From Alex's cellar" — shown under the wine details. */
  attribution?: string
}

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

interface ShareTasteSection {
  taste: TasteProfile
  caption: string
  rows: { left: string; right: string; value: number }[]
}

function resolveShareTaste(wine: Wine, maxTasteRows: number): ShareTasteSection | null {
  const reference = lookupTaste(wine.varietal, wine.name, wine.type)
  const ownTaste = hasTaste(wine.taste)
  const taste = ownTaste ? wine.taste : reference.taste
  const isTypical = !ownTaste || wine.tasteSource === 'typical'

  const axes = TASTE_AXES.filter(
    (axis) => (!axis.sparklingOnly || wine.type === 'Sparkling') && taste[axis.key] != null,
  ).slice(0, maxTasteRows)

  if (axes.length === 0) return null

  const caption = isTypical
    ? `Typical ${reference.basedOn} profile`
    : 'How it tasted to me'

  return {
    taste,
    caption,
    rows: axes.map((axis) => ({
      left: axis.left,
      right: axis.right,
      value: taste[axis.key]!,
    })),
  }
}

function drawTasteSliderRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  left: string,
  right: string,
  value: number,
  scale: number,
): number {
  const labelW = Math.round(108 * scale)
  const trackX = x + labelW
  const trackW = width - labelW * 2
  const trackY = y + Math.round(14 * scale)
  const trackH = Math.round(10 * scale)

  ctx.font = `600 ${Math.round(22 * scale)}px Inter, system-ui, sans-serif`
  ctx.fillStyle = value < 50 ? COLORS.text : COLORS.textMuted
  ctx.textAlign = 'left'
  ctx.fillText(left, x, y + Math.round(22 * scale))

  ctx.fillStyle = value >= 50 ? COLORS.text : COLORS.textMuted
  ctx.textAlign = 'right'
  ctx.fillText(right, x + width, y + Math.round(22 * scale))
  ctx.textAlign = 'left'

  ctx.fillStyle = '#4a2c36'
  roundRect(ctx, trackX, trackY, trackW, trackH, trackH / 2)
  ctx.fill()

  const pillX = trackX + (value / 100) * trackW
  const pillR = Math.round(12 * scale)
  ctx.beginPath()
  ctx.fillStyle = COLORS.gold
  ctx.arc(pillX, trackY + trackH / 2, pillR, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = COLORS.goldSoft
  ctx.lineWidth = 2
  ctx.stroke()

  return y + Math.round(48 * scale)
}

function drawTasteSection(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  section: ShareTasteSection,
  scale: number,
): number {
  ctx.font = `600 ${Math.round(24 * scale)}px Inter, system-ui, sans-serif`
  ctx.fillStyle = COLORS.textMuted
  ctx.fillText(section.caption, x, y)
  y += Math.round(36 * scale)

  for (const row of section.rows) {
    y = drawTasteSliderRow(ctx, x, y, width, row.left, row.right, row.value, scale)
  }

  return y + Math.round(8 * scale)
}

function s(layout: ReturnType<typeof layoutForShareFormat>, px: number): number {
  return Math.round(px * layout.scale)
}

export function shareWineCardFilename(
  wine: Pick<Wine, 'name'>,
  formatId: ShareCardFormatId = 'instagram-post',
): string {
  const slug = slugify(wine.name) || 'wine'
  const suffix = shareCardFormatById(formatId).filenameSuffix
  return `decanti-${slug}-${suffix}.png`
}

/** Render a branded PNG card for the chosen platform aspect ratio. */
export async function renderShareWineCard(
  input: ShareWineCardInput,
  formatId: ShareCardFormatId = 'instagram-post',
): Promise<Blob> {
  const { wine, score, attribution } = input
  const layout = layoutForShareFormat(formatId)
  const { format, panelX, panelY, panelW, panelH } = layout
  const cardW = format.width
  const cardH = format.height

  const canvas = document.createElement('canvas')
  canvas.width = cardW
  canvas.height = cardH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create share image.')

  const bgGrad = ctx.createLinearGradient(0, 0, 0, cardH)
  bgGrad.addColorStop(0, COLORS.bgTop)
  bgGrad.addColorStop(1, COLORS.bgBottom)
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, cardW, cardH)

  ctx.fillStyle = 'rgba(196, 30, 58, 0.12)'
  ctx.beginPath()
  ctx.ellipse(cardW * 0.78, cardH * 0.12, 280, 200, 0, 0, Math.PI * 2)
  ctx.fill()

  const radius = s(layout, 28)

  ctx.fillStyle = COLORS.surface
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 3
  roundRect(ctx, panelX, panelY, panelW, panelH, radius)
  ctx.fill()
  ctx.stroke()

  drawDecanterMark(ctx, panelX + s(layout, 56), panelY + s(layout, 56), 1.15 * layout.scale)

  ctx.font = `700 ${s(layout, 52)}px Georgia, "Times New Roman", serif`
  const brandGrad = ctx.createLinearGradient(
    panelX + s(layout, 90),
    panelY + s(layout, 20),
    panelX + s(layout, 320),
    panelY + s(layout, 70),
  )
  brandGrad.addColorStop(0, COLORS.goldSoft)
  brandGrad.addColorStop(1, COLORS.gold)
  ctx.fillStyle = brandGrad
  ctx.fillText(APP_NAME, panelX + s(layout, 96), panelY + s(layout, 64))

  ctx.font = `500 ${s(layout, 28)}px Inter, system-ui, sans-serif`
  ctx.fillStyle = COLORS.textMuted
  ctx.fillText(APP_TAGLINE, panelX + s(layout, 96), panelY + s(layout, 102))

  let y = panelY + s(layout, 180)
  const textX = panelX + s(layout, 48)
  const maxText = panelW - s(layout, 96)

  ctx.font = `700 ${s(layout, 64)}px Georgia, "Times New Roman", serif`
  ctx.fillStyle = COLORS.text
  const title = wine.vintage ? `${wine.name} ${wine.vintage}` : wine.name
  for (const line of wrapText(ctx, title, maxText)) {
    ctx.fillText(line, textX, y)
    y += s(layout, 72)
  }

  y += s(layout, 12)
  if (wine.winery.trim()) {
    ctx.font = `500 ${s(layout, 36)}px Inter, system-ui, sans-serif`
    ctx.fillStyle = COLORS.textMuted
    for (const line of wrapText(ctx, wine.winery, maxText)) {
      ctx.fillText(line, textX, y)
      y += s(layout, 44)
    }
  }

  const meta = [wine.type, wine.varietal, wine.region].filter(Boolean).join(' · ')
  if (meta) {
    y += s(layout, 16)
    ctx.font = `500 ${s(layout, 30)}px Inter, system-ui, sans-serif`
    ctx.fillStyle = COLORS.textMuted
    for (const line of wrapText(ctx, meta, maxText)) {
      ctx.fillText(line, textX, y)
      y += s(layout, 38)
    }
  }

  y += s(layout, 36)
  const starSize = s(layout, 44)
  drawStars(ctx, textX, y, score, starSize)
  ctx.font = `700 ${s(layout, 48)}px Inter, system-ui, sans-serif`
  ctx.fillStyle = COLORS.gold
  ctx.fillText(score.toFixed(1), textX + 5 * starSize + 4 * 15 + 24, y + starSize - 6)

  const tasteSection = resolveShareTaste(wine, layout.maxTasteRows)
  if (tasteSection) {
    y += s(layout, 88)
    y = drawTasteSection(ctx, textX, y, maxText, tasteSection, layout.scale)
  }

  if (wine.notes.trim()) {
    y += tasteSection ? s(layout, 24) : s(layout, 100)
    ctx.font = `italic ${s(layout, 32)}px Georgia, "Times New Roman", serif`
    ctx.fillStyle = COLORS.textMuted
    const note = `"${wine.notes.trim()}"`
    const noteLines = wrapText(ctx, note, maxText)
    const linesToShow = tasteSection
      ? noteLines.slice(0, layout.maxNoteLinesWithTaste)
      : noteLines.slice(0, layout.maxNoteLinesNoTaste)
    for (const line of linesToShow) {
      ctx.fillText(line, textX, y)
      y += s(layout, 42)
    }
  }

  if (attribution) {
    ctx.font = `600 ${s(layout, 28)}px Inter, system-ui, sans-serif`
    ctx.fillStyle = COLORS.gold
    ctx.fillText(attribution, textX, panelY + panelH - s(layout, 48))
  }

  ctx.font = `500 ${s(layout, 24)}px Inter, system-ui, sans-serif`
  ctx.fillStyle = COLORS.textMuted
  ctx.textAlign = 'center'
  ctx.fillText(`Shared from ${APP_NAME}`, cardW / 2, cardH - s(layout, 72))
  ctx.textAlign = 'left'

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not export share image.'))),
      'image/png',
      1,
    )
  })
}

export async function shareWineCard(
  input: ShareWineCardInput,
  formatId: ShareCardFormatId = 'instagram-post',
): Promise<'shared' | 'downloaded'> {
  const { presentWineCardShareSheet } = await import('./shareWineCardPresent')
  return presentWineCardShareSheet(input, formatId)
}
