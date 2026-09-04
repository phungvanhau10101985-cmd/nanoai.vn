import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import {
  defaultPartnerSaleCalendarSettings,
  type PartnerSaleCalendarSettings,
} from '@/lib/partner-website/promotions/partner-sale-calendar'

type SettingsDbRow = {
  partner_id: string
  enabled: boolean
  timezone: string
  teaser_days: number
  odd_month_discount_percent: string | number
  even_month_discount_percent: string | number
  clearance_enabled: boolean
  clearance_discount_percent: string | number
  manual_sale_date: unknown
  manual_discount_percent: string | number | null
}

type MonthDbRow = {
  month_no: number
  enabled: boolean
  discount_percent: string | number | null
}

function numberValue(value: string | number | null | undefined, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function dateOnly(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const text = String(value)
  const match = /^\d{4}-\d{2}-\d{2}/.exec(text)
  return match?.[0] ?? null
}

export type PartnerSaleCalendarConfig = PartnerSaleCalendarSettings & {
  partnerId: string
  clearanceEnabled: boolean
  clearanceDiscountPercent: number
}

export async function fetchPartnerSaleCalendarConfigFromPg(
  partnerId: string
): Promise<PartnerSaleCalendarConfig> {
  const defaults = defaultPartnerSaleCalendarSettings()
  if (!isPgConfigured()) {
    return {
      ...defaults,
      partnerId,
      clearanceEnabled: true,
      clearanceDiscountPercent: 20,
    }
  }
  const [row, monthRows] = await Promise.all([
    pgQueryOne<SettingsDbRow>(
      `select partner_id::text, enabled, timezone, teaser_days,
              odd_month_discount_percent, even_month_discount_percent,
              clearance_enabled, clearance_discount_percent,
              manual_sale_date, manual_discount_percent
       from public.messaging_partner_sale_calendar_settings
       where partner_id = $1::uuid`,
      [partnerId]
    ).catch(() => null),
    pgQuery<MonthDbRow>(
      `select month_no, enabled, discount_percent
       from public.messaging_partner_sale_calendar_month_rules
       where partner_id = $1::uuid`,
      [partnerId]
    ).catch(() => []),
  ])
  const monthRules: PartnerSaleCalendarSettings['monthRules'] = {}
  for (const item of monthRows) {
    monthRules[item.month_no] = {
      enabled: item.enabled !== false,
      discountPercent: item.discount_percent == null ? null : numberValue(item.discount_percent),
    }
  }
  return {
    partnerId,
    enabled: row?.enabled !== false,
    timezone: row?.timezone || defaults.timezone,
    teaserDays: Math.max(0, row?.teaser_days ?? defaults.teaserDays),
    oddMonthDiscountPercent: numberValue(row?.odd_month_discount_percent, defaults.oddMonthDiscountPercent),
    evenMonthDiscountPercent: numberValue(row?.even_month_discount_percent, defaults.evenMonthDiscountPercent),
    manualSaleDate: dateOnly(row?.manual_sale_date),
    manualDiscountPercent:
      row?.manual_discount_percent == null ? null : numberValue(row.manual_discount_percent),
    monthRules,
    clearanceEnabled: row?.clearance_enabled !== false,
    clearanceDiscountPercent: numberValue(row?.clearance_discount_percent, 20),
  }
}

export async function upsertPartnerSaleCalendarConfigFromPg(input: {
  partnerId: string
  settings: Omit<PartnerSaleCalendarConfig, 'partnerId' | 'monthRules'>
  monthRules?: PartnerSaleCalendarSettings['monthRules']
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  await pgQuery(
    `insert into public.messaging_partner_sale_calendar_settings (
       partner_id, enabled, timezone, teaser_days, odd_month_discount_percent,
       even_month_discount_percent, clearance_enabled, clearance_discount_percent,
       manual_sale_date, manual_discount_percent, updated_at
     ) values ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9::date,$10,now())
     on conflict (partner_id) do update set
       enabled = excluded.enabled, timezone = excluded.timezone,
       teaser_days = excluded.teaser_days,
       odd_month_discount_percent = excluded.odd_month_discount_percent,
       even_month_discount_percent = excluded.even_month_discount_percent,
       clearance_enabled = excluded.clearance_enabled,
       clearance_discount_percent = excluded.clearance_discount_percent,
       manual_sale_date = excluded.manual_sale_date,
       manual_discount_percent = excluded.manual_discount_percent,
       updated_at = now()`,
    [
      input.partnerId,
      input.settings.enabled,
      input.settings.timezone,
      input.settings.teaserDays,
      input.settings.oddMonthDiscountPercent,
      input.settings.evenMonthDiscountPercent,
      input.settings.clearanceEnabled,
      input.settings.clearanceDiscountPercent,
      input.settings.manualSaleDate,
      input.settings.manualDiscountPercent,
    ]
  )
  for (const [monthText, rule] of Object.entries(input.monthRules ?? {})) {
    const month = Number(monthText)
    if (!rule || month < 1 || month > 12) continue
    await pgQuery(
      `insert into public.messaging_partner_sale_calendar_month_rules
         (partner_id, month_no, enabled, discount_percent)
       values ($1::uuid,$2,$3,$4)
       on conflict (partner_id, month_no) do update set
         enabled = excluded.enabled, discount_percent = excluded.discount_percent`,
      [input.partnerId, month, rule.enabled, rule.discountPercent]
    )
  }
  return true
}
