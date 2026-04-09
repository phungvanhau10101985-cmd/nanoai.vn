import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type CustomTopicListRowPg = {
  topic_id: string
  topic_label: string
  topic_difficulty: string
  target_language: string
  native_language: string
  learner_level: number
}

export async function listSharedCustomTopicsPg(params: {
  normalizedTargetLanguage: string
  normalizedNativeLanguage: string
  learnerLevel: number
  limit: number
}): Promise<CustomTopicListRowPg[] | null> {
  if (!isPgConfigured()) return null
  const nt = params.normalizedTargetLanguage
  const nn = params.normalizedNativeLanguage
  try {
    if (nt && nn) {
      return await pgQuery(
        `select topic_id, topic_label, topic_difficulty, target_language, native_language, learner_level
         from public.language_coach_custom_topics
         where normalized_target_language = $1 and normalized_native_language = $2 and learner_level = $3
         order by updated_at desc
         limit $4`,
        [nt, nn, params.learnerLevel, params.limit]
      )
    }
    if (nt) {
      return await pgQuery(
        `select topic_id, topic_label, topic_difficulty, target_language, native_language, learner_level
         from public.language_coach_custom_topics
         where normalized_target_language = $1 and learner_level = $2
         order by updated_at desc
         limit $3`,
        [nt, params.learnerLevel, params.limit]
      )
    }
    if (nn) {
      return await pgQuery(
        `select topic_id, topic_label, topic_difficulty, target_language, native_language, learner_level
         from public.language_coach_custom_topics
         where normalized_native_language = $1 and learner_level = $2
         order by updated_at desc
         limit $3`,
        [nn, params.learnerLevel, params.limit]
      )
    }
    return await pgQuery(
      `select topic_id, topic_label, topic_difficulty, target_language, native_language, learner_level
       from public.language_coach_custom_topics
       where learner_level = $1
       order by updated_at desc
       limit $2`,
      [params.learnerLevel, params.limit]
    )
  } catch (e) {
    console.error('[language-coach-topics-pg] listSharedCustomTopicsPg', e)
    return null
  }
}

export async function upsertSharedCustomTopicPg(params: {
  userId: string
  rawTopic: string
  topicId: string
  topicLabel: string
  topicDifficulty: string
  targetLanguage: string
  nativeLanguage: string
  learnerLevel: number
  normalizedTopicId: string
  normalizedTargetLanguage: string
  normalizedNativeLanguage: string
  nowIso: string
}): Promise<{ topic_id: string; topic_label: string; topic_difficulty: string } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      topic_id: string
      topic_label: string
      topic_difficulty: string
    }>(
      `insert into public.language_coach_custom_topics (
         user_id, raw_topic, topic_id, topic_label, topic_difficulty,
         target_language, native_language, learner_level,
         normalized_topic_id, normalized_target_language, normalized_native_language,
         updated_at, last_used_at
       ) values (
         $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::timestamptz, $12::timestamptz
       )
       on conflict (normalized_topic_id, normalized_target_language, normalized_native_language, learner_level)
       do update set
         user_id = excluded.user_id,
         raw_topic = excluded.raw_topic,
         topic_id = excluded.topic_id,
         topic_label = excluded.topic_label,
         topic_difficulty = excluded.topic_difficulty,
         target_language = excluded.target_language,
         native_language = excluded.native_language,
         updated_at = excluded.updated_at,
         last_used_at = excluded.last_used_at
       returning topic_id, topic_label, topic_difficulty`,
      [
        params.userId,
        params.rawTopic,
        params.topicId,
        params.topicLabel,
        params.topicDifficulty,
        params.targetLanguage,
        params.nativeLanguage,
        params.learnerLevel,
        params.normalizedTopicId,
        params.normalizedTargetLanguage,
        params.normalizedNativeLanguage,
        params.nowIso,
      ]
    )
    return row ?? null
  } catch (e) {
    console.error('[language-coach-topics-pg] upsertSharedCustomTopicPg', e)
    return null
  }
}

export async function deleteCustomTopicsByNormalizedTopicIdPg(
  normalizedTopicId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    await pgQuery(`delete from public.language_coach_custom_topics where normalized_topic_id = $1`, [
      normalizedTopicId,
    ])
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-topics-pg] deleteCustomTopicsByNormalizedTopicIdPg', e)
    return { ok: false, message: msg }
  }
}

export type TopicCurriculumCacheRowPg = {
  id: string
  roleplay_role: string | null
  daily_quest: string | null
  objective: string | null
  keywords_json: string | null
  starter_sentences_json: string | null
  lesson_steps_json: string | null
  opening_line: string | null
  opening_question: string | null
}

export async function fetchTopicCurriculumCachePg(params: {
  normalizedTopicId: string
  normalizedTargetLanguage: string
  normalizedNativeLanguage: string
  learnerLevel: number
}): Promise<TopicCurriculumCacheRowPg | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne<TopicCurriculumCacheRowPg>(
      `select id::text, roleplay_role, daily_quest, objective, keywords_json, starter_sentences_json, lesson_steps_json,
              opening_line, opening_question
       from public.language_coach_topic_curricula
       where normalized_topic_id = $1 and normalized_target_language = $2
         and normalized_native_language = $3 and learner_level = $4
       limit 1`,
      [
        params.normalizedTopicId,
        params.normalizedTargetLanguage,
        params.normalizedNativeLanguage,
        params.learnerLevel,
      ]
    )
  } catch (e) {
    console.error('[language-coach-topics-pg] fetchTopicCurriculumCachePg', e)
    return null
  }
}

export async function touchTopicCurriculumLastUsedPg(id: string, nowIso: string): Promise<void> {
  if (!isPgConfigured()) return
  try {
    const pool = getPgPool()
    await pool.query(
      `update public.language_coach_topic_curricula
       set last_used_at = $2::timestamptz, updated_at = $2::timestamptz
       where id = $1::uuid`,
      [id, nowIso]
    )
  } catch (e) {
    console.warn('[language-coach-topics-pg] touchTopicCurriculumLastUsedPg', e)
  }
}

export async function upsertTopicCurriculumPg(params: {
  topicId: string
  topicLabel: string
  normalizedTopicId: string
  targetLanguage: string
  normalizedTargetLanguage: string
  nativeLanguage: string
  normalizedNativeLanguage: string
  learnerLevel: number
  roleplayRole: string
  dailyQuest: string
  objective: string
  keywordsJson: string
  starterSentencesJson: string
  lessonStepsJson: string
  openingLine: string | null
  openingQuestion: string | null
  sourceModel: string
  nowIso: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    await pgQuery(
      `insert into public.language_coach_topic_curricula (
         topic_id, topic_label, normalized_topic_id, target_language, normalized_target_language,
         native_language, normalized_native_language, learner_level,
         roleplay_role, daily_quest, objective,
         keywords_json, starter_sentences_json, lesson_steps_json,
         opening_line, opening_question, source_model, last_used_at, updated_at
       ) values (
         $1, $2, $3, $4, $5, $6, $7, $8,
         $9, $10, $11, $12, $13, $14,
         $15, $16, $17,
         $18::timestamptz, $18::timestamptz
       )
       on conflict (normalized_topic_id, normalized_target_language, normalized_native_language, learner_level)
       do update set
         topic_id = excluded.topic_id,
         topic_label = excluded.topic_label,
         target_language = excluded.target_language,
         native_language = excluded.native_language,
         roleplay_role = excluded.roleplay_role,
         daily_quest = excluded.daily_quest,
         objective = excluded.objective,
         keywords_json = excluded.keywords_json,
         starter_sentences_json = excluded.starter_sentences_json,
         lesson_steps_json = excluded.lesson_steps_json,
         opening_line = excluded.opening_line,
         opening_question = excluded.opening_question,
         source_model = excluded.source_model,
         last_used_at = excluded.last_used_at,
         updated_at = excluded.updated_at`,
      [
        params.topicId,
        params.topicLabel,
        params.normalizedTopicId,
        params.targetLanguage,
        params.normalizedTargetLanguage,
        params.nativeLanguage,
        params.normalizedNativeLanguage,
        params.learnerLevel,
        params.roleplayRole,
        params.dailyQuest,
        params.objective,
        params.keywordsJson,
        params.starterSentencesJson,
        params.lessonStepsJson,
        params.openingLine,
        params.openingQuestion,
        params.sourceModel,
        params.nowIso,
      ]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-topics-pg] upsertTopicCurriculumPg', e)
    return { ok: false, message: msg }
  }
}
