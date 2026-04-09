import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

/**
 * Danh sách `class_id` đã gắn cho các phiên cùng lineage với phiên nguồn (GV là chủ).
 * `not_found` = không có phiên khớp teacher + id; `null` = lỗi DB.
 */
export async function fetchExamAttachMetaOccupiedFromPg(
  sourceSessionId: string,
  teacherId: string
): Promise<{ lineageRootId: string; occupiedClassIds: string[] } | 'not_found' | null> {
  if (!isPgConfigured()) return null
  try {
    const src = await pgQueryOne<{ id: string; root: string | null }>(
      `select id::text, exam_lineage_root_id::text as root
       from public.exam_sessions
       where id = $1::uuid and teacher_id = $2::uuid
       limit 1`,
      [sourceSessionId, teacherId]
    )
    if (!src) return 'not_found'

    const rootId = String(src.root ?? src.id).trim()

    const byLineage = await pgQuery<{ class_id: string | null }>(
      `select class_id::text as class_id
       from public.exam_sessions
       where teacher_id = $1::uuid and exam_lineage_root_id = $2::uuid`,
      [teacherId, rootId]
    )
    const rootRow = await pgQueryOne<{ class_id: string | null }>(
      `select class_id::text as class_id
       from public.exam_sessions
       where teacher_id = $1::uuid and id = $2::uuid
       limit 1`,
      [teacherId, rootId]
    )

    const occupied = new Set<string>()
    const pushClass = (cid: unknown) => {
      if (cid == null) return
      const s = String(cid).trim().toLowerCase()
      if (s) occupied.add(s)
    }
    for (const r of byLineage) pushClass(r.class_id)
    if (rootRow) pushClass(rootRow.class_id)

    return {
      lineageRootId: rootId,
      occupiedClassIds: Array.from(occupied),
    }
  } catch (e) {
    console.error('[exam-session-pg] fetchExamAttachMetaOccupiedFromPg', e)
    return null
  }
}

export type ExamSessionDraftRowPg = {
  id: string
  class_id: string | null
  duration_minutes: number
}

/** Phiên đang `active` theo mã (upper). `not_found` = không có; `null` = lỗi DB. */
export async function fetchExamSessionActiveByCodeForDraftPg(
  codeUpper: string
): Promise<ExamSessionDraftRowPg | 'not_found' | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      id: string
      class_id: string | null
      duration_minutes: number | null
    }>(
      `select id::text, class_id::text, duration_minutes
       from public.exam_sessions
       where code = $1 and status = 'active'
       limit 1`,
      [codeUpper]
    )
    if (!row) return 'not_found'
    return {
      id: row.id,
      class_id: row.class_id,
      duration_minutes: typeof row.duration_minutes === 'number' ? row.duration_minutes : 15,
    }
  } catch (e) {
    console.error('[exam-session-pg] fetchExamSessionActiveByCodeForDraftPg', e)
    return null
  }
}

export type ExamAttemptDraftRowPg = {
  id: string
  submitted_at: string | null
  deadline_at: string | null
  started_at: string | null
}

function isoOrNull(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

/** `missing` = không có attempt; `submitted` = đã nộp. */
export async function fetchExamAttemptOpenForDraftPg(
  sessionId: string,
  userId: string
): Promise<ExamAttemptDraftRowPg | 'missing' | 'submitted' | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      id: string
      submitted_at: unknown
      deadline_at: unknown
      started_at: unknown
    }>(
      `select id::text, submitted_at, deadline_at, started_at
       from public.exam_attempts
       where session_id = $1::uuid and user_id = $2::uuid
       limit 1`,
      [sessionId, userId]
    )
    if (!row) return 'missing'
    if (row.submitted_at != null) return 'submitted'
    return {
      id: row.id,
      submitted_at: isoOrNull(row.submitted_at),
      deadline_at: isoOrNull(row.deadline_at),
      started_at: isoOrNull(row.started_at),
    }
  } catch (e) {
    console.error('[exam-session-pg] fetchExamAttemptOpenForDraftPg', e)
    return null
  }
}

export async function fetchExamQuestionOptionsForSessionPg(
  sessionId: string
): Promise<Array<{ id: string; options: unknown }> | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{ id: string; options: unknown }>(
      `select id::text, options from public.exam_questions where session_id = $1::uuid`,
      [sessionId]
    )
    return rows
  } catch (e) {
    console.error('[exam-session-pg] fetchExamQuestionOptionsForSessionPg', e)
    return null
  }
}

export async function updateExamAttemptDraftAnswersPg(
  attemptId: string,
  userId: string,
  answers: unknown,
  essaySubmission: unknown
): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const a = JSON.stringify(answers ?? {})
    const e = JSON.stringify(essaySubmission ?? {})
    const row = await pgQueryOne<{ id: string }>(
      `update public.exam_attempts
       set answers = $3::jsonb, essay_submission = $4::jsonb
       where id = $1::uuid and user_id = $2::uuid and submitted_at is null
       returning id::text as id`,
      [attemptId, userId, a, e]
    )
    return row != null
  } catch (err) {
    console.error('[exam-session-pg] updateExamAttemptDraftAnswersPg', err)
    return null
  }
}

export type ExamSessionStudentFlowPg = {
  id: string
  class_id: string | null
  school_id: string | null
  is_practice_homework: boolean
  duration_minutes: number
}

/** Phiên `active` cho luồng HS (nộp bài / ảnh TL). */
export async function fetchExamSessionActiveForStudentFlowPg(
  codeUpper: string
): Promise<ExamSessionStudentFlowPg | 'not_found' | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      id: string
      class_id: string | null
      school_id: string | null
      is_practice_homework: boolean | null
      duration_minutes: number | null
    }>(
      `select id::text, class_id::text, school_id::text, is_practice_homework, duration_minutes
       from public.exam_sessions
       where code = $1 and status = 'active'
       limit 1`,
      [codeUpper]
    )
    if (!row) return 'not_found'
    return {
      id: row.id,
      class_id: row.class_id,
      school_id: row.school_id,
      is_practice_homework: Boolean(row.is_practice_homework),
      duration_minutes: typeof row.duration_minutes === 'number' ? row.duration_minutes : 15,
    }
  } catch (e) {
    console.error('[exam-session-pg] fetchExamSessionActiveForStudentFlowPg', e)
    return null
  }
}

/** Câu hỏi để chấm TN (đủ cột như API REST trước đây). */
export async function fetchExamQuestionsForGradingPg(
  sessionId: string
): Promise<Array<{ id: string; correct_index: unknown; options: unknown; points: unknown }> | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{
      id: string
      correct_index: unknown
      options: unknown
      points: unknown
    }>(
      `select id::text, correct_index, options, points
       from public.exam_questions
       where session_id = $1::uuid`,
      [sessionId]
    )
    return rows
  } catch (e) {
    console.error('[exam-session-pg] fetchExamQuestionsForGradingPg', e)
    return null
  }
}

export async function finalizeSubmitExamAttemptPg(params: {
  attemptId: string
  studentName: string | null
  studentCode: string | null
  answers: unknown
  essaySubmission: unknown
  score: number
  maxScore: number
  gradingMeta: unknown
  submittedIso: string
}): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.exam_attempts
       set student_name = $2,
           student_code = $3,
           answers = $4::jsonb,
           essay_submission = $5::jsonb,
           score = $6,
           max_score = $7,
           grading_meta = $8::jsonb,
           submitted_at = $9::timestamptz
       where id = $1::uuid and submitted_at is null
       returning id::text as id`,
      [
        params.attemptId,
        params.studentName,
        params.studentCode,
        JSON.stringify(params.answers ?? {}),
        JSON.stringify(params.essaySubmission ?? {}),
        params.score,
        params.maxScore,
        JSON.stringify(params.gradingMeta ?? {}),
        params.submittedIso,
      ]
    )
    return row != null
  } catch (e) {
    console.error('[exam-session-pg] finalizeSubmitExamAttemptPg', e)
    return null
  }
}

export type ExamSessionMineRowPg = {
  id: string
  code: string
  title: string
  duration_minutes: number
  status: string
  created_at: string
  class_id: string | null
  school_id: string | null
  is_practice_homework: boolean
  class_name: string | null
  school_name: string | null
}

export async function fetchExamSessionsMineForTeacherPg(
  teacherId: string,
  only: 'all' | 'homework' | 'exam'
): Promise<ExamSessionMineRowPg[] | null> {
  if (!isPgConfigured()) return null
  try {
    let sql = `select s.id::text, s.code, s.title, s.duration_minutes, s.status::text, s.created_at,
                      s.class_id::text, s.school_id::text, coalesce(s.is_practice_homework, false) as is_practice_homework,
                      c.name as class_name, sch.name as school_name
               from public.exam_sessions s
               left join public.classes c on c.id = s.class_id
               left join public.schools sch on sch.id = s.school_id
               where s.teacher_id = $1::uuid`
    const params: unknown[] = [teacherId]
    if (only === 'homework') sql += ` and s.is_practice_homework = true`
    else if (only === 'exam') sql += ` and s.is_practice_homework = false`
    sql += ` order by s.created_at desc limit 100`
    const rows = await pgQuery<{
      id: string
      code: string
      title: string
      duration_minutes: number
      status: string
      created_at: unknown
      class_id: string | null
      school_id: string | null
      is_practice_homework: boolean
      class_name: string | null
      school_name: string | null
    }>(sql, params)
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      duration_minutes: Number(r.duration_minutes),
      status: r.status,
      created_at: isoOrNull(r.created_at) ?? '',
      class_id: r.class_id,
      school_id: r.school_id,
      is_practice_homework: r.is_practice_homework,
      class_name: r.class_name,
      school_name: r.school_name,
    }))
  } catch (e) {
    console.error('[exam-session-pg] fetchExamSessionsMineForTeacherPg', e)
    return null
  }
}

export async function countExamQuestionsBySessionIdsPg(
  sessionIds: string[]
): Promise<Map<string, number> | null> {
  if (!isPgConfigured()) return null
  if (sessionIds.length === 0) return new Map()
  try {
    const rows = await pgQuery<{ session_id: string; cnt: string }>(
      `select session_id::text as session_id, count(*)::text as cnt
       from public.exam_questions
       where session_id = any($1::uuid[])
       group by session_id`,
      [sessionIds]
    )
    const m = new Map<string, number>()
    for (const r of rows) {
      m.set(r.session_id, Number(r.cnt))
    }
    return m
  } catch (e) {
    console.error('[exam-session-pg] countExamQuestionsBySessionIdsPg', e)
    return null
  }
}

/** Xóa cascade attempts + questions + session khi đúng GV. `not_found` | `forbidden` | `true`. */
export async function deleteExamSessionByCodeForTeacherPg(
  codeUpper: string,
  teacherId: string
): Promise<'ok' | 'not_found' | 'forbidden' | null> {
  if (!isPgConfigured()) return null
  try {
    const session = await pgQueryOne<{ id: string; teacher_id: string }>(
      `select id::text, teacher_id::text from public.exam_sessions where code = $1 limit 1`,
      [codeUpper]
    )
    if (!session) return 'not_found'
    if (session.teacher_id !== teacherId) return 'forbidden'
    const sid = session.id
    await pgQuery(`delete from public.exam_attempts where session_id = $1::uuid`, [sid])
    await pgQuery(`delete from public.exam_questions where session_id = $1::uuid`, [sid])
    const del = await pgQueryOne<{ id: string }>(
      `delete from public.exam_sessions where id = $1::uuid and teacher_id = $2::uuid returning id::text as id`,
      [sid, teacherId]
    )
    return del ? 'ok' : 'forbidden'
  } catch (e) {
    console.error('[exam-session-pg] deleteExamSessionByCodeForTeacherPg', e)
    return null
  }
}

/** Phiên active cho GET `/api/exam-session/[code]`. */
export type ExamSessionGetRowPg = {
  id: string
  code: string
  title: string | null
  exam_type: string
  duration_minutes: number
  class_id: string | null
  school_id: string | null
  is_practice_homework: boolean
}

export async function fetchExamSessionActiveForGetRoutePg(
  codeUpper: string
): Promise<ExamSessionGetRowPg | 'not_found' | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      id: string
      code: string
      title: string | null
      exam_type: string
      duration_minutes: number | null
      class_id: string | null
      school_id: string | null
      is_practice_homework: boolean | null
    }>(
      `select id::text, code, title, exam_type::text, duration_minutes,
              class_id::text, school_id::text, coalesce(is_practice_homework, false) as is_practice_homework
       from public.exam_sessions
       where code = $1 and status = 'active'
       limit 1`,
      [codeUpper]
    )
    if (!row) return 'not_found'
    return {
      id: row.id,
      code: row.code,
      title: row.title,
      exam_type: row.exam_type,
      duration_minutes: typeof row.duration_minutes === 'number' ? row.duration_minutes : 15,
      class_id: row.class_id,
      school_id: row.school_id,
      is_practice_homework: Boolean(row.is_practice_homework),
    }
  } catch (e) {
    console.error('[exam-session-pg] fetchExamSessionActiveForGetRoutePg', e)
    return null
  }
}

export type ExamAttemptFullGetRowPg = {
  id: string
  submitted_at: string | null
  score: number | null
  max_score: number | null
  grading_meta: unknown
  layout_snapshot: unknown
  answers: unknown
  essay_submission: unknown
  student_name: string | null
  student_code: string | null
  started_at: string | null
  deadline_at: string | null
}

function mapExamAttemptFullRow(row: Record<string, unknown>): ExamAttemptFullGetRowPg {
  return {
    id: String(row.id),
    submitted_at: row.submitted_at != null ? isoOrNull(row.submitted_at) : null,
    score: row.score != null ? Number(row.score) : null,
    max_score: row.max_score != null ? Number(row.max_score) : null,
    grading_meta: row.grading_meta,
    layout_snapshot: row.layout_snapshot,
    answers: row.answers,
    essay_submission: row.essay_submission,
    student_name: row.student_name != null ? String(row.student_name) : null,
    student_code: row.student_code != null ? String(row.student_code) : null,
    started_at: row.started_at != null ? isoOrNull(row.started_at) : null,
    deadline_at: row.deadline_at != null ? isoOrNull(row.deadline_at) : null,
  }
}

export async function fetchExamAttemptFullForUserGetRoutePg(
  sessionId: string,
  userId: string
): Promise<ExamAttemptFullGetRowPg | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select id::text, submitted_at, score, max_score, grading_meta, layout_snapshot, answers, essay_submission,
              student_name, student_code, started_at, deadline_at
       from public.exam_attempts
       where session_id = $1::uuid and user_id = $2::uuid
       limit 1`,
      [sessionId, userId]
    )
    if (!row) return null
    return mapExamAttemptFullRow(row)
  } catch (e) {
    console.error('[exam-session-pg] fetchExamAttemptFullForUserGetRoutePg', e)
    return null
  }
}

/** `missing` = chưa có attempt; `null` = lỗi DB / chưa cấu PG. */
export async function fetchExamAttemptForBeginPg(
  sessionId: string,
  userId: string
): Promise<ExamAttemptFullGetRowPg | 'missing' | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select id::text, submitted_at, score, max_score, grading_meta, layout_snapshot, answers, essay_submission,
              student_name, student_code, started_at, deadline_at
       from public.exam_attempts
       where session_id = $1::uuid and user_id = $2::uuid
       limit 1`,
      [sessionId, userId]
    )
    if (!row) return 'missing'
    return mapExamAttemptFullRow(row)
  } catch (e) {
    console.error('[exam-session-pg] fetchExamAttemptForBeginPg', e)
    return null
  }
}

export type InsertExamAttemptBeginPayloadPg = {
  sessionId: string
  userId: string
  classId: string | null
  schoolId: string | null
  studentName: string | null
  studentCode: string | null
  answers: Record<string, unknown>
  essaySubmission: Record<string, unknown>
  score: number
  maxScore: number
  startedIso: string
  deadlineIso: string
  layoutSnapshot: unknown
}

/** Insert attempt mới. `23505` = trùng (session, user). `null` = chưa cấu PG. */
export async function insertExamAttemptBeginPg(
  p: InsertExamAttemptBeginPayloadPg
): Promise<'ok' | { pgCode: string; message: string } | null> {
  if (!isPgConfigured()) return null
  try {
    await pgQuery(
      `insert into public.exam_attempts (
        session_id, user_id, class_id, school_id, student_name, student_code,
        answers, essay_submission, score, max_score, started_at, submitted_at, deadline_at, layout_snapshot
      ) values (
        $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6,
        $7::jsonb, $8::jsonb, $9, $10, $11::timestamptz, null, $12::timestamptz, $13::jsonb
      )`,
      [
        p.sessionId,
        p.userId,
        p.classId,
        p.schoolId,
        p.studentName,
        p.studentCode,
        JSON.stringify(p.answers ?? {}),
        JSON.stringify(p.essaySubmission ?? {}),
        p.score,
        p.maxScore,
        p.startedIso,
        p.deadlineIso,
        JSON.stringify(p.layoutSnapshot ?? {}),
      ]
    )
    return 'ok'
  } catch (e: unknown) {
    const err = e as { code?: string }
    const pgCode = String(err.code ?? 'UNKNOWN')
    const message = e instanceof Error ? e.message : String(e)
    console.error('[exam-session-pg] insertExamAttemptBeginPg', e)
    return { pgCode, message }
  }
}

export async function deleteExamAttemptByIdPg(attemptId: string): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const r = await pgQueryOne<{ id: string }>(
      `delete from public.exam_attempts where id = $1::uuid returning id::text as id`,
      [attemptId]
    )
    return r != null
  } catch (e) {
    console.error('[exam-session-pg] deleteExamAttemptByIdPg', e)
    return null
  }
}

export async function existsAnyExamQuestionForSessionPg(sessionId: string): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const r = await pgQueryOne<{ ok: number }>(
      `select 1 as ok from public.exam_questions where session_id = $1::uuid limit 1`,
      [sessionId]
    )
    return r != null
  } catch (e) {
    console.error('[exam-session-pg] existsAnyExamQuestionForSessionPg', e)
    return null
  }
}

export async function fetchExamQuestionsFullOrderedForSessionPg(
  sessionId: string
): Promise<
  Array<{
    id: string
    question_text: string
    options: unknown
    correct_index: unknown
    source: unknown
    order: number
  }> | null
> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{
      id: string
      question_text: string
      options: unknown
      correct_index: unknown
      source: string | null
      ord: number | null
    }>(
      `select id::text, question_text, options, correct_index, source::text,
              "order" as ord
       from public.exam_questions
       where session_id = $1::uuid
       order by "order" asc`,
      [sessionId]
    )
    return rows.map((r) => ({
      id: r.id,
      question_text: String(r.question_text ?? ''),
      options: r.options,
      correct_index: r.correct_index,
      source: r.source,
      order: typeof r.ord === 'number' ? r.ord : 0,
    }))
  } catch (e) {
    console.error('[exam-session-pg] fetchExamQuestionsFullOrderedForSessionPg', e)
    return null
  }
}

export async function updateExamAttemptOverdueFinalizePg(params: {
  attemptId: string
  answers: unknown
  essaySubmission: unknown
  score: number
  maxScore: number
  gradingMeta: unknown
  submittedIso: string
}): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.exam_attempts
       set answers = $2::jsonb,
           essay_submission = $3::jsonb,
           score = $4,
           max_score = $5,
           grading_meta = $6::jsonb,
           submitted_at = $7::timestamptz
       where id = $1::uuid and submitted_at is null
       returning id::text as id`,
      [
        params.attemptId,
        JSON.stringify(params.answers ?? {}),
        JSON.stringify(params.essaySubmission ?? {}),
        params.score,
        params.maxScore,
        JSON.stringify(params.gradingMeta ?? {}),
        params.submittedIso,
      ]
    )
    return row != null
  } catch (e) {
    console.error('[exam-session-pg] updateExamAttemptOverdueFinalizePg', e)
    return null
  }
}

export async function fetchExamAttemptSubmittedSummaryRowPg(attemptId: string): Promise<{
  submitted_at: string
  score: number
  max_score: number
  grading_meta: unknown
} | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      submitted_at: unknown
      score: unknown
      max_score: unknown
      grading_meta: unknown
    }>(
      `select submitted_at, score, max_score, grading_meta
       from public.exam_attempts
       where id = $1::uuid
       limit 1`,
      [attemptId]
    )
    if (!row?.submitted_at) return null
    return {
      submitted_at: isoOrNull(row.submitted_at) ?? '',
      score: Number(row.score ?? 0),
      max_score: Number(row.max_score ?? 0),
      grading_meta: row.grading_meta,
    }
  } catch (e) {
    console.error('[exam-session-pg] fetchExamAttemptSubmittedSummaryRowPg', e)
    return null
  }
}

/** GV xem chữa bài: phiên theo mã. */
export async function fetchExamSessionForTeacherReviewPg(
  codeUpper: string,
  teacherId: string
): Promise<
  | { id: string; code: string; title: string | null; is_practice_homework: boolean }
  | 'not_found'
  | 'forbidden'
  | null
> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      id: string
      code: string
      title: string | null
      teacher_id: string
      is_practice_homework: boolean | null
    }>(
      `select id::text, code, title, teacher_id::text, is_practice_homework
       from public.exam_sessions
       where code = $1
       limit 1`,
      [codeUpper]
    )
    if (!row) return 'not_found'
    if (row.teacher_id !== teacherId) return 'forbidden'
    return {
      id: row.id,
      code: row.code,
      title: row.title,
      is_practice_homework: Boolean(row.is_practice_homework),
    }
  } catch (e) {
    console.error('[exam-session-pg] fetchExamSessionForTeacherReviewPg', e)
    return null
  }
}

export async function fetchExamQuestionsForReviewPg(sessionId: string): Promise<
  | Array<{
      id: string
      question_text: unknown
      options: unknown
      correct_index: unknown
      ord: number
      source: unknown
      worksheet_question_id: string | null
    }>
  | null
> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{
      id: string
      question_text: unknown
      options: unknown
      correct_index: unknown
      ord: number | null
      source: unknown
      worksheet_question_id: string | null
    }>(
      `select id::text, question_text, options, correct_index, source,
              "order" as ord, worksheet_question_id::text
       from public.exam_questions
       where session_id = $1::uuid
       order by "order" asc`,
      [sessionId]
    )
    return rows.map((r) => ({
      id: r.id,
      question_text: r.question_text,
      options: r.options,
      correct_index: r.correct_index,
      ord: typeof r.ord === 'number' ? r.ord : 0,
      source: r.source,
      worksheet_question_id: r.worksheet_question_id,
    }))
  } catch (e) {
    console.error('[exam-session-pg] fetchExamQuestionsForReviewPg', e)
    return null
  }
}

export async function fetchExamAttemptDetailForTeacherPg(
  attemptId: string,
  teacherId: string
): Promise<
  | {
      attempt: {
        id: string
        session_id: string
        user_id: string | null
        student_name: unknown
        answers: unknown
        essay_submission: unknown
        score: unknown
        max_score: unknown
        grading_meta: unknown
        submitted_at: unknown
      }
      session: { id: string; code: string; title: string | null }
    }
  | 'not_found'
  | 'forbidden'
  | null
> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select ea.id::text, ea.session_id::text, ea.user_id::text, ea.student_name, ea.answers, ea.essay_submission,
              ea.score, ea.max_score, ea.grading_meta, ea.submitted_at,
              es.id::text as es_id, es.code as es_code, es.title as es_title, es.teacher_id::text as es_teacher_id
       from public.exam_attempts ea
       inner join public.exam_sessions es on es.id = ea.session_id
       where ea.id = $1::uuid
       limit 1`,
      [attemptId]
    )
    if (!row) return 'not_found'
    if (String(row.es_teacher_id ?? '') !== teacherId) return 'forbidden'
    return {
      attempt: {
        id: String(row.id),
        session_id: String(row.session_id),
        user_id: row.user_id != null ? String(row.user_id) : null,
        student_name: row.student_name,
        answers: row.answers,
        essay_submission: row.essay_submission,
        score: row.score,
        max_score: row.max_score,
        grading_meta: row.grading_meta,
        submitted_at: row.submitted_at,
      },
      session: {
        id: String(row.es_id),
        code: String(row.es_code ?? ''),
        title: row.es_title != null ? String(row.es_title) : null,
      },
    }
  } catch (e) {
    console.error('[exam-session-pg] fetchExamAttemptDetailForTeacherPg', e)
    return null
  }
}

export async function fetchExamAttemptEssayGradeBundlePg(
  attemptId: string,
  teacherId: string
): Promise<
  | {
      attempt: { id: string; session_id: string; user_id: string | null; score: unknown; max_score: unknown; grading_meta: unknown }
      session: { teacher_id: string; code: string | null }
    }
  | 'not_found'
  | 'forbidden'
  | null
> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select ea.id::text, ea.session_id::text, ea.user_id::text, ea.score, ea.max_score, ea.grading_meta,
              es.teacher_id::text as es_teacher_id, es.code as es_code
       from public.exam_attempts ea
       inner join public.exam_sessions es on es.id = ea.session_id
       where ea.id = $1::uuid
       limit 1`,
      [attemptId]
    )
    if (!row) return 'not_found'
    if (String(row.es_teacher_id ?? '') !== teacherId) return 'forbidden'
    return {
      attempt: {
        id: String(row.id),
        session_id: String(row.session_id),
        user_id: row.user_id != null ? String(row.user_id) : null,
        score: row.score,
        max_score: row.max_score,
        grading_meta: row.grading_meta,
      },
      session: {
        teacher_id: String(row.es_teacher_id),
        code: row.es_code != null ? String(row.es_code) : null,
      },
    }
  } catch (e) {
    console.error('[exam-session-pg] fetchExamAttemptEssayGradeBundlePg', e)
    return null
  }
}

export async function updateExamAttemptEssayGradeScoresPg(
  attemptId: string,
  teacherId: string,
  newScore: number,
  gradingMeta: unknown
): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const metaJson = JSON.stringify(gradingMeta ?? {})
    const r = await pgQueryOne<{ id: string }>(
      `update public.exam_attempts ea
       set score = $3,
           grading_meta = $4::jsonb
       from public.exam_sessions es
       where ea.id = $1::uuid and ea.session_id = es.id and es.teacher_id = $2::uuid
       returning ea.id::text as id`,
      [attemptId, teacherId, newScore, metaJson]
    )
    return r != null
  } catch (e) {
    console.error('[exam-session-pg] updateExamAttemptEssayGradeScoresPg', e)
    return null
  }
}

/** Context cho gợi ý AI chấm TL. */
export async function fetchExamAttemptEssayAiBundlePg(
  attemptId: string,
  teacherId: string
): Promise<
  | {
      attempt: {
        session_id: string
        essay_submission: unknown
        answers: unknown
        grading_meta: unknown
      }
    }
  | 'not_found'
  | 'forbidden'
  | null
> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select ea.session_id::text, ea.essay_submission, ea.answers, ea.grading_meta, es.teacher_id::text as tid
       from public.exam_attempts ea
       inner join public.exam_sessions es on es.id = ea.session_id
       where ea.id = $1::uuid
       limit 1`,
      [attemptId]
    )
    if (!row) return 'not_found'
    if (String(row.tid ?? '') !== teacherId) return 'forbidden'
    return {
      attempt: {
        session_id: String(row.session_id),
        essay_submission: row.essay_submission,
        answers: row.answers,
        grading_meta: row.grading_meta,
      },
    }
  } catch (e) {
    console.error('[exam-session-pg] fetchExamAttemptEssayAiBundlePg', e)
    return null
  }
}

export async function fetchExamQuestionsForEssayAiPg(sessionId: string): Promise<
  | Array<{
      id: string
      question_text: string
      options: unknown
      ord: number
      worksheet_question_id: string | null
      points: unknown
    }>
  | null
> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{
      id: string
      question_text: unknown
      options: unknown
      ord: number | null
      worksheet_question_id: string | null
      points: unknown
    }>(
      `select id::text, question_text, options, "order" as ord, worksheet_question_id::text, points
       from public.exam_questions
       where session_id = $1::uuid
       order by "order" asc`,
      [sessionId]
    )
    return rows.map((r) => ({
      id: r.id,
      question_text: String(r.question_text ?? ''),
      options: r.options,
      ord: typeof r.ord === 'number' ? r.ord : 0,
      worksheet_question_id: r.worksheet_question_id,
      points: r.points,
    }))
  } catch (e) {
    console.error('[exam-session-pg] fetchExamQuestionsForEssayAiPg', e)
    return null
  }
}

/** Phiên thi theo mã — `joinClassForActiveExam`. */
export async function fetchExamSessionForClassJoinByCodePg(codeRaw: string): Promise<{
  id: string
  class_id: string | null
  status: string
} | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      id: string
      class_id: string | null
      status: string
    }>(
      `select id::text, class_id::text, status::text
       from public.exam_sessions
       where upper(trim(code)) = upper(trim($1))
       limit 1`,
      [codeRaw]
    )
    if (!row) return null
    return {
      id: row.id,
      class_id: row.class_id,
      status: String(row.status ?? ''),
    }
  } catch (e) {
    console.error('[exam-session-pg] fetchExamSessionForClassJoinByCodePg', e)
    return null
  }
}
