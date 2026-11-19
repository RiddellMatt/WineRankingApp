/**
 * Crop the square theme canvases to the Decanti wordmark and drop the
 * background so the header can scale the label without the empty padding.
 */
import sharp from 'sharp'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const brand = join(dirname(fileURLToPath(import.meta.url)), '../public/brand')

function knockOut(data, bg, threshold, fade) {
  const out = Buffer.from(data)
  for (let i = 0; i < out.length; i += 4) {
    const dist = Math.hypot(out[i] - bg[0], out[i + 1] - bg[1], out[i + 2] - bg[2])
    let alpha = 255
    if (dist <= threshold) alpha = 0
    else if (dist < threshold + fade) alpha = Math.round((255 * (dist - threshold)) / fade)
    out[i + 3] = Math.min(out[i + 3], alpha)
  }
  return out
}

async function wordmark(src, dest, bg, threshold, fade, pad) {
  const { data, info } = await sharp(src)
    .trim({ threshold: 12 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  await sharp(knockOut(data, bg, threshold, fade), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(dest)
}

await wordmark(join(brand, 'logo-red.png'), join(brand, 'wordmark-red.png'), [18, 8, 12], 18, 28, 8)
await wordmark(
  join(brand, 'logo-light.png'),
  join(brand, 'wordmark-light.png'),
  [255, 254, 250],
  14,
  26,
  12,
)

console.log('Wrote wordmark-red.png and wordmark-light.png')
