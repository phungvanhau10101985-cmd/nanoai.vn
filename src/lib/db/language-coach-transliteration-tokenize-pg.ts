import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type TransliterationCacheRowPg = { id: string; transliteration: string }

export async function fetchTransliterationCachePg(cacheKey: string): Promise<TransliterationCacheRowPg | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne<TransliterationCacheRowPg>(
      `select id::text, transliteration
       from public.language_coach_transliteration_cache
       where cache_key = $1
       limit 1`,
      [cacheKey]
    )
  } catch (e) {
    console.error('[language-coach-transliteration-tokenize-pg] fetchTransliterationCachePg', e)
    return null
  }
}

export type TransliterationCacheKeyRowPg = { cache_key: string; transliteration: string }

/** Nhiều cache_key một lần (GET history theo session). */
export async function fetchTransliterationCacheByKeysPg(
  cacheKeys: string[]
): Promise<TransliterationCacheKeyRowPg[]> {
  if (!isPgConfigured() || cacheKeys.length === 0) return []
  try {
    return await pgQuery<TransliterationCacheKeyRowPg>(
      `select cache_key, transliteration
       from public.language_coach_transliteration_cache
       where cache_key = any($1::text[])`,
      [cacheKeys]
    )
  } catch (e) {
    console.error('[language-coach-transliteration-tokenize-pg] fetchTransliterationCacheByKeysPg', e)
    return []
  }
}

export async function touchTransliterationCachePg(id: string, nowIso: string): Promise<void> {
  if (!isPgConfigured()) return
  try {
    const pool = getPgPool()
    await pool.query(
      `update public.language_coach_transliteration_cache
       set last_used_at = $2::timestamptz, updated_at = $2::timestamptz
       where id = $1::uuid`,
      [id, nowIso]
    )
  } catch (e) {
    console.warn('[language-coach-transliteration-tokenize-pg] touchTransliterationCachePg', e)
  }
}

export async function upsertTransliterationCachePg(params: {
  cacheKey: string
  languageCode: string
  transliteration: string
  nowIso: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    await pgQuery(
      `insert into public.language_coach_transliteration_cache (
         cache_key, language_code, transliteration, last_used_at, updated_at
       ) values ($1, $2, $3, $4::timestamptz, $4::timestamptz)
       on conflict (cache_key) do update set
         language_code = excluded.language_code,
         transliteration = excluded.transliteration,
         last_used_at = excluded.last_used_at,
         updated_at = excluded.updated_at`,
      [params.cacheKey, params.languageCode, params.transliteration, params.nowIso]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-transliteration-tokenize-pg] upsertTransliterationCachePg', e)
    return { ok: false, message: msg }
  }
}

export type CoachMessageTokensRowPg = {
  tokens_json: string | null
  target_language: string | null
}

export async function fetchCoachMessageTokensByIdPg(
  userId: string,
  messageId: string
): Promise<CoachMessageTokensRowPg | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne<CoachMessageTokensRowPg>(
      `select tokens_json, target_language
       from public.language_coach_messages
       where id = $1::uuid and user_id = $2::uuid
       limit 1`,
      [messageId, userId]
    )
  } catch (e) {
    console.error('[language-coach-transliteration-tokenize-pg] fetchCoachMessageTokensByIdPg', e)
    return null
  }
}

export async function fetchTokenizationExactPg(
  userId: string,
  targetLanguage: string,
  sentence: string
): Promise<{ tokens_json: string } | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne<{ tokens_json: string }>(
      `select tokens_json
       from public.language_coach_tokenizations
       where user_id = $1::uuid and target_language = $2 and sentence = $3
       limit 1`,
      [userId, targetLanguage, sentence]
    )
  } catch (e) {
    console.error('[language-coach-transliteration-tokenize-pg] fetchTokenizationExactPg', e)
    return null
  }
}

export async function fetchTokenizationsForUserTargetPg(
  userId: string,
  targetLanguage: string,
  limit: number
): Promise<Array<{ sentence: string; tokens_json: string }> | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQuery(
      `select sentence, tokens_json
       from public.language_coach_tokenizations
       where user_id = $1::uuid and target_language = $2
       order by updated_at desc
       limit $3`,
      [userId, targetLanguage, limit]
    )
  } catch (e) {
    console.error('[language-coach-transliteration-tokenize-pg] fetchTokenizationsForUserTargetPg', e)
    return null
  }
}

export type TeacherMessageTokenRowPg = {
  main_sentence: string | null
  intent_answer: string | null
  text: string | null
  tokens_json: string | null
}

export async function fetchTeacherMessagesWithTokensPg(
  userId: string,
  targetLanguage: string | null,
  limit: number
): Promise<TeacherMessageTokenRowPg[] | null> {
  if (!isPgConfigured()) return null
  try {
    if (targetLanguage && targetLanguage.trim()) {
      return await pgQuery(
        `select main_sentence, intent_answer, text, tokens_json
         from public.language_coach_messages
         where user_id = $1::uuid and role = 'teacher' and tokens_json is not null
           and target_language = $2
         order by created_at desc
         limit $3`,
        [userId, targetLanguage, limit]
      )
    }
    return await pgQuery(
      `select main_sentence, intent_answer, text, tokens_json
       from public.language_coach_messages
       where user_id = $1::uuid and role = 'teacher' and tokens_json is not null
       order by created_at desc
       limit $2`,
      [userId, limit]
    )
  } catch (e) {
    console.error('[language-coach-transliteration-tokenize-pg] fetchTeacherMessagesWithTokensPg', e)
    return null
  }
}

export async function upsertTokenizationPg(params: {
  userId: string
  targetLanguage: string
  sentence: string
  tokensJson: string
  updatedAtIso: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    await pgQuery(
      `insert into public.language_coach_tokenizations (
         user_id, target_language, sentence, tokens_json, updated_at
       ) values ($1::uuid, $2, $3, $4, $5::timestamptz)
       on conflict (user_id, target_language, sentence)
       do update set
         tokens_json = excluded.tokens_json,
         updated_at = excluded.updated_at`,
      [params.userId, params.targetLanguage, params.sentence, params.tokensJson, params.updatedAtIso]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-transliteration-tokenize-pg] upsertTokenizationPg', e)
    return { ok: false, message: msg }
  }
}
