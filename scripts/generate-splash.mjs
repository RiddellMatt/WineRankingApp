/**
 * Native splash: theme-matched Decanti wordmark, not the wine-glass mark.
 * Classic burgundy matches the in-app launch overlay and the iOS webview underlay.
 */
import sharp from 'sharp'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const wordmarkPath = join(root, 'public/brand/wordmark-red.png')

const SPLASH_BG = '#12080c'

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

function markWidthFor(width, height) {
  const shorter = Math.min(width, height)
  const longer = Math.max(width, height)
  const square = longer / shorter < 1.15
  // Square iOS splash is aspect-filled, so only the center strip is visible on a phone.
  const ratio = square ? 0.38 : 0.78
  return Math.round(shorter * ratio)
}

async function composeSplash(width, height) {
  const targetWidth = markWidthFor(width, height)
  const mark = await sharp(wordmarkPath)
    .resize({ width: targetWidth, fit: 'inside' })
    .png()
    .toBuffer()

  const meta = await sharp(mark).metadata()
  const markW = meta.width ?? targetWidth
  const markH = meta.height ?? Math.round(targetWidth / 2.4)
  const left = Math.round((width - markW) / 2)
  const top = Math.round((height - markH) / 2)

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: SPLASH_BG,
    },
  })
    .composite([{ input: mark, left, top }])
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

async function writeSplashIcon() {
  const canvas = 960
  // Centered so a circular Android 12 mask still shows the whole word.
  const word = await sharp(wordmarkPath).resize({ width: 530, fit: 'inside' }).png().toBuffer()
  const dir = join(root, 'android/app/src/main/res/drawable-nodpi')
  mkdirSync(dir, { recursive: true })
  await sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: word, gravity: 'center' }])
    .png()
    .toFile(join(dir, 'splash_icon.png'))
}

await writeIos()
await writeAndroid()
await writeSplashIcon()
console.log('Decanti splash assets written (wordmark on burgundy).')
