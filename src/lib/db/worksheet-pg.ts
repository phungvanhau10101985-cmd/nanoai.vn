import type { Json } from '@/types/database.types'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

/** Hàng `type` + `difficulty` cho đếm theo giáo trình. `null` = không PG hoặc lỗi — caller xử lý khi không có PG. */
export async function fetchQuestionTypeDifficultyRowsForCurriculumFromPg(
  curriculumId: string
): Promise<{ type: string; difficulty: string | null }[] | null> {
  if (!isPgConfigured()) return null
  try {
    const ws = await pgQueryOne<{ question_ids: string[] | null }>(
      `select question_ids from public.worksheet_worksheets
       where curriculum_id = $1
       order by created_at desc nulls last
       limit 1`,
      [curriculumId]
    )
    const ids = (ws?.question_ids ?? []).filter(Boolean)
    if (ids.length === 0) return []
    const rows = await pgQuery<{ type: string; difficulty: string | null }>(
      `select type::text as type, difficulty::text as difficulty
       from public.worksheet_questions
       where id = any($1::uuid[])`,
      [ids]
    )
    return rows
  } catch (e) {
    console.error('[worksheet-pg] fetchQuestionTypeDifficultyRowsForCurriculumFromPg', e)
    return null
  }
}

export async function insertWorksheetJobFromPg(input: {
  userId: string
  type: string
  params: unknown
  /** Một số luồng (vd. tách SGK) truyền id trước khi upload ảnh. */
  id?: string
}): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const paramsJson = JSON.stringify(input.params ?? {})
    if (input.id) {
      const row = await pgQueryOne<{ id: string }>(
        `insert into public.worksheet_jobs (id, user_id, type, status, params)
         values ($1::uuid, $2::uuid, $3, 'pending', $4::jsonb)
         returning id::text as id`,
        [input.id, input.userId, input.type, paramsJson]
      )
      return row?.id ?? null
    }
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.worksheet_jobs (user_id, type, status, params)
       values ($1::uuid, $2, 'pending', $3::jsonb)
       returning id::text as id`,
      [input.userId, input.type, paramsJson]
    )
    return row?.id ?? null
  } catch (e) {
    console.error('[worksheet-pg] insertWorksheetJobFromPg', e)
    return null
  }
}

export type WorksheetJobStatusPgRow = {
  id: string
  type: string
  status: string
  result: Json | null
  error_message: string | null
  created_at: string
  updated_at: string
}

function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString()
  return String(v ?? '')
}

export type WorksheetQuestionListRowPg = {
  id: string
  type: string
  content_json: Json
  difficulty: string | null
}

/**
 * Câu hỏi thuộc phiếu mới nhất của giáo trình (theo `question_ids`).
 * `[]` = không có câu; `null` = không PG hoặc lỗi — caller xử lý khi không có PG.
 */
export async function fetchWorksheetQuestionsByCurriculumLatestSheetFromPg(
  curriculumId: string
): Promise<WorksheetQuestionListRowPg[] | null> {
  if (!isPgConfigured()) return null
  try {
    const ws = await pgQueryOne<{ question_ids: string[] | null }>(
      `select question_ids from public.worksheet_worksheets
       where curriculum_id = $1
       order by created_at desc nulls last
       limit 1`,
      [curriculumId]
    )
    const ids = (ws?.question_ids ?? []).filter(Boolean)
    if (ids.length === 0) return []
    const rows = await pgQuery<{
      id: string
      type: string
      content_json: unknown
      difficulty: string | null
    }>(
      `select id::text, type::text, content_json, difficulty::text as difficulty
       from public.worksheet_questions
       where id = any($1::uuid[])`,
      [ids]
    )
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      content_json: (r.content_json ?? null) as Json,
      difficulty: r.difficulty,
    }))
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetQuestionsByCurriculumLatestSheetFromPg', e)
    return null
  }
}

export async function insertWorksheetQuestionPg(params: {
  userId: string
  curriculumId: string | null
  type: 'quiz' | 'essay'
  subjectId: string
  gradeLevelId: string
  topic: string | null
  lessonTopics: string[] | undefined
  difficulty: string
  contentJson: unknown
  order: number
  verifiedAtIso?: string | null
  /** Mặc định `ai` — worker SGK dùng `sgk`. */
  source?: string
}): Promise<{ id: string; content_json: Json; created_at: string } | null> {
  if (!isPgConfigured()) return null
  try {
    const lessonTopics = params.lessonTopics?.length ? params.lessonTopics : null
    const verifiedAt = params.verifiedAtIso ?? null
    const source = (params.source ?? 'ai').trim() || 'ai'
    const row = await pgQueryOne<{
      id: string
      content_json: unknown
      created_at: unknown
    }>(
      `insert into public.worksheet_questions (
         user_id, curriculum_id, type, subject_id, grade_level_id, topic, lesson_topics, difficulty, content_json, source, "order", verified_at
       ) values (
         $1::uuid, $2::uuid, $3, $4, $5, $6, $7::text[], $8, $9::jsonb, $10, $11, $12::timestamptz
       )
       returning id::text, content_json, created_at`,
      [
        params.userId,
        params.curriculumId,
        params.type,
        params.subjectId,
        params.gradeLevelId,
        params.topic,
        lessonTopics,
        params.difficulty,
        JSON.stringify(params.contentJson ?? {}),
        source,
        params.order,
        verifiedAt,
      ]
    )
    if (!row) return null
    return {
      id: row.id,
      content_json: (row.content_json ?? null) as Json,
      created_at: iso(row.created_at),
    }
  } catch (e) {
    console.error('[worksheet-pg] insertWorksheetQuestionPg', e)
    return null
  }
}

/** Giáo trình: topic + lesson_topics (parse SGK). */
export async function fetchWorksheetCurriculumTopicLessonTopicsPg(
  curriculumId: string
): Promise<{ topic: string | null; lesson_topics: string[] | null } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ topic: string | null; lesson_topics: string[] | null }>(
      `select topic::text, lesson_topics from public.worksheet_curricula where id = $1::uuid limit 1`,
      [curriculumId]
    )
    return row
      ? {
          topic: row.topic,
          lesson_topics: Array.isArray(row.lesson_topics) ? row.lesson_topics.map(String) : null,
        }
      : null
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetCurriculumTopicLessonTopicsPg', e)
    return null
  }
}

export async function fetchWorksheetSheetIdQuestionIdsPg(
  worksheetId: string
): Promise<{ id: string; question_ids: string[] } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string; question_ids: string[] | null }>(
      `select id::text, question_ids from public.worksheet_worksheets where id = $1::uuid limit 1`,
      [worksheetId]
    )
    if (!row) return null
    return { id: row.id, question_ids: (row.question_ids ?? []).map(String).filter(Boolean) }
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetSheetIdQuestionIdsPg', e)
    return null
  }
}

/** Phiếu mới nhất theo giáo trình (parse SGK / step-by-step). */
export async function fetchLatestWorksheetSheetByCurriculumIdPg(
  curriculumId: string
): Promise<{ id: string; question_ids: string[] } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string; question_ids: string[] | null }>(
      `select id::text, question_ids from public.worksheet_worksheets
       where curriculum_id = $1::uuid
       order by created_at desc nulls last
       limit 1`,
      [curriculumId]
    )
    if (!row) return null
    return { id: row.id, question_ids: (row.question_ids ?? []).map(String).filter(Boolean) }
  } catch (e) {
    console.error('[worksheet-pg] fetchLatestWorksheetSheetByCurriculumIdPg', e)
    return null
  }
}

/** Parse SGK: đọc nội dung câu đã có trên phiếu. */
export async function fetchWorksheetQuestionsIdTypeContentJsonPg(
  questionIds: string[]
): Promise<Array<{ id: string; type: string; content_json: unknown }> | null> {
  if (!isPgConfigured()) return null
  if (questionIds.length === 0) return []
  try {
    return await pgQuery<{ id: string; type: string; content_json: unknown }>(
      `select id::text, type::text, content_json from public.worksheet_questions where id = any($1::uuid[])`,
      [questionIds]
    )
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetQuestionsIdTypeContentJsonPg', e)
    return null
  }
}

export async function fetchWorksheetQuestionIdTypesPg(
  questionIds: string[]
): Promise<Map<string, string> | null> {
  if (!isPgConfigured()) return null
  if (questionIds.length === 0) return new Map()
  try {
    const rows = await pgQuery<{ id: string; type: string }>(
      `select id::text, type::text from public.worksheet_questions where id = any($1::uuid[])`,
      [questionIds]
    )
    return new Map(rows.map((r) => [r.id, r.type]))
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetQuestionIdTypesPg', e)
    return null
  }
}

export async function fetchWorksheetQuestionContentJsonByIdPg(
  questionId: string
): Promise<{ content_json: unknown } | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne<{ content_json: unknown }>(
      `select content_json from public.worksheet_questions where id = $1::uuid limit 1`,
      [questionId]
    )
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetQuestionContentJsonByIdPg', e)
    return null
  }
}

export async function updateWorksheetSheetMarkdownQuestionIdsPg(
  worksheetId: string,
  questionIds: string[],
  contentMarkdown: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const pool = getPgPool()
    const res = await pool.query(
      `update public.worksheet_worksheets
       set content_markdown = $2, question_ids = $3::uuid[]
       where id = $1::uuid`,
      [worksheetId, contentMarkdown, questionIds]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.error('[worksheet-pg] updateWorksheetSheetMarkdownQuestionIdsPg', e)
    return false
  }
}

export async function mergeWorksheetSheetSgkImageUrlsPg(
  worksheetId: string,
  appendUrls: string[]
): Promise<boolean> {
  if (!isPgConfigured() || appendUrls.length === 0) return false
  try {
    const row = await pgQueryOne<{ sgk_image_urls: unknown }>(
      `select sgk_image_urls from public.worksheet_worksheets where id = $1::uuid limit 1`,
      [worksheetId]
    )
    const existing = Array.isArray(row?.sgk_image_urls)
      ? (row!.sgk_image_urls as unknown[]).filter((x): x is string => typeof x === 'string')
      : []
    const merged = [...existing, ...appendUrls]
    const pool = getPgPool()
    const res = await pool.query(
      `update public.worksheet_worksheets set sgk_image_urls = $2::jsonb where id = $1::uuid`,
      [worksheetId, JSON.stringify(merged)]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.error('[worksheet-pg] mergeWorksheetSheetSgkImageUrlsPg', e)
    return false
  }
}

/** Phiếu thuộc user (solve SGK essays). */
export async function fetchWorksheetSheetOwnedByUserPg(
  worksheetId: string,
  userId: string
): Promise<{
  id: string
  user_id: string
  curriculum_id: string | null
  topic: string | null
  question_ids: string[]
  sgk_image_urls: string[]
} | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select id::text, user_id::text, curriculum_id::text, topic::text, question_ids, sgk_image_urls
       from public.worksheet_worksheets
       where id = $1::uuid and user_id = $2::uuid
       limit 1`,
      [worksheetId, userId]
    )
    if (!row) return null
    const qids = row.question_ids
    const imgs = row.sgk_image_urls
    return {
      id: String(row.id),
      user_id: String(row.user_id ?? ''),
      curriculum_id: row.curriculum_id != null ? String(row.curriculum_id) : null,
      topic: row.topic != null ? String(row.topic) : null,
      question_ids: Array.isArray(qids) ? qids.map((x) => String(x)).filter(Boolean) : [],
      sgk_image_urls: Array.isArray(imgs) ? imgs.filter((x): x is string => typeof x === 'string') : [],
    }
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetSheetOwnedByUserPg', e)
    return null
  }
}

/** Thứ tự giống `questionIds` — dùng cho `questionsToMarkdown`. `null` = không PG hoặc lỗi. */
export async function fetchWorksheetQuestionsMarkdownRowsOrderedFromPg(questionIds: string[]): Promise<
  Array<{
    id: string
    type: string
    content_json: Json
    difficulty: string | null
    source: string | null
    verified_at: string | null
    subject_id: string
    grade_level_id: string
  }> | null
> {
  if (!isPgConfigured()) return null
  if (questionIds.length === 0) return []
  try {
    const rows = await pgQuery<{
      id: string
      type: string
      content_json: unknown
      difficulty: string | null
      source: string | null
      verified_at: unknown
      subject_id: string
      grade_level_id: string
    }>(
      `select id::text, type::text, content_json, difficulty::text as difficulty,
              source::text as source, verified_at,
              subject_id::text, grade_level_id::text
       from public.worksheet_questions
       where id = any($1::uuid[])`,
      [questionIds]
    )
    const byId = new Map(rows.map((r) => [r.id, r]))
    const ordered: Array<{
      id: string
      type: string
      content_json: Json
      difficulty: string | null
      source: string | null
      verified_at: string | null
      subject_id: string
      grade_level_id: string
    }> = []
    for (const id of questionIds) {
      const r = byId.get(id)
      if (!r) continue
      ordered.push({
        id: r.id,
        type: r.type,
        content_json: (r.content_json ?? null) as Json,
        difficulty: r.difficulty,
        source: r.source,
        verified_at: r.verified_at != null ? iso(r.verified_at) : null,
        subject_id: String(r.subject_id ?? ''),
        grade_level_id: String(r.grade_level_id ?? ''),
      })
    }
    return ordered
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetQuestionsMarkdownRowsOrderedFromPg', e)
    return null
  }
}

export async function fetchWorksheetSheetOwnerAndQuestionIdsFromPg(
  worksheetId: string
): Promise<{ user_id: string; question_ids: string[] } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ user_id: string; question_ids: string[] | null }>(
      `select user_id::text, question_ids from public.worksheet_worksheets where id = $1::uuid limit 1`,
      [worksheetId]
    )
    if (!row) return null
    return {
      user_id: row.user_id,
      question_ids: (row.question_ids ?? []).filter(Boolean),
    }
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetSheetOwnerAndQuestionIdsFromPg', e)
    return null
  }
}

/** `true` đã cập nhật; `false` không có dòng khớp; `null` không PG hoặc lỗi. */
export async function updateWorksheetSheetContentForOwnerPg(
  worksheetId: string,
  ownerUserId: string,
  questionIds: string[],
  contentMarkdown: string
): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.worksheet_worksheets
       set question_ids = $3::uuid[], content_markdown = $4, updated_at = now()
       where id = $1::uuid and user_id = $2::uuid
       returning id::text as id`,
      [worksheetId, ownerUserId, questionIds, contentMarkdown]
    )
    return row != null
  } catch (e) {
    console.error('[worksheet-pg] updateWorksheetSheetContentForOwnerPg', e)
    return null
  }
}

export async function fetchWorksheetTopicByIdFromPg(worksheetId: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ topic: string | null }>(
      `select topic from public.worksheet_worksheets where id = $1::uuid limit 1`,
      [worksheetId]
    )
    if (!row) return null
    return row.topic != null ? String(row.topic) : null
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetTopicByIdFromPg', e)
    return null
  }
}

/** Trang công khai `/phieu-bai-tap/[id]` — có `created_at` cho metadata. */
export async function fetchWorksheetSheetPublicViewByIdFromPg(worksheetId: string): Promise<{
  id: string
  topic: string | null
  content_markdown: string
  question_ids: string[]
  created_at: string
} | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      id: string
      topic: string | null
      content_markdown: string | null
      question_ids: string[] | null
      created_at: unknown
    }>(
      `select id::text, topic, content_markdown, question_ids, created_at
       from public.worksheet_worksheets where id = $1::uuid limit 1`,
      [worksheetId]
    )
    if (!row) return null
    return {
      id: row.id,
      topic: row.topic,
      content_markdown: String(row.content_markdown ?? ''),
      question_ids: (row.question_ids ?? []).filter(Boolean),
      created_at: iso(row.created_at),
    }
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetSheetPublicViewByIdFromPg', e)
    return null
  }
}

export async function fetchWorksheetSheetMinimalByIdFromPg(worksheetId: string): Promise<{
  id: string
  topic: string
  content_markdown: string
  question_ids: string[]
} | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      id: string
      topic: string | null
      content_markdown: string | null
      question_ids: string[] | null
    }>(
      `select id::text, topic, content_markdown, question_ids
       from public.worksheet_worksheets where id = $1::uuid limit 1`,
      [worksheetId]
    )
    if (!row) return null
    return {
      id: row.id,
      topic: String(row.topic ?? ''),
      content_markdown: String(row.content_markdown ?? ''),
      question_ids: (row.question_ids ?? []).filter(Boolean),
    }
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetSheetMinimalByIdFromPg', e)
    return null
  }
}

export async function fetchWorksheetQuestionsTypeContentOrderedFromPg(questionIds: string[]): Promise<
  Array<{ id: string; type: string; content_json: Json }> | null
> {
  if (!isPgConfigured() || questionIds.length === 0) return null
  try {
    const rows = await pgQuery<{
      id: string
      type: string
      content_json: unknown
    }>(
      `select id::text, type::text, content_json from public.worksheet_questions where id = any($1::uuid[])`,
      [questionIds]
    )
    const byId = new Map(rows.map((r) => [r.id, r]))
    const ordered: Array<{ id: string; type: string; content_json: Json }> = []
    for (const id of questionIds) {
      const r = byId.get(id)
      if (r) ordered.push({ id: r.id, type: r.type, content_json: (r.content_json ?? null) as Json })
    }
    return ordered
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetQuestionsTypeContentOrderedFromPg', e)
    return null
  }
}

/** Trả `true`/`false`; `null` = không PG hoặc lỗi — caller xử lý ở caller khi không có PG. */
export async function isWorksheetQuestionLinkedToCurriculumPg(
  curriculumId: string,
  questionId: string
): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ ok: boolean }>(
      `select (
         exists (
           select 1 from public.worksheet_questions q
           where q.id = $2::uuid and q.curriculum_id = $1::uuid
         )
         or exists (
           select 1 from public.worksheet_worksheets w
           where w.curriculum_id = $1::uuid and $2::uuid = any (coalesce(w.question_ids, array[]::uuid[]))
         )
       ) as ok`,
      [curriculumId, questionId]
    )
    return row?.ok ?? false
  } catch (e) {
    console.error('[worksheet-pg] isWorksheetQuestionLinkedToCurriculumPg', e)
    return null
  }
}

export async function fetchWorksheetQuestionDetailRowPg(questionId: string): Promise<{
  id: string
  type: string
  topic: string | null
  content_json: Json
  user_id: string
} | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select id::text, type::text, topic, content_json, user_id::text
       from public.worksheet_questions where id = $1::uuid limit 1`,
      [questionId]
    )
    if (!row) return null
    return {
      id: String(row.id),
      type: String(row.type ?? ''),
      topic: row.topic != null ? String(row.topic) : null,
      content_json: (row.content_json ?? null) as Json,
      user_id: String(row.user_id ?? ''),
    }
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetQuestionDetailRowPg', e)
    return null
  }
}

export async function fetchWorksheetJobForUserFromPg(
  jobId: string,
  userId: string
): Promise<WorksheetJobStatusPgRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select id::text, type::text, status::text, result, error_message, created_at, updated_at
       from public.worksheet_jobs
       where id = $1::uuid and user_id = $2::uuid
       limit 1`,
      [jobId, userId]
    )
    if (!row) return null
    return {
      id: String(row.id),
      type: String(row.type ?? ''),
      status: String(row.status ?? ''),
      result: (row.result ?? null) as Json | null,
      error_message: row.error_message != null ? String(row.error_message) : null,
      created_at: iso(row.created_at),
      updated_at: iso(row.updated_at),
    }
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetJobForUserFromPg', e)
    return null
  }
}

/** `true`/`false`; `null` = không PG hoặc lỗi. */
export async function worksheetSheetExistsByIdFromPg(worksheetId: string): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ ok: number }>(
      `select 1 as ok from public.worksheet_worksheets where id = $1::uuid limit 1`,
      [worksheetId]
    )
    return row != null
  } catch (e) {
    console.error('[worksheet-pg] worksheetSheetExistsByIdFromPg', e)
    return null
  }
}

export async function fetchWorksheetSheetsForCurriculumCatalogFromPg(
  curriculumId: string
): Promise<Array<{ question_ids: string[]; created_at: string }> | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{
      question_ids: string[] | null
      created_at: unknown
    }>(
      `select question_ids, created_at from public.worksheet_worksheets
       where curriculum_id = $1
       order by created_at desc`,
      [curriculumId]
    )
    return rows.map((r) => ({
      question_ids: (r.question_ids ?? []).filter(Boolean),
      created_at: iso(r.created_at),
    }))
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetSheetsForCurriculumCatalogFromPg', e)
    return null
  }
}

/** Câu gắn trực tiếp `curriculum_id` (quiz/essay). */
export async function fetchWorksheetQuestionIdsByCurriculumColumnFromPg(
  curriculumId: string
): Promise<string[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{ id: string }>(
      `select id::text from public.worksheet_questions
       where curriculum_id = $1::uuid and type in ('quiz', 'essay')`,
      [curriculumId]
    )
    return rows.map((r) => r.id)
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetQuestionIdsByCurriculumColumnFromPg', e)
    return null
  }
}

export type WorksheetQuestionCatalogRowPg = {
  id: string
  type: string
  topic: string | null
  subject_id: string
  grade_level_id: string
  source: string | null
  difficulty: string | null
  order: number
  created_at: string
  verified_at: string | null
  content_json: unknown
}

export async function fetchWorksheetQuestionCatalogRowsByIdsFromPg(
  ids: string[]
): Promise<WorksheetQuestionCatalogRowPg[] | null> {
  if (!isPgConfigured() || ids.length === 0) return null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text, type::text, topic, subject_id::text, grade_level_id::text,
              source::text, difficulty::text, "order", created_at, verified_at, content_json
       from public.worksheet_questions
       where id = any($1::uuid[])`,
      [ids]
    )
    return rows.map((r) => {
      const ord = r.order
      const orderNum = typeof ord === 'number' ? ord : Number(ord) || 0
      return {
        id: String(r.id),
        type: String(r.type ?? ''),
        topic: r.topic != null ? String(r.topic) : null,
        subject_id: String(r.subject_id ?? ''),
        grade_level_id: String(r.grade_level_id ?? ''),
        source: r.source != null ? String(r.source) : null,
        difficulty: r.difficulty != null ? String(r.difficulty) : null,
        order: orderNum,
        created_at: iso(r.created_at),
        verified_at: r.verified_at != null ? iso(r.verified_at) : null,
        content_json: r.content_json,
      }
    })
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetQuestionCatalogRowsByIdsFromPg', e)
    return null
  }
}

/** `null` = không PG, không có dòng, hoặc lỗi — caller caller xử lý khi không có PG. */
export async function fetchWorksheetCurriculumSubjectGradeFromPg(
  curriculumId: string
): Promise<{ subject_id: string; grade_level_id: string } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ subject_id: string; grade_level_id: string }>(
      `select subject_id::text, grade_level_id::text
       from public.worksheet_curricula where id = $1::uuid limit 1`,
      [curriculumId]
    )
    if (!row) return null
    return {
      subject_id: String(row.subject_id ?? ''),
      grade_level_id: String(row.grade_level_id ?? ''),
    }
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetCurriculumSubjectGradeFromPg', e)
    return null
  }
}

/** Tạo phiếu slide chữa bài — `null` = không insert được qua PG. */
export async function insertWorksheetSheetSlideBuildFromPg(input: {
  userId: string
  topic: string
  subjectId: string
  gradeLevelId: string
  contentMarkdown: string
  questionIds: string[]
  curriculumId?: string | null
}): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const cur = input.curriculumId?.trim() || null
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.worksheet_worksheets (
         user_id, curriculum_id, topic, subject_id, grade_level_id, content_markdown, question_ids
       ) values (
         $1::uuid, $2::uuid, $3, $4, $5, $6, $7::uuid[]
       )
       returning id::text as id`,
      [
        input.userId,
        cur,
        input.topic,
        input.subjectId,
        input.gradeLevelId,
        input.contentMarkdown,
        input.questionIds,
      ]
    )
    return row?.id ?? null
  } catch (e) {
    console.error('[worksheet-pg] insertWorksheetSheetSlideBuildFromPg', e)
    return null
  }
}

export type WorksheetQuestionAdminCatalogRowPg = {
  id: string
  type: string
  topic: string | null
  subject_id: string
  grade_level_id: string
  source: string | null
  created_at: string
  content_json: unknown
}

/** Trang admin chọn câu làm slide — `null` = caller xử lý khi không có PG. */
export async function fetchWorksheetQuestionsAdminCatalogPageFromPg(
  type: 'all' | 'quiz' | 'essay',
  limit: number,
  offset: number
): Promise<WorksheetQuestionAdminCatalogRowPg[] | null> {
  if (!isPgConfigured()) return null
  try {
    const lim = Math.min(100, Math.max(1, limit))
    const off = Math.max(0, offset)
    const base = `select id::text, type::text, topic, subject_id::text, grade_level_id::text,
                         source::text, created_at, content_json
                  from public.worksheet_questions`
    const order = `order by created_at desc nulls last limit $1 offset $2`
    const rows =
      type === 'quiz' || type === 'essay'
        ? await pgQuery<Record<string, unknown>>(
            `${base} where type = $3 ${order}`,
            [lim, off, type]
          )
        : await pgQuery<Record<string, unknown>>(`${base} where type in ('quiz', 'essay') ${order}`, [lim, off])
    return rows.map((r) => ({
      id: String(r.id),
      type: String(r.type ?? ''),
      topic: r.topic != null ? String(r.topic) : null,
      subject_id: String(r.subject_id ?? ''),
      grade_level_id: String(r.grade_level_id ?? ''),
      source: r.source != null ? String(r.source) : null,
      created_at: iso(r.created_at),
      content_json: r.content_json,
    }))
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetQuestionsAdminCatalogPageFromPg', e)
    return null
  }
}

/** Lô `worksheet_questions` theo id (chữa bài thi). */
/** Bài nộp HS — trang kết quả phiếu trong lớp. */
export async function fetchWorksheetSubmissionForUserInClassFromPg(
  worksheetId: string,
  classId: string,
  userId: string
): Promise<{
  quiz_score: number
  quiz_total: number
  answers_json: { quiz?: Record<string, number>; essay?: Record<string, string> }
} | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      quiz_score: unknown
      quiz_total: unknown
      answers_json: unknown
    }>(
      `select quiz_score, quiz_total, answers_json
       from public.worksheet_submissions
       where worksheet_id = $1::uuid and class_id = $2::uuid and user_id = $3::uuid
       limit 1`,
      [worksheetId, classId, userId]
    )
    if (!row) return null
    const aj = row.answers_json
    const answers =
      aj && typeof aj === 'object' && !Array.isArray(aj)
        ? (aj as { quiz?: Record<string, number>; essay?: Record<string, string> })
        : {}
    return {
      quiz_score: Number(row.quiz_score ?? 0),
      quiz_total: Number(row.quiz_total ?? 0),
      answers_json: answers,
    }
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetSubmissionForUserInClassFromPg', e)
    return null
  }
}

/** Upsert bài nộp — server action `submitWorksheet`. `null` = không PG hoặc lỗi. */
export async function upsertWorksheetSubmissionPg(params: {
  worksheetId: string
  classId: string
  userId: string
  answersJson: unknown
  quizScore: number
  quizTotal: number
}): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    await pgQuery(
      `insert into public.worksheet_submissions (worksheet_id, class_id, user_id, answers_json, quiz_score, quiz_total)
       values ($1::uuid, $2::uuid, $3::uuid, $4::jsonb, $5, $6)
       on conflict (worksheet_id, class_id, user_id)
       do update set
         answers_json = excluded.answers_json,
         quiz_score = excluded.quiz_score,
         quiz_total = excluded.quiz_total,
         submitted_at = timezone('utc'::text, now())`,
      [
        params.worksheetId,
        params.classId,
        params.userId,
        JSON.stringify(params.answersJson ?? {}),
        params.quizScore,
        params.quizTotal,
      ]
    )
    return true
  } catch (e) {
    console.error('[worksheet-pg] upsertWorksheetSubmissionPg', e)
    return null
  }
}

export async function fetchWorksheetQuestionsTypeContentByIdsFromPg(
  ids: string[]
): Promise<Map<string, { type: string; content_json: unknown }> | null> {
  if (!isPgConfigured()) return null
  if (ids.length === 0) return new Map()
  try {
    const rows = await pgQuery<{ id: string; type: string; content_json: unknown }>(
      `select id::text, type::text, content_json from public.worksheet_questions where id = any($1::uuid[])`,
      [ids]
    )
    return new Map(rows.map((r) => [r.id, { type: r.type, content_json: r.content_json }]))
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetQuestionsTypeContentByIdsFromPg', e)
    return null
  }
}

// --- Tao giáo trình / phiếu: bảng `worksheet_worksheets` + `worksheet_questions` qua PG (khi có DATABASE_URL) ---

export type WorksheetSheetMetaForSavePg = {
  question_ids: string[] | null
  user_id: string | null
  curriculum_id: string | null
  subject_id: string
  grade_level_id: string
  topic: string | null
}

export async function fetchWorksheetSheetMetaForSaveFromPg(
  worksheetId: string
): Promise<WorksheetSheetMetaForSavePg | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      question_ids: string[] | null
      user_id: string | null
      curriculum_id: string | null
      subject_id: string
      grade_level_id: string
      topic: string | null
    }>(
      `select question_ids,
              user_id::text as user_id,
              curriculum_id::text as curriculum_id,
              subject_id,
              grade_level_id,
              topic
       from public.worksheet_worksheets
       where id = $1::uuid`,
      [worksheetId]
    )
    if (!row) return null
    const qids = (row.question_ids ?? []).map((x) => String(x))
    return {
      question_ids: qids.length ? qids : null,
      user_id: row.user_id,
      curriculum_id: row.curriculum_id,
      subject_id: row.subject_id,
      grade_level_id: row.grade_level_id,
      topic: row.topic,
    }
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetSheetMetaForSaveFromPg', e)
    return null
  }
}

export async function fetchWorksheetQuestionIdTypeRowsFromPg(
  ids: string[]
): Promise<{ id: string; type: string }[]> {
  if (!isPgConfigured() || ids.length === 0) return []
  try {
    return await pgQuery<{ id: string; type: string }>(
      `select id::text, type::text from public.worksheet_questions where id = any($1::uuid[])`,
      [ids]
    )
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetQuestionIdTypeRowsFromPg', e)
    return []
  }
}

export async function updateWorksheetQuestionContentJsonFromPg(
  questionId: string,
  contentJson: unknown
): Promise<{ error?: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  try {
    await pgQuery(
      `update public.worksheet_questions set content_json = $2::jsonb where id = $1::uuid`,
      [questionId, JSON.stringify(contentJson ?? null)]
    )
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function insertWorksheetQuestionEditedFromPg(input: {
  userId: string | null
  curriculumId: string | null
  type: string
  subjectId: string
  gradeLevelId: string
  topic: string | null
  contentJson: unknown
  order: number
}): Promise<{ id?: string; error?: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  try {
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.worksheet_questions
         (user_id, curriculum_id, type, subject_id, grade_level_id, topic, content_json, source, "order")
       values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb, 'edited', $8::int)
       returning id::text as id`,
      [
        input.userId,
        input.curriculumId,
        input.type,
        input.subjectId,
        input.gradeLevelId,
        input.topic,
        JSON.stringify(input.contentJson ?? null),
        input.order,
      ]
    )
    return { id: row?.id }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function updateWorksheetSheetMarkdownQuestionIdsFromPg(
  worksheetId: string,
  contentMarkdown: string,
  questionIds: string[]
): Promise<{ error?: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  try {
    await pgQuery(
      `update public.worksheet_worksheets
       set content_markdown = $2,
           question_ids = $3::uuid[]
       where id = $1::uuid`,
      [worksheetId, contentMarkdown, questionIds]
    )
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export type WorksheetQuestionFullRowPg = {
  id: string
  type: string
  content_json: unknown
  difficulty: string | null
  source: string | null
  verified_at: string | null
}

export async function fetchWorksheetQuestionsFullByIdsFromPg(
  ids: string[]
): Promise<WorksheetQuestionFullRowPg[]> {
  if (!isPgConfigured() || ids.length === 0) return []
  try {
    return await pgQuery<WorksheetQuestionFullRowPg>(
      `select id::text,
              type::text,
              content_json,
              difficulty::text as difficulty,
              source::text as source,
              case when verified_at is null then null else verified_at::timestamptz::text end as verified_at
       from public.worksheet_questions
       where id = any($1::uuid[])`,
      [ids]
    )
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetQuestionsFullByIdsFromPg', e)
    return []
  }
}

export async function fetchLatestWorksheetIdQuestionIdsByCurriculumFromPg(
  curriculumId: string
): Promise<{ id: string; question_ids: string[] | null } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string; question_ids: string[] | null }>(
      `select id::text as id, question_ids
       from public.worksheet_worksheets
       where curriculum_id = $1::uuid
       order by created_at desc nulls last
       limit 1`,
      [curriculumId]
    )
    if (!row) return null
    const qids = (row.question_ids ?? []).map((x) => String(x))
    return { id: row.id, question_ids: qids.length ? qids : null }
  } catch (e) {
    console.error('[worksheet-pg] fetchLatestWorksheetIdQuestionIdsByCurriculumFromPg', e)
    return null
  }
}

export async function insertWorksheetSheetFromCreateFromPg(input: {
  userId: string | null
  curriculumId: string | null
  topic: string
  subjectId: string
  gradeLevelId: string
  contentMarkdown: string
  questionIds: string[]
}): Promise<{ id?: string; error?: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  try {
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.worksheet_worksheets
         (user_id, curriculum_id, topic, subject_id, grade_level_id, content_markdown, question_ids)
       values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::uuid[])
       returning id::text as id`,
      [
        input.userId,
        input.curriculumId,
        input.topic,
        input.subjectId,
        input.gradeLevelId,
        input.contentMarkdown,
        input.questionIds,
      ]
    )
    return { id: row?.id }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export type WorksheetSheetFullRowPg = Record<string, unknown>

export async function fetchWorksheetSheetFullByIdFromPg(
  worksheetId: string
): Promise<WorksheetSheetFullRowPg | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select id::text as id,
              user_id::text as user_id,
              topic,
              subject_id,
              grade_level_id,
              content_markdown,
              created_at::timestamptz::text as created_at,
              curriculum_id::text as curriculum_id,
              question_ids,
              coalesce(sgk_image_urls, array[]::text[]) as sgk_image_urls
       from public.worksheet_worksheets
       where id = $1::uuid`,
      [worksheetId]
    )
    if (!row) return null
    const qids = row.question_ids as string[] | null
    if (Array.isArray(qids)) {
      row.question_ids = qids.map((x) => String(x))
    }
    return row
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetSheetFullByIdFromPg', e)
    return null
  }
}

export async function listWorksheetSheetsFromPg(opts?: {
  subjectId?: string
  gradeLevelId?: string
  limit?: number
}): Promise<
  Array<{
    id: string
    topic: string
    subject_id: string
    grade_level_id: string
    created_at: string
    question_ids: string[] | null
  }>
> {
  if (!isPgConfigured()) return []
  const limit = Math.min(100, opts?.limit ?? 50)
  try {
    const params: unknown[] = []
    const whereParts: string[] = []
    if (opts?.subjectId) {
      params.push(opts.subjectId)
      whereParts.push(`subject_id = $${params.length}`)
    }
    if (opts?.gradeLevelId) {
      params.push(opts.gradeLevelId)
      whereParts.push(`grade_level_id = $${params.length}`)
    }
    params.push(limit)
    const limitIdx = params.length
    const whereSql = whereParts.length > 0 ? `where ${whereParts.join(' and ')}` : ''
    const rows = await pgQuery<{
      id: string
      topic: string
      subject_id: string
      grade_level_id: string
      created_at: string
      question_ids: string[] | null
    }>(
      `select id::text, topic, subject_id, grade_level_id,
              created_at::timestamptz::text as created_at,
              question_ids
       from public.worksheet_worksheets
       ${whereSql}
       order by created_at desc
       limit $${limitIdx}`,
      params
    )
    return rows.map((r) => ({
      ...r,
      question_ids: r.question_ids?.length ? r.question_ids.map((x) => String(x)) : null,
    }))
  } catch (e) {
    console.error('[worksheet-pg] listWorksheetSheetsFromPg', e)
    return []
  }
}

export async function fetchWorksheetSheetsByCurriculumFromPg(curriculumId: string): Promise<
  Array<{
    id: string
    topic: string
    subject_id: string
    grade_level_id: string
    content_markdown: string
    created_at: string
    question_ids: string[] | null
  }>
> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<{
      id: string
      topic: string
      subject_id: string
      grade_level_id: string
      content_markdown: string
      created_at: string
      question_ids: string[] | null
    }>(
      `select id::text, topic, subject_id, grade_level_id, content_markdown,
              created_at::timestamptz::text as created_at,
              question_ids
       from public.worksheet_worksheets
       where curriculum_id = $1::uuid
       order by created_at desc`,
      [curriculumId]
    )
    return rows.map((r) => ({
      ...r,
      question_ids: r.question_ids?.length ? r.question_ids.map((x) => String(x)) : null,
    }))
  } catch (e) {
    console.error('[worksheet-pg] fetchWorksheetSheetsByCurriculumFromPg', e)
    return []
  }
}

export async function deleteWorksheetWorksheetsByCurriculumIdFromPg(curriculumId: string): Promise<void> {
  if (!isPgConfigured()) {
    throw new Error('DATABASE_URL is not set')
  }
  await pgQuery(`delete from public.worksheet_worksheets where curriculum_id = $1::uuid`, [curriculumId])
}
