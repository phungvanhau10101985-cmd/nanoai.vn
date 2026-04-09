import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

/** Đọc bộ nhớ buổi học (chat route). */
export async function fetchSessionMemoryForChatPg(
  userId: string,
  sessionId: string
): Promise<{ running_summary: string; pinned_facts_json: string } | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne(
      `select running_summary, pinned_facts_json
       from public.language_coach_session_memories
       where user_id = $1::uuid and session_id = $2::uuid
       limit 1`,
      [userId, sessionId]
    )
  } catch (e) {
    console.error('[language-coach-chat-pg] fetchSessionMemoryForChatPg', e)
    return null
  }
}

export async function upsertSessionMemoryChatPg(input: {
  userId: string
  sessionId: string
  targetLanguage: string
  nativeLanguage: string
  learnerLevel: number
  topicId: string | null
  topicLabel: string | null
  runningSummary: string
  pinnedFactsJson: string
  learningMode: string
  updatedAtIso: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const pool = getPgPool()
    await pool.query(
      `insert into public.language_coach_session_memories (
        user_id, session_id, target_language, native_language, learner_level,
        topic_id, topic_label, running_summary, pinned_facts_json, learning_mode, updated_at
      ) values (
        $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz
      )
      on conflict (user_id, session_id) do update set
        target_language = excluded.target_language,
        native_language = excluded.native_language,
        learner_level = excluded.learner_level,
        topic_id = excluded.topic_id,
        topic_label = excluded.topic_label,
        running_summary = excluded.running_summary,
        pinned_facts_json = excluded.pinned_facts_json,
        learning_mode = excluded.learning_mode,
        updated_at = excluded.updated_at`,
      [
        input.userId,
        input.sessionId,
        input.targetLanguage,
        input.nativeLanguage,
        input.learnerLevel,
        input.topicId,
        input.topicLabel,
        input.runningSummary,
        input.pinnedFactsJson,
        input.learningMode,
        input.updatedAtIso,
      ]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-chat-pg] upsertSessionMemoryChatPg', e)
    return { ok: false, message: msg }
  }
}

export async function countCreditEventsByTypePg(
  userId: string,
  sessionId: string,
  chargeType: string
): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const row = await pgQueryOne<{ c: string }>(
      `select count(*)::text as c
       from public.language_coach_credit_events
       where user_id = $1::uuid and session_id = $2::uuid and charge_type = $3`,
      [userId, sessionId, chargeType]
    )
    const n = Number(row?.c ?? 0)
    return { ok: true, count: Number.isFinite(n) ? n : 0 }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg }
  }
}

export type DialogueReplayRowPg = Record<string, unknown>

export async function fetchDialogueReplayCandidatesPg(params: {
  teacherGender: string
  learnerLevel: number
  normalizedTopicId: string
  normalizedTopicLabel: string
  normalizedTargetLanguage: string
  normalizedNativeLanguage: string
  mode: string
  learningMode: string
  limit: number
}): Promise<{ ok: true; rows: DialogueReplayRowPg[] } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const rows = await pgQuery<DialogueReplayRowPg>(
      `select
         id::text as id,
         normalized_student_text,
         student_text,
         teacher_gender,
         learner_level,
         topic_id,
         normalized_topic_id,
         topic_label,
         normalized_topic_label,
         target_language,
         normalized_target_language,
         native_language,
         normalized_native_language,
         mode,
         learning_mode,
         reply,
         corrections_json,
         pronunciation_tips_json,
         correction_note,
         corrected_sentence,
         intent_answer,
         main_sentence,
         must_know_text,
         updated_at::text as updated_at,
         last_used_at::text as last_used_at,
         hit_count
       from public.language_coach_dialogue_replay_cache
       where teacher_gender = $1
         and learner_level = $2
         and normalized_topic_id = $3
         and normalized_topic_label = $4
         and normalized_target_language = $5
         and normalized_native_language = $6
         and mode = $7
         and learning_mode = $8
       order by updated_at desc
       limit $9`,
      [
        params.teacherGender,
        params.learnerLevel,
        params.normalizedTopicId,
        params.normalizedTopicLabel,
        params.normalizedTargetLanguage,
        params.normalizedNativeLanguage,
        params.mode,
        params.learningMode,
        params.limit,
      ]
    )
    return { ok: true, rows }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-chat-pg] fetchDialogueReplayCandidatesPg', e)
    return { ok: false, message: msg }
  }
}

export async function touchDialogueReplayHitPg(
  id: string,
  hitCount: number,
  nowIso: string
): Promise<void> {
  if (!isPgConfigured()) return
  try {
    const pool = getPgPool()
    await pool.query(
      `update public.language_coach_dialogue_replay_cache
       set last_used_at = $2::timestamptz, updated_at = $2::timestamptz, hit_count = $3
       where id = $1::uuid`,
      [id, nowIso, hitCount]
    )
  } catch (e) {
    console.warn('[language-coach-chat-pg] touchDialogueReplayHitPg', e)
  }
}

export async function upsertDialogueReplayCachePg(input: {
  studentText: string
  normalizedStudentText: string
  teacherGender: string
  learnerLevel: number
  topicId: string
  normalizedTopicId: string
  topicLabel: string
  normalizedTopicLabel: string
  targetLanguage: string
  normalizedTargetLanguage: string
  nativeLanguage: string
  normalizedNativeLanguage: string
  mode: string
  learningMode: string
  reply: string
  correctionsJson: string
  pronunciationTipsJson: string
  correctionNote: string | null
  correctedSentence: string | null
  intentAnswer: string | null
  mainSentence: string | null
  mustKnowText: string | null
  updatedAtIso: string
  lastUsedAtIso: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const pool = getPgPool()
    await pool.query(
      `insert into public.language_coach_dialogue_replay_cache (
        student_text, normalized_student_text, teacher_gender, learner_level,
        topic_id, normalized_topic_id, topic_label, normalized_topic_label,
        target_language, normalized_target_language, native_language, normalized_native_language,
        mode, learning_mode, reply, corrections_json, pronunciation_tips_json,
        correction_note, corrected_sentence, intent_answer, main_sentence, must_know_text,
        last_used_at, updated_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23::timestamptz, $24::timestamptz
      )
      on conflict (
        normalized_student_text,
        normalized_target_language,
        normalized_native_language,
        teacher_gender,
        mode,
        learning_mode,
        learner_level,
        normalized_topic_id,
        normalized_topic_label
      ) do update set
        student_text = excluded.student_text,
        topic_id = excluded.topic_id,
        topic_label = excluded.topic_label,
        target_language = excluded.target_language,
        native_language = excluded.native_language,
        reply = excluded.reply,
        corrections_json = excluded.corrections_json,
        pronunciation_tips_json = excluded.pronunciation_tips_json,
        correction_note = excluded.correction_note,
        corrected_sentence = excluded.corrected_sentence,
        intent_answer = excluded.intent_answer,
        main_sentence = excluded.main_sentence,
        must_know_text = excluded.must_know_text,
        last_used_at = excluded.last_used_at,
        updated_at = excluded.updated_at`,
      [
        input.studentText,
        input.normalizedStudentText,
        input.teacherGender,
        input.learnerLevel,
        input.topicId,
        input.normalizedTopicId,
        input.topicLabel,
        input.normalizedTopicLabel,
        input.targetLanguage,
        input.normalizedTargetLanguage,
        input.nativeLanguage,
        input.normalizedNativeLanguage,
        input.mode,
        input.learningMode,
        input.reply,
        input.correctionsJson,
        input.pronunciationTipsJson,
        input.correctionNote,
        input.correctedSentence,
        input.intentAnswer,
        input.mainSentence,
        input.mustKnowText,
        input.lastUsedAtIso,
        input.updatedAtIso,
      ]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-chat-pg] upsertDialogueReplayCachePg', e)
    return { ok: false, message: msg }
  }
}

export type RecallMessageRowPg = { role: string; text: string | null; created_at: string | null }

export async function fetchMessagesRecallCrossSessionPg(
  userId: string,
  excludeSessionId: string | null,
  limit: number
): Promise<{ ok: true; rows: RecallMessageRowPg[] } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    if (excludeSessionId) {
      const rows = await pgQuery<RecallMessageRowPg>(
        `select role, text, created_at::text as created_at
         from public.language_coach_messages
         where user_id = $1::uuid and session_id <> $2::uuid
         order by created_at desc
         limit $3`,
        [userId, excludeSessionId, limit]
      )
      return { ok: true, rows }
    }
    const rows = await pgQuery<RecallMessageRowPg>(
      `select role, text, created_at::text as created_at
       from public.language_coach_messages
       where user_id = $1::uuid
       order by created_at desc
       limit $2`,
      [userId, limit]
    )
    return { ok: true, rows }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-chat-pg] fetchMessagesRecallCrossSessionPg', e)
    return { ok: false, message: msg }
  }
}

export type PhraseCacheRowPg = {
  id: string
  target_sentence: string | null
  native_meaning: string | null
  pinyin: string | null
}

export async function fetchPhraseCacheRowPg(params: {
  normalizedSourceText: string
  normalizedTargetLanguage: string
  normalizedNativeLanguage: string
}): Promise<{ ok: true; row: PhraseCacheRowPg | null } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const row = await pgQueryOne<PhraseCacheRowPg>(
      `select id::text as id, target_sentence, native_meaning, pinyin
       from public.language_coach_phrase_cache
       where normalized_source_text = $1
         and normalized_target_language = $2
         and normalized_native_language = $3
       order by updated_at desc
       limit 1`,
      [params.normalizedSourceText, params.normalizedTargetLanguage, params.normalizedNativeLanguage]
    )
    return { ok: true, row }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg }
  }
}

export async function touchPhraseCacheUsagePg(id: string, nowIso: string): Promise<void> {
  if (!isPgConfigured()) return
  try {
    await pgQuery(
      `update public.language_coach_phrase_cache
       set last_used_at = $2::timestamptz, updated_at = $2::timestamptz
       where id = $1::uuid`,
      [id, nowIso]
    )
  } catch (e) {
    console.warn('[language-coach-chat-pg] touchPhraseCacheUsagePg', e)
  }
}

export async function updatePhraseCachePinyinPg(id: string, pinyin: string, nowIso: string): Promise<void> {
  if (!isPgConfigured()) return
  try {
    await pgQuery(
      `update public.language_coach_phrase_cache
       set pinyin = $2, updated_at = $3::timestamptz
       where id = $1::uuid`,
      [id, pinyin, nowIso]
    )
  } catch (e) {
    console.warn('[language-coach-chat-pg] updatePhraseCachePinyinPg', e)
  }
}

export async function upsertPhraseCachePg(input: {
  sourceText: string
  normalizedSourceText: string
  targetLanguage: string
  normalizedTargetLanguage: string
  nativeLanguage: string
  normalizedNativeLanguage: string
  targetSentence: string
  nativeMeaning: string | null
  pinyin: string | null
  sourceModel: string
  nowIso: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const pool = getPgPool()
    await pool.query(
      `insert into public.language_coach_phrase_cache (
        source_text, normalized_source_text, target_language, normalized_target_language,
        native_language, normalized_native_language, target_sentence, native_meaning, pinyin,
        source_model, last_used_at, updated_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $11::timestamptz)
      on conflict (normalized_source_text, normalized_target_language, normalized_native_language) do update set
        source_text = excluded.source_text,
        target_language = excluded.target_language,
        native_language = excluded.native_language,
        target_sentence = excluded.target_sentence,
        native_meaning = excluded.native_meaning,
        pinyin = excluded.pinyin,
        source_model = excluded.source_model,
        last_used_at = excluded.last_used_at,
        updated_at = excluded.updated_at`,
      [
        input.sourceText,
        input.normalizedSourceText,
        input.targetLanguage,
        input.normalizedTargetLanguage,
        input.nativeLanguage,
        input.normalizedNativeLanguage,
        input.targetSentence,
        input.nativeMeaning,
        input.pinyin,
        input.sourceModel,
        input.nowIso,
      ]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-chat-pg] upsertPhraseCachePg', e)
    return { ok: false, message: msg }
  }
}

export async function fetchPhraseCacheBatchByNormalizedSourcesPg(params: {
  normalizedTargetLanguage: string
  normalizedNativeLanguage: string
  normalizedSourceTexts: string[]
}): Promise<{ ok: true; rows: Array<{ normalized_source_text: string; pinyin: string | null; native_meaning: string | null }> } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  if (params.normalizedSourceTexts.length === 0) return { ok: true, rows: [] }
  try {
    const rows = await pgQuery<{
      normalized_source_text: string
      pinyin: string | null
      native_meaning: string | null
    }>(
      `select normalized_source_text, pinyin, native_meaning
       from public.language_coach_phrase_cache
       where normalized_target_language = $1
         and normalized_native_language = $2
         and normalized_source_text = any($3::text[])`,
      [params.normalizedTargetLanguage, params.normalizedNativeLanguage, params.normalizedSourceTexts]
    )
    return { ok: true, rows }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg }
  }
}
