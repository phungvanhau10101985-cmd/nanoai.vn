import { randomBytes } from 'node:crypto'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { writePartnerSaleAuditFromPg } from '@/lib/db/messaging-partner-sale-audit-pg'

function referralCode(): string {
  return randomBytes(6).toString('base64url').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10)
}

export async function ensurePartnerAffiliateProfileFromPg(input: {
  partnerId: string
  guestAccountId?: string | null
  linkedUserId?: string | null
  emailNormalized?: string | null
}): Promise<{ id: string; referralCode: string } | null> {
  if (!isPgConfigured()) return null
  const guest = input.guestAccountId ?? null
  const user = input.linkedUserId ?? null
  const email = input.emailNormalized?.trim().toLowerCase() || null
  if (!guest && !user && !email) return null
  const existing = await pgQueryOne<{ id: string; referral_code: string }>(
    `select id::text, referral_code
     from public.messaging_partner_affiliate_profiles
     where partner_id = $1::uuid and (
       ($2::uuid is not null and guest_account_id = $2::uuid)
       or ($3::uuid is not null and linked_user_id = $3::uuid)
       or ($4::text is not null and email_normalized = $4)
     )
     order by created_at asc limit 1`,
    [input.partnerId, guest, user, email]
  )
  if (existing) return { id: existing.id, referralCode: existing.referral_code }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const row = await pgQueryOne<{ id: string; referral_code: string }>(
      `insert into public.messaging_partner_affiliate_profiles (
         partner_id, guest_account_id, linked_user_id, email_normalized, referral_code
       ) values ($1::uuid,$2::uuid,$3::uuid,$4,$5)
       on conflict do nothing
       returning id::text, referral_code`,
      [input.partnerId, guest, user, email, referralCode()]
    )
    if (row) return { id: row.id, referralCode: row.referral_code }
  }
  return null
}

export async function attributePartnerAffiliateVisitFromPg(input: {
  partnerId: string
  accountKey: string
  referralCode: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const code = input.referralCode.trim()
  const accountKey = input.accountKey.trim()
  if (!code || !accountKey) return false
  const profile = await pgQueryOne<{ id: string; is_self: boolean; attribution_days: number }>(
    `select ap.id::text,
            (ap.guest_account_id::text = $3 or ap.linked_user_id::text = $3) as is_self,
            coalesce(s.attribution_days, 30)::int as attribution_days
     from public.messaging_partner_affiliate_profiles ap
     join public.messaging_partner_affiliate_settings s on s.partner_id = ap.partner_id
     where ap.partner_id = $1::uuid and upper(ap.referral_code) = upper($2)
       and s.enabled = true`,
    [input.partnerId, code, accountKey]
  )
  if (!profile || profile.is_self) return false
  await pgQuery(
    `insert into public.messaging_partner_affiliate_attributions (
       partner_id, account_key, affiliate_profile_id, attributed_at, expires_at
     ) values ($1::uuid,$2,$3::uuid,now(),now() + ($4::int || ' days')::interval)
     on conflict (partner_id, account_key) do update set
       affiliate_profile_id = excluded.affiliate_profile_id,
       attributed_at = now(), expires_at = excluded.expires_at`,
    [input.partnerId, accountKey, profile.id, profile.attribution_days]
  )
  return true
}

export async function createPartnerAffiliateCommissionForOrderFromPg(input: {
  partnerId: string
  orderId: string
  accountKey: string | null
  amountAfterDiscount: number
}): Promise<boolean> {
  if (!isPgConfigured() || !input.accountKey) return false
  const rows = await pgQuery<{ id: string }>(
    `insert into public.messaging_partner_affiliate_commissions (
       partner_id, affiliate_profile_id, order_id, base_amount,
       commission_percent, commission_amount
     )
     select
       a.partner_id, a.affiliate_profile_id, $2::uuid, $4::numeric,
       s.commission_percent,
       round($4::numeric * s.commission_percent / 100)
     from public.messaging_partner_affiliate_attributions a
     join public.messaging_partner_affiliate_settings s on s.partner_id = a.partner_id
     where a.partner_id = $1::uuid and a.account_key = $3
       and a.expires_at > now() and s.enabled = true
     on conflict (partner_id, order_id) do nothing
     returning id::text`,
    [
      input.partnerId,
      input.orderId,
      input.accountKey,
      Math.max(0, Math.round(input.amountAfterDiscount)),
    ]
  ).catch((error) => {
    if ((error as { code?: string })?.code !== '42P01') {
      console.warn('[createPartnerAffiliateCommissionForOrderFromPg]', error)
    }
    return []
  })
  return rows.length > 0
}

export async function transitionPartnerAffiliateCommissionFromPg(input: {
  partnerId: string
  orderId: string
  state: 'confirmed' | 'reversed'
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const result = await pgQuery<{ id: string }>(
    `update public.messaging_partner_affiliate_commissions
     set status = $3,
         confirmed_at = case when $3 = 'confirmed' then now() else confirmed_at end,
         reversed_at = case when $3 = 'reversed' then now() else reversed_at end
     where partner_id = $1::uuid and order_id = $2::uuid
       and status not in ('paid', $3)
     returning id::text`,
    [input.partnerId, input.orderId, input.state]
  )
  if (result.length > 0) {
    void writePartnerSaleAuditFromPg({
      partnerId: input.partnerId,
      eventType: `affiliate_commission_${input.state}`,
      entityType: 'affiliate_commission',
      entityId: result[0]?.id ?? null,
      detail: { orderId: input.orderId },
    })
  }
  return result.length > 0
}

export async function fetchPartnerAffiliateWalletFromPg(input: {
  partnerId: string
  guestAccountId?: string | null
  linkedUserId?: string | null
  emailNormalized?: string | null
}): Promise<{
  referralCode: string
  pendingAmount: number
  confirmedAmount: number
  paidAmount: number
} | null> {
  const profile = await ensurePartnerAffiliateProfileFromPg(input)
  if (!profile) return null
  const row = await pgQueryOne<{
    pending: string | number
    confirmed: string | number
    paid: string | number
  }>(
    `select
       coalesce(sum(commission_amount) filter (where status = 'pending'), 0) as pending,
       coalesce(sum(commission_amount) filter (where status = 'confirmed'), 0) as confirmed,
       coalesce(sum(commission_amount) filter (where status = 'paid'), 0) as paid
     from public.messaging_partner_affiliate_commissions
     where partner_id = $1::uuid and affiliate_profile_id = $2::uuid`,
    [input.partnerId, profile.id]
  )
  return {
    referralCode: profile.referralCode,
    pendingAmount: Math.max(0, Number(row?.pending) || 0),
    confirmedAmount: Math.max(0, Number(row?.confirmed) || 0),
    paidAmount: Math.max(0, Number(row?.paid) || 0),
  }
}
