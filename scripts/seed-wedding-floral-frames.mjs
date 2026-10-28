/**
 * Khung ảnh thiệp gốc: vòng hoa khép, nền giấy phẳng, đục theo mép cánh.
 * Không dùng ảnh Pinterest. Chạy tuần tự, một khung một lần (máy 16 GB):
 *   node scripts/seed-wedding-floral-frames.mjs --limit 50
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai'
import pg from 'pg'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(root, '.env.local') })
dotenv.config({ path: path.join(root, '.env') })

const MODEL = process.env.WEDDING_FRAME_MODEL || 'gemini-3.1-flash-image'
const workDir = path.join(root, 'tmp', 'wedding-floral-frames')
const rembgScript = path.join(root, 'scripts', 'rembg-wedding-frame.py')
const rembgPython = path.join(root, 'tmp', 'rembg-venv', 'Scripts', 'python.exe')

/** id, hoa, bảng màu, lỗ, panel, ink */
const FRAMES = [
  ['blush-peony', 'blush peonies, white daisies, pink buds and olive leaves, fuller at the corners', 'blush, ivory, sage', 'large vertical ellipse', '#fff5f7', 'dark'],
  ['garden-rose', 'white and cream garden roses with eucalyptus', 'ivory, white, sage', 'large vertical ellipse', '#f7f6f2', 'dark'],
  ['scarlet-peony', 'deep red peonies and small gold leaves', 'scarlet, gold, ivory', 'large vertical ellipse', '#fff6f4', 'dark'],
  ['lotus-arch', 'white lotus, pale pink buds and slender reeds', 'ivory, lotus pink, soft green', 'tall doorway arch with a round top', '#fff8f3', 'dark'],
  ['cherry-circle', 'cherry blossom branches and a few small leaves', 'pale pink, white, brown twig', 'large circle', '#fff7f8', 'dark'],
  ['dried-oval', 'dried roses, pampas and beige grasses', 'sand, rust, cream', 'large vertical rounded rectangle', '#f6efe6', 'dark'],
  ['lavender-ellipse', 'lavender spikes and tiny white fillers', 'lavender, sage, ivory', 'large vertical ellipse', '#f6f4fb', 'dark'],
  ['sunflower-meadow', 'sunflowers, chamomile and meadow grass', 'golden yellow, cream, olive', 'large vertical rounded rectangle', '#fffaf0', 'dark'],
  ['hydrangea-blue', 'blue and periwinkle hydrangea with soft green leaves', 'dusty blue, white, sage', 'large vertical ellipse', '#f4f7fb', 'dark'],
  ['orchid-arch', 'white phalaenopsis orchids and a few buds', 'white, blush, pale green', 'tall doorway arch', '#f8f7f4', 'dark'],
  ['burgundy-gold', 'burgundy roses and fine gold line leaves', 'burgundy, champagne gold, ivory', 'large vertical ellipse', '#fbf6f6', 'dark'],
  ['peach-ranunculus', 'peach ranunculus and small berries', 'peach, apricot, sage', 'large vertical ellipse', '#fff6f1', 'dark'],
  ['magnolia-circle', 'cream magnolia blossoms and glossy leaves', 'cream, white, deep green', 'large circle', '#f7f6f3', 'dark'],
  ['calla-arch', 'a few white calla lilies and long leaves, airy not dense', 'white, pale green, ivory', 'tall doorway arch', '#f7f7f5', 'dark'],
  ['tulip-spring', 'pastel tulips in pink, cream and soft yellow', 'pastel pink, butter, leaf green', 'large vertical rounded rectangle', '#fff8f4', 'dark'],
  ['breath-ellipse', 'cloud of baby\'s breath with a few tiny roses', 'white, blush, sage', 'large vertical ellipse', '#fbfaf8', 'dark'],
  ['camellia-circle', 'red camellias and dark glossy leaves', 'crimson, deep green, ivory', 'large circle', '#fff5f5', 'dark'],
  ['jasmine-night', 'white jasmine on dark green leaves, evening mood', 'white flower, deep green, soft gold', 'tall doorway arch', '#14201a', 'light'],
  ['protea-tropic', 'blush protea, banksia and olive', 'blush, sand, olive', 'large vertical rounded rectangle', '#f8f4ef', 'dark'],
  ['coral-dahlia', 'coral dahlias and fine ferns', 'coral, cream, fern green', 'large vertical ellipse', '#fff5f2', 'dark'],
  ['anemone-blue', 'white anemones with blue centers and black stems', 'white, ink blue, green', 'large vertical ellipse', '#f6f7f8', 'dark'],
  ['poppy-meadow', 'red poppies and wild grasses', 'poppy red, sage, cream', 'large vertical rounded rectangle', '#fff6f4', 'dark'],
  ['wisteria-arch', 'hanging wisteria and a few leaves', 'lilac, white, soft green', 'tall doorway arch', '#f7f5fb', 'dark'],
  ['olive-minimal', 'a thin closed olive wreath, few leaves, elegant and sparse', 'olive, sage, ivory', 'large vertical ellipse', '#f6f7f3', 'dark'],
  ['fern-circle', 'pressed ferns and tiny white flowers', 'forest green, cream', 'large circle', '#f4f7f4', 'dark'],
  ['gold-rose-line', 'champagne roses with fine gold botanical linework', 'champagne, gold, ivory', 'large vertical ellipse', '#fffaf2', 'dark'],
  ['watercolor-peony', 'loose watercolor peonies and leaves, still one flat paper color behind', 'rose water, sage, ivory', 'large vertical ellipse', '#fff6f8', 'dark'],
  ['pressed-flower', 'pressed violets, daisies and ferns, flat and delicate', 'violet, cream, olive', 'large vertical ellipse', '#f7f5f8', 'dark'],
  ['moody-rose', 'deep wine roses on near-black foliage', 'wine, black-green, gold edge', 'large vertical ellipse', '#1a1214', 'light'],
  ['eucalyptus-sage', 'only eucalyptus and seeded eucalyptus, no big blooms', 'sage, silver green, ivory', 'large vertical ellipse', '#f3f6f3', 'dark'],
  ['plum-orchid', 'plum cymbidium orchids', 'plum, cream, moss', 'tall doorway arch', '#f8f4f6', 'dark'],
  ['mimosa-yellow', 'mimosa puffs and thin stems', 'lemon, cream, olive', 'large vertical rounded rectangle', '#fffbea', 'dark'],
  ['sweet-pea', 'pink sweet peas and curling tendrils', 'sweet pink, white, green', 'large vertical ellipse', '#fff5f8', 'dark'],
  ['lily-valley', 'lily of the valley bells and long leaves', 'white, apple green, ivory', 'large vertical ellipse', '#f5f8f4', 'dark'],
  ['gerbera-circle', 'coral and cream gerberas', 'coral, cream, leaf', 'large circle', '#fff6f3', 'dark'],
  ['cosmos-meadow', 'pink cosmos and fine stems', 'cosmos pink, white, green', 'large vertical ellipse', '#fff7f8', 'dark'],
  ['zinnia-garden', 'zinnias in coral, yellow and pink', 'coral, sunflower, pink', 'large vertical rounded rectangle', '#fff8f2', 'dark'],
  ['marigold-tradition', 'orange marigolds and a few gold leaves, Vietnamese wedding mood', 'marigold, gold, deep green', 'large vertical ellipse', '#fff6ea', 'dark'],
  ['plum-bamboo', 'plum blossoms and a few bamboo leaves', 'blush, ink branch, bamboo green', 'tall doorway arch', '#fff7f5', 'dark'],
  ['pearl-rose', 'cream roses with a short strand of pearls, not a photo of jewelry', 'pearl, cream, blush', 'large vertical ellipse', '#fbf8f4', 'dark'],
  ['butterfly-bloom', 'small butterflies among tiny blossoms and leaves, wings closed or open, no text', 'blush, cream, sage', 'large vertical ellipse', '#fff7f6', 'dark'],
  ['autumn-berry', 'muted roses, rose hips and a few maple leaves', 'rust, burgundy, olive', 'large vertical rounded rectangle', '#f8f1ea', 'dark'],
  ['winter-berry', 'eucalyptus and small red berries', 'sage, berry red, ivory', 'large vertical ellipse', '#f5f6f4', 'dark'],
  ['plumeria-arch', 'white and yellow plumeria', 'white, butter yellow, green', 'tall doorway arch', '#fffaf4', 'dark'],
  ['iris-purple', 'purple iris and sword leaves', 'iris purple, yellow signal, green', 'large vertical ellipse', '#f6f4f8', 'dark'],
  ['freesia-yellow', 'yellow and cream freesia', 'lemon, cream, green', 'large vertical ellipse', '#fffbe8', 'dark'],
  ['lilac-arch', 'lilac clusters and small leaves', 'lilac, white, green', 'tall doorway arch', '#f7f4fa', 'dark'],
  ['meadow-mix', 'a mixed meadow wreath: daisies, clover, buttercups and grass', 'white, butter, clover green', 'large vertical rounded rectangle', '#f8f8f2', 'dark'],
  ['heart-rose', 'pink roses and tiny leaves following a heart opening', 'rose pink, cream, sage', 'large classic heart, point at the bottom', '#fff5f7', 'dark'],
  ['diamond-gold', 'fine gold leaves and small white blossoms following a diamond opening', 'gold, ivory, sage', 'large diamond with points at top, bottom, left and right', '#fffaf2', 'dark'],
]

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
]

function parseArgs(argv) {
  const out = { limit: 50, id: '', probe: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--limit') out.limit = Number(argv[++i])
    else if (arg === '--id') out.id = argv[++i]
    else if (arg === '--probe') out.probe = true
    else if (arg === '--concurrency') i += 1
  }
  return out
}

function promptFor(row) {
  const [, flowers, palette, opening] = row
  return [
    'Create one original wedding photo frame, portrait 3:4.',
    'The frame is only flowers, leaves and stems forming one closed wreath.',
    'The wreath may be fuller in the corners, but stems and leaves must connect all the way around.',
    'The center opening must be fully enclosed. No gap of blank paper may connect the center to the outer edge.',
    `The empty center opening is a ${opening}.`,
    `Flowers: ${flowers}.`,
    `Palette: ${palette}.`,
    'The entire canvas behind the wreath, including the center opening and the outer margins, is one flat solid color #F4F1EA.',
    'No paper texture, no gradient, no vignette, no drop shadow on the paper, no text, no people, no watermark, no photo.',
    'Photorealistic petals. Light may model the flowers, but the paper stays the same flat #F4F1EA.',
  ].join('\n')
}

function runKnock(src, dst) {
  return new Promise((resolve, reject) => {
    const child = spawn(rembgPython, [rembgScript, src, dst], {
      cwd: root,
      env: { ...process.env, OMP_NUM_THREADS: '1', ONNX_NUM_THREADS: '1' },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `knock exit ${code}`))
        return
      }
      try {
        resolve(JSON.parse(stdout.trim()))
      } catch (error) {
        reject(error)
      }
    })
  })
}

function holeOk(stats) {
  const hole = stats?.hole
  if (!hole?.enclosed) return false
  if (hole.w < 22 || hole.h < 22) return false
  if (hole.x < 0 || hole.y < 0 || hole.x + hole.w > 100.5 || hole.y + hole.h > 100.5) return false
  if (stats.removedPct < 28 || stats.removedPct > 88) return false
  if (hole.areaPct < 12 || hole.areaPct > 70) return false
  return true
}

async function generateRaw(model, row, dest) {
  const result = await model.generateContent(promptFor(row), { safetySettings })
  const parts = result.response.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find((part) => part.inlineData?.data)
  if (!imagePart?.inlineData?.data) {
    const reason = result.response.candidates?.[0]?.finishReason || result.response.promptFeedback?.blockReason || 'no image'
    throw new Error(String(reason))
  }
  const tmp = `${dest}.tmp`
  writeFileSync(tmp, Buffer.from(imagePart.inlineData.data, 'base64'))
  renameSync(tmp, dest)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const BUNNY_HOSTS = [
  'storage.bunnycdn.com',
  'sg.storage.bunnycdn.com',
  'uk.storage.bunnycdn.com',
  'ny.storage.bunnycdn.com',
  'la.storage.bunnycdn.com',
  'se.storage.bunnycdn.com',
  'br.storage.bunnycdn.com',
  'jh.storage.bunnycdn.com',
  'syd.storage.bunnycdn.com',
  'mi.storage.bunnycdn.com',
]

let bunnyHost = ''

function bunnyHostOrder() {
  const region = String(process.env.BUNNY_PLATFORM_STORAGE_REGION || 'DE').trim().toUpperCase()
  const preferred = region === 'SG' ? 'sg.storage.bunnycdn.com' : 'storage.bunnycdn.com'
  const first = bunnyHost || preferred
  return [first, ...BUNNY_HOSTS.filter((host) => host !== first)]
}

async function uploadWebp(id, webp) {
  const zone = process.env.BUNNY_STORAGE_ZONE.trim()
  const accessKey = process.env.BUNNY_STORAGE_API_KEY.trim()
  const publicBase = process.env.BUNNY_STORAGE_PUBLIC_BASE_URL.trim().replace(/\/$/, '')
  const objectPath = `wedding/frames/floral/${id}.webp`
  let last = 'Bunny upload failed'
  for (const host of bunnyHostOrder()) {
    const endpoint = `https://${host}/${encodeURIComponent(zone)}/${objectPath}`
    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: { AccessKey: accessKey, 'Content-Type': 'image/webp' },
      body: webp,
    })
    if (res.ok) {
      bunnyHost = host
      return `${publicBase}/${objectPath}`
    }
    const hint = await res.text().catch(() => '')
    last = `Bunny ${host} ${res.status} ${hint.slice(0, 80)}`
    if (res.status !== 401) break
  }
  throw new Error(last)
}

async function saveLibrary(pool, imageUrl, hole, panel, ink) {
  await pool.query(
    `insert into public.wedding_cover_frame_library (image_url, hole, panel, ink, reference_image_url)
     values ($1, $2::jsonb, $3, $4, '')
     on conflict (image_url) do update set
       hole = excluded.hole,
       panel = excluded.panel,
       ink = excluded.ink`,
    [imageUrl, JSON.stringify(hole), panel, ink],
  )
}

async function shrinkForKnock(rawPath, sizedPath) {
  await sharp(rawPath)
    .resize({ width: 1200, height: 1600, fit: 'inside', withoutEnlargement: true })
    .png()
    .toFile(sizedPath)
}

async function buildOne(model, pool, row) {
  const [id, , , , panel, ink] = row
  const dir = path.join(workDir, id)
  mkdirSync(dir, { recursive: true })
  const rawPath = path.join(dir, 'raw.png')
  const sizedPath = path.join(dir, 'sized.png')
  const cutPath = path.join(dir, 'cut.png')
  let stats = null
  let lastError = ''
  const reusable = existsSync(rawPath) && statSync(rawPath).size > 200_000
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      if (attempt > 1 || !reusable) await generateRaw(model, row, rawPath)
      await shrinkForKnock(rawPath, sizedPath)
      stats = await runKnock(sizedPath, cutPath)
      if (holeOk(stats)) break
      lastError = JSON.stringify(stats.hole)
      stats = null
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      stats = null
      if (attempt < 3) await sleep(5000)
    }
  }
  if (!stats) throw new Error(`lỗ không kín (${lastError})`)
  const webp = await sharp(cutPath).webp({ quality: 92, alphaQuality: 100 }).toBuffer()
  const imageUrl = await uploadWebp(id, webp)
  await saveLibrary(pool, imageUrl, {
    x: stats.hole.x,
    y: stats.hole.y,
    w: stats.hole.w,
    h: stats.hole.h,
  }, panel, ink)
  return { id, imageUrl, hole: stats.hole, removedPct: stats.removedPct }
}

function note(line) {
  mkdirSync(workDir, { recursive: true })
  writeFileSync(path.join(workDir, 'progress.log'), `${line}\n`, { flag: 'a' })
  console.log(line)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.probe) {
    const url = await uploadWebp('_probe', Buffer.from('probe'))
    note(`probe ${bunnyHost} ${url}`)
    return
  }
  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) throw new Error('Thiếu GOOGLE_API_KEY')
  const selected = FRAMES.filter((row) => !args.id || row[0] === args.id).slice(0, args.limit)
  if (!selected.length) throw new Error('Không có khung nào khớp.')
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: '2K', aspectRatio: '3:4' },
    },
  })
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
  mkdirSync(workDir, { recursive: true })
  const existing = await pool.query(
    `select image_url from public.wedding_cover_frame_library where image_url like '%/wedding/frames/floral/%'`,
  )
  const have = new Set(existing.rows.map((row) => String(row.image_url)))
  let done = 0
  const failures = []
  note(`tuần tự ${selected.length} khung, một lần một khung`)
  for (const row of selected) {
    const id = row[0]
    const already = [...have].some((url) => url.endsWith(`/wedding/frames/floral/${id}.webp`))
    if (already) {
      done += 1
      note(`[${done}/${selected.length}] skip ${id}`)
      continue
    }
    const started = Date.now()
    try {
      const result = await buildOne(model, pool, row)
      done += 1
      note(`[${done}/${selected.length}] ${result.id} hole ${result.hole.w}x${result.hole.h} ${Math.round((Date.now() - started) / 1000)}s`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`${id}: ${message}`)
      note(`FAIL ${id}: ${message}`)
    }
  }
  await pool.end()
  writeFileSync(path.join(workDir, 'failures.json'), JSON.stringify(failures, null, 2))
  note(`xong ${done}, lỗi ${failures.length}`)
  if (failures.length) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
