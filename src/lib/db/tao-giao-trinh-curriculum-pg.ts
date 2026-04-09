import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

/** Khớp `mode` trong `worksheet_curriculum_lesson_slides`. */
export type WorksheetCurriculumLessonSlideMode = 'shared' | 'original' | 'personal'

/** Một dòng outline tiết — khớp `LessonOutlineAIItem` trong tao-giao-trinh/actions. */
export type TaoGiaoTrinhLessonOutlineRow = {
  lessonNo: number
  title: string
  markdown: string
}

export async function fetchWorksheetSlidesContentJsonForCurriculumPg(
  curriculumId: string
): Promise<{ content_json: unknown } | null> {
  if (!isPgConfigured()) return null
  return pgQueryOne<{ content_json: unknown }>(
    `select content_json
     from public.worksheet_slides
     where curriculum_id = $1::uuid
     limit 1`,
    [curriculumId]
  )
}

export async function fetchUserCustomizedSlidesJsonForCurriculumPg(
  userId: string,
  curriculumId: string
): Promise<{ slides_json: unknown } | null> {
  if (!isPgConfigured()) return null
  return pgQueryOne<{ slides_json: unknown }>(
    `select slides_json
     from public.user_customized_slides
     where user_id = $1::uuid and curriculum_id = $2::uuid
     limit 1`,
    [userId, curriculumId]
  )
}

/**
 * Xóa toàn bộ tiết của giáo trình rồi chèn lại (khớp delete + insert cũ qua REST trước đây).
 */
export async function replaceWorksheetCurriculumLessonsPg(
  curriculumId: string,
  lessons: TaoGiaoTrinhLessonOutlineRow[]
): Promise<void> {
  if (!isPgConfigured()) {
    throw new Error('DATABASE_URL is not set')
  }
  if (!curriculumId || lessons.length === 0) return

  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query(`delete from public.worksheet_curriculum_lessons where curriculum_id = $1::uuid`, [curriculumId])
    for (const l of lessons) {
      const lessonJson = JSON.stringify({ lessonNo: l.lessonNo, title: l.title })
      await client.query(
        `insert into public.worksheet_curriculum_lessons
         (curriculum_id, lesson_no, lesson_title, lesson_markdown, lesson_json, updated_at)
         values ($1::uuid, $2::int, $3, $4, $5::jsonb, now())`,
        [curriculumId, l.lessonNo, l.title, l.markdown, lessonJson]
      )
    }
    await client.query('commit')
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {
      /* ignore */
    }
    throw e instanceof Error ? e : new Error(String(e))
  } finally {
    client.release()
  }
}

export async function deleteWorksheetCurriculumLessonSlidesByCurriculumIdPg(curriculumId: string): Promise<void> {
  if (!isPgConfigured()) {
    throw new Error('DATABASE_URL is not set')
  }
  await pgQuery(`delete from public.worksheet_curriculum_lesson_slides where curriculum_id = $1::uuid`, [curriculumId])
}

/** Đọc các tiết đã lưu — khớp `loadCurriculumLessonRows` trong actions. */
export type WorksheetCurriculumLessonMetaRowPg = {
  lesson_no: number
  lesson_title: string
  lesson_markdown: string
  lesson_json: unknown | null
}

export async function fetchWorksheetCurriculumLessonsForMetaPg(
  curriculumId: string
): Promise<WorksheetCurriculumLessonMetaRowPg[]> {
  if (!isPgConfigured()) return []
  try {
    return await pgQuery<WorksheetCurriculumLessonMetaRowPg>(
      `select lesson_no,
              lesson_title,
              lesson_markdown,
              lesson_json
       from public.worksheet_curriculum_lessons
       where curriculum_id = $1::uuid
       order by lesson_no asc`,
      [curriculumId]
    )
  } catch (e) {
    console.error('[tao-giao-trinh-curriculum-pg] fetchWorksheetCurriculumLessonsForMetaPg', e)
    return []
  }
}

/** `num_lessons` — khớp `loadExpectedLessonCount`. */
export async function fetchWorksheetCurriculumNumLessonsPg(curriculumId: string): Promise<number | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ num_lessons: number | null }>(
      `select num_lessons from public.worksheet_curricula where id = $1::uuid limit 1`,
      [curriculumId]
    )
    if (row?.num_lessons == null) return null
    return Number(row.num_lessons)
  } catch (e) {
    console.error('[tao-giao-trinh-curriculum-pg] fetchWorksheetCurriculumNumLessonsPg', e)
    return null
  }
}

/** Markdown + số tiết — khớp `rebuildLessonRowsForCurriculum`. */
export async function fetchWorksheetCurriculumMarkdownAndNumLessonsPg(
  curriculumId: string
): Promise<{ content_markdown: string; num_lessons: number | null } | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne<{ content_markdown: string; num_lessons: number | null }>(
      `select content_markdown, num_lessons
       from public.worksheet_curricula
       where id = $1::uuid
       limit 1`,
      [curriculumId]
    )
  } catch (e) {
    console.error('[tao-giao-trinh-curriculum-pg] fetchWorksheetCurriculumMarkdownAndNumLessonsPg', e)
    return null
  }
}

/** Xóa lịch sử chỉnh sửa bản chung cũ hơn mốc (khớp `.lt('created_at', cutoff)`). */
export async function deleteWorksheetSlideEditHistoryOlderThanPg(cutoffIso: string): Promise<void> {
  if (!isPgConfigured()) {
    throw new Error('DATABASE_URL is not set')
  }
  await pgQuery(`delete from public.worksheet_slide_edit_history where created_at < $1::timestamptz`, [cutoffIso])
}

function jsonbParam(value: unknown): string {
  return JSON.stringify(value ?? null)
}

/**
 * Cập nhật cache slide theo tiết; nếu chưa có hàng thì insert (khớp update + insert trong actions).
 */
export async function saveWorksheetCurriculumLessonSlidesCacheRowPg(opts: {
  curriculumId: string
  mode: WorksheetCurriculumLessonSlideMode
  lessonNo: number
  slidesJson: unknown
  userId: string
}): Promise<{ success?: true; error?: string }> {
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set' }
  }
  const j = jsonbParam(opts.slidesJson)
  try {
    let updated: { id: string }[]
    if (opts.mode === 'personal') {
      updated = await pgQuery<{ id: string }>(
        `update public.worksheet_curriculum_lesson_slides
         set slides_json = $1::jsonb, updated_at = now()
         where curriculum_id = $2::uuid and mode = $3::text and lesson_no = $4::int and user_id = $5::uuid
         returning id::text as id`,
        [j, opts.curriculumId, opts.mode, opts.lessonNo, opts.userId]
      )
    } else {
      updated = await pgQuery<{ id: string }>(
        `update public.worksheet_curriculum_lesson_slides
         set slides_json = $1::jsonb, updated_at = now()
         where curriculum_id = $2::uuid and mode = $3::text and lesson_no = $4::int and user_id is null
         returning id::text as id`,
        [j, opts.curriculumId, opts.mode, opts.lessonNo]
      )
    }
    if (updated.length > 0) return { success: true }

    await pgQuery(
      `insert into public.worksheet_curriculum_lesson_slides
       (curriculum_id, mode, user_id, lesson_no, slides_json, updated_at)
       values ($1::uuid, $2::text, $3::uuid, $4::int, $5::jsonb, now())`,
      [
        opts.curriculumId,
        opts.mode,
        opts.mode === 'personal' ? opts.userId : null,
        opts.lessonNo,
        j,
      ]
    )
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function fetchWorksheetCurriculumLessonSlidesRowsForLessonPg(
  curriculumId: string,
  lessonNo: number
): Promise<Array<{ mode: string; user_id: string | null; slides_json: unknown }>> {
  if (!isPgConfigured()) return []
  return pgQuery<{ mode: string; user_id: string | null; slides_json: unknown }>(
    `select mode::text as mode,
            user_id::text as user_id,
            slides_json
     from public.worksheet_curriculum_lesson_slides
     where curriculum_id = $1::uuid and lesson_no = $2::int`,
    [curriculumId, lessonNo]
  )
}

export async function fetchWorksheetCurriculumLessonSlidesJsonForLessonModePg(
  curriculumId: string,
  lessonNo: number,
  mode: WorksheetCurriculumLessonSlideMode,
  userId: string
): Promise<{ slides_json: unknown } | null> {
  if (!isPgConfigured()) return null
  if (mode === 'personal') {
    return pgQueryOne<{ slides_json: unknown }>(
      `select slides_json
       from public.worksheet_curriculum_lesson_slides
       where curriculum_id = $1::uuid and lesson_no = $2::int and mode = $3::text and user_id = $4::uuid`,
      [curriculumId, lessonNo, mode, userId]
    )
  }
  return pgQueryOne<{ slides_json: unknown }>(
    `select slides_json
     from public.worksheet_curriculum_lesson_slides
     where curriculum_id = $1::uuid and lesson_no = $2::int and mode = $3::text and user_id is null`,
    [curriculumId, lessonNo, mode]
  )
}

function jsonbStringify(value: unknown): string {
  return JSON.stringify(value ?? null)
}

/** Khớp `upsert` worksheet_slides theo `curriculum_id`. */
export async function upsertWorksheetSlidesRowPg(input: {
  curriculumId: string
  userId: string | null
  topic: string | null
  subjectId: string
  gradeLevelId: string
  contentJson: unknown
}): Promise<{ error?: string }> {
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set' }
  }
  try {
    const j = jsonbStringify(input.contentJson)
    await pgQuery(
      `insert into public.worksheet_slides
         (curriculum_id, user_id, topic, subject_id, grade_level_id, content_json)
       values ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb)
       on conflict (curriculum_id) do update set
         user_id = excluded.user_id,
         topic = excluded.topic,
         subject_id = excluded.subject_id,
         grade_level_id = excluded.grade_level_id,
         content_json = excluded.content_json`,
      [input.curriculumId, input.userId, input.topic, input.subjectId, input.gradeLevelId, j]
    )
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function insertWorksheetSlideEditHistoryPg(input: {
  curriculumId: string
  userId: string | null
  slidesJson: unknown
}): Promise<{ error?: string }> {
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set' }
  }
  try {
    await pgQuery(
      `insert into public.worksheet_slide_edit_history (curriculum_id, user_id, slides_json)
       values ($1::uuid, $2::uuid, $3::jsonb)`,
      [input.curriculumId, input.userId, jsonbStringify(input.slidesJson)]
    )
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function fetchWorksheetSlidesOriginalContentJsonPg(
  curriculumId: string
): Promise<{ content_json: unknown } | null> {
  if (!isPgConfigured()) return null
  return pgQueryOne<{ content_json: unknown }>(
    `select content_json
     from public.worksheet_slides_original
     where curriculum_id = $1::uuid
     limit 1`,
    [curriculumId]
  )
}

export type WorksheetSlideEditHistoryListRowPg = {
  id: string
  user_id: string | null
  slides_json: unknown
  created_at: string
}

export async function fetchWorksheetSlideEditHistoryRecentPg(
  curriculumId: string,
  cutoffIso: string,
  limit: number
): Promise<WorksheetSlideEditHistoryListRowPg[]> {
  if (!isPgConfigured()) return []
  return pgQuery<WorksheetSlideEditHistoryListRowPg>(
    `select id::text as id,
            user_id::text as user_id,
            slides_json,
            created_at::timestamptz::text as created_at
     from public.worksheet_slide_edit_history
     where curriculum_id = $1::uuid and created_at >= $2::timestamptz
     order by created_at desc
     limit $3`,
    [curriculumId, cutoffIso, limit]
  )
}

/** Một hàng `worksheet_slides` — dùng khi đồng bộ quiz giữa các bản. */
export type WorksheetSlidesRowMetaPg = {
  content_json: unknown
  topic: string | null
  subject_id: string | null
  grade_level_id: string | null
}

export async function fetchWorksheetSlidesRowMetaAndJsonPg(
  curriculumId: string
): Promise<WorksheetSlidesRowMetaPg | null> {
  if (!isPgConfigured()) return null
  return pgQueryOne<WorksheetSlidesRowMetaPg>(
    `select content_json,
            topic,
            subject_id::text as subject_id,
            grade_level_id::text as grade_level_id
     from public.worksheet_slides
     where curriculum_id = $1::uuid
     limit 1`,
    [curriculumId]
  )
}

export async function updateWorksheetSlidesContentByCurriculumPg(input: {
  curriculumId: string
  contentJson: unknown
  topic: string | null
  subjectId: string
  gradeLevelId: string
}): Promise<{ error?: string }> {
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set' }
  }
  try {
    await pgQuery(
      `update public.worksheet_slides
       set content_json = $2::jsonb,
           topic = $3,
           subject_id = $4,
           grade_level_id = $5
       where curriculum_id = $1::uuid`,
      [input.curriculumId, jsonbStringify(input.contentJson), input.topic, input.subjectId, input.gradeLevelId]
    )
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function updateWorksheetSlidesOriginalContentJsonPg(
  curriculumId: string,
  contentJson: unknown
): Promise<{ error?: string }> {
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set' }
  }
  try {
    await pgQuery(
      `update public.worksheet_slides_original
       set content_json = $2::jsonb
       where curriculum_id = $1::uuid`,
      [curriculumId, jsonbStringify(contentJson)]
    )
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function updateUserCustomizedSlidesJsonPg(
  userId: string,
  curriculumId: string,
  slidesJson: unknown
): Promise<{ error?: string }> {
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set' }
  }
  try {
    await pgQuery(
      `update public.user_customized_slides
       set slides_json = $3::jsonb,
           updated_at = now()
       where user_id = $1::uuid and curriculum_id = $2::uuid`,
      [userId, curriculumId, jsonbStringify(slidesJson)]
    )
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

/** Khớp upsert `user_customized_slides` (onConflict user_id, curriculum_id) như trước đây. */
export async function upsertUserCustomizedSlidesPg(
  userId: string,
  curriculumId: string,
  slidesJson: unknown
): Promise<{ error?: string }> {
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set' }
  }
  try {
    const j = jsonbStringify(slidesJson)
    await pgQuery(
      `insert into public.user_customized_slides (user_id, curriculum_id, slides_json, updated_at)
       values ($1::uuid, $2::uuid, $3::jsonb, now())
       on conflict (user_id, curriculum_id) do update set
         slides_json = excluded.slides_json,
         updated_at = now()`,
      [userId, curriculumId, j]
    )
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function insertUserCustomizedSlidesHistoryPg(
  userId: string,
  curriculumId: string,
  slidesJson: unknown
): Promise<{ error?: string }> {
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set' }
  }
  try {
    await pgQuery(
      `insert into public.user_customized_slides_history (user_id, curriculum_id, slides_json)
       values ($1::uuid, $2::uuid, $3::jsonb)`,
      [userId, curriculumId, jsonbStringify(slidesJson)]
    )
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteUserCustomizedSlidesHistoryOlderThanPg(
  userId: string,
  curriculumId: string,
  cutoffIso: string
): Promise<{ error?: string }> {
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set' }
  }
  try {
    await pgQuery(
      `delete from public.user_customized_slides_history
       where user_id = $1::uuid
         and curriculum_id = $2::uuid
         and created_at < $3::timestamptz`,
      [userId, curriculumId, cutoffIso]
    )
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export type UserCustomizedSlidesHistoryListRowPg = {
  id: string
  slides_json: unknown
  created_at: string
}

export async function listUserCustomizedSlidesHistoryRecentPg(
  userId: string,
  curriculumId: string,
  cutoffIso: string,
  limit: number
): Promise<UserCustomizedSlidesHistoryListRowPg[]> {
  if (!isPgConfigured()) return []
  try {
    return await pgQuery<UserCustomizedSlidesHistoryListRowPg>(
      `select id::text as id,
              slides_json,
              created_at::timestamptz::text as created_at
       from public.user_customized_slides_history
       where user_id = $1::uuid
         and curriculum_id = $2::uuid
         and created_at >= $3::timestamptz
       order by created_at desc
       limit $4`,
      [userId, curriculumId, cutoffIso, Math.min(50, Math.max(1, limit))]
    )
  } catch (e) {
    console.error('[tao-giao-trinh-curriculum-pg] listUserCustomizedSlidesHistoryRecentPg', e)
    return []
  }
}

export async function fetchUserCustomizedSlidesHistoryByIdPg(
  historyId: string,
  userId: string,
  curriculumId: string
): Promise<{ slides_json: unknown; created_at: string } | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne<{ slides_json: unknown; created_at: string }>(
      `select slides_json,
              created_at::timestamptz::text as created_at
       from public.user_customized_slides_history
       where id = $1::uuid
         and user_id = $2::uuid
         and curriculum_id = $3::uuid
       limit 1`,
      [historyId, userId, curriculumId]
    )
  } catch (e) {
    console.error('[tao-giao-trinh-curriculum-pg] fetchUserCustomizedSlidesHistoryByIdPg', e)
    return null
  }
}

/**
 * Xóa dữ liệu phát sinh của một giáo trình (một transaction) — khớp `clearCurriculumDerivedData` khi dùng Postgres.
 * Thứ tự: phiếu bài tập → lịch sử chỉnh slide → lịch sử bản riêng → bản riêng → cache slide theo tiết → outline tiết → slide gốc → slide chung.
 */
export async function runClearCurriculumDerivedDataPg(curriculumId: string): Promise<{ error?: string }> {
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set' }
  }
  const client = await getPgPool().connect()
  try {
    await client.query('begin')
    await client.query(`delete from public.worksheet_worksheets where curriculum_id = $1::uuid`, [curriculumId])
    await client.query(`delete from public.worksheet_slide_edit_history where curriculum_id = $1::uuid`, [curriculumId])
    await client.query(`delete from public.user_customized_slides_history where curriculum_id = $1::uuid`, [curriculumId])
    await client.query(`delete from public.user_customized_slides where curriculum_id = $1::uuid`, [curriculumId])
    await client.query(`delete from public.worksheet_curriculum_lesson_slides where curriculum_id = $1::uuid`, [curriculumId])
    await client.query(`delete from public.worksheet_curriculum_lessons where curriculum_id = $1::uuid`, [curriculumId])
    await client.query(`delete from public.worksheet_slides_original where curriculum_id = $1::uuid`, [curriculumId])
    await client.query(`delete from public.worksheet_slides where curriculum_id = $1::uuid`, [curriculumId])
    await client.query('commit')
    return {}
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {
      /* ignore */
    }
    return { error: e instanceof Error ? e.message : String(e) }
  } finally {
    client.release()
  }
}

/** Danh sách `curriculum_id` giáo trình user đã ẩn (soft delete). */
export async function fetchHiddenCurriculumIdsForUserPg(userId: string): Promise<string[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<{ curriculum_id: string }>(
      `select curriculum_id::text as curriculum_id
       from public.user_hidden_curricula
       where user_id = $1::uuid`,
      [userId]
    )
    return rows.map((r) => r.curriculum_id)
  } catch (e) {
    console.error('[tao-giao-trinh-curriculum-pg] fetchHiddenCurriculumIdsForUserPg', e)
    return []
  }
}

export type UserOpenedCurriculumRowPg = {
  curriculum_id: string
  opened_at: string
}

export async function fetchUserOpenedCurriculaRowsPg(
  userId: string,
  limit: number
): Promise<UserOpenedCurriculumRowPg[]> {
  if (!isPgConfigured()) return []
  try {
    return await pgQuery<UserOpenedCurriculumRowPg>(
      `select curriculum_id::text as curriculum_id,
              opened_at::timestamptz::text as opened_at
       from public.user_opened_curricula
       where user_id = $1::uuid
       order by opened_at desc
       limit $2`,
      [userId, limit]
    )
  } catch (e) {
    console.error('[tao-giao-trinh-curriculum-pg] fetchUserOpenedCurriculaRowsPg', e)
    return []
  }
}

/** Khớp upsert `user_opened_curricula` (cập nhật `opened_at` khi mở lại). */
export async function upsertUserOpenedCurriculumPg(
  userId: string,
  curriculumId: string,
  openedAtIso: string
): Promise<{ error?: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  try {
    await pgQuery(
      `insert into public.user_opened_curricula (user_id, curriculum_id, opened_at)
       values ($1::uuid, $2::uuid, $3::timestamptz)
       on conflict (user_id, curriculum_id)
       do update set opened_at = excluded.opened_at`,
      [userId, curriculumId, openedAtIso]
    )
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

/** Ẩn giáo trình — khớp upsert vào `user_hidden_curricula`. */
export async function upsertUserHiddenCurriculumPg(userId: string, curriculumId: string): Promise<{ error?: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  try {
    await pgQuery(
      `insert into public.user_hidden_curricula (user_id, curriculum_id)
       values ($1::uuid, $2::uuid)
       on conflict (user_id, curriculum_id) do nothing`,
      [userId, curriculumId]
    )
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

const CURRICULUM_LIST_SELECT = `id::text,
  topic,
  subject_id,
  grade_level_id,
  textbook_set_id,
  textbook_volume,
  lesson_number::float as lesson_number,
  lesson_type_id,
  num_lessons,
  lesson_duration_minutes,
  created_at::timestamptz::text as created_at`

export async function fetchWorksheetCurriculumRowByIdPg(id: string): Promise<Record<string, unknown> | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select * from public.worksheet_curricula where id = $1::uuid limit 1`,
      [id]
    )
    const row = rows[0] ?? null
    if (row?.id != null) row.id = String(row.id)
    if (row?.user_id != null) row.user_id = String(row.user_id)
    return row
  } catch (e) {
    console.error('[tao-giao-trinh-curriculum-pg] fetchWorksheetCurriculumRowByIdPg', e)
    return null
  }
}

export async function fetchWorksheetCurriculumUserIdPg(curriculumId: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ user_id: string | null }>(
      `select user_id::text as user_id from public.worksheet_curricula where id = $1::uuid limit 1`,
      [curriculumId]
    )
    return row?.user_id ?? null
  } catch (e) {
    console.error('[tao-giao-trinh-curriculum-pg] fetchWorksheetCurriculumUserIdPg', e)
    return null
  }
}

export async function listOwnCurriculaPg(opts: {
  userId: string
  subjectId?: string
  gradeLevelId?: string
  hiddenCurriculumIds: string[]
  limit: number
}): Promise<Record<string, unknown>[]> {
  if (!isPgConfigured()) return []
  try {
    return await pgQuery<Record<string, unknown>>(
      `select ${CURRICULUM_LIST_SELECT}
       from public.worksheet_curricula
       where user_id = $1::uuid
         and ($2::text is null or subject_id = $2)
         and ($3::text is null or grade_level_id = $3)
         and (cardinality($4::uuid[]) = 0 or not (id = any($4::uuid[])))
       order by created_at desc
       limit $5`,
      [
        opts.userId,
        opts.subjectId ?? null,
        opts.gradeLevelId ?? null,
        opts.hiddenCurriculumIds,
        opts.limit,
      ]
    )
  } catch (e) {
    console.error('[tao-giao-trinh-curriculum-pg] listOwnCurriculaPg', e)
    return []
  }
}

export async function fetchCurriculaByIdsPg(opts: {
  ids: string[]
  subjectId?: string
  gradeLevelId?: string
  hiddenCurriculumIds?: string[]
}): Promise<Record<string, unknown>[]> {
  if (!isPgConfigured() || opts.ids.length === 0) return []
  const hidden = opts.hiddenCurriculumIds ?? []
  try {
    return await pgQuery<Record<string, unknown>>(
      `select ${CURRICULUM_LIST_SELECT},
              user_id::text as user_id
       from public.worksheet_curricula
       where id = any($1::uuid[])
         and ($2::text is null or subject_id = $2)
         and ($3::text is null or grade_level_id = $3)
         and (cardinality($4::uuid[]) = 0 or not (id = any($4::uuid[])))`,
      [opts.ids, opts.subjectId ?? null, opts.gradeLevelId ?? null, hidden]
    )
  } catch (e) {
    console.error('[tao-giao-trinh-curriculum-pg] fetchCurriculaByIdsPg', e)
    return []
  }
}

export async function listCurriculaForExamPg(opts: {
  hiddenCurriculumIds: string[]
  subjectId?: string
  gradeLevelId?: string
  limit: number
}): Promise<Record<string, unknown>[]> {
  if (!isPgConfigured()) return []
  try {
    return await pgQuery<Record<string, unknown>>(
      `select ${CURRICULUM_LIST_SELECT},
              user_id::text as user_id
       from public.worksheet_curricula
       where ($1::text is null or subject_id = $1)
         and ($2::text is null or grade_level_id = $2)
         and (cardinality($3::uuid[]) = 0 or not (id = any($3::uuid[])))
       order by created_at desc
       limit $4`,
      [opts.subjectId ?? null, opts.gradeLevelId ?? null, opts.hiddenCurriculumIds, opts.limit]
    )
  } catch (e) {
    console.error('[tao-giao-trinh-curriculum-pg] listCurriculaForExamPg', e)
    return []
  }
}

export type TextbookLessonTitleMapRowPg = {
  subject_id: string
  grade_level_id: string
  textbook_set_id: string
  textbook_volume: string | null
  lesson_order: number
  title: string
}

export async function fetchTextbookLessonsForTitleMapPg(opts: {
  subjectIds: string[]
  gradeIds: string[]
  textbookIds: string[]
  lessonOrders: number[]
}): Promise<TextbookLessonTitleMapRowPg[]> {
  if (!isPgConfigured()) return []
  if (
    opts.subjectIds.length === 0 ||
    opts.gradeIds.length === 0 ||
    opts.textbookIds.length === 0 ||
    opts.lessonOrders.length === 0
  ) {
    return []
  }
  try {
    return await pgQuery<TextbookLessonTitleMapRowPg>(
      `select subject_id,
              grade_level_id,
              textbook_set_id,
              textbook_volume::text as textbook_volume,
              lesson_order::float as lesson_order,
              title
       from public.worksheet_textbook_lessons
       where subject_id = any($1::text[])
         and grade_level_id = any($2::text[])
         and textbook_set_id = any($3::text[])
         and lesson_order::numeric = any($4::numeric[])`,
      [opts.subjectIds, opts.gradeIds, opts.textbookIds, opts.lessonOrders]
    )
  } catch (e) {
    console.error('[tao-giao-trinh-curriculum-pg] fetchTextbookLessonsForTitleMapPg', e)
    return []
  }
}

export async function listTextbookLessonsPg(opts: {
  subjectId: string
  gradeLevelId: string
  textbookSetId: string
  textbookVolume?: string
}): Promise<Array<{ id: string; title: string; lesson_order: number; chapter_label: string | null }>> {
  if (!isPgConfigured()) return []
  try {
    const params: unknown[] = [opts.subjectId, opts.gradeLevelId, opts.textbookSetId]
    let volClause = ''
    if (opts.textbookVolume === '1' || opts.textbookVolume === '2') {
      volClause = ` and (textbook_volume = $4 or textbook_volume is null)`
      params.push(opts.textbookVolume)
    }
    return await pgQuery(
      `select id::text as id,
              title,
              lesson_order::float as lesson_order,
              chapter_label
       from public.worksheet_textbook_lessons
       where subject_id = $1
         and grade_level_id = $2
         and textbook_set_id = $3
         ${volClause}
       order by lesson_order asc`,
      params
    )
  } catch (e) {
    console.error('[tao-giao-trinh-curriculum-pg] listTextbookLessonsPg', e)
    return []
  }
}

/** Một dòng tiêu đề bài — khớp `loadLessonTitleFromDb` trong createCurriculum. */
export async function fetchTextbookLessonTitleByOrderPg(opts: {
  subjectId: string
  gradeLevelId: string
  textbookSetId: string
  lessonOrder: number
  textbookVolume?: string | null
}): Promise<string | null> {
  if (!isPgConfigured()) return null
  const vol = opts.textbookVolume
  try {
    const params: unknown[] = [opts.subjectId, opts.gradeLevelId, opts.textbookSetId, opts.lessonOrder]
    let volClause: string
    if (vol === '1' || vol === '2') {
      volClause = ` and (textbook_volume = $5 or textbook_volume is null)`
      params.push(vol)
    } else {
      volClause = ` and textbook_volume is null`
    }
    const row = await pgQueryOne<{ title: string }>(
      `select title
       from public.worksheet_textbook_lessons
       where subject_id = $1
         and grade_level_id = $2
         and textbook_set_id = $3
         and lesson_order = $4::numeric
         ${volClause}
       limit 1`,
      params
    )
    return row?.title ?? null
  } catch (e) {
    console.error('[tao-giao-trinh-curriculum-pg] fetchTextbookLessonTitleByOrderPg', e)
    return null
  }
}

/** Lưu một bài SGK từ ảnh nếu chưa có (volume null) — khớp saveTextbookLessonFromImage. */
export async function insertTextbookLessonFromImageIfMissingPg(opts: {
  subjectId: string
  gradeLevelId: string
  textbookSetId: string
  lessonNumber: number
  title: string
  titleNormalized: string
}): Promise<{ error?: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  try {
    const existing = await pgQueryOne<{ one: number }>(
      `select 1 as one
       from public.worksheet_textbook_lessons
       where subject_id = $1
         and grade_level_id = $2
         and textbook_set_id = $3
         and lesson_order = $4::numeric
         and textbook_volume is null
       limit 1`,
      [opts.subjectId, opts.gradeLevelId, opts.textbookSetId, opts.lessonNumber]
    )
    if (existing) return {}

    await pgQuery(
      `insert into public.worksheet_textbook_lessons
       (subject_id, grade_level_id, textbook_set_id, lesson_order, title, title_normalized)
       values ($1, $2, $3, $4::numeric, $5, $6)`,
      [
        opts.subjectId,
        opts.gradeLevelId,
        opts.textbookSetId,
        opts.lessonNumber,
        opts.title,
        opts.titleNormalized,
      ]
    )
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

/** Hàng khớp khi tạo giáo trình (filter DB rồi so khối JS: volume / lesson_number / ISBN). */
export type CurriculumCreateDuplicateRowPg = {
  id: string
  content_markdown: string
  textbook_volume: string | null
  lesson_number: number | null
  textbook_isbn: string | null
}

export async function fetchCurriculaForCreateDuplicateCheckPg(opts: {
  subjectId: string
  gradeLevelId: string
  textbookSetId: string
  lessonTypeId: string
  numLessons: number
  lessonDurationMinutes: number
  textbookIsbnWhenKhac: string | null
}): Promise<CurriculumCreateDuplicateRowPg[]> {
  if (!isPgConfigured()) return []
  const isbnFilter = opts.textbookSetId === 'khac' && opts.textbookIsbnWhenKhac ? opts.textbookIsbnWhenKhac : null
  try {
    return await pgQuery<CurriculumCreateDuplicateRowPg>(
      `select id::text as id,
              content_markdown,
              textbook_volume::text as textbook_volume,
              lesson_number::float as lesson_number,
              textbook_isbn::text as textbook_isbn
       from public.worksheet_curricula
       where subject_id = $1
         and grade_level_id = $2
         and textbook_set_id = $3
         and lesson_type_id = $4
         and num_lessons = $5
         and lesson_duration_minutes = $6
         and ($7::text is null or textbook_isbn = $7)
       limit 100`,
      [
        opts.subjectId,
        opts.gradeLevelId,
        opts.textbookSetId,
        opts.lessonTypeId,
        opts.numLessons,
        opts.lessonDurationMinutes,
        isbnFilter,
      ]
    )
  } catch (e) {
    console.error('[tao-giao-trinh-curriculum-pg] fetchCurriculaForCreateDuplicateCheckPg', e)
    return []
  }
}

export type InsertWorksheetCurriculumPgInput = {
  userId: string | null
  topic: string
  subjectId: string
  gradeLevelId: string
  textbookSetId: string
  textbookVolume: string | null
  textbookIsbn: string | null
  lessonNumber: number | null
  lessonTypeId: string
  numLessons: number
  lessonDurationMinutes: number
  goals: string | null
  contentMarkdown: string
  lessonTopics: string[] | null
}

export async function insertWorksheetCurriculumPg(
  input: InsertWorksheetCurriculumPgInput
): Promise<{ id: string } | { error: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  try {
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.worksheet_curricula (
         user_id, topic, subject_id, grade_level_id, textbook_set_id,
         textbook_volume, textbook_isbn, lesson_number, lesson_type_id,
         num_lessons, lesson_duration_minutes, goals, content_markdown, lesson_topics
       ) values (
         $1::uuid, $2, $3, $4, $5,
         $6, $7, $8::numeric, $9,
         $10, $11, $12, $13, $14::text[]
       )
       returning id::text as id`,
      [
        input.userId,
        input.topic,
        input.subjectId,
        input.gradeLevelId,
        input.textbookSetId,
        input.textbookVolume,
        input.textbookIsbn,
        input.lessonNumber,
        input.lessonTypeId,
        input.numLessons,
        input.lessonDurationMinutes,
        input.goals,
        input.contentMarkdown,
        input.lessonTopics,
      ]
    )
    if (!row?.id) return { error: 'Insert không trả id.' }
    return { id: row.id }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function updateWorksheetCurriculumSavePg(input: {
  curriculumId: string
  topic: string
  subjectId: string
  gradeLevelId: string
  textbookSetId: string
  textbookVolume: string | null
  textbookIsbn: string | null
  lessonNumber: number | null
  lessonTypeId: string
  numLessons: number
  lessonDurationMinutes: number
  goals: string | null
  contentMarkdown: string
}): Promise<{ error?: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  try {
    await pgQuery(
      `update public.worksheet_curricula
       set topic = $2,
           subject_id = $3,
           grade_level_id = $4,
           textbook_set_id = $5,
           textbook_volume = $6,
           textbook_isbn = $7,
           lesson_number = $8::numeric,
           lesson_type_id = $9,
           num_lessons = $10,
           lesson_duration_minutes = $11,
           goals = $12,
           content_markdown = $13
       where id = $1::uuid`,
      [
        input.curriculumId,
        input.topic,
        input.subjectId,
        input.gradeLevelId,
        input.textbookSetId,
        input.textbookVolume,
        input.textbookIsbn,
        input.lessonNumber,
        input.lessonTypeId,
        input.numLessons,
        input.lessonDurationMinutes,
        input.goals,
        input.contentMarkdown,
      ]
    )
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function updateWorksheetCurriculumContentMarkdownOnlyPg(
  curriculumId: string,
  contentMarkdown: string
): Promise<{ error?: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  try {
    await pgQuery(`update public.worksheet_curricula set content_markdown = $2 where id = $1::uuid`, [
      curriculumId,
      contentMarkdown,
    ])
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function deleteWorksheetCurriculumByIdPg(curriculumId: string): Promise<{ error?: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  try {
    await pgQuery(`delete from public.worksheet_curricula where id = $1::uuid`, [curriculumId])
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export type TopicModeCurriculumCandidatePg = {
  id: string
  topic: string
  created_at: string
}

export async function listCurriculaTopicModeCandidatesPg(
  subjectId: string,
  gradeLevelId: string,
  limit: number
): Promise<TopicModeCurriculumCandidatePg[]> {
  if (!isPgConfigured()) return []
  try {
    return await pgQuery<TopicModeCurriculumCandidatePg>(
      `select id::text as id,
              topic,
              created_at::timestamptz::text as created_at
       from public.worksheet_curricula
       where subject_id = $1
         and grade_level_id = $2
         and lesson_number is null
       order by created_at desc
       limit $3`,
      [subjectId, gradeLevelId, Math.min(200, Math.max(1, limit))]
    )
  } catch (e) {
    console.error('[tao-giao-trinh-curriculum-pg] listCurriculaTopicModeCandidatesPg', e)
    return []
  }
}

export async function fetchCurriculumContentTopicByIdPg(
  id: string
): Promise<{ id: string; content_markdown: string; topic: string } | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne<{ id: string; content_markdown: string; topic: string }>(
      `select id::text as id, content_markdown, topic
       from public.worksheet_curricula
       where id = $1::uuid
       limit 1`,
      [id]
    )
  } catch (e) {
    console.error('[tao-giao-trinh-curriculum-pg] fetchCurriculumContentTopicByIdPg', e)
    return null
  }
}

export async function findCurriculumTextbookExactMatchPg(opts: {
  subjectId: string
  gradeLevelId: string
  textbookSetId: string
  lessonTypeId: string
  numLessons: number
  lessonDurationMinutes: number
  lessonNumber: number
  textbookVolume?: string | null
  textbookIsbnWhenKhac: string | null
}): Promise<{ id: string; content_markdown: string; topic: string } | null> {
  if (!isPgConfigured()) return null
  const vol = opts.textbookVolume
  const isbnFilter = opts.textbookSetId === 'khac' ? opts.textbookIsbnWhenKhac : null
  try {
    let volClause: string
    const params: unknown[] = [
      opts.subjectId,
      opts.gradeLevelId,
      opts.textbookSetId,
      opts.lessonTypeId,
      opts.numLessons,
      opts.lessonDurationMinutes,
      opts.lessonNumber,
      isbnFilter,
    ]
    if (vol === '1' || vol === '2') {
      volClause = ` and textbook_volume = $9`
      params.push(vol)
    } else {
      volClause = ` and textbook_volume is null`
    }
    return await pgQueryOne<{ id: string; content_markdown: string; topic: string }>(
      `select id::text as id, content_markdown, topic
       from public.worksheet_curricula
       where subject_id = $1
         and grade_level_id = $2
         and textbook_set_id = $3
         and lesson_type_id = $4
         and num_lessons = $5
         and lesson_duration_minutes = $6
         and lesson_number = $7::numeric
         and ($8::text is null or textbook_isbn = $8)
         ${volClause}
       limit 1`,
      params
    )
  } catch (e) {
    console.error('[tao-giao-trinh-curriculum-pg] findCurriculumTextbookExactMatchPg', e)
    return null
  }
}

/** Admin duyệt đề xuất — cập nhật nội dung + tiêu đề. */
export async function updateWorksheetCurriculumTopicAndContentPg(
  curriculumId: string,
  topic: string,
  contentMarkdown: string
): Promise<{ error?: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  try {
    await pgQuery(
      `update public.worksheet_curricula
       set topic = $2, content_markdown = $3
       where id = $1::uuid`,
      [curriculumId, topic, contentMarkdown]
    )
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function insertWorksheetCurriculumAdminReviewPg(input: {
  userId: string | null
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
}): Promise<{ error?: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  try {
    await pgQuery(
      `insert into public.worksheet_curricula (
         user_id, topic, subject_id, grade_level_id, textbook_set_id,
         textbook_volume, lesson_number, lesson_type_id,
         num_lessons, lesson_duration_minutes, goals, content_markdown
       ) values (
         $1::uuid, $2, $3, $4, $5,
         $6, $7::numeric, $8,
         $9, $10, $11, $12
       )`,
      [
        input.userId,
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
      ]
    )
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

/** Hàng cho ghép câu ngân hàng vào giáo trình (khớp `getOfficialQuestions` trong actions). */
export type OfficialQuestionCurriculumRowPg = {
  question_text: string
  options: unknown
  correct_index: number
}

/**
 * Lấy câu từ `worksheet_official_questions` — tương đương truy vấn REST trước đây:
 * lọc theo topic_normalized khi `lessonTopics` có ít nhất 1 phần tử.
 */
export async function fetchOfficialQuestionsForCurriculumPg(
  subjectId: string,
  gradeLevelId: string,
  fetchLimit: number,
  lessonTopics?: string[]
): Promise<OfficialQuestionCurriculumRowPg[]> {
  if (!isPgConfigured()) return []
  const lim = Math.max(1, Math.min(2000, fetchLimit))
  try {
    if (lessonTopics && lessonTopics.length >= 1) {
      return await pgQuery<OfficialQuestionCurriculumRowPg>(
        `select question_text,
                options,
                correct_index
         from public.worksheet_official_questions
         where subject_id = $1
           and grade_level_id = $2
           and topic_normalized is not null
           and topic_normalized = any($3::text[])
         limit $4`,
        [subjectId, gradeLevelId, lessonTopics, lim]
      )
    }
    return await pgQuery<OfficialQuestionCurriculumRowPg>(
      `select question_text,
              options,
              correct_index
       from public.worksheet_official_questions
       where subject_id = $1
         and grade_level_id = $2
       limit $3`,
      [subjectId, gradeLevelId, lim]
    )
  } catch (e) {
    console.error('[tao-giao-trinh-curriculum-pg] fetchOfficialQuestionsForCurriculumPg', e)
    return []
  }
}
