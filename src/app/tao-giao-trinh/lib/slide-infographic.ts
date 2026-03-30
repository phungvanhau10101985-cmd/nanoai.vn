/**
 * Chỉ số lưu nét vẽ lên infographic cấp giáo trình trong `infographicDrawStrokesBySlide`.
 * Một ảnh dùng chung mọi slide — mọi nét dùng chung một bucket, không tách theo slide.
 */
export const CURRICULUM_INFOGRAPHIC_STROKES_SLIDE_KEY = 0

/**
 * Bucket key for infographic draw strokes.
 * - Legacy/default: key 0
 * - Per-image: deterministic positive int derived from image URL
 */
export function getInfographicStrokeBucketKey(imageUrl?: string | null): number {
  const raw = String(imageUrl ?? '').trim()
  if (!raw) return CURRICULUM_INFOGRAPHIC_STROKES_SLIDE_KEY
  let hash = 0
  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0
  }
  const normalized = Math.abs(hash)
  // avoid legacy bucket 0 so old data can coexist
  return Math.max(1, normalized)
}

/** Dữ liệu infographic một giáo trình (một ảnh) — lưu trong envelope `content_json` / `slides_json` */
export type SlideInfographic = {
  /** Tóm tắt ngắn (theo locale UI khi tạo) */
  summary: string
  /** Mã Mermaid (flowchart / mindmap...) */
  mermaid: string
  /** URL ảnh đã upload (2K) */
  imageUrl: string
  generatedAt: string
}
