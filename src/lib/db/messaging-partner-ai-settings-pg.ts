import type { Database } from '@/types/database.types'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

export type MessagingPartnerAiSettingsRow = Database['public']['Tables']['messaging_partner_ai_settings']['Row']

function tsIso(v: unknown): string | null {
  if (v == null || v === '') return null
  if (v instanceof Date) return v.toISOString()
  const s = String(v)
  return s || null
}

function tsIsoReq(v: unknown): string {
  if (v instanceof Date) return v.toISOString()
  return String(v ?? '')
}

function num(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return fallback
}

function mapPgRowToAiSettingsFull(row: {
  partner_id: string
  enabled: boolean | null
  reply_delay_seconds: number | null
  typing_pause_min_ms: number | null
  typing_pause_max_ms: number | null
  shop_policy: string | null
  tone_instructions: string | null
  append_ai_disclosure: boolean | null
  disclosure_suffix: string | null
  vision_product_search_enabled: boolean | null
  vision_location: string | null
  vision_shop_country: string | null
  vision_product_category: string | null
  vision_gcs_bucket: string | null
  vision_index_ready: boolean | null
  vision_index_synced_at: unknown
  vision_index_error: string | null
  image_search_api_enabled: boolean | null
  image_search_api_secret: string | null
  vision_bg_sync_status: string | null
  vision_bg_sync_resume_after_id: string | null
  vision_bg_sync_rounds: number | null
  vision_bg_sync_imported: number | null
  vision_bg_sync_removed: number | null
  vision_bg_sync_started_at: unknown
  vision_bg_sync_finished_at: unknown
  vision_bg_sync_error: string | null
  vision_bg_sync_report: string | null
  updated_at: unknown
}): MessagingPartnerAiSettingsRow {
  return {
    partner_id: row.partner_id,
    enabled: row.enabled !== false,
    reply_delay_seconds: num(row.reply_delay_seconds, 60),
    typing_pause_min_ms: num(row.typing_pause_min_ms, 1200),
    typing_pause_max_ms: num(row.typing_pause_max_ms, 3800),
    shop_policy: String(row.shop_policy ?? ''),
    tone_instructions: String(row.tone_instructions ?? ''),
    append_ai_disclosure: row.append_ai_disclosure !== false,
    disclosure_suffix: String(row.disclosure_suffix ?? ''),
    vision_product_search_enabled: row.vision_product_search_enabled !== false,
    vision_location: String(row.vision_location ?? ''),
    vision_shop_country: row.vision_shop_country ?? null,
    vision_product_category: String(row.vision_product_category ?? ''),
    vision_gcs_bucket: String(row.vision_gcs_bucket ?? ''),
    vision_index_ready: row.vision_index_ready !== false,
    vision_index_synced_at: tsIso(row.vision_index_synced_at),
    vision_index_error: String(row.vision_index_error ?? ''),
    image_search_api_enabled: row.image_search_api_enabled !== false,
    image_search_api_secret: row.image_search_api_secret ?? null,
    vision_bg_sync_status: String(row.vision_bg_sync_status ?? ''),
    vision_bg_sync_resume_after_id: row.vision_bg_sync_resume_after_id ?? null,
    vision_bg_sync_rounds: num(row.vision_bg_sync_rounds, 0),
    vision_bg_sync_imported: num(row.vision_bg_sync_imported, 0),
    vision_bg_sync_removed: num(row.vision_bg_sync_removed, 0),
    vision_bg_sync_started_at: tsIso(row.vision_bg_sync_started_at),
    vision_bg_sync_finished_at: tsIso(row.vision_bg_sync_finished_at),
    vision_bg_sync_error: String(row.vision_bg_sync_error ?? ''),
    vision_bg_sync_report: String(row.vision_bg_sync_report ?? ''),
    updated_at: tsIsoReq(row.updated_at),
  }
}

/**
 * Một dòng đầy đủ `messaging_partner_ai_settings` (Postgres). `null` = không pool, lỗi, hoặc không có bản ghi.
 */
export async function fetchMessagingPartnerAiSettingsFullFromPg(
  partnerId: string
): Promise<MessagingPartnerAiSettingsRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Parameters<typeof mapPgRowToAiSettingsFull>[0]>(
      `select
        partner_id::text,
        coalesce(enabled, false) as enabled,
        reply_delay_seconds,
        typing_pause_min_ms,
        typing_pause_max_ms,
        coalesce(shop_policy, '') as shop_policy,
        coalesce(tone_instructions, '') as tone_instructions,
        coalesce(append_ai_disclosure, true) as append_ai_disclosure,
        coalesce(disclosure_suffix, '') as disclosure_suffix,
        coalesce(vision_product_search_enabled, false) as vision_product_search_enabled,
        coalesce(vision_location, '') as vision_location,
        vision_shop_country,
        coalesce(vision_product_category, '') as vision_product_category,
        coalesce(vision_gcs_bucket, '') as vision_gcs_bucket,
        coalesce(vision_index_ready, false) as vision_index_ready,
        vision_index_synced_at,
        coalesce(vision_index_error, '') as vision_index_error,
        coalesce(image_search_api_enabled, false) as image_search_api_enabled,
        image_search_api_secret,
        coalesce(vision_bg_sync_status, '') as vision_bg_sync_status,
        vision_bg_sync_resume_after_id::text as vision_bg_sync_resume_after_id,
        coalesce(vision_bg_sync_rounds, 0) as vision_bg_sync_rounds,
        coalesce(vision_bg_sync_imported, 0) as vision_bg_sync_imported,
        coalesce(vision_bg_sync_removed, 0) as vision_bg_sync_removed,
        vision_bg_sync_started_at,
        vision_bg_sync_finished_at,
        coalesce(vision_bg_sync_error, '') as vision_bg_sync_error,
        coalesce(vision_bg_sync_report, '') as vision_bg_sync_report,
        updated_at
       from public.messaging_partner_ai_settings
       where partner_id = $1::uuid
       limit 1`,
      [partnerId]
    )
    if (!row) return null
    return mapPgRowToAiSettingsFull(row)
  } catch (e) {
    console.warn('[fetchMessagingPartnerAiSettingsFullFromPg]', e)
    return null
  }
}

/**
 * Cờ `enabled` (Postgres). `null` = không dùng PG hoặc không có dòng — caller caller xử lý khi không có PG.
 */
export async function fetchMessagingPartnerAiEnabledFromPg(
  partnerId: string
): Promise<{ enabled: boolean } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ enabled: boolean | null }>(
      `select enabled from public.messaging_partner_ai_settings where partner_id = $1::uuid limit 1`,
      [partnerId]
    )
    if (!row) return null
    return { enabled: row.enabled !== false }
  } catch (e) {
    console.warn('[fetchMessagingPartnerAiEnabledFromPg]', e)
    return null
  }
}

export type MessagingPartnerAiImageSearchAuthRow = {
  image_search_api_enabled: boolean
  image_search_api_secret: string | null
}

/**
 * Trường Bearer API tìm kiếm ảnh. `null` = không PG hoặc không có dòng — caller xử lý khi không có PG.
 */
export async function fetchMessagingPartnerAiImageSearchAuthFromPg(
  partnerId: string
): Promise<MessagingPartnerAiImageSearchAuthRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      image_search_api_enabled: boolean | null
      image_search_api_secret: string | null
    }>(
      `select coalesce(image_search_api_enabled, false) as image_search_api_enabled,
              image_search_api_secret
       from public.messaging_partner_ai_settings
       where partner_id = $1::uuid
       limit 1`,
      [partnerId]
    )
    if (!row) return null
    return {
      image_search_api_enabled: row.image_search_api_enabled !== false,
      image_search_api_secret: row.image_search_api_secret ?? null,
    }
  } catch (e) {
    console.warn('[fetchMessagingPartnerAiImageSearchAuthFromPg]', e)
    return null
  }
}

/** Dùng trước khi upsert dashboard — giữ index + secret. `null` = lỗi / không pool / không có dòng. */
export async function fetchMessagingPartnerAiUpsertPrereqFromPg(partnerId: string): Promise<{
  vision_index_ready: boolean
  vision_index_synced_at: string | null
  vision_index_error: string
  image_search_api_secret: string | null
} | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      vision_index_ready: boolean | null
      vision_index_synced_at: unknown
      vision_index_error: string | null
      image_search_api_secret: string | null
    }>(
      `select coalesce(vision_index_ready, false) as vision_index_ready,
              vision_index_synced_at,
              coalesce(vision_index_error, '') as vision_index_error,
              image_search_api_secret
       from public.messaging_partner_ai_settings
       where partner_id = $1::uuid
       limit 1`,
      [partnerId]
    )
    if (!row) return null
    return {
      vision_index_ready: row.vision_index_ready !== false,
      vision_index_synced_at:
        row.vision_index_synced_at instanceof Date
          ? row.vision_index_synced_at.toISOString()
          : row.vision_index_synced_at
            ? String(row.vision_index_synced_at)
            : null,
      vision_index_error: String(row.vision_index_error ?? ''),
      image_search_api_secret: row.image_search_api_secret ?? null,
    }
  } catch (e) {
    console.warn('[fetchMessagingPartnerAiUpsertPrereqFromPg]', e)
    return null
  }
}

/** `true`/`false` nếu có dòng AI settings; `null` = không pool / lỗi. */
export async function partnerMessagingAiSettingsRowExistsFromPg(
  partnerId: string
): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ x: number }>(
      `select 1 as x from public.messaging_partner_ai_settings where partner_id = $1::uuid limit 1`,
      [partnerId]
    )
    return row != null
  } catch (e) {
    console.warn('[partnerMessagingAiSettingsRowExistsFromPg]', e)
    return null
  }
}

export type PartnerAiSettingsDashboardUpsert = {
  partner_id: string
  enabled: boolean
  reply_delay_seconds: number
  typing_pause_min_ms: number
  typing_pause_max_ms: number
  shop_policy: string
  tone_instructions: string
  append_ai_disclosure: boolean
  disclosure_suffix: string
  vision_product_search_enabled: boolean
  vision_shop_country: string | null
  vision_location: string
  vision_product_category: string
  vision_gcs_bucket: string
  vision_index_ready: boolean
  vision_index_synced_at: string | null
  vision_index_error: string
  image_search_api_enabled: boolean
  image_search_api_secret: string | null
  vision_bg_sync_status: string
  vision_bg_sync_resume_after_id: string | null
  vision_bg_sync_rounds: number
  vision_bg_sync_imported: number
  vision_bg_sync_removed: number
  vision_bg_sync_started_at: string | null
  vision_bg_sync_finished_at: string | null
  vision_bg_sync_error: string
  vision_bg_sync_report: string
  updated_at: string
}

/** Upsert đầy đủ một dòng (dashboard save). `false` = lỗi. */
export async function upsertMessagingPartnerAiSettingsDashboardFromPg(
  row: PartnerAiSettingsDashboardUpsert
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await getPgPool().query(
      `insert into public.messaging_partner_ai_settings (
        partner_id, enabled, reply_delay_seconds, typing_pause_min_ms, typing_pause_max_ms,
        shop_policy, tone_instructions, append_ai_disclosure, disclosure_suffix,
        vision_product_search_enabled, vision_location, vision_shop_country, vision_product_category, vision_gcs_bucket,
        vision_index_ready, vision_index_synced_at, vision_index_error,
        image_search_api_enabled, image_search_api_secret,
        vision_bg_sync_status, vision_bg_sync_resume_after_id, vision_bg_sync_rounds,
        vision_bg_sync_imported, vision_bg_sync_removed, vision_bg_sync_started_at, vision_bg_sync_finished_at,
        vision_bg_sync_error, vision_bg_sync_report, updated_at
      ) values (
        $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, $26, $27, $28, $29::timestamptz
      )
      on conflict (partner_id) do update set
        enabled = excluded.enabled,
        reply_delay_seconds = excluded.reply_delay_seconds,
        typing_pause_min_ms = excluded.typing_pause_min_ms,
        typing_pause_max_ms = excluded.typing_pause_max_ms,
        shop_policy = excluded.shop_policy,
        tone_instructions = excluded.tone_instructions,
        append_ai_disclosure = excluded.append_ai_disclosure,
        disclosure_suffix = excluded.disclosure_suffix,
        vision_product_search_enabled = excluded.vision_product_search_enabled,
        vision_location = excluded.vision_location,
        vision_shop_country = excluded.vision_shop_country,
        vision_product_category = excluded.vision_product_category,
        vision_gcs_bucket = excluded.vision_gcs_bucket,
        vision_index_ready = excluded.vision_index_ready,
        vision_index_synced_at = excluded.vision_index_synced_at,
        vision_index_error = excluded.vision_index_error,
        image_search_api_enabled = excluded.image_search_api_enabled,
        image_search_api_secret = excluded.image_search_api_secret,
        vision_bg_sync_status = excluded.vision_bg_sync_status,
        vision_bg_sync_resume_after_id = excluded.vision_bg_sync_resume_after_id,
        vision_bg_sync_rounds = excluded.vision_bg_sync_rounds,
        vision_bg_sync_imported = excluded.vision_bg_sync_imported,
        vision_bg_sync_removed = excluded.vision_bg_sync_removed,
        vision_bg_sync_started_at = excluded.vision_bg_sync_started_at,
        vision_bg_sync_finished_at = excluded.vision_bg_sync_finished_at,
        vision_bg_sync_error = excluded.vision_bg_sync_error,
        vision_bg_sync_report = excluded.vision_bg_sync_report,
        updated_at = excluded.updated_at`,
      [
        row.partner_id,
        row.enabled,
        row.reply_delay_seconds,
        row.typing_pause_min_ms,
        row.typing_pause_max_ms,
        row.shop_policy,
        row.tone_instructions,
        row.append_ai_disclosure,
        row.disclosure_suffix,
        row.vision_product_search_enabled,
        row.vision_location,
        row.vision_shop_country,
        row.vision_product_category,
        row.vision_gcs_bucket,
        row.vision_index_ready,
        row.vision_index_synced_at,
        row.vision_index_error,
        row.image_search_api_enabled,
        row.image_search_api_secret,
        row.vision_bg_sync_status,
        row.vision_bg_sync_resume_after_id,
        row.vision_bg_sync_rounds,
        row.vision_bg_sync_imported,
        row.vision_bg_sync_removed,
        row.vision_bg_sync_started_at,
        row.vision_bg_sync_finished_at,
        row.vision_bg_sync_error,
        row.vision_bg_sync_report,
        row.updated_at,
      ]
    )
    return true
  } catch (e) {
    console.warn('[upsertMessagingPartnerAiSettingsDashboardFromPg]', e)
    return false
  }
}

export async function updateMessagingPartnerAiImageSearchSecretFromPg(
  partnerId: string,
  secret: string,
  updatedAt: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const r = await getPgPool().query(
      `update public.messaging_partner_ai_settings
       set image_search_api_secret = $2, updated_at = $3::timestamptz
       where partner_id = $1::uuid`,
      [partnerId, secret, updatedAt]
    )
    return (r.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[updateMessagingPartnerAiImageSearchSecretFromPg]', e)
    return false
  }
}

export async function clearMessagingPartnerAiImageSearchSecretFromPg(
  partnerId: string,
  updatedAt: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const r = await getPgPool().query(
      `update public.messaging_partner_ai_settings
       set image_search_api_secret = null, updated_at = $2::timestamptz
       where partner_id = $1::uuid`,
      [partnerId, updatedAt]
    )
    return (r.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[clearMessagingPartnerAiImageSearchSecretFromPg]', e)
    return false
  }
}

export async function updateMessagingPartnerAiImageSearchEnabledFromPg(
  partnerId: string,
  enabled: boolean,
  updatedAt: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const r = await getPgPool().query(
      `update public.messaging_partner_ai_settings
       set image_search_api_enabled = $2, updated_at = $3::timestamptz
       where partner_id = $1::uuid`,
      [partnerId, enabled, updatedAt]
    )
    return (r.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[updateMessagingPartnerAiImageSearchEnabledFromPg]', e)
    return false
  }
}

export async function updateMessagingPartnerAiVisionBgIdleFromPg(
  partnerId: string,
  updatedAt: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const r = await getPgPool().query(
      `update public.messaging_partner_ai_settings set
        vision_bg_sync_status = 'idle',
        vision_bg_sync_resume_after_id = null,
        vision_bg_sync_rounds = 0,
        vision_bg_sync_imported = 0,
        vision_bg_sync_removed = 0,
        vision_bg_sync_started_at = null,
        vision_bg_sync_finished_at = null,
        vision_bg_sync_error = '',
        vision_bg_sync_report = '',
        updated_at = $2::timestamptz
       where partner_id = $1::uuid`,
      [partnerId, updatedAt]
    )
    return (r.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[updateMessagingPartnerAiVisionBgIdleFromPg]', e)
    return false
  }
}

export async function emergencyDisablePartnerAiVisionFromPg(
  partnerId: string,
  finishedAt: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const r = await getPgPool().query(
      `update public.messaging_partner_ai_settings set
        vision_product_search_enabled = false,
        image_search_api_enabled = false,
        vision_bg_sync_status = 'idle',
        vision_bg_sync_resume_after_id = null,
        vision_bg_sync_rounds = 0,
        vision_bg_sync_imported = 0,
        vision_bg_sync_removed = 0,
        vision_bg_sync_started_at = null,
        vision_bg_sync_finished_at = $2::timestamptz,
        vision_bg_sync_error = 'Vision disabled by emergency kill switch.',
        vision_bg_sync_report = '',
        updated_at = $2::timestamptz
       where partner_id = $1::uuid`,
      [partnerId, finishedAt]
    )
    return (r.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[emergencyDisablePartnerAiVisionFromPg]', e)
    return false
  }
}

/**
 * Có dòng settings: trả `secret` (có thể null). Không có dòng / lỗi: `null` → caller xử lý khi không có PG.
 */
export async function peekMessagingPartnerAiImageSearchSecretFromPg(
  partnerId: string
): Promise<{ secret: string | null } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ s: string | null }>(
      `select image_search_api_secret as s from public.messaging_partner_ai_settings
       where partner_id = $1::uuid limit 1`,
      [partnerId]
    )
    if (!row) return null
    const t = row.s?.trim()
    return { secret: t || null }
  } catch (e) {
    console.warn('[peekMessagingPartnerAiImageSearchSecretFromPg]', e)
    return null
  }
}
