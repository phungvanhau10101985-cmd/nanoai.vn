import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { daysUntilNextBirthday, isInBirthdayOfferWindow } from '@/lib/messaging/birthday-promo-interest-inventory-ids'

export type MessagingPartnerBirthdayPromoRow = {
  partner_id: string
  enabled: boolean
  discount_percent: number
  offer_days_before_max: number
  offer_days_before_min: number
  updated_at: string
}

/**
 * Khách đã liên kết (`linked_user_id`) + shop bật CMSN + có ngày sinh + đang trong khoảng ngày cài đặt trước SN.
 * Trả về % giảm (1–100) hoặc null.
 */
export async function resolveActiveBirthdayDiscountPercentForLinkedUser(
  partnerId: string,
  linkedUserId: string | null | undefined
): Promise<number | null> {
  if (!linkedUserId?.trim() || !isPgConfigured()) return null
  const promo = await fetchBirthdayPromoForPartnerFromPg(partnerId)
  if (!promo?.enabled) return null
  const pct = Math.max(0, Math.min(100, Math.floor(Number(promo.discount_percent) || 0)))
  if (pct <= 0) return null
  try {
    const row = await pgQueryOne<{ birth_date: string | null }>(
      `select birth_date::text as birth_date from public.profiles where id = $1::uuid limit 1`,
      [linkedUserId.trim()]
    )
    const bd = String(row?.birth_date ?? '').trim().slice(0, 10)
    if (!bd) return null
    const daysUntil = daysUntilNextBirthday(bd)
    if (daysUntil == null) return null
    if (
      !isInBirthdayOfferWindow(daysUntil, promo.offer_days_before_max, promo.offer_days_before_min)
    ) {
      return null
    }
    return pct
  } catch (e) {
    console.warn('[resolveActiveBirthdayDiscountPercentForLinkedUser]', e)
    return null
  }
}

export async function fetchBirthdayPromoForPartnerFromPg(
  partnerId: string
): Promise<MessagingPartnerBirthdayPromoRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<MessagingPartnerBirthdayPromoRow>(
      `select
        partner_id::text,
        coalesce(enabled, false) as enabled,
        discount_percent::int,
        offer_days_before_max::int,
        offer_days_before_min::int,
        updated_at::text
       from public.messaging_partner_birthday_promo
       where partner_id = $1::uuid
       limit 1`,
      [partnerId]
    )
    return row
  } catch (e) {
    console.warn('[fetchBirthdayPromoForPartnerFromPg]', e)
    return null
  }
}

export async function upsertBirthdayPromoForPartnerFromPg(input: {
  partnerId: string
  enabled: boolean
  discountPercent: number
  offerDaysBeforeMax: number
  offerDaysBeforeMin: number
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const dp = Math.max(0, Math.min(100, Math.floor(Number(input.discountPercent) || 0)))
  let dmax = Math.max(1, Math.min(120, Math.floor(Number(input.offerDaysBeforeMax) || 7)))
  let dmin = Math.max(1, Math.min(120, Math.floor(Number(input.offerDaysBeforeMin) || 1)))
  if (dmax < dmin) [dmin, dmax] = [dmax, dmin]
  try {
    const pool = getPgPool()
    await pool.query(
      `insert into public.messaging_partner_birthday_promo (
        partner_id, enabled, discount_percent, offer_days_before_max, offer_days_before_min, updated_at
      ) values ($1::uuid, $2, $3, $4, $5, now())
      on conflict (partner_id) do update set
        enabled = excluded.enabled,
        discount_percent = excluded.discount_percent,
        offer_days_before_max = excluded.offer_days_before_max,
        offer_days_before_min = excluded.offer_days_before_min,
        updated_at = now()`,
      [input.partnerId, input.enabled, dp, dmax, dmin]
    )
    return true
  } catch (e) {
    console.warn('[upsertBirthdayPromoForPartnerFromPg]', e)
    return false
  }
}

/**
 * Đặt chỗ gửi email (insert trước khi SMTP). Trả về true nếu giành được slot (chưa gửi campaign này).
 * Dùng cùng releaseBirthdayEmailSlotFromPg nếu gửi thất bại để cron sau retry được.
 */
export async function tryClaimBirthdayEmailSlotFromPg(input: {
  partnerId: string
  recipientUserId: string
  campaignKey: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const pool = getPgPool()
    const r = await pool.query<{ id: string }>(
      `insert into public.messaging_partner_birthday_email_sent (partner_id, recipient_user_id, campaign_key)
       values ($1::uuid, $2::uuid, $3)
       on conflict (partner_id, recipient_user_id, campaign_key) do nothing
       returning id::text`,
      [input.partnerId, input.recipientUserId, input.campaignKey.slice(0, 64)]
    )
    return r.rowCount === 1
  } catch (e) {
    console.warn('[tryClaimBirthdayEmailSlotFromPg]', e)
    return false
  }
}

export async function releaseBirthdayEmailSlotFromPg(input: {
  partnerId: string
  recipientUserId: string
  campaignKey: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const pool = getPgPool()
    await pool.query(
      `delete from public.messaging_partner_birthday_email_sent
       where partner_id = $1::uuid and recipient_user_id = $2::uuid and campaign_key = $3`,
      [input.partnerId, input.recipientUserId, input.campaignKey.slice(0, 64)]
    )
    return true
  } catch (e) {
    console.warn('[releaseBirthdayEmailSlotFromPg]', e)
    return false
  }
}

/** Khách đã chat (linked_user_id) + có ngày sinh trên profiles. */
export type BirthdayEligibleUserRow = {
  user_id: string
  birth_date: string
  email: string
}

export async function listPartnersWithBirthdayPromoEnabledFromPg(): Promise<
  { partner_id: string; slug: string; display_name: string }[] | null
> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{ partner_id: string; slug: string; display_name: string }>(
      `select p.id::text as partner_id, p.slug, coalesce(p.display_name, '') as display_name
       from public.messaging_partner_birthday_promo b
       join public.messaging_partners p on p.id = b.partner_id
       where b.enabled = true
         and p.is_active = true
         and p.purge_at is null
         and coalesce(p.slug, '') <> ''`
    )
    return rows
  } catch (e) {
    console.warn('[listPartnersWithBirthdayPromoEnabledFromPg]', e)
    return null
  }
}

export async function listBirthdayEligibleUsersForPartnerFromPg(
  partnerId: string
): Promise<BirthdayEligibleUserRow[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{ user_id: string; birth_date: string; email: string }>(
      `select distinct on (p.id)
        p.id::text as user_id,
        p.birth_date::text as birth_date,
        lower(trim(u.email)) as email
       from public.customer_care_conversations c
       join public.profiles p on p.id = c.linked_user_id
       join auth.users u on u.id = p.id
       where c.partner_id = $1::uuid
         and c.linked_user_id is not null
         and p.birth_date is not null
         and coalesce(trim(u.email), '') <> ''
       order by p.id, c.updated_at desc nulls last`,
      [partnerId]
    )
    const out: BirthdayEligibleUserRow[] = []
    for (const r of rows) {
      const em = String(r.email ?? '').trim().toLowerCase()
      const bd = String(r.birth_date ?? '').trim().slice(0, 10)
      const uid = String(r.user_id ?? '').trim()
      if (!em || !bd || !uid) continue
      out.push({ user_id: uid, birth_date: bd, email: em })
    }
    return out
  } catch (e) {
    console.warn('[listBirthdayEligibleUsersForPartnerFromPg]', e)
    return null
  }
}
