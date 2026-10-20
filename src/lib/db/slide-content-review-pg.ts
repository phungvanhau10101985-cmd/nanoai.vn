import { createHash } from 'crypto'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'
import {
  fetchWorksheetCurriculumLessonSlidesJsonForLessonModePg,
  saveWorksheetCurriculumLessonSlidesCacheRowPg,
} from '@/lib/db/tao-giao-trinh-curriculum-pg'

export const SLIDE_REVIEW_WARN_PASSES = 7

export type SlideReviewStat = {
  confirmCount: number
  editCount: number
  warn: boolean
  proposalText: string | null
  proposalAuthorIsMe: boolean
  myVote: 'agree' | 'reject' | null
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

function emptyStat(): SlideReviewStat {
  return { confirmCount: 0, editCount: 0, warn: false, proposalText: null, proposalAuthorIsMe: false, myVote: null }
}

export function statsFromReviewRows(rows: ReviewRow[], hashes: string[], userId: string): SlideReviewStat[] {
  return hashes.map((contentHash, slideIndex) => {
    const mine = rows.filter((row) => row.slide_index === slideIndex)
    const edits = mine.filter((row) => row.action === 'edit')
    const lastEdit = edits[edits.length - 1]
    const agrees = lastEdit
      ? mine.filter(
          (row) =>
            row.action === 'agree' &&
            row.content_hash === lastEdit.content_hash &&
            row.user_id !== lastEdit.user_id &&
            new Date(row.created_at).getTime() > new Date(lastEdit.created_at).getTime()
        )
      : []
    const agreeUsers = new Set(agrees.map((row) => row.user_id))
    const warn = Boolean(lastEdit) && agreeUsers.size < SLIDE_REVIEW_WARN_PASSES
    const myVoteRow = lastEdit
      ? mine.filter(
          (row) =>
            (row.action === 'agree' || row.action === 'reject') &&
            row.user_id === userId &&
            row.content_hash === lastEdit.content_hash &&
            new Date(row.created_at).getTime() > new Date(lastEdit.created_at).getTime()
        ).at(-1)
      : undefined
    void contentHash
    return {
      confirmCount: agreeUsers.size,
      editCount: edits.length,
      warn,
      proposalText: warn && lastEdit?.body ? lastEdit.body : null,
      proposalAuthorIsMe: Boolean(warn && lastEdit && lastEdit.user_id === userId),
      myVote: myVoteRow?.action === 'agree' || myVoteRow?.action === 'reject' ? myVoteRow.action : null,
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
    return statsFromReviewRows(rows, hashes, params.userId)
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
      if (lastEdit && lastEdit.user_id !== params.userId && lastEdit.body) {
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
        if (params.action === 'agree') {
          const agrees = await pgQuery<{ user_id: string }>(
            `select distinct user_id::text as user_id
             from public.worksheet_slide_content_reviews
             where curriculum_id = $1::uuid and lesson_no = $2 and slide_index = $3
               and action = 'agree' and content_hash = $4 and user_id <> $5::uuid
               and created_at > $6::timestamptz`,
            [params.curriculumId, params.lessonNo, params.slideIndex, lastEdit.content_hash, lastEdit.user_id, lastEdit.created_at]
          )
          if (agrees.length >= SLIDE_REVIEW_WARN_PASSES) {
            await writeSlideText({
              curriculumId: params.curriculumId,
              lessonNo: params.lessonNo,
              slideIndex: params.slideIndex,
              text: lastEdit.body,
              userId: params.userId,
              mode: 'shared',
            })
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

export { emptyStat }
