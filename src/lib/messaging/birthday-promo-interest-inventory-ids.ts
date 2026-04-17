import { pgQuery } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchPartnerInventoryRowByProductUrlNormKeyFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { fetchConsultedProductUrlKeysByRecencyFromPg } from '@/lib/db/customer-care-pg'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Gom tối đa `limit` mã kho: đơn hàng (đặt qua chat) + SP đã bấm «Tư vấn» trong các hội thoại với shop.
 */
export async function collectInterestInventoryIdsForPartnerUserFromPg(input: {
  partnerId: string
  userId: string
  limit: number
}): Promise<string[]> {
  const lim = Math.max(1, Math.min(20, Math.floor(input.limit) || 10))
  if (!isPgConfigured()) return []
  const ids = new Set<string>()

  try {
    const orderRows = await pgQuery<{ iid: string | null }>(
      `select o.product_inventory_id::text as iid
       from public.messaging_partner_orders o
       join auth.users u on u.id = $2::uuid
         and lower(trim(o.customer_email)) = lower(trim(coalesce(u.email, '')))
       where o.partner_id = $1::uuid
         and o.product_inventory_id is not null
       order by o.updated_at desc nulls last
       limit 30`,
      [input.partnerId, input.userId]
    )
    for (const r of orderRows) {
      const id = String(r.iid ?? '').trim()
      if (UUID_RE.test(id)) ids.add(id)
      if (ids.size >= lim) return [...ids]
    }
  } catch (e) {
    console.warn('[collectInterestInventoryIds] orders', e)
  }

  try {
    const convRows = await pgQuery<{ id: string }>(
      `select c.id::text as id
       from public.customer_care_conversations c
       where c.partner_id = $1::uuid
         and c.linked_user_id = $2::uuid
       order by c.updated_at desc nulls last
       limit 15`,
      [input.partnerId, input.userId]
    )
    for (const conv of convRows) {
      const keys = await fetchConsultedProductUrlKeysByRecencyFromPg(conv.id, 8)
      if (!keys?.length) continue
      for (const k of keys) {
        const row = await fetchPartnerInventoryRowByProductUrlNormKeyFromPg(input.partnerId, k)
        const id = row?.id?.trim()
        if (id && UUID_RE.test(id)) ids.add(id)
        if (ids.size >= lim) return [...ids]
      }
    }
  } catch (e) {
    console.warn('[collectInterestInventoryIds] consulted', e)
  }

  return [...ids].slice(0, lim)
}

/** Số ngày tính từ hôm nay đến sinh nhật **năm nay** hoặc **năm sau** (calendar local). */
export function daysUntilNextBirthday(birthDateYmd: string, now = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDateYmd.trim())
  if (!m) return null
  const month = Number(m[2])
  const day = Number(m[3])
  if (!Number.isFinite(month) || !Number.isFinite(day) || month < 1 || month > 12) return null
  const y = now.getFullYear()
  const cand = new Date(y, month - 1, day)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let next = cand
  if (next < today) next = new Date(y + 1, month - 1, day)
  return Math.round((next.getTime() - today.getTime()) / 86400000)
}

export function isInBirthdayOfferWindow(
  daysUntil: number,
  offerDaysBeforeMax: number,
  offerDaysBeforeMin: number
): boolean {
  // Đúng ngày sinh nhật (0 ngày nữa tới SN): vẫn trong chương trình — mốc "đến ngày đó".
  if (daysUntil === 0) return true
  const a = Math.max(1, Math.min(120, offerDaysBeforeMax))
  const b = Math.max(1, Math.min(120, offerDaysBeforeMin))
  const hi = Math.max(a, b)
  const lo = Math.min(a, b)
  return daysUntil >= lo && daysUntil <= hi
}

/** Một lần gửi / mỗi (partner, user, năm sinh nhật sắp tới). */
export function birthdayCampaignKey(nextBirthdayYmd: string): string {
  return `bday_${nextBirthdayYmd.replace(/-/g, '')}`
}

export function nextBirthdayIsoFromProfileYmd(birthDateYmd: string, now = new Date()): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDateYmd.trim())
  if (!m) return null
  const month = Number(m[2])
  const day = Number(m[3])
  const y = now.getFullYear()
  let next = new Date(y, month - 1, day)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (next < today) next = new Date(y + 1, month - 1, day)
  const yy = next.getFullYear()
  const mm = String(next.getMonth() + 1).padStart(2, '0')
  const dd = String(next.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}
