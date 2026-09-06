import { getAuthUserEmailFromPg } from '@/lib/db/auth-user-email-pg'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { resolvePartnerBirthdayFeatureTestPercentFromPg } from '@/lib/db/messaging-partner-feature-test-pg'
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
  return resolveActiveBirthdayDiscountPercentForCustomer({
    partnerId,
    linkedUserId,
  })
}

export async function resolveActiveBirthdayDiscountPercentForCustomer(input: {
  partnerId: string
  linkedUserId?: string | null
  emailNormalized?: string | null
}): Promise<number | null> {
  const linkedUserId = String(input.linkedUserId ?? '').trim()
  let email = String(input.emailNormalized ?? '').trim().toLowerCase().slice(0, 180)
  if ((!linkedUserId && !email) || !isPgConfigured()) return null
  const partnerId = input.partnerId
  const promo = await fetchBirthdayPromoForPartnerFromPg(partnerId)
  const configuredPct = Math.max(0, Math.min(100, Math.floor(Number(promo?.discount_percent) || 0)))

  if (promo?.enabled && configuredPct > 0) {
    try {
      const row = linkedUserId
        ? await pgQueryOne<{ birth_date: string | null }>(
            `select birth_date::text as birth_date
             from public.profiles where id = $1::uuid limit 1`,
            [linkedUserId]
          )
        : null
      const partnerProfile = !row?.birth_date && email
        ? await pgQueryOne<{ birth_date: string | null }>(
            `select date_of_birth::text as birth_date
             from public.messaging_partner_customer_profiles
             where partner_id = $1::uuid and email_normalized = $2
             limit 1`,
            [partnerId, email]
          ).catch(() => null)
        : null
      const bd = String(row?.birth_date ?? partnerProfile?.birth_date ?? '').trim().slice(0, 10)
      if (bd) {
        const daysUntil = daysUntilNextBirthday(bd)
        if (
          daysUntil != null &&
          isInBirthdayOfferWindow(daysUntil, promo.offer_days_before_max, promo.offer_days_before_min)
        ) {
          return configuredPct
        }
      }
    } catch (e) {
      console.warn('[resolveActiveBirthdayDiscountPercentForCustomer]', e)
    }
  }

  if (!email && linkedUserId) {
    email = (await getAuthUserEmailFromPg(linkedUserId))?.trim().toLowerCase() ?? ''
  }
  return resolvePartnerBirthdayFeatureTestPercentFromPg({
    partnerId,
    visitorEmail: email,
    configuredPercent: configuredPct,
  })
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

const AUTH_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function authUserIdFromRecipientKey(key: string): string | null {
  if (!key.startsWith('user:')) return null
  const id = key.slice(5)
  return AUTH_UUID_RE.test(id) ? id : null
}

/**
 * Đặt chỗ gửi email (insert trước khi SMTP). Trả về true nếu giành được slot (chưa gửi campaign này).
 * Dùng cùng releaseBirthdayEmailSlotFromPg nếu gửi thất bại để cron sau retry được.
 */
export async function tryClaimBirthdayEmailSlotFromPg(input: {
  partnerId: string
  recipientKey: string
  campaignKey: string
  recipientEmail?: string | null
  /** @deprecated dùng recipientKey */
  recipientUserId?: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const recipientKey = (input.recipientKey || (input.recipientUserId ? `user:${input.recipientUserId}` : '')).slice(
    0,
    160
  )
  if (!recipientKey) return false
  const userId = authUserIdFromRecipientKey(recipientKey)
  try {
    const pool = getPgPool()
    const r = await pool.query<{ id: string }>(
      `insert into public.messaging_partner_birthday_email_sent
         (partner_id, recipient_key, recipient_user_id, recipient_email, campaign_key)
       values ($1::uuid, $2, $3::uuid, $4, $5)
       on conflict (partner_id, recipient_key, campaign_key) do nothing
       returning id::text`,
      [
        input.partnerId,
        recipientKey,
        userId,
        (input.recipientEmail || '').trim().toLowerCase().slice(0, 180) || null,
        input.campaignKey.slice(0, 64),
      ]
    )
    return r.rowCount === 1
  } catch (e) {
    console.warn('[tryClaimBirthdayEmailSlotFromPg]', e)
    return false
  }
}

export async function releaseBirthdayEmailSlotFromPg(input: {
  partnerId: string
  recipientKey: string
  campaignKey: string
  /** @deprecated dùng recipientKey */
  recipientUserId?: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const recipientKey = (input.recipientKey || (input.recipientUserId ? `user:${input.recipientUserId}` : '')).slice(
    0,
    160
  )
  if (!recipientKey) return false
  try {
    const pool = getPgPool()
    await pool.query(
      `delete from public.messaging_partner_birthday_email_sent
       where partner_id = $1::uuid and recipient_key = $2 and campaign_key = $3`,
      [input.partnerId, recipientKey, input.campaignKey.slice(0, 64)]
    )
    return true
  } catch (e) {
    console.warn('[releaseBirthdayEmailSlotFromPg]', e)
    return false
  }
}

/** Khách shop (hồ sơ + linked user) có ngày sinh và email. */
export type BirthdayEligibleUserRow = {
  recipient_key: string
  user_id: string | null
  birth_date: string
  email: string
  customer_name: string
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
    const shopRows = await pgQuery<{
      email: string
      birth_date: string
      customer_name: string | null
    }>(
      `select lower(trim(email_normalized)) as email,
              date_of_birth::text as birth_date,
              nullif(trim(customer_name), '') as customer_name
       from public.messaging_partner_customer_profiles
       where partner_id = $1::uuid
         and date_of_birth is not null
         and coalesce(trim(email_normalized), '') <> ''`,
      [partnerId]
    )
    const linkedRows = await pgQuery<{
      user_id: string
      birth_date: string
      email: string
    }>(
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
    const byEmail = new Map<string, BirthdayEligibleUserRow>()
    for (const r of shopRows) {
      const em = String(r.email ?? '').trim().toLowerCase()
      const bd = String(r.birth_date ?? '').trim().slice(0, 10)
      if (!em || !bd) continue
      byEmail.set(em, {
        recipient_key: `email:${em}`,
        user_id: null,
        birth_date: bd,
        email: em,
        customer_name: String(r.customer_name ?? '').trim(),
      })
    }
    for (const r of linkedRows) {
      const em = String(r.email ?? '').trim().toLowerCase()
      const bd = String(r.birth_date ?? '').trim().slice(0, 10)
      const uid = String(r.user_id ?? '').trim()
      if (!em || !bd || !uid) continue
      const existing = byEmail.get(em)
      if (existing) {
        existing.user_id = uid
        existing.recipient_key = `user:${uid}`
        continue
      }
      byEmail.set(em, {
        recipient_key: `user:${uid}`,
        user_id: uid,
        birth_date: bd,
        email: em,
        customer_name: '',
      })
    }
    return [...byEmail.values()]
  } catch (e) {
    console.warn('[listBirthdayEligibleUsersForPartnerFromPg]', e)
    return null
  }
}
