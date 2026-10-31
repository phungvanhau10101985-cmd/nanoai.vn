/**
 * Nền dải liền và hoa nổi cho hoa đào, biển, đêm vàng, lụa áo dài.
 * Chạy: node scripts/generate-wedding-scroll-themes.mjs [hoa-dao bien dem-vang lua-ao-dai]
 * Bốn nền trơn là dải liền. Bốn nền hoa văn nằm file riêng, mép chỉ làm dịu mỏng.
 * Không in khóa API.
 */
import { config } from 'dotenv'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

config({ path: '.env' })
config({ path: '.env.local', override: true })

const REAL =
  'Studio photograph, natural light, visible fibers or grain. Not a cartoon, not an illustration, not clipart, not a flat icon, not watercolor, not a pencil drawing, not a vector.'

const PLAIN =
  'Fill the frame edge to edge. Flat even light, no vignette, no horizon, no border, no text, no people, no flowers, no objects. The texture must continue to every edge so the top can meet the bottom.'

const PATTERN =
  'Portrait wedding background, one photograph filling the frame. Real photographed pattern, not a flat empty surface, not a cartoon, not an illustration. The center stays calmer so names can be read. Motifs run along the left and right and also reach the top and bottom, so another copy placed underneath still feels like the same scene. No text, no people, no border, no logo.'

const MAGENTA = 'The background is flat chroma magenta #FF00FF with no gradient and no floor. No text, no pot, no people, no ribbon except when the subject is the ribbon.'

const THEMES = {
  'hoa-dao': {
    paper: `${REAL} ${PLAIN} Close-up of warm ivory handmade rice paper with a faint peach blush and visible paper fibers.`,
    seam: 'lock',
    branch: `${REAL} One real peach-blossom branch lying on its side: brown bark, several open pink blossoms with layered petals, and a few green leaves with veins. ${MAGENTA}`,
    bloom: `${REAL} One smaller real peach-blossom sprig: thin brown twig, pink buds and one open blossom, a few small leaves with veins. ${MAGENTA}`,
    gift: `${REAL} One real square wedding gift box, three-quarter view, filling most of the frame. Ivory cotton paper. A blush-pink silk ribbon wraps the box and ties a full soft bow. One small real peach blossom is tucked under the bow. A faint shadow sits under the box only. The background is flat chroma magenta #FF00FF. One box only. No letters.`,
    files: { branch: 'dao-canh.png', bloom: 'dao-nu.png', gift: 'dao.webp', paper: 'hoa-dao-paper.jpg' },
  },
  bien: {
    paper: `${REAL} ${PLAIN} Close-up of fine pale beach sand, even grain, warm daylight, no shells, no water, no footprints.`,
    seam: 'lock',
    branch: `${REAL} One real scallop shell, cream and soft peach, seen from above, with natural ridges. ${MAGENTA}`,
    bloom: `${REAL} One real sprig of thin beach grass, a few long pale-green blades with visible fibers, lying on its side. ${MAGENTA}`,
    gift: `${REAL} One real square wedding gift box, three-quarter view, filling most of the frame. Pale sand-colored cotton paper. A teal silk ribbon wraps the box and ties a full soft bow. One small real white shell sits on the knot. A faint shadow sits under the box only. The background is flat chroma magenta #FF00FF. One box only. No letters.`,
    files: { branch: 'bien-vo.png', bloom: 'bien-co.png', gift: 'bien.webp', paper: 'bien-paper.jpg' },
  },
  'dem-vang': {
    paper: `${REAL} ${PLAIN} Close-up of deep navy silk, even weave, a few tiny champagne specks like dust. No moon, no large stars, no horizon.`,
    seam: 'lock',
    branch: `${REAL} One real slender olive sprig, narrow grey-green leaves with a pale central vein, warm light. ${MAGENTA}`,
    bloom: `${REAL} One real cluster of tiny cream blossoms on a thin stem, a few small leaves, warm light. ${MAGENTA}`,
    gift: `${REAL} One real square wedding gift box, three-quarter view, filling most of the frame. Deep navy paper. A champagne-gold silk ribbon wraps the box and ties a full soft bow. No extra flowers. A faint shadow sits under the box only. The background is flat chroma magenta #FF00FF. One box only. No letters.`,
    files: { branch: 'dem-canh.png', bloom: 'dem-hoa.png', gift: 'dem.webp', paper: 'dem-vang-paper.jpg' },
  },
  'lua-ao-dai': {
    paper: `${REAL} ${PLAIN} Macro of perfectly flat ivory silk laid taut. No folds, no wrinkles, no creases, no shadows. Even weave and a soft sheen.`,
    seam: 'lock',
    branch: `${REAL} One real length of ivory silk ribbon, softly curled, visible weave and sheen, not a bow on a box. ${MAGENTA}`,
    bloom: `${REAL} One real sprig of white jasmine: small white blossoms and a few green leaves with veins. ${MAGENTA}`,
    gift: `${REAL} One real square wedding gift box, three-quarter view, filling most of the frame. Ivory silk. A champagne silk ribbon wraps the box and ties a full soft bow. One small real white jasmine blossom is tucked under the bow. A faint shadow sits under the box only. The background is flat chroma magenta #FF00FF. One box only. No letters.`,
    files: { branch: 'lua-dai.png', bloom: 'lua-hoa.png', gift: 'lua.webp', paper: 'lua-ao-dai-paper.jpg' },
  },
  'hoa-dao-van': {
    paper: `${REAL} ${PATTERN} Warm ivory handmade paper with real peach-blossom branches: open pink blossoms, buds, brown bark, and green leaves with visible veins. Flowers sit along both sides and lightly across the top and bottom. The center is mostly open paper.`,
    seam: 'soft',
    files: { paper: 'hoa-dao-van-paper.jpg' },
  },
  'bien-van': {
    paper: `${REAL} ${PATTERN} A real beach seen close: pale sand, a soft wash of clear shallow water, a few ridged shells, and thin beach grass. Water, shells, and grass stay toward the sides and the top and bottom edges. The center is open sand. No horizon line across the middle, no umbrellas.`,
    seam: 'soft',
    files: { paper: 'bien-van-paper.jpg' },
  },
  'dem-vang-van': {
    paper: `${REAL} ${PATTERN} Deep navy silk photographed close, with a real gold-thread floral weave and tiny champagne blossoms in the cloth. Visible weave and sheen. The pattern is richer along the sides and the top and bottom, quieter in the center. No moon, no cartoon stars.`,
    seam: 'soft',
    files: { paper: 'dem-vang-van-paper.jpg' },
  },
  'lua-van': {
    paper: `${REAL} ${PATTERN} Ivory silk photographed close, with a real floral brocade woven into the cloth: small blossoms and leaves, silk sheen, visible threads. The pattern is richer along the sides and the top and bottom, quieter in the center. Not a blank cloth.`,
    seam: 'soft',
    files: { paper: 'lua-van-paper.jpg' },
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

/** lock: mép trên và mép dưới thành một dải. soft: chỉ làm dịu mỏng, hoa văn giữ nguyên. */
function seamlessVertical(pixels, width, height, channels, mode) {
  const soft = mode === 'soft'
  const band = soft ? Math.max(16, Math.round(height * 0.03)) : Math.max(48, Math.round(height * 0.1))
  const mix = soft ? 0.28 : 0.5
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
  let drift = 0
  if (!soft) {
    for (let x = 0; x < width; x += 1) {
      const top = x * channels
      const bot = ((height - 1) * width + x) * channels
      for (let c = 0; c < 3; c += 1) {
        const value = Math.round((out[top + c] + out[bot + c]) / 2)
        drift += Math.abs(out[top + c] - out[bot + c])
        out[top + c] = value
        out[bot + c] = value
      }
    }
  }
  return { pixels: out, drift: Math.round(drift / (width * 3)) }
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

const asked = process.argv.slice(2).filter((arg) => arg !== '--paper-only')
const paperOnly = process.argv.includes('--paper-only')
const ids = asked.length ? asked : Object.keys(THEMES)

for (const id of ids) {
  const theme = THEMES[id]
  if (!theme) {
    console.error(`Chưa có "${id}". Có: ${Object.keys(THEMES).join(', ')}`)
    process.exit(1)
  }
  console.log(`generating ${id} paper`)
  const paperRaw = await generate(theme.paper, '1024x1536')
  const sized = await sharp(paperRaw).resize(1024, 1536, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const joined = seamlessVertical(sized.data, sized.info.width, sized.info.height, sized.info.channels, theme.seam)
  const jpeg = await sharp(joined.pixels, { raw: { width: sized.info.width, height: sized.info.height, channels: sized.info.channels } })
    .jpeg({ quality: 86 })
    .toBuffer()
  writeFileSync(join('public', 'wedding', 'backgrounds', theme.files.paper), jpeg)
  console.log(`wrote ${theme.files.paper} seam-drift-before-lock=${joined.drift}`)

  if (paperOnly || !theme.branch) continue
  for (const part of ['branch', 'bloom', 'gift']) {
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
