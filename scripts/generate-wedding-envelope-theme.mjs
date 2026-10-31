/**
 * Ảnh chụp cho chủ đề phong bì thư đỏ đô.
 * Chạy: node scripts/generate-wedding-envelope-theme.mjs
 * Nền tách bằng chroma magenta. Không in khóa API.
 */
import { config } from 'dotenv'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

config({ path: '.env' })
config({ path: '.env.local', override: true })

const REAL =
  'Studio photograph, natural daylight, visible paper or petal fibers. Not a cartoon, not an illustration, not clipart, not a flat icon, not watercolor, not a pencil drawing, not a vector.'

const ASSETS = {
  envelope:
    `${REAL} Front view of one real wedding envelope lying flat, filling the frame. Deep burgundy cotton paper, wine red, matte, visible fibers. The body is a vertical rectangle. A triangular flap is folded DOWN from the top, and the point of the flap sits near the middle. The V-shaped opening above the flap point is empty and filled with flat chroma magenta #FF00FF, the same as the background, so a photo can show through that opening. Do not fold the flap upward. Do not show the inside lining as a diamond. No card, no photo, no flowers, no wax seal, no text, no people. Background is flat chroma magenta #FF00FF with no gradient and no floor.`,
  spray:
    `${REAL} One real floral cluster, as if laid on the left lip of an envelope. Two deep burgundy peonies with layered real petals, one cream garden rose, olive leaves with visible veins, and a few thin dried stems with tiny dark berries. Soft overlap, not a bouquet in a vase. The background is flat chroma magenta #FF00FF. No ribbon, no text, no envelope.`,
  seal:
    `${REAL} One real round gold wax seal, macro, centered. A heart is pressed into the wax. Visible wax grain and a soft gloss. The background is flat chroma magenta #FF00FF. No envelope, no ribbon, no text, no flowers.`,
  palace:
    `${REAL} A real European baroque palace facade, straight-on, symmetrical cream stone, columns and a central dome, filling the lower two thirds. No people, no text, no sky drama. Photographed architecture, not an engraving.`,
}

function killMagenta(r, g, b) {
  return g < 90 && r > 170 && b > 170 && Math.abs(r - b) < 45
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

async function keyOut(raw) {
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
        if (!killMagenta(pixels[i], pixels[i + 1], pixels[i + 2])) continue
        let touch = false
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (pixels[((y + dy) * width + (x + dx)) * 4 + 3] < 16) touch = true
        }
        if (touch) next[i + 3] = 0
      }
    }
    pixels = next
  }
  return { pixels, width, height }
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
    minX,
    minY,
    maxX,
    maxY,
  }
}

async function keyAndCrop(raw) {
  const keyed = await keyOut(raw)
  const box = cropBox(keyed.pixels, keyed.width, keyed.height)
  const webp = await sharp(keyed.pixels, { raw: { width: keyed.width, height: keyed.height, channels: 4 } })
    .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
    .webp({ quality: 86, alphaQuality: 100, effort: 4 })
    .toBuffer()
  return { webp, keyed, box }
}

/** Lỗ trong suốt bị giấy bao quanh. Nền magenta ngoài phong bì không tính. */
function holePercents(pixels, width, height, box) {
  const visited = new Uint8Array(width * height)
  const stack = []
  const seedEdge = (x, y) => {
    const i = y * width + x
    if (visited[i] || pixels[i * 4 + 3] > 20) return
    visited[i] = 1
    stack.push(i)
  }
  for (let x = 0; x < width; x += 1) {
    seedEdge(x, 0)
    seedEdge(x, height - 1)
  }
  for (let y = 0; y < height; y += 1) {
    seedEdge(0, y)
    seedEdge(width - 1, y)
  }
  while (stack.length) {
    const i = stack.pop()
    for (const next of [i - 1, i + 1, i - width, i + width]) {
      if (next < 0 || next >= visited.length || visited[next]) continue
      if (pixels[next * 4 + 3] > 20) continue
      visited[next] = 1
      stack.push(next)
    }
  }
  let best = null
  for (let y = box.top; y <= box.top + box.height; y += 2) {
    for (let x = box.left; x <= box.left + box.width; x += 2) {
      const start = y * width + x
      if (visited[start] || pixels[start * 4 + 3] > 20) continue
      stack.length = 0
      stack.push(start)
      visited[start] = 1
      let n = 0
      let minX = x
      let minY = y
      let maxX = x
      let maxY = y
      while (stack.length) {
        const i = stack.pop()
        n += 1
        const cx = i % width
        const cy = (i - cx) / width
        if (cx < minX) minX = cx
        if (cy < minY) minY = cy
        if (cx > maxX) maxX = cx
        if (cy > maxY) maxY = cy
        for (const next of [i - 1, i + 1, i - width, i + width]) {
          if (next < 0 || next >= visited.length || visited[next]) continue
          if (pixels[next * 4 + 3] > 20) continue
          visited[next] = 1
          stack.push(next)
        }
      }
      if (!best || n > best.n) best = { n, minX, minY, maxX, maxY }
    }
  }
  if (!best || best.n < 400) return null
  const w = box.width
  const h = box.height
  return {
    x: Math.round(((best.minX - box.left) / w) * 1000) / 10,
    y: Math.round(((best.minY - box.top) / h) * 1000) / 10,
    w: Math.round(((best.maxX - best.minX) / w) * 1000) / 10,
    h: Math.round(((best.maxY - best.minY) / h) * 1000) / 10,
    pixels: best.n,
  }
}

mkdirSync(join('public', 'wedding', 'covers'), { recursive: true })
mkdirSync(join('public', 'wedding', 'backgrounds', 'ornaments'), { recursive: true })

const asked = process.argv.slice(2)
const ids = asked.length ? asked : ['envelope', 'spray', 'seal', 'palace']

for (const id of ids) {
  if (!ASSETS[id]) {
    console.error(`Chưa có "${id}". Có: ${Object.keys(ASSETS).join(', ')}`)
    process.exit(1)
  }
  console.log(`generating ${id}`)
  const raw = await generate(ASSETS[id])
  if (id === 'palace') {
    const stamp = await sharp(raw)
      .resize(980, 720, { fit: 'inside' })
      .grayscale()
      .modulate({ brightness: 2.15 })
      .png()
      .toBuffer()
    const paper = await sharp(join('public', 'wedding', 'backgrounds', 'do-dam-paper.jpg'))
      .resize(1200, 1800, { fit: 'cover' })
      .composite([{ input: stamp, gravity: 'south', blend: 'multiply' }])
      .jpeg({ quality: 86 })
      .toBuffer()
    writeFileSync(join('public', 'wedding', 'backgrounds', 'phong-bi-paper.jpg'), paper)
    console.log('wrote phong-bi-paper.jpg')
    continue
  }
  const { webp, keyed, box } = await keyAndCrop(raw)
  const file =
    id === 'envelope'
      ? join('public', 'wedding', 'covers', 'phong-bi-envelope.webp')
      : id === 'seal'
        ? join('public', 'wedding', 'covers', 'phong-bi-seal.webp')
        : join('public', 'wedding', 'backgrounds', 'ornaments', 'phong-bi-spray.webp')
  writeFileSync(file, webp)
  console.log(`wrote ${file} ${box.width}x${box.height}`)
  if (id === 'envelope') {
    const hole = holePercents(keyed.pixels, keyed.width, keyed.height, box)
    console.log('hole', hole ? JSON.stringify(hole) : 'none')
  }
}
