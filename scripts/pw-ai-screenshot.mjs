/**
 * Chụp storefront bằng Playwright để agent đọc PNG rồi sửa engine.
 *
 *   node scripts/pw-ai-screenshot.mjs --path / --device desktop
 *   node scripts/pw-ai-screenshot.mjs --path /products --device desktop,mobile --full-page
 *   node scripts/pw-ai-screenshot.mjs --url http://localhost:3000/site/SLUG?pw-device=mobile
 *   node scripts/pw-ai-screenshot.mjs --self-test
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const DEVICES = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  laptop: { width: 1280, height: 800 },
  desktop: { width: 1440, height: 900 },
}

const DEFAULT_BASE = process.env.PW_AI_BASE || process.env.SMOKE_BASE_URL || 'http://localhost:3000'
const DEFAULT_SLUG = process.env.PW_AI_SLUG || '188-com-vn-rl56'

export function parseArgs(argv) {
  const out = {
    url: '',
    path: '',
    slug: DEFAULT_SLUG,
    base: DEFAULT_BASE,
    device: ['desktop'],
    fullPage: false,
    selector: '',
    wait: '',
    scroll: 0,
    name: '',
    out: path.join('tmp', 'pw-ai-shots'),
    headed: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i] || ''
    if (a === '--url') out.url = next()
    else if (a === '--path') out.path = next()
    else if (a === '--slug') out.slug = next()
    else if (a === '--base') out.base = next()
    else if (a === '--device') out.device = parseDevices(next())
    else if (a === '--full-page') out.fullPage = true
    else if (a === '--selector') out.selector = next()
    else if (a === '--wait') out.wait = next()
    else if (a === '--scroll') out.scroll = Number(next()) || 0
    else if (a === '--name') out.name = next()
    else if (a === '--out') out.out = next()
    else if (a === '--headed') out.headed = true
  }
  return out
}

export function parseDevices(raw) {
  const text = String(raw || '').trim().toLowerCase()
  if (!text || text === 'all') return Object.keys(DEVICES)
  const list = text.split(',').map((d) => d.trim()).filter(Boolean)
  const unknown = list.filter((d) => !DEVICES[d])
  if (unknown.length) {
    throw new Error(`Unknown --device ${unknown.join(', ')}. Use mobile|tablet|laptop|desktop|all`)
  }
  return list
}

export function withDeviceQuery(url, device) {
  const parsed = new URL(url)
  if (!parsed.searchParams.get('pw-device')) parsed.searchParams.set('pw-device', device)
  return parsed.toString()
}

export function resolveShotUrl(opts, device) {
  if (opts.url) return withDeviceQuery(opts.url, device)
  const slug = String(opts.slug || '').replace(/^\/+|\/+$/g, '')
  let pathname = String(opts.path || '/').trim() || '/'
  if (!pathname.startsWith('/')) pathname = `/${pathname}`
  if (pathname === '/' || pathname === '') pathname = `/site/${slug}`
  else if (!pathname.startsWith('/site/') && !pathname.startsWith('/dashboard/')) {
    pathname = `/site/${slug}${pathname === '/' ? '' : pathname}`
  }
  const base = String(opts.base || DEFAULT_BASE).replace(/\/+$/, '')
  return withDeviceQuery(`${base}${pathname}`, device)
}

function stampDir() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

async function launchBrowser(headed) {
  const common = { headless: !headed }
  try {
    return await chromium.launch({ ...common, channel: 'msedge' })
  } catch {
    return await chromium.launch(common)
  }
}

async function capture(opts) {
  const runDir = path.resolve(opts.out, stampDir())
  await mkdir(runDir, { recursive: true })
  const browser = await launchBrowser(opts.headed)
  const shots = []
  try {
    for (const device of opts.device) {
      const viewport = DEVICES[device]
      const url = resolveShotUrl(opts, device)
      const context = await browser.newContext({
        viewport,
        locale: 'vi-VN',
        colorScheme: 'light',
        deviceScaleFactor: 1,
      })
      const page = await context.newPage()
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      const status = response?.status() ?? 0
      if (status >= 500) {
        throw new Error(`${url} returned ${status}. Start the app with npm run dev.`)
      }
      if (opts.wait) await page.waitForSelector(opts.wait, { timeout: 20_000 })
      else {
        await page.waitForSelector('body', { timeout: 20_000 })
        await page.waitForTimeout(800)
      }
      if (opts.scroll > 0) {
        await page.evaluate((y) => window.scrollTo(0, y), opts.scroll)
        await page.waitForTimeout(250)
      }
      const file = `${opts.name ? `${opts.name}-` : ''}${device}.png`
      const filePath = path.join(runDir, file)
      if (opts.selector) {
        const el = page.locator(opts.selector).first()
        await el.waitFor({ state: 'visible', timeout: 15_000 })
        await el.screenshot({ path: filePath, animations: 'disabled' })
      } else {
        await page.screenshot({
          path: filePath,
          fullPage: opts.fullPage,
          animations: 'disabled',
        })
      }
      shots.push({ device, url, status, file: filePath, viewport })
      await context.close()
    }
  } finally {
    await browser.close()
  }

  const manifest = { createdAt: new Date().toISOString(), dir: runDir, shots }
  const manifestPath = path.join(runDir, 'manifest.json')
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return { ...manifest, manifest: manifestPath }
}

function selfTest() {
  const opts = parseArgs([
    '--path',
    '/products',
    '--device',
    'desktop,mobile',
    '--slug',
    'demo-shop',
    '--base',
    'http://localhost:3000',
  ])
  if (opts.device.join(',') !== 'desktop,mobile') throw new Error('parseDevices failed')
  const desktop = resolveShotUrl(opts, 'desktop')
  if (desktop !== 'http://localhost:3000/site/demo-shop/products?pw-device=desktop') {
    throw new Error(`resolveShotUrl failed: ${desktop}`)
  }
  const locked = withDeviceQuery('http://localhost:3000/site/x?pw-device=tablet', 'mobile')
  if (locked !== 'http://localhost:3000/site/x?pw-device=tablet') {
    throw new Error(`pw-device must keep existing lock: ${locked}`)
  }
  console.log(JSON.stringify({ ok: true, desktop, locked }, null, 2))
}

const invokedAsCli = path.basename(process.argv[1] || '') === 'pw-ai-screenshot.mjs'

if (process.argv.includes('--self-test')) {
  selfTest()
} else if (invokedAsCli) {
  const opts = parseArgs(process.argv.slice(2))
  capture(opts)
    .then((manifest) => {
      console.log(JSON.stringify(manifest, null, 2))
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err)
      console.error(message)
      if (/ECONNREFUSED|ERR_CONNECTION_REFUSED|net::ERR/i.test(message)) {
        console.error('Dev server is down. Run npm run dev, then retry the shot.')
      }
      process.exit(1)
    })
}
