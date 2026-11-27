/**
 * Build the Decanti lockups from the photographed wordmark.
 * The glass and the wine stay photographic. On the dark marks the
 * letters switch to the theme ink and the empty bowl shows the background.
 */
import sharp from 'sharp'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const brand = join(root, '../public/brand')
const photoPath = join(root, 'assets/decanti-photo.jpg')

const CANVAS = 2000
const CONTENT_WIDTH = 1860

const neutral = (r, g, b) => Math.abs(r - g) < 28 && Math.abs(r - b) < 28 && Math.abs(g - b) < 28
const isWine = (r, g, b) => r > g + 10 && r > b + 10 && r > 60
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b

function classify(data, width, height) {
  const n = width * height
  const light = new Uint8Array(n)
  const glass = new Uint8Array(n)
  const letter = new Uint8Array(n)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      const i = p * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const L = lum(r, g, b)
      const neu = neutral(r, g, b)
      const inLetters = y >= 200 && y <= 660 && ((x >= 190 && x <= 880) || (x >= 1260 && x <= 2310))
      if (isWine(r, g, b)) continue
      if (inLetters && neu && L < 60) {
        letter[p] = 1
        continue
      }
      if (neu && L >= 226) {
        light[p] = 1
        continue
      }
      if (Math.hypot(r - 255, g - 255, b - 255) > 16) glass[p] = 1
    }
  }
  const halo = new Uint8Array(n)
  const keep = new Uint8Array(n)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      if (letter[p]) {
        for (let dy = -4; dy <= 4; dy++) {
          for (let dx = -4; dx <= 4; dx++) {
            if (dx * dx + dy * dy > 16) continue
            const X = x + dx
            const Y = y + dy
            if (X < 0 || Y < 0 || X >= width || Y >= height) continue
            halo[Y * width + X] = 1
          }
        }
      }
      if (glass[p]) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const X = x + dx
            const Y = y + dy
            if (X < 0 || Y < 0 || X >= width || Y >= height) continue
            if (light[Y * width + X]) keep[Y * width + X] = 1
          }
        }
      }
    }
  }
  return { light, halo, keep }
}

function recolor(data, masks, bg, ink) {
  const { light, halo, keep } = masks
  const out = Buffer.from(data)
  for (let p = 0, i = 0; p < light.length; p++, i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (isWine(r, g, b)) continue
    if (halo[p] && neutral(r, g, b)) {
      const t = Math.min(1, Math.max(0, (lum(r, g, b) - 16) / 220))
      out[i] = Math.round(ink[0] + (bg[0] - ink[0]) * t)
      out[i + 1] = Math.round(ink[1] + (bg[1] - ink[1]) * t)
      out[i + 2] = Math.round(ink[2] + (bg[2] - ink[2]) * t)
      continue
    }
    if (light[p] && !keep[p]) {
      out[i] = bg[0]
      out[i + 1] = bg[1]
      out[i + 2] = bg[2]
    }
  }
  return out
}

function contentBox(data, width, height, pred) {
  let minx = width
  let miny = height
  let maxx = 0
  let maxy = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (!pred(data[i], data[i + 1], data[i + 2], x, y)) continue
      if (x < minx) minx = x
      if (y < miny) miny = y
      if (x > maxx) maxx = x
      if (y > maxy) maxy = y
    }
  }
  return { left: minx, top: miny, width: maxx - minx + 1, height: maxy - miny + 1 }
}

async function onCanvas(buffer, width, height, box, bg) {
  const scale = CONTENT_WIDTH / box.width
  const w = Math.round(box.width * scale)
  const h = Math.round(box.height * scale)
  const placed = await sharp(buffer, { raw: { width, height, channels: 4 } })
    .extract(box)
    .resize(w, h)
    .png()
    .toBuffer()
  return sharp({
    create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: bg[0], g: bg[1], b: bg[2], alpha: 1 } },
  })
    .composite([{ input: placed, left: Math.round((CANVAS - w) / 2), top: Math.round((CANVAS - h) / 2) }])
    .png()
    .toBuffer()
}

const { data, info } = await sharp(photoPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const { width, height } = info
const masks = classify(data, width, height)
const white = [255, 255, 255]
const foreground = (r, g, b) => Math.hypot(r - 255, g - 255, b - 255) > 18
const box = contentBox(data, width, height, foreground)
const pad = 8
box.left = Math.max(0, box.left - pad)
box.top = Math.max(0, box.top - pad)
box.width = Math.min(width - box.left, box.width + pad * 2)
box.height = Math.min(height - box.top, box.height + pad * 2)

const light = await onCanvas(data, width, height, box, white)
await sharp(light).png().toFile(join(brand, 'logo-light.png'))

const burgundy = [18, 8, 12]
const cream = [247, 238, 241]
const redPixels = recolor(data, masks, burgundy, cream)
await sharp(await onCanvas(redPixels, width, height, box, burgundy)).png().toFile(join(brand, 'logo-red.png'))

const navy = [15, 52, 115]
const navyPixels = recolor(data, masks, navy, white)
await sharp(await onCanvas(navyPixels, width, height, box, navy)).png().toFile(join(brand, 'logo-navy.png'))

const glassPixels = Buffer.from(data)
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const p = y * width + x
    if (!masks.halo[p]) continue
    const i = p * 4
    if (isWine(glassPixels[i], glassPixels[i + 1], glassPixels[i + 2])) continue
    if (!neutral(glassPixels[i], glassPixels[i + 1], glassPixels[i + 2])) continue
    glassPixels[i] = 255
    glassPixels[i + 1] = 255
    glassPixels[i + 2] = 255
  }
}
const glassBox = contentBox(glassPixels, width, height, foreground)
const side = Math.max(glassBox.width, glassBox.height) + 36
const gx = Math.max(0, Math.min(width - side, Math.round(glassBox.left + glassBox.width / 2 - side / 2)))
const gy = Math.max(0, Math.min(height - side, Math.round(glassBox.top + glassBox.height / 2 - side / 2)))
await sharp(glassPixels, { raw: { width, height, channels: 4 } })
  .extract({ left: gx, top: gy, width: Math.min(side, width - gx), height: Math.min(side, height - gy) })
  .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .png()
  .toFile(join(brand, 'decanti-glass.png'))

console.log('photo lockups written', box)
