/**
 * `worksheet_slides.content_json` / `user_customized_slides.slides_json`:
 * - Legacy: mảng slide
 * - v2: { v: 2, slides, curriculumInfographic? } — một ảnh infographic cho cả giáo trình
 * - v3: { v: 3, slides, curriculumInfographic?, lessonChunks? } — thêm metadata chia theo tiết
 */
import type { SlideInfographic } from './slide-infographic'

export const CURRICULUM_SLIDES_JSON_V2 = 2 as const
export const CURRICULUM_SLIDES_JSON_V = 3 as const

export type CurriculumLessonChunk = {
  lessonNo: number
  startIndex: number
  endIndex: number
  slideCount: number
}

export type CurriculumSlidesEnvelope = {
  v: typeof CURRICULUM_SLIDES_JSON_V
  slides: unknown[]
  curriculumInfographic?: SlideInfographic
  lessonChunks?: CurriculumLessonChunk[]
}

function isValidInfographic(val: unknown): val is SlideInfographic {
  if (!val || typeof val !== 'object') return false
  const o = val as Record<string, unknown>
  return typeof o.imageUrl === 'string' && o.imageUrl.length > 0
}

function isEnvelope(raw: unknown): raw is CurriculumSlidesEnvelope {
  const v = (raw as { v?: unknown })?.v
  return (
    !!raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    (v === CURRICULUM_SLIDES_JSON_V || v === CURRICULUM_SLIDES_JSON_V2) &&
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

function parseLessonNoFromTitle(title: string): number | null {
  const text = String(title || '')
  const m = text.match(/(?:ti[eế]t|lesson|bu[oổ]i)\s*[:.\-]?\s*(\d{1,3})/i)
  if (!m?.[1]) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.floor(n)
}

function isLessonChunkArray(raw: unknown): raw is CurriculumLessonChunk[] {
  if (!Array.isArray(raw)) return false
  return raw.every((row) => {
    if (!row || typeof row !== 'object') return false
    const o = row as Record<string, unknown>
    return (
      Number.isFinite(Number(o.lessonNo)) &&
      Number.isFinite(Number(o.startIndex)) &&
      Number.isFinite(Number(o.endIndex)) &&
      Number.isFinite(Number(o.slideCount))
    )
  })
}

function buildFallbackLessonChunks(slideCount: number): CurriculumLessonChunk[] {
  const out: CurriculumLessonChunk[] = []
  const chunkSize = 10
  let lessonNo = 1
  for (let i = 0; i < slideCount; i += chunkSize) {
    const end = Math.min(slideCount - 1, i + chunkSize - 1)
    out.push({
      lessonNo,
      startIndex: i,
      endIndex: end,
      slideCount: end - i + 1,
    })
    lessonNo += 1
  }
  return out
}

export function buildLessonChunksFromSlides(slides: unknown[]): CurriculumLessonChunk[] {
  if (!Array.isArray(slides) || slides.length <= 0) return []
  const parsed = slides.map((s) => {
    const title = (s && typeof s === 'object' && typeof (s as { title?: unknown }).title === 'string')
      ? ((s as { title?: string }).title ?? '')
      : ''
    return parseLessonNoFromTitle(title)
  })
  const hasExplicit = parsed.some((n) => n != null)
  if (!hasExplicit) return buildFallbackLessonChunks(slides.length)

  const order: number[] = []
  const ranges = new Map<number, { start: number; end: number }>()
  let currentLesson = 1
  for (let i = 0; i < slides.length; i += 1) {
    const p = parsed[i]
    if (p != null) currentLesson = p
    if (!ranges.has(currentLesson)) {
      ranges.set(currentLesson, { start: i, end: i })
      order.push(currentLesson)
    } else {
      ranges.get(currentLesson)!.end = i
    }
  }
  const out = order.map((lessonNo) => {
    const r = ranges.get(lessonNo)!
    return {
      lessonNo,
      startIndex: r.start,
      endIndex: r.end,
      slideCount: r.end - r.start + 1,
    }
  })
  if (out.length <= 1 && slides.length > 10) return buildFallbackLessonChunks(slides.length)
  return out
}

export function sliceSlidesByLesson(
  slides: unknown[],
  lessonChunks: CurriculumLessonChunk[] | undefined,
  lessonNo: number
): unknown[] {
  if (!Array.isArray(slides) || slides.length === 0) return []
  const chunks = lessonChunks && lessonChunks.length > 0 ? lessonChunks : buildLessonChunksFromSlides(slides)
  const found = chunks.find((c) => c.lessonNo === lessonNo)
  if (!found) return []
  const start = Math.max(0, Math.min(slides.length - 1, found.startIndex))
  const end = Math.max(start, Math.min(slides.length - 1, found.endIndex))
  return slides.slice(start, end + 1)
}

/**
 * Đọc DB → slides (không còn infographic trên từng slide) + infographic cấp giáo trình.
 * Legacy: nếu slide nào có `infographic`, lấy bản đầu tiên làm curriculumInfographic và gỡ khỏi slide.
 */
export function parseStoredCurriculumSlidesJson(raw: unknown): {
  slides: unknown[]
  curriculumInfographic?: SlideInfographic
  lessonChunks?: CurriculumLessonChunk[]
} {
  if (isEnvelope(raw)) {
    const slides = raw.slides.map((s) => stripInfographicFromSlideRow(s))
    const curriculumInfographic = isValidInfographic(raw.curriculumInfographic)
      ? raw.curriculumInfographic
      : undefined
    const lessonChunks = isLessonChunkArray((raw as { lessonChunks?: unknown }).lessonChunks)
      ? (raw as { lessonChunks?: CurriculumLessonChunk[] }).lessonChunks
      : undefined
    return { slides, curriculumInfographic, lessonChunks }
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
    return { slides, curriculumInfographic, lessonChunks: buildLessonChunksFromSlides(slides) }
  }
  return { slides: [], lessonChunks: [] }
}

/** Ghi DB: có infographic → envelope v2; không có → mảng slide (tương thích cũ). */
export function serializeStoredCurriculumSlidesJson(
  slides: unknown[],
  curriculumInfographic?: SlideInfographic
): unknown {
  const slidesClean = slides.map((s) => stripInfographicFromSlideRow(s))
  const lessonChunks = buildLessonChunksFromSlides(slidesClean)
  const envelope: CurriculumSlidesEnvelope = {
    v: CURRICULUM_SLIDES_JSON_V,
    slides: slidesClean,
    lessonChunks,
  }
  if (curriculumInfographic && isValidInfographic(curriculumInfographic)) {
    envelope.curriculumInfographic = curriculumInfographic
  }
  return envelope
}
