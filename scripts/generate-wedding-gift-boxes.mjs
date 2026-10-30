/**
 * Hộp mừng cưới chụp theo từng bộ.
 * Chạy: node scripts/generate-wedding-gift-boxes.mjs
 * Model: gpt-image-2, quality medium. Không in khóa API.
 */
import { config } from 'dotenv'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

config({ path: '.env' })
config({ path: '.env.local', override: true })

const REAL =
  'Studio photograph of one real square wedding gift box, three-quarter view, filling most of the frame. A real satin ribbon wraps the box and ties a full soft bow on the lid. Visible fabric or paper fibers, soft daylight, a faint shadow under the box only. The background is flat chroma magenta #FF00FF with no gradient and no floor. One box only. No extra gifts, no confetti, no people, no watermark. Not a cartoon, not an illustration, not clipart, not a flat icon, not watercolor, not a vector.'

const BOXES = {
  lacquer:
    'The box is wrapped in deep red silk with a lacquer sheen. The ribbon and bow are gold satin. A small gold double-happiness emblem 囍 sits centered on the front face.',
  linen:
    'The box is warm ivory cotton paper. The ribbon and bow are champagne silk. A tiny sprig of dried baby\'s breath is tucked under the bow. No emblem, no heart, no letters.',
  blush: 'The box is dusty-rose silk. The ribbon and bow are cream satin. No letters.',
  pearl: 'The box is ivory silk. The ribbon and bow are blush satin, with a few real pearls on the knot. No letters.',
  sky: 'The box is pale powder-blue paper. The ribbon and bow are dusty-rose satin. No letters.',
  sage: 'The box is sage-green linen. The ribbon and bow are cream silk. No letters.',
  wood: 'The box is deep forest-green paper. The ribbon and bow are ivory silk, with one small real green leaf at the knot. No letters.',
  lotus: 'The box is ivory paper. The ribbon and bow are soft gold satin, with one small real white lotus bud at the knot. No letters.',
  burgundy: 'The box is wine-burgundy silk. The ribbon and bow are champagne satin. No letters.',
  charcoal:
    'The box is matte charcoal paper, almost black. The ribbon and bow are warm gold satin. No letters, no emblem, no red.',
}

async function generate(prompt) {
  const key = (process.env.OPENAI_API_KEY || '').trim()
  if (key.length < 10) throw new Error('Thiếu OPENAI_API_KEY')
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 300000)
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-image-2',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'medium',
      }),
      signal: ac.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`)
    const json = await res.json()
    const b64 = json?.data?.[0]?.b64_json
    if (!b64) throw new Error('OpenAI không trả b64_json')
    return Buffer.from(b64, 'base64')
  } finally {
    clearTimeout(timer)
  }
}

function killMagenta(r, g, b) {
  const mag = Math.min(r, b) - g
  return g < 120 && r > 120 && b > 70 && mag > 28
}

async function keyAndCrop(raw) {
  const { data, info } = await sharp(raw).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  let pixels = Buffer.from(data)
  for (let i = 0; i < pixels.length; i += 4) {
    if (killMagenta(pixels[i], pixels[i + 1], pixels[i + 2])) pixels[i + 3] = 0
  }
  for (let pass = 0; pass < 3; pass += 1) {
    const next = Buffer.from(pixels)
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = (y * width + x) * 4
        if (pixels[i + 3] < 16) continue
        const mag = Math.min(pixels[i], pixels[i + 2]) - pixels[i + 1]
        if (pixels[i + 1] > 140 || mag < 14) continue
        let touch = false
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (pixels[((y + dy) * width + (x + dx)) * 4 + 3] < 16) touch = true
        }
        if (touch) next[i + 3] = 0
      }
    }
    pixels = next
  }
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] <= 20) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  const pad = 8
  const left = Math.max(0, minX - pad)
  const top = Math.max(0, minY - pad)
  const cropW = Math.min(width - left, maxX - minX + 1 + pad * 2)
  const cropH = Math.min(height - top, maxY - minY + 1 + pad * 2)
  return sharp(pixels, { raw: { width, height, channels: 4 } })
    .extract({ left, top, width: cropW, height: cropH })
    .webp({ quality: 86, alphaQuality: 100, effort: 4 })
    .toBuffer()
}

const dir = join('public', 'wedding', 'gifts')
mkdirSync(dir, { recursive: true })
const asked = process.argv.slice(2)
const ids = asked.length ? asked : Object.keys(BOXES)
for (const id of ids) {
  if (!BOXES[id]) {
    console.error(`Chưa có hộp "${id}". Có: ${Object.keys(BOXES).join(', ')}`)
    process.exit(1)
  }
}
let cursor = 0
async function worker() {
  while (cursor < ids.length) {
    const id = ids[cursor]
    cursor += 1
    console.log(`start ${id}`)
    const raw = await generate(`${BOXES[id]} ${REAL}`)
    const webp = await keyAndCrop(raw)
    writeFileSync(join(dir, `${id}.webp`), webp)
    console.log(`saved ${id} ${webp.length}`)
  }
}
await Promise.all([worker(), worker(), worker()])
console.log('done')
