import { createHash } from 'node:crypto'
import {
  isRedisConfigured,
  redisDel,
  redisGet,
  redisGetInt,
  redisIncr,
  redisSetEx,
  redisSetNxEx,
} from '@/lib/cache/redis'

export const SHOP_LIST_TTL_SEC = 60
export const SHOP_ITEM_TTL_SEC = 120
export const SITE_HTML_TTL_SEC = 120
/** Extracted header/footer — busted by `bumpSiteCache` / siteVer, so a longer TTL is safe. */
export const SITE_CHROME_TTL_SEC = 1800
export const SITE_META_TTL_SEC = 120
/** Pill + featured tiles are visitor-specific; short so vừa xem still updates. */
export const LIVE_CATEGORY_BIND_TTL_SEC = 45
/** Facet snapshot + id list — busted by inventory version, so longer TTL is safe. */
export const SHOP_FACET_TTL_SEC = 900
export const SHOP_ID_LIST_TTL_SEC = 600
export const SHOP_TREE_TTL_SEC = 600
/** Product sitemap pages — busted by inventory version. */
export const SHOP_SITEMAP_TTL_SEC = 3600
/** Custom-domain host → slug. Busted on domain save / SSL / publish. */
export const HOST_RESOLVE_TTL_SEC = 300
/** Negative host lookup — short so a newly saved domain is not stuck. */
export const HOST_RESOLVE_MISS_TTL_SEC = 15
/** Public marketing slides (sale/warehouse/regular) — not birthday. */
export const MARKETING_BANNER_PUBLIC_TTL_SEC = 60
/** Personalization merge claim — skip repeat PG writes for the same pair. */
export const VISITOR_MERGE_CLAIM_TTL_SEC = 86400

/** Process L0 when Redis is off — same TTL as the Redis entry; cleared on bump. */
const MEM_CACHE_MAX = 800
/** Skip L0 when Redis already holds a fat id-list (~5000 UUID ≈ 180KB). */
const MEM_CACHE_MAX_BYTES = 24 * 1024
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
  if (raw.length > MEM_CACHE_MAX_BYTES && isRedisConfigured()) return
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

function hostResolveKey(host: string): string {
  return `pw:host:${host.trim().toLowerCase()}`
}

export async function bumpHostResolveCache(host: string | null | undefined): Promise<void> {
  const key = String(host ?? '').trim().toLowerCase()
  if (!key) return
  const cacheKey = hostResolveKey(key)
  forgetMem(cacheKey)
  await redisDel(cacheKey)
}

export function bumpHostResolveCacheLater(host: string | null | undefined): void {
  bumpLater(bumpHostResolveCache(host))
}

/**
 * Cache custom-domain host lookup. `null` (unknown host) uses a short TTL so a
 * newly saved domain is not stuck; positive hits last `HOST_RESOLVE_TTL_SEC`.
 */
export async function withHostResolveCache<T>(input: {
  host: string
  load: () => Promise<T | null>
}): Promise<T | null> {
  const host = input.host.trim().toLowerCase()
  if (!host) return input.load()
  const key = hostResolveKey(host)
  return loadOnce(key, async () => {
    const hit = await shopCacheGetJson<{ found: false } | { found: true; row: T }>(key, HOST_RESOLVE_TTL_SEC)
    if (hit) return hit.found ? hit.row : null
    const value = await input.load()
    if (value == null) {
      await shopCacheSetJson(key, HOST_RESOLVE_MISS_TTL_SEC, { found: false })
      return null
    }
    await shopCacheSetJson(key, HOST_RESOLVE_TTL_SEC, { found: true, row: value })
    return value
  })
}

/** True if this caller should run the one-shot work (merge, etc.). */
export async function claimShopCacheOnce(key: string, ttlSec: number): Promise<boolean> {
  const id = key.trim()
  if (!id) return true
  if (readMem(id)) return false
  const nx = await redisSetNxEx(id, ttlSec, '1')
  if (nx === false) {
    writeMem(id, ttlSec, '1')
    return false
  }
  writeMem(id, ttlSec, '1')
  return true
}

export async function releaseShopCacheOnce(key: string): Promise<void> {
  const id = key.trim()
  if (!id) return
  memStore.delete(id)
  await redisDel(id)
}

export function visitorMergeClaimCacheKey(input: {
  partnerId: string
  fromAccountKey: string
  toAccountKey: string
}): string {
  return `pw:merge:${input.partnerId.trim()}:${input.fromAccountKey.trim()}:${input.toAccountKey.trim()}`
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

export async function shopCacheGetJson<T>(key: string, memTtlSec = SHOP_LIST_TTL_SEC): Promise<T | null> {
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
  writeMem(key, memTtlSec, raw)
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
  /** Ignored — chrome pills and featured tiles share one visitor bind. */
  limit?: number
}): string {
  return `bind:${hashShopCachePayload({
    slug: input.slug.trim().toLowerCase(),
    accountKey: input.accountKey.trim() || 'anonymous',
    linkedUserId: String(input.linkedUserId || '').trim(),
    locale: input.locale,
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

export async function partnerInventoryCacheVersion(partnerId: string): Promise<number> {
  return inventoryVer(partnerId.trim())
}

export type PartnerInventoryShopCacheKind = 'shop' | 'cat' | 'item' | 'catbind' | 'facet' | 'ids' | 'tree' | 'sitemap'

export async function withInventoryShopCache<T>(input: {
  partnerId: string
  kind: PartnerInventoryShopCacheKind
  suffix: string
  ttlSec: number
  load: () => Promise<T>
}): Promise<T> {
  const partnerId = input.partnerId.trim()
  const ver = await inventoryVer(partnerId)
  const key = `pw:inv:${partnerId}:v${ver}:${input.kind}:${input.suffix}`
  return loadOnce(key, async () => {
    const hit = await shopCacheGetJson<T>(key, input.ttlSec)
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
    const hit = await shopCacheGetJson<string>(key, SITE_HTML_TTL_SEC)
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
    const hit = await shopCacheGetJson<T>(key, SITE_META_TTL_SEC)
    if (hit !== null) return hit
    const value = await input.load()
    if (value != null) await shopCacheSetJson(key, SITE_META_TTL_SEC, value)
    return value
  })
}

export function categoryProductCountsFromCacheRecord(
  rec: Record<string, number> | null | undefined
): Map<string, number> | null {
  if (!rec) return null
  const m = new Map<string, number>()
  for (const [id, n] of Object.entries(rec)) {
    const c = Number(n)
    if (id && Number.isFinite(c) && c > 0) m.set(id, Math.floor(c))
  }
  return m
}

export function categoryProductCountsToCacheRecord(counts: Map<string, number>): Record<string, number> {
  const rec: Record<string, number> = {}
  for (const [id, n] of counts) {
    const c = Number(n)
    if (id && Number.isFinite(c) && c > 0) rec[id] = Math.floor(c)
  }
  return rec
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
  const key = `pw:site:${slug}:v${ver}:chrome2:${device}`
  return loadOnce(key, async () => {
    const hit = await shopCacheGetJson<T>(key, SITE_CHROME_TTL_SEC)
    if (hit !== null) return hit
    const value = await input.load()
    if (value != null) await shopCacheSetJson(key, SITE_CHROME_TTL_SEC, value)
    return value
  })
}
