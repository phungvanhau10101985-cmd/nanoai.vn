/**
 * `worksheet_slides.content_json` / `user_customized_slides.slides_json`:
 * - Legacy: mảng slide
 * - Mới: { v: 2, slides, curriculumInfographic? } — một ảnh infographic cho cả giáo trình
 */
import type { SlideInfographic } from './slide-infographic'

export const CURRICULUM_SLIDES_JSON_V = 2 as const

export type CurriculumSlidesEnvelope = {
  v: typeof CURRICULUM_SLIDES_JSON_V
  slides: unknown[]
  curriculumInfographic?: SlideInfographic
}

function isValidInfographic(val: unknown): val is SlideInfographic {
  if (!val || typeof val !== 'object') return false
  const o = val as Record<string, unknown>
  return typeof o.imageUrl === 'string' && o.imageUrl.length > 0
}

function isEnvelope(raw: unknown): raw is CurriculumSlidesEnvelope {
  return (
    !!raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    (raw as CurriculumSlidesEnvelope).v === CURRICULUM_SLIDES_JSON_V &&
    Array.isArray((raw as CurriculumSlidesEnvelope).slides)
  )
}

function stripInfographicFromSlideRow(item: unknown): unknown {
  if (!item || typeof item !== 'object') return item
  const o = item as Record<string, unknown>
  if (!('infographic' in o)) return item
  const rest: Record<string, unknown> = { ...o }
  delete rest.infographic
  return rest
}

/**
 * Đọc DB → slides (không còn infographic trên từng slide) + infographic cấp giáo trình.
 * Legacy: nếu slide nào có `infographic`, lấy bản đầu tiên làm curriculumInfographic và gỡ khỏi slide.
 */
export function parseStoredCurriculumSlidesJson(raw: unknown): {
  slides: unknown[]
  curriculumInfographic?: SlideInfographic
} {
  if (isEnvelope(raw)) {
    const slides = raw.slides.map((s) => stripInfographicFromSlideRow(s))
    const curriculumInfographic = isValidInfographic(raw.curriculumInfographic)
      ? raw.curriculumInfographic
      : undefined
    return { slides, curriculumInfographic }
  }
  if (Array.isArray(raw)) {
    let curriculumInfographic: SlideInfographic | undefined
    const slides = raw.map((item) => {
      if (!item || typeof item !== 'object') return item
      const o = item as Record<string, unknown>
      const inf = o.infographic
      if (isValidInfographic(inf) && !curriculumInfographic) {
        curriculumInfographic = inf
      }
      return stripInfographicFromSlideRow(item)
    })
    return { slides, curriculumInfographic }
  }
  return { slides: [] }
}

/** Ghi DB: có infographic → envelope v2; không có → mảng slide (tương thích cũ). */
export function serializeStoredCurriculumSlidesJson(
  slides: unknown[],
  curriculumInfographic?: SlideInfographic
): unknown {
  const slidesClean = slides.map((s) => stripInfographicFromSlideRow(s))
  if (curriculumInfographic && isValidInfographic(curriculumInfographic)) {
    return {
      v: CURRICULUM_SLIDES_JSON_V,
      slides: slidesClean,
      curriculumInfographic,
    } satisfies CurriculumSlidesEnvelope
  }
  return slidesClean
}
