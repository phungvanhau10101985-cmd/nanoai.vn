import type { Json } from '@/types/database.types'
import type { GuestProfileGender } from '@/lib/db/messaging-guest-pg'
import { fetchProfileGender } from '@/lib/db/profiles-repo'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import type { WebLocale } from '@/lib/i18n/config'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Giới tính từ `profiles` (tài khoản NanoAI) — dùng khóa cache tư vấn SP. */
export async function fetchGuestGenderForPartnerConsultCachePg(
  linkedUserId: string | null | undefined
): Promise<GuestProfileGender | null> {
  const uid = linkedUserId?.trim() ?? ''
  if (!uid || !UUID_RE.test(uid)) return null
  const g = await fetchProfileGender(uid)
  return g === 'male' || g === 'female' ? g : null
}

export async function fetchPartnerProductConsultCacheFromPg(
  partnerId: string,
  inventoryId: string,
  gender: GuestProfileGender,
  uiLocale: WebLocale
): Promise<{ message_text: string; ai_product_cards: Json } | null> {
  if (!isPgConfigured()) return null
  const pid = partnerId.trim()
  const iid = inventoryId.trim()
  if (!pid || !iid || !UUID_RE.test(iid)) return null
  try {
    const row = await pgQueryOne<{ message_text: string; ai_product_cards: Json }>(
      `select message_text, ai_product_cards
       from public.messaging_partner_product_consult_cache
       where partner_id = $1::uuid and inventory_id = $2::uuid
         and gender = $3 and ui_locale = $4
       limit 1`,
      [pid, iid, gender, uiLocale]
    )
    if (!row?.message_text?.trim()) return null
    return {
      message_text: row.message_text.trim(),
      ai_product_cards: Array.isArray(row.ai_product_cards) ? row.ai_product_cards : [],
    }
  } catch (e) {
    console.warn('[partner-product-consult-cache-pg] fetch', e)
    return null
  }
}

export async function upsertPartnerProductConsultCachePg(input: {
  partnerId: string
  inventoryId: string
  gender: GuestProfileGender
  uiLocale: WebLocale
  messageText: string
  aiProductCards: Json
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = input.partnerId.trim()
  const iid = input.inventoryId.trim()
  const msg = input.messageText.trim()
  if (!pid || !iid || !UUID_RE.test(iid) || !msg) return false
  try {
    await pgQuery(
      `insert into public.messaging_partner_product_consult_cache
         (partner_id, inventory_id, gender, ui_locale, message_text, ai_product_cards, updated_at)
       values ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, now())
       on conflict (partner_id, inventory_id, gender, ui_locale)
       do update set
         message_text = excluded.message_text,
         ai_product_cards = excluded.ai_product_cards,
         updated_at = now()`,
      [pid, iid, input.gender, input.uiLocale, msg, input.aiProductCards ?? []]
    )
    return true
  } catch (e) {
    console.warn('[partner-product-consult-cache-pg] upsert', e)
    return false
  }
}
