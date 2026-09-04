import { createHash } from 'node:crypto'
import { redisGet, redisGetInt, redisIncr, redisSetEx } from '@/lib/cache/redis'

export const SHOP_LIST_TTL_SEC = 60
export const SHOP_ITEM_TTL_SEC = 120
export const SITE_HTML_TTL_SEC = 120
export const SITE_META_TTL_SEC = 120
/** Pill + featured tiles are visitor-specific; short so vừa xem still updates. */
export const LIVE_CATEGORY_BIND_TTL_SEC = 45

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
}

export async function bumpSiteCache(slug: string | null | undefined): Promise<void> {
  const key = String(slug ?? '').trim().toLowerCase()
  if (!key) return
  await redisIncr(siteVerKey(key))
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

async function inventoryVer(partnerId: string): Promise<number> {
  return redisGetInt(inventoryVerKey(partnerId))
}

async function siteVer(slug: string): Promise<number> {
  return redisGetInt(siteVerKey(slug))
}

export async function shopCacheGetJson<T>(key: string): Promise<T | null> {
  const raw = await redisGet(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function shopCacheSetJson(key: string, ttlSec: number, value: unknown): Promise<void> {
  try {
    await redisSetEx(key, ttlSec, JSON.stringify(value))
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
  const hit = await shopCacheGetJson<T>(key)
  if (hit !== null) return hit
  const value = await input.load()
  if (value != null) await shopCacheSetJson(key, input.ttlSec, value)
  return value
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
  const hit = await shopCacheGetJson<string>(key)
  if (typeof hit === 'string' && hit.length >= 40) return hit
  const value = await input.load()
  if (value.length >= 40) await shopCacheSetJson(key, SITE_HTML_TTL_SEC, value)
  return value
}
