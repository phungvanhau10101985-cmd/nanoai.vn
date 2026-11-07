/**
 * Mỗi chủ đề 6 ảnh trang phục: váy cô dâu và trang phục chú rể trong cùng một khung.
 * Chạy: node scripts/generate-wedding-outfit-sets.mjs [familyId ...]
 * Model: gpt-image-2, quality medium. Bỏ qua file đã có. Không in khóa API.
 */
import { config } from 'dotenv'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

config({ path: '.env' })
config({ path: '.env.local', override: true })

const briefs = JSON.parse(readFileSync(new URL('../src/lib/wedding/wedding-outfit-briefs.json', import.meta.url), 'utf8'))

const REAL = [
  'A real studio photograph of wedding clothes only.',
  'No people, no mannequin, no head, no hands, no skin, no face.',
  'Left: one bridal gown, full length, hanging so the weave and the seams show.',
  'Right: one groom outfit, full length.',
  'Both garments are in this one photograph, side by side, with a gap between them.',
  'Seamless plain paper backdrop in a color taken from the invitation, not a copy of the invitation.',
  'Natural daylight from the side. Cloth shows weave, stitching, and a soft sheen.',
  'The bridal gown is not black, not charcoal, not ink, not near-black, and not a black lace dress.',
  'No text, no letters, no logo, no watermark, no frame.',
  'Not a cartoon, not an illustration, not watercolor, not a pencil drawing, not a vector, not a flat icon.',
].join(' ')

const VARIANTS = [
  'Set 1. Sweetheart neckline, A-line gown. The motif is small and only at the hem. Groom: single-breasted jacket, no vest.',
  'Set 2. High-neck column gown. The motif is a fine tone-on-tone weave over the whole cloth. Groom: waistcoat and a band-collar shirt, no jacket.',
  'Set 3. Off-shoulder ball gown. The motif is larger than set 1, still the same flower or geometry. Groom: double-breasted jacket.',
  'Set 4. Long-sleeve modest gown. The motif sits on the cuffs and the waist. Groom wears the other cloth of the palette: linen if set 1 was silk, silk if set 1 was linen.',
  'Set 5. Ao dai, or a slip gown with a short capelet when an ao dai does not fit the palette. The motif is only on the side seam. Groom: matching ao dai, or a suit with no tie.',
  'Set 6. Tea-length gown with a square neckline. The motif is the finest of the six, almost plain, with one border. This gown is the lightest color of the palette. Groom: shawl-collar jacket.',
]

function promptFor(brief, index) {
  const paper = brief.plate
    ? 'The attached image is the invitation paper. Use it only for the color family and the flower or motif. Do not paste that paper onto the clothes. Do not copy any letters.'
    : ''
  return [REAL, brief.dress, 'The bridal gown is never black.', VARIANTS[index], paper].filter(Boolean).join(' ')
}

async function callImage({ prompt, image }) {
  const key = (process.env.OPENAI_API_KEY || '').trim()
  if (key.length < 10) throw new Error('Thiếu OPENAI_API_KEY')
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 300000)
  try {
    let res
    if (!image) {
      res = await fetch('https://api.openai.com/v1/images/generations', {
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
    } else {
      const form = new FormData()
      form.set('model', 'gpt-image-2')
      form.set('prompt', prompt)
      form.set('n', '1')
      form.set('size', '1536x1024')
      form.set('quality', 'medium')
      form.append('image', new Blob([image], { type: 'image/jpeg' }), 'paper.jpg')
      res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: form,
        signal: ac.signal,
      })
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 240)}`)
    const json = await res.json()
    const b64 = json?.data?.[0]?.b64_json
    if (!b64) throw new Error('OpenAI không trả b64_json')
    return Buffer.from(b64, 'base64')
  } finally {
    clearTimeout(timer)
  }
}

async function callImageRetry(args) {
  let wait = 4000
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await callImage(args)
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

const asked = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
const ids = asked.length ? asked : Object.keys(briefs)
for (const id of ids) {
  if (!briefs[id]) {
    console.error(`Chưa có chủ đề "${id}".`)
    process.exit(1)
  }
}

const jobs = []
for (const id of ids) {
  const dir = join('public', 'wedding', 'outfits', id)
  mkdirSync(dir, { recursive: true })
  for (let index = 0; index < 6; index += 1) {
    const file = join(dir, `${index + 1}.webp`)
    if (existsSync(file)) continue
    jobs.push({ id, index, file })
  }
}

let cursor = 0
async function worker() {
  while (cursor < jobs.length) {
    const job = jobs[cursor]
    cursor += 1
    const brief = briefs[job.id]
    const plate = brief.plate ? join('public', brief.plate.replace(/^\//, '')) : ''
    const image = plate && existsSync(plate) ? readFileSync(plate) : null
    console.log(`start ${job.id} ${job.index + 1}`)
    try {
      const raw = await callImageRetry({ prompt: promptFor(brief, job.index), image })
      const webp = await sharp(raw).webp({ quality: 82, effort: 4 }).toBuffer()
      writeFileSync(job.file, webp)
      console.log(`saved ${job.id} ${job.index + 1} ${webp.length}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'loi'
      console.log(`fail ${job.id} ${job.index + 1} ${message.slice(0, 160)}`)
    }
  }
}

console.log(`jobs ${jobs.length}`)
await Promise.all([worker(), worker(), worker()])
console.log('done')
