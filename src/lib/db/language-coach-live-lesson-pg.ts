import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

const MIN_QUALITY_PUBLISH = 75

export type LiveLessonSourceMessagePg = {
  id: string
  client_message_id: string | null
  role: string
  text: string | null
  audio_url: string | null
  translation: string | null
  main_sentence: string | null
  correction_note: string | null
  intent_answer: string | null
  tokens_json: string | null
  writing_task_json: string | null
  ai_payload_json: string | null
  teacher_label: string | null
  teacher_locale: string | null
  target_language: string | null
}

export async function fetchMessagesForLiveLessonCreatePg(
  userId: string,
  sessionId: string
): Promise<{ ok: true; rows: LiveLessonSourceMessagePg[] } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const rows = await pgQuery<LiveLessonSourceMessagePg>(
      `select
         id::text,
         client_message_id,
         role,
         text,
         audio_url,
         translation,
         main_sentence,
         correction_note,
         intent_answer,
         tokens_json,
         writing_task_json,
         ai_payload_json,
         teacher_label,
         teacher_locale,
         target_language
       from public.language_coach_messages
       where user_id = $1::uuid and session_id = $2::uuid
       order by created_at asc
       limit 500`,
      [userId, sessionId]
    )
    return { ok: true, rows }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-live-lesson-pg] fetchMessagesForLiveLessonCreatePg', e)
    return { ok: false, message: msg }
  }
}

export type TurnDiagnosticPg = {
  input_source: string | null
  speaking_mode: string | null
  had_corrections: boolean | null
  pronunciation_score: number | null
  pronunciation_accuracy: number | null
  pronunciation_fluency: number | null
  pronunciation_prosody: number | null
  weak_words_json: string | null
  word_scores_json: string | null
  inferred_meaning: string | null
  target_transcript: string | null
  native_transcript: string | null
  merged_transcript: string | null
  created_at: string | null
}

export async function fetchTurnDiagnosticsForSessionPg(
  userId: string,
  sessionId: string
): Promise<{ ok: true; rows: TurnDiagnosticPg[] } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const rows = await pgQuery<TurnDiagnosticPg>(
      `select
         input_source,
         speaking_mode,
         had_corrections,
         pronunciation_score,
         pronunciation_accuracy,
         pronunciation_fluency,
         pronunciation_prosody,
         weak_words_json,
         word_scores_json,
         inferred_meaning,
         target_transcript,
         native_transcript,
         merged_transcript,
         created_at::text
       from public.language_coach_turn_diagnostics
       where user_id = $1::uuid and session_id = $2
       order by created_at asc
       limit 1200`,
      [userId, sessionId]
    )
    return { ok: true, rows }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-live-lesson-pg] fetchTurnDiagnosticsForSessionPg', e)
    return { ok: false, message: msg }
  }
}

export type LiveLessonDraftUpsertInput = {
  sourceUserId: string
  sourceSessionId: string
  title: string
  topicId: string | null
  topicLabel: string | null
  targetLanguage: string | null
  nativeLanguage: string | null
  learnerLevel: number | null
  goalType: string | null
  estimatedMinutes: number
  durationBucket: string
  catalogKey: string
  teacherGender: string
  teacherLabel: string | null
  teacherLocale: string | null
  languagePairKey: string
  qualityScore: number
  qualityMetaJson: string
  priceCredits: number
  turnsCount: number
  updatedAtIso: string
}

export async function upsertLiveLessonDraftPg(
  input: LiveLessonDraftUpsertInput
): Promise<{ ok: true; id: string; status: string; approved: boolean } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const row = await pgQueryOne<{ id: string; status: string; approved: boolean }>(
      `insert into public.language_coach_live_lessons (
        source_user_id,
        source_session_id,
        title,
        topic_id,
        topic_label,
        target_language,
        native_language,
        learner_level,
        goal_type,
        estimated_minutes,
        duration_bucket,
        catalog_key,
        teacher_gender,
        teacher_label,
        teacher_locale,
        language_pair_key,
        quality_score,
        quality_meta_json,
        price_credits,
        turns_count,
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
        $16,
        $17,
        $18::numeric,
        $19,
        $20,
        $21::timestamptz
      )
      on conflict (source_user_id, source_session_id) do update set
        title = excluded.title,
        topic_id = excluded.topic_id,
        topic_label = excluded.topic_label,
        target_language = excluded.target_language,
        native_language = excluded.native_language,
        learner_level = excluded.learner_level,
        goal_type = excluded.goal_type,
        estimated_minutes = excluded.estimated_minutes,
        duration_bucket = excluded.duration_bucket,
        catalog_key = excluded.catalog_key,
        teacher_gender = excluded.teacher_gender,
        teacher_label = excluded.teacher_label,
        teacher_locale = excluded.teacher_locale,
        language_pair_key = excluded.language_pair_key,
        quality_score = excluded.quality_score,
        quality_meta_json = excluded.quality_meta_json,
        price_credits = excluded.price_credits,
        turns_count = excluded.turns_count,
        updated_at = excluded.updated_at
      returning id::text, status, approved`,
      [
        input.sourceUserId,
        input.sourceSessionId,
        input.title,
        input.topicId,
        input.topicLabel,
        input.targetLanguage,
        input.nativeLanguage,
        input.learnerLevel,
        input.goalType,
        input.estimatedMinutes,
        input.durationBucket,
        input.catalogKey,
        input.teacherGender,
        input.teacherLabel,
        input.teacherLocale,
        input.languagePairKey,
        input.qualityScore,
        input.qualityMetaJson,
        input.priceCredits,
        input.turnsCount,
        input.updatedAtIso,
      ]
    )
    if (!row) return { ok: false, message: 'Không lưu được bài Live.' }
    return { ok: true, id: row.id, status: row.status, approved: row.approved }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-live-lesson-pg] upsertLiveLessonDraftPg', e)
    return { ok: false, message: msg || 'Không lưu được bài Live.' }
  }
}

export async function deleteLiveLessonTurnsByLessonIdPg(lessonId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const pool = getPgPool()
    await pool.query(`delete from public.language_coach_live_lesson_turns where lesson_id = $1::uuid`, [lessonId])
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-live-lesson-pg] deleteLiveLessonTurnsByLessonIdPg', e)
    return { ok: false, message: msg }
  }
}

export type LiveLessonTurnInsertPg = {
  turnIndex: number
  sourceStudentDbMessageId: string | null
  sourceStudentClientMessageId: string | null
  sourceStudentText: string
  sourceStudentNorm: string
  sourceStudentAudioUrl: string | null
  standardizedStudentText: string
  standardizedStudentNorm: string
  teacherDbMessageId: string | null
  teacherReplyText: string
  teacherAudioUrl: string | null
  teacherTranslation: string | null
  teacherTokensJson: string | null
  teacherWritingTaskJson: string | null
  teacherMainSentence: string | null
  teacherCorrectionNote: string | null
  teacherIntentAnswer: string | null
  replayPayloadJson: string
}

export async function insertLiveLessonTurnsBatchPg(
  lessonId: string,
  turns: LiveLessonTurnInsertPg[]
): Promise<{ ok: true; ids: string[] } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  if (turns.length === 0) return { ok: true, ids: [] }
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    const ids: string[] = []
    for (const t of turns) {
      const r = await client.query<{ id: string }>(
        `insert into public.language_coach_live_lesson_turns (
          lesson_id,
          turn_index,
          source_student_db_message_id,
          source_student_client_message_id,
          source_student_text,
          source_student_norm,
          source_student_audio_url,
          standardized_student_text,
          standardized_student_norm,
          teacher_db_message_id,
          teacher_reply_text,
          teacher_audio_url,
          teacher_translation,
          teacher_tokens_json,
          teacher_writing_task_json,
          teacher_main_sentence,
          teacher_correction_note,
          teacher_intent_answer,
          replay_payload_json
        ) values (
          $1::uuid,
          $2,
          $3::uuid,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10::uuid,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17,
          $18,
          $19
        )
        returning id::text as id`,
        [
          lessonId,
          t.turnIndex,
          t.sourceStudentDbMessageId,
          t.sourceStudentClientMessageId,
          t.sourceStudentText,
          t.sourceStudentNorm,
          t.sourceStudentAudioUrl,
          t.standardizedStudentText,
          t.standardizedStudentNorm,
          t.teacherDbMessageId,
          t.teacherReplyText,
          t.teacherAudioUrl,
          t.teacherTranslation,
          t.teacherTokensJson,
          t.teacherWritingTaskJson,
          t.teacherMainSentence,
          t.teacherCorrectionNote,
          t.teacherIntentAnswer,
          t.replayPayloadJson,
        ]
      )
      const id = r.rows[0]?.id
      if (id) ids.push(id)
    }
    await client.query('commit')
    return { ok: true, ids }
  } catch (e) {
    await client.query('rollback').catch(() => {})
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-live-lesson-pg] insertLiveLessonTurnsBatchPg', e)
    return { ok: false, message: msg || 'Không lưu được turns.' }
  } finally {
    client.release()
  }
}

export async function updateLiveLessonTurnIdsPg(
  lessonId: string,
  turnIds: string[],
  updatedAtIso: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const pool = getPgPool()
    await pool.query(
      `update public.language_coach_live_lessons
       set turn_ids = $2::uuid[], updated_at = $3::timestamptz
       where id = $1::uuid`,
      [lessonId, turnIds.length > 0 ? turnIds : null, updatedAtIso]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-live-lesson-pg] updateLiveLessonTurnIdsPg', e)
    return { ok: false, message: msg }
  }
}

/** Một dòng lesson đủ cho GET ?lessonId= */
export type LiveLessonDetailRowPg = Record<string, unknown>

export async function fetchLiveLessonByIdPg(lessonId: string): Promise<{ ok: true; row: LiveLessonDetailRowPg | null } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const row = await pgQueryOne<LiveLessonDetailRowPg>(
      `select
         id::text,
         source_user_id::text,
         title,
         topic_id,
         topic_label,
         target_language,
         native_language,
         learner_level,
         goal_type,
         estimated_minutes,
         duration_bucket,
         catalog_key,
         teacher_gender,
         teacher_label,
         teacher_locale,
         language_pair_key,
         quality_score,
         quality_meta_json,
         price_credits,
         turns_count,
         status,
         approved,
         sales_count,
         published_at::text,
         created_at::text,
         turn_ids
       from public.language_coach_live_lessons
       where id = $1::uuid
       limit 1`,
      [lessonId]
    )
    return { ok: true, row }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-live-lesson-pg] fetchLiveLessonByIdPg', e)
    return { ok: false, message: msg }
  }
}

export async function hasLiveLessonPurchasePg(userId: string, lessonId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const row = await pgQueryOne<{ c: string }>(
      `select 1::text as c from public.language_coach_live_lesson_purchases
       where user_id = $1::uuid and lesson_id = $2::uuid limit 1`,
      [userId, lessonId]
    )
    return Boolean(row)
  } catch {
    return false
  }
}

export type LiveLessonTurnRowPg = Record<string, unknown>

export async function fetchLiveLessonTurnsByIdsPg(turnIds: string[]): Promise<{ ok: true; rows: LiveLessonTurnRowPg[] } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  if (turnIds.length === 0) return { ok: true, rows: [] }
  try {
    const rows = await pgQuery<LiveLessonTurnRowPg>(
      `select
         id::text,
         turn_index,
         source_student_text,
         source_student_audio_url,
         source_student_client_message_id,
         source_student_db_message_id::text,
         standardized_student_text,
         teacher_reply_text,
         teacher_audio_url,
         teacher_translation,
         teacher_tokens_json,
         teacher_writing_task_json,
         teacher_main_sentence,
         teacher_correction_note,
         teacher_intent_answer,
         teacher_db_message_id::text,
         replay_payload_json
       from public.language_coach_live_lesson_turns
       where id = any($1::uuid[])`,
      [turnIds]
    )
    return { ok: true, rows }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-live-lesson-pg] fetchLiveLessonTurnsByIdsPg', e)
    return { ok: false, message: msg }
  }
}

export async function fetchLiveLessonTurnsByLessonIdOrderedPg(
  lessonId: string
): Promise<{ ok: true; rows: LiveLessonTurnRowPg[] } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const rows = await pgQuery<LiveLessonTurnRowPg>(
      `select
         turn_index,
         source_student_text,
         source_student_audio_url,
         source_student_client_message_id,
         source_student_db_message_id::text,
         standardized_student_text,
         teacher_reply_text,
         teacher_audio_url,
         teacher_translation,
         teacher_tokens_json,
         teacher_writing_task_json,
         teacher_main_sentence,
         teacher_correction_note,
         teacher_intent_answer,
         teacher_db_message_id::text,
         replay_payload_json
       from public.language_coach_live_lesson_turns
       where lesson_id = $1::uuid
       order by turn_index asc`,
      [lessonId]
    )
    return { ok: true, rows }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-live-lesson-pg] fetchLiveLessonTurnsByLessonIdOrderedPg', e)
    return { ok: false, message: msg }
  }
}

export type ListLiveLessonsParams = {
  limit: number
  userId: string
  mine: boolean
  topicId?: string
  targetLanguage?: string
  nativeLanguage?: string
  goalType?: string
  durationBucket?: string
  learnerLevel?: number | null
}

export async function listLiveLessonsPg(
  p: ListLiveLessonsParams
): Promise<{ ok: true; rows: LiveLessonDetailRowPg[] } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const cond: string[] = []
    const vals: unknown[] = []
    let n = 1
    if (p.mine) {
      cond.push(`source_user_id = $${n++}::uuid`)
      vals.push(p.userId)
    } else {
      cond.push(`status = 'published'`)
      if (p.topicId) {
        cond.push(`topic_id = $${n++}`)
        vals.push(p.topicId)
      }
      if (p.targetLanguage) {
        cond.push(`target_language = $${n++}`)
        vals.push(p.targetLanguage)
      }
      if (p.nativeLanguage) {
        cond.push(`native_language = $${n++}`)
        vals.push(p.nativeLanguage)
      }
      if (p.goalType) {
        cond.push(`goal_type = $${n++}`)
        vals.push(p.goalType)
      }
      if (p.durationBucket === 'short' || p.durationBucket === 'medium' || p.durationBucket === 'long') {
        cond.push(`duration_bucket = $${n++}`)
        vals.push(p.durationBucket)
      }
      if (p.learnerLevel != null) {
        cond.push(`learner_level = $${n++}`)
        vals.push(p.learnerLevel)
      }
    }
    const limitPh = `$${n}`
    vals.push(p.limit)
    const rows = await pgQuery<LiveLessonDetailRowPg>(
      `select
         id::text,
         source_user_id::text,
         title,
         topic_id,
         topic_label,
         target_language,
         native_language,
         learner_level,
         goal_type,
         estimated_minutes,
         duration_bucket,
         catalog_key,
         teacher_gender,
         teacher_label,
         teacher_locale,
         language_pair_key,
         quality_score,
         price_credits,
         turns_count,
         status,
         approved,
         sales_count,
         published_at::text,
         created_at::text
       from public.language_coach_live_lessons
       where ${cond.join(' and ')}
       order by published_at desc nulls last, created_at desc
       limit ${limitPh}`,
      vals
    )
    return { ok: true, rows }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-live-lesson-pg] listLiveLessonsPg', e)
    return { ok: false, message: msg }
  }
}

export async function fetchPurchasedLessonIdsForUserPg(
  userId: string,
  lessonIds: string[]
): Promise<{ ok: true; ids: Set<string> } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  if (lessonIds.length === 0) return { ok: true, ids: new Set() }
  try {
    const rows = await pgQuery<{ lesson_id: string }>(
      `select lesson_id::text as lesson_id
       from public.language_coach_live_lesson_purchases
       where user_id = $1::uuid and lesson_id = any($2::uuid[])`,
      [userId, lessonIds]
    )
    return { ok: true, ids: new Set(rows.map((r) => r.lesson_id).filter(Boolean)) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-live-lesson-pg] fetchPurchasedLessonIdsForUserPg', e)
    return { ok: false, message: msg }
  }
}

export type PickRandomParams = {
  targetLanguage: string
  nativeLanguage: string
  topicId: string
  learnerLevel: number
  goalType?: string
  durationBucket?: 'short' | 'medium' | 'long' | null
}

export async function fetchLiveLessonPickRandomCandidatesPg(
  p: PickRandomParams
): Promise<{ ok: true; rows: LiveLessonDetailRowPg[] } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const cond: string[] = [
      `status = 'published'`,
      `target_language = $1`,
      `native_language = $2`,
      `topic_id = $3`,
      `learner_level = $4`,
      `quality_score >= ${MIN_QUALITY_PUBLISH}`,
    ]
    const vals: unknown[] = [p.targetLanguage, p.nativeLanguage, p.topicId, p.learnerLevel]
    let n = 5
    if (p.goalType) {
      cond.push(`goal_type = $${n++}`)
      vals.push(p.goalType)
    }
    if (p.durationBucket === 'short' || p.durationBucket === 'medium' || p.durationBucket === 'long') {
      cond.push(`duration_bucket = $${n++}`)
      vals.push(p.durationBucket)
    }
    vals.push(60)
    const lim = `$${n}`
    const rows = await pgQuery<LiveLessonDetailRowPg>(
      `select
         id::text,
         title,
         topic_id,
         topic_label,
         target_language,
         native_language,
         learner_level,
         goal_type,
         estimated_minutes,
         duration_bucket,
         catalog_key,
         quality_score,
         price_credits,
         turns_count,
         sales_count
       from public.language_coach_live_lessons
       where ${cond.join(' and ')}
       order by quality_score desc, sales_count desc
       limit ${lim}`,
      vals
    )
    return { ok: true, rows }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-live-lesson-pg] fetchLiveLessonPickRandomCandidatesPg', e)
    return { ok: false, message: msg }
  }
}

export async function fetchRecentLessonStartsPg(
  userId: string,
  candidateLessonIds: string[]
): Promise<{ ok: true; lessonIds: string[] } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  if (candidateLessonIds.length === 0) return { ok: true, lessonIds: [] }
  try {
    const rows = await pgQuery<{ lesson_id: string }>(
      `select lesson_id::text as lesson_id
       from public.language_coach_live_lesson_starts
       where user_id = $1::uuid and lesson_id = any($2::uuid[])
       order by started_at desc
       limit 8`,
      [userId, candidateLessonIds]
    )
    return { ok: true, lessonIds: rows.map((r) => r.lesson_id).filter(Boolean) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-live-lesson-pg] fetchRecentLessonStartsPg', e)
    return { ok: false, message: msg }
  }
}

export async function insertLiveLessonStartPg(
  lessonId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const pool = getPgPool()
    await pool.query(
      `insert into public.language_coach_live_lesson_starts (lesson_id, user_id)
       values ($1::uuid, $2::uuid)`,
      [lessonId, userId]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-live-lesson-pg] insertLiveLessonStartPg', e)
    return { ok: false, message: msg }
  }
}

export async function fetchLessonForPublishValidatePg(
  lessonId: string
): Promise<{ ok: true; row: LiveLessonDetailRowPg | null } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const row = await pgQueryOne<LiveLessonDetailRowPg>(
      `select id::text, source_user_id::text, quality_score, turns_count, status
       from public.language_coach_live_lessons
       where id = $1::uuid
       limit 1`,
      [lessonId]
    )
    return { ok: true, row }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg }
  }
}

export async function updateLiveLessonPublishedPg(
  lessonId: string,
  nowIso: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const pool = getPgPool()
    await pool.query(
      `update public.language_coach_live_lessons
       set status = 'published', approved = true, published_at = $2::timestamptz, updated_at = $2::timestamptz
       where id = $1::uuid`,
      [lessonId, nowIso]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg }
  }
}

export async function fetchLessonForPurchasePg(lessonId: string): Promise<{
  ok: true
  row: LiveLessonDetailRowPg | null
} | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const row = await pgQueryOne<LiveLessonDetailRowPg>(
      `select id::text, source_user_id::text, title, price_credits, status, sales_count
       from public.language_coach_live_lessons
       where id = $1::uuid and status = 'published'
       limit 1`,
      [lessonId]
    )
    return { ok: true, row }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg }
  }
}

export async function insertLiveLessonPurchasePg(
  lessonId: string,
  userId: string,
  paidCredits: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const pool = getPgPool()
    await pool.query(
      `insert into public.language_coach_live_lesson_purchases (lesson_id, user_id, paid_credits)
       values ($1::uuid, $2::uuid, $3)`,
      [lessonId, userId, paidCredits]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-live-lesson-pg] insertLiveLessonPurchasePg', e)
    return { ok: false, message: msg }
  }
}

export async function bumpLiveLessonSalesPg(
  lessonId: string,
  salesCount: number,
  nowIso: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const pool = getPgPool()
    await pool.query(
      `update public.language_coach_live_lessons
       set sales_count = $2, last_sold_at = $3::timestamptz, updated_at = $3::timestamptz
       where id = $1::uuid`,
      [lessonId, salesCount, nowIso]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg }
  }
}

export async function fetchLessonForMatchTurnPg(lessonId: string): Promise<{ ok: true; row: LiveLessonDetailRowPg | null } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const row = await pgQueryOne<LiveLessonDetailRowPg>(
      `select
         id::text,
         source_user_id::text,
         topic_id,
         target_language,
         native_language,
         teacher_gender,
         teacher_label,
         teacher_locale,
         price_credits,
         turns_count,
         status,
         turn_ids
       from public.language_coach_live_lessons
       where id = $1::uuid
       limit 1`,
      [lessonId]
    )
    return { ok: true, row }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg }
  }
}

export async function fetchMatchTurnByIdPg(turnId: string): Promise<{ ok: true; row: LiveLessonTurnRowPg | null } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const row = await pgQueryOne<LiveLessonTurnRowPg>(
      `select
         turn_index,
         source_student_text,
         standardized_student_text,
         standardized_student_norm,
         teacher_reply_text,
         teacher_audio_url,
         teacher_translation,
         teacher_tokens_json,
         teacher_writing_task_json,
         teacher_main_sentence,
         teacher_correction_note,
         teacher_intent_answer,
         replay_payload_json
       from public.language_coach_live_lesson_turns
       where id = $1::uuid
       limit 1`,
      [turnId]
    )
    return { ok: true, row }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg }
  }
}

export async function fetchMatchTurnByLessonIndexPg(
  lessonId: string,
  turnIndex: number
): Promise<{ ok: true; row: LiveLessonTurnRowPg | null } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const row = await pgQueryOne<LiveLessonTurnRowPg>(
      `select
         turn_index,
         source_student_text,
         standardized_student_text,
         standardized_student_norm,
         teacher_reply_text,
         teacher_audio_url,
         teacher_translation,
         teacher_tokens_json,
         teacher_writing_task_json,
         teacher_main_sentence,
         teacher_correction_note,
         teacher_intent_answer,
         replay_payload_json
       from public.language_coach_live_lesson_turns
       where lesson_id = $1::uuid and turn_index = $2
       limit 1`,
      [lessonId, turnIndex]
    )
    return { ok: true, row }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg }
  }
}

export async function fetchLessonForAssistWordPg(
  lessonId: string
): Promise<{ ok: true; row: LiveLessonDetailRowPg | null } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const row = await pgQueryOne<LiveLessonDetailRowPg>(
      `select id::text, source_user_id::text, target_language, native_language, price_credits, status
       from public.language_coach_live_lessons
       where id = $1::uuid
       limit 1`,
      [lessonId]
    )
    return { ok: true, row }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg }
  }
}

export type DailyWordAssistRowPg = {
  word: string
  meaning: string | null
  pronunciation: string | null
  example_target: string | null
  example_native: string | null
  meaning_items_json: string | null
  example_items_json: string | null
  usage_level: string | null
  importance_score: number | null
  is_context_sensitive: boolean | null
  target_language: string | null
}

export async function fetchDailyWordForAssistPg(
  userId: string,
  word: string,
  targetLanguage: string
): Promise<{ ok: true; row: DailyWordAssistRowPg | null } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const row = await pgQueryOne<DailyWordAssistRowPg>(
      `select
         word,
         meaning,
         pronunciation,
         example_target,
         example_native,
         meaning_items_json,
         example_items_json,
         usage_level,
         importance_score,
         is_context_sensitive,
         target_language
       from public.language_coach_daily_words
       where user_id = $1::uuid and word = $2 and target_language = $3
       order by updated_at desc
       limit 1`,
      [userId, word, targetLanguage]
    )
    return { ok: true, row }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg }
  }
}

export async function upsertDailyWordFromLiveAssistPg(input: {
  userId: string
  sessionId: string
  learnedDate: string
  word: string
  targetLanguage: string
  nativeLanguage: string
  meaning: string | null
  pronunciation: string | null
  exampleTarget: string | null
  exampleNative: string | null
  meaningItemsJson: string | null
  exampleItemsJson: string | null
  usageLevel: string
  importanceScore: number
  isContextSensitive: boolean
  turnIndex: number
  updatedAtIso: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const pool = getPgPool()
    await pool.query(
      `insert into public.language_coach_daily_words (
        user_id,
        session_id,
        learned_date,
        word,
        target_language,
        native_language,
        meaning,
        pronunciation,
        example_target,
        example_native,
        meaning_items_json,
        example_items_json,
        usage_level,
        importance_score,
        is_context_sensitive,
        turn_index,
        updated_at
      ) values (
        $1::uuid,
        $2::uuid,
        $3::date,
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
        $16,
        $17::timestamptz
      )
      on conflict (user_id, session_id, word, target_language, turn_index) do update set
        learned_date = excluded.learned_date,
        native_language = excluded.native_language,
        meaning = excluded.meaning,
        pronunciation = excluded.pronunciation,
        example_target = excluded.example_target,
        example_native = excluded.example_native,
        meaning_items_json = excluded.meaning_items_json,
        example_items_json = excluded.example_items_json,
        usage_level = excluded.usage_level,
        importance_score = excluded.importance_score,
        is_context_sensitive = excluded.is_context_sensitive,
        updated_at = excluded.updated_at`,
      [
        input.userId,
        input.sessionId,
        input.learnedDate,
        input.word,
        input.targetLanguage,
        input.nativeLanguage,
        input.meaning,
        input.pronunciation,
        input.exampleTarget,
        input.exampleNative,
        input.meaningItemsJson,
        input.exampleItemsJson,
        input.usageLevel,
        input.importanceScore,
        input.isContextSensitive,
        input.turnIndex,
        input.updatedAtIso,
      ]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-live-lesson-pg] upsertDailyWordFromLiveAssistPg', e)
    return { ok: false, message: msg }
  }
}
