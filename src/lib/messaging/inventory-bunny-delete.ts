/**
 * Xóa object Bunny CDN khi xóa sản phẩm kho — cùng luồng 188
 * `collect_product_image_urls_for_bunny` + `pending_bunny_deletes`.
 * Chỉ URL thuộc Pull Zone NanoAI (không AliCDN, không 188comvn.b-cdn.net).
 */
import { LEGACY_BUNNY_PULL_ZONE_HOST } from '@/lib/bunny-cdn-url'
import {
  enqueuePendingBunnyDeletesFromPg,
  processPendingBunnyDeletesFromPg,
  type PendingBunnyDeleteEnqueueItem,
} from '@/lib/db/messaging-partner-pending-bunny-deletes-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { bunnyStorageConfigured, deleteBunnyStorageObject } from '@/lib/storage/try-on-public-upload'

const IMAGE_WALK_KEYS = new Set([
  'img',
  'image',
  'url',
  'src',
  'thumbnail',
  'main_image',
  'image_url',
  'final_url',
  'original_url',
])

const HTTP_URL_RE = /https?:\/\/[^\s"'<>\\]+/gi

export type InventoryBunnyDeleteSnapshot = {
  id?: string | null
  partner_id?: string | null
  image_url?: unknown
  gallery_urls?: unknown
  detail_image_urls?: unknown
  material_detail_image_url?: unknown
  real_use_image_url?: unknown
  real_use_image_url_2?: unknown
  product_video_url?: unknown
  colors_json?: unknown
  catalog_json?: unknown
  product_info_json?: unknown
  description?: unknown
  stock_note?: unknown
}

export function bunnyDeleteOnProductDeleteEnabled(): boolean {
  const v = (process.env.BUNNY_DELETE_ON_PRODUCT_DELETE || 'true').trim().toLowerCase()
  return v !== '0' && v !== 'false' && v !== 'no' && v !== 'off'
}

function hostFromPublicBase(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  try {
    const u = new URL(t.includes('://') ? t : `https://${t}`)
    return u.hostname.toLowerCase().split(':')[0] || ''
  } catch {
    return ''
  }
}

/** Host Pull Zone NanoAI — không gồm CDN shop 188 / AliCDN. */
export function bunnyImageHostsForDelete(): Set<string> {
  const hosts = new Set<string>()
  const add = (raw: string) => {
    const h = hostFromPublicBase(raw)
    if (h) hosts.add(h)
  }
  add(process.env.BUNNY_STORAGE_PUBLIC_BASE_URL || '')
  add(process.env.NEXT_PUBLIC_BUNNY_STORAGE_PUBLIC_BASE_URL || '')
  add(LEGACY_BUNNY_PULL_ZONE_HOST)
  for (const extra of (process.env.BUNNY_DELETE_EXTRA_HOSTS || '').split(',')) {
    add(extra)
  }
  return hosts
}

function addHttpUrl(urls: string[], raw: unknown): void {
  if (typeof raw !== 'string') return
  const s = raw.trim()
  if (!s) return
  if (/^https?:\/\//i.test(s)) {
    urls.push(s)
    return
  }
  if (s.startsWith('//') && s.length > 3) {
    urls.push(`https:${s}`)
  }
}

function extractHttpUrlsFromText(urls: string[], raw: unknown): void {
  if (typeof raw !== 'string') return
  const s = raw.trim()
  if (!s || !/https?:\/\//i.test(s)) return
  if (/^https?:\/\//i.test(s) && !s.includes(' ')) {
    addHttpUrl(urls, s)
    return
  }
  const matches = s.match(HTTP_URL_RE) || []
  for (const m of matches) addHttpUrl(urls, m.replace(/[),.;]+$/g, ''))
}

function walkImageLikeNode(urls: string[], node: unknown, depth = 0): void {
  if (node == null || depth > 12) return
  if (typeof node === 'string') {
    extractHttpUrlsFromText(urls, node)
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) walkImageLikeNode(urls, item, depth + 1)
    return
  }
  if (typeof node !== 'object') return
  for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
    if (IMAGE_WALK_KEYS.has(key.toLowerCase())) addHttpUrl(urls, val)
    if (typeof val === 'object' && val) walkImageLikeNode(urls, val, depth + 1)
    else if (typeof val === 'string' && /https?:\/\//i.test(val)) extractHttpUrlsFromText(urls, val)
  }
}

/** Gom mọi URL ảnh/video có thể là object Bunny — cùng ý 188 `collect_product_image_urls_for_bunny`. */
export function collectPartnerInventoryImageUrls(row: InventoryBunnyDeleteSnapshot): string[] {
  const urls: string[] = []
  addHttpUrl(urls, row.image_url)
  if (Array.isArray(row.gallery_urls)) {
    for (const item of row.gallery_urls) addHttpUrl(urls, item)
  }
  if (Array.isArray(row.detail_image_urls)) {
    for (const item of row.detail_image_urls) addHttpUrl(urls, item)
  }
  addHttpUrl(urls, row.material_detail_image_url)
  addHttpUrl(urls, row.real_use_image_url)
  addHttpUrl(urls, row.real_use_image_url_2)
  addHttpUrl(urls, row.product_video_url)

  const colors = row.colors_json
  if (Array.isArray(colors)) {
    for (const item of colors) {
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>
        for (const fld of ['img', 'image', 'url', 'src', 'thumbnail'] as const) {
          addHttpUrl(urls, rec[fld])
        }
      } else addHttpUrl(urls, item)
    }
  }

  walkImageLikeNode(urls, row.catalog_json)
  walkImageLikeNode(urls, row.product_info_json)
  extractHttpUrlsFromText(urls, row.description)
  extractHttpUrlsFromText(urls, row.stock_note)
  return urls
}

export function inventoryImageUrlToBunnyStoragePath(
  url: string,
  allowedHosts: Set<string> = bunnyImageHostsForDelete()
): string | null {
  const raw = url.trim()
  if (!raw || !allowedHosts.size) return null
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    const host = u.hostname.toLowerCase()
    if (!allowedHosts.has(host)) return null
    const rawPath = raw.replace(/^https?:\/\/[^/?#]+/i, '').split(/[?#]/)[0]
    const rawSegments = rawPath.split('/')
    const hasTraversal = rawSegments.some((seg) => {
      if (!seg) return false
      try {
        const d = decodeURIComponent(seg)
        return d === '..' || d === '.'
      } catch {
        return seg === '..' || seg === '.'
      }
    })
    if (hasTraversal) return null
    const path = u.pathname.replace(/^\/+/, '').replace(/\/+$/, '')
    if (!path) return null
    const segments = path.split('/').map((seg) => {
      try {
        return decodeURIComponent(seg)
      } catch {
        return seg
      }
    })
    if (segments.some((s) => s === '..' || s === '.')) return null
    return segments.filter(Boolean).join('/') || null
  } catch {
    return null
  }
}

export function resolveBunnyDeletePathsFromUrls(urls: Iterable<string>): PendingBunnyDeleteEnqueueItem[] {
  const hosts = bunnyImageHostsForDelete()
  if (!hosts.size) return []
  const out: PendingBunnyDeleteEnqueueItem[] = []
  const seen = new Set<string>()
  for (const raw of urls) {
    const sourceUrl = String(raw || '').trim()
    if (!sourceUrl) continue
    const storagePath = inventoryImageUrlToBunnyStoragePath(sourceUrl, hosts)
    if (!storagePath || seen.has(storagePath)) continue
    seen.add(storagePath)
    out.push({ storagePath, sourceUrl })
  }
  return out
}

async function deleteBunnyPathsNow(paths: string[]): Promise<number> {
  if (!paths.length || !bunnyStorageConfigured()) return 0
  let n = 0
  for (const path of paths) {
    try {
      if (await deleteBunnyStorageObject(path)) n += 1
    } catch (e) {
      console.warn('[inventory-bunny-delete] immediate Bunny DELETE', path, e)
    }
  }
  return n
}

/**
 * Ghi hàng đợi durable rồi drain nền (không chặn xóa DB).
 * Thiếu bảng / Bunny → DELETE ngay best-effort.
 */
export async function enqueueAndScheduleBunnyDeletesForInventoryRows(
  rows: InventoryBunnyDeleteSnapshot[]
): Promise<number> {
  if (!bunnyDeleteOnProductDeleteEnabled() || rows.length === 0) return 0
  const items: PendingBunnyDeleteEnqueueItem[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    for (const item of resolveBunnyDeletePathsFromUrls(collectPartnerInventoryImageUrls(row))) {
      if (seen.has(item.storagePath)) continue
      seen.add(item.storagePath)
      items.push({
        ...item,
        partnerId: row.partner_id ? String(row.partner_id) : null,
        inventoryId: row.id ? String(row.id) : null,
      })
    }
  }
  if (!items.length) return 0

  if (isPgConfigured()) {
    try {
      const n = await enqueuePendingBunnyDeletesFromPg(items)
      void processPendingBunnyDeletesFromPg().catch((e) => {
        console.warn('[inventory-bunny-delete] drain', e)
      })
      return n
    } catch (e) {
      const code = e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : ''
      if (code !== '42P01') {
        console.warn('[inventory-bunny-delete] enqueue failed, DELETE Bunny ngay', e)
      }
    }
  }

  try {
    return await deleteBunnyPathsNow(items.map((i) => i.storagePath))
  } catch (e) {
    console.warn('[inventory-bunny-delete] immediate Bunny DELETE', e)
    return 0
  }
}

export function scheduleBunnyCleanupForDeletedInventory(
  rows: InventoryBunnyDeleteSnapshot[]
): void {
  if (!rows.length) return
  void enqueueAndScheduleBunnyDeletesForInventoryRows(rows).catch((e) => {
    console.warn('[inventory-bunny-delete] schedule', e)
  })
}
