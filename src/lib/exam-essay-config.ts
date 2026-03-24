/** Bucket Supabase Storage — phải trùng migration `20260327100000_exam_essay_submission_storage.sql`. */
export const EXAM_ESSAY_IMAGES_BUCKET = 'exam-essay-images' as const

/** Prefix URL public cho ảnh bài tự luận (khớp submit + essay-image API). */
export function publicExamEssayImageUrlPrefix(): string {
  const base = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')
  if (!base) return ''
  return `${base}/storage/v1/object/public/${EXAM_ESSAY_IMAGES_BUCKET}/`
}

export function isPublicExamEssayImageUrl(url: string): boolean {
  const p = publicExamEssayImageUrlPrefix()
  return Boolean(p && url.startsWith(p))
}

/** Số ngày giữ file ảnh bài tự luận trên storage (sau đó cron có thể xóa). */
export const EXAM_ESSAY_IMAGE_RETENTION_DAYS = 7

/** Hiển thị mốc hết hạn (ISO) theo locale trình duyệt / môi trường. */
export function formatExamEssayImageExpireAtForUi(iso: string): string {
  const d = new Date(iso.trim())
  if (Number.isNaN(d.getTime())) return iso.trim()
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
