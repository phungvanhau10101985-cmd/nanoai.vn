import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import {
  DEFAULT_188_INVENTORY_FIELD_MAPPING,
  normalizeExternalFieldMapping,
} from '@/lib/messaging/partner-inventory-external-sync-defaults'

export type PartnerInventoryExternalSyncSettingsRow = {
  partner_id: string
  site_origin: string
  product_path_template: string
  products_list_url: string
  field_mapping: Record<string, string>
  updated_at: string
  catalog_auto_sync_enabled: boolean
  catalog_auto_sync_interval_minutes: number
  catalog_auto_sync_time_vn: string
  catalog_last_sync_at: string | null
  catalog_last_sync_error: string | null
}

const CATALOG_SYNC_INTERVAL_MIN = 15
const CATALOG_SYNC_INTERVAL_MAX = 1440

export function clampCatalogAutoSyncIntervalMinutes(raw: number): number {
  const n = Math.floor(Number(raw) || 60)
  return Math.max(CATALOG_SYNC_INTERVAL_MIN, Math.min(CATALOG_SYNC_INTERVAL_MAX, n))
}

export function normalizeCatalogAutoSyncTimeVn(raw: string | null | undefined): string {
  const value = String(raw ?? '').trim()
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  return match ? `${match[1]}:${match[2]}` : '03:00'
}

export async function fetchPartnerInventoryExternalSyncSettingsFromPg(
  partnerId: string
): Promise<PartnerInventoryExternalSyncSettingsRow | null> {
  if (!isPgConfigured()) return null
  const pid = String(partnerId ?? '').trim()
  if (!pid) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select partner_id::text,
              coalesce(site_origin, '') as site_origin,
              coalesce(product_path_template, '') as product_path_template,
              coalesce(products_list_url, '') as products_list_url,
              coalesce(field_mapping, '{}'::jsonb) as field_mapping,
              coalesce(catalog_auto_sync_enabled, false) as catalog_auto_sync_enabled,
              coalesce(catalog_auto_sync_interval_minutes, 60) as catalog_auto_sync_interval_minutes,
              coalesce(to_char(catalog_auto_sync_time_vn, 'HH24:MI'), '03:00') as catalog_auto_sync_time_vn,
              catalog_last_sync_at,
              catalog_last_sync_error,
              updated_at
       from public.messaging_partner_inventory_external_sync_settings
       where partner_id = $1::uuid
       limit 1`,
      [pid]
    )
    if (!row) return null
    const fm = normalizeExternalFieldMapping(row.field_mapping)
    return {
      partner_id: String(row.partner_id),
      site_origin: String(row.site_origin ?? '').trim(),
      product_path_template: String(row.product_path_template ?? '').trim() || '/san-pham/{slug}',
      products_list_url: String(row.products_list_url ?? '').trim(),
      field_mapping: fm,
      updated_at: String(row.updated_at ?? ''),
      catalog_auto_sync_enabled: Boolean(row.catalog_auto_sync_enabled),
      catalog_auto_sync_interval_minutes: clampCatalogAutoSyncIntervalMinutes(
        Number(row.catalog_auto_sync_interval_minutes)
      ),
      catalog_auto_sync_time_vn: normalizeCatalogAutoSyncTimeVn(String(row.catalog_auto_sync_time_vn ?? '')),
      catalog_last_sync_at: row.catalog_last_sync_at != null ? String(row.catalog_last_sync_at) : null,
      catalog_last_sync_error:
        row.catalog_last_sync_error != null && String(row.catalog_last_sync_error).trim()
          ? String(row.catalog_last_sync_error).trim()
          : null,
    }
  } catch (e) {
    const err = e as { code?: string }
    if (err.code === '42P01') return null
    console.warn('[fetchPartnerInventoryExternalSyncSettingsFromPg]', e)
    return null
  }
}

export async function upsertPartnerInventoryExternalSyncSettingsFromPg(input: {
  partnerId: string
  siteOrigin: string
  productPathTemplate: string
  productsListUrl: string
  fieldMapping: Record<string, string>
  catalogAutoSyncEnabled: boolean
  catalogAutoSyncIntervalMinutes: number
  catalogAutoSyncTimeVn: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = String(input.partnerId ?? '').trim()
  if (!pid) return false
  const siteOrigin = String(input.siteOrigin ?? '').trim().slice(0, 500)
  const productPathTemplate = String(input.productPathTemplate ?? '').trim().slice(0, 500) || '/san-pham/{slug}'
  const productsListUrl = String(input.productsListUrl ?? '').trim().slice(0, 1000)
  const fm = normalizeExternalFieldMapping(input.fieldMapping)
  const fmJson = JSON.stringify(fm)
  const autoOn = Boolean(input.catalogAutoSyncEnabled)
  const intervalMin = clampCatalogAutoSyncIntervalMinutes(input.catalogAutoSyncIntervalMinutes)
  const syncTimeVn = normalizeCatalogAutoSyncTimeVn(input.catalogAutoSyncTimeVn)
  try {
    await pgQuery(
      `insert into public.messaging_partner_inventory_external_sync_settings
        (partner_id, site_origin, product_path_template, products_list_url, field_mapping,
         catalog_auto_sync_enabled, catalog_auto_sync_interval_minutes, catalog_auto_sync_time_vn, updated_at)
       values ($1::uuid, $2, $3, $4, $5::jsonb, $6, $7, $8::time, now())
       on conflict (partner_id) do update set
         site_origin = excluded.site_origin,
         product_path_template = excluded.product_path_template,
         products_list_url = excluded.products_list_url,
         field_mapping = excluded.field_mapping,
         catalog_auto_sync_enabled = excluded.catalog_auto_sync_enabled,
         catalog_auto_sync_interval_minutes = excluded.catalog_auto_sync_interval_minutes,
         catalog_auto_sync_time_vn = excluded.catalog_auto_sync_time_vn,
         updated_at = now()`,
      [pid, siteOrigin, productPathTemplate, productsListUrl, fmJson, autoOn, intervalMin, syncTimeVn]
    )
    return true
  } catch (e) {
    const err = e as { code?: string }
    if (err.code === '42P01') return false
    console.warn('[upsertPartnerInventoryExternalSyncSettingsFromPg]', e)
    return false
  }
}

/** Trả về bản ghi với default mapping khi chưa có dòng trong DB (chỉ để UI). */
export function defaultPartnerInventoryExternalSyncSettings(partnerId: string): PartnerInventoryExternalSyncSettingsRow {
  return {
    partner_id: partnerId,
    site_origin: '',
    product_path_template: '/san-pham/{slug}',
    products_list_url: '',
    field_mapping: { ...DEFAULT_188_INVENTORY_FIELD_MAPPING },
    updated_at: '',
    catalog_auto_sync_enabled: false,
    catalog_auto_sync_interval_minutes: 60,
    catalog_auto_sync_time_vn: '03:00',
    catalog_last_sync_at: null,
    catalog_last_sync_error: null,
  }
}

/**
 * Cập nhật meta sau một lần chạy đồng bộ catalog (cron hoặc nút tay). Không đụng mapping / URL.
 */
export async function updatePartnerExternalCatalogSyncMetaFromPg(
  partnerId: string,
  patch: { success?: boolean; error?: string | null }
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = String(partnerId ?? '').trim()
  if (!pid) return false

  const isSuccess = patch.success === true
  const errRaw = patch.error

  try {
    if (isSuccess) {
      await pgQuery(
        `update public.messaging_partner_inventory_external_sync_settings
         set catalog_last_sync_at = now(),
             catalog_last_sync_error = null,
             updated_at = now()
         where partner_id = $1::uuid`,
        [pid]
      )
      return true
    }
    if (typeof errRaw === 'string' && errRaw.trim()) {
      await pgQuery(
        `update public.messaging_partner_inventory_external_sync_settings
         set catalog_last_sync_error = $2,
             updated_at = now()
         where partner_id = $1::uuid`,
        [pid, errRaw.trim().slice(0, 4000)]
      )
      return true
    }
    return false
  } catch (e) {
    const err = e as { code?: string }
    if (err.code === '42P01') return false
    console.warn('[updatePartnerExternalCatalogSyncMetaFromPg]', e)
    return false
  }
}

/** Shop cần chạy cron: bật auto-sync, có URL list, đã tới giờ chạy theo ngày Việt Nam. */
export async function fetchPartnerIdsDueForExternalCatalogSyncFromPg(
  limit: number
): Promise<string[]> {
  if (!isPgConfigured()) return []
  const lim = Math.max(1, Math.min(50, Math.floor(limit) || 8))
  try {
    const rows = await pgQuery<{ partner_id: string }>(
      `select partner_id::text as partner_id
       from public.messaging_partner_inventory_external_sync_settings
       where coalesce(catalog_auto_sync_enabled, false) = true
         and coalesce(trim(products_list_url), '') <> ''
         and (now() at time zone 'Asia/Ho_Chi_Minh')::time >= coalesce(catalog_auto_sync_time_vn, '03:00'::time)
         and (
           catalog_last_sync_at is null
           or (catalog_last_sync_at at time zone 'Asia/Ho_Chi_Minh')::date
              < (now() at time zone 'Asia/Ho_Chi_Minh')::date
         )
       order by catalog_last_sync_at nulls first
       limit $1`,
      [lim]
    )
    return rows.map((r) => String(r.partner_id ?? '').trim()).filter(Boolean)
  } catch (e) {
    const err = e as { code?: string }
    if (err.code === '42P01') return []
    console.warn('[fetchPartnerIdsDueForExternalCatalogSyncFromPg]', e)
    return []
  }
}
