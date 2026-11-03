/**
 * Khung ảnh = một lá chụp thật nằm ngang.
 * Lỗ đục theo đúng mép lá (mỗi răng, mũi, cuống), không cắt bầu dục.
 * Chạy: node scripts/build-wedding-leaf-frame.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'public', 'wedding', 'backgrounds', 'ornaments', 'lua-la.png')
const outDir = path.join(root, 'public', 'wedding', 'covers')
const outFrame = path.join(outDir, 'la-bau-duc-frame.webp')
const outFramePng = path.join(outDir, 'la-bau-duc-frame.png')
const outMask = path.join(outDir, 'la-bau-duc-mask.webp')

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
  for (let i = 0; i < mask.length; i += 1) {
    mask[i] = pixels[i * 4 + 3] > 20 ? 1 : 0
  }
  return mask
}

/** Khoảng cách tới mép ngoài: sâu trong lá thì số lớn, theo đúng từng góc lá. */
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
  const rim = Math.max(14, Math.round(maxInside * 0.12))
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
      if (edge < feather) {
        next[px + 3] = Math.round(next[px + 3] * (edge / feather))
      }
      if (edge < shade) {
        const k = 1 - (1 - edge / shade) * 0.26
        next[px] = Math.round(next[px] * k)
        next[px + 1] = Math.round(next[px + 1] * k)
        next[px + 2] = Math.round(next[px + 2] * k)
      }
    }
  }
  const hole = {
    x: (holeMinX / width) * 100,
    y: (holeMinY / height) * 100,
    w: ((holeMaxX - holeMinX + 1) / width) * 100,
    h: ((holeMaxY - holeMinY + 1) / height) * 100,
  }
  return { pixels: next, hole, rim, maxInside, width, height }
}

function roundPct(n) {
  return Math.round(n * 100) / 100
}

const rotated = await sharp(src).rotate(90).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const cropped = bbox(rotated.data, rotated.info.width, rotated.info.height)
const leaf = await sharp(rotated.data, {
  raw: { width: rotated.info.width, height: rotated.info.height, channels: 4 },
})
  .extract(cropped)
  .raw()
  .toBuffer({ resolveWithObject: true })

const punched = punchLeafHole(leaf.data, leaf.info.width, leaf.info.height)
const maskRgba = Buffer.alloc(leaf.info.width * leaf.info.height * 4)
for (let i = 0; i < leaf.info.width * leaf.info.height; i += 1) {
  const alpha = leaf.data[i * 4 + 3]
  maskRgba[i * 4] = 255
  maskRgba[i * 4 + 1] = 255
  maskRgba[i * 4 + 2] = 255
  maskRgba[i * 4 + 3] = alpha
}

mkdirSync(outDir, { recursive: true })
const framePng = await sharp(punched.pixels, {
  raw: { width: punched.width, height: punched.height, channels: 4 },
}).png().toBuffer()
const maskPng = await sharp(maskRgba, {
  raw: { width: leaf.info.width, height: leaf.info.height, channels: 4 },
}).png().toBuffer()
writeFileSync(outFramePng, framePng)
writeFileSync(outFrame, await sharp(framePng).webp({ quality: 86, alphaQuality: 90 }).toBuffer())
writeFileSync(outMask, await sharp(maskPng).webp({ quality: 80, alphaQuality: 90 }).toBuffer())

const hole = {
  x: roundPct(punched.hole.x),
  y: roundPct(punched.hole.y),
  w: roundPct(punched.hole.w),
  h: roundPct(punched.hole.h),
}
console.log(JSON.stringify({
  size: `${punched.width}x${punched.height}`,
  aspect: roundPct(punched.width / punched.height),
  rim: punched.rim,
  maxInside: Math.round(punched.maxInside),
  hole,
}, null, 2))
