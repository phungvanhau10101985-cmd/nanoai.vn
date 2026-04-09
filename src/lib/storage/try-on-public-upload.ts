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

function requireTryOnBunnyStorage(): void {
  if (!bunnyStorageConfigured()) {
    throw new Error(
      'Thiếu Bunny Storage (BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY, BUNNY_STORAGE_PUBLIC_BASE_URL).'
    )
  }
}

/** Xóa object trên Bunny (DELETE Storage API). */
export async function removeTryOnStorageObjects(paths: string[]): Promise<void> {
  requireTryOnBunnyStorage()
  const uniq = [...new Set(paths.map((p) => p.trim()).filter(Boolean))]
  if (uniq.length === 0) return

  const zone = process.env.BUNNY_STORAGE_ZONE!.trim()
  const accessKey = process.env.BUNNY_STORAGE_API_KEY!.trim()
  for (const path of uniq) {
    try {
      const remotePath = buildTryOnEncodedPath(path)
      const delUrl = `https://storage.bunnycdn.com/${encodeURIComponent(zone)}/${remotePath}`
      const res = await fetch(delUrl, { method: 'DELETE', headers: { AccessKey: accessKey } })
      if (!res.ok && res.status !== 404) {
        const hint = await res.text().catch(() => '')
        console.warn('[removeTryOnStorageObjects] Bunny DELETE', path, res.status, hint.slice(0, 200))
      }
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

async function uploadToBunny(
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<{ publicUrl: string }> {
  const zone = process.env.BUNNY_STORAGE_ZONE!.trim()
  const accessKey = process.env.BUNNY_STORAGE_API_KEY!.trim()
  const publicBase = process.env.BUNNY_STORAGE_PUBLIC_BASE_URL!.trim().replace(/\/$/, '')
  const remotePath = buildTryOnEncodedPath(path)
  const putUrl = `https://storage.bunnycdn.com/${encodeURIComponent(zone)}/${remotePath}`
  const res = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      AccessKey: accessKey,
      'Content-Type': contentType || 'application/octet-stream',
    },
    body: new Uint8Array(buffer),
  })
  if (!res.ok) {
    const hint = await res.text().catch(() => '')
    throw new Error(`Bunny Storage upload failed (${res.status}): ${hint.slice(0, 240)}`)
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
