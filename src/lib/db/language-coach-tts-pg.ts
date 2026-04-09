import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type TtsCacheRowPg = {
  id: string
  audio_base64: string
  mime_type: string
  source_model: string | null
}

/** Chỉ đọc audio + mime (route tts-cache). */
export async function fetchTtsCacheAudioPg(cacheKey: string): Promise<{ audio_base64: string; mime_type: string } | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne(
      `select audio_base64, mime_type
       from public.language_coach_tts_cache
       where cache_key = $1
       limit 1`,
      [cacheKey]
    )
  } catch (e) {
    console.error('[language-coach-tts-pg] fetchTtsCacheAudioPg', e)
    return null
  }
}

export async function fetchTtsCacheFullPg(cacheKey: string): Promise<TtsCacheRowPg | null> {
  if (!isPgConfigured()) return null
  try {
    return await pgQueryOne<TtsCacheRowPg>(
      `select id::text, audio_base64, mime_type, source_model
       from public.language_coach_tts_cache
       where cache_key = $1
       limit 1`,
      [cacheKey]
    )
  } catch (e) {
    console.error('[language-coach-tts-pg] fetchTtsCacheFullPg', e)
    return null
  }
}

export async function touchTtsCachePg(id: string, nowIso: string): Promise<void> {
  if (!isPgConfigured()) return
  try {
    const pool = getPgPool()
    await pool.query(
      `update public.language_coach_tts_cache
       set last_used_at = $2::timestamptz, updated_at = $2::timestamptz
       where id = $1::uuid`,
      [id, nowIso]
    )
  } catch (e) {
    console.warn('[language-coach-tts-pg] touchTtsCachePg', e)
  }
}

export async function upsertTtsCachePg(params: {
  cacheKey: string
  textHash: string
  voiceName: string
  locale: string
  mimeType: string
  audioBase64: string
  sourceModel: string
  nowIso: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    await pgQuery(
      `insert into public.language_coach_tts_cache (
         cache_key, text_hash, voice_name, locale, mime_type, audio_base64, source_model,
         last_used_at, updated_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $8::timestamptz)
       on conflict (cache_key) do update set
         text_hash = excluded.text_hash,
         voice_name = excluded.voice_name,
         locale = excluded.locale,
         mime_type = excluded.mime_type,
         audio_base64 = excluded.audio_base64,
         source_model = excluded.source_model,
         last_used_at = excluded.last_used_at,
         updated_at = excluded.updated_at`,
      [
        params.cacheKey,
        params.textHash,
        params.voiceName,
        params.locale,
        params.mimeType,
        params.audioBase64,
        params.sourceModel,
        params.nowIso,
      ]
    )
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-tts-pg] upsertTtsCachePg', e)
    return { ok: false, message: msg }
  }
}

export async function incrementLanguageCoachCacheStatPg(metric: 'tts_hit' | 'tts_miss'): Promise<void> {
  if (!isPgConfigured()) return
  try {
    const pool = getPgPool()
    await pool.query('select public.increment_language_coach_cache_stat($1::text, 1)', [metric])
  } catch {
    // Giữ đường TTS nhanh nếu RPC lỗi (giống catch trong route cũ).
  }
}
