import { createHash } from 'node:crypto'
import { redisGet, redisGetInt, redisIncr, redisSetEx } from '@/lib/cache/redis'

export const SHOP_LIST_TTL_SEC = 60
export const SHOP_ITEM_TTL_SEC = 120
export const SITE_HTML_TTL_SEC = 120
export const SITE_META_TTL_SEC = 120
/** Pill + featured tiles are visitor-specific; short so vừa xem still updates. */
export const LIVE_CATEGORY_BIND_TTL_SEC = 45

/** Process L0 when Redis is off — same TTL as the Redis entry; cleared on bump. */
const MEM_CACHE_MAX = 300
const memStore = new Map<string, { exp: number; raw: string }>()
const pendingLoads = new Map<string, Promise<unknown>>()
const pendingVersions = new Map<string, Promise<number>>()

function forgetMem(prefix?: string): void {
  if (!prefix) {
    memStore.clear()
    return
  }
  for (const key of [...memStore.keys()]) {
    if (key.startsWith(prefix)) memStore.delete(key)
  }
}

function readMem(key: string): string | null {
  const row = memStore.get(key)
  if (!row) return null
  if (row.exp <= Date.now()) {
    memStore.delete(key)
    return null
  }
  return row.raw
}

function writeMem(key: string, ttlSec: number, raw: string): void {
  if (memStore.size >= MEM_CACHE_MAX) {
    const oldest = memStore.keys().next().value
    if (typeof oldest === 'string') memStore.delete(oldest)
  }
  memStore.set(key, { exp: Date.now() + Math.max(1, ttlSec) * 1000, raw })
}

function inventoryVerKey(partnerId: string): string {
  return `pw:inv:${partnerId}:ver`
}

function siteVerKey(slug: string): string {
  return `pw:site:${slug}:ver`
}

export function hashShopCachePayload(value: unknown): string {
  return createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 16)
}

export async function bumpInventoryCache(partnerId: string | null | undefined): Promise<void> {
  const id = String(partnerId ?? '').trim()
  if (!id) return
  await redisIncr(inventoryVerKey(id))
  forgetMem(`pw:inv:${id}:`)
}

export async function bumpSiteCache(slug: string | null | undefined): Promise<void> {
  const key = String(slug ?? '').trim().toLowerCase()
  if (!key) return
  await redisIncr(siteVerKey(key))
  forgetMem(`pw:site:${key}:`)
}

function bumpLater(task: Promise<unknown>): void {
  void task.catch((e) => {
    console.warn('[partner-shop-cache] bump failed', e instanceof Error ? e.message : e)
  })
}

export function bumpInventoryCacheLater(partnerId: string | null | undefined): void {
  bumpLater(bumpInventoryCache(partnerId))
}

export function bumpSiteCacheLater(slug: string | null | undefined): void {
  bumpLater(bumpSiteCache(slug))
}

async function readVersionOnce(key: string): Promise<number> {
  const existing = pendingVersions.get(key)
  if (existing) return existing
  const pending = redisGetInt(key).finally(() => {
    if (pendingVersions.get(key) === pending) pendingVersions.delete(key)
  })
  pendingVersions.set(key, pending)
  return pending
}

async function inventoryVer(partnerId: string): Promise<number> {
  return readVersionOnce(inventoryVerKey(partnerId))
}

async function siteVer(slug: string): Promise<number> {
  return readVersionOnce(siteVerKey(slug))
}

async function loadOnce<T>(key: string, load: () => Promise<T>): Promise<T> {
  const existing = pendingLoads.get(key) as Promise<T> | undefined
  if (existing) return existing
  const pending = load().finally(() => {
    if (pendingLoads.get(key) === pending) pendingLoads.delete(key)
  })
  pendingLoads.set(key, pending)
  return pending
}

export async function shopCacheGetJson<T>(key: string): Promise<T | null> {
  const cached = readMem(key)
  if (cached) {
    try {
      return JSON.parse(cached) as T
    } catch {
      memStore.delete(key)
    }
  }
  const raw = await redisGet(key)
  if (!raw) return null
  writeMem(key, SHOP_LIST_TTL_SEC, raw)
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function shopCacheSetJson(key: string, ttlSec: number, value: unknown): Promise<void> {
  try {
    const raw = JSON.stringify(value)
    writeMem(key, ttlSec, raw)
    await redisSetEx(key, ttlSec, raw)
  } catch (e) {
    console.warn('[partner-shop-cache] set failed', e instanceof Error ? e.message : e)
  }
}

export function liveCategoryBindCacheSuffix(input: {
  slug: string
  accountKey: string
  linkedUserId?: string | null
  locale: string
  limit?: number
}): string {
  return `bind:${hashShopCachePayload({
    slug: input.slug.trim().toLowerCase(),
    accountKey: input.accountKey.trim() || 'anonymous',
    linkedUserId: String(input.linkedUserId || '').trim(),
    locale: input.locale,
    limit: Number(input.limit) || 0,
  })}`
}

export async function withLiveCategoryBindCache<T>(input: {
  partnerId: string
  slug: string
  accountKey: string
  linkedUserId?: string | null
  locale: string
  limit?: number
  load: () => Promise<T>
}): Promise<T> {
  return withInventoryShopCache({
    partnerId: input.partnerId,
    kind: 'catbind',
    suffix: liveCategoryBindCacheSuffix(input),
    ttlSec: LIVE_CATEGORY_BIND_TTL_SEC,
    load: input.load,
  })
}

export async function withInventoryShopCache<T>(input: {
  partnerId: string
  kind: 'shop' | 'cat' | 'item' | 'catbind'
  suffix: string
  ttlSec: number
  load: () => Promise<T>
}): Promise<T> {
  const partnerId = input.partnerId.trim()
  const ver = await inventoryVer(partnerId)
  const key = `pw:inv:${partnerId}:v${ver}:${input.kind}:${input.suffix}`
  return loadOnce(key, async () => {
    const hit = await shopCacheGetJson<T>(key)
    if (hit !== null) return hit
    const value = await input.load()
    if (value != null) await shopCacheSetJson(key, input.ttlSec, value)
    return value
  })
}

export async function withSiteHtmlCache(input: {
  slug: string
  pageKey: string
  device: string
  extra?: string
  load: () => Promise<string>
}): Promise<string> {
  const slug = input.slug.trim().toLowerCase()
  if (!slug) return input.load()
  const ver = await siteVer(slug)
  const extra = input.extra ? `:${input.extra}` : ''
  const key = `pw:site:${slug}:v${ver}:html:${input.pageKey}:${input.device}${extra}`
  return loadOnce(key, async () => {
    const hit = await shopCacheGetJson<string>(key)
    if (typeof hit === 'string' && hit.length >= 40) return hit
    const value = await input.load()
    if (value.length >= 40) await shopCacheSetJson(key, SITE_HTML_TTL_SEC, value)
    return value
  })
}

/** Public storefront metadata/context; never includes project_files_json or visitor state. */
export async function withSiteMetaCache<T>(input: {
  slug: string
  suffix: string
  load: () => Promise<T>
}): Promise<T> {
  const slug = input.slug.trim().toLowerCase()
  const suffix = input.suffix.trim().toLowerCase()
  if (!slug || !suffix) return input.load()
  const ver = await siteVer(slug)
  const key = `pw:site:${slug}:v${ver}:meta:${suffix}`
  return loadOnce(key, async () => {
    const hit = await shopCacheGetJson<T>(key)
    if (hit !== null) return hit
    const value = await input.load()
    if (value != null) await shopCacheSetJson(key, SITE_META_TTL_SEC, value)
    return value
  })
}

/** Extracted home header/footer for React cart/account — not personalized pills. Bust via `bumpSiteCache`. */
export async function withSiteChromeCache<T>(input: {
  slug: string
  device: string
  load: () => Promise<T>
}): Promise<T> {
  const slug = input.slug.trim().toLowerCase()
  const device = input.device.trim().toLowerCase()
  if (!slug || !device) return input.load()
  const ver = await siteVer(slug)
  const key = `pw:site:${slug}:v${ver}:chrome:${device}`
  return loadOnce(key, async () => {
    const hit = await shopCacheGetJson<T>(key)
    if (hit !== null) return hit
    const value = await input.load()
    if (value != null) await shopCacheSetJson(key, SITE_HTML_TTL_SEC, value)
    return value
  })
}
