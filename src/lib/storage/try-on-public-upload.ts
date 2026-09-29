import {
  bunnyStorageHostCandidates,
  bunnyStorageHostForRegion,
  bunnyStorageObjectUrl,
  normalizeBunnyStorageHost,
  platformBunnyStorageRegionCode,
} from '@/lib/storage/bunny-storage-endpoint'

/** Path segment trong URL public kiểu legacy (`/storage/v1/object/public/.../`) — không gắn nhà cung cấp cụ thể. */
const LEGACY_TRY_ON_PUBLIC_PATH_MARKER = '/storage/v1/object/public/try-on-images/'

function decodeTryOnPathSegments(encodedPath: string): string | null {
  if (!encodedPath) return null
  const parts = encodedPath.split('/').map((s) => {
    try {
      return decodeURIComponent(s)
    } catch {
      return s
    }
  })
  return parts.join('/') || null
}

/**
 * Lấy đường dẫn object trong bucket try-on-images từ URL public (legacy `/storage/v1/...` hoặc Bunny b-cdn / BUNNY_STORAGE_PUBLIC_BASE_URL).
 */
export function tryOnPublicUrlToStoragePath(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null
  const t = url.trim()
  if (!t.startsWith('http')) return null

  const markerIdx = t.indexOf(LEGACY_TRY_ON_PUBLIC_PATH_MARKER)
  if (markerIdx >= 0) {
    const rest = t.slice(markerIdx + LEGACY_TRY_ON_PUBLIC_PATH_MARKER.length).split('?')[0]
    return decodeTryOnPathSegments(rest)
  }

  const bunnyBase = process.env.BUNNY_STORAGE_PUBLIC_BASE_URL?.trim().replace(/\/$/, '')
  if (bunnyBase && t.startsWith(bunnyBase)) {
    const raw = t.slice(bunnyBase.length).replace(/^\//, '').split('?')[0]
    return decodeTryOnPathSegments(raw)
  }

  try {
    const u = new URL(t)
    if (u.hostname.endsWith('.b-cdn.net')) {
      const raw = u.pathname.replace(/^\//, '').split('?')[0]
      return decodeTryOnPathSegments(raw)
    }
  } catch {
    /* ignore */
  }
  return null
}

export type BunnyStorageAuth = {
  zone: string
  accessKey: string
  publicBase: string
  /** Hostname API Storage, không scheme. Ổ shop SG → sg.storage.bunnycdn.com. */
  storageHost?: string
}

/** Zone đã dò đúng vùng sau 401 — giữ trong process để PUT/DELETE sau không thử lại. */
const resolvedHostByZone = new Map<string, string>()

export function platformBunnyStorageAuth(): BunnyStorageAuth | null {
  if (!bunnyStorageConfigured()) return null
  return {
    zone: process.env.BUNNY_STORAGE_ZONE!.trim(),
    accessKey: process.env.BUNNY_STORAGE_API_KEY!.trim(),
    publicBase: process.env.BUNNY_STORAGE_PUBLIC_BASE_URL!.trim().replace(/\/$/, ''),
    storageHost: bunnyStorageHostForRegion(platformBunnyStorageRegionCode()),
  }
}

function requireTryOnBunnyStorage(): BunnyStorageAuth {
  const auth = platformBunnyStorageAuth()
  if (!auth) {
    throw new Error(
      'Thiếu Bunny Storage (BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY, BUNNY_STORAGE_PUBLIC_BASE_URL).'
    )
  }
  return auth
}

/**
 * DELETE một object Bunny. 200/204/404 = thành công (giống 188 `delete_file_from_zone`).
 * HTTP khác hoặc lỗi mạng → `false` / throw để hàng đợi retry.
 */
export async function deleteBunnyStorageObject(path: string, auth?: BunnyStorageAuth): Promise<boolean> {
  const creds = auth ?? requireTryOnBunnyStorage()
  const trimmed = path.trim()
  if (!trimmed || trimmed.includes('..')) return false
  const remotePath = buildTryOnEncodedPath(trimmed)
  if (!remotePath) return false
  const res = await bunnyStorageRequest(creds, 'DELETE', remotePath)
  if (res.status === 200 || res.status === 204 || res.status === 404) return true
  console.warn('[deleteBunnyStorageObject] Bunny DELETE', trimmed, res.status, res.hint.slice(0, 300))
  return false
}

/** Xóa object trên Bunny (DELETE Storage API). Lỗi từng path chỉ cảnh báo — try-on / logo. */
export async function removeTryOnStorageObjects(paths: string[]): Promise<void> {
  requireTryOnBunnyStorage()
  const uniq = [...new Set(paths.map((p) => p.trim()).filter(Boolean))]
  if (uniq.length === 0) return

  for (const path of uniq) {
    try {
      await deleteBunnyStorageObject(path)
    } catch (e) {
      console.warn('[removeTryOnStorageObjects] Bunny DELETE error', path, e)
    }
  }
}

/** Xóa file storage ứng với các URL public (trùng path chỉ xóa một lần). */
export async function removeTryOnStorageFromPublicUrls(urls: Array<string | null | undefined>): Promise<void> {
  const paths = [...new Set(urls.map(tryOnPublicUrlToStoragePath).filter((p): p is string => Boolean(p)))]
  await removeTryOnStorageObjects(paths)
}

/** Đường dẫn object trên Bunny / URL public (từng segment encode). */
export function buildTryOnEncodedPath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
    .join('/')
}

export function bunnyStorageConfigured(): boolean {
  return Boolean(
    process.env.BUNNY_STORAGE_ZONE?.trim() &&
      process.env.BUNNY_STORAGE_API_KEY?.trim() &&
      process.env.BUNNY_STORAGE_PUBLIC_BASE_URL?.trim()
  )
}

/** URL public legacy cho bucket try-on-images (path `/storage/v1/object/public/try-on-images/`). */
export function isLegacyPublicTryOnUrl(url: string | null | undefined): boolean {
  const t = url?.trim()
  if (!t || !t.startsWith('http')) return false
  return t.includes(LEGACY_TRY_ON_PUBLIC_PATH_MARKER)
}

/**
 * Upload buffer lên Bunny Storage. Dùng script migrate/backfill.
 * Cần `BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_API_KEY`, `BUNNY_STORAGE_PUBLIC_BASE_URL`.
 */
export async function uploadTryOnToBunnyOnly(
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<{ publicUrl: string }> {
  if (!bunnyStorageConfigured()) {
    throw new Error('Thiếu BUNNY_STORAGE_ZONE / BUNNY_STORAGE_API_KEY / BUNNY_STORAGE_PUBLIC_BASE_URL')
  }
  return uploadToBunny(path, buffer, contentType)
}

async function bodyToBuffer(body: File | Blob | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body
  return Buffer.from(await body.arrayBuffer())
}

function preferredStorageHost(auth: BunnyStorageAuth): string {
  return resolvedHostByZone.get(auth.zone) || normalizeBunnyStorageHost(auth.storageHost)
}

type BunnyStorageResult = { status: number; hint: string; ok: boolean }

async function bunnyStorageRequest(
  auth: BunnyStorageAuth,
  method: 'PUT' | 'DELETE',
  remotePath: string,
  body?: Uint8Array,
  contentType?: string
): Promise<BunnyStorageResult> {
  const accessKey = auth.accessKey.trim()
  const send = async (host: string): Promise<BunnyStorageResult> => {
    const res = await fetch(bunnyStorageObjectUrl(host, auth.zone, remotePath), {
      method,
      headers: {
        AccessKey: accessKey,
        ...(contentType ? { 'Content-Type': contentType } : {}),
      },
      body: body ? Buffer.from(body) : undefined,
      signal: AbortSignal.timeout(60_000),
    })
    const hint = res.ok || res.status === 404 ? '' : (await res.text().catch(() => '')).slice(0, 300)
    return { status: res.status, hint, ok: res.ok }
  }

  const firstHost = preferredStorageHost(auth)
  const first = await send(firstHost)
  if (first.status !== 401) {
    if (first.ok || first.status === 404) resolvedHostByZone.set(auth.zone, firstHost)
    return first
  }

  const found = await probeBunnyStorageHost(auth, accessKey, firstHost)
  if (!found) return first
  resolvedHostByZone.set(auth.zone, found)
  return send(found)
}

/** 401 trên host đầu: thử vùng khác bằng file vài byte, rồi mới PUT ảnh thật. */
async function probeBunnyStorageHost(auth: BunnyStorageAuth, accessKey: string, skipHost: string): Promise<string | null> {
  const probePath = `_bunny-region-probe/${Date.now()}.bin`
  const probeBody = new Uint8Array([0xff, 0xd8, 0xff])
  for (const host of bunnyStorageHostCandidates(skipHost)) {
    if (host === skipHost) continue
    const url = bunnyStorageObjectUrl(host, auth.zone, probePath)
    const res = await fetch(url, {
      method: 'PUT',
      headers: { AccessKey: accessKey, 'Content-Type': 'application/octet-stream' },
      body: probeBody,
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null)
    if (!res) continue
    if (res.status === 401) {
      await res.text().catch(() => '')
      continue
    }
    await res.text().catch(() => '')
    if (!res.ok) continue
    await fetch(url, {
      method: 'DELETE',
      headers: { AccessKey: accessKey },
      signal: AbortSignal.timeout(20_000),
    }).catch(() => undefined)
    return host
  }
  return null
}

async function uploadToBunny(
  path: string,
  buffer: Buffer,
  contentType: string,
  auth?: BunnyStorageAuth
): Promise<{ publicUrl: string }> {
  const creds = auth ?? requireTryOnBunnyStorage()
  const publicBase = creds.publicBase.replace(/\/$/, '')
  const remotePath = buildTryOnEncodedPath(path)
  const res = await bunnyStorageRequest(
    creds,
    'PUT',
    remotePath,
    new Uint8Array(buffer),
    contentType || 'application/octet-stream'
  )
  if (!res.ok) {
    throw new Error(`Bunny Storage upload failed (${res.status}): ${res.hint.slice(0, 240)}`)
  }
  const publicUrl = `${publicBase}/${remotePath}`
  return { publicUrl }
}

/** URL public CDN (Bunny) cho object try-on. */
export function getTryOnPublicUrlFromPath(path: string): string {
  requireTryOnBunnyStorage()
  const publicBase = process.env.BUNNY_STORAGE_PUBLIC_BASE_URL!.trim().replace(/\/$/, '')
  return `${publicBase}/${buildTryOnEncodedPath(path)}`
}

export async function downloadTryOnObject(path: string): Promise<Buffer | null> {
  requireTryOnBunnyStorage()
  const url = getTryOnPublicUrlFromPath(path)
  const res = await fetch(url)
  if (!res.ok) return null
  return Buffer.from(await res.arrayBuffer())
}

export async function tryOnObjectExistsByPath(path: string): Promise<boolean> {
  requireTryOnBunnyStorage()
  const url = getTryOnPublicUrlFromPath(path)
  const res = await fetch(url, { method: 'HEAD' })
  return res.ok
}


type UploadOptions = { contentType?: string; upsert?: boolean }

/**
 * Upload file công khai lên Bunny Storage (prefix path như bucket try-on-images cũ).
 */
export async function uploadTryOnImagePublic(
  path: string,
  body: File | Blob | Buffer,
  options?: UploadOptions
): Promise<{ publicUrl: string }> {
  requireTryOnBunnyStorage()
  const contentType = options?.contentType || 'application/octet-stream'
  const buffer = await bodyToBuffer(body)
  return uploadToBunny(path, buffer, contentType)
}

/** Upload vào một zone đã biết (ổ shop hoặc zone chung). */
export async function uploadBunnyStorageObject(
  path: string,
  body: File | Blob | Buffer,
  options: UploadOptions | undefined,
  auth: BunnyStorageAuth
): Promise<{ publicUrl: string }> {
  const contentType = options?.contentType || 'application/octet-stream'
  const buffer = await bodyToBuffer(body)
  return uploadToBunny(path, buffer, contentType, auth)
}
