import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'

export type CompletedLessonCandidateRow = {
  id: string
  user_id: string
  session_id: string
  target_language: string | null
  native_language: string | null
  learner_level: number
  topic_id: string | null
  topic_label: string | null
  mode: string | null
  learning_mode: string | null
  language_code: string | null
  teacher_label: string | null
  teacher_locale: string | null
  transcript_json: string | null
  summary_json: string | null
  turn_ids: string[] | null
}

export type PresetTurnRow = {
  id: string
  reply: string
  expected_student_text: string | null
  main_sentence: string | null
  correction_note: string | null
  intent_answer: string | null
  must_know_text: string | null
  teacher_label: string | null
  teacher_locale: string | null
  language_code: string | null
  target_language: string | null
  tokens_json: string | null
  writing_task_json: string | null
}

export async function fetchCompletedLessonCandidatesPg(
  currentUserId: string,
  learnerLevel: number,
  mode: string
): Promise<{ ok: true; rows: CompletedLessonCandidateRow[] } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const rows = await pgQuery<CompletedLessonCandidateRow>(
      `select
         id,
         user_id,
         session_id,
         target_language,
         native_language,
         learner_level,
         topic_id,
         topic_label,
         mode,
         learning_mode,
         language_code,
         teacher_label,
         teacher_locale,
         transcript_json,
         summary_json,
         turn_ids
       from public.language_coach_completed_lessons
       where user_id <> $1::uuid
         and learner_level = $2
         and learning_mode = 'review'
         and mode = $3
       order by ended_at desc nulls last
       limit 240`,
      [currentUserId, learnerLevel, mode]
    )
    return { ok: true, rows }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-completed-lesson-pg] fetchCompletedLessonCandidatesPg', e)
    return { ok: false, message: msg || 'Không đọc được bài học có sẵn.' }
  }
}

export async function fetchPresetTurnsByIdsPg(
  turnIds: string[]
): Promise<{ ok: true; rows: PresetTurnRow[] } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  if (turnIds.length === 0) return { ok: true, rows: [] }
  try {
    const rows = await pgQuery<PresetTurnRow>(
      `select
         id,
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
       from public.language_coach_preset_turns
       where id = any($1::uuid[])`,
      [turnIds]
    )
    return { ok: true, rows }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-completed-lesson-pg] fetchPresetTurnsByIdsPg', e)
    return { ok: false, message: msg || 'Không đọc được preset turns.' }
  }
}

export async function insertCoachOpeningMessagePg(input: {
  userId: string
  sessionId: string
  text: string
  audioUrl: string | null
  translation: string | null
  languageCode: string | null
  targetLanguage: string | null
  teacherLabel: string | null
  teacherLocale: string | null
  mode: string | null
  mainSentence: string | null
  correctionNote: string | null
  intentAnswer: string | null
  tokensJson: string | null
  writingTaskJson: string | null
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const pool = getPgPool()
    await pool.query(
      `insert into public.language_coach_messages (
        user_id,
        session_id,
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
        writing_task_json
      ) values (
        $1::uuid,
        $2::uuid,
        'teacher',
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        coalesce($10, 'chat'),
        $11,
        $12,
        $13,
        $14,
        $15
      )`,
      [
        input.userId,
        input.sessionId,
        input.text,
        input.audioUrl,
        input.translation,
        input.languageCode,
        input.targetLanguage,
        input.teacherLabel,
        input.teacherLocale,
        input.mode,
        input.mainSentence,
        input.correctionNote,
        input.intentAnswer,
        input.tokensJson,
        input.writingTaskJson,
      ]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-completed-lesson-pg] insertCoachOpeningMessagePg', e)
    return { ok: false, message: msg || 'Không copy được transcript bài có sẵn.' }
  }
}

export async function upsertSessionMemoryPresetCopyPg(input: {
  userId: string
  sessionId: string
  targetLanguage: string
  nativeLanguage: string
  learnerLevel: number
  topicId: string | null
  topicLabel: string | null
  learningMode: 'review' | 'reflex'
  runningSummary: string
  pinnedFactsJson: string
  updatedAtIso: string
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
        learning_mode,
        running_summary,
        pinned_facts_json,
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
        $11::timestamptz
      )
      on conflict (user_id, session_id) do update set
        target_language = excluded.target_language,
        native_language = excluded.native_language,
        learner_level = excluded.learner_level,
        topic_id = excluded.topic_id,
        topic_label = excluded.topic_label,
        learning_mode = excluded.learning_mode,
        running_summary = excluded.running_summary,
        pinned_facts_json = excluded.pinned_facts_json,
        updated_at = excluded.updated_at`,
      [
        input.userId,
        input.sessionId,
        input.targetLanguage,
        input.nativeLanguage,
        input.learnerLevel,
        input.topicId,
        input.topicLabel,
        input.learningMode,
        input.runningSummary,
        input.pinnedFactsJson,
        input.updatedAtIso,
      ]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-completed-lesson-pg] upsertSessionMemoryPresetCopyPg', e)
    return { ok: false, message: msg || 'Không tạo được memory cho buổi copy.' }
  }
}
