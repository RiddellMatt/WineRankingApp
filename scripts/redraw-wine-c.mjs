/**
 * The wine in the bowl stays. The splash above the rim is a generated sheet
 * that climbs out of the glass and breaks into a ragged crest. It is
 * composited under the existing ink, in the mark's own wine color.
 *
 * Coordinates are authored on the 2000px light canvas. Run this on the
 * original mark (the pool and the two droplets still in place).
 */
import sharp from 'sharp'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const brand = join(root, '../public/brand')
const sheetPath = join(root, 'assets/wine-in-glass.jpg')

const DESIGN = 2000

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

function isSpeckle(r, g, b, bg) {
  const dist = Math.hypot(r - bg[0], g - bg[1], b - bg[2])
  return dist > 22 && r > 200 && g > 170 && r + 6 >= g && r + 6 >= b
}

function toDesign(ix, iy, scale, originX, originY) {
  return [(ix - originX) / scale, (iy - originY) / scale]
}

function dilate(src, w, h, r) {
  const out = new Uint8Array(src)
  const r2 = r * r
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!src[y * w + x]) continue
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r2) continue
          const X = x + dx
          const Y = y + dy
          if (X < 0 || Y < 0 || X >= w || Y >= h) continue
          out[Y * w + X] = 1
        }
      }
    }
  }
  return out
}

function erode(src, w, h, r) {
  const out = new Uint8Array(w * h)
  const r2 = r * r
  for (let y = r; y < h - r; y++) {
    for (let x = r; x < w - r; x++) {
      let ok = 1
      for (let dy = -r; dy <= r && ok; dy++) {
        for (let dx = -r; dx <= r && ok; dx++) {
          if (dx * dx + dy * dy > r2) continue
          if (!src[(y + dy) * w + (x + dx)]) ok = 0
        }
      }
      if (ok) out[y * w + x] = 1
    }
  }
  return out
}

function fillHoles(mask, w, h, maxArea) {
  const seen = new Uint8Array(w * h)
  const q = []
  const push = (x, y) => {
    const i = y * w + x
    if (seen[i] || mask[i]) return
    seen[i] = 1
    q.push(i)
  }
  for (let x = 0; x < w; x++) {
    push(x, 0)
    push(x, h - 1)
  }
  for (let y = 0; y < h; y++) {
    push(0, y)
    push(w - 1, y)
  }
  const dirs = [1, -1, w, -w]
  while (q.length) {
    const i = q.pop()
    for (const d of dirs) {
      const j = i + d
      if (j < 0 || j >= w * h || seen[j] || mask[j]) continue
      if (d === 1 && i % w === w - 1) continue
      if (d === -1 && i % w === 0) continue
      seen[j] = 1
      q.push(j)
    }
  }
  const hole = new Uint8Array(w * h)
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] && !seen[i]) hole[i] = 1
  }
  const used = new Uint8Array(w * h)
  for (let i = 0; i < hole.length; i++) {
    if (!hole[i] || used[i]) continue
    const comp = [i]
    used[i] = 1
    for (let k = 0; k < comp.length; k++) {
      const p = comp[k]
      for (const d of dirs) {
        const j = p + d
        if (j < 0 || j >= w * h || used[j] || !hole[j]) continue
        if (d === 1 && p % w === w - 1) continue
        if (d === -1 && p % w === 0) continue
        used[j] = 1
        comp.push(j)
      }
    }
    if (comp.length > maxArea) continue
    for (const j of comp) mask[j] = 1
  }
}

async function sheetMask() {
  const gen = await sharp(sheetPath).resize(800, 800).ensureAlpha().raw().toBuffer()
  const gw = 800
  const wine = Buffer.alloc(gw * gw * 4)
  for (let i = 0, p = 0; i < gen.length; i += 4, p++) {
    const r = gen[i]
    const g = gen[i + 1]
    const b = gen[i + 2]
    const terracotta = r > 140 && r < 235 && g > 45 && g < 185 && b < 155 && r - g > 18 && r - b > 22
    if (!terracotta) continue
    const dist = Math.min(255, Math.hypot(r - 255, g - 255, b - 255))
    wine[p * 4 + 3] = Math.max(0, Math.min(255, (dist - 18) * 8))
  }
  const contentW = Math.round(560 * (800 / 780))
  const padX = Math.round((800 - contentW) / 2)
  const placed = await sharp(wine, { raw: { width: gw, height: gw, channels: 4 } })
    .extract({ left: padX, top: 0, width: contentW, height: 800 })
    .resize(560, 780)
    .ensureAlpha()
    .raw()
    .toBuffer()

  const mask = new Uint8Array(DESIGN * DESIGN)
  const ox = 600
  const oy = 620
  for (let y = 0; y < 780; y++) {
    for (let x = 0; x < 560; x++) {
      if (placed[(y * 560 + x) * 4 + 3] > 90) mask[(y + oy) * DESIGN + (x + ox)] = 1
    }
  }
  const closed = erode(dilate(mask, DESIGN, DESIGN, 7), DESIGN, DESIGN, 6)
  fillHoles(closed, DESIGN, DESIGN, 400)
  for (let x = 800; x < 990; x++) {
    let prev = -1
    for (let y = 730; y < 860; y++) {
      if (!closed[y * DESIGN + x]) continue
      if (prev > 0 && y - prev > 1 && y - prev <= 14) {
        for (let y2 = prev + 1; y2 < y; y2++) closed[y2 * DESIGN + x] = 1
      }
      prev = y
    }
  }
  return closed
}

async function redraw(file, mask, { scale, originX = 0, originY = 0 }) {
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

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [dx, dy] = toDesign(x, y, scale, originX, originY)
      if (!(dy < 768 && dx > 720 && dx < 1040)) continue
      const i = (y * width + x) * 4
      px[i] = bg[0]
      px[i + 1] = bg[1]
      px[i + 2] = bg[2]
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [dx, dy] = toDesign(x, y, scale, originX, originY)
      const mx = Math.round(dx)
      const my = Math.round(dy)
      if (mx < 0 || my < 0 || mx >= DESIGN || my >= DESIGN) continue
      if (!mask[my * DESIGN + mx]) continue
      const i = (y * width + x) * 4
      const r = px[i]
      const g = px[i + 1]
      const b = px[i + 2]
      if (isLine(r, g, b, bg, lightBg)) continue
      if (isWine(r, g, b, bg) || isSpeckle(r, g, b, bg)) continue
      const dist = Math.hypot(r - bg[0], g - bg[1], b - bg[2])
      if (dist > 50) continue
      px[i] = wine[0]
      px[i + 1] = wine[1]
      px[i + 2] = wine[2]
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

const mask = await sheetMask()
await redraw('logo-light.png', mask, { scale: 1 })
await redraw('logo-navy.png', mask, { scale: 1 })
const glassScale = 512 / 548
await redraw('decanti-glass.png', mask, {
  scale: glassScale,
  originX: -588 * glassScale,
  originY: -638 * glassScale,
})
await writeRedFromLight()
