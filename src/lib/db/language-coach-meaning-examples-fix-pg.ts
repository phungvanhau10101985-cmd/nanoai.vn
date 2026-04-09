import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type MeaningFixFailedRowPg = {
  id: string
  word: string
  target_language: string | null
  native_language: string | null
  source_table: string
  error_message: string | null
  created_at: string
}

export async function listMeaningFixFailedPg(limit: number): Promise<MeaningFixFailedRowPg[] | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQuery(
      `select id::text, word, target_language, native_language, source_table, error_message, created_at::text
       from public.language_coach_meaning_fix_failed
       order by created_at desc
       limit $1`,
      [limit]
    )
  } catch (e) {
    console.error('[language-coach-meaning-examples-fix-pg] listMeaningFixFailedPg', e)
    return null
  }
}

export type DailyWordMeaningRowPg = {
  id: string
  user_id: string
  word: string
  target_language: string | null
  native_language: string | null
  meaning: string | null
  meaning_items_json: string | null
}

export async function fetchDailyWordsPendingMeaningFixPg(): Promise<DailyWordMeaningRowPg[] | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQuery(
      `select id::text, user_id::text, word, target_language, native_language, meaning, meaning_items_json
       from public.language_coach_daily_words
       where coalesce(meaning_fix_attempted, false) = false`
    )
  } catch (e) {
    console.error('[language-coach-meaning-examples-fix-pg] fetchDailyWordsPendingMeaningFixPg', e)
    return null
  }
}

export type ReviewQueueMeaningRowPg = {
  id: string
  user_id: string
  word: string
  target_language: string | null
  native_language: string | null
  meaning: string | null
  meaning_items_json: string | null
}

export async function fetchReviewQueuePendingMeaningFixPg(): Promise<ReviewQueueMeaningRowPg[] | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQuery(
      `select id::text, user_id::text, word, target_language, native_language, meaning, meaning_items_json
       from public.language_coach_review_queue
       where coalesce(meaning_fix_attempted, false) = false`
    )
  } catch (e) {
    console.error('[language-coach-meaning-examples-fix-pg] fetchReviewQueuePendingMeaningFixPg', e)
    return null
  }
}

export async function setDailyWordMeaningFixAttemptedPg(id: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `update public.language_coach_daily_words set meaning_fix_attempted = true where id = $1::uuid`,
      [id]
    )
    return true
  } catch (e) {
    console.error('[language-coach-meaning-examples-fix-pg] setDailyWordMeaningFixAttemptedPg', e)
    return false
  }
}

export async function setReviewQueueMeaningFixAttemptedPg(id: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `update public.language_coach_review_queue set meaning_fix_attempted = true where id = $1::uuid`,
      [id]
    )
    return true
  } catch (e) {
    console.error('[language-coach-meaning-examples-fix-pg] setReviewQueueMeaningFixAttemptedPg', e)
    return false
  }
}

export async function insertMeaningFixFailedPg(params: {
  word: string
  targetLanguage: string | null
  nativeLanguage: string | null
  userId: string | null
  sourceTable: string
  sourceId: string
  errorMessage: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `insert into public.language_coach_meaning_fix_failed (
         word, target_language, native_language, user_id, source_table, source_id, error_message
       ) values ($1, $2, $3, $4::uuid, $5, $6::uuid, $7)`,
      [
        params.word,
        params.targetLanguage,
        params.nativeLanguage,
        params.userId,
        params.sourceTable,
        params.sourceId,
        params.errorMessage,
      ]
    )
    return true
  } catch (e) {
    console.error('[language-coach-meaning-examples-fix-pg] insertMeaningFixFailedPg', e)
    return false
  }
}

export async function updateDailyWordMeaningFieldsPg(params: {
  id: string
  meaning: string | null
  pronunciation: string | null
  meaningItemsJson: string | null
  exampleItemsJson: string | null
  exampleTarget: string | null
  exampleNative: string | null
  updatedAtIso: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `update public.language_coach_daily_words
       set meaning = $2, pronunciation = $3, meaning_items_json = $4, example_items_json = $5,
           example_target = $6, example_native = $7, updated_at = $8::timestamptz
       where id = $1::uuid`,
      [
        params.id,
        params.meaning,
        params.pronunciation,
        params.meaningItemsJson,
        params.exampleItemsJson,
        params.exampleTarget,
        params.exampleNative,
        params.updatedAtIso,
      ]
    )
    return true
  } catch (e) {
    console.error('[language-coach-meaning-examples-fix-pg] updateDailyWordMeaningFieldsPg', e)
    return false
  }
}

export async function updateReviewQueueMeaningFieldsPg(params: {
  id: string
  meaning: string | null
  pronunciation: string | null
  meaningItemsJson: string | null
  exampleItemsJson: string | null
  updatedAtIso: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `update public.language_coach_review_queue
       set meaning = $2, pronunciation = $3, meaning_items_json = $4, example_items_json = $5,
           updated_at = $6::timestamptz
       where id = $1::uuid`,
      [
        params.id,
        params.meaning,
        params.pronunciation,
        params.meaningItemsJson,
        params.exampleItemsJson,
        params.updatedAtIso,
      ]
    )
    return true
  } catch (e) {
    console.error('[language-coach-meaning-examples-fix-pg] updateReviewQueueMeaningFieldsPg', e)
    return false
  }
}

export async function findVocabCacheIdByWordLanguagesPg(
  word: string,
  targetLanguage: string,
  nativeLanguage: string
): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `select id::text from public.language_coach_vocab_cache
       where word = $1 and target_language = $2 and native_language = $3
       limit 1`,
      [word, targetLanguage, nativeLanguage]
    )
    return row?.id ?? null
  } catch (e) {
    console.error('[language-coach-meaning-examples-fix-pg] findVocabCacheIdByWordLanguagesPg', e)
    return null
  }
}

export async function updateVocabCacheMeaningFieldsPg(params: {
  id: string
  meaning: string | null
  pronunciation: string | null
  meaningItemsJson: string | null
  exampleItemsJson: string | null
  exampleTarget: string | null
  exampleNative: string | null
  updatedAtIso: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `update public.language_coach_vocab_cache
       set meaning = $2, pronunciation = $3, meaning_items_json = $4, example_items_json = $5,
           example_target = $6, example_native = $7, updated_at = $8::timestamptz
       where id = $1::uuid`,
      [
        params.id,
        params.meaning,
        params.pronunciation,
        params.meaningItemsJson,
        params.exampleItemsJson,
        params.exampleTarget,
        params.exampleNative,
        params.updatedAtIso,
      ]
    )
    return true
  } catch (e) {
    console.error('[language-coach-meaning-examples-fix-pg] updateVocabCacheMeaningFieldsPg', e)
    return false
  }
}

export type DailyWordExamplesRowPg = {
  id: string
  user_id: string
  word: string
  target_language: string | null
  native_language: string | null
  example_items_json: string | null
}

export async function fetchDailyWordsWithExampleItemsPg(): Promise<DailyWordExamplesRowPg[] | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQuery(
      `select id::text, user_id::text, word, target_language, native_language, example_items_json
       from public.language_coach_daily_words
       where example_items_json is not null`
    )
  } catch (e) {
    console.error('[language-coach-meaning-examples-fix-pg] fetchDailyWordsWithExampleItemsPg', e)
    return null
  }
}

export type ReviewQueueExamplesRowPg = {
  id: string
  user_id: string
  word: string
  target_language: string | null
  native_language: string | null
  example_items_json: string | null
}

export async function fetchReviewQueueWithExampleItemsPg(): Promise<ReviewQueueExamplesRowPg[] | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQuery(
      `select id::text, user_id::text, word, target_language, native_language, example_items_json
       from public.language_coach_review_queue
       where example_items_json is not null`
    )
  } catch (e) {
    console.error('[language-coach-meaning-examples-fix-pg] fetchReviewQueueWithExampleItemsPg', e)
    return null
  }
}

export type VocabCacheExamplesRowPg = {
  id: string
  word: string
  target_language: string | null
  native_language: string | null
  example_items_json: string | null
}

export async function fetchVocabCacheWithExampleItemsPg(): Promise<VocabCacheExamplesRowPg[] | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQuery(
      `select id::text, word, target_language, native_language, example_items_json
       from public.language_coach_vocab_cache
       where example_items_json is not null`
    )
  } catch (e) {
    console.error('[language-coach-meaning-examples-fix-pg] fetchVocabCacheWithExampleItemsPg', e)
    return null
  }
}

export async function updateDailyWordExampleItemsPg(params: {
  id: string
  exampleItemsJson: string
  exampleTarget: string | null
  exampleNative: string | null
  updatedAtIso: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `update public.language_coach_daily_words
       set example_items_json = $2, example_target = $3, example_native = $4, updated_at = $5::timestamptz
       where id = $1::uuid`,
      [params.id, params.exampleItemsJson, params.exampleTarget, params.exampleNative, params.updatedAtIso]
    )
    return true
  } catch (e) {
    console.error('[language-coach-meaning-examples-fix-pg] updateDailyWordExampleItemsPg', e)
    return false
  }
}

export async function updateReviewQueueExampleItemsPg(params: {
  id: string
  exampleItemsJson: string
  updatedAtIso: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `update public.language_coach_review_queue
       set example_items_json = $2, updated_at = $3::timestamptz
       where id = $1::uuid`,
      [params.id, params.exampleItemsJson, params.updatedAtIso]
    )
    return true
  } catch (e) {
    console.error('[language-coach-meaning-examples-fix-pg] updateReviewQueueExampleItemsPg', e)
    return false
  }
}

export async function updateVocabCacheExampleItemsPg(params: {
  id: string
  exampleItemsJson: string
  exampleTarget: string | null
  exampleNative: string | null
  updatedAtIso: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `update public.language_coach_vocab_cache
       set example_items_json = $2, example_target = $3, example_native = $4, updated_at = $5::timestamptz
       where id = $1::uuid`,
      [params.id, params.exampleItemsJson, params.exampleTarget, params.exampleNative, params.updatedAtIso]
    )
    return true
  } catch (e) {
    console.error('[language-coach-meaning-examples-fix-pg] updateVocabCacheExampleItemsPg', e)
    return false
  }
}
