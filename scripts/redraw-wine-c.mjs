/**
 * Join the two splash droplets into one loose, hand-drawn slosh.
 * The wine already in the glass is left as it was. The new pour is the
 * same kind of uneven blob as those droplets, hooked enough to read as a C,
 * and it runs back into the wine so the rim does not cut it off.
 *
 * Coordinates are authored on the 2000px light canvas.
 */
import sharp from 'sharp'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const brand = join(dirname(fileURLToPath(import.meta.url)), '../public/brand')

const SLOSH = `M 768 920
  C 746 860, 758 800, 798 752
  C 832 712, 878 684, 916 708
  C 948 728, 930 766, 892 784
  C 856 802, 834 850, 822 900
  C 812 940, 786 944, 768 920 Z`

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function isWine(r, g, b, bg) {
  const dist = Math.hypot(r - bg[0], g - bg[1], b - bg[2])
  if (dist < 36) return false
  return r > 90 && r < 230 && g > 30 && g < 170 && b < 155 && r - g > 25 && r - b > 30
}

async function strokeLayer(width, height, scale, originX, originY, color, strokeWidth, fill) {
  const svg = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <g transform="translate(${originX} ${originY}) scale(${scale})">
    <path d="${SLOSH}" fill="${fill ? color : 'none'}" stroke="${fill ? 'none' : color}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round"/>
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
  const outline = lightBg ? [20, 20, 20] : [248, 244, 240]
  const speckle = [
    Math.min(255, Math.round(wine[0] + (255 - wine[0]) * 0.55)),
    Math.min(255, Math.round(wine[1] + (255 - wine[1]) * 0.62)),
    Math.min(255, Math.round(wine[2] + (255 - wine[2]) * 0.62)),
  ]

  const wineHex = `rgb(${wine[0]},${wine[1]},${wine[2]})`
  const outlineHex = `rgb(${outline[0]},${outline[1]},${outline[2]})`
  const fill = await strokeLayer(width, height, scale, originX, originY, wineHex, 0, true)
  const halo = await strokeLayer(width, height, scale, originX, originY, outlineHex, 11, false)

  const isLine = (r, g, b) => {
    if (isWine(r, g, b, bg)) return false
    const dist = Math.hypot(r - bg[0], g - bg[1], b - bg[2])
    if (dist < 40) return false
    if (lightBg) return r < 90 && g < 90 && b < 90
    return r > 170 && g > 155 && b > 145
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [dx, dy] = toDesign(x, y, scale, originX, originY)
      if (!(dy > 630 && dy < 760 && dx > 740 && dx < 980)) continue
      const i = (y * width + x) * 4
      px[i] = bg[0]
      px[i + 1] = bg[1]
      px[i + 2] = bg[2]
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [dx, dy] = toDesign(x, y, scale, originX, originY)
      const i = (y * width + x) * 4
      if (isLine(px[i], px[i + 1], px[i + 2])) continue
      const fa = fill[i + 3]
      const ha = halo[i + 3]
      if (dy < 772 && ha > 80 && fa < 200 && px[i] > (lightBg ? 180 : 0)) {
        const dist = Math.hypot(px[i] - bg[0], px[i + 1] - bg[1], px[i + 2] - bg[2])
        if (dist < 50) {
          px[i] = outline[0]
          px[i + 1] = outline[1]
          px[i + 2] = outline[2]
          continue
        }
      }
      if (fa > 100) {
        const dist = Math.hypot(px[i] - bg[0], px[i + 1] - bg[1], px[i + 2] - bg[2])
        if (dist < 55 || isWine(px[i], px[i + 1], px[i + 2], bg)) {
          px[i] = wine[0]
          px[i + 1] = wine[1]
          px[i + 2] = wine[2]
        }
      }
    }
  }

  const specks = [
    [836, 706],
    [868, 688],
    [900, 724],
    [852, 742],
  ]
  for (const [sx, sy] of specks) {
    const x = Math.round(originX + sx * scale)
    const y = Math.round(originY + sy * scale)
    if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) continue
    const i = (y * width + x) * 4
    if (px[i] !== wine[0] || px[i + 1] !== wine[1]) continue
    px[i] = speckle[0]
    px[i + 1] = speckle[1]
    px[i + 2] = speckle[2]
  }

  await sharp(px, { raw: { width, height, channels: 4 } }).png().toFile(src)
  console.log(file, 'wine', wine.join(','), 'outline', outline.join(','))
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
