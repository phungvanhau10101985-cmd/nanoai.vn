/**
 * Ảnh chụp cho giao diện thiệp Tre Việt Nam.
 * Chạy: node scripts/generate-wedding-tre-theme.mjs
 * Nền hoa tách bằng chroma magenta. Không in khóa API.
 */
import { config } from 'dotenv'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

config({ path: '.env' })
config({ path: '.env.local', override: true })

const REAL =
  'Studio photograph, natural daylight, visible paper fibers, leaf veins, and soft highlights. Not a cartoon, not an illustration, not clipart, not a flat icon, not watercolor, not a pencil drawing, not a vector.'

const ASSETS = {
  paper: {
    size: '1024x1536',
    prompt:
      `${REAL} One vertical sheet of warm ivory handmade rice paper filling the frame edge to edge. Real Vietnamese bamboo only in the four corners. The center is empty plain paper with no plants. Top left: a real bamboo culm and long slender leaves with parallel veins. Top right: a small spray of real bamboo flowers, pale cream-green spikelets, with a few bamboo leaves. Bottom left: another real bamboo leaf branch coming in from the edge. Bottom right: a smaller bamboo flower sprig. Plants look photographed on the paper. No text, no people, no frame, no pink border.`,
  },
  branch: {
    size: '1024x1024',
    prompt:
      `${REAL} One real bamboo branch lying on its side: a short green culm and six to eight long slender leaves with visible parallel veins. Natural overlap, not a potted plant. The background is flat chroma magenta #FF00FF with no gradient and no floor. No flowers, no text, no pot, no people.`,
  },
  bloom: {
    size: '1024x1024',
    prompt:
      `${REAL} One real bamboo blossom sprig: a thin green stem, clusters of small pale cream-green bamboo spikelet flowers, and two or three slender bamboo leaves with visible veins. The background is flat chroma magenta #FF00FF with no gradient and no floor. No text, no pot, no people, no ribbon.`,
  },
  gift: {
    size: '1024x1024',
    prompt:
      `${REAL} One real square wedding gift box, three-quarter view, filling most of the frame. Pale ivory cotton paper. A bamboo-green silk ribbon wraps the box and ties a full soft bow on the lid. One small real bamboo leaf sprig is tucked under the bow. A faint shadow sits under the box only. The background is flat chroma magenta #FF00FF with no gradient and no floor. One box only. No letters, no people, no confetti.`,
  },
}

function killMagenta(r, g, b) {
  const mag = Math.min(r, b) - g
  return g < 140 && r > 110 && b > 70 && mag > 24
}

async function generate(prompt, size) {
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
        size,
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

async function keyOut(raw) {
  const { data, info } = await sharp(raw).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  let pixels = Buffer.from(data)
  for (let i = 0; i < pixels.length; i += 4) {
    if (killMagenta(pixels[i], pixels[i + 1], pixels[i + 2])) pixels[i + 3] = 0
  }
  for (let pass = 0; pass < 4; pass += 1) {
    const next = Buffer.from(pixels)
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = (y * width + x) * 4
        if (pixels[i + 3] < 16) continue
        const mag = Math.min(pixels[i], pixels[i + 2]) - pixels[i + 1]
        if (pixels[i + 1] > 160 || mag < 12) continue
        let touch = false
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (pixels[((y + dy) * width + (x + dx)) * 4 + 3] < 16) touch = true
        }
        if (touch) next[i + 3] = 0
      }
    }
    pixels = next
  }
  let magenta = 0
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] > 20 && killMagenta(pixels[i], pixels[i + 1], pixels[i + 2])) magenta += 1
  }
  return { pixels, width, height, magenta }
}

function cropBox(pixels, width, height) {
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
  return {
    left,
    top,
    width: Math.min(width - left, maxX - minX + 1 + pad * 2),
    height: Math.min(height - top, maxY - minY + 1 + pad * 2),
  }
}

mkdirSync(join('public', 'wedding', 'backgrounds', 'ornaments'), { recursive: true })
mkdirSync(join('public', 'wedding', 'gifts'), { recursive: true })

const asked = process.argv.slice(2)
const ids = asked.length ? asked : ['paper', 'branch', 'bloom', 'gift']

for (const id of ids) {
  const asset = ASSETS[id]
  if (!asset) {
    console.error(`Chưa có "${id}". Có: ${Object.keys(ASSETS).join(', ')}`)
    process.exit(1)
  }
  console.log(`generating ${id}`)
  const raw = await generate(asset.prompt, asset.size)
  if (id === 'paper') {
    const jpeg = await sharp(raw).resize(1024, 1536, { fit: 'cover' }).jpeg({ quality: 86 }).toBuffer()
    const file = join('public', 'wedding', 'backgrounds', 'tre-viet-paper.jpg')
    writeFileSync(file, jpeg)
    console.log(`wrote ${file}`)
    continue
  }
  const keyed = await keyOut(raw)
  const box = cropBox(keyed.pixels, keyed.width, keyed.height)
  const png = await sharp(keyed.pixels, { raw: { width: keyed.width, height: keyed.height, channels: 4 } })
    .extract(box)
    .png()
    .toBuffer()
  const file =
    id === 'gift'
      ? join('public', 'wedding', 'gifts', 'tre.png')
      : join('public', 'wedding', 'backgrounds', 'ornaments', id === 'branch' ? 'tre-canh.png' : 'tre-hoa.png')
  if (id === 'gift') {
    const webp = await sharp(png).webp({ quality: 86, alphaQuality: 100, effort: 4 }).toBuffer()
    const giftFile = join('public', 'wedding', 'gifts', 'tre.webp')
    writeFileSync(giftFile, webp)
    console.log(`wrote ${giftFile} leftover-magenta=${keyed.magenta}`)
    continue
  }
  writeFileSync(file, png)
  console.log(`wrote ${file} ${box.width}x${box.height} leftover-magenta=${keyed.magenta}`)
}
