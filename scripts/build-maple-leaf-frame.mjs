/**
 * Đục lỗ lá phong người dùng gửi, giữ đúng năm thùy và gân.
 * Chạy: node scripts/build-maple-leaf-frame.mjs
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(
  process.env.USERPROFILE || '',
  'AppData/Local/Temp/cursor/assets/images-53982c8a-8cc9-4323-8991-2fd88bd739df.jpg',
)
const fallback = 'C:/Users/Mr Hau/.cursor/projects/e-python-code-nanoai-vn/assets/images-53982c8a-8cc9-4323-8991-2fd88bd739df.jpg'
const input = src
const outDir = path.join(root, 'public', 'wedding', 'covers')
const id = 'la-phong'

function isPaper(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return min >= 228 && max - min <= 22
}

function isStem(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max <= 95 && max - min <= 50 && r + g + b <= 200
}

function isGreenLeaf(r, g, b) {
  if (isPaper(r, g, b)) return false
  if (isStem(r, g, b)) return false
  return g >= r - 4 && g > b + 4 && g >= 55 && g - Math.min(r, b) >= 8
}

function leafAlpha(r, g, b) {
  if (isStem(r, g, b)) return 255
  if (isGreenLeaf(r, g, b)) {
    const chroma = Math.max(r, g, b) - Math.min(r, g, b)
    if (g >= 220 && chroma < 28) return Math.max(40, Math.round(255 * (chroma / 28)))
    return 255
  }
  return 0
}

function keyGreen(data, width, height) {
  const pixels = Buffer.from(data)
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i + 3] = leafAlpha(pixels[i], pixels[i + 1], pixels[i + 2])
  }
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < mask.length; i += 1) mask[i] = pixels[i * 4 + 3] > 20 ? 1 : 0
  const fill = new Uint8Array(width * height)
  const queue = []
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const i = y * width + x
    if (fill[i] || mask[i]) return
    fill[i] = 1
    queue.push(i)
  }
  for (let x = 0; x < width; x += 1) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y)
    push(width - 1, y)
  }
  let head = 0
  while (head < queue.length) {
    const i = queue[head]
    head += 1
    const x = i % width
    const y = (i - x) / width
    push(x + 1, y)
    push(x - 1, y)
    push(x, y + 1)
    push(x, y - 1)
  }
  for (let i = 0; i < mask.length; i += 1) {
    if (fill[i] || mask[i]) continue
    pixels[i * 4 + 3] = 255
  }
  return pixels
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
  const pad = 10
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
  const rim = Math.max(16, Math.round(maxInside * 0.065))
  const feather = 2.2
  const shade = 5
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
        const k = 1 - (1 - edge / shade) * 0.18
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
    rim,
    maxInside,
    width,
    height,
  }
}

function roundPct(n) {
  return Math.round(n * 100) / 100
}

const file = await import('node:fs').then((fs) => (fs.existsSync(input) ? input : fallback))
const raw = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const keyed = keyGreen(raw.data, raw.info.width, raw.info.height)
const box = bbox(keyed, raw.info.width, raw.info.height)
const cropped = await sharp(keyed, {
  raw: { width: raw.info.width, height: raw.info.height, channels: 4 },
})
  .extract(box)
  .raw()
  .toBuffer({ resolveWithObject: true })
const scale = 4
const leaf = await sharp(cropped.data, {
  raw: { width: cropped.info.width, height: cropped.info.height, channels: 4 },
})
  .resize(cropped.info.width * scale, cropped.info.height * scale, { kernel: 'lanczos3' })
  .raw()
  .toBuffer({ resolveWithObject: true })

mkdirSync(outDir, { recursive: true })
copyFileSync(file, path.join(outDir, `${id}-source.jpg`))
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
writeFileSync(path.join(outDir, `${id}-frame.webp`), await sharp(framePng).webp({ quality: 88, alphaQuality: 92 }).toBuffer())
writeFileSync(path.join(outDir, `${id}-mask.webp`), await sharp(maskPng).webp({ quality: 82, alphaQuality: 92 }).toBuffer())

const hole = {
  x: roundPct(punched.hole.x),
  y: roundPct(punched.hole.y),
  w: roundPct(punched.hole.w),
  h: roundPct(punched.hole.h),
}
console.log(JSON.stringify({
  src: file,
  size: `${punched.width}x${punched.height}`,
  aspect: `${punched.width} / ${punched.height}`,
  rim: punched.rim,
  maxInside: Math.round(punched.maxInside),
  hole,
}, null, 2))
