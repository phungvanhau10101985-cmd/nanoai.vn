/**
 * Ảnh dài cho ô chủ đề: cả thiệp đã mở, rê chuột thì trượt tới hoa văn phía dưới.
 * Chạy khi dev server đang ở http://127.0.0.1:3000.
 * Một id: npx tsx scripts/build-wedding-sample-scroll.ts toi-gian-nau
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import sharp from 'sharp'
import { WEDDING_SAMPLE_CARDS } from '../src/lib/wedding/wedding-sample-cards'

/** Chạy trong trang. Chuỗi để esbuild không nhét helper __name vào trình duyệt. */
const PREPARE_SHEET = `async () => {
  const pick = () => {
    const mains = [...document.querySelectorAll('main')]
    return mains[mains.length - 1] || null
  }
  let sheet = pick()
  if (!sheet) return 0
  let prev = 0
  let stable = 0
  for (let i = 0; i < 40; i += 1) {
    sheet = pick() || sheet
    const count = sheet.querySelectorAll('section').length
    const h = Math.round(sheet.getBoundingClientRect().height)
    if (count >= 4 && h > 2500 && h === prev) stable += 1
    else stable = 0
    prev = h
    if (stable >= 2) break
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  const hide = document.createElement('style')
  hide.textContent = 'nav, nextjs-portal { display: none !important } .pt-12 { padding-top: 0 !important }'
  document.head.appendChild(hide)
  const showHidden = () => {
    sheet.querySelectorAll('[data-wedding-reveal]').forEach((node) => {
      if (!(node instanceof HTMLElement)) return
      node.dataset.weddingShown = '1'
      node.style.opacity = '1'
      node.style.transform = 'none'
      node.style.transition = 'none'
    })
    sheet.querySelectorAll('.wedding-open-line, .wedding-open-guest-name').forEach((node) => {
      if (!(node instanceof HTMLElement)) return
      node.style.animation = 'none'
      node.style.opacity = '1'
      node.style.transform = 'none'
    })
  }
  showHidden()
  const steps = Math.ceil(sheet.scrollHeight / 640)
  for (let step = 0; step < steps; step += 1) {
    window.scrollTo(0, step * 640)
    await new Promise((resolve) => setTimeout(resolve, 40))
  }
  window.scrollTo(0, sheet.scrollHeight)
  await new Promise((resolve) => setTimeout(resolve, 250))
  window.scrollTo(0, 0)
  showHidden()
  const imgs = [...sheet.querySelectorAll('img')]
  await Promise.all(imgs.map((img) => (
    img.complete && img.naturalWidth > 0
      ? Promise.resolve()
      : new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true })
          img.addEventListener('error', resolve, { once: true })
          setTimeout(resolve, 4000)
        })
  )))
  if (document.fonts?.ready) await document.fonts.ready
  showHidden()
  sheet.querySelectorAll('iframe').forEach((frame) => {
    const box = frame.parentElement
    if (box instanceof HTMLElement) box.style.display = 'none'
  })
  const mainTop = sheet.getBoundingClientRect().top + window.scrollY
  let bottom = 0
  for (const section of sheet.querySelectorAll('section, [data-wedding-glass]')) {
    const box = section.getBoundingClientRect()
    bottom = Math.max(bottom, box.bottom + window.scrollY - mainTop)
  }
  for (const img of sheet.querySelectorAll('img')) {
    if (!img.currentSrc.includes('/ornaments/')) continue
    bottom = Math.max(bottom, img.getBoundingClientRect().bottom + window.scrollY - mainTop)
  }
  return Math.ceil(bottom + 12)
}`

const root = process.cwd()
const outDir = path.join(root, 'public', 'wedding', 'sample-scroll')
const only = process.argv[2]?.trim()
const samples = only ? WEDDING_SAMPLE_CARDS.filter((sample) => sample.id === only) : WEDDING_SAMPLE_CARDS
if (samples.length === 0) throw new Error(`Không có mẫu ${only}`)

async function main() {
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
await page.addInitScript(() => {
  HTMLMediaElement.prototype.play = () => Promise.resolve()
})
await mkdir(outDir, { recursive: true })

let bytes = 0
for (const sample of samples) {
  const url = `http://127.0.0.1:3000/thiep-mau/${encodeURIComponent(sample.id)}?still=1`
  let raw: Buffer | null = null
  let contentBottom = 0
  for (let attempt = 0; attempt < 2 && !raw; attempt += 1) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    const card = page.locator('main').last()
    await card.waitFor({ timeout: 30_000 })
    contentBottom = Number(await page.evaluate(`(${PREPARE_SHEET})()`)) || 0
    if (contentBottom < 2500) continue
    try {
      raw = await card.screenshot({ type: 'png', animations: 'disabled' })
    } catch (error) {
      console.log(`${sample.id} FAIL ${error instanceof Error ? error.message.split('\n')[0] : 'screenshot'}`)
    }
  }
  if (!raw) {
    console.log(`${sample.id} FAIL short`)
    continue
  }
  const input = sharp(raw)
  const meta = await input.metadata()
  const width = meta.width || 390
  const full = meta.height || 1
  const height = Math.min(full, Math.max(Math.round(width * 3.2), contentBottom || full))
  const webp = await sharp(raw)
    .extract({ left: 0, top: 0, width, height })
    .resize({ width: 420, withoutEnlargement: true })
    .webp({ quality: 58 })
    .toBuffer()
  await writeFile(path.join(outDir, `${sample.id}.webp`), webp)
  bytes += webp.length
  console.log(`${sample.id} ${Math.round(webp.length / 1024)}KB ${width}x${height}`)
}

await browser.close()
console.log(`scroll ${samples.length} total ${Math.round(bytes / 1024)}KB`)
}

void main()
