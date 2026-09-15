import { createHash, randomBytes, randomInt } from 'node:crypto'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { writePartnerSaleAuditFromPg } from '@/lib/db/messaging-partner-sale-audit-pg'
import { insertPartnerCustomerNotificationFromPg } from '@/lib/db/messaging-partner-customer-notifications-pg'
import { partnerSiteAccountTabPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  affiliateCommissionAmount,
  affiliateCommissionBase,
  affiliateProductSummary,
  applyAffiliateWalletToPayable,
  cleanAffiliateSocialLinks,
  mapAffiliateCommissionUiStatus,
  maskAffiliateBuyerLabel,
  normalizeAffiliateReferralCode,
  pickAffiliateReferrerProfileId,
  shouldGrantAffiliateCommissionOnCheckout,
} from '@/lib/partner-website/shop/partner-site-affiliate'

const BANK_OTP_MINUTES = 10
const BANK_OTP_LENGTH = 6

function money(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : 0
}

function otpPepper(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'dev'
}

function hashValue(value: string): string {
  return createHash('sha256').update(`${otpPepper()}:${value.trim()}`).digest('hex')
}

function bankPayloadHash(bankName: string, bankAccount: string, accountHolder: string): string {
  return hashValue(
    [
      bankName.trim().toLowerCase(),
      bankAccount.trim().replace(/\s+/g, ''),
      accountHolder.trim().toLowerCase(),
    ].join('|')
  )
}

function referralCode(): string {
  return randomBytes(6).toString('base64url').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8)
}

function otpDigits(): string {
  return String(randomInt(0, 1_000_000)).padStart(BANK_OTP_LENGTH, '0')
}

export type PartnerAffiliateSettingsRow = {
  enabled: boolean
  commissionPercent: number
  attributionDays: number
  minimumPayoutAmount: number
  commissionPolicy: string | null
}

export type PartnerAffiliateProfileRow = {
  id: string
  referralCode: string
  guestAccountId: string | null
  linkedUserId: string | null
  emailNormalized: string | null
  referredByProfileId: string | null
}

export type PartnerAffiliateApplicationRow = {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  socialLinks: string[]
  note: string | null
  adminNote: string | null
  submittedAt: string
  reviewedAt: string | null
  emailNormalized?: string | null
}

export type PartnerAffiliateMePayload = {
  affiliate_enabled: boolean
  affiliate_status: 'none' | 'pending' | 'approved' | 'rejected'
  affiliate_application: PartnerAffiliateApplicationRow | null
  referral_code: string
  referral_link: string
  commission_percent: number
  min_withdrawal: number
  ref_cookie_days: number
  commission_policy: string | null
  balance: number
  pending_balance: number
  total_orders_referred: number
  bank_account: {
    bank_name: string
    bank_account: string
    account_holder: string
  } | null
}

export type IdentityInput = {
  partnerId: string
  guestAccountId?: string | null
  linkedUserId?: string | null
  emailNormalized?: string | null
}

function identityArgs(input: IdentityInput) {
  return [
    input.partnerId,
    input.guestAccountId ?? null,
    input.linkedUserId ?? null,
    input.emailNormalized?.trim().toLowerCase() || null,
  ] as const
}

function mapAffiliateProfileRow(row: {
  id: string
  referral_code: string
  guest_account_id: string | null
  linked_user_id: string | null
  email_normalized: string | null
  referred_by_profile_id: string | null
}): PartnerAffiliateProfileRow {
  return {
    id: row.id,
    referralCode: row.referral_code,
    guestAccountId: row.guest_account_id,
    linkedUserId: row.linked_user_id,
    emailNormalized: row.email_normalized,
    referredByProfileId: row.referred_by_profile_id,
  }
}

async function selectAffiliateProfileByIdentity(
  partnerId: string,
  guest: string | null,
  user: string | null,
  email: string | null
) {
  return pgQueryOne<{
    id: string
    referral_code: string
    guest_account_id: string | null
    linked_user_id: string | null
    email_normalized: string | null
    referred_by_profile_id: string | null
  }>(
    `select id::text, referral_code, guest_account_id::text, linked_user_id::text,
            email_normalized, referred_by_profile_id::text
     from public.messaging_partner_affiliate_profiles
     where partner_id = $1::uuid and (
       ($2::uuid is not null and guest_account_id = $2::uuid)
       or ($3::uuid is not null and linked_user_id = $3::uuid)
       or ($4::text is not null and email_normalized = $4)
     )
     order by created_at asc limit 1`,
    [partnerId, guest, user, email]
  )
}

async function mergeAffiliateProfileIdentity(
  existing: NonNullable<Awaited<ReturnType<typeof selectAffiliateProfileByIdentity>>>,
  guest: string | null,
  user: string | null,
  email: string | null
): Promise<PartnerAffiliateProfileRow> {
  const needGuest = Boolean(guest) && !existing.guest_account_id
  const needUser = Boolean(user) && !existing.linked_user_id
  const needEmail = Boolean(email) && !existing.email_normalized
  if (!needGuest && !needUser && !needEmail) return mapAffiliateProfileRow(existing)
  try {
    const row = await pgQueryOne<{
      id: string
      referral_code: string
      guest_account_id: string | null
      linked_user_id: string | null
      email_normalized: string | null
      referred_by_profile_id: string | null
    }>(
      `update public.messaging_partner_affiliate_profiles
       set guest_account_id = coalesce(guest_account_id, $2::uuid),
           linked_user_id = coalesce(linked_user_id, $3::uuid),
           email_normalized = coalesce(nullif(email_normalized, ''), $4)
       where id = $1::uuid
       returning id::text, referral_code, guest_account_id::text, linked_user_id::text,
                 email_normalized, referred_by_profile_id::text`,
      [existing.id, guest, user, email]
    )
    return mapAffiliateProfileRow(row ?? existing)
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') return mapAffiliateProfileRow(existing)
    throw error
  }
}

export async function fetchPartnerAffiliateSettingsFromPg(
  partnerId: string
): Promise<PartnerAffiliateSettingsRow> {
  const row = await pgQueryOne<{
    enabled: boolean
    commission_percent: string | number
    attribution_days: number
    minimum_payout_amount: string | number
    commission_policy: string | null
  }>(
    `select enabled, commission_percent, attribution_days, minimum_payout_amount, commission_policy
     from public.messaging_partner_affiliate_settings
     where partner_id = $1::uuid`,
    [partnerId]
  )
  return {
    enabled: row?.enabled !== false,
    commissionPercent: Number(row?.commission_percent) || 10,
    attributionDays: row?.attribution_days ?? 30,
    minimumPayoutAmount: money(row?.minimum_payout_amount) || 100_000,
    commissionPolicy: row?.commission_policy?.trim() || null,
  }
}

export async function upsertPartnerAffiliateSettingsFromPg(input: {
  partnerId: string
  enabled: boolean
  commissionPercent: number
  attributionDays: number
  minimumPayoutAmount: number
  commissionPolicy?: string | null
  actorId?: string | null
}): Promise<PartnerAffiliateSettingsRow> {
  await pgQuery(
    `insert into public.messaging_partner_affiliate_settings (
       partner_id, enabled, commission_percent, attribution_days,
       minimum_payout_amount, commission_policy, updated_at
     ) values ($1::uuid,$2,$3,$4,$5,$6,now())
     on conflict (partner_id) do update set
       enabled = excluded.enabled,
       commission_percent = excluded.commission_percent,
       attribution_days = excluded.attribution_days,
       minimum_payout_amount = excluded.minimum_payout_amount,
       commission_policy = excluded.commission_policy,
       updated_at = now()`,
    [
      input.partnerId,
      input.enabled === true,
      Math.max(0, Math.min(100, Number(input.commissionPercent) || 0)),
      Math.max(1, Math.min(365, Number(input.attributionDays) || 30)),
      Math.max(0, Math.round(Number(input.minimumPayoutAmount) || 0)),
      input.commissionPolicy?.trim() || null,
    ]
  )
  void writePartnerSaleAuditFromPg({
    partnerId: input.partnerId,
    eventType: 'affiliate_settings_updated',
    actorKey: input.actorId ?? null,
    entityType: 'affiliate_settings',
    detail: {
      enabled: input.enabled,
      commissionPercent: input.commissionPercent,
      attributionDays: input.attributionDays,
      minimumPayoutAmount: input.minimumPayoutAmount,
    },
  })
  return fetchPartnerAffiliateSettingsFromPg(input.partnerId)
}

export async function ensurePartnerAffiliateProfileFromPg(
  input: IdentityInput
): Promise<PartnerAffiliateProfileRow | null> {
  if (!isPgConfigured()) return null
  const [partnerId, guest, user, email] = identityArgs(input)
  if (!guest && !user && !email) return null
  const existing = await selectAffiliateProfileByIdentity(partnerId, guest, user, email)
  if (existing) return mergeAffiliateProfileIdentity(existing, guest, user, email)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const row = await pgQueryOne<{
      id: string
      referral_code: string
      guest_account_id: string | null
      linked_user_id: string | null
      email_normalized: string | null
      referred_by_profile_id: string | null
    }>(
      `insert into public.messaging_partner_affiliate_profiles (
         partner_id, guest_account_id, linked_user_id, email_normalized, referral_code
       ) values ($1::uuid,$2::uuid,$3::uuid,$4,$5)
       on conflict do nothing
       returning id::text, referral_code, guest_account_id::text, linked_user_id::text,
                 email_normalized, referred_by_profile_id::text`,
      [partnerId, guest, user, email, referralCode()]
    )
    if (row) {
      await pgQuery(
        `insert into public.messaging_partner_affiliate_wallets (affiliate_profile_id, partner_id)
         values ($1::uuid,$2::uuid)
         on conflict (affiliate_profile_id) do nothing`,
        [row.id, partnerId]
      )
      return mapAffiliateProfileRow(row)
    }
    const raced = await selectAffiliateProfileByIdentity(partnerId, guest, user, email)
    if (raced) return mergeAffiliateProfileIdentity(raced, guest, user, email)
  }
  return null
}

async function ensureWallet(profileId: string, partnerId: string): Promise<void> {
  await pgQuery(
    `insert into public.messaging_partner_affiliate_wallets (affiliate_profile_id, partner_id)
     values ($1::uuid,$2::uuid)
     on conflict (affiliate_profile_id) do nothing`,
    [profileId, partnerId]
  )
}

export async function fetchPartnerAffiliateApplicationFromPg(input: {
  partnerId: string
  profileId: string
}): Promise<PartnerAffiliateApplicationRow | null> {
  const row = await pgQueryOne<{
    id: string
    status: 'pending' | 'approved' | 'rejected'
    social_links: unknown
    note: string | null
    admin_note: string | null
    submitted_at: string
    reviewed_at: string | null
  }>(
    `select id::text, status, social_links, note, admin_note, submitted_at, reviewed_at
     from public.messaging_partner_affiliate_applications
     where partner_id = $1::uuid and affiliate_profile_id = $2::uuid
     limit 1`,
    [input.partnerId, input.profileId]
  )
  if (!row) return null
  const links = Array.isArray(row.social_links) ? row.social_links.map((x) => String(x)) : []
  return {
    id: row.id,
    status: row.status,
    socialLinks: links,
    note: row.note,
    adminNote: row.admin_note,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
  }
}

export async function isApprovedPartnerAffiliateFromPg(input: {
  partnerId: string
  profileId: string
}): Promise<boolean> {
  const row = await fetchPartnerAffiliateApplicationFromPg(input)
  return row?.status === 'approved'
}

export async function attributePartnerAffiliateVisitFromPg(input: {
  partnerId: string
  accountKey: string
  referralCode: string
  identity?: IdentityInput
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const code = normalizeAffiliateReferralCode(input.referralCode)
  const accountKey = input.accountKey.trim()
  if (!code || !accountKey) return false
  const settings = await fetchPartnerAffiliateSettingsFromPg(input.partnerId)
  if (!settings.enabled) return false
  const profile = await pgQueryOne<{ id: string; is_self: boolean; approved: boolean }>(
    `select ap.id::text,
            (ap.guest_account_id::text = $3 or ap.linked_user_id::text = $3) as is_self,
            exists(
              select 1 from public.messaging_partner_affiliate_applications a
              where a.partner_id = ap.partner_id and a.affiliate_profile_id = ap.id
                and a.status = 'approved'
            ) as approved
     from public.messaging_partner_affiliate_profiles ap
     where ap.partner_id = $1::uuid and upper(ap.referral_code) = $2`,
    [input.partnerId, code, accountKey]
  )
  if (!profile || profile.is_self || !profile.approved) return false
  await pgQuery(
    `insert into public.messaging_partner_affiliate_attributions (
       partner_id, account_key, affiliate_profile_id, attributed_at, expires_at
     ) values ($1::uuid,$2,$3::uuid,now(),now() + ($4::int || ' days')::interval)
     on conflict (partner_id, account_key) do update set
       affiliate_profile_id = excluded.affiliate_profile_id,
       attributed_at = now(), expires_at = excluded.expires_at`,
    [input.partnerId, accountKey, profile.id, settings.attributionDays]
  )
  if (input.identity?.guestAccountId || input.identity?.linkedUserId) {
    const buyer = await ensurePartnerAffiliateProfileFromPg(input.identity)
    if (buyer && buyer.id !== profile.id) {
      await attributeFirstTouchIfNeeded({
        partnerId: input.partnerId,
        buyer,
        referrerId: profile.id,
        identity: input.identity,
      })
    }
  }
  return true
}

async function buyerHasCompletedOrders(partnerId: string, identity: IdentityInput): Promise<boolean> {
  const row = await pgQueryOne<{ ok: boolean }>(
    `select exists(
       select 1 from public.messaging_partner_orders o
       join public.customer_care_conversations c on c.id = o.conversation_id
       where o.partner_id = $1::uuid
         and o.shipping_status = 'delivered'
         and o.status <> 'cancelled'
         and (
           ($2::uuid is not null and c.guest_account_id = $2::uuid)
           or ($3::uuid is not null and c.linked_user_id = $3::uuid)
         )
     ) as ok`,
    [partnerId, identity.guestAccountId ?? null, identity.linkedUserId ?? null]
  )
  return row?.ok === true
}

async function attributeFirstTouchIfNeeded(input: {
  partnerId: string
  buyer: PartnerAffiliateProfileRow
  referrerId: string
  identity: IdentityInput
}): Promise<void> {
  if (input.buyer.referredByProfileId || input.buyer.id === input.referrerId) return
  if (await buyerHasCompletedOrders(input.partnerId, input.identity)) return
  await pgQuery(
    `update public.messaging_partner_affiliate_profiles
     set referred_by_profile_id = $3::uuid, referred_at = coalesce(referred_at, now())
     where id = $1::uuid and partner_id = $2::uuid and referred_by_profile_id is null`,
    [input.buyer.id, input.partnerId, input.referrerId]
  )
}

export async function resolvePartnerOrderReferrerProfileIdFromPg(input: {
  partnerId: string
  accountKey: string | null
  referralCode?: string | null
  identity?: IdentityInput
}): Promise<string | null> {
  const settings = await fetchPartnerAffiliateSettingsFromPg(input.partnerId)
  if (!settings.enabled) return null
  let lastTouchFromVisit: string | null = null
  if (input.accountKey?.trim()) {
    const attributed = await pgQueryOne<{ id: string }>(
      `select a.affiliate_profile_id::text as id
       from public.messaging_partner_affiliate_attributions a
       join public.messaging_partner_affiliate_applications app
         on app.affiliate_profile_id = a.affiliate_profile_id and app.partner_id = a.partner_id
       where a.partner_id = $1::uuid and a.account_key = $2
         and a.expires_at > now() and app.status = 'approved'
       limit 1`,
      [input.partnerId, input.accountKey.trim()]
    )
    lastTouchFromVisit = attributed?.id ?? null
  }
  let lastTouchFromCode: string | null = null
  const code = normalizeAffiliateReferralCode(input.referralCode)
  if (code) {
    const byCode = await pgQueryOne<{ id: string }>(
      `select ap.id::text
       from public.messaging_partner_affiliate_profiles ap
       join public.messaging_partner_affiliate_applications app
         on app.affiliate_profile_id = ap.id and app.partner_id = ap.partner_id
       where ap.partner_id = $1::uuid and upper(ap.referral_code) = $2
         and app.status = 'approved'
       limit 1`,
      [input.partnerId, code]
    )
    lastTouchFromCode = byCode?.id ?? null
  }
  const buyer = input.identity ? await ensurePartnerAffiliateProfileFromPg(input.identity) : null
  const referrerId = pickAffiliateReferrerProfileId({
    buyerProfileId: buyer?.id,
    firstTouchProfileId: buyer?.referredByProfileId,
    lastTouchFromCode,
    lastTouchFromVisit,
  })
  if (!referrerId) return null
  if (buyer && input.identity) {
    await attributeFirstTouchIfNeeded({
      partnerId: input.partnerId,
      buyer,
      referrerId,
      identity: input.identity,
    })
  }
  const approved = await isApprovedPartnerAffiliateFromPg({
    partnerId: input.partnerId,
    profileId: referrerId,
  })
  return approved ? referrerId : null
}

async function appendWalletTx(input: {
  client: { query: (text: string, params?: unknown[]) => Promise<unknown> }
  partnerId: string
  profileId: string
  txType: string
  amount: number
  balanceAfter: number
  pendingAfter: number
  referenceType?: string | null
  referenceId?: string | null
  description?: string | null
}): Promise<void> {
  await input.client.query(
    `insert into public.messaging_partner_affiliate_wallet_txs (
       partner_id, affiliate_profile_id, tx_type, amount, balance_after, pending_after,
       reference_type, reference_id, description
     ) values ($1::uuid,$2::uuid,$3,$4::numeric,$5::numeric,$6::numeric,$7,$8,$9)`,
    [
      input.partnerId,
      input.profileId,
      input.txType,
      input.amount,
      input.balanceAfter,
      input.pendingAfter,
      input.referenceType ?? null,
      input.referenceId ?? null,
      input.description ?? null,
    ]
  )
}

export async function fetchPartnerAffiliateWalletBalancesFromPg(profileId: string): Promise<{
  balance: number
  pendingBalance: number
}> {
  const row = await pgQueryOne<{ balance: string | number; pending_balance: string | number }>(
    `select balance, pending_balance
     from public.messaging_partner_affiliate_wallets
     where affiliate_profile_id = $1::uuid`,
    [profileId]
  )
  return {
    balance: Math.max(0, money(row?.balance)),
    pendingBalance: Math.max(0, money(row?.pending_balance)),
  }
}

export async function applyPartnerAffiliateWalletToOrderFromPg(input: {
  partnerId: string
  orderId: string
  profileId: string
  requestedAmount: number
  amountAfterDiscount: number
  shippingFeeAmount: number
  requiredAmount: number
}): Promise<{ walletUsed: number; requiredAmount: number; payableTotal: number }> {
  const requested = Math.max(0, Math.round(input.requestedAmount || 0))
  if (requested <= 0) {
    return {
      walletUsed: 0,
      requiredAmount: Math.max(0, Math.round(input.requiredAmount || 0)),
      payableTotal: Math.max(0, Math.round(input.amountAfterDiscount + input.shippingFeeAmount)),
    }
  }
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query(
      `insert into public.messaging_partner_affiliate_wallets (affiliate_profile_id, partner_id)
       values ($1::uuid,$2::uuid)
       on conflict (affiliate_profile_id) do nothing`,
      [input.profileId, input.partnerId]
    )
    const wallet = await client.query<{ balance: string | number; pending_balance: string | number }>(
      `select balance, pending_balance from public.messaging_partner_affiliate_wallets
       where affiliate_profile_id = $1::uuid for update`,
      [input.profileId]
    )
    const row = wallet.rows[0]
    const applied = applyAffiliateWalletToPayable({
      amountAfterDiscount: input.amountAfterDiscount,
      shippingFeeAmount: input.shippingFeeAmount,
      requiredAmount: input.requiredAmount,
      walletBalance: money(row?.balance),
      requestedAmount: requested,
    })
    if (applied.walletUsed <= 0) {
      await client.query('commit')
      return applied
    }
    const nextBalance = money(row?.balance) - applied.walletUsed
    await client.query(
      `update public.messaging_partner_affiliate_wallets
       set balance = $2::numeric, updated_at = now()
       where affiliate_profile_id = $1::uuid`,
      [input.profileId, nextBalance]
    )
    await client.query(
      `update public.messaging_partner_orders
       set wallet_amount_used = $3::numeric,
           required_amount = $4::numeric,
           status = case when $4::numeric <= 0 and $5::numeric <= 0 then 'paid_verified' else status end,
           updated_at = now()
       where id = $1::uuid and partner_id = $2::uuid`,
      [input.orderId, input.partnerId, applied.walletUsed, applied.requiredAmount, applied.payableTotal]
    )
    await appendWalletTx({
      client,
      partnerId: input.partnerId,
      profileId: input.profileId,
      txType: 'order_payment',
      amount: -applied.walletUsed,
      balanceAfter: nextBalance,
      pendingAfter: money(row?.pending_balance),
      referenceType: 'order',
      referenceId: input.orderId,
      description: `Thanh toán đơn bằng ví affiliate`,
    })
    await client.query('commit')
    return applied
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

export async function createPartnerAffiliateCommissionForOrderFromPg(input: {
  partnerId: string
  orderId: string
  accountKey: string | null
  amountAfterDiscount: number
  referralCode?: string | null
  identity?: IdentityInput
  forceDepositPaid?: boolean
}): Promise<boolean> {
  if (!isPgConfigured() || !input.orderId) return false
  const settings = await fetchPartnerAffiliateSettingsFromPg(input.partnerId)
  if (!settings.enabled) return false
  const order = await pgQueryOne<{
    required_amount: string | number
    paid_amount: string | number
    wallet_amount_used: string | number
    amount_after_discount: string | number
    referrer_profile_id: string | null
    payment_reference: string | null
    status: string
  }>(
    `select required_amount, paid_amount, coalesce(wallet_amount_used,0) as wallet_amount_used,
            amount_after_discount, referrer_profile_id::text, payment_reference, status
     from public.messaging_partner_orders
     where id = $1::uuid and partner_id = $2::uuid`,
    [input.orderId, input.partnerId]
  )
  if (!order || order.status === 'cancelled') return false
  const referrerId =
    order.referrer_profile_id ||
    (await resolvePartnerOrderReferrerProfileIdFromPg({
      partnerId: input.partnerId,
      accountKey: input.accountKey,
      referralCode: input.referralCode,
      identity: input.identity,
    }))
  if (!referrerId) return false
  const firstStamp = !order.referrer_profile_id
  await pgQuery(
    `update public.messaging_partner_orders
     set referrer_profile_id = $3::uuid
     where id = $1::uuid and partner_id = $2::uuid and referrer_profile_id is null`,
    [input.orderId, input.partnerId, referrerId]
  )
  const required = money(order.required_amount)
  const paid = money(order.paid_amount)
  if (
    !input.forceDepositPaid &&
    !shouldGrantAffiliateCommissionOnCheckout({ requiredAmount: required, paidAmount: paid })
  ) {
    if (firstStamp) {
      const estimated = affiliateCommissionAmount(
        affiliateCommissionBase({
          amountAfterDiscount: money(order.amount_after_discount) || input.amountAfterDiscount,
          walletAmountUsed: money(order.wallet_amount_used),
        }),
        settings.commissionPercent
      )
      const orderCode = order.payment_reference || input.orderId.slice(0, 8)
      void notifyPartnerAffiliateReferrerFromPg({
        partnerId: input.partnerId,
        profileId: referrerId,
        title: 'Đơn giới thiệu mới',
        body:
          estimated > 0
            ? `Đơn ${orderCode}: hoa hồng dự kiến +${estimated.toLocaleString('vi-VN')}đ — hiện sau khi khách đặt cọc.`
            : `Đơn ${orderCode}: khách vừa đặt hàng từ link của bạn.`,
      })
    }
    return false
  }
  const base = affiliateCommissionBase({
    amountAfterDiscount: money(order.amount_after_discount) || input.amountAfterDiscount,
    walletAmountUsed: money(order.wallet_amount_used),
  })
  const amount = affiliateCommissionAmount(base, settings.commissionPercent)
  if (amount <= 0) return false
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    const inserted = await client.query<{ id: string }>(
      `insert into public.messaging_partner_affiliate_commissions (
         partner_id, affiliate_profile_id, order_id, base_amount,
         commission_percent, commission_amount, status
       ) values ($1::uuid,$2::uuid,$3::uuid,$4::numeric,$5::numeric,$6::numeric,'pending')
       on conflict (partner_id, order_id) do nothing
       returning id::text`,
      [input.partnerId, referrerId, input.orderId, base, settings.commissionPercent, amount]
    )
    if (!inserted.rows[0]) {
      await client.query('commit')
      return false
    }
    await client.query(
      `insert into public.messaging_partner_affiliate_wallets (affiliate_profile_id, partner_id)
       values ($1::uuid,$2::uuid)
       on conflict (affiliate_profile_id) do nothing`,
      [referrerId, input.partnerId]
    )
    const wallet = await client.query<{ balance: string | number; pending_balance: string | number }>(
      `select balance, pending_balance from public.messaging_partner_affiliate_wallets
       where affiliate_profile_id = $1::uuid for update`,
      [referrerId]
    )
    const nextPending = money(wallet.rows[0]?.pending_balance) + amount
    const balance = money(wallet.rows[0]?.balance)
    await client.query(
      `update public.messaging_partner_affiliate_wallets
       set pending_balance = $2::numeric, updated_at = now()
       where affiliate_profile_id = $1::uuid`,
      [referrerId, nextPending]
    )
    await appendWalletTx({
      client,
      partnerId: input.partnerId,
      profileId: referrerId,
      txType: 'commission_pending',
      amount,
      balanceAfter: balance,
      pendingAfter: nextPending,
      referenceType: 'commission',
      referenceId: inserted.rows[0].id,
      description: `Hoa hồng chờ giao hàng đơn ${order.payment_reference || input.orderId.slice(0, 8)}`,
    })
    await client.query('commit')
    void writePartnerSaleAuditFromPg({
      partnerId: input.partnerId,
      eventType: 'affiliate_commission_pending',
      entityType: 'affiliate_commission',
      entityId: inserted.rows[0].id,
      detail: { orderId: input.orderId, amount },
    })
    const orderCode = order.payment_reference || input.orderId.slice(0, 8)
    void notifyPartnerAffiliateReferrerFromPg({
      partnerId: input.partnerId,
      profileId: referrerId,
      title: 'Hoa hồng mới',
      body: `Đơn ${orderCode}: +${amount.toLocaleString('vi-VN')}đ đang chờ giao hàng.`,
    })
    return true
  } catch (error) {
    await client.query('rollback')
    if ((error as { code?: string })?.code !== '42P01') {
      console.warn('[createPartnerAffiliateCommissionForOrderFromPg]', error)
    }
    return false
  } finally {
    client.release()
  }
}

export async function transitionPartnerAffiliateCommissionFromPg(input: {
  partnerId: string
  orderId: string
  state: 'confirmed' | 'reversed'
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const order = await pgQueryOne<{
    shipping_status: string
    status: string
    payment_reference: string | null
  }>(
    `select shipping_status, status, payment_reference
     from public.messaging_partner_orders
     where id = $1::uuid and partner_id = $2::uuid`,
    [input.orderId, input.partnerId]
  )
  if (!order) return false
  if (input.state === 'confirmed' && order.shipping_status !== 'delivered') return false
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    const comm = await client.query<{
      id: string
      affiliate_profile_id: string
      commission_amount: string | number
      status: string
    }>(
      `select id::text, affiliate_profile_id::text, commission_amount, status
       from public.messaging_partner_affiliate_commissions
       where partner_id = $1::uuid and order_id = $2::uuid
       for update`,
      [input.partnerId, input.orderId]
    )
    const row = comm.rows[0]
    if (!row) {
      await client.query('commit')
      return false
    }
    const amount = money(row.commission_amount)
    if (input.state === 'confirmed') {
      if (row.status !== 'pending') {
        await client.query('commit')
        return false
      }
      const wallet = await client.query<{ balance: string | number; pending_balance: string | number }>(
        `select balance, pending_balance from public.messaging_partner_affiliate_wallets
         where affiliate_profile_id = $1::uuid for update`,
        [row.affiliate_profile_id]
      )
      const nextPending = Math.max(0, money(wallet.rows[0]?.pending_balance) - amount)
      const nextBalance = money(wallet.rows[0]?.balance) + amount
      await client.query(
        `update public.messaging_partner_affiliate_wallets
         set pending_balance = $2::numeric, balance = $3::numeric, updated_at = now()
         where affiliate_profile_id = $1::uuid`,
        [row.affiliate_profile_id, nextPending, nextBalance]
      )
      await client.query(
        `update public.messaging_partner_affiliate_commissions
         set status = 'confirmed', confirmed_at = now()
         where id = $1::uuid`,
        [row.id]
      )
      await appendWalletTx({
        client,
        partnerId: input.partnerId,
        profileId: row.affiliate_profile_id,
        txType: 'commission_credit',
        amount,
        balanceAfter: nextBalance,
        pendingAfter: nextPending,
        referenceType: 'commission',
        referenceId: row.id,
        description: `Hoa hồng đã giao thành công đơn ${order.payment_reference || input.orderId.slice(0, 8)}`,
      })
      void notifyPartnerAffiliateReferrerFromPg({
        partnerId: input.partnerId,
        profileId: row.affiliate_profile_id,
        title: 'Hoa hồng đã có thể rút',
        body: `Hoa hồng ${amount.toLocaleString('vi-VN')}đ đã chuyển vào số dư khả dụng.`,
      })
    } else {
      if (row.status !== 'pending' && row.status !== 'confirmed') {
        await client.query('commit')
        return false
      }
      const wallet = await client.query<{ balance: string | number; pending_balance: string | number }>(
        `select balance, pending_balance from public.messaging_partner_affiliate_wallets
         where affiliate_profile_id = $1::uuid for update`,
        [row.affiliate_profile_id]
      )
      let nextPending = money(wallet.rows[0]?.pending_balance)
      let nextBalance = money(wallet.rows[0]?.balance)
      let txType = 'commission_cancel_pending'
      if (row.status === 'pending') {
        nextPending = Math.max(0, nextPending - amount)
      } else {
        nextBalance -= amount
        txType = 'commission_cancel'
      }
      await client.query(
        `update public.messaging_partner_affiliate_wallets
         set pending_balance = $2::numeric, balance = $3::numeric, updated_at = now()
         where affiliate_profile_id = $1::uuid`,
        [row.affiliate_profile_id, nextPending, nextBalance]
      )
      await client.query(
        `update public.messaging_partner_affiliate_commissions
         set status = 'cancelled', reversed_at = now()
         where id = $1::uuid`,
        [row.id]
      )
      await appendWalletTx({
        client,
        partnerId: input.partnerId,
        profileId: row.affiliate_profile_id,
        txType,
        amount: -amount,
        balanceAfter: nextBalance,
        pendingAfter: nextPending,
        referenceType: 'commission',
        referenceId: row.id,
        description: `Hủy hoa hồng đơn ${order.payment_reference || input.orderId.slice(0, 8)}`,
      })
      void notifyPartnerAffiliateReferrerFromPg({
        partnerId: input.partnerId,
        profileId: row.affiliate_profile_id,
        title: 'Hoa hồng đã hủy',
        body: `Hoa hồng đơn ${order.payment_reference || input.orderId.slice(0, 8)} đã bị hủy.`,
      })
    }
    await client.query('commit')
    void writePartnerSaleAuditFromPg({
      partnerId: input.partnerId,
      eventType: `affiliate_commission_${input.state}`,
      entityType: 'affiliate_commission',
      entityId: row.id,
      detail: { orderId: input.orderId },
    })
    return true
  } catch (error) {
    await client.query('rollback')
    console.warn('[transitionPartnerAffiliateCommissionFromPg]', error)
    return false
  } finally {
    client.release()
  }
}

export async function refundPartnerAffiliateWalletForOrderFromPg(input: {
  partnerId: string
  orderId: string
}): Promise<boolean> {
  const order = await pgQueryOne<{
    wallet_amount_used: string | number
    conversation_id: string
    payment_reference: string | null
  }>(
    `select coalesce(wallet_amount_used,0) as wallet_amount_used, conversation_id::text, payment_reference
     from public.messaging_partner_orders
     where id = $1::uuid and partner_id = $2::uuid`,
    [input.orderId, input.partnerId]
  )
  const used = money(order?.wallet_amount_used)
  if (!order || used <= 0) return false
  const conv = await pgQueryOne<{ guest_account_id: string | null; linked_user_id: string | null }>(
    `select guest_account_id::text, linked_user_id::text
     from public.customer_care_conversations where id = $1::uuid`,
    [order.conversation_id]
  )
  const profile = await ensurePartnerAffiliateProfileFromPg({
    partnerId: input.partnerId,
    guestAccountId: conv?.guest_account_id,
    linkedUserId: conv?.linked_user_id,
  })
  if (!profile) return false
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    const wallet = await client.query<{ balance: string | number; pending_balance: string | number }>(
      `select balance, pending_balance from public.messaging_partner_affiliate_wallets
       where affiliate_profile_id = $1::uuid for update`,
      [profile.id]
    )
    const nextBalance = money(wallet.rows[0]?.balance) + used
    await client.query(
      `update public.messaging_partner_affiliate_wallets
       set balance = $2::numeric, updated_at = now()
       where affiliate_profile_id = $1::uuid`,
      [profile.id, nextBalance]
    )
    await client.query(
      `update public.messaging_partner_orders
       set wallet_amount_used = 0, updated_at = now()
       where id = $1::uuid and partner_id = $2::uuid`,
      [input.orderId, input.partnerId]
    )
    await appendWalletTx({
      client,
      partnerId: input.partnerId,
      profileId: profile.id,
      txType: 'order_refund',
      amount: used,
      balanceAfter: nextBalance,
      pendingAfter: money(wallet.rows[0]?.pending_balance),
      referenceType: 'order',
      referenceId: input.orderId,
      description: `Hoàn ví đơn hủy ${order.payment_reference || input.orderId.slice(0, 8)}`,
    })
    await client.query('commit')
    return true
  } catch (error) {
    await client.query('rollback')
    console.warn('[refundPartnerAffiliateWalletForOrderFromPg]', error)
    return false
  } finally {
    client.release()
  }
}

export async function fetchPartnerAffiliateWalletFromPg(input: IdentityInput): Promise<{
  referralCode: string
  pendingAmount: number
  confirmedAmount: number
  paidAmount: number
} | null> {
  const profile = await ensurePartnerAffiliateProfileFromPg(input)
  if (!profile) return null
  await ensureWallet(profile.id, input.partnerId)
  const wallet = await fetchPartnerAffiliateWalletBalancesFromPg(profile.id)
  return {
    referralCode: profile.referralCode,
    pendingAmount: wallet.pendingBalance,
    confirmedAmount: wallet.balance,
    paidAmount: 0,
  }
}

async function siteSlugForPartner(partnerId: string): Promise<string> {
  const row = await pgQueryOne<{ site_slug: string }>(
    `select site_slug from public.messaging_partner_websites where partner_id = $1::uuid limit 1`,
    [partnerId]
  )
  return row?.site_slug?.trim() || ''
}

export async function fetchPartnerAffiliateMeFromPg(input: IdentityInput & {
  origin: string
}): Promise<PartnerAffiliateMePayload | null> {
  const profile = await ensurePartnerAffiliateProfileFromPg(input)
  if (!profile) return null
  await ensureWallet(profile.id, input.partnerId)
  const [settings, application, wallet, bank, referred] = await Promise.all([
    fetchPartnerAffiliateSettingsFromPg(input.partnerId),
    fetchPartnerAffiliateApplicationFromPg({ partnerId: input.partnerId, profileId: profile.id }),
    fetchPartnerAffiliateWalletBalancesFromPg(profile.id),
    pgQueryOne<{ bank_name: string; bank_account: string; account_holder: string }>(
      `select bank_name, bank_account, account_holder
       from public.messaging_partner_affiliate_bank_accounts
       where affiliate_profile_id = $1::uuid`,
      [profile.id]
    ),
    pgQueryOne<{ n: string | number }>(
      `select count(*) as n from public.messaging_partner_orders
       where partner_id = $1::uuid and referrer_profile_id = $2::uuid`,
      [input.partnerId, profile.id]
    ),
  ])
  const approved = application?.status === 'approved'
  return {
    affiliate_enabled: settings.enabled,
    affiliate_status: application?.status ?? 'none',
    affiliate_application: application,
    referral_code: profile.referralCode,
    referral_link: buildHomeReferralLink(input.origin, profile.referralCode),
    commission_percent: settings.commissionPercent,
    min_withdrawal: settings.minimumPayoutAmount,
    ref_cookie_days: settings.attributionDays,
    commission_policy: settings.commissionPolicy,
    balance: approved ? wallet.balance : 0,
    pending_balance: approved ? wallet.pendingBalance : 0,
    total_orders_referred: money(referred?.n),
    bank_account: bank
      ? {
          bank_name: bank.bank_name,
          bank_account: bank.bank_account,
          account_holder: bank.account_holder,
        }
      : null,
  }
}

function buildHomeReferralLink(origin: string, code: string): string {
  try {
    const url = new URL(origin)
    url.searchParams.set('ref', code)
    url.hash = ''
    if (url.pathname.endsWith('/login') || url.pathname.includes('/account')) url.pathname = '/'
    return url.toString()
  } catch {
    return `${origin.replace(/\/$/, '')}?ref=${encodeURIComponent(code)}`
  }
}

export async function submitPartnerAffiliateApplicationFromPg(input: IdentityInput & {
  socialLinks: unknown
  note?: string | null
}): Promise<PartnerAffiliateApplicationRow> {
  const profile = await ensurePartnerAffiliateProfileFromPg(input)
  if (!profile) throw new Error('AUTH_REQUIRED')
  const links = cleanAffiliateSocialLinks(input.socialLinks)
  const existing = await fetchPartnerAffiliateApplicationFromPg({
    partnerId: input.partnerId,
    profileId: profile.id,
  })
  if (existing?.status === 'approved') throw new Error('ALREADY_APPROVED')
  const row = await pgQueryOne<{
    id: string
    status: 'pending' | 'approved' | 'rejected'
    social_links: unknown
    note: string | null
    admin_note: string | null
    submitted_at: string
    reviewed_at: string | null
  }>(
    `insert into public.messaging_partner_affiliate_applications (
       partner_id, affiliate_profile_id, status, social_links, note,
       admin_note, reviewed_by, submitted_at, reviewed_at, updated_at
     ) values ($1::uuid,$2::uuid,'pending',$3::jsonb,$4,null,null,now(),null,now())
     on conflict (partner_id, affiliate_profile_id) do update set
       status = 'pending',
       social_links = excluded.social_links,
       note = excluded.note,
       admin_note = null,
       reviewed_by = null,
       submitted_at = now(),
       reviewed_at = null,
       updated_at = now()
     returning id::text, status, social_links, note, admin_note, submitted_at, reviewed_at`,
    [input.partnerId, profile.id, JSON.stringify(links), input.note?.trim() || null]
  )
  if (!row) throw new Error('SUBMIT_FAILED')
  return {
    id: row.id,
    status: row.status,
    socialLinks: links,
    note: row.note,
    adminNote: row.admin_note,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
  }
}

export async function listPartnerAffiliateApplicationsFromPg(input: {
  partnerId: string
  status?: string | null
  skip?: number
  limit?: number
}): Promise<(PartnerAffiliateApplicationRow & { emailNormalized: string | null })[]> {
  const status = String(input.status || '').trim().toLowerCase()
  const rows = await pgQuery<{
    id: string
    status: 'pending' | 'approved' | 'rejected'
    social_links: unknown
    note: string | null
    admin_note: string | null
    submitted_at: string
    reviewed_at: string | null
    email_normalized: string | null
  }>(
    `select a.id::text, a.status, a.social_links, a.note, a.admin_note, a.submitted_at, a.reviewed_at,
            ap.email_normalized
     from public.messaging_partner_affiliate_applications a
     join public.messaging_partner_affiliate_profiles ap on ap.id = a.affiliate_profile_id
     where a.partner_id = $1::uuid
       and ($2::text is null or $2 = '' or a.status = $2)
     order by a.submitted_at desc
     offset $3 limit $4`,
    [
      input.partnerId,
      status && status !== 'all' ? status : '',
      Math.max(0, input.skip || 0),
      Math.max(1, Math.min(200, input.limit || 100)),
    ]
  )
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    socialLinks: Array.isArray(row.social_links) ? row.social_links.map((x) => String(x)) : [],
    note: row.note,
    adminNote: row.admin_note,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    emailNormalized: row.email_normalized,
  }))
}

export async function reviewPartnerAffiliateApplicationFromPg(input: {
  partnerId: string
  applicationId: string
  action: 'approve' | 'reject'
  adminNote?: string | null
  actorId: string
}): Promise<PartnerAffiliateApplicationRow> {
  const status = input.action === 'approve' ? 'approved' : 'rejected'
  const row = await pgQueryOne<{
    id: string
    status: 'pending' | 'approved' | 'rejected'
    social_links: unknown
    note: string | null
    admin_note: string | null
    submitted_at: string
    reviewed_at: string | null
    affiliate_profile_id: string
  }>(
    `update public.messaging_partner_affiliate_applications
     set status = $3, admin_note = $4, reviewed_by = $5::uuid, reviewed_at = now(), updated_at = now()
     where id = $1::uuid and partner_id = $2::uuid
     returning id::text, status, social_links, note, admin_note, submitted_at, reviewed_at,
               affiliate_profile_id::text`,
    [input.applicationId, input.partnerId, status, input.adminNote?.trim() || null, input.actorId]
  )
  if (!row) throw new Error('NOT_FOUND')
  await ensureWallet(row.affiliate_profile_id, input.partnerId)
  void writePartnerSaleAuditFromPg({
    partnerId: input.partnerId,
    eventType: `affiliate_application_${status}`,
    actorKey: input.actorId,
    entityType: 'affiliate_application',
    entityId: row.id,
    detail: { adminNote: input.adminNote ?? null },
  })
  void notifyPartnerAffiliateReferrerFromPg({
    partnerId: input.partnerId,
    profileId: row.affiliate_profile_id,
    title: status === 'approved' ? 'Đã duyệt CTV' : 'Hồ sơ CTV bị từ chối',
    body:
      status === 'approved'
        ? 'Tài khoản affiliate đã được duyệt. Bạn có thể chia sẻ link giới thiệu.'
        : input.adminNote?.trim() || 'Hồ sơ đăng ký CTV chưa được duyệt.',
  })
  return {
    id: row.id,
    status: row.status,
    socialLinks: Array.isArray(row.social_links) ? row.social_links.map((x) => String(x)) : [],
    note: row.note,
    adminNote: row.admin_note,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
  }
}

export async function listPartnerAffiliateReferredOrdersFromPg(input: {
  partnerId: string
  profileId: string
  skip?: number
  limit?: number
}): Promise<
  Array<{
    order_id: string
    order_code: string
    buyer_label: string
    buyer_name: string
    buyer_phone: string
    buyer_address: string
    product_summary: string
    order_total: number
    order_status: string
    shipping_status: string
    commission_amount: number
    commission_percent: number
    commission_status: string
    commission_status_label: string
    withdrawable: boolean
    order_created_at: string
  }>
> {
  if (!(await isApprovedPartnerAffiliateFromPg({ partnerId: input.partnerId, profileId: input.profileId }))) {
    return []
  }
  const settings = await fetchPartnerAffiliateSettingsFromPg(input.partnerId)
  const rows = await pgQuery<{
    id: string
    payment_reference: string | null
    customer_name: string | null
    customer_phone: string | null
    shipping_address: string | null
    product_name: string | null
    amount_after_discount: string | number
    shipping_fee_amount: string | number
    status: string
    shipping_status: string
    created_at: string
    required_amount: string | number
    paid_amount: string | number
    commission_amount: string | number | null
    commission_percent: string | number | null
    commission_status: string | null
    line_summary: string | null
  }>(
    `select o.id::text, o.payment_reference, o.customer_name, o.customer_phone, o.shipping_address,
            o.product_name, o.amount_after_discount, coalesce(o.shipping_fee_amount,0) as shipping_fee_amount,
            o.status, o.shipping_status, o.created_at, o.required_amount, o.paid_amount,
            c.commission_amount, c.commission_percent, c.status as commission_status,
            (
              select string_agg(l.product_name, ', ')
              from public.messaging_partner_order_lines l
              where l.order_id = o.id
            ) as line_summary
     from public.messaging_partner_orders o
     left join public.messaging_partner_affiliate_commissions c
       on c.order_id = o.id and c.partner_id = o.partner_id
     where o.partner_id = $1::uuid and o.referrer_profile_id = $2::uuid
     order by o.created_at desc
     offset $3 limit $4`,
    [
      input.partnerId,
      input.profileId,
      Math.max(0, input.skip || 0),
      Math.max(1, Math.min(50, input.limit || 20)),
    ]
  )
  return rows.map((row) => {
    const ui = mapAffiliateCommissionUiStatus({
      commissionStatus: row.commission_status,
      orderStatus: row.status,
      shippingStatus: row.shipping_status,
      requiredAmount: money(row.required_amount),
      paidAmount: money(row.paid_amount),
    })
    const summary = affiliateProductSummary(
      (row.line_summary || row.product_name || '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
    )
    return {
      order_id: row.id,
      order_code: row.payment_reference || row.id.slice(0, 8),
      buyer_label: maskAffiliateBuyerLabel({
        phone: row.customer_phone,
        orderCode: row.payment_reference,
      }),
      buyer_name: (row.customer_name || '').trim(),
      buyer_phone: (row.customer_phone || '').trim(),
      buyer_address: (row.shipping_address || '').trim(),
      product_summary: summary,
      order_total: money(row.amount_after_discount) + money(row.shipping_fee_amount),
      order_status: row.status,
      shipping_status: row.shipping_status,
      commission_amount: money(row.commission_amount) || affiliateCommissionAmount(
        money(row.amount_after_discount),
        settings.commissionPercent
      ),
      commission_percent: Number(row.commission_percent) || settings.commissionPercent,
      commission_status: ui,
      commission_status_label: ui,
      withdrawable: ui === 'confirmed',
      order_created_at: row.created_at,
    }
  })
}

export async function listPartnerAffiliateWalletTransactionsFromPg(input: {
  partnerId: string
  profileId: string
  skip?: number
  limit?: number
}): Promise<
  Array<{
    id: string
    tx_type: string
    amount: number
    balance_after: number
    pending_after: number
    description: string | null
    created_at: string
  }>
> {
  const rows = await pgQuery<{
    id: string
    tx_type: string
    amount: string | number
    balance_after: string | number
    pending_after: string | number
    description: string | null
    created_at: string
  }>(
    `select id::text, tx_type, amount, balance_after, pending_after, description, created_at
     from public.messaging_partner_affiliate_wallet_txs
     where partner_id = $1::uuid and affiliate_profile_id = $2::uuid
     order by created_at desc
     offset $3 limit $4`,
    [
      input.partnerId,
      input.profileId,
      Math.max(0, input.skip || 0),
      Math.max(1, Math.min(100, input.limit || 30)),
    ]
  )
  return rows.map((row) => ({
    id: row.id,
    tx_type: row.tx_type,
    amount: money(row.amount),
    balance_after: money(row.balance_after),
    pending_after: money(row.pending_after),
    description: row.description,
    created_at: row.created_at,
  }))
}

export async function requestPartnerAffiliateBankOtpFromPg(input: IdentityInput & {
  purpose: 'bank_account' | 'withdraw'
  email: string
  bankName?: string
  bankAccount?: string
  accountHolder?: string
  amount?: number
}): Promise<{ email: string; expiresInMinutes: number; code?: string }> {
  const profile = await ensurePartnerAffiliateProfileFromPg(input)
  if (!profile) throw new Error('AUTH_REQUIRED')
  if (!(await isApprovedPartnerAffiliateFromPg({ partnerId: input.partnerId, profileId: profile.id }))) {
    throw new Error('NOT_APPROVED')
  }
  const email = input.email.trim().toLowerCase()
  if (!email || !email.includes('@')) throw new Error('EMAIL_REQUIRED')
  const payload =
    input.purpose === 'withdraw'
      ? `withdraw:${Math.round(input.amount || 0)}`
      : bankPayloadHash(input.bankName || '', input.bankAccount || '', input.accountHolder || '')
  const code = otpDigits()
  await pgQuery(
    `update public.messaging_partner_affiliate_bank_otps
     set consumed_at = now()
     where affiliate_profile_id = $1::uuid and purpose = $2 and consumed_at is null`,
    [profile.id, input.purpose]
  )
  await pgQuery(
    `insert into public.messaging_partner_affiliate_bank_otps (
       partner_id, affiliate_profile_id, purpose, email, otp_hash, payload_hash, expires_at
     ) values ($1::uuid,$2::uuid,$3,$4,$5,$6,now() + ($7::int || ' minutes')::interval)`,
    [input.partnerId, profile.id, input.purpose, email, hashValue(code), payload, BANK_OTP_MINUTES]
  )
  return { email, expiresInMinutes: BANK_OTP_MINUTES, code }
}

export async function savePartnerAffiliateBankAccountFromPg(input: IdentityInput & {
  bankName: string
  bankAccount: string
  accountHolder: string
  otp: string
}): Promise<{ bank_name: string; bank_account: string; account_holder: string }> {
  const profile = await ensurePartnerAffiliateProfileFromPg(input)
  if (!profile) throw new Error('AUTH_REQUIRED')
  const payload = bankPayloadHash(input.bankName, input.bankAccount, input.accountHolder)
  const challenge = await pgQueryOne<{ id: string }>(
    `select id::text from public.messaging_partner_affiliate_bank_otps
     where affiliate_profile_id = $1::uuid and purpose = 'bank_account'
       and consumed_at is null and expires_at > now()
       and otp_hash = $2 and payload_hash = $3
     order by created_at desc limit 1`,
    [profile.id, hashValue(input.otp.trim()), payload]
  )
  if (!challenge) throw new Error('OTP_INVALID')
  await pgQuery(
    `update public.messaging_partner_affiliate_bank_otps set consumed_at = now() where id = $1::uuid`,
    [challenge.id]
  )
  const row = await pgQueryOne<{ bank_name: string; bank_account: string; account_holder: string }>(
    `insert into public.messaging_partner_affiliate_bank_accounts (
       affiliate_profile_id, partner_id, bank_name, bank_account, account_holder, updated_at
     ) values ($1::uuid,$2::uuid,$3,$4,$5,now())
     on conflict (affiliate_profile_id) do update set
       bank_name = excluded.bank_name,
       bank_account = excluded.bank_account,
       account_holder = excluded.account_holder,
       updated_at = now()
     returning bank_name, bank_account, account_holder`,
    [
      profile.id,
      input.partnerId,
      input.bankName.trim().slice(0, 120),
      input.bankAccount.trim().replace(/\s+/g, '').slice(0, 40),
      input.accountHolder.trim().slice(0, 255),
    ]
  )
  if (!row) throw new Error('SAVE_FAILED')
  return row
}

export async function requestPartnerAffiliateWithdrawalFromPg(input: IdentityInput & {
  amount: number
  otp: string
}): Promise<{ id: string; amount: number; status: string }> {
  const profile = await ensurePartnerAffiliateProfileFromPg(input)
  if (!profile) throw new Error('AUTH_REQUIRED')
  if (!(await isApprovedPartnerAffiliateFromPg({ partnerId: input.partnerId, profileId: profile.id }))) {
    throw new Error('NOT_APPROVED')
  }
  const amount = Math.round(input.amount)
  const settings = await fetchPartnerAffiliateSettingsFromPg(input.partnerId)
  if (amount < settings.minimumPayoutAmount) throw new Error('BELOW_MINIMUM')
  const challenge = await pgQueryOne<{ id: string }>(
    `select id::text from public.messaging_partner_affiliate_bank_otps
     where affiliate_profile_id = $1::uuid and purpose = 'withdraw'
       and consumed_at is null and expires_at > now()
       and otp_hash = $2 and payload_hash = $3
     order by created_at desc limit 1`,
    [profile.id, hashValue(input.otp.trim()), `withdraw:${amount}`]
  )
  if (!challenge) throw new Error('OTP_INVALID')
  const bank = await pgQueryOne<{ bank_name: string; bank_account: string; account_holder: string }>(
    `select bank_name, bank_account, account_holder
     from public.messaging_partner_affiliate_bank_accounts
     where affiliate_profile_id = $1::uuid`,
    [profile.id]
  )
  if (!bank) throw new Error('BANK_REQUIRED')
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query(
      `update public.messaging_partner_affiliate_bank_otps set consumed_at = now() where id = $1::uuid`,
      [challenge.id]
    )
    const wallet = await client.query<{ balance: string | number; pending_balance: string | number }>(
      `select balance, pending_balance from public.messaging_partner_affiliate_wallets
       where affiliate_profile_id = $1::uuid for update`,
      [profile.id]
    )
    const balance = money(wallet.rows[0]?.balance)
    if (amount > balance) {
      await client.query('rollback')
      throw new Error('INSUFFICIENT_BALANCE')
    }
    const nextBalance = balance - amount
    await client.query(
      `update public.messaging_partner_affiliate_wallets
       set balance = $2::numeric, updated_at = now()
       where affiliate_profile_id = $1::uuid`,
      [profile.id, nextBalance]
    )
    const created = await client.query<{ id: string; amount: string | number; status: string }>(
      `insert into public.messaging_partner_affiliate_withdrawals (
         partner_id, affiliate_profile_id, amount, bank_name, bank_account, account_holder, status
       ) values ($1::uuid,$2::uuid,$3::numeric,$4,$5,$6,'pending')
       returning id::text, amount, status`,
      [input.partnerId, profile.id, amount, bank.bank_name, bank.bank_account, bank.account_holder]
    )
    await appendWalletTx({
      client,
      partnerId: input.partnerId,
      profileId: profile.id,
      txType: 'withdrawal_hold',
      amount: -amount,
      balanceAfter: nextBalance,
      pendingAfter: money(wallet.rows[0]?.pending_balance),
      referenceType: 'withdrawal',
      referenceId: created.rows[0]?.id ?? null,
      description: 'Giữ tiền yêu cầu rút về ngân hàng',
    })
    await client.query('commit')
    return {
      id: created.rows[0].id,
      amount,
      status: created.rows[0].status,
    }
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

export async function listPartnerAffiliateWithdrawalsFromPg(input: {
  partnerId: string
  profileId?: string | null
  status?: string | null
  skip?: number
  limit?: number
}): Promise<
  Array<{
    id: string
    amount: number
    bank_name: string
    bank_account: string
    account_holder: string
    status: string
    admin_note: string | null
    created_at: string
    processed_at: string | null
    email_normalized?: string | null
  }>
> {
  const status = String(input.status || '').trim().toLowerCase()
  const rows = await pgQuery<{
    id: string
    amount: string | number
    bank_name: string
    bank_account: string
    account_holder: string
    status: string
    admin_note: string | null
    created_at: string
    processed_at: string | null
    email_normalized: string | null
  }>(
    `select w.id::text, w.amount, w.bank_name, w.bank_account, w.account_holder, w.status,
            w.admin_note, w.created_at, w.processed_at, ap.email_normalized
     from public.messaging_partner_affiliate_withdrawals w
     join public.messaging_partner_affiliate_profiles ap on ap.id = w.affiliate_profile_id
     where w.partner_id = $1::uuid
       and ($2::uuid is null or w.affiliate_profile_id = $2::uuid)
       and ($3::text is null or $3 = '' or w.status = $3)
     order by w.created_at desc
     offset $4 limit $5`,
    [
      input.partnerId,
      input.profileId ?? null,
      status && status !== 'all' ? status : '',
      Math.max(0, input.skip || 0),
      Math.max(1, Math.min(200, input.limit || 50)),
    ]
  )
  return rows.map((row) => ({
    id: row.id,
    amount: money(row.amount),
    bank_name: row.bank_name,
    bank_account: row.bank_account,
    account_holder: row.account_holder,
    status: row.status,
    admin_note: row.admin_note,
    created_at: row.created_at,
    processed_at: row.processed_at,
    email_normalized: row.email_normalized,
  }))
}

export async function reviewPartnerAffiliateWithdrawalFromPg(input: {
  partnerId: string
  withdrawalId: string
  action: 'approve' | 'reject'
  adminNote?: string | null
  actorId: string
}): Promise<{ id: string; status: string }> {
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    const row = await client.query<{
      id: string
      affiliate_profile_id: string
      amount: string | number
      status: string
    }>(
      `select id::text, affiliate_profile_id::text, amount, status
       from public.messaging_partner_affiliate_withdrawals
       where id = $1::uuid and partner_id = $2::uuid for update`,
      [input.withdrawalId, input.partnerId]
    )
    const current = row.rows[0]
    if (!current) {
      await client.query('rollback')
      throw new Error('NOT_FOUND')
    }
    if (current.status !== 'pending') {
      await client.query('rollback')
      throw new Error('ALREADY_PROCESSED')
    }
    const amount = money(current.amount)
    if (input.action === 'reject') {
      const wallet = await client.query<{ balance: string | number; pending_balance: string | number }>(
        `select balance, pending_balance from public.messaging_partner_affiliate_wallets
         where affiliate_profile_id = $1::uuid for update`,
        [current.affiliate_profile_id]
      )
      const nextBalance = money(wallet.rows[0]?.balance) + amount
      await client.query(
        `update public.messaging_partner_affiliate_wallets
         set balance = $2::numeric, updated_at = now()
         where affiliate_profile_id = $1::uuid`,
        [current.affiliate_profile_id, nextBalance]
      )
      await appendWalletTx({
        client,
        partnerId: input.partnerId,
        profileId: current.affiliate_profile_id,
        txType: 'withdrawal_reject',
        amount,
        balanceAfter: nextBalance,
        pendingAfter: money(wallet.rows[0]?.pending_balance),
        referenceType: 'withdrawal',
        referenceId: current.id,
        description: 'Hoàn ví — từ chối yêu cầu rút',
      })
    }
    await client.query(
      `update public.messaging_partner_affiliate_withdrawals
       set status = $3, admin_note = $4, processed_by = $5::uuid, processed_at = now()
       where id = $1::uuid and partner_id = $2::uuid`,
      [
        input.withdrawalId,
        input.partnerId,
        input.action === 'approve' ? 'approved' : 'rejected',
        input.adminNote?.trim() || null,
        input.actorId,
      ]
    )
    await client.query('commit')
    void writePartnerSaleAuditFromPg({
      partnerId: input.partnerId,
      eventType: `affiliate_withdrawal_${input.action}`,
      actorKey: input.actorId,
      entityType: 'affiliate_withdrawal',
      entityId: current.id,
      detail: { amount },
    })
    void notifyPartnerAffiliateReferrerFromPg({
      partnerId: input.partnerId,
      profileId: current.affiliate_profile_id,
      title: input.action === 'approve' ? 'Đã duyệt rút tiền' : 'Từ chối rút tiền',
      body:
        input.action === 'approve'
          ? `Yêu cầu rút ${amount.toLocaleString('vi-VN')}đ đã được duyệt.`
          : input.adminNote?.trim() ||
            `Yêu cầu rút ${amount.toLocaleString('vi-VN')}đ bị từ chối — số tiền đã hoàn vào ví.`,
    })
    return { id: current.id, status: input.action === 'approve' ? 'approved' : 'rejected' }
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

export async function listPartnerAffiliateCommissionsAdminFromPg(input: {
  partnerId: string
  status?: string | null
  skip?: number
  limit?: number
}): Promise<
  Array<{
    id: string
    order_id: string
    order_code: string | null
    commission_amount: number
    commission_percent: number
    status: string
    created_at: string
    confirmed_at: string | null
    email_normalized: string | null
  }>
> {
  const status = String(input.status || '').trim().toLowerCase()
  const mapped = status === 'cancelled' ? 'cancelled' : status === 'reversed' ? 'reversed' : status
  const rows = await pgQuery<{
    id: string
    order_id: string
    payment_reference: string | null
    commission_amount: string | number
    commission_percent: string | number
    status: string
    created_at: string
    confirmed_at: string | null
    email_normalized: string | null
  }>(
    `select c.id::text, c.order_id::text, o.payment_reference, c.commission_amount, c.commission_percent,
            c.status, c.created_at, c.confirmed_at, ap.email_normalized
     from public.messaging_partner_affiliate_commissions c
     join public.messaging_partner_affiliate_profiles ap on ap.id = c.affiliate_profile_id
     left join public.messaging_partner_orders o on o.id = c.order_id
     where c.partner_id = $1::uuid
       and (
         $2::text is null or $2 = '' or $2 = 'all'
         or c.status = $2
         or ($2 = 'cancelled' and c.status in ('cancelled','reversed'))
       )
     order by c.created_at desc
     offset $3 limit $4`,
    [
      input.partnerId,
      mapped && mapped !== 'all' ? mapped : '',
      Math.max(0, input.skip || 0),
      Math.max(1, Math.min(500, input.limit || 100)),
    ]
  )
  return rows.map((row) => ({
    id: row.id,
    order_id: row.order_id,
    order_code: row.payment_reference,
    commission_amount: money(row.commission_amount),
    commission_percent: Number(row.commission_percent) || 0,
    status: row.status === 'reversed' ? 'cancelled' : row.status,
    created_at: row.created_at,
    confirmed_at: row.confirmed_at,
    email_normalized: row.email_normalized,
  }))
}

export async function notifyPartnerAffiliateReferrerFromPg(input: {
  partnerId: string
  profileId: string
  title: string
  body: string
}): Promise<void> {
  const profile = await pgQueryOne<{
    guest_account_id: string | null
    linked_user_id: string | null
  }>(
    `select guest_account_id::text, linked_user_id::text
     from public.messaging_partner_affiliate_profiles
     where id = $1::uuid and partner_id = $2::uuid`,
    [input.profileId, input.partnerId]
  )
  let guest = profile?.guest_account_id?.trim() || ''
  if (!guest && profile?.linked_user_id) {
    const conv = await pgQueryOne<{ guest_account_id: string | null }>(
      `select guest_account_id::text
       from public.customer_care_conversations
       where partner_id = $1::uuid and linked_user_id = $2::uuid
         and guest_account_id is not null
       order by updated_at desc nulls last
       limit 1`,
      [input.partnerId, profile.linked_user_id]
    )
    guest = conv?.guest_account_id?.trim() || ''
  }
  if (!guest) return
  const siteSlug = await siteSlugForPartner(input.partnerId)
  await insertPartnerCustomerNotificationFromPg({
    partnerId: input.partnerId,
    guestAccountId: guest,
    type: 'affiliate',
    title: input.title,
    body: input.body,
    href: siteSlug ? partnerSiteAccountTabPath(siteSlug, 'affiliate') : '',
  })
}

export async function grantPartnerAffiliateCommissionAfterPaidFromPg(input: {
  partnerId: string
  orderId: string
}): Promise<void> {
  const order = await pgQueryOne<{
    shipping_status: string
    conversation_id: string | null
  }>(
    `select shipping_status, conversation_id::text
     from public.messaging_partner_orders
     where id = $1::uuid and partner_id = $2::uuid`,
    [input.orderId, input.partnerId]
  )
  const conv = order?.conversation_id
    ? await pgQueryOne<{
        guest_account_id: string | null
        linked_user_id: string | null
      }>(
        `select guest_account_id::text, linked_user_id::text
         from public.customer_care_conversations where id = $1::uuid`,
        [order.conversation_id]
      )
    : null
  await createPartnerAffiliateCommissionForOrderFromPg({
    partnerId: input.partnerId,
    orderId: input.orderId,
    accountKey: conv?.guest_account_id || conv?.linked_user_id || null,
    amountAfterDiscount: 0,
    forceDepositPaid: true,
    identity: conv
      ? {
          partnerId: input.partnerId,
          guestAccountId: conv.guest_account_id,
          linkedUserId: conv.linked_user_id,
        }
      : undefined,
  })
  if (order?.shipping_status === 'delivered') {
    await transitionPartnerAffiliateCommissionFromPg({
      partnerId: input.partnerId,
      orderId: input.orderId,
      state: 'confirmed',
    })
  }
}

export async function clawbackPartnerAffiliateForOrderFromPg(input: {
  partnerId: string
  orderId: string
  /** 188: cancel/refund restores wallet; returned only cancels commission. */
  refundWallet?: boolean
}): Promise<void> {
  await transitionPartnerAffiliateCommissionFromPg({
    partnerId: input.partnerId,
    orderId: input.orderId,
    state: 'reversed',
  })
  if (input.refundWallet === false) return
  await refundPartnerAffiliateWalletForOrderFromPg({
    partnerId: input.partnerId,
    orderId: input.orderId,
  })
}

export { buildHomeReferralLink }
