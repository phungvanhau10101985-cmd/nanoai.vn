import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { bumpInventoryCacheLater, SITE_META_TTL_SEC, withInventoryShopCache } from '@/lib/cache/partner-shop-cache'
import {
  isPartnerHolidayThemeId,
  PARTNER_HOLIDAY_CATALOG,
  PARTNER_HOLIDAY_THEME_IDS,
  type PartnerHolidayThemeId,
} from '@/lib/partner-website/promotions/partner-holiday-schedule'
import { PARTNER_HOLIDAY_PREVIEW_TTL_SECONDS } from '@/lib/partner-website/promotions/partner-holiday-preview'

export type PartnerHolidayOccasionDbRow = {
  partnerId: string
  code: PartnerHolidayThemeId
  enabled: boolean
  startMonth: number
  startDay: number
  endMonth: number
  endDay: number
  leadDays: number
  afterDays: number
  salePercent: number
  saleLeadDays: number | null
  saleDays: number | null
}

export type PartnerHolidayPreviewRow = {
  partnerId: string
  code: PartnerHolidayThemeId
  adminId: string | null
  expiresAt: number
}

type OccasionSqlRow = {
  partner_id: string
  code: string
  enabled: boolean
  start_month: number
  start_day: number
  end_month: number
  end_day: number
  lead_days: number
  after_days: number
  sale_percent: string | number
  sale_lead_days: number | null
  sale_days: number | null
}

function mapOccasion(row: OccasionSqlRow): PartnerHolidayOccasionDbRow | null {
  if (!isPartnerHolidayThemeId(row.code)) return null
  return {
    partnerId: String(row.partner_id),
    code: row.code,
    enabled: row.enabled !== false,
    startMonth: Number(row.start_month),
    startDay: Number(row.start_day),
    endMonth: Number(row.end_month),
    endDay: Number(row.end_day),
    leadDays: Number(row.lead_days) || 0,
    afterDays: Number(row.after_days) || 0,
    salePercent: Number(row.sale_percent) || 0,
    saleLeadDays: row.sale_lead_days == null ? null : Number(row.sale_lead_days),
    saleDays: row.sale_days == null ? null : Number(row.sale_days),
  }
}

export async function ensurePartnerHolidayOccasionRowsFromPg(partnerId: string): Promise<void> {
  if (!isPgConfigured()) return
  const existing = await pgQuery<{ code: string }>(
    `select code from public.messaging_partner_holiday_occasion_settings where partner_id = $1::uuid`,
    [partnerId]
  ).catch(() => [])
  const have = new Set(existing.map((row) => row.code))
  const missing = PARTNER_HOLIDAY_THEME_IDS.filter((code) => !have.has(code))
  if (!missing.length) return
  for (const code of missing) {
    const rule = PARTNER_HOLIDAY_CATALOG[code]
    await pgQuery(
      `insert into public.messaging_partner_holiday_occasion_settings (
         partner_id, code, enabled, start_month, start_day, end_month, end_day,
         lead_days, after_days, sale_percent, updated_at
       ) values ($1::uuid,$2,true,$3,$4,$5,$6,$7,$8,$9,now())
       on conflict (partner_id, code) do nothing`,
      [
        partnerId,
        code,
        rule.startMonth,
        rule.startDay,
        rule.endMonth,
        rule.endDay,
        rule.leadDays,
        rule.afterDays,
        rule.salePercent,
      ]
    ).catch(() => undefined)
  }
}

async function fetchOccasionRowsUncached(partnerId: string): Promise<PartnerHolidayOccasionDbRow[]> {
  if (!isPgConfigured()) return []
  await ensurePartnerHolidayOccasionRowsFromPg(partnerId)
  const rows = await pgQuery<OccasionSqlRow>(
    `select partner_id::text, code, enabled, start_month, start_day, end_month, end_day,
            lead_days, after_days, sale_percent, sale_lead_days, sale_days
     from public.messaging_partner_holiday_occasion_settings
     where partner_id = $1::uuid`,
    [partnerId]
  ).catch(() => [])
  return rows.map(mapOccasion).filter((row): row is PartnerHolidayOccasionDbRow => Boolean(row))
}

export async function fetchPartnerHolidayOccasionRowsFromPg(
  partnerId: string
): Promise<PartnerHolidayOccasionDbRow[]> {
  if (!isPgConfigured()) return []
  return withInventoryShopCache({
    partnerId,
    kind: 'shop',
    suffix: 'holiday-occ',
    ttlSec: SITE_META_TTL_SEC,
    load: () => fetchOccasionRowsUncached(partnerId),
  })
}

export async function upsertPartnerHolidayOccasionFromPg(input: {
  partnerId: string
  code: PartnerHolidayThemeId
  enabled?: boolean
  startMonth?: number
  startDay?: number
  endMonth?: number
  endDay?: number
  leadDays?: number
  afterDays?: number
  salePercent?: number
  saleLeadDays?: number | null
  saleDays?: number | null
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  await ensurePartnerHolidayOccasionRowsFromPg(input.partnerId)
  const current = (await fetchOccasionRowsUncached(input.partnerId)).find((row) => row.code === input.code)
  const rule = PARTNER_HOLIDAY_CATALOG[input.code]
  const enabled = input.enabled ?? current?.enabled ?? true
  const startMonth = input.startMonth ?? current?.startMonth ?? rule.startMonth
  const startDay = input.startDay ?? current?.startDay ?? rule.startDay
  const endMonth = input.endMonth ?? current?.endMonth ?? rule.endMonth
  const endDay = input.endDay ?? current?.endDay ?? rule.endDay
  const leadDays = input.leadDays ?? current?.leadDays ?? rule.leadDays
  const afterDays = input.afterDays ?? current?.afterDays ?? rule.afterDays
  const salePercent = input.salePercent ?? current?.salePercent ?? rule.salePercent
  const saleLeadDays =
    input.saleLeadDays === undefined
      ? current?.saleLeadDays ?? null
      : input.saleLeadDays == null || input.saleLeadDays <= 0
        ? null
        : input.saleLeadDays
  const saleDays =
    input.saleDays === undefined
      ? current?.saleDays ?? null
      : input.saleDays == null || input.saleDays <= 0
        ? null
        : input.saleDays
  await pgQuery(
    `insert into public.messaging_partner_holiday_occasion_settings (
       partner_id, code, enabled, start_month, start_day, end_month, end_day,
       lead_days, after_days, sale_percent, sale_lead_days, sale_days, updated_at
     ) values ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
     on conflict (partner_id, code) do update set
       enabled = excluded.enabled,
       start_month = excluded.start_month,
       start_day = excluded.start_day,
       end_month = excluded.end_month,
       end_day = excluded.end_day,
       lead_days = excluded.lead_days,
       after_days = excluded.after_days,
       sale_percent = excluded.sale_percent,
       sale_lead_days = excluded.sale_lead_days,
       sale_days = excluded.sale_days,
       updated_at = now()`,
    [
      input.partnerId,
      input.code,
      enabled,
      startMonth,
      startDay,
      endMonth,
      endDay,
      leadDays,
      afterDays,
      salePercent,
      saleLeadDays,
      saleDays,
    ]
  )
  bumpInventoryCacheLater(input.partnerId)
  return true
}

function coercePreviewExpiry(value: unknown, now = Date.now()): number | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(String(value))
  const ms = date.getTime()
  if (!Number.isFinite(ms) || ms <= now) return null
  return Math.floor(ms / 1000)
}

export async function fetchPartnerHolidayPreviewFromPg(
  partnerId: string
): Promise<PartnerHolidayPreviewRow | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<{
    preview_code: string | null
    preview_admin_id: string | null
    preview_expires_at: unknown
  }>(
    `select preview_code, preview_admin_id::text, preview_expires_at
     from public.messaging_partner_holiday_theme_settings
     where partner_id = $1::uuid`,
    [partnerId]
  ).catch(() => null)
  if (!row?.preview_code || !isPartnerHolidayThemeId(row.preview_code)) return null
  const expiresAt = coercePreviewExpiry(row.preview_expires_at)
  if (!expiresAt) {
    await clearPartnerHolidayPreviewFromPg(partnerId)
    return null
  }
  return {
    partnerId,
    code: row.preview_code,
    adminId: row.preview_admin_id,
    expiresAt,
  }
}

export async function savePartnerHolidayPreviewFromPg(input: {
  partnerId: string
  code: PartnerHolidayThemeId
  adminId: string
  expiresAt: number
}): Promise<void> {
  if (!isPgConfigured()) return
  const expires = new Date(input.expiresAt * 1000)
  await pgQuery(
    `insert into public.messaging_partner_holiday_theme_settings (
       partner_id, preview_code, preview_admin_id, preview_expires_at, updated_at
     ) values ($1::uuid,$2,$3::uuid,$4,now())
     on conflict (partner_id) do update set
       preview_code = excluded.preview_code,
       preview_admin_id = excluded.preview_admin_id,
       preview_expires_at = excluded.preview_expires_at,
       updated_at = now()`,
    [input.partnerId, input.code, input.adminId, expires.toISOString()]
  )
}

export async function clearPartnerHolidayPreviewFromPg(partnerId: string): Promise<void> {
  if (!isPgConfigured()) return
  await pgQuery(
    `update public.messaging_partner_holiday_theme_settings
     set preview_code = null, preview_admin_id = null, preview_expires_at = null, updated_at = now()
     where partner_id = $1::uuid`,
    [partnerId]
  ).catch(() => undefined)
}

export function partnerHolidayPreviewTtlSeconds(): number {
  return PARTNER_HOLIDAY_PREVIEW_TTL_SECONDS
}
