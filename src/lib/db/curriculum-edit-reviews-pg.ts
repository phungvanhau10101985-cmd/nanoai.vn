import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export async function insertCurriculumEditReviewPg(input: {
  userId: string | null
  curriculumId: string | null
  topic: string
  subjectId: string
  gradeLevelId: string
  textbookSetId: string
  textbookVolume: string | null
  lessonNumber: number | null
  lessonTypeId: string
  numLessons: number
  lessonDurationMinutes: number
  goals: string | null
  contentMarkdown: string
  aiErrors: unknown[]
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const pool = getPgPool()
    const res = await pool.query<{ id: string }>(
      `insert into public.curriculum_edit_reviews (
        user_id, curriculum_id, topic, subject_id, grade_level_id, textbook_set_id, textbook_volume,
        lesson_number, lesson_type_id, num_lessons, lesson_duration_minutes, goals, content_markdown, ai_errors
      ) values (
        $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb
      )
      returning id::text as id`,
      [
        input.userId,
        input.curriculumId,
        input.topic,
        input.subjectId,
        input.gradeLevelId,
        input.textbookSetId,
        input.textbookVolume,
        input.lessonNumber,
        input.lessonTypeId,
        input.numLessons,
        input.lessonDurationMinutes,
        input.goals,
        input.contentMarkdown,
        JSON.stringify(Array.isArray(input.aiErrors) ? input.aiErrors : []),
      ]
    )
    const id = res.rows[0]?.id
    if (!id) return { ok: false, message: 'Không tạo được bản ghi.' }
    return { ok: true, id }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[curriculum-edit-reviews-pg] insertCurriculumEditReviewPg', e)
    return { ok: false, message: msg }
  }
}

export type CurriculumEditReviewListItemPg = {
  id: string
  user_id: string | null
  curriculum_id: string | null
  topic: string
  subject_id: string
  grade_level_id: string
  textbook_set_id: string
  textbook_volume: string | null
  lesson_number: number | null
  lesson_type_id: string
  num_lessons: number
  lesson_duration_minutes: number
  goals: string | null
  content_markdown: string
  ai_errors: unknown
  status: string
  created_at: string
  admin_note: string | null
}

export type CurriculumEditReviewAdminRowPg = CurriculumEditReviewListItemPg & {
  reviewed_at: string | null
  reviewed_by: string | null
}

const CURRICULUM_EDIT_REVIEW_LIST_SELECT = `id::text as id,
       user_id::text as user_id,
       curriculum_id::text as curriculum_id,
       topic,
       subject_id,
       grade_level_id,
       textbook_set_id,
       textbook_volume,
       lesson_number::float8 as lesson_number,
       lesson_type_id,
       num_lessons,
       lesson_duration_minutes,
       goals,
       content_markdown,
       ai_errors,
       status,
       created_at::timestamptz::text as created_at,
       admin_note`

const CURRICULUM_EDIT_REVIEW_ADMIN_SELECT = `id::text as id,
       user_id::text as user_id,
       curriculum_id::text as curriculum_id,
       topic,
       subject_id,
       grade_level_id,
       textbook_set_id,
       textbook_volume,
       lesson_number::float8 as lesson_number,
       lesson_type_id,
       num_lessons,
       lesson_duration_minutes,
       goals,
       content_markdown,
       ai_errors,
       status,
       created_at::timestamptz::text as created_at,
       admin_note,
       reviewed_at::timestamptz::text as reviewed_at,
       reviewed_by::text as reviewed_by`

export async function listCurriculumEditReviewsForAdminPg(opts: {
  status?: string
  limit: number
}): Promise<CurriculumEditReviewListItemPg[]> {
  if (!isPgConfigured()) return []
  const lim = Math.min(200, Math.max(1, opts.limit))
  try {
    if (opts.status) {
      return await pgQuery<CurriculumEditReviewListItemPg>(
        `select ${CURRICULUM_EDIT_REVIEW_LIST_SELECT}
         from public.curriculum_edit_reviews
         where status = $1::text
         order by created_at desc
         limit $2`,
        [opts.status, lim]
      )
    }
    return await pgQuery<CurriculumEditReviewListItemPg>(
      `select ${CURRICULUM_EDIT_REVIEW_LIST_SELECT}
       from public.curriculum_edit_reviews
       order by created_at desc
       limit $1`,
      [lim]
    )
  } catch (e) {
    console.error('[curriculum-edit-reviews-pg] listCurriculumEditReviewsForAdminPg', e)
    return []
  }
}

export async function fetchCurriculumEditReviewByIdPg(
  reviewId: string
): Promise<CurriculumEditReviewAdminRowPg | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne<CurriculumEditReviewAdminRowPg>(
      `select ${CURRICULUM_EDIT_REVIEW_ADMIN_SELECT}
       from public.curriculum_edit_reviews
       where id = $1::uuid
       limit 1`,
      [reviewId]
    )
  } catch (e) {
    console.error('[curriculum-edit-reviews-pg] fetchCurriculumEditReviewByIdPg', e)
    return null
  }
}

export async function updateCurriculumEditReviewAfterAdminPg(input: {
  reviewId: string
  status: 'approved' | 'rejected'
  reviewedBy: string
  reviewedAtIso: string
  adminNote: string | null
}): Promise<{ error?: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  try {
    await pgQuery(
      `update public.curriculum_edit_reviews
       set status = $2::text,
           reviewed_at = $3::timestamptz,
           reviewed_by = $4::uuid,
           admin_note = $5
       where id = $1::uuid`,
      [input.reviewId, input.status, input.reviewedAtIso, input.reviewedBy, input.adminNote]
    )
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
