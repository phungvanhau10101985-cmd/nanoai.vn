import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type QuizQuestionReportAdminListRowPg = {
  id: string
  curriculum_id: string
  user_id: string
  slide_index: number
  block_index: number
  quiz_marker: string
  slide_content: string
  slide_title: string
  report_count: number
  status: string
  ai_reasoning: string | null
  ai_model_used: string | null
  created_at: string
  updated_at: string
}

/** Admin: báo cáo chờ duyệt — GET `/api/admin/quiz-reports`. */
export async function fetchQuizQuestionReportsAdminPendingPg(): Promise<QuizQuestionReportAdminListRowPg[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text, curriculum_id::text, user_id::text, slide_index, block_index, quiz_marker,
              slide_content, slide_title, report_count, status::text, ai_reasoning, ai_model_used,
              created_at::text, updated_at::text
       from public.quiz_question_reports
       where status = 'admin_pending'
       order by updated_at desc`
    )
    return rows.map((r) => ({
      id: String(r.id),
      curriculum_id: String(r.curriculum_id ?? ''),
      user_id: String(r.user_id ?? ''),
      slide_index: Number(r.slide_index ?? 0),
      block_index: Number(r.block_index ?? 0),
      quiz_marker: String(r.quiz_marker ?? ''),
      slide_content: String(r.slide_content ?? ''),
      slide_title: String(r.slide_title ?? ''),
      report_count: Number(r.report_count ?? 0),
      status: String(r.status ?? ''),
      ai_reasoning: r.ai_reasoning != null ? String(r.ai_reasoning) : null,
      ai_model_used: r.ai_model_used != null ? String(r.ai_model_used) : null,
      created_at: String(r.created_at ?? ''),
      updated_at: String(r.updated_at ?? ''),
    }))
  } catch (e) {
    console.error('[quiz-reports-pg] fetchQuizQuestionReportsAdminPendingPg', e)
    return null
  }
}

export type QuizQuestionReportForApprovePg = {
  id: string
  user_id: string
  curriculum_id: string
  slide_index: number
  block_index: number
  quiz_marker: string
  slide_content: string
  slide_title: string
}

export async function fetchQuizQuestionReportPendingByIdPg(
  reportId: string
): Promise<QuizQuestionReportForApprovePg | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select id::text, user_id::text, curriculum_id::text, slide_index, block_index, quiz_marker,
              slide_content, slide_title
       from public.quiz_question_reports
       where id = $1::uuid and status = 'admin_pending'
       limit 1`,
      [reportId]
    )
    if (!row) return null
    return {
      id: String(row.id),
      user_id: String(row.user_id ?? ''),
      curriculum_id: String(row.curriculum_id ?? ''),
      slide_index: Number(row.slide_index ?? 0),
      block_index: Number(row.block_index ?? 0),
      quiz_marker: String(row.quiz_marker ?? ''),
      slide_content: String(row.slide_content ?? ''),
      slide_title: String(row.slide_title ?? ''),
    }
  } catch (e) {
    console.error('[quiz-reports-pg] fetchQuizQuestionReportPendingByIdPg', e)
    return null
  }
}

export async function updateQuizQuestionReportApprovedPg(
  reportId: string,
  adminUserId: string
): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.quiz_question_reports
       set status = 'admin_approved',
           admin_approved_at = timezone('utc'::text, now()),
           admin_user_id = $2::uuid,
           updated_at = timezone('utc'::text, now())
       where id = $1::uuid and status = 'admin_pending'
       returning id::text as id`,
      [reportId, adminUserId]
    )
    return row != null
  } catch (e) {
    console.error('[quiz-reports-pg] updateQuizQuestionReportApprovedPg', e)
    return null
  }
}

export type WorksheetSlidesRowPg = {
  content_json: unknown
  topic: string | null
  subject_id: string | null
  grade_level_id: string | null
}

export async function fetchWorksheetSlidesByCurriculumIdPg(
  curriculumId: string
): Promise<WorksheetSlidesRowPg | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select content_json, topic, subject_id, grade_level_id
       from public.worksheet_slides
       where curriculum_id = $1::uuid
       limit 1`,
      [curriculumId]
    )
    if (!row) return null
    return {
      content_json: row.content_json,
      topic: row.topic != null ? String(row.topic) : null,
      subject_id: row.subject_id != null ? String(row.subject_id) : null,
      grade_level_id: row.grade_level_id != null ? String(row.grade_level_id) : null,
    }
  } catch (e) {
    console.error('[quiz-reports-pg] fetchWorksheetSlidesByCurriculumIdPg', e)
    return null
  }
}

export async function updateWorksheetSlidesContentJsonPg(params: {
  curriculumId: string
  contentJson: unknown
  topic: string | null
  subjectId: string | null
  gradeLevelId: string | null
}): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.worksheet_slides
       set content_json = $2::jsonb,
           topic = $3,
           subject_id = $4,
           grade_level_id = $5
       where curriculum_id = $1::uuid
       returning id::text as id`,
      [
        params.curriculumId,
        JSON.stringify(params.contentJson ?? []),
        params.topic,
        params.subjectId,
        params.gradeLevelId,
      ]
    )
    return row != null
  } catch (e) {
    console.error('[quiz-reports-pg] updateWorksheetSlidesContentJsonPg', e)
    return null
  }
}

export async function updateQuizQuestionReportReplacedPg(params: {
  reportId: string
  adminUserId: string
  newQuizMarker: string
}): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.quiz_question_reports
       set status = 'admin_rejected',
           quiz_marker = $3,
           ai_reasoning = $4,
           ai_model_used = $5,
           admin_approved_at = timezone('utc'::text, now()),
           admin_user_id = $2::uuid,
           updated_at = timezone('utc'::text, now())
       where id = $1::uuid and status = 'admin_pending'
       returning id::text as id`,
      [
        params.reportId,
        params.adminUserId,
        params.newQuizMarker,
        'Admin duyệt sai – đã thay câu mới (Gemini + DeepSeek).',
        'gemini-2.5-pro',
      ]
    )
    return row != null
  } catch (e) {
    console.error('[quiz-reports-pg] updateQuizQuestionReportReplacedPg', e)
    return null
  }
}

/** GV xem báo cáo đã xử lý — GET `/api/slide-quiz-report`. */
export async function fetchQuizQuestionReportsResolvedForUserPg(
  curriculumId: string,
  userId: string,
  sinceIso: string
): Promise<Array<{ id: string; slide_index: number; block_index: number; status: string; admin_approved_at: string | null }> | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text, slide_index, block_index, status::text, admin_approved_at::text
       from public.quiz_question_reports
       where curriculum_id = $1::uuid
         and user_id = $2::uuid
         and status in ('admin_approved', 'admin_rejected')
         and admin_approved_at is not null
         and admin_approved_at >= $3::timestamptz
       order by admin_approved_at desc
       limit 10`,
      [curriculumId, userId, sinceIso]
    )
    return rows.map((r) => ({
      id: String(r.id),
      slide_index: Number(r.slide_index ?? 0),
      block_index: Number(r.block_index ?? 0),
      status: String(r.status ?? ''),
      admin_approved_at: r.admin_approved_at != null ? String(r.admin_approved_at) : null,
    }))
  } catch (e) {
    console.error('[quiz-reports-pg] fetchQuizQuestionReportsResolvedForUserPg', e)
    return null
  }
}

export async function fetchQuizQuestionReportSlotPg(params: {
  curriculumId: string
  userId: string
  slideIndex: number
  blockIndex: number
}): Promise<{ id: string; report_count: number; status: string } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select id::text, report_count, status::text
       from public.quiz_question_reports
       where curriculum_id = $1::uuid and user_id = $2::uuid
         and slide_index = $3 and block_index = $4
       limit 1`,
      [params.curriculumId, params.userId, params.slideIndex, params.blockIndex]
    )
    if (!row) return null
    return {
      id: String(row.id),
      report_count: Number(row.report_count ?? 1),
      status: String(row.status ?? ''),
    }
  } catch (e) {
    console.error('[quiz-reports-pg] fetchQuizQuestionReportSlotPg', e)
    return null
  }
}

/** Upsert báo cáo từ luồng GV — POST `/api/slide-quiz-report`. */
export async function upsertQuizQuestionReportTeacherPg(params: {
  curriculumId: string
  userId: string
  slideIndex: number
  blockIndex: number
  quizMarker: string
  slideContent: string
  slideTitle: string
  reportCount: number
  status: string
  aiReasoning: string | null
  aiModelUsed: string | null
}): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    await pgQuery(
      `insert into public.quiz_question_reports (
         curriculum_id, user_id, slide_index, block_index, quiz_marker,
         slide_content, slide_title, report_count, status, ai_reasoning, ai_model_used, updated_at
       ) values (
         $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, timezone('utc'::text, now())
       )
       on conflict (curriculum_id, slide_index, block_index, user_id) do update set
         quiz_marker = excluded.quiz_marker,
         slide_content = excluded.slide_content,
         slide_title = excluded.slide_title,
         report_count = excluded.report_count,
         status = excluded.status,
         ai_reasoning = excluded.ai_reasoning,
         ai_model_used = excluded.ai_model_used,
         updated_at = timezone('utc'::text, now())`,
      [
        params.curriculumId,
        params.userId,
        params.slideIndex,
        params.blockIndex,
        params.quizMarker,
        params.slideContent,
        params.slideTitle,
        params.reportCount,
        params.status,
        params.aiReasoning,
        params.aiModelUsed,
      ]
    )
    return true
  } catch (e) {
    console.error('[quiz-reports-pg] upsertQuizQuestionReportTeacherPg', e)
    return null
  }
}
