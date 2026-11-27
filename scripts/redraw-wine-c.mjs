/**
 * Rebuild the wordmark's wine so the slosh is one continuous C.
 * The glass outline stays; the two disconnected splash droplets are replaced
 * by the top arm of that C, crossing the rim without a gap.
 *
 * Coordinates are authored on the 2000px light/navy canvas.
 */
import sharp from 'sharp'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const brand = join(dirname(fileURLToPath(import.meta.url)), '../public/brand')

/** Centerline of the C, opening to the right. Top terminal is the slosh. */
const CENTERLINE = `M 920 792
  C 858 738, 798 768, 776 848
  C 752 938, 768 1016, 846 1056
  C 918 1092, 972 1050, 944 1004`

const STROKE = 84
const OUTLINE = 18

/** Bowl interior on the 2000px canvas, inset from the glass wall. */
const BOWL = [
  [755, 795],
  [720, 850],
  [698, 915],
  [696, 975],
  [720, 1035],
  [775, 1070],
  [860, 1078],
  [930, 1045],
  [970, 995],
  [978, 940],
  [968, 875],
  [935, 820],
  [888, 788],
  [810, 772],
  [755, 795],
]

function inPoly(x, y, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0]
    const yi = poly[i][1]
    const xj = poly[j][0]
    const yj = poly[j][1]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-6) + xi) inside = !inside
  }
  return inside
}

function allow(x, y) {
  if (inPoly(x, y, BOWL)) return true
  // Includes the old splash droplets, which sit above the new stroke.
  return y < 860 && y > 620 && x > 720 && x < 1020
}

function isWine(r, g, b, bg) {
  const dist = Math.hypot(r - bg[0], g - bg[1], b - bg[2])
  if (dist < 36) return false
  return r > 90 && r < 230 && g > 30 && g < 170 && b < 155 && r - g > 25 && r - b > 30
}

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

async function strokeLayer(width, height, scale, originX, originY, color, strokeWidth) {
  const svg = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <g transform="translate(${originX} ${originY}) scale(${scale})">
    <path d="${CENTERLINE}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`
  return sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer()
}

function toDesign(ix, iy, scale, originX, originY) {
  return [(ix - originX) / scale, (iy - originY) / scale]
}

async function redraw(file, { scale, originX = 0, originY = 0 }) {
  const src = join(brand, file)
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const px = Buffer.from(data)
  const bg = [px[0], px[1], px[2]]
  const lightBg = luminance(...bg) > 160

  const wineCounts = new Map()
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i]
    const g = px[i + 1]
    const b = px[i + 2]
    if (!isWine(r, g, b, bg)) continue
    const key = `${r},${g},${b}`
    wineCounts.set(key, (wineCounts.get(key) || 0) + 1)
  }
  const wineKey = [...wineCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '188,90,71'
  const wine = wineKey.split(',').map(Number)

  let inkR = 0
  let inkG = 0
  let inkB = 0
  let inkN = 0
  const isLine = (r, g, b) => {
    if (isWine(r, g, b, bg)) return false
    const dist = Math.hypot(r - bg[0], g - bg[1], b - bg[2])
    if (dist < 42) return false
    if (lightBg) return r < 90 && g < 90 && b < 90
    return r > 165 && g > 145 && b > 140
  }
  for (let i = 0; i < px.length; i += 16) {
    if (!isLine(px[i], px[i + 1], px[i + 2])) continue
    inkR += px[i]
    inkG += px[i + 1]
    inkB += px[i + 2]
    inkN++
  }
  const outline = inkN
    ? [Math.round(inkR / inkN), Math.round(inkG / inkN), Math.round(inkB / inkN)]
    : lightBg
      ? [20, 20, 20]
      : [247, 238, 241]

  const speckle = [
    Math.min(255, Math.round(wine[0] + (255 - wine[0]) * 0.55)),
    Math.min(255, Math.round(wine[1] + (255 - wine[1]) * 0.62)),
    Math.min(255, Math.round(wine[2] + (255 - wine[2]) * 0.62)),
  ]

  const wineHex = `rgb(${wine[0]},${wine[1]},${wine[2]})`
  const outlineHex = `rgb(${outline[0]},${outline[1]},${outline[2]})`
  const wineR = await strokeLayer(width, height, scale, originX, originY, wineHex, STROKE)
  const haloR = await strokeLayer(width, height, scale, originX, originY, outlineHex, STROKE + OUTLINE)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [dx, dy] = toDesign(x, y, scale, originX, originY)
      if (!allow(dx, dy)) continue
      const i = (y * width + x) * 4
      const drop = dy < 758 && dy > 620 && dx > 740 && dx < 1000
      if (!drop && isLine(px[i], px[i + 1], px[i + 2])) continue
      const dist = Math.hypot(px[i] - bg[0], px[i + 1] - bg[1], px[i + 2] - bg[2])
      const paintable = dist < 48 || isWine(px[i], px[i + 1], px[i + 2], bg) || drop
      if (!paintable) continue

      const wa = wineR[i + 3]
      const ha = haloR[i + 3]
      if (dy < 768 && wa < 200 && ha > 70) {
        px[i] = outline[0]
        px[i + 1] = outline[1]
        px[i + 2] = outline[2]
        px[i + 3] = 255
        continue
      }
      if (wa > 90) {
        px[i] = wine[0]
        px[i + 1] = wine[1]
        px[i + 2] = wine[2]
        px[i + 3] = 255
      } else if (drop || isWine(px[i], px[i + 1], px[i + 2], bg)) {
        px[i] = bg[0]
        px[i + 1] = bg[1]
        px[i + 2] = bg[2]
        px[i + 3] = 255
      }
    }
  }

  // Drop fragments the glass lines don't account for (leftover droplet pixels).
  const mark = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (px[i] === wine[0] && px[i + 1] === wine[1] && px[i + 2] === wine[2]) mark[y * width + x] = 1
    }
  }
  const seen = new Uint8Array(width * height)
  const stack = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x
      if (!mark[start] || seen[start]) continue
      const cells = []
      stack.push(start)
      seen[start] = 1
      while (stack.length) {
        const p = stack.pop()
        cells.push(p)
        const neighbors = [p - 1, p + 1, p - width, p + width, p - width - 1, p - width + 1, p + width - 1, p + width + 1]
        for (const q of neighbors) {
          if (q < 0 || q >= mark.length || seen[q] || !mark[q]) continue
          seen[q] = 1
          stack.push(q)
        }
      }
      if (cells.length < 80) {
        for (const p of cells) {
          const i = p * 4
          px[i] = bg[0]
          px[i + 1] = bg[1]
          px[i + 2] = bg[2]
        }
      }
    }
  }

  let seed = 19
  const rnd = () => {
    seed = (seed * 48271) % 2147483647
    return seed / 2147483647
  }
  const speckles = Math.round(120 * scale * scale)
  for (let n = 0; n < speckles; n++) {
    const dx = 760 + rnd() * 200
    const dy = 780 + rnd() * 280
    const x = Math.round(originX + dx * scale)
    const y = Math.round(originY + dy * scale)
    if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) continue
    const i = (y * width + x) * 4
    if (px[i] !== wine[0] || px[i + 1] !== wine[1]) continue
    px[i] = speckle[0]
    px[i + 1] = speckle[1]
    px[i + 2] = speckle[2]
  }

  await sharp(px, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(src)
  console.log(file, 'wine', wine.join(','), 'outline', outline.join(','), 'bg', bg.join(','))
}

const full = (file) => redraw(file, { scale: 1 })

await full('logo-light.png')
await redraw('logo-navy.png', { scale: 1 })
await writeRedFromLight()

/** 2000px red lockup, recolored from the light master so the wordmark stays sharp. */
async function writeRedFromLight() {
  const src = join(brand, 'logo-light.png')
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const burgundy = [18, 8, 12]
  const cream = [236, 227, 230]
  const bg = [255, 254, 250]
  const ink = [30, 30, 30]
  const bgLum = luminance(...bg)
  const inkLum = luminance(...ink)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    // Keep the terracotta wine and its light speckles.
    if (r > g + 8 && r > b + 8 && r > 120) continue
    const t = Math.min(1, Math.max(0, (bgLum - luminance(r, g, b)) / (bgLum - inkLum)))
    data[i] = Math.round(burgundy[0] + (cream[0] - burgundy[0]) * t)
    data[i + 1] = Math.round(burgundy[1] + (cream[1] - burgundy[1]) * t)
    data[i + 2] = Math.round(burgundy[2] + (cream[2] - burgundy[2]) * t)
    data[i + 3] = 255
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(join(brand, 'logo-red.png'))
  console.log('logo-red.png recolored from light master', info.width)
}

// decanti-glass.png is the bowl cropped out of the 2000px light lockup.
const glassScale = 512 / 548
await redraw('decanti-glass.png', {
  scale: glassScale,
  originX: -588 * glassScale,
  originY: -638 * glassScale,
})
