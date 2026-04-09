import type { Database } from '@/types/database.types'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type MessagingPartnerFaqRow = Database['public']['Tables']['messaging_partner_faq']['Row']

type PgFaqRaw = {
  id: string
  partner_id: string
  sort_order: number | null
  trigger_keywords: string | null
  answer: string | null
  is_active: boolean | null
  preset_key: string | null
  custom_title: string | null
  created_at: unknown
  updated_at: unknown
}

function tsIsoReq(v: unknown): string {
  if (v instanceof Date) return v.toISOString()
  return String(v ?? '')
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return fallback
}

const FAQ_SELECT = `select id::text, partner_id::text, sort_order,
              coalesce(trigger_keywords, '') as trigger_keywords,
              coalesce(answer, '') as answer,
              coalesce(is_active, true) as is_active,
              preset_key,
              coalesce(custom_title, '') as custom_title,
              created_at, updated_at
       from public.messaging_partner_faq`

function mapPgFaqRows(rows: PgFaqRaw[]): MessagingPartnerFaqRow[] {
  return rows.map((r) => ({
    id: r.id,
    partner_id: r.partner_id,
    sort_order: num(r.sort_order, 0),
    trigger_keywords: String(r.trigger_keywords ?? ''),
    answer: String(r.answer ?? ''),
    is_active: r.is_active !== false,
    preset_key: r.preset_key ?? null,
    custom_title: String(r.custom_title ?? ''),
    created_at: tsIsoReq(r.created_at),
    updated_at: tsIsoReq(r.updated_at),
  }))
}

/**
 * FAQ active của partner (Postgres). `null` = không pool hoặc lỗi — caller caller xử lý khi không có PG.
 */
export async function fetchMessagingPartnerFaqsActiveFromPg(
  partnerId: string
): Promise<MessagingPartnerFaqRow[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<PgFaqRaw>(
      `${FAQ_SELECT}
       where partner_id = $1::uuid and coalesce(is_active, true) = true
       order by sort_order asc`,
      [partnerId]
    )
    return mapPgFaqRows(rows)
  } catch (e) {
    console.warn('[fetchMessagingPartnerFaqsActiveFromPg]', e)
    return null
  }
}

/**
 * Toàn bộ FAQ của partner (dashboard). `null` = không pool hoặc lỗi — caller xử lý khi không có PG.
 */
export async function fetchMessagingPartnerFaqsAllFromPg(
  partnerId: string
): Promise<MessagingPartnerFaqRow[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<PgFaqRaw>(
      `${FAQ_SELECT}
       where partner_id = $1::uuid
       order by sort_order asc`,
      [partnerId]
    )
    return mapPgFaqRows(rows)
  } catch (e) {
    console.warn('[fetchMessagingPartnerFaqsAllFromPg]', e)
    return null
  }
}

export async function fetchMessagingPartnerFaqIdByPresetFromPg(
  partnerId: string,
  presetKey: string
): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `select id::text from public.messaging_partner_faq
       where partner_id = $1::uuid and preset_key = $2
       limit 1`,
      [partnerId, presetKey]
    )
    return row?.id ?? null
  } catch (e) {
    console.warn('[fetchMessagingPartnerFaqIdByPresetFromPg]', e)
    return null
  }
}

export async function updateMessagingPartnerFaqByIdFromPg(
  partnerId: string,
  faqId: string,
  fields: {
    custom_title: string
    trigger_keywords: string
    answer: string
    sort_order: number
    is_active: boolean
    updated_at: string
  }
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const r = await getPgPool().query(
      `update public.messaging_partner_faq set
        custom_title = $3,
        trigger_keywords = $4,
        answer = $5,
        sort_order = $6,
        is_active = $7,
        updated_at = $8::timestamptz
       where id = $2::uuid and partner_id = $1::uuid`,
      [
        partnerId,
        faqId,
        fields.custom_title,
        fields.trigger_keywords,
        fields.answer,
        fields.sort_order,
        fields.is_active,
        fields.updated_at,
      ]
    )
    return (r.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[updateMessagingPartnerFaqByIdFromPg]', e)
    return false
  }
}

export async function insertMessagingPartnerFaqFromPg(fields: {
  partner_id: string
  preset_key: string | null
  custom_title: string
  trigger_keywords: string
  answer: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await getPgPool().query(
      `insert into public.messaging_partner_faq (
        partner_id, preset_key, custom_title, trigger_keywords, answer, sort_order, is_active, created_at, updated_at
      ) values ($1::uuid, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::timestamptz)`,
      [
        fields.partner_id,
        fields.preset_key,
        fields.custom_title,
        fields.trigger_keywords,
        fields.answer,
        fields.sort_order,
        fields.is_active,
        fields.created_at,
        fields.updated_at,
      ]
    )
    return true
  } catch (e) {
    console.warn('[insertMessagingPartnerFaqFromPg]', e)
    return false
  }
}

export async function updateMessagingPartnerFaqPresetRowFromPg(
  partnerId: string,
  faqId: string,
  fields: {
    custom_title: string
    answer: string
    is_active: boolean
    sort_order: number
    preset_key: string
    updated_at: string
  }
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const r = await getPgPool().query(
      `update public.messaging_partner_faq set
        custom_title = $3,
        answer = $4,
        is_active = $5,
        trigger_keywords = '',
        sort_order = $6,
        preset_key = $7,
        updated_at = $8::timestamptz
       where id = $2::uuid and partner_id = $1::uuid`,
      [
        partnerId,
        faqId,
        fields.custom_title,
        fields.answer,
        fields.is_active,
        fields.sort_order,
        fields.preset_key,
        fields.updated_at,
      ]
    )
    return (r.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[updateMessagingPartnerFaqPresetRowFromPg]', e)
    return false
  }
}

export async function deleteMessagingPartnerFaqByIdFromPg(partnerId: string, faqId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const r = await getPgPool().query(
      `delete from public.messaging_partner_faq where partner_id = $1::uuid and id = $2::uuid`,
      [partnerId, faqId]
    )
    return (r.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[deleteMessagingPartnerFaqByIdFromPg]', e)
    return false
  }
}
