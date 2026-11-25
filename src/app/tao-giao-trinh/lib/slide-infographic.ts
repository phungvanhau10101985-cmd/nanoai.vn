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
/** Cùng một cỡ bút trên mọi máy: phần nghìn chiều ngang ảnh, không phải pixel màn hình. */
export function infographicBrushSizeNorm(brushPx: number): number {
  if (brushPx <= 3) return 0.004
  if (brushPx >= 7) return 0.011
  return 0.007
}

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

/** Một khung chữ trên ảnh slide, pixel của ảnh gốc. */
export type SlideInkLine = {
  text: string
  x: number
  y: number
  w: number
  h: number
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
  /** Cỡ ảnh lúc đọc chữ. Bút phát lại dùng khung này, không gọi OCR lại. */
  inkWidth?: number
  inkHeight?: number
  inkLines?: SlideInkLine[]
}

export function sanitizeSlideInk(inf: SlideInfographic | null | undefined): {
  inkWidth: number
  inkHeight: number
  inkLines: SlideInkLine[]
} | null {
  if (!inf?.imageUrl) return null
  const width = Number(inf.inkWidth)
  const height = Number(inf.inkHeight)
  if (!(width > 0) || !(height > 0) || !Array.isArray(inf.inkLines)) return null
  const lines: SlideInkLine[] = []
  for (const line of inf.inkLines) {
    if (lines.length >= 120) break
    const text = String(line?.text ?? '').replace(/\s+/g, ' ').trim()
    const x = Number(line?.x)
    const y = Number(line?.y)
    const w = Number(line?.w)
    const h = Number(line?.h)
    if (!text || ![x, y, w, h].every((n) => Number.isFinite(n))) continue
    lines.push({ text: text.slice(0, 240), x, y, w: Math.max(1, w), h: Math.max(1, h) })
  }
  if (!lines.length) return null
  return { inkWidth: width, inkHeight: height, inkLines: lines }
}

/** Giữ khung chữ đã đo khi bản lưu mới cùng ảnh nhưng chưa kèm khung. */
export function keepSlideInk<T extends { assistantImage?: SlideInfographic | null }>(
  incoming: T[],
  existing: Array<{ assistantImage?: SlideInfographic | null } | null | undefined>
): T[] {
  return incoming.map((slide, index) => {
    const prev = existing[index]?.assistantImage
    const kept = sanitizeSlideInk(prev)
    const current = slide.assistantImage
    if (!current?.imageUrl || !kept || prev?.imageUrl !== current.imageUrl) return slide
    if (sanitizeSlideInk(current)) return slide
    return { ...slide, assistantImage: { ...current, ...kept } }
  })
}
