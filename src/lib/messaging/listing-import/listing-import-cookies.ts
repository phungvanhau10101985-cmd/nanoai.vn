import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { BrowserContext, Page } from 'playwright'
import { fetchListingImportSettingsFromPg } from '@/lib/db/messaging-partner-listing-import-pg'

export type ListingImportPlaywrightCookie = {
  name: string
  value: string
  domain: string
  path: string
  expires?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

const HOST_SEED_URLS: Record<string, string> = {
  'vipomall.vn': 'https://vipomall.vn/',
  'taobao.com': 'https://www.taobao.com/',
  'tmall.com': 'https://www.tmall.com/',
  '1688.com': 'https://www.1688.com/',
  'alibaba.com': 'https://www.alibaba.com/',
  'pandamall.vn': 'https://pandamall.vn/',
  'cssbuy.com': 'https://www.cssbuy.com/',
}

export function normalizePlaywrightCookie(
  item: Record<string, unknown>,
  defaultDomain = ''
): ListingImportPlaywrightCookie | null {
  const name = String(item.name || '').trim()
  if (!name || item.value == null) return null
  const value = String(item.value)
  let domain = String(item.domain || defaultDomain || '').trim()
  if (domain.startsWith('http')) {
    try {
      domain = new URL(domain).hostname || domain
    } catch {
      /* keep */
    }
  }
  if (!domain) return null
  const cookiePath = String(item.path || '/').trim() || '/'
  const out: ListingImportPlaywrightCookie = { name, value, domain, path: cookiePath }

  let exp: unknown = item.expires
  if (exp == null && item.expirationDate != null) exp = item.expirationDate
  if (exp == null && item.expiry != null) exp = item.expiry
  if (exp != null) {
    const n = Number(exp)
    if (Number.isFinite(n)) out.expires = Math.trunc(n)
  }
  if (typeof item.httpOnly === 'boolean') out.httpOnly = item.httpOnly
  if (typeof item.secure === 'boolean') out.secure = item.secure
  const ss = item.sameSite
  if (typeof ss === 'string' && ss.trim()) {
    const mp: Record<string, 'Strict' | 'Lax' | 'None'> = {
      no_restriction: 'None',
      strict: 'Strict',
      lax: 'Lax',
      none: 'None',
    }
    const sv = ss.trim().toLowerCase().replace(/-/g, '_')
    if (mp[sv]) out.sameSite = mp[sv]
  }
  return out
}

export function parseCookieText(cookieText: string, defaultDomain = ''): ListingImportPlaywrightCookie[] {
  const text = (cookieText || '').trim()
  if (!text) return []
  if (text.startsWith('[') || text.startsWith('{')) {
    const data = JSON.parse(text) as unknown
    const cookies = data && typeof data === 'object' && !Array.isArray(data) ? (data as { cookies?: unknown }).cookies : data
    if (!Array.isArray(cookies)) throw new Error('JSON cookie phải là list hoặc object có key cookies.')
    const out: ListingImportPlaywrightCookie[] = []
    for (const item of cookies) {
      if (!item || typeof item !== 'object') continue
      const nc = normalizePlaywrightCookie(item as Record<string, unknown>, defaultDomain)
      if (nc) out.push(nc)
    }
    return out
  }
  const out: ListingImportPlaywrightCookie[] = []
  for (const part of text.split(';')) {
    if (!part.includes('=')) continue
    const idx = part.indexOf('=')
    const name = part.slice(0, idx).trim()
    if (!name) continue
    const nc = normalizePlaywrightCookie(
      { name, value: part.slice(idx + 1).trim(), domain: defaultDomain || '.vipomall.vn', path: '/' },
      defaultDomain
    )
    if (nc) out.push(nc)
  }
  return out
}

function cookieKey(c: ListingImportPlaywrightCookie): string {
  return `${c.domain}\0${c.name}\0${c.path}`
}

function mergeCookieLists(
  base: ListingImportPlaywrightCookie[],
  overlay: ListingImportPlaywrightCookie[]
): ListingImportPlaywrightCookie[] {
  const map = new Map<string, ListingImportPlaywrightCookie>()
  for (const c of base) map.set(cookieKey(c), c)
  for (const c of overlay) map.set(cookieKey(c), c)
  return [...map.values()]
}

async function readCookieFile(filePath: string): Promise<ListingImportPlaywrightCookie[]> {
  try {
    const raw = await readFile(filePath, 'utf8')
    return parseCookieText(raw)
  } catch {
    return []
  }
}

async function loadEnvAndFileCookies(): Promise<ListingImportPlaywrightCookie[]> {
  const rawJson = (
    process.env.LISTING_IMPORT_SCRAPER_COOKIE_JSON ||
    process.env.IMPORT_SCRAPER_COOKIE_JSON ||
    process.env.IMPORT_1688_COOKIE_JSON ||
    ''
  ).trim()
  if (rawJson) {
    try {
      return parseCookieText(rawJson)
    } catch {
      return []
    }
  }
  const fileEnv = (
    process.env.LISTING_IMPORT_SCRAPER_COOKIE_FILE ||
    process.env.IMPORT_SCRAPER_COOKIE_FILE ||
    process.env.IMPORT_1688_COOKIE_FILE ||
    ''
  ).trim()
  const candidates = [
    fileEnv,
    path.join(process.cwd(), 'scraper-cookies.json'),
    path.join(process.cwd(), '1688-cookies.json'),
  ].filter(Boolean)
  for (const p of candidates) {
    const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p)
    const cookies = await readCookieFile(abs)
    if (cookies.length) return cookies
  }
  return []
}

export async function loadListingImportCookies(partnerId?: string | null): Promise<ListingImportPlaywrightCookie[]> {
  let cookies = await loadEnvAndFileCookies()
  if (partnerId) {
    const row = await fetchListingImportSettingsFromPg(partnerId)
    const partnerCookies = Array.isArray(row?.cookie_json)
      ? row.cookie_json
          .map((item) => (item && typeof item === 'object' ? normalizePlaywrightCookie(item as Record<string, unknown>) : null))
          .filter((c): c is ListingImportPlaywrightCookie => Boolean(c))
      : []
    if (partnerCookies.length) cookies = mergeCookieLists(cookies, partnerCookies)
  }
  return cookies
}

export function cookieExpiryMeta(cookies: ListingImportPlaywrightCookie[]): {
  cookie_expiry_known_for_all: boolean
  cookies_all_expired: boolean
  cookies_expired_count: number
} {
  if (!cookies.length) {
    return { cookie_expiry_known_for_all: false, cookies_all_expired: false, cookies_expired_count: 0 }
  }
  const now = Date.now() / 1000
  let known = 0
  let expired = 0
  for (const c of cookies) {
    if (c.expires == null) continue
    known += 1
    if (c.expires < now) expired += 1
  }
  const allKnown = known === cookies.length
  return {
    cookie_expiry_known_for_all: allKnown,
    cookies_all_expired: allKnown && expired === cookies.length,
    cookies_expired_count: expired,
  }
}

export function cookieDomains(cookies: ListingImportPlaywrightCookie[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const c of cookies) {
    const dom = c.domain.replace(/^\./, '').toLowerCase()
    if (dom && !seen.has(dom)) {
      seen.add(dom)
      out.push(dom)
    }
  }
  return out.slice(0, 40)
}

export function cookieDomainWarnings(domains: string[]): string[] {
  const warnings: string[] = []
  for (const d of domains) {
    if (d === '188.com.vn' || d.endsWith('.188.com.vn') || d === 'nanoai.vn' || d.endsWith('.nanoai.vn')) {
      warnings.push(
        'Phát hiện cookie shop/nền tảng — không dùng cho scrape Vipomall/PandaMall. Export lại từ vipomall.vn / pandamall.vn.'
      )
      break
    }
  }
  const scrapeHosts = new Set(['vipomall.vn', 'pandamall.vn', 'taobao.com', 'tmall.com', '1688.com'])
  if (domains.length && !domains.some((d) => [...scrapeHosts].some((h) => d === h || d.endsWith(`.${h}`)))) {
    warnings.push('Cookie chưa có domain vipomall.vn / pandamall.vn / taobao / 1688.')
  }
  return warnings
}

export function listingImportCookieSettingsMeta(
  cookies: ListingImportPlaywrightCookie[],
  message?: string | null
): {
  enabled: boolean
  has_cookie: boolean
  cookie_count: number
  cookie_names: string[]
  cookie_domains: string[]
  cookie_status: string
  cookie_warnings: string[]
  cookie_expiry_known_for_all: boolean
  cookies_all_expired: boolean
  cookies_expired_count: number
  usage_note: string
  message: string | null
} {
  const domains = cookieDomains(cookies)
  const expiry = cookieExpiryMeta(cookies)
  const warnings = cookieDomainWarnings(domains)
  let status = 'missing'
  if (cookies.length) {
    status = expiry.cookies_all_expired ? 'expired' : 'ok'
    if (warnings.length) status = 'warn'
  }
  return {
    enabled: cookies.length > 0,
    has_cookie: cookies.length > 0,
    cookie_count: cookies.length,
    cookie_names: cookies.map((c) => c.name).filter(Boolean).slice(0, 40),
    cookie_domains: domains,
    cookie_status: status,
    cookie_warnings: warnings,
    ...expiry,
    usage_note:
      'Một bộ cookie cho Vipomall / PandaMall. Dán JSON export từ Chrome (EditThisCookie / Cookie-Editor) khi đã đăng nhập vipomall.vn / pandamall.vn — không dùng cookie shop NanoAI.',
    message: message || null,
  }
}

function seedUrlForCookieDomain(domain: string): string | null {
  const d = domain.replace(/^\./, '').toLowerCase()
  for (const [host, seed] of Object.entries(HOST_SEED_URLS)) {
    if (d === host || d.endsWith(`.${host}`)) return seed
  }
  if (d.includes('.')) return `https://${d}/`
  return null
}

function hostsForUrl(url: string): Set<string> {
  let host = ''
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return new Set()
  }
  const out = new Set<string>([host])
  for (const hint of Object.keys(HOST_SEED_URLS)) {
    if (host === hint || host.endsWith(`.${hint}`)) out.add(hint)
  }
  return out
}

export async function seedPlaywrightContextCookies(input: {
  context: BrowserContext
  page: Page
  partnerId?: string | null
  preferHosts?: Iterable<string>
  targetUrl?: string | null
  timeoutMs?: number
}): Promise<number> {
  const cookies = await loadListingImportCookies(input.partnerId)
  if (!cookies.length) return 0
  const hosts = new Set(input.preferHosts || [])
  if (input.targetUrl) {
    for (const h of hostsForUrl(input.targetUrl)) hosts.add(h)
  }
  const buckets = new Map<string, ListingImportPlaywrightCookie[]>()
  for (const c of cookies) {
    const seed = seedUrlForCookieDomain(c.domain)
    if (!seed) continue
    const list = buckets.get(seed) || []
    list.push(c)
    buckets.set(seed, list)
  }
  if (!buckets.size) return 0
  const timeout = input.timeoutMs ?? 120_000
  let applied = 0
  for (const [seedUrl, bucket] of buckets) {
    if (hosts.size) {
      let seedHost = ''
      try {
        seedHost = new URL(seedUrl).hostname.toLowerCase()
      } catch {
        continue
      }
      if (![...hosts].some((h) => seedHost === h || seedHost.endsWith(`.${h}`))) continue
    }
    try {
      await input.page.goto(seedUrl, { waitUntil: 'domcontentloaded', timeout })
      await input.context.addCookies(bucket)
      applied += bucket.length
    } catch (e) {
      console.warn('[listing-import cookies] seed', seedUrl, e instanceof Error ? e.message : e)
    }
  }
  return applied
}

export async function loadPandamallAccount(partnerId?: string | null): Promise<{ username: string; password: string }> {
  let username = (process.env.PANDAMALL_USERNAME || process.env.PANDAMALL_USER || '').trim()
  let password = (process.env.PANDAMALL_PASSWORD || process.env.PANDAMALL_PASS || '').trim()
  try {
    const file = path.join(process.cwd(), 'pandamall-account.json')
    const raw = await readFile(file, 'utf8')
    const data = JSON.parse(raw) as { username?: string; password?: string }
    if (typeof data?.username === 'string' && data.username.trim()) username = data.username.trim()
    if (typeof data?.password === 'string' && data.password.trim()) password = data.password.trim()
  } catch {
    /* optional file */
  }
  if (partnerId) {
    const row = await fetchListingImportSettingsFromPg(partnerId)
    if (row?.pandamall_username?.trim()) username = row.pandamall_username.trim()
    if (row?.pandamall_password?.trim()) password = row.pandamall_password.trim()
  }
  return { username, password }
}

export async function tryPandamallPlaywrightAutoLogin(page: Page, pageUrl: string, partnerId?: string | null): Promise<boolean> {
  try {
    const onLogin = (page.url() || '').toLowerCase().includes('login')
    const hasForm =
      (await page.locator('text=Đăng nhập').count()) > 0 ||
      (await page.getByPlaceholder('Số điện thoại/Email').count()) > 0
    if (!onLogin && !hasForm) return false
    const acc = await loadPandamallAccount(partnerId)
    if (!acc.username || !passwordOk(acc.password)) return false
    if ((await page.getByPlaceholder('Số điện thoại/Email').count()) === 0) return false
    await page.getByPlaceholder('Số điện thoại/Email').fill(acc.username)
    await page.getByPlaceholder('Mật khẩu').fill(acc.password)
    await page.getByRole('button', { name: 'Đăng nhập' }).first().click()
    await page.waitForTimeout(3000)
    try {
      await page.waitForLoadState('networkidle', { timeout: 15_000 })
    } catch {
      /* ignore */
    }
    if (!(page.url() || '').toLowerCase().includes('detail') && pageUrl) {
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      try {
        await page.waitForLoadState('networkidle', { timeout: 15_000 })
      } catch {
        /* ignore */
      }
    }
    return true
  } catch {
    return false
  }
}

function passwordOk(s: string): boolean {
  return Boolean(s.trim())
}
