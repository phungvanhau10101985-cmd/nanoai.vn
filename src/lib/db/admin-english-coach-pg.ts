import { getPgPool, isPgConfigured } from '@/lib/db/pool'

export type AdminCompletedLessonRow = {
  id: string
  user_id: string
  session_id: string
  target_language: string | null
  native_language: string | null
  language_code: string | null
  learner_level: number | null
  topic_id: string | null
  topic_label: string | null
  teacher_label: string | null
  teacher_locale: string | null
  mode: string | null
  learning_mode: string | null
  total_messages: number | null
  duration_seconds: number | null
  ended_at: string | null
  completion_reason: string | null
  summary_json: string | null
}

export type AdminSessionMemoryPinnedRow = {
  user_id: string
  session_id: string
  pinned_facts_json: string | null
}

export async function pgListRecentCompletedLessonsForAdmin(
  limit: number
): Promise<{ rows: AdminCompletedLessonRow[]; error: string | null }> {
  if (!isPgConfigured()) {
    return { rows: [], error: 'DATABASE_URL not set' }
  }
  const lim = Math.min(500, Math.max(1, Math.floor(limit)))
  try {
    const pool = getPgPool()
    const res = await pool.query<AdminCompletedLessonRow>(
      `select id::text, user_id::text, session_id::text,
              target_language, native_language, language_code, learner_level,
              topic_id, topic_label, teacher_label, teacher_locale,
              mode, learning_mode, total_messages, duration_seconds,
              ended_at::text, completion_reason, summary_json
       from public.language_coach_completed_lessons
       order by ended_at desc nulls last
       limit $1`,
      [lim]
    )
    return { rows: res.rows, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { rows: [], error: msg }
  }
}

export async function pgListSessionMemoriesPinnedBySessionIds(
  sessionIds: string[]
): Promise<{ rows: AdminSessionMemoryPinnedRow[]; error: string | null }> {
  if (!isPgConfigured()) {
    return { rows: [], error: 'DATABASE_URL not set' }
  }
  const ids = [...new Set(sessionIds.map((s) => String(s || '').trim()).filter(Boolean))]
  if (ids.length === 0) return { rows: [], error: null }
  try {
    const pool = getPgPool()
    const res = await pool.query<AdminSessionMemoryPinnedRow>(
      `select user_id::text, session_id::text, pinned_facts_json
       from public.language_coach_session_memories
       where session_id::text = any($1::text[])
       limit 1000`,
      [ids]
    )
    return { rows: res.rows, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { rows: [], error: msg }
  }
}

export async function pgAdminDeleteCompletedLesson(lessonId: string): Promise<{ ok: true } | { error: string }> {
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL not set' }
  }
  const id = String(lessonId || '').trim()
  if (!id) return { error: 'Missing lesson id' }
  try {
    const pool = getPgPool()
    await pool.query(`delete from public.language_coach_completed_lessons where id = $1::uuid`, [id])
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
