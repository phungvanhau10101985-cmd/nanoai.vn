import { chromium } from '@playwright/test'

function arg(name, fallback = '') {
  const at = process.argv.indexOf(`--${name}`)
  return at >= 0 ? String(process.argv[at + 1] || '').trim() : fallback
}

const slug = arg('slug')
const base = arg('base', 'http://127.0.0.1:3000').replace(/\/+$/, '')
const product = arg('product')
const device = arg('device', 'mobile')
const navigationTimeoutMs = Math.max(10_000, Number(arg('timeout', '90000')) || 90_000)
if (!slug) {
  console.error('Usage: node scripts/measure-partner-storefront-payload.mjs --slug <site-slug> [--base http://127.0.0.1:3000] [--product <id>] [--device mobile|desktop]')
  process.exit(1)
}
if (!['mobile', 'desktop'].includes(device)) throw new Error('--device must be mobile or desktop')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: device === 'desktop' ? { width: 1440, height: 900 } : { width: 390, height: 844 },
})
const cdp = await page.context().newCDPSession(page)
await cdp.send('Network.enable')

const requests = new Map()
cdp.on('Network.requestWillBeSent', (event) => {
  requests.set(event.requestId, {
    url: event.request.url,
    type: event.type,
    bytes: 0,
  })
})
cdp.on('Network.loadingFinished', (event) => {
  const item = requests.get(event.requestId)
  if (item) item.bytes = Math.max(0, Number(event.encodedDataLength) || 0)
})

async function measure(path) {
  requests.clear()
  const started = Date.now()
  try {
    await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: navigationTimeoutMs })
  } catch (error) {
    return {
      path,
      requests: requests.size,
      totalBytes: 0,
      imageBytes: 0,
      apiBytes: 0,
      elapsedMs: Date.now() - started,
      overBudget: true,
      error: error instanceof Error ? error.message : String(error),
    }
  }
  await page.waitForTimeout(4_000)
  const rows = [...requests.values()]
  const total = rows.reduce((sum, row) => sum + row.bytes, 0)
  const image = rows.filter((row) => row.type === 'Image').reduce((sum, row) => sum + row.bytes, 0)
  const api = rows.filter((row) => /\/api\//.test(row.url)).reduce((sum, row) => sum + row.bytes, 0)
  return {
    path,
    requests: rows.length,
    totalBytes: total,
    imageBytes: image,
    apiBytes: api,
    elapsedMs: Date.now() - started,
    overBudget: total > 50 * 1024 * 1024 || image > 40 * 1024 * 1024 || api > 2 * 1024 * 1024,
  }
}

const encodedSlug = encodeURIComponent(slug)
const paths = [
  `/site/${encodedSlug}?pw-device=${device}`,
  `/site/${encodedSlug}/products?pw-device=${device}`,
]
if (product) paths.push(`/site/${encodedSlug}/products/${encodeURIComponent(product)}?pw-device=${device}`)

const results = []
for (const path of paths) results.push(await measure(path))
console.table(results)
await browser.close()

if (results.some((row) => row.overBudget)) process.exitCode = 2
