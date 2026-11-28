import {
  fetchWorksheetCurriculumLessonSlidesRowsForLessonPg,
  fetchWorksheetSlidesRowMetaAndJsonPg,
  saveWorksheetCurriculumLessonSlidesCacheRowPg,
  updateWorksheetSlidesContentByCurriculumPg,
  type WorksheetCurriculumLessonSlideMode,
} from '@/lib/db/tao-giao-trinh-curriculum-pg'
import { parseStoredCurriculumSlidesJson, serializeStoredCurriculumSlidesJson } from './curriculum-slides-json'
import { sanitizeSlideInk, slideAssistantImageUrl, type SlideInfographic } from './slide-infographic'

type SlideRow = { assistantImage?: SlideInfographic | null }

function asMode(mode: string): WorksheetCurriculumLessonSlideMode | null {
  if (mode === 'shared' || mode === 'original' || mode === 'personal') return mode
  return null
}

function imageForStore(existing: SlideInfographic | null | undefined, incoming: SlideInfographic): SlideInfographic {
  if (slideAssistantImageUrl(existing) !== incoming.imageUrl) return incoming
  const ink = sanitizeSlideInk(existing)
  if (!ink) return existing?.imageUrl ? existing : incoming
  return { ...incoming, ...ink }
}

function applyImageAtIndex(slides: SlideRow[], slideIndex: number, incoming: SlideInfographic): { slides: SlideRow[]; changed: boolean } {
  if (slideIndex < 0 || slideIndex >= slides.length) return { slides, changed: false }
  const current = slides[slideIndex]?.assistantImage
  const next = imageForStore(current, incoming)
  if (slideAssistantImageUrl(current) === next.imageUrl && sanitizeSlideInk(current) && sanitizeSlideInk(next)) {
    return { slides, changed: false }
  }
  if (slideAssistantImageUrl(current) === next.imageUrl && !sanitizeSlideInk(current) && !sanitizeSlideInk(next)) {
    return { slides, changed: false }
  }
  const copy = slides.slice()
  copy[slideIndex] = { ...copy[slideIndex], assistantImage: next }
  return { slides: copy, changed: true }
}

async function writeLessonRow(opts: {
  curriculumId: string
  lessonNo: number
  mode: WorksheetCurriculumLessonSlideMode
  userId: string
  slides: unknown[]
  lessonImage?: SlideInfographic
}): Promise<string | null> {
  const slidesJson = serializeStoredCurriculumSlidesJson(opts.slides, opts.lessonImage)
  const saved = await saveWorksheetCurriculumLessonSlidesCacheRowPg({
    curriculumId: opts.curriculumId,
    mode: opts.mode,
    lessonNo: opts.lessonNo,
    slidesJson,
    userId: opts.userId,
  })
  return saved.error ?? null
}

/** Ghi URL ảnh slide lên mọi bản của tiết (chung, gốc, từng giáo viên) mà không đổi chữ. */
export async function publishSharedSlideImages(opts: {
  curriculumId: string
  lessonNo: number
  slides: SlideRow[]
  userId: string
}): Promise<{ error?: string }> {
  const images = opts.slides.map((slide) => (slideAssistantImageUrl(slide.assistantImage) ? slide.assistantImage! : null))
  if (!images.some(Boolean)) return {}
  const rows = await fetchWorksheetCurriculumLessonSlidesRowsForLessonPg(opts.curriculumId, opts.lessonNo)
  if (rows.length === 0) return {}
  let sharedError: string | undefined
  for (const row of rows) {
    const mode = asMode(row.mode)
    if (!mode) continue
    if (mode === 'personal' && !row.user_id) continue
    const parsed = parseStoredCurriculumSlidesJson(row.slides_json)
    const slides = parsed.slides as SlideRow[]
    if (slides.length === 0) continue
    let changed = false
    const next = slides.map((slide, index) => {
      const incoming = images[index]
      if (!incoming) return slide
      const stored = imageForStore(slide.assistantImage, incoming)
      if (slideAssistantImageUrl(slide.assistantImage) === stored.imageUrl && Boolean(sanitizeSlideInk(slide.assistantImage)) === Boolean(sanitizeSlideInk(stored))) {
        return slide
      }
      changed = true
      return { ...slide, assistantImage: stored }
    })
    if (!changed) continue
    const error = await writeLessonRow({
      curriculumId: opts.curriculumId,
      lessonNo: opts.lessonNo,
      mode,
      userId: mode === 'personal' ? String(row.user_id) : opts.userId,
      slides: next,
      lessonImage: parsed.curriculumInfographic,
    })
    if (error && mode === 'shared') sharedError = error
  }
  return sharedError ? { error: sharedError } : {}
}

async function publishLessonImage(opts: {
  curriculumId: string
  lessonNo: number
  userId: string
  infographic: SlideInfographic
}): Promise<{ ok: true } | { ok: false; reason: 'no-slides' | 'save'; error?: string }> {
  const rows = await fetchWorksheetCurriculumLessonSlidesRowsForLessonPg(opts.curriculumId, opts.lessonNo)
  const usable = rows.filter((row) => {
    const mode = asMode(row.mode)
    if (!mode || (mode === 'personal' && !row.user_id)) return false
    return parseStoredCurriculumSlidesJson(row.slides_json).slides.length > 0
  })
  if (usable.length === 0) return { ok: false, reason: 'no-slides' }
  for (const row of usable) {
    const mode = asMode(row.mode)!
    const parsed = parseStoredCurriculumSlidesJson(row.slides_json)
    const error = await writeLessonRow({
      curriculumId: opts.curriculumId,
      lessonNo: opts.lessonNo,
      mode,
      userId: mode === 'personal' ? String(row.user_id) : opts.userId,
      slides: parsed.slides,
      lessonImage: opts.infographic,
    })
    if (error && mode === 'shared') return { ok: false, reason: 'save', error }
  }
  return { ok: true }
}

async function publishCurriculumImage(opts: {
  curriculumId: string
  infographic: SlideInfographic
}): Promise<{ ok: true } | { ok: false; reason: 'no-slides' | 'save'; error?: string }> {
  const row = await fetchWorksheetSlidesRowMetaAndJsonPg(opts.curriculumId)
  if (!row?.content_json) return { ok: false, reason: 'no-slides' }
  const parsed = parseStoredCurriculumSlidesJson(row.content_json)
  if (parsed.slides.length === 0) return { ok: false, reason: 'no-slides' }
  const saved = await updateWorksheetSlidesContentByCurriculumPg({
    curriculumId: opts.curriculumId,
    contentJson: serializeStoredCurriculumSlidesJson(parsed.slides, opts.infographic),
    topic: row.topic,
    subjectId: row.subject_id || 'toan',
    gradeLevelId: row.grade_level_id || 'lop-6',
  })
  if (saved.error) return { ok: false, reason: 'save', error: saved.error }
  return { ok: true }
}

/**
 * Ghi ảnh ngay sau khi upload, trước khi trả cho trình duyệt.
 * Slide chung là bản gốc. Mọi bản riêng của tiết nhận cùng URL.
 */
export async function persistGeneratedCurriculumImage(opts: {
  curriculumId: string
  userId: string
  scope: 'slide' | 'lesson' | 'curriculum'
  lessonNo?: number
  slideIndex?: number
  infographic: SlideInfographic
}): Promise<{ ok: true } | { ok: false; reason: 'no-slides' | 'save'; error?: string }> {
  if (!slideAssistantImageUrl(opts.infographic)) return { ok: false, reason: 'save', error: 'Thiếu URL ảnh.' }
  if (opts.scope === 'curriculum') return publishCurriculumImage(opts)
  const lessonNo = Math.max(1, Math.floor(Number(opts.lessonNo) || 1))
  if (opts.scope === 'lesson') {
    return publishLessonImage({ ...opts, lessonNo, infographic: opts.infographic })
  }
  const slideIndex = Math.floor(Number(opts.slideIndex))
  if (!Number.isFinite(slideIndex) || slideIndex < 0) return { ok: false, reason: 'save', error: 'Thiếu số thứ tự slide.' }
  const rows = await fetchWorksheetCurriculumLessonSlidesRowsForLessonPg(opts.curriculumId, lessonNo)
  const usable = rows.filter((row) => {
    const mode = asMode(row.mode)
    if (!mode || (mode === 'personal' && !row.user_id)) return false
    return parseStoredCurriculumSlidesJson(row.slides_json).slides.length > slideIndex
  })
  if (usable.length === 0) return { ok: false, reason: 'no-slides' }
  const sharedRow = rows.find((row) => row.mode === 'shared' && !row.user_id)
  if (!sharedRow) {
    const donor = usable.find((row) => row.mode === 'original') ?? usable[0]
    const parsed = parseStoredCurriculumSlidesJson(donor.slides_json)
    const applied = applyImageAtIndex(parsed.slides as SlideRow[], slideIndex, opts.infographic)
    const error = await writeLessonRow({
      curriculumId: opts.curriculumId,
      lessonNo,
      mode: 'shared',
      userId: opts.userId,
      slides: applied.slides,
      lessonImage: parsed.curriculumInfographic,
    })
    if (error) return { ok: false, reason: 'save', error }
  }
  for (const row of usable) {
    const mode = asMode(row.mode)!
    const parsed = parseStoredCurriculumSlidesJson(row.slides_json)
    const applied = applyImageAtIndex(parsed.slides as SlideRow[], slideIndex, opts.infographic)
    if (!applied.changed) continue
    const error = await writeLessonRow({
      curriculumId: opts.curriculumId,
      lessonNo,
      mode,
      userId: mode === 'personal' ? String(row.user_id) : opts.userId,
      slides: applied.slides,
      lessonImage: parsed.curriculumInfographic,
    })
    if (error && mode === 'shared') return { ok: false, reason: 'save', error }
  }
  return { ok: true }
}
