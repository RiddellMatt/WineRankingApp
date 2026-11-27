/**
 * Replace the two splash droplets with one small flat splash.
 * The wine already in the glass stays and is the letter. The new splash is
 * about the size of those two droplets, with no outline, and only closes
 * the gap at the top of the pool.
 *
 * Coordinates are authored on the 2000px light canvas.
 */
import sharp from 'sharp'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const brand = join(dirname(fileURLToPath(import.meta.url)), '../public/brand')

const SPLASH = `
  <ellipse cx="806" cy="736" rx="18" ry="24" fill="#fff"/>
  <ellipse cx="834" cy="708" rx="20" ry="18" fill="#fff"/>
  <ellipse cx="812" cy="786" rx="18" ry="44" fill="#fff"/>
`

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

async function raster(width, height, scale, originX, originY) {
  const svg = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <g transform="translate(${originX} ${originY}) scale(${scale})">
    ${SPLASH}
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

  const fill = await raster(width, height, scale, originX, originY)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [dx, dy] = toDesign(x, y, scale, originX, originY)
      if (!(dy > 648 && dy < 762 && dx > 760 && dx < 920)) continue
      const i = (y * width + x) * 4
      px[i] = bg[0]
      px[i + 1] = bg[1]
      px[i + 2] = bg[2]
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (fill[i + 3] < 110) continue
      if (isLine(px[i], px[i + 1], px[i + 2], bg, lightBg)) continue
      if (isWine(px[i], px[i + 1], px[i + 2], bg)) continue
      const dist = Math.hypot(px[i] - bg[0], px[i + 1] - bg[1], px[i + 2] - bg[2])
      if (dist > 42) continue
      const [dx, dy] = toDesign(x, y, scale, originX, originY)
      const speck = Math.abs(Math.sin(dx * 12.9898 + dy * 78.233) * 43758.5453) % 1 < 0.012
      const color = speck ? speckle : wine
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
