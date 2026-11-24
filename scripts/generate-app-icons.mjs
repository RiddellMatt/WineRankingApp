/**
 * Generates iOS App Icon sets, Android launcher PNGs, and web icons from
 * resources/app-icons/white-source.jpg and navy-source.jpg
 */
import sharp from 'sharp'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const whiteSrc = join(root, 'resources/app-icons/white-source.jpg')
const navySrc = join(root, 'resources/app-icons/navy-source.jpg')
const redSrc = join(root, 'resources/app-icons/red-source.jpg')

const iosWhite = join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset')
const iosNavy = join(root, 'ios/App/App/Assets.xcassets/AppIconNavy.appiconset')
const webIcons = join(root, 'public/icons')
const brand = join(root, 'public/brand')

const androidDensities = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
}

/** Adaptive foreground canvas is 108dp. Artwork stays inside the 66dp safe zone. */
const androidAdaptive = {
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432,
}

function iosContents(filename) {
  return JSON.stringify(
    {
      images: [
        {
          filename,
          idiom: 'universal',
          platform: 'ios',
          size: '1024x1024',
        },
      ],
      info: { author: 'xcode', version: 1 },
    },
    null,
    2,
  )
}

async function square1024(src, outPath) {
  await sharp(src).rotate().resize(1024, 1024, { fit: 'cover' }).png().toFile(outPath)
}

async function androidSet(src, baseName) {
  for (const [folder, size] of Object.entries(androidDensities)) {
    const dir = join(root, `android/app/src/main/res/mipmap-${folder}`)
    mkdirSync(dir, { recursive: true })
    const png = await sharp(src).rotate().resize(size, size, { fit: 'cover' }).png().toBuffer()
    await sharp(png).toFile(join(dir, `${baseName}.png`))
    if (baseName === 'ic_launcher') {
      await sharp(png).toFile(join(dir, 'ic_launcher_round.png'))
    }
  }
}

async function androidAdaptiveForeground(src, baseName) {
  for (const [folder, size] of Object.entries(androidAdaptive)) {
    const dir = join(root, `android/app/src/main/res/mipmap-${folder}`)
    mkdirSync(dir, { recursive: true })
    const inner = Math.round(size * (66 / 108))
    const artwork = await sharp(src).rotate().resize(inner, inner, { fit: 'cover' }).png().toBuffer()
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: artwork, gravity: 'centre' }])
      .png()
      .toFile(join(dir, `${baseName}.png`))
  }
}

mkdirSync(iosWhite, { recursive: true })
mkdirSync(iosNavy, { recursive: true })
mkdirSync(webIcons, { recursive: true })
mkdirSync(brand, { recursive: true })

await square1024(whiteSrc, join(iosWhite, 'AppIcon-512@2x.png'))
writeFileSync(join(iosWhite, 'Contents.json'), iosContents('AppIcon-512@2x.png'))

const alternateIconSrc = existsSync(redSrc) ? redSrc : navySrc

await square1024(alternateIconSrc, join(iosNavy, 'AppIconNavy-1024.png'))
writeFileSync(join(iosNavy, 'Contents.json'), iosContents('AppIconNavy-1024.png'))

await androidSet(whiteSrc, 'ic_launcher')
await androidSet(alternateIconSrc, 'ic_launcher_navy')
await androidAdaptiveForeground(whiteSrc, 'ic_launcher_foreground')
await androidAdaptiveForeground(alternateIconSrc, 'ic_launcher_navy_foreground')

for (const [name, size, src] of [
  ['pwa-192.png', 192, whiteSrc],
  ['pwa-512.png', 512, whiteSrc],
  ['apple-touch-icon.png', 180, whiteSrc],
  ['pwa-192-navy.png', 192, alternateIconSrc],
  ['pwa-512-navy.png', 512, alternateIconSrc],
  ['apple-touch-icon-navy.png', 180, alternateIconSrc],
]) {
  await sharp(src).rotate().resize(size, size, { fit: 'cover' }).png().toFile(join(webIcons, name))
}

await sharp(whiteSrc).rotate().resize(256, 256, { fit: 'cover' }).jpeg({ quality: 88 }).toFile(join(brand, 'app-icon-white-preview.jpg'))
await sharp(alternateIconSrc)
  .rotate()
  .resize(256, 256, { fit: 'cover' })
  .jpeg({ quality: 88 })
  .toFile(join(brand, 'app-icon-red-preview.jpg'))

console.log('App icons generated.')
