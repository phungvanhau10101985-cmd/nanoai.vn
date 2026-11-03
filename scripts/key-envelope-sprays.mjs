/**
 * Tách nền magenta của bốn bó hoa phong bì, giữ mép cánh sắc.
 * Nguồn: ảnh chụp trong thư mục assets của Cursor.
 * Chạy: node scripts/key-envelope-sprays.mjs
 */
import { readFileSync, renameSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const OUT = join('public', 'wedding', 'backgrounds', 'ornaments')
const SRC = join(
  process.env.USERPROFILE || '',
  '.cursor',
  'projects',
  'e-python-code-nanoai-vn',
  'assets',
)

function isBg(r, g, b) {
  const neon = g < 96 && r > 145 && b > 90 && b > g + 50 && r > g + 70
  // Khe giữa hoa là magenta đậm hơn nền ngoài, không phải nếp cánh.
  const pocket = g < 32 && r > 95 && r < 210 && b > 40 && b < 170 && r - b < 100 && b > g + 25
  return neon || pocket
}

function keyOut(data, width, height, channels) {
  const pixels = Buffer.alloc(width * height * 4)
  for (let p = 0, i = 0; p < data.length; p += channels, i += 4) {
    pixels[i] = data[p]
    pixels[i + 1] = data[p + 1]
    pixels[i + 2] = data[p + 2]
    pixels[i + 3] = isBg(data[p], data[p + 1], data[p + 2]) ? 0 : 255
  }
  const seen = new Uint8Array(width * height)
  const stack = []
  const seed = (x, y) => {
    const i = y * width + x
    if (seen[i] || pixels[i * 4 + 3] > 0) return
    seen[i] = 1
    stack.push(i)
  }
  for (let x = 0; x < width; x += 1) {
    seed(x, 0)
    seed(x, height - 1)
  }
  for (let y = 0; y < height; y += 1) {
    seed(0, y)
    seed(width - 1, y)
  }
  while (stack.length) {
    const i = stack.pop()
    const x = i % width
    const y = (i - x) / width
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const n = ny * width + nx
      if (seen[n] || pixels[n * 4 + 3] > 0) continue
      seen[n] = 1
      stack.push(n)
    }
  }
  // Lỗ magenta kín giữa hoa vẫn là nền. Chỉ vá lỗ rất nhỏ trong cánh.
  const blob = new Uint8Array(width * height)
  for (let start = 0; start < blob.length; start += 1) {
    if (blob[start] || seen[start] || pixels[start * 4 + 3] > 0) continue
    stack.length = 0
    stack.push(start)
    blob[start] = 1
    const members = [start]
    while (stack.length) {
      const i = stack.pop()
      const x = i % width
      const y = (i - x) / width
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const n = ny * width + nx
        if (blob[n] || seen[n] || pixels[n * 4 + 3] > 0) continue
        blob[n] = 1
        members.push(n)
        stack.push(n)
      }
    }
    if (members.length > 48) continue
    for (const i of members) pixels[i * 4 + 3] = 255
  }
  for (let pass = 0; pass < 2; pass += 1) {
    const next = Buffer.from(pixels)
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = (y * width + x) * 4
        if (pixels[i + 3] === 0) continue
        let open = 0
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (pixels[((y + dy) * width + (x + dx)) * 4 + 3] === 0) open += 1
        }
        if (open < 2) continue
        const r = pixels[i]
        const g = pixels[i + 1]
        const b = pixels[i + 2]
        if (g < 120 && b > g + 40 && r > g + 40) next[i + 3] = 0
      }
    }
    pixels.set(next)
  }
  return pixels
}

function cropBox(pixels, width, height) {
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] < 16) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  const pad = 6
  const left = Math.max(0, minX - pad)
  const top = Math.max(0, minY - pad)
  return {
    left,
    top,
    width: Math.min(width - left, maxX - minX + 1 + pad * 2),
    height: Math.min(height - top, maxY - minY + 1 + pad * 2),
  }
}

for (const id of ['hong', 'reu', 'dem', 'nga']) {
  const src = join(SRC, `phong-bi-${id}-src.jpg`)
  const raw = readFileSync(src)
  const { data, info } = await sharp(raw).raw().toBuffer({ resolveWithObject: true })
  const pixels = keyOut(data, info.width, info.height, info.channels)
  const box = cropBox(pixels, info.width, info.height)
  const file = join(OUT, `phong-bi-${id}.webp`)
  const temp = join(OUT, `phong-bi-${id}.next.webp`)
  await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract(box)
    .webp({ quality: 92, alphaQuality: 100, effort: 5 })
    .toFile(temp)
  try {
    unlinkSync(file)
  } catch {
    // File đang được trình duyệt giữ thì ghi đè thẳng.
  }
  try {
    renameSync(temp, file)
  } catch {
    const { copyFileSync } = await import('node:fs')
    copyFileSync(temp, file)
    unlinkSync(temp)
  }
  console.log(`${id} ${box.width}x${box.height}`)
}
