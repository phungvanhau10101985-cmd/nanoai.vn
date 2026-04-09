import { EXAM_ESSAY_IMAGES_BUCKET } from '@/lib/exam-essay-config'

/** Khóa object trên Bunny (từng segment encode, nối bằng /). */
export function examEssayBunnyStorageKey(logicalPath: string): string {
  const clean = logicalPath.replace(/^\/+/, '')
  const parts = [EXAM_ESSAY_IMAGES_BUCKET, ...clean.split('/').filter(Boolean)]
  return parts.map((s) => encodeURIComponent(s)).join('/')
}

export function examEssayBunnyStorageConfigured(): boolean {
  return Boolean(
    process.env.BUNNY_STORAGE_ZONE?.trim() &&
      process.env.BUNNY_STORAGE_API_KEY?.trim() &&
      process.env.BUNNY_STORAGE_PUBLIC_BASE_URL?.trim()
  )
}

function requireExamEssayBunnyStorage(): void {
  if (!examEssayBunnyStorageConfigured()) {
    throw new Error(
      'Thiếu Bunny Storage (BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY, BUNNY_STORAGE_PUBLIC_BASE_URL).'
    )
  }
}

async function bodyToBuffer(body: File | Blob | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body
  return Buffer.from(await body.arrayBuffer())
}

async function uploadExamEssayToBunny(logicalPath: string, buffer: Buffer, contentType: string): Promise<{ publicUrl: string }> {
  const zone = process.env.BUNNY_STORAGE_ZONE!.trim()
  const accessKey = process.env.BUNNY_STORAGE_API_KEY!.trim()
  const publicBase = process.env.BUNNY_STORAGE_PUBLIC_BASE_URL!.trim().replace(/\/$/, '')
  const remoteKey = examEssayBunnyStorageKey(logicalPath)
  const putUrl = `https://storage.bunnycdn.com/${encodeURIComponent(zone)}/${remoteKey}`
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
    throw new Error(`Bunny exam-essay upload failed (${res.status}): ${hint.slice(0, 240)}`)
  }
  const publicUrl = `${publicBase}/${remoteKey}`
  return { publicUrl }
}

/** URL public CDN (Bunny) cho ảnh bài tự luận. `logicalPath` = path logic (vd. `{sessionId}/{userId}/file.jpg`). */
export function getExamEssayPublicUrl(_unused: unknown, logicalPath: string): string {
  requireExamEssayBunnyStorage()
  const clean = logicalPath.replace(/^\/+/, '')
  const publicBase = process.env.BUNNY_STORAGE_PUBLIC_BASE_URL!.trim().replace(/\/$/, '')
  return `${publicBase}/${examEssayBunnyStorageKey(clean)}`
}

type UploadOptions = { contentType?: string; upsert?: boolean }

/**
 * Upload ảnh bài thi tự luận lên Bunny (prefix `exam-essay-images/` trên CDN, cùng env với try-on).
 */
export async function uploadExamEssayImagePublic(
  _unused: unknown,
  logicalPath: string,
  body: File | Blob | Buffer,
  options?: UploadOptions
): Promise<{ publicUrl: string }> {
  requireExamEssayBunnyStorage()
  const contentType = options?.contentType || 'application/octet-stream'
  const clean = logicalPath.replace(/^\/+/, '')
  const buffer = await bodyToBuffer(body)
  return uploadExamEssayToBunny(clean, buffer, contentType)
}

/** Xóa object theo logical path trên Bunny. */
export async function removeExamEssayStorageObjects(
  _unused: unknown,
  logicalPaths: string[]
): Promise<void> {
  requireExamEssayBunnyStorage()
  const uniq = [...new Set(logicalPaths.map((p) => p.replace(/^\/+/, '')).filter(Boolean))]
  if (uniq.length === 0) return

  const zone = process.env.BUNNY_STORAGE_ZONE!.trim()
  const accessKey = process.env.BUNNY_STORAGE_API_KEY!.trim()
  for (const p of uniq) {
    const remoteKey = examEssayBunnyStorageKey(p)
    const delUrl = `https://storage.bunnycdn.com/${encodeURIComponent(zone)}/${remoteKey}`
    try {
      const res = await fetch(delUrl, { method: 'DELETE', headers: { AccessKey: accessKey } })
      if (!res.ok && res.status !== 404) {
        const hint = await res.text().catch(() => '')
        console.warn('[removeExamEssayStorageObjects] Bunny DELETE', p, res.status, hint.slice(0, 200))
      }
    } catch (e) {
      console.warn('[removeExamEssayStorageObjects] Bunny DELETE error', p, e)
    }
  }
}

type BunnyListFileRow = {
  ObjectName?: string
  IsDirectory?: boolean
  LastChanged?: string
  DateCreated?: string
}

/**
 * Xóa file ảnh tự luận trên Bunny (cây `exam-essay-images/`) cũ hơn `retentionDays`.
 * Trả về số file đã DELETE (không đếm thư mục).
 */
export async function cleanupBunnyExamEssayImagesOlderThan(retentionDays: number): Promise<number> {
  if (!examEssayBunnyStorageConfigured() || retentionDays < 1) return 0
  const zone = process.env.BUNNY_STORAGE_ZONE!.trim()
  const accessKey = process.env.BUNNY_STORAGE_API_KEY!.trim()
  const cutoff = Date.now() - retentionDays * 86400000

  async function purgeUnder(prefixSegments: string[]): Promise<number> {
    const encPrefix = prefixSegments.map(encodeURIComponent).join('/')
    const listUrl = `https://storage.bunnycdn.com/${encodeURIComponent(zone)}/${encPrefix}/`
    const res = await fetch(listUrl, { headers: { AccessKey: accessKey } })
    if (!res.ok) {
      if (res.status !== 404) {
        console.warn('[cleanupBunnyExamEssayImages] list', encPrefix, res.status)
      }
      return 0
    }
    let rows: BunnyListFileRow[]
    try {
      rows = (await res.json()) as BunnyListFileRow[]
    } catch {
      return 0
    }
    if (!Array.isArray(rows)) return 0

    let deleted = 0
    for (const row of rows) {
      const name = String(row.ObjectName ?? '')
      if (!name) continue
      const childSegments = [...prefixSegments, name]
      if (row.IsDirectory) {
        deleted += await purgeUnder(childSegments)
        continue
      }
      const changed = row.LastChanged ?? row.DateCreated
      const t = changed ? Date.parse(changed) : NaN
      if (!Number.isFinite(t) || t >= cutoff) continue

      const delKey = childSegments.map(encodeURIComponent).join('/')
      const delUrl = `https://storage.bunnycdn.com/${encodeURIComponent(zone)}/${delKey}`
      const dRes = await fetch(delUrl, { method: 'DELETE', headers: { AccessKey: accessKey } })
      if (dRes.ok || dRes.status === 404) deleted += 1
    }
    return deleted
  }

  return purgeUnder([EXAM_ESSAY_IMAGES_BUCKET])
}
