import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type DailyWordListRowPg = Record<string, unknown>

/** Phiên "last/previous": session + ngày học mới nhất theo bộ lọc ngôn ngữ. */
export async function fetchLatestSessionMetaWordDailyPg(
  userId: string,
  targetLanguage?: string | null,
  nativeLanguage?: string | null
): Promise<{ session_id: string | null; learned_date: string | null } | null> {
  if (!isPgConfigured()) return null
  try {
    const cond: string[] = ['user_id = $1::uuid', 'session_id is not null']
    const vals: unknown[] = [userId]
    let n = 2
    if (targetLanguage) {
      cond.push(`target_language = $${n++}`)
      vals.push(targetLanguage)
    }
    if (nativeLanguage) {
      cond.push(`native_language = $${n++}`)
      vals.push(nativeLanguage)
    }
    return await pgQueryOne<{ session_id: string | null; learned_date: string | null }>(
      `select session_id::text as session_id, learned_date::text as learned_date
       from public.language_coach_daily_words
       where ${cond.join(' and ')}
       order by updated_at desc
       limit 1`,
      vals
    )
  } catch (e) {
    console.error('[language-coach-word-daily-pg] fetchLatestSessionMetaWordDailyPg', e)
    return null
  }
}

export async function fetchMaxLearnedDateWordDailyPg(
  userId: string,
  targetLanguage?: string | null,
  nativeLanguage?: string | null
): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const cond: string[] = ['user_id = $1::uuid']
    const vals: unknown[] = [userId]
    let n = 2
    if (targetLanguage) {
      cond.push(`target_language = $${n++}`)
      vals.push(targetLanguage)
    }
    if (nativeLanguage) {
      cond.push(`native_language = $${n++}`)
      vals.push(nativeLanguage)
    }
    const row = await pgQueryOne<{ d: string | null }>(
      `select learned_date::date::text as d
       from public.language_coach_daily_words
       where ${cond.join(' and ')}
       order by learned_date desc
       limit 1`,
      vals
    )
    return row?.d ?? null
  } catch (e) {
    console.error('[language-coach-word-daily-pg] fetchMaxLearnedDateWordDailyPg', e)
    return null
  }
}

export type ListDailyWordsParamsPg = {
  userId: string
  limit: number
  sessionId?: string | null
  learnedDate?: string | null
  fetchAllWords?: boolean
  targetLanguage?: string | null
  nativeLanguage?: string | null
  /** Khi có session + lượt học: (turn_index = -1 OR turn_index = n) */
  turnIndexOr?: { other: number } | null
}

export async function listDailyWordsForUserPg(
  p: ListDailyWordsParamsPg
): Promise<{ ok: true; rows: DailyWordListRowPg[] } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const cond: string[] = ['user_id = $1::uuid']
    const vals: unknown[] = [p.userId]
    let n = 2

    if (p.sessionId) {
      cond.push(`session_id = $${n++}::uuid`)
      vals.push(p.sessionId)
    } else if (!p.fetchAllWords && p.learnedDate) {
      cond.push(`learned_date = $${n++}::date`)
      vals.push(p.learnedDate)
    }

    if (p.targetLanguage) {
      cond.push(`target_language = $${n++}`)
      vals.push(p.targetLanguage)
    }
    if (p.nativeLanguage) {
      cond.push(`native_language = $${n++}`)
      vals.push(p.nativeLanguage)
    }
    if (p.turnIndexOr) {
      cond.push(`(turn_index = -1 or turn_index = $${n++})`)
      vals.push(p.turnIndexOr.other)
    }

    vals.push(p.limit)
    const limitPh = `$${n}`

    const rows = await pgQuery<DailyWordListRowPg>(
      `select
         id::text as id,
         session_id::text as session_id,
         learned_date::text as learned_date,
         word,
         target_language,
         native_language,
         meaning,
         pronunciation,
         pronunciation_audio_url,
         example_target,
         example_native,
         meaning_items_json,
         example_items_json,
         usage_level,
         importance_score,
         is_context_sensitive,
         turn_index,
         updated_at::text as updated_at
       from public.language_coach_daily_words
       where ${cond.join(' and ')}
       order by updated_at desc
       limit ${limitPh}`,
      vals
    )
    return { ok: true, rows }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-word-daily-pg] listDailyWordsForUserPg', e)
    return { ok: false, message: msg }
  }
}

export async function fetchSessionTargetLanguageFromMessagesPg(
  userId: string,
  sessionId: string
): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ target_language: string | null }>(
      `select target_language
       from public.language_coach_messages
       where user_id = $1::uuid and session_id = $2::uuid
         and target_language is not null
       order by created_at desc
       limit 1`,
      [userId, sessionId]
    )
    return row?.target_language != null ? String(row.target_language) : null
  } catch (e) {
    console.error('[language-coach-word-daily-pg] fetchSessionTargetLanguageFromMessagesPg', e)
    return null
  }
}

export type ExistingDailyMergeRowPg = {
  meaning: string | null
  pronunciation: string | null
  pronunciation_audio_url: string | null
  example_target: string | null
  example_native: string | null
  meaning_items_json: string | null
  example_items_json: string | null
  usage_level: string | null
  importance_score: number | null
  is_context_sensitive: boolean | null
}

export async function fetchExistingDailyWordForMergePg(params: {
  userId: string
  sessionId: string
  word: string
  turnIndex: number
  normalizedTargetLanguage: string | null
}): Promise<ExistingDailyMergeRowPg | null> {
  if (!isPgConfigured()) return null
  try {
    if (params.normalizedTargetLanguage) {
      return await pgQueryOne<ExistingDailyMergeRowPg>(
        `select
           meaning, pronunciation, pronunciation_audio_url, example_target, example_native,
           meaning_items_json, example_items_json, usage_level, importance_score, is_context_sensitive
         from public.language_coach_daily_words
         where user_id = $1::uuid and session_id = $2::uuid and word = $3 and turn_index = $4
           and target_language = $5
         limit 1`,
        [params.userId, params.sessionId, params.word, params.turnIndex, params.normalizedTargetLanguage]
      )
    }
    return await pgQueryOne<ExistingDailyMergeRowPg>(
      `select
         meaning, pronunciation, pronunciation_audio_url, example_target, example_native,
         meaning_items_json, example_items_json, usage_level, importance_score, is_context_sensitive
       from public.language_coach_daily_words
       where user_id = $1::uuid and session_id = $2::uuid and word = $3 and turn_index = $4
         and target_language is null
       limit 1`,
      [params.userId, params.sessionId, params.word, params.turnIndex]
    )
  } catch (e) {
    console.error('[language-coach-word-daily-pg] fetchExistingDailyWordForMergePg', e)
    return null
  }
}

export type ExistingReviewMergeRowPg = {
  id: string
  meaning: string | null
  pronunciation: string | null
  meaning_items_json: string | null
  example_items_json: string | null
  usage_level: string | null
  importance_score: number | null
  is_context_sensitive: boolean | null
}

export async function fetchExistingReviewQueueForMergePg(params: {
  userId: string
  word: string
  targetLanguage: string
}): Promise<ExistingReviewMergeRowPg | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne<ExistingReviewMergeRowPg>(
      `select
         id::text as id,
         meaning, pronunciation, meaning_items_json, example_items_json,
         usage_level, importance_score, is_context_sensitive
       from public.language_coach_review_queue
       where user_id = $1::uuid and word = $2 and target_language = $3
       limit 1`,
      [params.userId, params.word, params.targetLanguage]
    )
  } catch (e) {
    console.error('[language-coach-word-daily-pg] fetchExistingReviewQueueForMergePg', e)
    return null
  }
}

export async function upsertDailyWordFromWordDailyRoutePg(input: {
  userId: string
  sessionId: string
  learnedDate: string
  word: string
  targetLanguage: string | null
  nativeLanguage: string | null
  meaning: string | null
  pronunciation: string | null
  pronunciationAudioUrl: string | null
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
        user_id, session_id, learned_date, word, target_language, native_language,
        meaning, pronunciation, pronunciation_audio_url, example_target, example_native,
        meaning_items_json, example_items_json, usage_level, importance_score,
        is_context_sensitive, turn_index, updated_at
      ) values (
        $1::uuid, $2::uuid, $3::date, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::timestamptz
      )
      on conflict (user_id, session_id, word, target_language, turn_index) do update set
        learned_date = excluded.learned_date,
        native_language = excluded.native_language,
        meaning = excluded.meaning,
        pronunciation = excluded.pronunciation,
        pronunciation_audio_url = excluded.pronunciation_audio_url,
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
        input.pronunciationAudioUrl,
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
    console.error('[language-coach-word-daily-pg] upsertDailyWordFromWordDailyRoutePg', e)
    return { ok: false, message: msg }
  }
}

export async function upsertReviewQueueFromWordDailyPg(input: {
  userId: string
  word: string
  targetLanguage: string
  nativeLanguage: string | null
  meaning: string | null
  pronunciation: string | null
  meaningItemsJson: string | null
  exampleItemsJson: string | null
  usageLevel: string
  importanceScore: number
  isContextSensitive: boolean
  dueAtIso: string
  updatedAtIso: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const pool = getPgPool()
    await pool.query(
      `insert into public.language_coach_review_queue (
        user_id, word, target_language, native_language,
        meaning, pronunciation, meaning_items_json, example_items_json,
        usage_level, importance_score, is_context_sensitive, due_at, updated_at
      ) values (
        $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::timestamptz, $13::timestamptz
      )
      on conflict (user_id, word, target_language) do update set
        native_language = excluded.native_language,
        meaning = excluded.meaning,
        pronunciation = excluded.pronunciation,
        meaning_items_json = excluded.meaning_items_json,
        example_items_json = excluded.example_items_json,
        usage_level = excluded.usage_level,
        importance_score = excluded.importance_score,
        is_context_sensitive = excluded.is_context_sensitive,
        due_at = excluded.due_at,
        updated_at = excluded.updated_at`,
      [
        input.userId,
        input.word,
        input.targetLanguage,
        input.nativeLanguage,
        input.meaning,
        input.pronunciation,
        input.meaningItemsJson,
        input.exampleItemsJson,
        input.usageLevel,
        input.importanceScore,
        input.isContextSensitive,
        input.dueAtIso,
        input.updatedAtIso,
      ]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-word-daily-pg] upsertReviewQueueFromWordDailyPg', e)
    return { ok: false, message: msg }
  }
}

/** Chuẩn hóa từ thiếu senses / ví dụ (normalize_standard). */
export async function fetchDailyWordsEnrichmentPendingPg(userId: string): Promise<
  Array<{
    id: string
    word: string
    target_language: string | null
    native_language: string | null
    meaning: string | null
    meaning_items_json: string | null
    example_items_json: string | null
  }>
> {
  if (!isPgConfigured()) return []
  try {
    return await pgQuery(
      `select id::text as id, word, target_language, native_language, meaning, meaning_items_json, example_items_json
       from public.language_coach_daily_words
       where user_id = $1::uuid and coalesce(enrich_attempted, false) = false`,
      [userId]
    )
  } catch (e) {
    console.error('[language-coach-word-daily-pg] fetchDailyWordsEnrichmentPendingPg', e)
    return []
  }
}

export async function fetchReviewQueueEnrichmentPendingPg(userId: string): Promise<
  Array<{
    id: string
    word: string
    target_language: string | null
    native_language: string | null
    meaning: string | null
    meaning_items_json: string | null
    example_items_json: string | null
  }>
> {
  if (!isPgConfigured()) return []
  try {
    return await pgQuery(
      `select id::text as id, word, target_language, native_language, meaning, meaning_items_json, example_items_json
       from public.language_coach_review_queue
       where user_id = $1::uuid and coalesce(enrich_attempted, false) = false`,
      [userId]
    )
  } catch (e) {
    console.error('[language-coach-word-daily-pg] fetchReviewQueueEnrichmentPendingPg', e)
    return []
  }
}

export async function markDailyWordEnrichAttemptedPg(id: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(`update public.language_coach_daily_words set enrich_attempted = true where id = $1::uuid`, [id])
    return true
  } catch (e) {
    console.error('[language-coach-word-daily-pg] markDailyWordEnrichAttemptedPg', e)
    return false
  }
}

export async function markReviewQueueEnrichAttemptedPg(id: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(`update public.language_coach_review_queue set enrich_attempted = true where id = $1::uuid`, [id])
    return true
  } catch (e) {
    console.error('[language-coach-word-daily-pg] markReviewQueueEnrichAttemptedPg', e)
    return false
  }
}

export async function updateDailyWordAfterEnrichmentPg(input: {
  id: string
  meaning: string | null
  pronunciation: string | null
  meaningItemsJson: string | null
  exampleItemsJson: string | null
  usageLevel: string
  importanceScore: number
  isContextSensitive: boolean
  exampleTarget: string | null
  exampleNative: string | null
  updatedAtIso: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `update public.language_coach_daily_words
       set meaning = $2, pronunciation = $3, meaning_items_json = $4, example_items_json = $5,
           usage_level = $6, importance_score = $7, is_context_sensitive = $8,
           example_target = $9, example_native = $10, updated_at = $11::timestamptz
       where id = $1::uuid`,
      [
        input.id,
        input.meaning,
        input.pronunciation,
        input.meaningItemsJson,
        input.exampleItemsJson,
        input.usageLevel,
        input.importanceScore,
        input.isContextSensitive,
        input.exampleTarget,
        input.exampleNative,
        input.updatedAtIso,
      ]
    )
    return true
  } catch (e) {
    console.error('[language-coach-word-daily-pg] updateDailyWordAfterEnrichmentPg', e)
    return false
  }
}

export async function updateReviewQueueAfterEnrichmentPg(input: {
  id: string
  meaning: string | null
  pronunciation: string | null
  meaningItemsJson: string | null
  exampleItemsJson: string | null
  usageLevel: string
  importanceScore: number
  isContextSensitive: boolean
  updatedAtIso: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `update public.language_coach_review_queue
       set meaning = $2, pronunciation = $3, meaning_items_json = $4, example_items_json = $5,
           usage_level = $6, importance_score = $7, is_context_sensitive = $8, updated_at = $9::timestamptz
       where id = $1::uuid`,
      [
        input.id,
        input.meaning,
        input.pronunciation,
        input.meaningItemsJson,
        input.exampleItemsJson,
        input.usageLevel,
        input.importanceScore,
        input.isContextSensitive,
        input.updatedAtIso,
      ]
    )
    return true
  } catch (e) {
    console.error('[language-coach-word-daily-pg] updateReviewQueueAfterEnrichmentPg', e)
    return false
  }
}

export async function fetchDailyWordsMeaningFixPendingByUserPg(userId: string): Promise<
  Array<{
    id: string
    user_id: string
    word: string
    target_language: string | null
    native_language: string | null
    meaning: string | null
    meaning_items_json: string | null
  }>
> {
  if (!isPgConfigured()) return []
  try {
    return await pgQuery(
      `select id::text as id, user_id::text as user_id, word, target_language, native_language, meaning, meaning_items_json
       from public.language_coach_daily_words
       where user_id = $1::uuid and coalesce(meaning_fix_attempted, false) = false`,
      [userId]
    )
  } catch (e) {
    console.error('[language-coach-word-daily-pg] fetchDailyWordsMeaningFixPendingByUserPg', e)
    return []
  }
}

export async function fetchReviewQueueMeaningFixPendingByUserPg(userId: string): Promise<
  Array<{
    id: string
    user_id: string
    word: string
    target_language: string | null
    native_language: string | null
    meaning: string | null
    meaning_items_json: string | null
  }>
> {
  if (!isPgConfigured()) return []
  try {
    return await pgQuery(
      `select id::text as id, user_id::text as user_id, word, target_language, native_language, meaning, meaning_items_json
       from public.language_coach_review_queue
       where user_id = $1::uuid and coalesce(meaning_fix_attempted, false) = false`,
      [userId]
    )
  } catch (e) {
    console.error('[language-coach-word-daily-pg] fetchReviewQueueMeaningFixPendingByUserPg', e)
    return []
  }
}

export async function updateDailyWordMeaningLanguageFixPg(input: {
  id: string
  meaning: string | null
  meaningItemsJson: string | null
  exampleItemsJson: string | null
  usageLevel: string
  importanceScore: number
  isContextSensitive: boolean
  exampleTarget: string | null
  exampleNative: string | null
  updatedAtIso: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `update public.language_coach_daily_words
       set meaning = $2, meaning_items_json = $3, example_items_json = $4,
           usage_level = $5, importance_score = $6, is_context_sensitive = $7,
           example_target = $8, example_native = $9, updated_at = $10::timestamptz
       where id = $1::uuid`,
      [
        input.id,
        input.meaning,
        input.meaningItemsJson,
        input.exampleItemsJson,
        input.usageLevel,
        input.importanceScore,
        input.isContextSensitive,
        input.exampleTarget,
        input.exampleNative,
        input.updatedAtIso,
      ]
    )
    return true
  } catch (e) {
    console.error('[language-coach-word-daily-pg] updateDailyWordMeaningLanguageFixPg', e)
    return false
  }
}

export async function updateReviewQueueMeaningLanguageFixPg(input: {
  id: string
  meaning: string | null
  meaningItemsJson: string | null
  exampleItemsJson: string | null
  usageLevel: string
  importanceScore: number
  isContextSensitive: boolean
  updatedAtIso: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `update public.language_coach_review_queue
       set meaning = $2, meaning_items_json = $3, example_items_json = $4,
           usage_level = $5, importance_score = $6, is_context_sensitive = $7, updated_at = $8::timestamptz
       where id = $1::uuid`,
      [
        input.id,
        input.meaning,
        input.meaningItemsJson,
        input.exampleItemsJson,
        input.usageLevel,
        input.importanceScore,
        input.isContextSensitive,
        input.updatedAtIso,
      ]
    )
    return true
  } catch (e) {
    console.error('[language-coach-word-daily-pg] updateReviewQueueMeaningLanguageFixPg', e)
    return false
  }
}

export async function fetchDailyWordByIdForUserPg(
  userId: string,
  id: string
): Promise<{ id: string; word: string | null; target_language: string | null } | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne(
      `select id::text as id, word, target_language
       from public.language_coach_daily_words
       where id = $1::uuid and user_id = $2::uuid
       limit 1`,
      [id, userId]
    )
  } catch (e) {
    console.error('[language-coach-word-daily-pg] fetchDailyWordByIdForUserPg', e)
    return null
  }
}

export async function deleteDailyWordByIdPg(userId: string, id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const pool = getPgPool()
    const r = await pool.query(`delete from public.language_coach_daily_words where id = $1::uuid and user_id = $2::uuid`, [
      id,
      userId,
    ])
    if ((r.rowCount ?? 0) < 1) return { ok: false, message: 'not found' }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg }
  }
}

export async function deleteReviewQueueByUserWordTargetPg(
  userId: string,
  word: string,
  targetLanguage: string
): Promise<void> {
  if (!isPgConfigured()) return
  try {
    await pgQuery(
      `delete from public.language_coach_review_queue
       where user_id = $1::uuid and word = $2 and target_language = $3`,
      [userId, word, targetLanguage]
    )
  } catch (e) {
    console.error('[language-coach-word-daily-pg] deleteReviewQueueByUserWordTargetPg', e)
  }
}

export async function deleteAllDailyWordsForUserPg(userId: string): Promise<{ ok: true; ids: string[] } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const rows = await pgQuery<{ id: string }>(
      `delete from public.language_coach_daily_words where user_id = $1::uuid returning id::text as id`,
      [userId]
    )
    return { ok: true, ids: rows.map((r) => r.id) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg }
  }
}

export async function deleteAllReviewQueueForUserPg(userId: string): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const rows = await pgQuery<{ id: string }>(
      `delete from public.language_coach_review_queue where user_id = $1::uuid returning id::text as id`,
      [userId]
    )
    return { ok: true, count: rows.length }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg }
  }
}

export async function fetchDailyWordsMinimalForCleanupPg(
  userId: string
): Promise<Array<{ id: string; meaning: string | null; meaning_items_json: string | null }>> {
  if (!isPgConfigured()) return []
  try {
    return await pgQuery(
      `select id::text as id, meaning, meaning_items_json
       from public.language_coach_daily_words
       where user_id = $1::uuid`,
      [userId]
    )
  } catch (e) {
    console.error('[language-coach-word-daily-pg] fetchDailyWordsMinimalForCleanupPg', e)
    return []
  }
}

export async function deleteDailyWordsByIdsPg(userId: string, ids: string[]): Promise<{ ok: false; message: string } | { ok: true }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  if (ids.length === 0) return { ok: true }
  try {
    const pool = getPgPool()
    await pool.query(
      `delete from public.language_coach_daily_words where user_id = $1::uuid and id = any($2::uuid[])`,
      [userId, ids]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg }
  }
}

export async function fetchReviewQueueMinimalForCleanupPg(
  userId: string
): Promise<Array<{ id: string; meaning: string | null; meaning_items_json: string | null }>> {
  if (!isPgConfigured()) return []
  try {
    return await pgQuery(
      `select id::text as id, meaning, meaning_items_json
       from public.language_coach_review_queue
       where user_id = $1::uuid`,
      [userId]
    )
  } catch (e) {
    console.error('[language-coach-word-daily-pg] fetchReviewQueueMinimalForCleanupPg', e)
    return []
  }
}

export async function deleteReviewQueueByIdsPg(userId: string, ids: string[]): Promise<{ ok: false; message: string } | { ok: true }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  if (ids.length === 0) return { ok: true }
  try {
    const pool = getPgPool()
    await pool.query(
      `delete from public.language_coach_review_queue where user_id = $1::uuid and id = any($2::uuid[])`,
      [userId, ids]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: msg }
  }
}
