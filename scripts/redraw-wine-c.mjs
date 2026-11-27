/**
 * Keep the hand-drawn splash droplets. A short uneven stream leaves the
 * lower droplet and meets the wine already in the glass. That wine stays
 * the letter. The upper droplet stays as drawn.
 *
 * Coordinates are authored on the 2000px light canvas.
 */
import sharp from 'sharp'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const brand = join(dirname(fileURLToPath(import.meta.url)), '../public/brand')

function tailBand(dy) {
  if (dy < 740 || dy > 828) return null
  const t = Math.max(0, (dy - 752) / 78)
  const cx = 810 - t * 18 + Math.sin(t * 2.2) * 2
  const half = 11 + t * 4
  return [
    Math.round(cx - half + Math.sin(dy * 0.57) * 1.3),
    Math.round(cx + half + Math.sin(dy * 0.38 + 0.8) * 1.3),
  ]
}

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function isWine(r, g, b, bg) {
  const dist = Math.hypot(r - bg[0], g - bg[1], b - bg[2])
  if (dist < 36) return false
  return r > 90 && r < 230 && g > 30 && g < 170 && b < 155 && r - g > 25 && r - b > 30
}

function isLine(r, g, b, bg, lightBg) {
  if (isWine(r, g, b, bg)) return false
  const dist = Math.hypot(r - bg[0], g - bg[1], b - bg[2])
  if (dist < 40) return false
  if (lightBg) return r < 90 && g < 90 && b < 90
  return r > 170 && g > 155 && b > 145
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

  const counts = new Map()
  for (let i = 0; i < px.length; i += 4) {
    if (!isWine(px[i], px[i + 1], px[i + 2], bg)) continue
    const key = `${px[i]},${px[i + 1]},${px[i + 2]}`
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const wine = (counts.size ? [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0] : '188,90,71')
    .split(',')
    .map(Number)
  const speckle = [
    Math.min(255, Math.round(wine[0] + (255 - wine[0]) * 0.62)),
    Math.min(255, Math.round(wine[1] + (255 - wine[1]) * 0.7)),
    Math.min(255, Math.round(wine[2] + (255 - wine[2]) * 0.7)),
  ]

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [dx, dy] = toDesign(x, y, scale, originX, originY)
      const band = tailBand(dy)
      if (!band) continue
      const [left, right] = band
      if (dx < left || dx > right) continue
      const i = (y * width + x) * 4
      const r = px[i]
      const g = px[i + 1]
      const b = px[i + 2]
      const line = isLine(r, g, b, bg, lightBg)
      if (isWine(r, g, b, bg)) continue
      if (dy >= 763 && line) continue
      const dist = Math.hypot(r - bg[0], g - bg[1], b - bg[2])
      if (dy < 752) {
        if (!line) continue
      } else if (dist > 32 && !line) continue
      const fleck =
        (Math.abs(dx - 804) <= 1 && Math.abs(dy - 786) <= 1) ||
        (Math.abs(dx - 794) <= 1 && Math.abs(dy - 808) <= 1)
      const color = fleck ? speckle : wine
      px[i] = color[0]
      px[i + 1] = color[1]
      px[i + 2] = color[2]
    }
  }

  await sharp(px, { raw: { width, height, channels: 4 } }).png().toFile(src)
  console.log(file, 'wine', wine.join(','))
}

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
    const distBg = Math.hypot(r - bg[0], g - bg[1], b - bg[2])
    if (distBg > 22 && r > 200 && g > 170 && r + 6 >= g && r + 6 >= b) {
      data[i] = 244
      data[i + 1] = 232
      data[i + 2] = 226
      data[i + 3] = 255
      continue
    }
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
  console.log('logo-red.png recolored from light master')
}

await redraw('logo-light.png', { scale: 1 })
await redraw('logo-navy.png', { scale: 1 })
const glassScale = 512 / 548
await redraw('decanti-glass.png', {
  scale: glassScale,
  originX: -588 * glassScale,
  originY: -638 * glassScale,
})
await writeRedFromLight()
