import { createHash } from 'crypto'
import { consecutiveReviewCounts, REVIEW_CONSECUTIVE_PASSES } from '@/app/tao-giao-trinh/lib/review-consecutive'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'
import {
  fetchWorksheetCurriculumLessonSlidesJsonForLessonModePg,
  fetchWorksheetCurriculumLessonSlidesRowsForLessonPg,
  saveWorksheetCurriculumLessonSlidesCacheRowPg,
} from '@/lib/db/tao-giao-trinh-curriculum-pg'

export const SLIDE_REVIEW_WARN_PASSES = REVIEW_CONSECUTIVE_PASSES

export type SlideReviewStat = {
  confirmCount: number
  rejectCount: number
  editCount: number
  warn: boolean
  proposalText: string | null
  /** Bản gốc đang dùng chung, để đối chiếu với bản sửa. */
  sharedText: string | null
  /** Bản người này đang dùng: bản sửa nếu là người sửa hoặc đã duyệt, bản gốc nếu vòng sửa đã bị bác. */
  adoptedText: string | null
  proposalAuthorIsMe: boolean
  myVote: 'agree' | 'reject' | null
  /** Người này đã xác nhận hoặc sửa slide này một lần. */
  confirmedByMe: boolean
}

type ReviewRow = {
  slide_index: number
  content_hash: string
  user_id: string
  action: 'confirm' | 'edit' | 'reject' | 'agree'
  body: string | null
  created_at: string
}

export function hashSlideReviewText(text: string): string {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  return createHash('sha256').update(normalized).digest('hex').slice(0, 32)
}

function votesAfterEdit(mine: ReviewRow[], lastEdit: ReviewRow) {
  const afterEdit = new Date(lastEdit.created_at).getTime()
  const author = lastEdit.user_id.trim().toLowerCase()
  return mine
    .filter(
      (row) =>
        (row.action === 'agree' || row.action === 'reject') &&
        row.content_hash === lastEdit.content_hash &&
        row.user_id.trim().toLowerCase() !== author &&
        new Date(row.created_at).getTime() > afterEdit
    )
    .map((row) => ({
      userId: row.user_id,
      action: row.action as 'agree' | 'reject',
      at: new Date(row.created_at).getTime(),
    }))
}

export function statsFromReviewRows(
  rows: ReviewRow[],
  hashes: string[],
  userId: string,
  sharedTexts: string[] = []
): SlideReviewStat[] {
  const me = userId.toLowerCase()
  const myConfirmedHashes = new Set(
    rows
      .filter((row) => row.user_id.toLowerCase() === me && (row.action === 'confirm' || row.action === 'edit'))
      .map((row) => row.content_hash)
  )
  return hashes.map((contentHash, slideIndex) => {
    const mine = rows.filter((row) => row.slide_index === slideIndex)
    const edits = mine.filter((row) => row.action === 'edit')
    const lastEdit = edits[edits.length - 1]
    const counts = lastEdit ? consecutiveReviewCounts(votesAfterEdit(mine, lastEdit)) : null
    const confirmCount = counts?.agreeCount ?? 0
    const rejectCount = counts?.rejectCount ?? 0
    const closed = Boolean(counts?.closed)
    const warn = Boolean(lastEdit) && !closed
    const myVoteRow = lastEdit
      ? mine.filter(
          (row) =>
            (row.action === 'agree' || row.action === 'reject') &&
            row.user_id.trim().toLowerCase() === userId.trim().toLowerCase() &&
            row.content_hash === lastEdit.content_hash &&
            new Date(row.created_at).getTime() > new Date(lastEdit.created_at).getTime()
        ).at(-1)
      : undefined
    const myVote = myVoteRow?.action === 'agree' || myVoteRow?.action === 'reject' ? myVoteRow.action : null
    const author = Boolean(lastEdit && lastEdit.user_id.trim().toLowerCase() === userId.trim().toLowerCase())
    const sharedText = String(sharedTexts[slideIndex] || '').trim() || null
    let adoptedText: string | null = null
    if (lastEdit?.body) {
      if (confirmCount >= SLIDE_REVIEW_WARN_PASSES) adoptedText = lastEdit.body
      else if (rejectCount >= SLIDE_REVIEW_WARN_PASSES) adoptedText = sharedText
      else if (author || myVote === 'agree') adoptedText = lastEdit.body
    }
    const confirmedByMe =
      myConfirmedHashes.has(contentHash) ||
      mine.some((row) => row.user_id.toLowerCase() === me && (row.action === 'confirm' || row.action === 'edit'))
    return {
      confirmCount,
      rejectCount,
      editCount: edits.length,
      warn,
      proposalText: warn && lastEdit?.body ? lastEdit.body : null,
      sharedText: warn ? sharedText : null,
      adoptedText,
      proposalAuthorIsMe: Boolean(warn && author),
      myVote,
      confirmedByMe,
    }
  })
}

function slideListFromJson(raw: unknown): { slides: Array<Record<string, unknown>>; wrap: (slides: Array<Record<string, unknown>>) => unknown } | null {
  if (Array.isArray(raw)) {
    return { slides: raw as Array<Record<string, unknown>>, wrap: (slides) => slides }
  }
  if (raw && typeof raw === 'object' && Array.isArray((raw as { slides?: unknown }).slides)) {
    return {
      slides: (raw as { slides: Array<Record<string, unknown>> }).slides,
      wrap: (slides) => ({ ...(raw as object), slides }),
    }
  }
  return null
}

function readSlideText(raw: unknown, slideIndex: number): string {
  const parsed = slideListFromJson(raw)
  if (!parsed || slideIndex < 0 || slideIndex >= parsed.slides.length) return ''
  const current = parsed.slides[slideIndex] ?? {}
  const block = Array.isArray(current.blocks) && current.blocks[0] && typeof current.blocks[0] === 'object'
    ? String((current.blocks[0] as { content?: unknown }).content || '')
    : ''
  return (block || String(current.content || '')).trim()
}

function patchSlideList(raw: unknown, slideIndex: number, text: string): unknown | null {
  const parsed = slideListFromJson(raw)
  if (!parsed || slideIndex < 0 || slideIndex >= parsed.slides.length) return null
  const current = parsed.slides[slideIndex] ?? {}
  const header = Array.isArray(current.blocks) && current.blocks[0] && typeof current.blocks[0] === 'object'
    ? String((current.blocks[0] as { header?: unknown }).header || 'Nội dung')
    : 'Nội dung'
  const next = [...parsed.slides]
  next[slideIndex] = { ...current, content: text, blocks: [{ header, content: text }] }
  return parsed.wrap(next)
}

async function restorePersonalSlideFromShared(params: {
  curriculumId: string
  lessonNo: number
  slideIndex: number
  userId: string
}): Promise<void> {
  const own = await fetchWorksheetCurriculumLessonSlidesJsonForLessonModePg(
    params.curriculumId,
    params.lessonNo,
    'personal',
    params.userId
  )
  if (!own?.slides_json) return
  const shared = await fetchWorksheetCurriculumLessonSlidesJsonForLessonModePg(
    params.curriculumId,
    params.lessonNo,
    'shared',
    params.userId
  )
  const text = readSlideText(shared?.slides_json, params.slideIndex)
  if (!text) return
  await writeSlideText({ ...params, mode: 'personal', text })
}

async function writeSlideText(params: {
  curriculumId: string
  lessonNo: number
  slideIndex: number
  text: string
  userId: string
  mode: 'personal' | 'shared'
}): Promise<void> {
  const own = params.mode === 'personal'
    ? await fetchWorksheetCurriculumLessonSlidesJsonForLessonModePg(params.curriculumId, params.lessonNo, 'personal', params.userId)
    : null
  const base = own ?? await fetchWorksheetCurriculumLessonSlidesJsonForLessonModePg(params.curriculumId, params.lessonNo, 'shared', params.userId)
  const patched = patchSlideList(base?.slides_json, params.slideIndex, params.text)
  if (!patched) return
  await saveWorksheetCurriculumLessonSlidesCacheRowPg({
    curriculumId: params.curriculumId,
    mode: params.mode,
    lessonNo: params.lessonNo,
    slidesJson: patched,
    userId: params.userId,
  })
}

export async function fetchSlideReviewStatsPg(params: {
  curriculumId: string
  lessonNo: number
  slideTexts: string[]
  userId: string
}): Promise<SlideReviewStat[] | null> {
  if (!isPgConfigured()) return null
  const hashes = params.slideTexts.map((text) => hashSlideReviewText(text))
  try {
    const rows = await pgQuery<ReviewRow>(
      `select slide_index, content_hash, user_id::text as user_id, action, body, created_at
       from public.worksheet_slide_content_reviews
       where curriculum_id = $1::uuid and lesson_no = $2
       order by created_at asc, id asc`,
      [params.curriculumId, params.lessonNo]
    )
    const shared = await fetchWorksheetCurriculumLessonSlidesJsonForLessonModePg(
      params.curriculumId,
      params.lessonNo,
      'shared',
      params.userId
    )
    const sharedTexts = params.slideTexts.map((_, index) => readSlideText(shared?.slides_json, index))
    const stats = statsFromReviewRows(rows, hashes, params.userId, sharedTexts)
    try {
      const acked = await pgQuery<{ ok: boolean }>(
        `select exists (
           select 1 from public.worksheet_lesson_teacher_reviews
           where curriculum_id = $1::uuid and lesson_no = $2 and user_id = $3::uuid
         ) as ok`,
        [params.curriculumId, params.lessonNo, params.userId]
      )
      if (acked[0]?.ok) return stats.map((stat) => ({ ...stat, confirmedByMe: true }))
    } catch (e) {
      console.error('[slide-content-review-pg] fetchSlideReviewStatsPg ack', e)
    }
    return stats
  } catch (e) {
    console.error('[slide-content-review-pg] fetchSlideReviewStatsPg', e)
    return null
  }
}

export async function recordSlideReviewPg(params: {
  curriculumId: string
  lessonNo: number
  slideIndex: number
  slideText: string
  userId: string
  action: 'confirm' | 'edit' | 'agree' | 'reject'
  slideTexts: string[]
}): Promise<SlideReviewStat[] | null> {
  if (!isPgConfigured()) return null
  const contentHash = hashSlideReviewText(params.slideText)
  try {
    if (params.action === 'edit') {
      await pgQuery(
        `insert into public.worksheet_slide_content_reviews
           (curriculum_id, lesson_no, slide_index, content_hash, user_id, action, body)
         values ($1::uuid, $2, $3, $4, $5::uuid, 'edit', $6)`,
        [params.curriculumId, params.lessonNo, params.slideIndex, contentHash, params.userId, params.slideText]
      )
      await writeSlideText({ ...params, mode: 'personal', text: params.slideText })
    } else if (params.action === 'agree' || params.action === 'reject') {
      const proposal = await pgQuery<ReviewRow>(
        `select slide_index, content_hash, user_id::text as user_id, action, body, created_at
         from public.worksheet_slide_content_reviews
         where curriculum_id = $1::uuid and lesson_no = $2 and slide_index = $3 and action = 'edit'
         order by created_at desc, id desc
         limit 1`,
        [params.curriculumId, params.lessonNo, params.slideIndex]
      )
      const lastEdit = proposal[0]
      if (lastEdit && lastEdit.user_id.trim().toLowerCase() !== params.userId.trim().toLowerCase() && lastEdit.body) {
        await pgQuery(
          `delete from public.worksheet_slide_content_reviews
           where curriculum_id = $1::uuid and lesson_no = $2 and slide_index = $3
             and content_hash = $4 and user_id = $5::uuid
             and action = $6`,
          [
            params.curriculumId,
            params.lessonNo,
            params.slideIndex,
            lastEdit.content_hash,
            params.userId,
            params.action === 'agree' ? 'reject' : 'agree',
          ]
        )
        const voteSql = params.action === 'agree'
          ? `insert into public.worksheet_slide_content_reviews
               (curriculum_id, lesson_no, slide_index, content_hash, user_id, action, body)
             values ($1::uuid, $2, $3, $4, $5::uuid, 'agree', $6)
             on conflict (curriculum_id, lesson_no, slide_index, content_hash, user_id)
               where action = 'agree'
               do nothing`
          : `insert into public.worksheet_slide_content_reviews
               (curriculum_id, lesson_no, slide_index, content_hash, user_id, action, body)
             values ($1::uuid, $2, $3, $4, $5::uuid, 'reject', $6)
             on conflict (curriculum_id, lesson_no, slide_index, content_hash, user_id)
               where action = 'reject'
               do nothing`
        await pgQuery(voteSql, [
          params.curriculumId,
          params.lessonNo,
          params.slideIndex,
          lastEdit.content_hash,
          params.userId,
          lastEdit.body,
        ])
        const voteRows = await pgQuery<{ user_id: string; action: 'agree' | 'reject'; created_at: string }>(
          `select user_id::text as user_id, action, created_at
           from public.worksheet_slide_content_reviews
           where curriculum_id = $1::uuid and lesson_no = $2 and slide_index = $3
             and action in ('agree', 'reject') and content_hash = $4 and user_id <> $5::uuid
             and created_at > $6::timestamptz
           order by created_at asc, id asc`,
          [params.curriculumId, params.lessonNo, params.slideIndex, lastEdit.content_hash, lastEdit.user_id, lastEdit.created_at]
        )
        const tail = consecutiveReviewCounts(
          voteRows.map((row) => ({
            userId: row.user_id,
            action: row.action,
            at: new Date(row.created_at).getTime(),
          }))
        )
        if (params.action === 'agree') {
          await writeSlideText({
            curriculumId: params.curriculumId,
            lessonNo: params.lessonNo,
            slideIndex: params.slideIndex,
            text: lastEdit.body,
            userId: params.userId,
            mode: 'personal',
          })
          if (tail.agreeCount >= SLIDE_REVIEW_WARN_PASSES) {
            await writeSlideText({
              curriculumId: params.curriculumId,
              lessonNo: params.lessonNo,
              slideIndex: params.slideIndex,
              text: lastEdit.body,
              userId: params.userId,
              mode: 'shared',
            })
            const copies = await fetchWorksheetCurriculumLessonSlidesRowsForLessonPg(params.curriculumId, params.lessonNo)
            for (const copy of copies) {
              if (copy.mode !== 'personal' || !copy.user_id) continue
              await writeSlideText({
                curriculumId: params.curriculumId,
                lessonNo: params.lessonNo,
                slideIndex: params.slideIndex,
                text: lastEdit.body,
                userId: copy.user_id,
                mode: 'personal',
              })
            }
          }
        } else {
          await restorePersonalSlideFromShared({
            curriculumId: params.curriculumId,
            lessonNo: params.lessonNo,
            slideIndex: params.slideIndex,
            userId: params.userId,
          })
          if (tail.rejectCount >= SLIDE_REVIEW_WARN_PASSES) {
            const keepers = await pgQuery<{ user_id: string }>(
              `select distinct user_id::text as user_id
               from public.worksheet_slide_content_reviews
               where curriculum_id = $1::uuid and lesson_no = $2 and slide_index = $3
                 and content_hash = $4
                 and (user_id = $5::uuid or (action = 'agree' and created_at > $6::timestamptz))`,
              [params.curriculumId, params.lessonNo, params.slideIndex, lastEdit.content_hash, lastEdit.user_id, lastEdit.created_at]
            )
            for (const keeper of keepers) {
              await restorePersonalSlideFromShared({
                curriculumId: params.curriculumId,
                lessonNo: params.lessonNo,
                slideIndex: params.slideIndex,
                userId: keeper.user_id,
              })
            }
          }
        }
      }
    } else {
      await pgQuery(
        `insert into public.worksheet_slide_content_reviews
           (curriculum_id, lesson_no, slide_index, content_hash, user_id, action, body)
         values ($1::uuid, $2, $3, $4, $5::uuid, 'confirm', $6)
         on conflict (curriculum_id, lesson_no, slide_index, content_hash, user_id)
           where action = 'confirm'
           do nothing`,
        [params.curriculumId, params.lessonNo, params.slideIndex, contentHash, params.userId, params.slideText]
      )
    }
    return fetchSlideReviewStatsPg({
      curriculumId: params.curriculumId,
      lessonNo: params.lessonNo,
      slideTexts: params.slideTexts,
      userId: params.userId,
    })
  } catch (e) {
    console.error('[slide-content-review-pg] recordSlideReviewPg', e)
    return null
  }
}

/** Giáo viên đã duyệt hết tiết này một lần (cờ tiết, hoặc đã xác nhận đủ slide hiện có). */
export async function teacherHasReviewedLessonPg(params: {
  curriculumId: string
  lessonNo: number
  userId: string
  slideCount: number
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const acked = await pgQuery<{ ok: boolean }>(
      `select exists (
         select 1 from public.worksheet_lesson_teacher_reviews
         where curriculum_id = $1::uuid and lesson_no = $2 and user_id = $3::uuid
       ) as ok`,
      [params.curriculumId, params.lessonNo, params.userId]
    )
    if (acked[0]?.ok) return true
  } catch (e) {
    console.error('[slide-content-review-pg] teacherHasReviewedLessonPg ack', e)
  }
  const slideCount = Math.max(0, Math.floor(params.slideCount))
  if (slideCount < 1) return false
  try {
    const rows = await pgQuery<{ n: number }>(
      `select count(distinct slide_index)::int as n
       from public.worksheet_slide_content_reviews
       where curriculum_id = $1::uuid and lesson_no = $2 and user_id = $3::uuid
         and action in ('confirm', 'edit')`,
      [params.curriculumId, params.lessonNo, params.userId]
    )
    return (rows[0]?.n ?? 0) >= slideCount
  } catch (e) {
    console.error('[slide-content-review-pg] teacherHasReviewedLessonPg slides', e)
    return false
  }
}

export async function markTeacherReviewedLessonPg(params: {
  curriculumId: string
  lessonNo: number
  userId: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `insert into public.worksheet_lesson_teacher_reviews (curriculum_id, lesson_no, user_id)
       values ($1::uuid, $2, $3::uuid)
       on conflict (curriculum_id, lesson_no, user_id) do nothing`,
      [params.curriculumId, params.lessonNo, params.userId]
    )
    return true
  } catch (e) {
    console.error('[slide-content-review-pg] markTeacherReviewedLessonPg', e)
    return false
  }
}
