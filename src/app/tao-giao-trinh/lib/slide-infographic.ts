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
