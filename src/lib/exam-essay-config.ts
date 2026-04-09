import { getStorageLegacyRestOrigin } from '@/lib/storage/storage-legacy-rest-config'

/** Bucket storage legacy — phải trùng migration `20260327100000_exam_essay_submission_storage.sql`. */
export const EXAM_ESSAY_IMAGES_BUCKET = 'exam-essay-images' as const

const LEGACY_EXAM_ESSAY_PUBLIC_PATH_MARKER = `/storage/v1/object/public/${EXAM_ESSAY_IMAGES_BUCKET}/`

function decodeUrlPathSegments(encodedPath: string): string | null {
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
 * Path logic trong bucket (vd. `{sessionId}/{userId}/file.jpg`) từ URL public legacy hoặc Bunny (`…/exam-essay-images/...`).
 */
export function examEssayLogicalPathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null
  const t = url.trim()
  if (!t.startsWith('http')) return null

  const markerIdx = t.indexOf(LEGACY_EXAM_ESSAY_PUBLIC_PATH_MARKER)
  if (markerIdx >= 0) {
    const rest = t.slice(markerIdx + LEGACY_EXAM_ESSAY_PUBLIC_PATH_MARKER.length).split('?')[0]
    return decodeUrlPathSegments(rest)
  }

  const bunnyBase = process.env.BUNNY_STORAGE_PUBLIC_BASE_URL?.trim().replace(/\/$/, '')
  if (bunnyBase && t.startsWith(bunnyBase)) {
    const raw = t.slice(bunnyBase.length).replace(/^\//, '').split('?')[0]
    const decoded = decodeUrlPathSegments(raw)
    if (decoded?.startsWith(`${EXAM_ESSAY_IMAGES_BUCKET}/`)) {
      const rest = decoded.slice(EXAM_ESSAY_IMAGES_BUCKET.length + 1)
      return rest || null
    }
    return null
  }

  try {
    const u = new URL(t)
    if (u.hostname.endsWith('.b-cdn.net')) {
      const raw = u.pathname.replace(/^\//, '').split('?')[0]
      const decoded = decodeUrlPathSegments(raw)
      if (decoded?.startsWith(`${EXAM_ESSAY_IMAGES_BUCKET}/`)) {
        const rest = decoded.slice(EXAM_ESSAY_IMAGES_BUCKET.length + 1)
        return rest || null
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

/** Prefix URL public trên origin legacy (tiền tố cũ; chấp nhận URL có cả Bunny qua `isPublicExamEssayImageUrl`). */
export function publicExamEssayImageUrlPrefix(): string {
  const base = getStorageLegacyRestOrigin()
  if (!base) return ''
  return `${base}/storage/v1/object/public/${EXAM_ESSAY_IMAGES_BUCKET}/`
}

export function isPublicExamEssayImageUrl(url: string): boolean {
  return examEssayLogicalPathFromPublicUrl(url) != null
}

/** Số ngày giữ file ảnh bài tự luận trên storage (sau đó cron có thể xóa). */
export const EXAM_ESSAY_IMAGE_RETENTION_DAYS = 7

/** Hiển thị mốc hết hạn (ISO) theo locale trình duyệt / môi trường. */
export function formatExamEssayImageExpireAtForUi(iso: string): string {
  const d = new Date(iso.trim())
  if (Number.isNaN(d.getTime())) return iso.trim()
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
