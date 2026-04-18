import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type PartnerGoogleSheetsSettingsRow = {
  partner_id: string
  enabled: boolean
  spreadsheet_id: string
  sheet_name: string
  updated_at: string
  /** true nếu đã lưu JSON service account (không trả nội dung ra client). */
  has_service_account: boolean
}

export type PartnerGoogleSheetsSettingsSyncRow = {
  enabled: boolean
  spreadsheet_id: string
  sheet_name: string
  service_account_json: string | null
}

export async function fetchPartnerGoogleSheetsSettingsFromPg(
  partnerId: string
): Promise<PartnerGoogleSheetsSettingsRow | null> {
  if (!isPgConfigured()) return null
  const pid = String(partnerId ?? '').trim()
  if (!pid) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select partner_id::text, enabled,
              coalesce(spreadsheet_id, '') as spreadsheet_id,
              coalesce(sheet_name, '') as sheet_name,
              updated_at,
              (coalesce(trim(service_account_json), '') <> '') as has_service_account
       from public.messaging_partner_google_sheets_settings
       where partner_id = $1::uuid
       limit 1`,
      [pid]
    )
    if (!row) return null
    return {
      partner_id: String(row.partner_id),
      enabled: row.enabled === true,
      spreadsheet_id: String(row.spreadsheet_id ?? '').trim(),
      sheet_name: String(row.sheet_name ?? '').trim() || 'Don hang',
      updated_at: String(row.updated_at ?? ''),
      has_service_account: row.has_service_account === true,
    }
  } catch (e) {
    const err = e as { code?: string; message?: string }
    if (err.code === '42P01') return null
    console.warn('[fetchPartnerGoogleSheetsSettingsFromPg]', e)
    return null
  }
}

/** Chỉ dùng server-side — đọc JSON để merge khi lưu cài đặt. */
export async function fetchPartnerGoogleSheetsServiceAccountJsonFromPg(
  partnerId: string
): Promise<string | null> {
  if (!isPgConfigured()) return null
  const pid = String(partnerId ?? '').trim()
  if (!pid) return null
  try {
    const row = await pgQueryOne<{ j: string | null }>(
      `select service_account_json as j
       from public.messaging_partner_google_sheets_settings
       where partner_id = $1::uuid
       limit 1`,
      [pid]
    )
    const j = row?.j != null ? String(row.j).trim() : ''
    return j || null
  } catch (e) {
    const err = e as { code?: string }
    if (err.code === '42P01') return null
    console.warn('[fetchPartnerGoogleSheetsServiceAccountJsonFromPg]', e)
    return null
  }
}

/** Đồng bộ đơn — ưu tiên JSON của shop, sau đó (tùy host) biến môi trường. */
export async function fetchPartnerGoogleSheetsSettingsForSyncFromPg(
  partnerId: string
): Promise<PartnerGoogleSheetsSettingsSyncRow | null> {
  if (!isPgConfigured()) return null
  const pid = String(partnerId ?? '').trim()
  if (!pid) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select enabled,
              coalesce(spreadsheet_id, '') as spreadsheet_id,
              coalesce(sheet_name, '') as sheet_name,
              service_account_json
       from public.messaging_partner_google_sheets_settings
       where partner_id = $1::uuid
       limit 1`,
      [pid]
    )
    if (!row) return null
    const raw = row.service_account_json != null ? String(row.service_account_json).trim() : ''
    return {
      enabled: row.enabled === true,
      spreadsheet_id: String(row.spreadsheet_id ?? '').trim(),
      sheet_name: String(row.sheet_name ?? '').trim() || 'Don hang',
      service_account_json: raw || null,
    }
  } catch (e) {
    const err = e as { code?: string }
    if (err.code === '42P01') return null
    console.warn('[fetchPartnerGoogleSheetsSettingsForSyncFromPg]', e)
    return null
  }
}

export async function upsertPartnerGoogleSheetsSettingsFromPg(input: {
  partnerId: string
  enabled: boolean
  spreadsheetId: string
  sheetName: string
  /** Giá trị cuối cùng sau khi merge ở tầng action (null = không còn key). */
  serviceAccountJson: string | null
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = String(input.partnerId ?? '').trim()
  if (!pid) return false
  const sid = String(input.spreadsheetId ?? '').trim().slice(0, 120)
  const sn = String(input.sheetName ?? '').trim().slice(0, 80) || 'Don hang'
  const saj = input.serviceAccountJson != null ? String(input.serviceAccountJson).trim() : null
  try {
    await pgQuery(
      `insert into public.messaging_partner_google_sheets_settings (
         partner_id, enabled, spreadsheet_id, sheet_name, service_account_json, updated_at
       ) values ($1::uuid, $2, $3, $4, $5, now())
       on conflict (partner_id) do update set
         enabled = excluded.enabled,
         spreadsheet_id = excluded.spreadsheet_id,
         sheet_name = excluded.sheet_name,
         service_account_json = excluded.service_account_json,
         updated_at = now()`,
      [pid, input.enabled === true, sid, sn, saj]
    )
    return true
  } catch (e) {
    console.warn('[upsertPartnerGoogleSheetsSettingsFromPg]', e)
    return false
  }
}

export async function updatePartnerOrderGoogleSheetRowFromPg(input: {
  partnerId: string
  orderId: string
  sheetRow: number | null
  /** Số hàng trên Sheet (≥1); null = không đổi / legacy. */
  sheetRowCount?: number | null
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const oid = String(input.orderId ?? '').trim()
  const pid = String(input.partnerId ?? '').trim()
  if (!oid || !pid) return false
  const row =
    input.sheetRow != null && Number.isFinite(input.sheetRow) && input.sheetRow > 0
      ? Math.floor(input.sheetRow)
      : null
  const cntRaw = input.sheetRowCount
  const cnt =
    cntRaw != null && Number.isFinite(cntRaw) && Math.floor(cntRaw) > 0 ? Math.floor(cntRaw) : null
  try {
    const res = await pgQueryOne<{ ok: string }>(
      `update public.messaging_partner_orders
       set google_sheet_row = $3,
           google_sheet_row_count = coalesce($4::integer, google_sheet_row_count)
       where id = $1::uuid and partner_id = $2::uuid
       returning id::text as ok`,
      [oid, pid, row, cnt]
    )
    return Boolean(res?.ok)
  } catch (e) {
    console.warn('[updatePartnerOrderGoogleSheetRowFromPg]', e)
    return false
  }
}
