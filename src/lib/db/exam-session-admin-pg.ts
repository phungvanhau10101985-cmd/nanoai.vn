import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

/** Bài học từ `worksheet_curricula.lesson_topics`. */
export async function fetchLessonTopicsFromCurriculumIdsPg(
  curriculumIds: string[]
): Promise<string[] | null> {
  if (!isPgConfigured()) return null
  if (curriculumIds.length === 0) return []
  try {
    const rows = await pgQuery<{ lesson_topics: unknown }>(
      `select lesson_topics from public.worksheet_curricula where id = any($1::uuid[])`,
      [curriculumIds]
    )
    const topics = new Set<string>()
    for (const r of rows) {
      const t = r.lesson_topics
      if (Array.isArray(t)) {
        for (const x of t) {
          if (typeof x === 'string' && x.trim()) topics.add(x.trim())
        }
      }
    }
    return Array.from(topics)
  } catch (e) {
    console.error('[exam-session-admin-pg] fetchLessonTopicsFromCurriculumIdsPg', e)
    return null
  }
}

/** ID câu hỏi được phép khi chọn theo giáo trình (phiếu + câu gắn curriculum). */
export async function collectAllowedQuestionIdsFromCurriculaPg(
  curriculumIds: string[]
): Promise<Set<string> | null> {
  if (!isPgConfigured()) return null
  if (curriculumIds.length === 0) return new Set()
  try {
    const allowed = new Set<string>()
    const wsRows = await pgQuery<{ question_ids: unknown }>(
      `select question_ids from public.worksheet_worksheets where curriculum_id = any($1::uuid[])`,
      [curriculumIds]
    )
    for (const ws of wsRows) {
      const ids = ws.question_ids
      if (Array.isArray(ids)) {
        for (const qid of ids) {
          if (qid) allowed.add(String(qid))
        }
      }
    }
    const direct = await pgQuery<{ id: string }>(
      `select id::text as id from public.worksheet_questions where curriculum_id = any($1::uuid[])`,
      [curriculumIds]
    )
    for (const r of direct) allowed.add(r.id)
    return allowed
  } catch (e) {
    console.error('[exam-session-admin-pg] collectAllowedQuestionIdsFromCurriculaPg', e)
    return null
  }
}

export type WorksheetQuizRowPg = {
  id: string
  type: string
  difficulty: string | null
  content_json: unknown
}

export async function fetchWorksheetQuizRowsByIdsPg(ids: string[]): Promise<WorksheetQuizRowPg[] | null> {
  if (!isPgConfigured()) return null
  if (ids.length === 0) return []
  try {
    const rows = await pgQuery<{
      id: string
      type: string
      difficulty: string | null
      content_json: unknown
    }>(
      `select id::text, type::text, difficulty::text as difficulty, content_json
       from public.worksheet_questions
       where id = any($1::uuid[]) and type = 'quiz'`,
      [ids]
    )
    return rows
  } catch (e) {
    console.error('[exam-session-admin-pg] fetchWorksheetQuizRowsByIdsPg', e)
    return null
  }
}

export type WorksheetEssayRowPg = {
  id: string
  content_json: unknown
}

export async function fetchWorksheetEssayRowsByIdsPg(ids: string[]): Promise<WorksheetEssayRowPg[] | null> {
  if (!isPgConfigured()) return null
  if (ids.length === 0) return []
  try {
    const rows = await pgQuery<{ id: string; content_json: unknown }>(
      `select id::text, content_json
       from public.worksheet_questions
       where id = any($1::uuid[]) and type = 'essay'`,
      [ids]
    )
    return rows
  } catch (e) {
    console.error('[exam-session-admin-pg] fetchWorksheetEssayRowsByIdsPg', e)
    return null
  }
}

export type OfficialBankRowPg = {
  question_text: string
  options: unknown
  correct_index: unknown
  difficulty: string | null
}

export async function fetchOfficialQuestionsBankPg(params: {
  subjectId: string
  gradeLevelId: string
  lessonTopics: string[]
  difficulty: string | undefined
  limit: number
}): Promise<OfficialBankRowPg[] | null> {
  if (!isPgConfigured()) return null
  try {
    const lim = Math.max(1, Math.min(500, params.limit))
    if (params.lessonTopics.length >= 1) {
      if (params.difficulty) {
        return await pgQuery<OfficialBankRowPg>(
          `select question_text, options, correct_index, difficulty::text as difficulty
           from public.worksheet_official_questions
           where subject_id = $1 and grade_level_id = $2
             and topic_normalized is not null
             and topic_normalized = any($3::text[])
             and difficulty = $4
           limit $5`,
          [params.subjectId, params.gradeLevelId, params.lessonTopics, params.difficulty, lim]
        )
      }
      return await pgQuery<OfficialBankRowPg>(
        `select question_text, options, correct_index, difficulty::text as difficulty
         from public.worksheet_official_questions
         where subject_id = $1 and grade_level_id = $2
           and topic_normalized is not null
           and topic_normalized = any($3::text[])
         limit $4`,
        [params.subjectId, params.gradeLevelId, params.lessonTopics, lim]
      )
    }
    if (params.difficulty) {
      return await pgQuery<OfficialBankRowPg>(
        `select question_text, options, correct_index, difficulty::text as difficulty
         from public.worksheet_official_questions
         where subject_id = $1 and grade_level_id = $2 and difficulty = $3
         limit $4`,
        [params.subjectId, params.gradeLevelId, params.difficulty, lim]
      )
    }
    return await pgQuery<OfficialBankRowPg>(
      `select question_text, options, correct_index, difficulty::text as difficulty
       from public.worksheet_official_questions
       where subject_id = $1 and grade_level_id = $2
       limit $3`,
      [params.subjectId, params.gradeLevelId, lim]
    )
  } catch (e) {
    console.error('[exam-session-admin-pg] fetchOfficialQuestionsBankPg', e)
    return null
  }
}

export async function insertExamSessionCreatePg(params: {
  code: string
  teacherId: string
  title: string
  examType: string
  subjectId: string
  gradeLevelId: string
  classId: string
  schoolId: string
  durationMinutes: number
  minutesPerQuestion: number
  config: Record<string, unknown>
  practiceHomework: boolean
}): Promise<{ id: string } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.exam_sessions (
        code, teacher_id, title, exam_type, subject_id, grade_level_id,
        class_id, school_id, duration_minutes, minutes_per_question, config,
        status, is_practice_homework
      ) values (
        $1, $2::uuid, $3, $4, $5, $6,
        $7::uuid, $8::uuid, $9, $10, $11::jsonb,
        'active', $12
      )
      returning id::text as id`,
      [
        params.code,
        params.teacherId,
        params.title,
        params.examType,
        params.subjectId,
        params.gradeLevelId,
        params.classId,
        params.schoolId,
        params.durationMinutes,
        params.minutesPerQuestion,
        JSON.stringify(params.config ?? {}),
        params.practiceHomework,
      ]
    )
    return row ? { id: row.id } : null
  } catch (e) {
    console.error('[exam-session-admin-pg] insertExamSessionCreatePg', e)
    return null
  }
}

export async function insertExamQuestionRowsPg(
  sessionId: string,
  rows: Array<{
    question_text: string
    options: unknown
    correct_index: number
    order: number
    source: string
    worksheet_question_id: string | null
    points: number
  }>
): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  if (rows.length === 0) return true
  try {
    for (const q of rows) {
      await pgQuery(
        `insert into public.exam_questions (
          session_id, question_text, options, correct_index, "order", source, worksheet_question_id, points
        ) values (
          $1::uuid, $2, $3::jsonb, $4, $5, $6, $7::uuid, $8
        )`,
        [
          sessionId,
          q.question_text,
          JSON.stringify(Array.isArray(q.options) ? q.options : q.options ?? []),
          q.correct_index,
          q.order,
          q.source,
          q.worksheet_question_id,
          q.points,
        ]
      )
    }
    return true
  } catch (e) {
    console.error('[exam-session-admin-pg] insertExamQuestionRowsPg', e)
    return null
  }
}

export async function deleteExamSessionByIdPg(sessionId: string): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const r = await pgQueryOne<{ id: string }>(
      `delete from public.exam_sessions where id = $1::uuid returning id::text as id`,
      [sessionId]
    )
    return r != null
  } catch (e) {
    console.error('[exam-session-admin-pg] deleteExamSessionByIdPg', e)
    return null
  }
}

export async function setExamLineageRootToSelfPg(sessionId: string): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    await pgQuery(
      `update public.exam_sessions set exam_lineage_root_id = $1::uuid where id = $1::uuid`,
      [sessionId]
    )
    return true
  } catch (e) {
    console.error('[exam-session-admin-pg] setExamLineageRootToSelfPg', e)
    return null
  }
}

// --- attach-class ---

export type ClassAttachRowPg = {
  id: string
  teacher_id: string
  school_id: string | null
  name: string | null
  school_name: string | null
}

export async function fetchClassForAttachExamPg(
  classId: string,
  teacherId: string
): Promise<ClassAttachRowPg | 'not_found' | 'forbidden' | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      id: string
      teacher_id: string
      school_id: string | null
      name: string | null
      school_name: string | null
    }>(
      `select c.id::text, c.teacher_id::text, c.school_id::text, c.name, sch.name as school_name
       from public.classes c
       left join public.schools sch on sch.id = c.school_id
       where c.id = $1::uuid
       limit 1`,
      [classId]
    )
    if (!row) return 'not_found'
    if (row.teacher_id !== teacherId) return 'forbidden'
    return {
      id: row.id,
      teacher_id: row.teacher_id,
      school_id: row.school_id,
      name: row.name,
      school_name: row.school_name,
    }
  } catch (e) {
    console.error('[exam-session-admin-pg] fetchClassForAttachExamPg', e)
    return null
  }
}

export async function fetchExamSessionByIdForTeacherPg(
  sessionId: string,
  teacherId: string
): Promise<Record<string, unknown> | 'not_found' | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select *
       from public.exam_sessions
       where id = $1::uuid and teacher_id = $2::uuid
       limit 1`,
      [sessionId, teacherId]
    )
    if (!row) return 'not_found'
    return row
  } catch (e) {
    console.error('[exam-session-admin-pg] fetchExamSessionByIdForTeacherPg', e)
    return null
  }
}

export async function fetchExamQuestionsForAttachCopyPg(sessionId: string): Promise<
  Array<Record<string, unknown>> | null
> {
  if (!isPgConfigured()) return null
  try {
    return await pgQuery<Record<string, unknown>>(
      `select question_text, options, correct_index, "order", source, worksheet_question_id, points
       from public.exam_questions
       where session_id = $1::uuid
       order by "order" asc`,
      [sessionId]
    )
  } catch (e) {
    console.error('[exam-session-admin-pg] fetchExamQuestionsForAttachCopyPg', e)
    return null
  }
}

export async function existsExamDuplicateAttachPg(params: {
  teacherId: string
  classId: string
  lineageRootId: string
}): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const byLineage = await pgQueryOne<{ id: string }>(
      `select id::text from public.exam_sessions
       where teacher_id = $1::uuid and class_id = $2::uuid and exam_lineage_root_id = $3::uuid
       limit 1`,
      [params.teacherId, params.classId, params.lineageRootId]
    )
    if (byLineage) return true
    const byRoot = await pgQueryOne<{ id: string }>(
      `select id::text from public.exam_sessions
       where teacher_id = $1::uuid and class_id = $2::uuid and id = $3::uuid
       limit 1`,
      [params.teacherId, params.classId, params.lineageRootId]
    )
    return byRoot != null
  } catch (e) {
    console.error('[exam-session-admin-pg] existsExamDuplicateAttachPg', e)
    return null
  }
}

export async function examSessionCodeTakenPg(code: string): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const r = await pgQueryOne<{ id: string }>(
      `select id::text from public.exam_sessions where code = $1 limit 1`,
      [code]
    )
    return r != null
  } catch (e) {
    console.error('[exam-session-admin-pg] examSessionCodeTakenPg', e)
    return null
  }
}

function isMissingLineageColumnError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.toLowerCase().includes('exam_lineage_root_id')
}

export async function insertExamSessionAttachPg(params: {
  code: string
  teacherId: string
  title: string
  examType: string
  subjectId: string
  gradeLevelId: string
  classId: string
  schoolId: string | null
  durationMinutes: number
  minutesPerQuestion: number
  config: Record<string, unknown>
  practiceHomework: boolean
  lineageRootId: string
}): Promise<{ id: string } | { error: string; retryWithoutLineage: boolean } | null> {
  if (!isPgConfigured()) return null
  const baseValues = [
    params.code,
    params.teacherId,
    params.title,
    params.examType,
    params.subjectId,
    params.gradeLevelId,
    params.classId,
    params.schoolId,
    params.durationMinutes,
    params.minutesPerQuestion,
    JSON.stringify(params.config ?? {}),
    params.practiceHomework,
  ]
  try {
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.exam_sessions (
        code, teacher_id, title, exam_type, subject_id, grade_level_id,
        class_id, school_id, duration_minutes, minutes_per_question, config,
        status, is_practice_homework, exam_lineage_root_id
      ) values (
        $1, $2::uuid, $3, $4, $5, $6,
        $7::uuid, $8::uuid, $9, $10, $11::jsonb,
        'active', $12, $13::uuid
      )
      returning id::text as id`,
      [...baseValues, params.lineageRootId]
    )
    return row ? { id: row.id } : null
  } catch (e) {
    if (isMissingLineageColumnError(e)) {
      return { error: e instanceof Error ? e.message : String(e), retryWithoutLineage: true }
    }
    console.error('[exam-session-admin-pg] insertExamSessionAttachPg', e)
    return null
  }
}

export async function insertExamSessionAttachWithoutLineagePg(params: {
  code: string
  teacherId: string
  title: string
  examType: string
  subjectId: string
  gradeLevelId: string
  classId: string
  schoolId: string | null
  durationMinutes: number
  minutesPerQuestion: number
  config: Record<string, unknown>
  practiceHomework: boolean
}): Promise<{ id: string } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.exam_sessions (
        code, teacher_id, title, exam_type, subject_id, grade_level_id,
        class_id, school_id, duration_minutes, minutes_per_question, config,
        status, is_practice_homework
      ) values (
        $1, $2::uuid, $3, $4, $5, $6,
        $7::uuid, $8::uuid, $9, $10, $11::jsonb,
        'active', $12
      )
      returning id::text as id`,
      [
        params.code,
        params.teacherId,
        params.title,
        params.examType,
        params.subjectId,
        params.gradeLevelId,
        params.classId,
        params.schoolId,
        params.durationMinutes,
        params.minutesPerQuestion,
        JSON.stringify(params.config ?? {}),
        params.practiceHomework,
      ]
    )
    return row ? { id: row.id } : null
  } catch (e) {
    console.error('[exam-session-admin-pg] insertExamSessionAttachWithoutLineagePg', e)
    return null
  }
}

export async function insertExamQuestionsBulkAttachPg(
  newSessionId: string,
  questions: Array<Record<string, unknown>>
): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  if (questions.length === 0) return true
  try {
    let idx = 0
    for (const q of questions) {
      const orderRaw = q.order
      const ord =
        typeof orderRaw === 'number'
          ? orderRaw
          : Number.isFinite(Number(orderRaw))
            ? Math.floor(Number(orderRaw))
            : idx
      const pts = q.points
      const points =
        typeof pts === 'number' && Number.isFinite(pts)
          ? pts
          : Math.max(0.25, Number(pts) || 1)
      await pgQuery(
        `insert into public.exam_questions (
          session_id, question_text, options, correct_index, "order", source, worksheet_question_id, points
        ) values (
          $1::uuid, $2, $3::jsonb, $4, $5, $6, $7::uuid, $8
        )`,
        [
          newSessionId,
          String(q.question_text ?? ''),
          JSON.stringify(Array.isArray(q.options) ? q.options : q.options ?? []),
          typeof q.correct_index === 'number' ? q.correct_index : Number(q.correct_index) || 0,
          ord,
          q.source != null ? String(q.source) : 'official',
          q.worksheet_question_id != null ? String(q.worksheet_question_id) : null,
          points,
        ]
      )
      idx++
    }
    return true
  } catch (e) {
    console.error('[exam-session-admin-pg] insertExamQuestionsBulkAttachPg', e)
    return null
  }
}
