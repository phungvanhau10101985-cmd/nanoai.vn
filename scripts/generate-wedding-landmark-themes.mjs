/**
 * Hoa văn chụp thật cho bảy chủ đề danh thắng.
 * Chạy: node scripts/generate-wedding-landmark-themes.mjs [chua-mot-cot]
 * Nền là một tấm giấy, hoa bám mép, giữa để chữ. Hoa nổi và hộp quà tách bằng chroma magenta.
 * Không in khóa API.
 */
import { config } from 'dotenv'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

config({ path: '.env' })
config({ path: '.env.local', override: true })

const REAL =
  'Studio photograph, natural daylight, visible paper fibers, leaf veins, petal texture, and soft highlights. Not a cartoon, not an illustration, not clipart, not a flat icon, not watercolor, not a pencil drawing, not a vector, not a painting.'

const PATTERN =
  'Portrait wedding background, one photograph filling the frame. Real photographed plants on paper, not a drawing of a building. The center stays empty pale paper so names can be read. Motifs run along the left and right and also reach the top and bottom, so another copy placed underneath still feels like the same paper. No text, no people, no logo, no pink border.'

const MAGENTA =
  'The background is flat chroma magenta #FF00FF with no gradient and no floor. No text, no pot, no people, no ribbon except when the subject is the ribbon.'

const THEMES = {
  'chua-mot-cot': {
    paper: `${REAL} ${PATTERN} Warm ivory handmade rice paper. Real pink lotus blossoms with layered petals and real round lotus leaves with visible veins, lying on the paper. Blooms and leaves stay along the sides and the top and bottom. Do not draw the pagoda.`,
    branch: `${REAL} One real pink lotus blossom, layered petals, a short green stem, and one small leaf with veins. Petals are dusty rose, not neon pink. ${MAGENTA}`,
    bloom: `${REAL} One real round lotus leaf, green, with clear radiating veins and a natural notch, lying flat. ${MAGENTA}`,
    gift: `${REAL} One real square wedding gift box, three-quarter view, filling most of the frame. Ivory cotton paper. A soft gold silk ribbon wraps the box and ties a full soft bow. One small real lotus petal is tucked under the bow. A faint shadow sits under the box only. The background is flat chroma magenta #FF00FF. One box only. No letters.`,
    files: { branch: 'chua-sen.png', bloom: 'chua-la.png', gift: 'chua-mot-cot.webp', paper: 'chua-mot-cot-paper.jpg' },
  },
  'van-mieu': {
    paper: `${REAL} ${PATTERN} Warm ivory handmade paper with a faint photographed grain of old grey stone. Real yellow apricot blossoms, five soft petals each, on dark woody twigs, and a few dark green leaves with veins. Flowers stay along the sides and the top and bottom. Do not draw a temple, a statue, or a stone turtle.`,
    branch: `${REAL} One real apricot-blossom branch lying on its side: dark brown bark, several open pale-yellow five-petal blossoms, and a few small green leaves with veins. ${MAGENTA}`,
    bloom: `${REAL} One real dark-green old-tree leaf sprig, three leaves with visible veins and a thin woody stem. ${MAGENTA}`,
    gift: `${REAL} One real square wedding gift box, three-quarter view, filling most of the frame. Warm ivory paper. A bronze silk ribbon wraps the box and ties a full soft bow. One small real yellow apricot blossom is tucked under the bow. A faint shadow sits under the box only. The background is flat chroma magenta #FF00FF. One box only. No letters.`,
    files: { branch: 'van-mieu-mai.png', bloom: 'van-mieu-la.png', gift: 'van-mieu.webp', paper: 'van-mieu-paper.jpg' },
  },
  'cho-ben-thanh': {
    paper: `${REAL} ${PATTERN} Warm cream handmade paper. A real garland of yellow marigolds, small red roses, and green leaves with veins, denser along the sides and the top and bottom. Do not draw a clock tower, a market stall, or a conical hat.`,
    branch: `${REAL} One real marigold sprig: several ruffled yellow-orange blooms, a green stem, and a few serrated leaves with veins. ${MAGENTA}`,
    bloom: `${REAL} One real green tropical leaf with a clear midrib and side veins, slightly curved, not a cartoon banana. ${MAGENTA}`,
    gift: `${REAL} One real square wedding gift box, three-quarter view, filling most of the frame. Warm cream paper. A terracotta silk ribbon wraps the box and ties a full soft bow. One small real marigold is tucked under the bow. A faint shadow sits under the box only. The background is flat chroma magenta #FF00FF. One box only. No letters.`,
    files: { branch: 'cho-cuc.png', bloom: 'cho-la.png', gift: 'cho-ben-thanh.webp', paper: 'cho-ben-thanh-paper.jpg' },
  },
  'vinh-ha-long': {
    paper: `${REAL} ${PATTERN} Pale warm paper. Real pale limestone pebbles with natural pits, a few small cream shells with ridges, and thin blades of coastal grass, placed along the sides and the top and bottom. Do not draw a junk boat or a cartoon karst island.`,
    branch: `${REAL} One real pale limestone pebble with natural pits and a soft wet highlight, seen close, not a painted rock. ${MAGENTA}`,
    bloom: `${REAL} One real sprig of thin coastal grass, a few long pale-green blades with visible fibers. ${MAGENTA}`,
    gift: `${REAL} One real square wedding gift box, three-quarter view, filling most of the frame. Pale sand paper. A teal silk ribbon wraps the box and ties a full soft bow. One small real cream shell sits on the knot. A faint shadow sits under the box only. The background is flat chroma magenta #FF00FF. One box only. No letters.`,
    files: { branch: 'ha-long-da.png', bloom: 'ha-long-co.png', gift: 'vinh-ha-long.webp', paper: 'vinh-ha-long-paper.jpg' },
  },
  'lang-bac': {
    paper: `${REAL} ${PATTERN} Pale cool ivory paper like honed marble, with faint natural grey veins. Real white lotus blossoms and green lotus leaves with veins sit only along the sides and the top and bottom. Do not draw a building, a flag, or a portrait.`,
    branch: `${REAL} One real white lotus blossom, layered petals with a pale cream center, a short green stem. ${MAGENTA}`,
    bloom: `${REAL} One real green lotus leaf, round, with clear radiating veins. ${MAGENTA}`,
    gift: `${REAL} One real square wedding gift box, three-quarter view, filling most of the frame. Pale marble-white paper. A deep green silk ribbon wraps the box and ties a full soft bow. One small real white lotus petal is tucked under the bow. A faint shadow sits under the box only. The background is flat chroma magenta #FF00FF. One box only. No letters.`,
    files: { branch: 'lang-sen.png', bloom: 'lang-la.png', gift: 'lang-bac.webp', paper: 'lang-bac-paper.jpg' },
  },
  'que-nghe-an': {
    paper: `${REAL} ${PATTERN} Warm straw-colored handmade paper with visible fibers. Real areca palm fronds, long slender leaflets with veins, and a few golden rice ears, along the sides and the top and bottom. Do not draw a house, a portrait, or a thatched roof.`,
    branch: `${REAL} One real areca palm frond lying on its side: a slim stem and many long slender green leaflets with visible veins. ${MAGENTA}`,
    bloom: `${REAL} One real golden rice ear on a thin stem, grains visible, with one or two narrow leaves. ${MAGENTA}`,
    gift: `${REAL} One real square wedding gift box, three-quarter view, filling most of the frame. Straw-colored paper. An olive silk ribbon wraps the box and ties a full soft bow. One small real rice ear is tucked under the bow. A faint shadow sits under the box only. The background is flat chroma magenta #FF00FF. One box only. No letters.`,
    files: { branch: 'que-cau.png', bloom: 'que-lua.png', gift: 'que-nghe-an.webp', paper: 'que-nghe-an-paper.jpg' },
  },
  'duong-lam': {
    paper: `${REAL} ${PATTERN} Warm laterite handmade paper, the color of old village brick, with visible fibers. Real banyan leaves with veins and a few small yellow wildflowers along the sides and the top and bottom. Do not draw a village gate or a cartoon house.`,
    branch: `${REAL} One real banyan sprig: three oval green leaves with clear veins and a thin woody stem. ${MAGENTA}`,
    bloom: `${REAL} One real sprig of small yellow wildflowers, tiny five-petal blooms and a few narrow green leaves. ${MAGENTA}`,
    gift: `${REAL} One real square wedding gift box, three-quarter view, filling most of the frame. Warm laterite paper. A brown silk ribbon wraps the box and ties a full soft bow. One small real banyan leaf is tucked under the bow. A faint shadow sits under the box only. The background is flat chroma magenta #FF00FF. One box only. No letters.`,
    files: { branch: 'duong-la.png', bloom: 'duong-hoa.png', gift: 'duong-lam.webp', paper: 'duong-lam-paper.jpg' },
  },
}

function killMagenta(r, g, b) {
  // Nền chroma gần như không có xanh lá. Cánh sen hồng vẫn có xanh lá — đừng nuốt cánh.
  if (g >= 48) return false
  const mag = Math.min(r, b) - g
  return r > 140 && b > 140 && mag > 30
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
      body: JSON.stringify({ model: 'gpt-image-2', prompt, n: 1, size, quality: 'medium' }),
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

function seamlessVertical(pixels, width, height, channels) {
  const band = Math.max(16, Math.round(height * 0.03))
  const mix = 0.28
  const out = Buffer.from(pixels)
  for (let y = 0; y < band; y += 1) {
    const t = (1 - y / band) * mix
    for (let x = 0; x < width; x += 1) {
      const top = (y * width + x) * channels
      const bot = ((height - 1 - y) * width + x) * channels
      for (let c = 0; c < 3; c += 1) {
        const a = pixels[top + c]
        const b = pixels[bot + c]
        out[top + c] = Math.round(a * (1 - t) + b * t)
        out[bot + c] = Math.round(b * (1 - t) + a * t)
      }
    }
  }
  return out
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

const PARTS = ['paper', 'branch', 'bloom', 'gift']
const asked = process.argv.slice(2)
const partArgs = asked.filter((arg) => PARTS.includes(arg))
const ids = asked.filter((arg) => !PARTS.includes(arg))
const runIds = ids.length ? ids : Object.keys(THEMES)
const runParts = partArgs.length ? partArgs : PARTS

for (const id of runIds) {
  const theme = THEMES[id]
  if (!theme) {
    console.error(`Chưa có "${id}". Có: ${Object.keys(THEMES).join(', ')}`)
    process.exit(1)
  }
  if (!runParts.includes('paper')) {
    // skip paper
  } else {
  console.log(`generating ${id} paper`)
  const paperRaw = await generate(theme.paper, '1024x1536')
  const sized = await sharp(paperRaw).resize(1024, 1536, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const joined = seamlessVertical(sized.data, sized.info.width, sized.info.height, sized.info.channels)
  const jpeg = await sharp(joined, { raw: { width: sized.info.width, height: sized.info.height, channels: sized.info.channels } })
    .jpeg({ quality: 86 })
    .toBuffer()
  writeFileSync(join('public', 'wedding', 'backgrounds', theme.files.paper), jpeg)
  console.log(`wrote ${theme.files.paper}`)
  }

  for (const part of ['branch', 'bloom', 'gift']) {
    if (!runParts.includes(part)) continue
    console.log(`generating ${id} ${part}`)
    const raw = await generate(theme[part], '1024x1024')
    const keyed = await keyOut(raw)
    const box = cropBox(keyed.pixels, keyed.width, keyed.height)
    const png = await sharp(keyed.pixels, { raw: { width: keyed.width, height: keyed.height, channels: 4 } })
      .extract(box)
      .png()
      .toBuffer()
    if (part === 'gift') {
      const webp = await sharp(png).webp({ quality: 86, alphaQuality: 100, effort: 4 }).toBuffer()
      writeFileSync(join('public', 'wedding', 'gifts', theme.files.gift), webp)
    } else {
      writeFileSync(join('public', 'wedding', 'backgrounds', 'ornaments', theme.files[part]), png)
    }
    console.log(`wrote ${theme.files[part]} leftover-magenta=${keyed.magenta}`)
  }
}
