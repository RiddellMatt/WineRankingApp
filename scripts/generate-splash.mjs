/**
 * Replaces default Capacitor splash assets with Decanti branding (#12080c + wordmark).
 */
import sharp from 'sharp'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const logoPath = join(root, 'public/brand/logo-light.png')

const SPLASH_BG = '#12080c'
const LOGO_WIDTH_RATIO = 0.42

const iosSplashDir = join(root, 'ios/App/App/Assets.xcassets/Splash.imageset')

const androidTargets = [
  ['drawable', 480, 800],
  ['drawable-port-mdpi', 320, 480],
  ['drawable-port-hdpi', 480, 800],
  ['drawable-port-xhdpi', 720, 1280],
  ['drawable-port-xxhdpi', 1080, 1920],
  ['drawable-port-xxxhdpi', 1440, 2560],
  ['drawable-land-mdpi', 480, 320],
  ['drawable-land-hdpi', 800, 480],
  ['drawable-land-xhdpi', 1280, 720],
  ['drawable-land-xxhdpi', 1920, 1080],
  ['drawable-land-xxxhdpi', 2560, 1440],
]

async function composeSplash(width, height) {
  const logoWidth = Math.round(Math.min(width, height) * LOGO_WIDTH_RATIO)
  const logo = await sharp(logoPath)
    .resize(logoWidth, logoWidth, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer()

  const meta = await sharp(logo).metadata()
  const logoW = meta.width ?? logoWidth
  const logoH = meta.height ?? logoWidth
  const left = Math.round((width - logoW) / 2)
  const top = Math.round((height - logoH) / 2)

  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: SPLASH_BG,
    },
  })
    .composite([{ input: logo, left, top }])
    .png()
    .toBuffer()
}

async function writeIos() {
  mkdirSync(iosSplashDir, { recursive: true })
  const size = 2732
  const png = await composeSplash(size, size)
  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    await sharp(png).toFile(join(iosSplashDir, name))
  }
  const contents = JSON.parse(readFileSync(join(iosSplashDir, 'Contents.json'), 'utf8'))
  writeFileSync(join(iosSplashDir, 'Contents.json'), `${JSON.stringify(contents, null, 2)}\n`)
}

async function writeAndroid() {
  for (const [folder, w, h] of androidTargets) {
    const dir = join(root, `android/app/src/main/res/${folder}`)
    mkdirSync(dir, { recursive: true })
    const png = await composeSplash(w, h)
    await sharp(png).toFile(join(dir, 'splash.png'))
  }
}

await writeIos()
await writeAndroid()
console.log('Decanti splash assets written (iOS Splash.imageset + Android drawable/*).')
