/**
 * Chỉ số lưu nét vẽ lên infographic cấp giáo trình trong `infographicDrawStrokesBySlide`.
 * Một ảnh dùng chung mọi slide — mọi nét dùng chung một bucket, không tách theo slide.
 */
export const CURRICULUM_INFOGRAPHIC_STROKES_SLIDE_KEY = 0

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
