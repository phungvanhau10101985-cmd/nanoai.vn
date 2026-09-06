import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import {
  grantPromotionToCustomerFromPg,
  type UpsertPromotionInput,
} from '@/lib/db/messaging-partner-promotions-pg'
import { insertPartnerCustomerNotificationFromPg } from '@/lib/db/messaging-partner-customer-notifications-pg'
import { writePartnerSaleAuditFromPg } from '@/lib/db/messaging-partner-sale-audit-pg'
import { ensurePartnerEmailSendSettingsFromPg } from '@/lib/db/messaging-partner-email-management-pg'
import {
  resolvePartnerCustomerEmail,
  resolvePartnerShopEmailContext,
  sendPartnerCartAbandonEmail,
  sendPartnerComebackEmail,
} from '@/lib/messaging/partner-promo-email'
import type {
  PartnerPromotionRow,
  PromotionAutoGrantTrigger,
} from '@/lib/partner-website/promotions/partner-promotion-types'

type CandidateIdentity = {
  identityKey: string
  guestAccountId: string | null
  linkedUserId: string | null
  emailNormalized: string | null
  cartUpdatedAt?: string
  cartItems?: unknown
}

type AutoPromotionDbRow = {
  id: string
  partner_id: string
  code: string
  name: string
  auto_grant_trigger: PromotionAutoGrantTrigger
  auto_grant_valid_days: number | null
  trigger_idle_hours: number | null
  trigger_inactive_days: number | null
  trigger_cooldown_days: number | null
  discount_percent: number | null
  max_discount_amount: number | null
}

function identityKey(input: {
  linkedUserId?: string | null
  guestAccountId?: string | null
  emailNormalized?: string | null
}): string | null {
  if (input.linkedUserId) return `user:${input.linkedUserId}`
  if (input.guestAccountId) return `guest:${input.guestAccountId}`
  const email = input.emailNormalized?.trim().toLowerCase()
  return email ? `email:${email}` : null
}

async function activeAutoPromotion(
  partnerId: string,
  trigger: PromotionAutoGrantTrigger
): Promise<AutoPromotionDbRow | null> {
  return pgQueryOne<AutoPromotionDbRow>(
    `select id::text, partner_id::text, code, name, auto_grant_trigger,
            auto_grant_valid_days, trigger_idle_hours, trigger_inactive_days,
            trigger_cooldown_days,
            discount_percent::float8 as discount_percent,
            max_discount_amount::float8 as max_discount_amount
     from public.messaging_partner_promotions
     where partner_id = $1::uuid and auto_grant_trigger = $2 and is_active = true
       and (valid_from is null or valid_from <= now())
       and (valid_to is null or valid_to > now())
     order by created_at asc
     limit 1`,
    [partnerId, trigger]
  )
}

async function tryClaim(input: {
  partnerId: string
  promotionId: string
  identityKey: string
  trigger: PromotionAutoGrantTrigger
  cycleKey: string
}): Promise<boolean> {
  const rows = await pgQuery<{ id: string }>(
    `insert into public.messaging_partner_promotion_claims
       (partner_id, promotion_id, identity_key, trigger, cycle_key)
     values ($1::uuid,$2::uuid,$3,$4,$5)
     on conflict (partner_id, identity_key, trigger, cycle_key) do nothing
     returning id::text`,
    [input.partnerId, input.promotionId, input.identityKey, input.trigger, input.cycleKey]
  )
  return rows.length === 1
}

async function completeClaim(input: {
  partnerId: string
  identityKey: string
  trigger: PromotionAutoGrantTrigger
  cycleKey: string
  ok: boolean
  detail?: Record<string, unknown>
}): Promise<void> {
  await pgQuery(
    `update public.messaging_partner_promotion_claims
     set status = $5, completed_at = now(), detail = $6::jsonb
     where partner_id = $1::uuid and identity_key = $2 and trigger = $3 and cycle_key = $4`,
    [
      input.partnerId,
      input.identityKey,
      input.trigger,
      input.cycleKey,
      input.ok ? 'completed' : 'failed',
      JSON.stringify(input.detail ?? {}),
    ]
  )
}

async function hasGrantWithinCooldown(input: {
  promotionId: string
  identity: CandidateIdentity
  cooldownDays: number
}): Promise<boolean> {
  const row = await pgQueryOne<{ found: boolean }>(
    `select exists (
       select 1 from public.messaging_partner_promotion_grants g
       where g.promotion_id = $1::uuid
         and g.granted_at >= now() - ($4::int || ' days')::interval
         and (
           ($2::uuid is not null and g.guest_account_id = $2::uuid)
           or ($3::uuid is not null and g.linked_user_id = $3::uuid)
         )
     ) as found`,
    [
      input.promotionId,
      input.identity.guestAccountId,
      input.identity.linkedUserId,
      Math.max(1, input.cooldownDays),
    ]
  )
  return row?.found === true
}

async function notifyGrant(input: {
  partnerId: string
  guestAccountId: string | null
  promotionName: string
  code: string
  expiresAt: string | null
}): Promise<void> {
  if (!input.guestAccountId) return
  const row = await insertPartnerCustomerNotificationFromPg({
    partnerId: input.partnerId,
    guestAccountId: input.guestAccountId,
    type: 'promotion',
    title: 'Bạn có ưu đãi mới',
    body: `${input.promotionName} – mã ${input.code}`,
    href: '/account/wallet',
    expiresAt: input.expiresAt,
    emailStatus: 'none',
    pushStatus: 'pending',
  })
  if (!row) return
  void import('@/lib/messaging/partner-customer-notification-push')
    .then((module) => module.deliverPendingPartnerNotificationPush(row))
    .catch((error) => console.warn('[notifyPromotionGrant:push]', error))
}

async function sendDedicatedAutoGrantEmail(input: {
  promotion: AutoPromotionDbRow
  identity: CandidateIdentity
}): Promise<void> {
  const settings = await ensurePartnerEmailSendSettingsFromPg(input.promotion.partner_id)
  if (input.promotion.auto_grant_trigger === 'cart_abandon' && settings && !settings.cart_abandon_email_enabled) {
    return
  }
  if (input.promotion.auto_grant_trigger === 'comeback' && settings && !settings.comeback_email_enabled) {
    return
  }
  const resolved = await resolvePartnerCustomerEmail({
    partnerId: input.promotion.partner_id,
    guestAccountId: input.identity.guestAccountId,
    linkedUserId: input.identity.linkedUserId,
    emailNormalized: input.identity.emailNormalized,
  })
  if (!resolved) return
  const ctx = await resolvePartnerShopEmailContext(input.promotion.partner_id)
  if (!ctx) return
  const recipientKey = input.identity.identityKey || `email:${resolved.email}`
  const pct = Math.max(0, Math.min(100, Math.floor(Number(input.promotion.discount_percent) || 0)))
  const maxAmt = Math.max(0, Math.floor(Number(input.promotion.max_discount_amount) || 0))
  const days = Math.max(1, Number(input.promotion.auto_grant_valid_days) || 3)
  if (input.promotion.auto_grant_trigger === 'cart_abandon') {
    await sendPartnerCartAbandonEmail({
      ctx,
      toEmail: resolved.email,
      customerName: resolved.name,
      promoCode: input.promotion.code,
      discountPercent: pct,
      maxDiscountAmount: maxAmt,
      validDays: days,
      cartItems: input.identity.cartItems,
      recipientKey,
    })
    return
  }
  await sendPartnerComebackEmail({
    ctx,
    toEmail: resolved.email,
    customerName: resolved.name,
    promoCode: input.promotion.code,
    discountPercent: pct,
    maxDiscountAmount: maxAmt,
    validDays: days,
    recipientKey,
  })
}

async function grantClaimedPromotion(input: {
  promotion: AutoPromotionDbRow
  identity: CandidateIdentity
  cycleKey: string
}): Promise<boolean> {
  const claimed = await tryClaim({
    partnerId: input.promotion.partner_id,
    promotionId: input.promotion.id,
    identityKey: input.identity.identityKey,
    trigger: input.promotion.auto_grant_trigger,
    cycleKey: input.cycleKey,
  })
  if (!claimed) return false
  const grant = await grantPromotionToCustomerFromPg({
    partnerId: input.promotion.partner_id,
    promotionId: input.promotion.id,
    guestAccountId: input.identity.guestAccountId,
    linkedUserId: input.identity.linkedUserId,
    source: input.promotion.auto_grant_trigger,
    validDays: input.promotion.auto_grant_valid_days,
  })
  await completeClaim({
    partnerId: input.promotion.partner_id,
    identityKey: input.identity.identityKey,
    trigger: input.promotion.auto_grant_trigger,
    cycleKey: input.cycleKey,
    ok: Boolean(grant),
    detail: grant ? { grantId: grant.id } : { error: 'grant_failed' },
  })
  if (!grant) return false
  await notifyGrant({
    partnerId: input.promotion.partner_id,
    guestAccountId: input.identity.guestAccountId,
    promotionName: input.promotion.name,
    code: input.promotion.code,
    expiresAt: grant.expiresAt,
  })
  if (
    input.promotion.auto_grant_trigger === 'cart_abandon' ||
    input.promotion.auto_grant_trigger === 'comeback'
  ) {
    void sendDedicatedAutoGrantEmail({
      promotion: input.promotion,
      identity: input.identity,
    }).catch((error) => console.warn('[autoGrantDedicatedEmail]', error))
  }
  void writePartnerSaleAuditFromPg({
    partnerId: input.promotion.partner_id,
    eventType: 'promotion_auto_granted',
    actorKey: input.identity.identityKey,
    entityType: 'promotion_grant',
    entityId: grant.id,
    detail: {
      promotionId: input.promotion.id,
      trigger: input.promotion.auto_grant_trigger,
      cycleKey: input.cycleKey,
    },
  })
  return true
}

export async function processPartnerPromotionTrigger(input: {
  partnerId: string
  trigger: 'signup' | 'first_order_delivered'
  guestAccountId?: string | null
  linkedUserId?: string | null
  emailNormalized?: string | null
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const key = identityKey(input)
  if (!key) return false
  const promotion = await activeAutoPromotion(input.partnerId, input.trigger)
  if (!promotion) return false
  return grantClaimedPromotion({
    promotion,
    identity: {
      identityKey: key,
      guestAccountId: input.guestAccountId ?? null,
      linkedUserId: input.linkedUserId ?? null,
      emailNormalized: input.emailNormalized?.trim().toLowerCase() || null,
    },
    cycleKey: 'once',
  })
}

export async function processFirstDeliveredOrderPromotion(input: {
  partnerId: string
  orderId: string
  conversationId: string
  emailNormalized?: string | null
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const identity = await pgQueryOne<{
    guest_account_id: string | null
    linked_user_id: string | null
    delivered_count: number
  }>(
    `select c.guest_account_id::text, c.linked_user_id::text,
            (
              select count(*)::int
              from public.messaging_partner_orders o
              left join public.customer_care_conversations oc on oc.id = o.conversation_id
              where o.partner_id = $1::uuid and o.shipping_status = 'delivered'
                and (
                  (c.linked_user_id is not null and oc.linked_user_id = c.linked_user_id)
                  or (c.guest_account_id is not null and oc.guest_account_id = c.guest_account_id)
                )
            ) as delivered_count
     from public.customer_care_conversations c
     where c.id = $2::uuid and c.partner_id = $1::uuid`,
    [input.partnerId, input.conversationId]
  )
  if (!identity || identity.delivered_count !== 1) return false
  return processPartnerPromotionTrigger({
    partnerId: input.partnerId,
    trigger: 'first_order_delivered',
    guestAccountId: identity.guest_account_id,
    linkedUserId: identity.linked_user_id,
    emailNormalized: input.emailNormalized,
  })
}

async function listCartAbandonCandidates(promotion: AutoPromotionDbRow): Promise<CandidateIdentity[]> {
  const idleHours = Math.max(1, promotion.trigger_idle_hours ?? 24)
  return pgQuery<CandidateIdentity & {
    identity_key: string
    guest_account_id: string | null
    linked_user_id: string | null
    email_normalized: string | null
    cart_updated_at: string
    cart_items: unknown
  }>(
    `select
       c.account_key as identity_key,
       conv.guest_account_id::text,
       conv.linked_user_id::text,
       coalesce(
         ga.email_normalized,
         nullif(lower(trim(prof.email_normalized)), '')
       ) as email_normalized,
       c.updated_at::text as cart_updated_at,
       c.cart_items
     from public.messaging_guest_carts c
     left join lateral (
       select cc.guest_account_id, cc.linked_user_id
       from public.customer_care_conversations cc
       where cc.partner_id = c.partner_id
         and (cc.guest_account_id::text = c.account_key or cc.linked_user_id::text = c.account_key
              or cc.external_thread_id = c.account_key)
       order by cc.updated_at desc
       limit 1
     ) conv on true
     left join public.messaging_guest_accounts ga
       on ga.partner_id = c.partner_id and ga.id = conv.guest_account_id
     left join public.messaging_partner_customer_profiles prof
       on prof.partner_id = c.partner_id and (
         (ga.email_normalized is not null and prof.email_normalized = ga.email_normalized)
       )
     where c.partner_id = $1::uuid
       and jsonb_typeof(c.cart_items) = 'array'
       and jsonb_array_length(c.cart_items) > 0
       and c.updated_at <= now() - ($2::int || ' hours')::interval
       and (conv.guest_account_id is not null or conv.linked_user_id is not null)
       and not exists (
         select 1 from public.messaging_partner_orders o
         left join public.customer_care_conversations oc on oc.id = o.conversation_id
         where o.partner_id = c.partner_id and o.created_at > c.updated_at
           and (oc.guest_account_id = conv.guest_account_id or oc.linked_user_id = conv.linked_user_id)
       )`,
    [promotion.partner_id, idleHours]
  ).then((rows) =>
    rows.map((row) => ({
      identityKey: row.identity_key,
      guestAccountId: row.guest_account_id,
      linkedUserId: row.linked_user_id,
      emailNormalized: row.email_normalized,
      cartUpdatedAt: row.cart_updated_at,
      cartItems: row.cart_items,
    }))
  )
}

async function listComebackCandidates(promotion: AutoPromotionDbRow): Promise<CandidateIdentity[]> {
  const inactiveDays = Math.max(1, promotion.trigger_inactive_days ?? 30)
  return pgQuery<{
    identity_key: string
    guest_account_id: string | null
    linked_user_id: string | null
    email_normalized: string | null
  }>(
    `select
       coalesce('user:' || c.linked_user_id::text, 'guest:' || c.guest_account_id::text) as identity_key,
       c.guest_account_id::text, c.linked_user_id::text,
       nullif(lower(trim(max(o.customer_email))), '') as email_normalized
     from public.messaging_partner_orders o
     join public.customer_care_conversations c on c.id = o.conversation_id
     where o.partner_id = $1::uuid
       and o.shipping_status = 'delivered'
       and (c.guest_account_id is not null or c.linked_user_id is not null)
     group by c.guest_account_id, c.linked_user_id
     having max(o.created_at) <= now() - ($2::int || ' days')::interval`,
    [promotion.partner_id, inactiveDays]
  ).then((rows) =>
    rows.map((row) => ({
      identityKey: row.identity_key,
      guestAccountId: row.guest_account_id,
      linkedUserId: row.linked_user_id,
      emailNormalized: row.email_normalized,
    }))
  )
}

type PartnerPromotionMaintenanceResult = {
  partners: number
  promotions: number
  granted: number
  skipped: number
  expired: number
}

const EMPTY_MAINTENANCE_RESULT: PartnerPromotionMaintenanceResult = {
  partners: 0,
  promotions: 0,
  granted: 0,
  skipped: 0,
  expired: 0,
}

async function runPartnerPromotionMaintenanceUnlocked(): Promise<PartnerPromotionMaintenanceResult> {
  const expired = await pgQuery<{ id: string }>(
    `update public.messaging_partner_promotion_grants
     set status = 'expired'
     where status = 'active' and expires_at is not null and expires_at <= now()
     returning id::text`
  )
  const promotions = await pgQuery<AutoPromotionDbRow>(
    `select pr.id::text, pr.partner_id::text, pr.code, pr.name, pr.auto_grant_trigger,
            pr.auto_grant_valid_days, pr.trigger_idle_hours, pr.trigger_inactive_days,
            pr.trigger_cooldown_days,
            pr.discount_percent::float8 as discount_percent,
            pr.max_discount_amount::float8 as max_discount_amount
     from public.messaging_partner_promotions pr
     join public.messaging_partners p on p.id = pr.partner_id
     where p.is_active = true and pr.is_active = true
       and pr.auto_grant_trigger in ('cart_abandon', 'comeback')`
  )
  let granted = 0
  let skipped = 0
  for (const promotion of promotions) {
    const candidates =
      promotion.auto_grant_trigger === 'cart_abandon'
        ? await listCartAbandonCandidates(promotion)
        : await listComebackCandidates(promotion)
    for (const candidate of candidates) {
      if (promotion.auto_grant_trigger === 'comeback') {
        const cartPromo = await activeAutoPromotion(promotion.partner_id, 'cart_abandon')
        if (cartPromo) {
          const cartCandidates = await listCartAbandonCandidates(cartPromo)
          if (cartCandidates.some((item) => item.identityKey === candidate.identityKey)) {
            skipped += 1
            continue
          }
        }
      }
      const cooldownDays =
        promotion.trigger_cooldown_days ??
        (promotion.auto_grant_trigger === 'cart_abandon' ? 7 : 30)
      if (await hasGrantWithinCooldown({ promotionId: promotion.id, identity: candidate, cooldownDays })) {
        skipped += 1
        continue
      }
      const cycleKey = candidate.cartUpdatedAt
        ? `cart:${candidate.cartUpdatedAt}`
        : `day:${new Date().toISOString().slice(0, 10)}`
      if (await grantClaimedPromotion({ promotion, identity: candidate, cycleKey })) granted += 1
      else skipped += 1
    }
  }
  return {
    partners: new Set(promotions.map((promotion) => promotion.partner_id)).size,
    promotions: promotions.length,
    granted,
    skipped,
    expired: expired.length,
  }
}

export async function runPartnerPromotionMaintenance(): Promise<PartnerPromotionMaintenanceResult> {
  if (!isPgConfigured()) return EMPTY_MAINTENANCE_RESULT
  const client = await getPgPool().connect()
  try {
    const lock = await client.query<{ locked: boolean }>(
      `select pg_try_advisory_lock(hashtext('partner-promotion-maintenance')) as locked`
    )
    if (lock.rows[0]?.locked !== true) return EMPTY_MAINTENANCE_RESULT
    try {
      return await runPartnerPromotionMaintenanceUnlocked()
    } finally {
      await client
        .query(`select pg_advisory_unlock(hashtext('partner-promotion-maintenance'))`)
        .catch(() => undefined)
    }
  } finally {
    client.release()
  }
}

// Keep this import-used type close to the promotion contract when the admin
// upsert surface is extended in the same release.
export type PartnerAutoPromotionUpsertInput = UpsertPromotionInput
export type PartnerAutoPromotionView = PartnerPromotionRow
