import {
  isLegacyPublicTryOnUrl,
  tryOnPublicUrlToStoragePath,
  uploadTryOnToBunnyOnly,
} from '@/lib/storage/try-on-public-upload'
import { getStorageLegacyRestConfig } from '@/lib/storage/storage-legacy-rest-config'

export const TRY_ON_BACKFILL_BUCKET = 'try-on-images'

export function contentTypeForTryOnPath(p: string): string {
  const lower = p.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  if (lower.endsWith('.mp4')) return 'video/mp4'
  if (lower.endsWith('.webm')) return 'video/webm'
  if (lower.endsWith('.zip')) return 'application/zip'
  if (lower.endsWith('.pdf')) return 'application/pdf'
  return 'application/octet-stream'
}

/** Tải object qua URL public legacy (HTTP GET). */
export async function downloadTryOnFromLegacyPublicUrl(fullUrl: string): Promise<Buffer | null> {
  if (!isLegacyPublicTryOnUrl(fullUrl)) return null
  try {
    const res = await fetch(fullUrl, { redirect: 'follow', headers: { Accept: '*/*' } })
    if (!res.ok) {
      console.warn('[try-on-backfill] fetch public URL failed:', fullUrl.slice(0, 120), res.status)
      return null
    }
    return Buffer.from(await res.arrayBuffer())
  } catch (e) {
    console.warn('[try-on-backfill] fetch public URL error:', fullUrl.slice(0, 120), e)
    return null
  }
}

/** Xóa một object trên Storage REST legacy (không dùng SDK). */
export async function removeTryOnObjectFromLegacyRestStorage(objectPath: string): Promise<boolean> {
  const cfg = getStorageLegacyRestConfig()
  if (!cfg) {
    console.warn(
      '[try-on-backfill] Missing STORAGE_LEGACY_* (or legacy storage REST origin + service key in env) for DELETE'
    )
    return false
  }
  const enc = objectPath
    .split('/')
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
    .join('/')
  const url = `${cfg.base}/storage/v1/object/${encodeURIComponent(TRY_ON_BACKFILL_BUCKET)}/${enc}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
    },
  })
  if (!res.ok && res.status !== 404) {
    const t = await res.text().catch(() => '')
    console.warn('[try-on-backfill] legacy storage DELETE', objectPath, res.status, t.slice(0, 200))
    return false
  }
  return true
}

export type TryOnBackfillContext = {
  /** old public URL → new Bunny public URL */
  urlCache: Map<string, string>
  deletedPaths: Set<string>
  /** Xóa object trên Storage REST nguồn sau khi upload Bunny (tùy script: --delete-source) */
  deleteSource: boolean
  apply: boolean
  stats: { uploads: number; errors: number }
}

/**
 * Với mỗi URL public legacy try-on-images: tải qua HTTP, PUT lên Bunny (khi `apply`),
 * ghi `urlCache` / trả về map thay thế cho chuỗi trong JSON.
 */
export async function migrateLegacyTryOnUrlSet(
  uniqueUrls: Iterable<string>,
  ctx: TryOnBackfillContext
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (const oldUrl of uniqueUrls) {
    if (!isLegacyPublicTryOnUrl(oldUrl)) continue
    if (ctx.urlCache.has(oldUrl)) {
      map.set(oldUrl, ctx.urlCache.get(oldUrl)!)
      continue
    }
    if (!ctx.apply) continue

    const objectPath = tryOnPublicUrlToStoragePath(oldUrl)
    if (!objectPath) {
      ctx.stats.errors += 1
      continue
    }
    const buf = await downloadTryOnFromLegacyPublicUrl(oldUrl)
    if (!buf) {
      ctx.stats.errors += 1
      continue
    }
    try {
      const { publicUrl } = await uploadTryOnToBunnyOnly(
        objectPath,
        buf,
        contentTypeForTryOnPath(objectPath)
      )
      ctx.urlCache.set(oldUrl, publicUrl)
      map.set(oldUrl, publicUrl)
      ctx.stats.uploads += 1

      if (ctx.deleteSource && !ctx.deletedPaths.has(objectPath)) {
        await removeTryOnObjectFromLegacyRestStorage(objectPath)
        ctx.deletedPaths.add(objectPath)
      }
    } catch (e) {
      console.warn('[try-on-backfill] Bunny upload error', objectPath, e instanceof Error ? e.message : e)
      ctx.stats.errors += 1
    }
  }
  return map
}

function walkJsonForUrls(val: unknown, acc: Set<string>): void {
  if (val === null || val === undefined) return
  if (typeof val === 'string') {
    if (isLegacyPublicTryOnUrl(val)) acc.add(val)
    return
  }
  if (Array.isArray(val)) {
    for (const x of val) walkJsonForUrls(x, acc)
    return
  }
  if (typeof val === 'object') {
    for (const k of Object.keys(val as object)) {
      walkJsonForUrls((val as Record<string, unknown>)[k], acc)
    }
  }
}

/** Thu thập URL public legacy try-on-images duy nhất trong cây JSON. */
export function collectLegacyTryOnUrlsFromJson(val: unknown): string[] {
  const acc = new Set<string>()
  walkJsonForUrls(val, acc)
  return [...acc]
}

/** Thay chuỗi URL theo map (chỉ key khớp toàn bộ chuỗi). */
export function replaceTryOnUrlsInJson(val: unknown, map: Map<string, string>): unknown {
  if (val === null || val === undefined) return val
  if (typeof val === 'string') {
    return map.has(val) ? map.get(val)! : val
  }
  if (Array.isArray(val)) {
    return val.map((x) => replaceTryOnUrlsInJson(x, map))
  }
  if (typeof val === 'object') {
    const o = val as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(o)) {
      out[k] = replaceTryOnUrlsInJson(o[k], map)
    }
    return out
  }
  return val
}
