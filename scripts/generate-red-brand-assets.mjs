/**
 * Burgundy “Red” theme previews + red app-icon source (replaces blue navy art).
 */
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const brand = join(root, 'public/brand')
const resources = join(root, 'resources/app-icons')
const navySrc = join(resources, 'navy-source.jpg')
const redSource = join(resources, 'red-source.jpg')

const BURGUNDY = { r: 18, g: 8, b: 12 } // #12080c

function isNavyBackground(r, g, b) {
  return b > 70 && g > 35 && r < 55
}

async function navyToRedSource() {
  const { data, info } = await sharp(navySrc)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pixels = data
  for (let i = 0; i < pixels.length; i += info.channels) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    if (isNavyBackground(r, g, b)) {
      pixels[i] = BURGUNDY.r
      pixels[i + 1] = BURGUNDY.g
      pixels[i + 2] = BURGUNDY.b
    }
  }

  await sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .jpeg({ quality: 92 })
    .toFile(redSource)
}

await sharp(join(brand, 'logo-red.svg'))
  .resize(1024, 1024)
  .png()
  .toFile(join(brand, 'logo-red.png'))

await sharp(join(brand, 'logo-red.svg'))
  .resize(512, 512)
  .jpeg({ quality: 90 })
  .toFile(join(brand, 'theme-preview-red.jpg'))

await navyToRedSource()

await sharp(redSource)
  .rotate()
  .resize(256, 256, { fit: 'cover' })
  .jpeg({ quality: 88 })
  .toFile(join(brand, 'app-icon-red-preview.jpg'))

console.log('Red brand assets: logo-red.png, app-icon-red-preview.jpg, red-source.jpg')