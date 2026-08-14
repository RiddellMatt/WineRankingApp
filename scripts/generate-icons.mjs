import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const SRC = new URL('./icon-source.svg', import.meta.url).pathname
const OUT = new URL('../public/icons/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const jobs = [
  ['pwa-192.png', 192],
  ['pwa-512.png', 512],
  ['apple-touch-icon.png', 180],
]

for (const [name, size] of jobs) {
  await sharp(SRC, { density: 300 }).resize(size, size).png().toFile(OUT + name)
  console.log('wrote', name)
}
