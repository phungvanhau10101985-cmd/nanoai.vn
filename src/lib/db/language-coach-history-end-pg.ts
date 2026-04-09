import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type CoachMessageEndRow = {
  id: string
  role: string
  text: string
  audio_url: string | null
  translation: string | null
  language_code: string | null
  target_language: string | null
  teacher_label: string | null
  teacher_locale: string | null
  mode: string
  main_sentence: string | null
  correction_note: string | null
  intent_answer: string | null
  tokens_json: string | null
  writing_task_json: string | null
  ai_payload_json: string | null
  created_at: string
}

export type CoachSessionMemoryEndRow = {
  target_language: string | null
  native_language: string | null
  learner_level: number | null
  topic_id: string | null
  topic_label: string | null
  learning_mode: string | null
  running_summary: string | null
  pinned_facts_json: string | null
}

export async function fetchMessagesForSessionEndPg(
  userId: string,
  sessionId: string
): Promise<{ ok: true; rows: CoachMessageEndRow[] } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const rows = await pgQuery<CoachMessageEndRow>(
      `select
         id::text,
         role,
         text,
         audio_url,
         translation,
         language_code,
         target_language,
         teacher_label,
         teacher_locale,
         mode,
         main_sentence,
         correction_note,
         intent_answer,
         tokens_json,
         writing_task_json,
         ai_payload_json,
         created_at::text
       from public.language_coach_messages
       where user_id = $1::uuid and session_id = $2::uuid
       order by created_at asc
       limit 1200`,
      [userId, sessionId]
    )
    return { ok: true, rows }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-history-end-pg] fetchMessagesForSessionEndPg', e)
    return { ok: false, message: msg || 'Không tải được dữ liệu buổi học để kết thúc.' }
  }
}

export async function fetchSessionMemoryForEndPg(
  userId: string,
  sessionId: string
): Promise<{ ok: true; row: CoachSessionMemoryEndRow | null } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const row = await pgQueryOne<CoachSessionMemoryEndRow>(
      `select
         target_language,
         native_language,
         learner_level,
         topic_id,
         topic_label,
         learning_mode,
         running_summary,
         pinned_facts_json
       from public.language_coach_session_memories
       where user_id = $1::uuid and session_id = $2::uuid
       limit 1`,
      [userId, sessionId]
    )
    return { ok: true, row }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-history-end-pg] fetchSessionMemoryForEndPg', e)
    return { ok: false, message: msg || 'Không tải được memory buổi học để kết thúc.' }
  }
}

export async function deletePresetTurnsForSessionPg(
  userId: string,
  sessionId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const pool = getPgPool()
    await pool.query(
      `delete from public.language_coach_preset_turns
       where source_user_id = $1::uuid and source_session_id = $2::uuid`,
      [userId, sessionId]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-history-end-pg] deletePresetTurnsForSessionPg', e)
    return { ok: false, message: msg }
  }
}

export async function insertPresetTurnPg(input: {
  turnIndex: number
  sourceUserId: string
  sourceSessionId: string
  reply: string
  expectedStudentText: string | null
  mainSentence: string | null
  correctionNote: string | null
  intentAnswer: string | null
  mustKnowText: string | null
  teacherLabel: string | null
  teacherLocale: string | null
  languageCode: string | null
  targetLanguage: string | null
  tokensJson: string | null
  writingTaskJson: string | null
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.language_coach_preset_turns (
        turn_index,
        source_user_id,
        source_session_id,
        reply,
        expected_student_text,
        main_sentence,
        correction_note,
        intent_answer,
        must_know_text,
        teacher_label,
        teacher_locale,
        language_code,
        target_language,
        tokens_json,
        writing_task_json
      ) values (
        $1, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      )
      returning id::text as id`,
      [
        input.turnIndex,
        input.sourceUserId,
        input.sourceSessionId,
        input.reply,
        input.expectedStudentText,
        input.mainSentence,
        input.correctionNote,
        input.intentAnswer,
        input.mustKnowText,
        input.teacherLabel,
        input.teacherLocale,
        input.languageCode,
        input.targetLanguage,
        input.tokensJson,
        input.writingTaskJson,
      ]
    )
    if (!row?.id) return { ok: false, message: 'Không tạo được preset turn.' }
    return { ok: true, id: row.id }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-history-end-pg] insertPresetTurnPg', e)
    return { ok: false, message: msg }
  }
}

export async function upsertCompletedLessonFromEndPg(input: {
  userId: string
  sessionId: string
  targetLanguage: string | null
  nativeLanguage: string | null
  learnerLevel: number
  languageCode: string | null
  mode: string | null
  learningMode: string
  topicId: string | null
  topicLabel: string | null
  teacherLabel: string | null
  teacherLocale: string | null
  totalMessages: number
  studentMessages: number
  teacherMessages: number
  startedAt: string | null
  endedAt: string
  durationSeconds: number
  completionReason: string
  summaryJson: string
  transcriptJson: string
  turnIds: string[] | null
  updatedAtIso: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const pool = getPgPool()
    await pool.query(
      `insert into public.language_coach_completed_lessons (
        user_id,
        session_id,
        target_language,
        native_language,
        learner_level,
        language_code,
        mode,
        learning_mode,
        topic_id,
        topic_label,
        teacher_label,
        teacher_locale,
        total_messages,
        student_messages,
        teacher_messages,
        started_at,
        ended_at,
        duration_seconds,
        completion_reason,
        summary_json,
        transcript_json,
        turn_ids,
        updated_at
      ) values (
        $1::uuid,
        $2::uuid,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16::timestamptz,
        $17::timestamptz,
        $18,
        $19,
        $20,
        $21,
        $22::uuid[],
        $23::timestamptz
      )
      on conflict (user_id, session_id) do update set
        target_language = excluded.target_language,
        native_language = excluded.native_language,
        learner_level = excluded.learner_level,
        language_code = excluded.language_code,
        mode = excluded.mode,
        learning_mode = excluded.learning_mode,
        topic_id = excluded.topic_id,
        topic_label = excluded.topic_label,
        teacher_label = excluded.teacher_label,
        teacher_locale = excluded.teacher_locale,
        total_messages = excluded.total_messages,
        student_messages = excluded.student_messages,
        teacher_messages = excluded.teacher_messages,
        started_at = excluded.started_at,
        ended_at = excluded.ended_at,
        duration_seconds = excluded.duration_seconds,
        completion_reason = excluded.completion_reason,
        summary_json = excluded.summary_json,
        transcript_json = excluded.transcript_json,
        turn_ids = excluded.turn_ids,
        updated_at = excluded.updated_at`,
      [
        input.userId,
        input.sessionId,
        input.targetLanguage,
        input.nativeLanguage,
        input.learnerLevel,
        input.languageCode,
        input.mode,
        input.learningMode,
        input.topicId,
        input.topicLabel,
        input.teacherLabel,
        input.teacherLocale,
        input.totalMessages,
        input.studentMessages,
        input.teacherMessages,
        input.startedAt,
        input.endedAt,
        input.durationSeconds,
        input.completionReason,
        input.summaryJson,
        input.transcriptJson,
        input.turnIds && input.turnIds.length > 0 ? input.turnIds : null,
        input.updatedAtIso,
      ]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-history-end-pg] upsertCompletedLessonFromEndPg', e)
    return { ok: false, message: msg || 'Không lưu được dữ liệu buổi học hoàn thành.' }
  }
}

export async function deleteCompletedLessonPg(
  userId: string,
  sessionId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const pool = getPgPool()
    await pool.query(
      `delete from public.language_coach_completed_lessons
       where user_id = $1::uuid and session_id = $2::uuid`,
      [userId, sessionId]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-history-end-pg] deleteCompletedLessonPg', e)
    return { ok: false, message: msg }
  }
}

export async function upsertEndedSessionPg(
  userId: string,
  sessionId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const pool = getPgPool()
    await pool.query(
      `insert into public.language_coach_ended_sessions (user_id, session_id)
       values ($1::uuid, $2::uuid)
       on conflict (user_id, session_id) do nothing`,
      [userId, sessionId]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-history-end-pg] upsertEndedSessionPg', e)
    return { ok: false, message: msg || 'Không đánh dấu kết thúc được.' }
  }
}
