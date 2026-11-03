/**
 * Bốn màu phong bì từ ảnh chụp đỏ đô.
 * Giữ sợi giấy, nếp gấp và lỗ miệng thư. Chỉ đổi màu cánh hoa, không đụng lá.
 * Chạy: node scripts/build-envelope-color-variants.mjs
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const COVERS = join('public', 'wedding', 'covers')
const ORNAMENTS = join('public', 'wedding', 'backgrounds', 'ornaments')
const PAPERS = join('public', 'wedding', 'backgrounds')

const TONES = [
  {
    id: 'hong',
    paper: [186, 118, 132],
    petal: [240, 148, 172],
    petalFloor: 0.78,
    sheet: { shadow: [214, 176, 182], highlight: [255, 246, 246] },
  },
  {
    id: 'reu',
    paper: [118, 138, 112],
    petal: [252, 249, 244],
    petalFloor: 0.8,
    sheet: { shadow: [186, 198, 176], highlight: [246, 250, 242] },
  },
  {
    id: 'dem',
    paper: [27, 46, 82],
    petal: [246, 247, 255],
    petalFloor: 0.82,
    sheet: { paper: [16, 32, 64], deep: [8, 16, 36], line: [214, 196, 160] },
    night: true,
  },
  {
    id: 'nga',
    paper: [214, 196, 168],
    petal: [255, 228, 198],
    petalFloor: 0.72,
    sheet: { shadow: [214, 196, 170], highlight: [255, 250, 242] },
  },
]

function clamp(n) {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function lum(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function killMagenta(r, g, b) {
  return g < 90 && r > 170 && b > 170 && Math.abs(r - b) < 45
}

function isPetal(r, g, b, a) {
  if (a < 24 || killMagenta(r, g, b)) return false
  if (g > r + 6 && g >= b) return false
  if (b > r + 8 && b > 70) return false
  if (r - g < 34) return false
  return r > b + 8 && r > 36
}

async function rawOf(file) {
  return sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
}

function meanLum(pixels, accept) {
  let sum = 0
  let n = 0
  for (let i = 0; i < pixels.length; i += 4) {
    if (!accept(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3])) continue
    sum += lum(pixels[i], pixels[i + 1], pixels[i + 2])
    n += 1
  }
  return n ? sum / n : 1
}

function paint(pixels, accept, target, mean) {
  const next = Buffer.from(pixels)
  let n = 0
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    const a = pixels[i + 3]
    if (killMagenta(r, g, b)) {
      next[i + 3] = 0
      continue
    }
    if (!accept(r, g, b, a)) continue
    const gain = lum(r, g, b) / mean
    next[i] = clamp(target[0] * gain)
    next[i + 1] = clamp(target[1] * gain)
    next[i + 2] = clamp(target[2] * gain)
    n += 1
  }
  return { next, n }
}

function tintDaySheet(pixels, width, height, tone) {
  const next = Buffer.from(pixels)
  for (let i = 0; i < pixels.length; i += 4) {
    const t = lum(pixels[i], pixels[i + 1], pixels[i + 2]) / 255
    const shade = Math.pow(Math.max(0, Math.min(1, (t - 0.45) / 0.5)), 0.92)
    const shadow = tone.sheet.shadow
    const highlight = tone.sheet.highlight
    next[i] = clamp(shadow[0] + (highlight[0] - shadow[0]) * shade)
    next[i + 1] = clamp(shadow[1] + (highlight[1] - shadow[1]) * shade)
    next[i + 2] = clamp(shadow[2] + (highlight[2] - shadow[2]) * shade)
    next[i + 3] = 255
  }
  return next
}

function tintNightSheet(pixels, blur, width, height, tone) {
  const next = Buffer.from(pixels)
  const { paper, deep, line } = tone.sheet
  for (let i = 0, p = 0; p < pixels.length; i += 1, p += 4) {
    const slow = blur[i] / 255
    const shade = Math.pow(Math.max(0, Math.min(1, (slow - 0.55) / 0.4)), 0.9)
    const baseR = deep[0] + (paper[0] - deep[0]) * shade
    const baseG = deep[1] + (paper[1] - deep[1]) * shade
    const baseB = deep[2] + (paper[2] - deep[2]) * shade
    const y = Math.floor(i / width)
    const ink = (blur[i] - lum(pixels[p], pixels[p + 1], pixels[p + 2])) / 255
    const mix = y > height * 0.58 && ink > 0.055 ? Math.min(0.62, (ink - 0.055) / 0.12) : 0
    next[p] = clamp(baseR * (1 - mix) + line[0] * mix)
    next[p + 1] = clamp(baseG * (1 - mix) + line[1] * mix)
    next[p + 2] = clamp(baseB * (1 - mix) + line[2] * mix)
    next[p + 3] = 255
  }
  return next
}

function paintPetal(pixels, target, floor) {
  const next = Buffer.from(pixels)
  let n = 0
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    const a = pixels[i + 3]
    if (killMagenta(r, g, b)) {
      next[i + 3] = 0
      continue
    }
    if (!isPetal(r, g, b, a)) continue
    const t = Math.max(0, Math.min(1, (lum(r, g, b) - 8) / 145))
    const lifted = Math.min(1.08, floor + (1.08 - floor) * Math.pow(t, 0.72))
    next[i] = clamp(target[0] * lifted)
    next[i + 1] = clamp(target[1] * lifted)
    next[i + 2] = clamp(target[2] * lifted)
    n += 1
  }
  return { next, n }
}

mkdirSync(COVERS, { recursive: true })
mkdirSync(ORNAMENTS, { recursive: true })
mkdirSync(PAPERS, { recursive: true })

const envelope = await rawOf(join(COVERS, 'phong-bi-envelope.webp'))
const cluster = await rawOf(join(ORNAMENTS, 'phong-bi-cluster.webp'))
const paper = await rawOf(join(PAPERS, 'phong-bi-paper.jpg'))

const paperMean = meanLum(envelope.data, (r, g, b, a) => a > 24 && !killMagenta(r, g, b))
const petalMean = meanLum(cluster.data, isPetal)
console.log(`paper mean ${paperMean.toFixed(1)} petal mean ${petalMean.toFixed(1)}`)
const nightBlur = await sharp(join(PAPERS, 'phong-bi-paper.jpg')).greyscale().blur(14).raw().toBuffer()

for (const tone of TONES) {
  const paintedPaper = paint(
    envelope.data,
    (r, g, b, a) => a > 24 && !killMagenta(r, g, b),
    tone.paper,
    paperMean,
  )
  const envelopeWebp = await sharp(paintedPaper.next, {
    raw: { width: envelope.info.width, height: envelope.info.height, channels: 4 },
  })
    .webp({ quality: 86, alphaQuality: 100, effort: 4 })
    .toBuffer()
  const envelopeFile = join(COVERS, `phong-bi-${tone.id}.webp`)
  await sharp(envelopeWebp).toFile(envelopeFile)

  const paintedPetal = paintPetal(cluster.data, tone.petal, tone.petalFloor)
  const sprayFile = join(ORNAMENTS, `phong-bi-${tone.id}.webp`)
  await sharp(paintedPetal.next, {
    raw: { width: cluster.info.width, height: cluster.info.height, channels: 4 },
  })
    .webp({ quality: 86, alphaQuality: 100, effort: 4 })
    .toFile(sprayFile)

  const sheet = tone.night
    ? tintNightSheet(paper.data, nightBlur, paper.info.width, paper.info.height, tone)
    : tintDaySheet(paper.data, paper.info.width, paper.info.height, tone)
  const paperFile = join(PAPERS, `phong-bi-${tone.id}-paper.jpg`)
  await sharp(sheet, {
    raw: { width: paper.info.width, height: paper.info.height, channels: 4 },
  })
    .jpeg({ quality: 86 })
    .toFile(paperFile)

  console.log(`${tone.id} envelope ${paintedPaper.n}px spray petals ${paintedPetal.n}px`)
}
