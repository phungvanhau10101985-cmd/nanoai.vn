import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

export type VocabCacheRowPg = {
  id: string
  meaning: string
  pronunciation: string | null
  part_of_speech: string | null
  example_target: string | null
  example_native: string | null
  pronunciation_audio_url: string | null
  meaning_items_json: string | null
  example_items_json: string | null
  usage_level: string | null
  importance_score: number | null
  is_context_sensitive: boolean | null
}

export async function fetchVocabCacheRowPg(
  normalizedWord: string,
  normalizedTargetLanguage: string,
  normalizedNativeLanguage: string
): Promise<VocabCacheRowPg | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne<VocabCacheRowPg>(
      `select
         id::text,
         meaning,
         pronunciation,
         part_of_speech,
         example_target,
         example_native,
         pronunciation_audio_url,
         meaning_items_json,
         example_items_json,
         usage_level,
         importance_score,
         is_context_sensitive
       from public.language_coach_vocab_cache
       where normalized_word = $1
         and normalized_target_language = $2
         and normalized_native_language = $3
       order by updated_at desc
       limit 1`,
      [normalizedWord, normalizedTargetLanguage, normalizedNativeLanguage]
    )
  } catch (e) {
    console.error('[language-coach-vocab-cache-pg] fetchVocabCacheRowPg', e)
    return null
  }
}

/** Giống lookup cũ (chỉ word + target), lấy bản ghi mới nhất. */
export async function fetchVocabCacheRowByWordTargetPg(
  normalizedWord: string,
  normalizedTargetLanguage: string
): Promise<(VocabCacheRowPg & { word: string }) | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne<VocabCacheRowPg & { word: string }>(
      `select
         id::text,
         word,
         meaning,
         pronunciation,
         part_of_speech,
         example_target,
         example_native,
         pronunciation_audio_url,
         meaning_items_json,
         example_items_json,
         usage_level,
         importance_score,
         is_context_sensitive
       from public.language_coach_vocab_cache
       where normalized_word = $1
         and normalized_target_language = $2
       order by updated_at desc
       limit 1`,
      [normalizedWord, normalizedTargetLanguage]
    )
  } catch (e) {
    console.error('[language-coach-vocab-cache-pg] fetchVocabCacheRowByWordTargetPg', e)
    return null
  }
}

export async function touchVocabCacheUsagePg(id: string, nowIso: string): Promise<void> {
  if (!isPgConfigured()) return
  try {
    const pool = getPgPool()
    await pool.query(
      `update public.language_coach_vocab_cache
       set last_used_at = $2::timestamptz, updated_at = $2::timestamptz
       where id = $1::uuid`,
      [id, nowIso]
    )
  } catch (e) {
    console.warn('[language-coach-vocab-cache-pg] touchVocabCacheUsagePg', e)
  }
}

export async function upsertVocabCacheFromWordRoutePg(input: {
  word: string
  normalizedWord: string
  targetLanguage: string
  normalizedTargetLanguage: string
  nativeLanguage: string
  normalizedNativeLanguage: string
  contextHash: string | null
  partOfSpeech: string | null
  meaning: string
  pronunciation: string | null
  exampleTarget: string | null
  exampleNative: string | null
  /** Lưu từ word-daily / TTS — optional. */
  pronunciationAudioUrl?: string | null
  meaningItemsJson: string
  exampleItemsJson: string
  usageLevel: string
  importanceScore: number
  isContextSensitive: boolean
  sourceModel: string
  nowIso: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const pool = getPgPool()
    await pool.query(
      `insert into public.language_coach_vocab_cache (
        word,
        normalized_word,
        target_language,
        normalized_target_language,
        native_language,
        normalized_native_language,
        context_hash,
        part_of_speech,
        meaning,
        pronunciation,
        example_target,
        example_native,
        pronunciation_audio_url,
        meaning_items_json,
        example_items_json,
        usage_level,
        importance_score,
        is_context_sensitive,
        source_model,
        last_used_at,
        updated_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::timestamptz, $20::timestamptz
      )
      on conflict (normalized_word, normalized_target_language, normalized_native_language) do update set
        word = excluded.word,
        target_language = excluded.target_language,
        native_language = excluded.native_language,
        context_hash = excluded.context_hash,
        part_of_speech = excluded.part_of_speech,
        meaning = excluded.meaning,
        pronunciation = excluded.pronunciation,
        example_target = excluded.example_target,
        example_native = excluded.example_native,
        pronunciation_audio_url = excluded.pronunciation_audio_url,
        meaning_items_json = excluded.meaning_items_json,
        example_items_json = excluded.example_items_json,
        usage_level = excluded.usage_level,
        importance_score = excluded.importance_score,
        is_context_sensitive = excluded.is_context_sensitive,
        source_model = excluded.source_model,
        last_used_at = excluded.last_used_at,
        updated_at = excluded.updated_at`,
      [
        input.word,
        input.normalizedWord,
        input.targetLanguage,
        input.normalizedTargetLanguage,
        input.nativeLanguage,
        input.normalizedNativeLanguage,
        input.contextHash,
        input.partOfSpeech,
        input.meaning,
        input.pronunciation,
        input.exampleTarget,
        input.exampleNative,
        input.pronunciationAudioUrl ?? null,
        input.meaningItemsJson,
        input.exampleItemsJson,
        input.usageLevel,
        input.importanceScore,
        input.isContextSensitive,
        input.sourceModel,
        input.nowIso,
      ]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-vocab-cache-pg] upsertVocabCacheFromWordRoutePg', e)
    return { ok: false, message: msg }
  }
}

export async function incrementWordCacheStatPg(metric: 'word_hit' | 'word_miss'): Promise<void> {
  if (!isPgConfigured()) return
  try {
    const pool = getPgPool()
    await pool.query('select public.increment_language_coach_cache_stat($1::text, 1)', [metric])
  } catch {
    // Giữ lookup nhanh nếu RPC lỗi (giống route cũ).
  }
}
