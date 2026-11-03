/**
 * Bốn khung lá khô chụp thật, nằm ngang, lỗ theo mép lá.
 * Chạy: node scripts/generate-wedding-dry-leaf-frames.mjs [id ...]
 * Không in khóa API.
 */
import { config } from 'dotenv'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

config({ path: '.env' })
config({ path: '.env.local', override: true })

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'wedding', 'covers')
const REAL =
  'Studio photograph of one real dried leaf, natural daylight, papery dry texture, a clear midrib and a full network of side veins, thin translucent patches, soft highlights. Photographed specimen, not a drawing. Not a cartoon, not an illustration, not clipart, not a flat icon, not watercolor, not a pencil drawing, not a vector, not a painting, not a sticker.'
const MAGENTA =
  'The background is flat chroma magenta #FF00FF with no gradient and no floor. No text, no pot, no vase, no people, no flowers, no other leaves. No pink border.'
const POSE =
  'The leaf lies horizontally, landscape, filling most of the frame. Petiole on the left, tip on the right. One whole intact leaf. Do not cut a hole. Do not punch the center.'

const ITEMS = [
  {
    id: 'la-bau-duc',
    prompt: `${REAL} A real dried oval magnolia leaf, wine-burgundy and rust, leathery, raised veins like a skeleton. ${POSE} ${MAGENTA}`,
  },
  {
    id: 'la-bau-duc-sen',
    prompt: `${REAL} A real dried oval camellia or loquat leaf, gold-amber and honey brown, glossy dry surface, strong midrib and pinna veins. ${POSE} ${MAGENTA}`,
  },
  {
    id: 'la-bau-duc-ngoc',
    prompt: `${REAL} A real dried serrated rose leaf, copper-blush and tea-brown, crisp papery edge teeth, every vein visible. ${POSE} ${MAGENTA}`,
  },
  {
    id: 'la-bau-duc-xanh',
    prompt: `${REAL} A real dried oval olive or eucalyptus leaf, khaki-olive fading to tan, waxy dry bloom, parallel side veins. ${POSE} ${MAGENTA}`,
  },
]

function killMagenta(r, g, b) {
  if (g >= 48) return false
  const mag = Math.min(r, b) - g
  return r > 140 && b > 140 && mag > 30
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
      body: JSON.stringify({ model: 'gpt-image-2', prompt, n: 1, size: '1536x1024', quality: 'high' }),
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
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          if (pixels[((y + dy) * width + (x + dx)) * 4 + 3] < 16) touch = true
        }
        if (touch) next[i + 3] = 0
      }
    }
    pixels = next
  }
  return { pixels, width, height }
}

function bbox(pixels, width, height) {
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
  const pad = 12
  const left = Math.max(0, minX - pad)
  const top = Math.max(0, minY - pad)
  return {
    left,
    top,
    width: Math.min(width - left, maxX - minX + 1 + pad * 2),
    height: Math.min(height - top, maxY - minY + 1 + pad * 2),
  }
}

function leafMask(pixels, width, height) {
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < mask.length; i += 1) mask[i] = pixels[i * 4 + 3] > 20 ? 1 : 0
  return mask
}

function distanceFromEdge(mask, width, height) {
  const inf = width + height
  const dist = new Float64Array(width * height)
  for (let i = 0; i < mask.length; i += 1) dist[i] = mask[i] ? inf : 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x
      if (!mask[i]) continue
      let best = dist[i]
      if (x > 0) best = Math.min(best, dist[i - 1] + 1)
      if (y > 0) best = Math.min(best, dist[i - width] + 1)
      if (x > 0 && y > 0) best = Math.min(best, dist[i - width - 1] + Math.SQRT2)
      if (x + 1 < width && y > 0) best = Math.min(best, dist[i - width + 1] + Math.SQRT2)
      dist[i] = best
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const i = y * width + x
      if (!mask[i]) continue
      let best = dist[i]
      if (x + 1 < width) best = Math.min(best, dist[i + 1] + 1)
      if (y + 1 < height) best = Math.min(best, dist[i + width] + 1)
      if (x + 1 < width && y + 1 < height) best = Math.min(best, dist[i + width + 1] + Math.SQRT2)
      if (x > 0 && y + 1 < height) best = Math.min(best, dist[i + width - 1] + Math.SQRT2)
      dist[i] = best
    }
  }
  return dist
}

function punchLeafHole(pixels, width, height) {
  const mask = leafMask(pixels, width, height)
  const dist = distanceFromEdge(mask, width, height)
  let maxInside = 0
  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i] && dist[i] > maxInside && Number.isFinite(dist[i])) maxInside = dist[i]
  }
  const rim = Math.max(36, Math.round(maxInside * 0.28))
  const feather = 2.4
  const shade = 6
  const next = Buffer.from(pixels)
  let holeMinX = width
  let holeMinY = height
  let holeMaxX = 0
  let holeMaxY = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x
      if (!mask[i]) continue
      const d = dist[i]
      const px = i * 4
      if (d >= rim) {
        next[px + 3] = 0
        if (x < holeMinX) holeMinX = x
        if (y < holeMinY) holeMinY = y
        if (x > holeMaxX) holeMaxX = x
        if (y > holeMaxY) holeMaxY = y
        continue
      }
      const edge = rim - d
      if (edge < feather) next[px + 3] = Math.round(next[px + 3] * (edge / feather))
      if (edge < shade) {
        const k = 1 - (1 - edge / shade) * 0.22
        next[px] = Math.round(next[px] * k)
        next[px + 1] = Math.round(next[px + 1] * k)
        next[px + 2] = Math.round(next[px + 2] * k)
      }
    }
  }
  return {
    pixels: next,
    hole: {
      x: (holeMinX / width) * 100,
      y: (holeMinY / height) * 100,
      w: ((holeMaxX - holeMinX + 1) / width) * 100,
      h: ((holeMaxY - holeMinY + 1) / height) * 100,
    },
    width,
    height,
  }
}

function roundPct(n) {
  return Math.round(n * 100) / 100
}

async function processLeaf(id, raw) {
  const keyed = await keyOut(raw)
  let oriented = { pixels: keyed.pixels, width: keyed.width, height: keyed.height }
  const box0 = bbox(oriented.pixels, oriented.width, oriented.height)
  if (box0.height > box0.width) {
    const png = await sharp(oriented.pixels, {
      raw: { width: oriented.width, height: oriented.height, channels: 4 },
    })
      .rotate(90)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    oriented = { pixels: png.data, width: png.info.width, height: png.info.height }
  }
  const box = bbox(oriented.pixels, oriented.width, oriented.height)
  const leaf = await sharp(oriented.pixels, {
    raw: { width: oriented.width, height: oriented.height, channels: 4 },
  })
    .extract(box)
    .raw()
    .toBuffer({ resolveWithObject: true })
  const fullPng = await sharp(leaf.data, {
    raw: { width: leaf.info.width, height: leaf.info.height, channels: 4 },
  }).png().toBuffer()
  writeFileSync(path.join(outDir, `${id}-full.png`), fullPng)
  const punched = punchLeafHole(leaf.data, leaf.info.width, leaf.info.height)
  const maskRgba = Buffer.alloc(leaf.info.width * leaf.info.height * 4)
  for (let i = 0; i < leaf.info.width * leaf.info.height; i += 1) {
    maskRgba[i * 4] = 255
    maskRgba[i * 4 + 1] = 255
    maskRgba[i * 4 + 2] = 255
    maskRgba[i * 4 + 3] = leaf.data[i * 4 + 3]
  }
  const framePng = await sharp(punched.pixels, {
    raw: { width: punched.width, height: punched.height, channels: 4 },
  }).png().toBuffer()
  const maskPng = await sharp(maskRgba, {
    raw: { width: leaf.info.width, height: leaf.info.height, channels: 4 },
  }).png().toBuffer()
  writeFileSync(path.join(outDir, `${id}-frame.png`), framePng)
  writeFileSync(path.join(outDir, `${id}-frame.webp`), await sharp(framePng).webp({ quality: 86, alphaQuality: 90 }).toBuffer())
  writeFileSync(path.join(outDir, `${id}-mask.webp`), await sharp(maskPng).webp({ quality: 80, alphaQuality: 90 }).toBuffer())
  return {
    src: `/wedding/covers/${id}-frame.webp`,
    mask: `/wedding/covers/${id}-mask.webp`,
    hole: {
      x: roundPct(punched.hole.x),
      y: roundPct(punched.hole.y),
      w: roundPct(punched.hole.w),
      h: roundPct(punched.hole.h),
    },
    aspect: `${punched.width} / ${punched.height}`,
  }
}

mkdirSync(outDir, { recursive: true })
const asked = process.argv.slice(2)
const jobs = asked.length ? ITEMS.filter((item) => asked.includes(item.id)) : ITEMS
if (!jobs.length) throw new Error('Không có mẫu lá')

const frames = {}
const queue = [...jobs]
await Promise.all(
  Array.from({ length: Math.min(2, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift()
      if (!item) return
      let lastError = null
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          console.log(`generating ${item.id}`)
          const raw = await generate(item.prompt)
          frames[item.id] = await processLeaf(item.id, raw)
          console.log(`wrote ${item.id}`, frames[item.id])
          lastError = null
          break
        } catch (error) {
          lastError = error
          console.error(`retry ${item.id}: ${error instanceof Error ? error.message : error}`)
        }
      }
      if (lastError) throw lastError
    }
  }),
)
