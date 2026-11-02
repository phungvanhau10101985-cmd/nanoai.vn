/**
 * Hoa văn chụp thật — hai mảnh mới cho từng chủ đề còn thiếu.
 * Chạy: node scripts/generate-wedding-theme-ornaments.mjs [file.png ...]
 * Tách nền chroma magenta. Bỏ qua file đã có, trừ khi --force.
 * Không in khóa API.
 */
import { config } from 'dotenv'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

config({ path: '.env' })
config({ path: '.env.local', override: true })

const REAL =
  'Studio photograph of a real specimen, natural daylight, visible fibers, veins, petal texture, and soft highlights. Photographed object, not a drawing. Not a cartoon, not an illustration, not clipart, not a flat icon, not watercolor, not a pencil drawing, not a vector, not a painting, not a sticker.'

const MAGENTA =
  'The background is flat chroma magenta #FF00FF with no gradient and no floor. No text, no pot, no vase, no people, no ribbon except when the subject is the ribbon. No pink border.'

const ITEMS = [
  {
    file: 'garden-la.png',
    prompt: `${REAL} One real rose leaf sprig: three to five oval deep-green leaves with clear midribs and serrated edges, a thin woody stem, natural overlap. ${MAGENTA}`,
  },
  {
    file: 'garden-hong.png',
    prompt: `${REAL} One real blush-pink garden rose, layered petals with visible veins and a cream-gold center, a short green stem and two serrated leaves. Dusty rose, not neon. ${MAGENTA}`,
  },
  {
    file: 'garden-euca.png',
    prompt: `${REAL} One real silver-green eucalyptus sprig, round coins of leaves with a pale waxy bloom and a visible central vein, a thin stem. ${MAGENTA}`,
  },
  {
    file: 'pearl-hong.png',
    prompt: `${REAL} One real pale blush rose, tightly layered petals, soft pink fading to cream, a short green stem and one serrated leaf. ${MAGENTA}`,
  },
  {
    file: 'pearl-hat.png',
    prompt: `${REAL} One real strand of cream pearls, about twelve round pearls with natural nacre highlights, lying in a gentle curve. No metal clasp in frame. ${MAGENTA}`,
  },
  {
    file: 'pearl-la.png',
    prompt: `${REAL} One real rose leaf, deep green, serrated edge, clear midrib and side veins, a short petiole. ${MAGENTA}`,
  },
  {
    file: 'sky-buom.png',
    prompt: `${REAL} One real live butterfly, wings open, soft rose-brown and cream with natural scale texture and tiny spots, brown body and antennae. Photographed insect, not a drawing. ${MAGENTA}`,
  },
  {
    file: 'sky-hong.png',
    prompt: `${REAL} One real open garden rose, pale pink outer petals and a deeper blush center, visible petal veins, a short stem. ${MAGENTA}`,
  },
  {
    file: 'sky-la.png',
    prompt: `${REAL} One real spray of small grey-green eucalyptus and two rose leaves with veins, a thin stem. ${MAGENTA}`,
  },
  {
    file: 'do-dam-la.png',
    prompt: `${REAL} One real dark green rose leaf with a wine-red tint on the edge, serrated, clear veins, a short stem. ${MAGENTA}`,
  },
  {
    file: 'tre-la.png',
    prompt: `${REAL} One real cluster of Vietnamese bamboo leaves, six long slender blades with parallel veins, a short green culm. ${MAGENTA}`,
  },
  {
    file: 'tre-mang.png',
    prompt: `${REAL} One real young bamboo shoot, tapered, pale cream-green sheaths with brown specks, a few tiny leaf tips. ${MAGENTA}`,
  },
  {
    file: 'dao-la.png',
    prompt: `${REAL} One real peach-tree leaf sprig: three slender green leaves with serrated edges and a clear midrib, a thin brown twig. ${MAGENTA}`,
  },
  {
    file: 'dao-canh-dai.png',
    prompt: `${REAL} One longer real peach-blossom branch: brown bark, three open pink blossoms with layered petals, two buds, a few small leaves with veins. ${MAGENTA}`,
  },
  {
    file: 'bien-sao.png',
    prompt: `${REAL} One real cream starfish, five arms, sandy granular texture and a wet highlight, seen from above. ${MAGENTA}`,
  },
  {
    file: 'bien-soi.png',
    prompt: `${REAL} One real spiral seashell, cream and soft peach, natural ridges and a pearly opening. ${MAGENTA}`,
  },
  {
    file: 'van-mieu-nu.png',
    prompt: `${REAL} One real apricot-blossom twig with several closed and half-open pale-yellow buds, dark bark, two tiny green leaves. ${MAGENTA}`,
  },
  {
    file: 'van-mieu-da.png',
    prompt: `${REAL} One real small grey weathered stone, natural pits and a soft highlight, about the size of a palm, no carving. ${MAGENTA}`,
  },
  {
    file: 'cho-su.png',
    prompt: `${REAL} One real frangipani plumeria blossom, five thick cream-yellow petals with a golden throat, a short stem. ${MAGENTA}`,
  },
  {
    file: 'cho-giay.png',
    prompt: `${REAL} One real bougainvillea spray: papery magenta-coral bracts with visible veins and a few small green leaves. ${MAGENTA}`,
  },
  {
    file: 'lang-cuc.png',
    prompt: `${REAL} One real white chrysanthemum bloom, many layered petals, a pale green-gold center, a short green stem. ${MAGENTA}`,
  },
  {
    file: 'lang-canh-cuc.png',
    prompt: `${REAL} One real chrysanthemum leaf sprig, deeply lobed green leaves with serrated edges and clear veins, a thin stem. ${MAGENTA}`,
  },
  {
    file: 'que-hoa.png',
    prompt: `${REAL} One real wild yellow daisy spray, several small golden blooms with many thin petals, a few narrow green leaves. ${MAGENTA}`,
  },
  {
    file: 'que-la.png',
    prompt: `${REAL} One real slender rice leaf blade, long, bright green, a clear midrib and parallel veins, a slight natural curve. ${MAGENTA}`,
  },
  {
    file: 'duong-re.png',
    prompt: `${REAL} One real banyan aerial-root sprig: a woody brown hanging root and two oval green leaves with clear veins. ${MAGENTA}`,
  },
  {
    file: 'duong-qua.png',
    prompt: `${REAL} One real laterite pebble, warm brick-red porous stone with natural pits, and one small oval green leaf beside it. ${MAGENTA}`,
  },
  {
    file: 'garden-nu.png',
    prompt: `${REAL} One real blush-pink rosebud, tightly closed layered petals, a short green stem and one serrated rose leaf with a clear midrib. Dusty rose, not neon. ${MAGENTA}`,
  },
  {
    file: 'pearl-nu.png',
    prompt: `${REAL} One real pale cream-blush rosebud, tightly layered petals fading to ivory, a short stem and one deep-green serrated leaf. ${MAGENTA}`,
  },
  {
    file: 'sky-nu.png',
    prompt: `${REAL} One real pale pink rosebud opening slightly, visible petal veins, a short stem and two small rose leaves. Soft sky-garden pink. ${MAGENTA}`,
  },
  {
    file: 'moc-nu.png',
    prompt: `${REAL} One real white gardenia bud, creamy pointed petals just opening, one glossy dark-green gardenia leaf with a clear midrib. ${MAGENTA}`,
  },
  {
    file: 'calla-la.png',
    prompt: `${REAL} One real calla lily leaf, large arrow-shaped blade, deep green, a clear midrib and side veins, a short petiole. ${MAGENTA}`,
  },
  {
    file: 'sen-vang-sen.png',
    prompt: `${REAL} One real cream-gold lotus blossom, layered pointed petals with a warm gold throat and visible petal veins, a short green stem. ${MAGENTA}`,
  },
  {
    file: 'sen-vang-gu.png',
    prompt: `${REAL} One real lotus seed pod, flat green-gold disc with visible seed holes, a short stem and one small lotus leaf behind it. ${MAGENTA}`,
  },
  {
    file: 'dem-la.png',
    prompt: `${REAL} One real olive-leaf cluster, six slender silver-green leaves with pale undersides and a thin woody stem. ${MAGENTA}`,
  },
  {
    file: 'dem-sao.png',
    prompt: `${REAL} One real cream tuberose spray, several small star-shaped ivory blossoms with six petals and a pale gold center, a slender green stem. ${MAGENTA}`,
  },
  {
    file: 'lua-kim.png',
    prompt: `${REAL} One real cream camellia blossom, layered satin petals with a gold-cream center, a short stem and one glossy bronze-green leaf. ${MAGENTA}`,
  },
  {
    file: 'lua-la.png',
    prompt: `${REAL} One real camellia leaf, glossy oval bronze-green blade, serrated edge, a clear midrib and a short petiole. ${MAGENTA}`,
  },
  {
    file: 'chua-nu.png',
    prompt: `${REAL} One real pink lotus bud, pointed closed petals with a soft blush tip, a green stem and one small round lotus leaf. ${MAGENTA}`,
  },
  {
    file: 'chua-gu.png',
    prompt: `${REAL} One real lotus seed pod, green-brown disc with seed holes, a short stem, photographed specimen. ${MAGENTA}`,
  },
  {
    file: 'ha-long-soi.png',
    prompt: `${REAL} One real grey weathered limestone pebble, karst texture with pits and a soft highlight, no carving, no flowers. ${MAGENTA}`,
  },
  {
    file: 'ha-long-rong.png',
    prompt: `${REAL} One real coastal mist grass sprig, slender grey-green blades with a slight curve and a few seed heads, photographed plant. ${MAGENTA}`,
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
      body: JSON.stringify({ model: 'gpt-image-2', prompt, n: 1, size: '1024x1024', quality: 'medium' }),
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

const dir = join('public', 'wedding', 'backgrounds', 'ornaments')
mkdirSync(dir, { recursive: true })

const force = process.argv.includes('--force')
const asked = process.argv.slice(2).filter((arg) => arg !== '--force')
const jobs = asked.length ? ITEMS.filter((item) => asked.includes(item.file)) : ITEMS
if (asked.length && jobs.length !== asked.length) {
  const known = new Set(ITEMS.map((item) => item.file))
  const missing = asked.filter((file) => !known.has(file))
  console.error(`Chưa có: ${missing.join(', ')}`)
  process.exit(1)
}

async function writeOne(item) {
  const dest = join(dir, item.file)
  if (!force && existsSync(dest)) {
    console.log(`skip ${item.file}`)
    return
  }
  console.log(`generating ${item.file}`)
  let lastError = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await generate(item.prompt)
      const keyed = await keyOut(raw)
      const box = cropBox(keyed.pixels, keyed.width, keyed.height)
      const png = await sharp(keyed.pixels, { raw: { width: keyed.width, height: keyed.height, channels: 4 } })
        .extract(box)
        .png()
        .toBuffer()
      writeFileSync(dest, png)
      console.log(`wrote ${item.file} ${box.width}x${box.height} leftover-magenta=${keyed.magenta}`)
      return
    } catch (error) {
      lastError = error
      console.error(`retry ${item.file}: ${error instanceof Error ? error.message : error}`)
    }
  }
  throw lastError
}

const queue = [...jobs]
const workers = Math.min(2, queue.length)
await Promise.all(
  Array.from({ length: workers }, async () => {
    while (queue.length) {
      const item = queue.shift()
      if (!item) return
      await writeOne(item)
    }
  }),
)
