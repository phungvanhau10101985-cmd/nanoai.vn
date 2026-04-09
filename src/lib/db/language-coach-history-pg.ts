import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type HistorySessionMessagePg = {
  id: string
  session_id: string
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

export type HistorySessionMemoryBriefPg = {
  learning_mode: string | null
  topic_id: string | null
  topic_label: string | null
  pinned_facts_json: string | null
}

export type HistoryListMessagePg = {
  session_id: string
  role: string
  text: string
  language_code: string | null
  target_language: string | null
  teacher_label: string | null
  teacher_locale: string | null
  mode: string
  created_at: string
}

export type HistoryMemoryListPg = {
  session_id: string
  learning_mode: string | null
  topic_id: string | null
  topic_label: string | null
  target_language: string | null
  native_language: string | null
  pinned_facts_json: string | null
}

export async function fetchMessagesForHistorySessionPg(
  userId: string,
  sessionId: string
): Promise<{ ok: true; rows: HistorySessionMessagePg[] } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const rows = await pgQuery<HistorySessionMessagePg>(
      `select
         id::text,
         session_id::text,
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
       limit 500`,
      [userId, sessionId]
    )
    return { ok: true, rows }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-history-pg] fetchMessagesForHistorySessionPg', e)
    return { ok: false, message: msg || 'Không tải được buổi học.' }
  }
}

export async function fetchSessionMemoryBriefForHistoryPg(
  userId: string,
  sessionId: string
): Promise<{ ok: true; row: HistorySessionMemoryBriefPg | null } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const row = await pgQueryOne<HistorySessionMemoryBriefPg>(
      `select learning_mode, topic_id, topic_label, pinned_facts_json
       from public.language_coach_session_memories
       where user_id = $1::uuid and session_id = $2::uuid
       limit 1`,
      [userId, sessionId]
    )
    return { ok: true, row }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-history-pg] fetchSessionMemoryBriefForHistoryPg', e)
    return { ok: false, message: msg || 'Không tải được memory buổi học.' }
  }
}

export async function fetchMessagesForHistoryListPg(
  userId: string
): Promise<{ ok: true; rows: HistoryListMessagePg[] } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const rows = await pgQuery<HistoryListMessagePg>(
      `select
         session_id::text,
         role,
         text,
         language_code,
         target_language,
         teacher_label,
         teacher_locale,
         mode,
         created_at::text
       from public.language_coach_messages
       where user_id = $1::uuid
       order by created_at desc
       limit 1000`,
      [userId]
    )
    return { ok: true, rows }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-history-pg] fetchMessagesForHistoryListPg', e)
    return { ok: false, message: msg || 'Không tải được danh sách buổi học.' }
  }
}

export async function fetchSessionMemoriesForHistoryListPg(
  userId: string
): Promise<{ ok: true; rows: HistoryMemoryListPg[] } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const rows = await pgQuery<HistoryMemoryListPg>(
      `select
         session_id::text,
         learning_mode,
         topic_id,
         topic_label,
         target_language,
         native_language,
         pinned_facts_json
       from public.language_coach_session_memories
       where user_id = $1::uuid`,
      [userId]
    )
    return { ok: true, rows }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-history-pg] fetchSessionMemoriesForHistoryListPg', e)
    return { ok: false, message: msg || 'Không tải được danh sách buổi học.' }
  }
}

export async function fetchHiddenSessionIdsForUserPg(
  userId: string
): Promise<{ ok: true; sessionIds: string[] } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const rows = await pgQuery<{ session_id: string }>(
      `select session_id::text as session_id
       from public.language_coach_hidden_sessions
       where user_id = $1::uuid`,
      [userId]
    )
    return { ok: true, sessionIds: rows.map((r) => r.session_id).filter(Boolean) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-history-pg] fetchHiddenSessionIdsForUserPg', e)
    return { ok: false, message: msg }
  }
}

export async function fetchEndedSessionIdsForUserPg(
  userId: string
): Promise<{ ok: true; sessionIds: string[] } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const rows = await pgQuery<{ session_id: string }>(
      `select session_id::text as session_id
       from public.language_coach_ended_sessions
       where user_id = $1::uuid`,
      [userId]
    )
    return { ok: true, sessionIds: rows.map((r) => r.session_id).filter(Boolean) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-history-pg] fetchEndedSessionIdsForUserPg', e)
    return { ok: false, message: msg }
  }
}

export async function upsertHiddenSessionPg(
  userId: string,
  sessionId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const pool = getPgPool()
    await pool.query(
      `insert into public.language_coach_hidden_sessions (user_id, session_id)
       values ($1::uuid, $2::uuid)
       on conflict (user_id, session_id) do nothing`,
      [userId, sessionId]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-history-pg] upsertHiddenSessionPg', e)
    return { ok: false, message: msg || 'Không ẩn được buổi học.' }
  }
}

export async function insertHistoryMessagePg(input: {
  userId: string
  sessionId: string
  clientMessageId: string | null
  role: 'teacher' | 'student'
  text: string
  audioUrl: string | null
  languageCode: string | null
  targetLanguage: string | null
  teacherLabel: string | null
  teacherLocale: string | null
  mode: string
  mainSentence: string | null
  correctionNote: string | null
  intentAnswer: string | null
  tokensJson: string | null
  aiPayloadJson: string | null
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.language_coach_messages (
        user_id,
        session_id,
        client_message_id,
        role,
        text,
        audio_url,
        language_code,
        target_language,
        teacher_label,
        teacher_locale,
        mode,
        main_sentence,
        correction_note,
        intent_answer,
        tokens_json,
        ai_payload_json
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
        $16
      )
      returning id::text as id`,
      [
        input.userId,
        input.sessionId,
        input.clientMessageId,
        input.role,
        input.text,
        input.audioUrl,
        input.languageCode,
        input.targetLanguage,
        input.teacherLabel,
        input.teacherLocale,
        input.mode,
        input.mainSentence,
        input.correctionNote,
        input.intentAnswer,
        input.tokensJson,
        input.aiPayloadJson,
      ]
    )
    if (!row?.id) return { ok: false, message: 'Không lưu được lịch sử học.' }
    return { ok: true, id: row.id }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-history-pg] insertHistoryMessagePg', e)
    return { ok: false, message: msg || 'Không lưu được lịch sử học.' }
  }
}

export async function updateSessionMemoryMetadataPg(input: {
  userId: string
  sessionId: string
  targetLanguage: string
  nativeLanguage: string
  topicId: string | null
  topicLabel: string | null
  learningMode: string
  updatedAtIso: string
}): Promise<{ ok: true; updated: boolean } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const pool = getPgPool()
    const res = await pool.query(
      `update public.language_coach_session_memories
       set
         target_language = $3,
         native_language = $4,
         topic_id = $5,
         topic_label = $6,
         learning_mode = $7,
         updated_at = $8::timestamptz
       where user_id = $1::uuid and session_id = $2::uuid`,
      [
        input.userId,
        input.sessionId,
        input.targetLanguage,
        input.nativeLanguage,
        input.topicId,
        input.topicLabel,
        input.learningMode,
        input.updatedAtIso,
      ]
    )
    return { ok: true, updated: (res.rowCount ?? 0) > 0 }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-history-pg] updateSessionMemoryMetadataPg', e)
    return { ok: false, message: msg || 'Không cập nhật được metadata buổi học.' }
  }
}

export async function insertSessionMemoryMetadataPg(input: {
  userId: string
  sessionId: string
  targetLanguage: string
  nativeLanguage: string
  topicId: string | null
  topicLabel: string | null
  learningMode: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const pool = getPgPool()
    await pool.query(
      `insert into public.language_coach_session_memories (
        user_id,
        session_id,
        target_language,
        native_language,
        learner_level,
        topic_id,
        topic_label,
        learning_mode
      ) values (
        $1::uuid,
        $2::uuid,
        $3,
        $4,
        0,
        $5,
        $6,
        $7
      )`,
      [
        input.userId,
        input.sessionId,
        input.targetLanguage,
        input.nativeLanguage,
        input.topicId,
        input.topicLabel,
        input.learningMode,
      ]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-history-pg] insertSessionMemoryMetadataPg', e)
    return { ok: false, message: msg || 'Không tạo được metadata buổi học.' }
  }
}
