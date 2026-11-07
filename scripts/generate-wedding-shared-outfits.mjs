/**
 * Bốn bộ trang phục dùng chung mọi chủ đề.
 * Váy dài trắng, hoa văn cưới gắn kim sa cườm. Vest đen hoặc xám cơ bản.
 * Chạy: node scripts/generate-wedding-shared-outfits.mjs
 * Model: gpt-image-2, quality medium. Bỏ qua file đã có. Không in khóa API.
 */
import { config } from 'dotenv'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

config({ path: '.env' })
config({ path: '.env.local', override: true })

const REAL = [
  'A real studio photograph of wedding clothes only.',
  'No people, no mannequin, no head, no hands, no skin, no face.',
  'Left: one bridal gown, floor length, hanging so the weave, seams, sequins, and beads show.',
  'Right: one groom suit, full length, hanging.',
  'Both garments are in this one photograph, side by side, with a gap between them.',
  'Seamless warm-white paper backdrop. Do not use a colored invitation, flowers as a scene, or a landmark.',
  'Natural daylight from the side.',
  'The gown is bright white, not ivory, not champagne, not blush, not gold, not black, not charcoal.',
  'Sequins and beads are sewn on: each sequin has a hole and a thread, beads sit in rows, not a flat glitter filter.',
  'The suit cloth is plain worsted wool, no brocade, no gold thread, no floral print.',
  'No text, no letters, no logo, no watermark, no frame.',
  'Not a cartoon, not an illustration, not watercolor, not a pencil drawing, not a vector, not a flat icon.',
].join(' ')

const SETS = [
  'Set 1. Floor-length white A-line gown, sweetheart neckline. Bridal floral lace with sewn sequins and seed beads on the bodice and a border at the hem. Groom: basic black two-piece suit, notch lapel, white shirt, plain black necktie, no waistcoat.',
  'Set 2. Floor-length white column gown, high neck. A fine wedding vine of beads and sequins from neckline to hem. Groom: basic medium-gray two-piece suit, notch lapel, white shirt, no tie, plain gray trousers.',
  'Set 3. Floor-length white ball gown, off-the-shoulder. Larger white-on-white floral motif in sequins and pearl beads across the skirt. Groom: basic black two-button suit, notch lapel, white shirt, simple black necktie, no pattern.',
  'Set 4. Floor-length white long-sleeve gown, boat neck. Wedding scrollwork in beads and sequins at the cuffs, waist, and hem. Groom: basic charcoal-gray suit, white shirt, narrow gray tie, no brocade.',
]

async function callImage(prompt) {
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
        size: '1536x1024',
        quality: 'medium',
      }),
      signal: ac.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 240)}`)
    const json = await res.json()
    const b64 = json?.data?.[0]?.b64_json
    if (!b64) throw new Error('OpenAI không trả b64_json')
    return Buffer.from(b64, 'base64')
  } finally {
    clearTimeout(timer)
  }
}

async function callImageRetry(prompt) {
  let wait = 4000
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await callImage(prompt)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'loi'
      const retry = /HTTP (429|500|502|503)/.test(message) || message.includes('aborted')
      if (!retry || attempt === 4) throw err
      console.log(`retry ${attempt}`)
      await new Promise((resolve) => setTimeout(resolve, wait))
      wait *= 2
    }
  }
  throw new Error('retry_exhausted')
}

const dir = join('public', 'wedding', 'outfits', 'shared')
mkdirSync(dir, { recursive: true })
const jobs = SETS.map((variant, index) => ({
  index,
  file: join(dir, `${index + 1}.webp`),
  prompt: [REAL, variant].join(' '),
})).filter((job) => !existsSync(job.file))

let cursor = 0
async function worker() {
  while (cursor < jobs.length) {
    const job = jobs[cursor]
    cursor += 1
    console.log(`start shared ${job.index + 1}`)
    try {
      const raw = await callImageRetry(job.prompt)
      const webp = await sharp(raw).webp({ quality: 82, effort: 4 }).toBuffer()
      writeFileSync(job.file, webp)
      console.log(`saved shared ${job.index + 1} ${webp.length}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'loi'
      console.log(`fail shared ${job.index + 1} ${message.slice(0, 160)}`)
    }
  }
}

console.log(`jobs ${jobs.length}`)
await Promise.all([worker(), worker()])
console.log('done')
