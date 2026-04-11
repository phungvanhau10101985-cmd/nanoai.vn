import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

/**
 * Đọc `value_json` từ Postgres (trực tiếp, không qua HTTP API công khai cũ).
 * Trả `null` nếu không có DATABASE_URL, lỗi, hoặc không có dòng.
 */
export async function loadAdminIntegrationsValueJsonByKey(key: string): Promise<unknown | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ value_json: unknown }>(
      'select value_json from public.admin_integrations_settings where key = $1 limit 1',
      [key]
    )
    if (!row) return null
    return row.value_json ?? null
  } catch (e) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: unknown }).code || '') : ''
    if (code === '42P01') {
      // Local DB may not have migrations yet; fallback to defaults without noisy stacktrace.
      console.warn('[loadAdminIntegrationsValueJsonByKey] missing table public.admin_integrations_settings')
      return null
    }
    console.warn('[loadAdminIntegrationsValueJsonByKey]', e)
    return null
  }
}

/**
 * Ghi `value_json` qua Postgres (UPSERT). Chỉ gọi khi `isPgConfigured()`.
 */
export async function upsertAdminIntegrationsValueJson(
  key: string,
  valueJson: unknown,
  updatedBy: string | null
): Promise<{ ok: true } | { error: string }> {
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set' }
  }
  try {
    const pool = getPgPool()
    await pool.query(
      `insert into public.admin_integrations_settings (key, value_json, updated_by, updated_at)
       values ($1, $2::jsonb, $3::uuid, timezone('utc'::text, now()))
       on conflict (key) do update set
         value_json = excluded.value_json,
         updated_by = excluded.updated_by,
         updated_at = excluded.updated_at`,
      [key, JSON.stringify(valueJson ?? {}), updatedBy]
    )
    return { ok: true }
  } catch (e) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: unknown }).code || '') : ''
    if (code === '42P01') {
      return { error: 'missing_table_admin_integrations_settings' }
    }
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[upsertAdminIntegrationsValueJson]', e)
    return { error: msg }
  }
}
