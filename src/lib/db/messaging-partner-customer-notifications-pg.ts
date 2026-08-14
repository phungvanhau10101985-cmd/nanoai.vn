import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { partnerSiteAccountTabPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

/**
 * W5.2 + 188-style shop notifications (scheduled / expiry / email / broadcast).
 * Schema: 20260806150000 + 20260814100000 + 20260814120000
 */

export type PartnerCustomerNotificationEmailStatus = 'none' | 'pending' | 'sent' | 'skipped' | 'failed'
export type PartnerCustomerNotificationPushStatus = 'none' | 'pending' | 'sent' | 'skipped' | 'failed'

export type PartnerCustomerNotificationRow = {
  id: string
  partnerId: string
  guestAccountId: string
  type: string
  title: string
  body: string
  href: string
  readAt: string | null
  createdAt: string
  scheduledAt: string
  expiresAt: string | null
  emailStatus: PartnerCustomerNotificationEmailStatus
  emailError: string
  pushStatus: PartnerCustomerNotificationPushStatus
  pushError: string
  broadcastId: string | null
}

export type PartnerNotificationBroadcastRow = {
  id: string
  partnerId: string
  title: string
  body: string
  type: string
  scheduledAt: string
  expiresAt: string | null
  sendEmail: boolean
  audience: string
  source: string
  createdAt: string
  totalProcessed: number
  successCount: number
  errorCount: number
  emailSentCount: number
}

const NOTIFICATION_SELECT = `id::text, partner_id::text, guest_account_id::text, type, title, body, href,
              read_at, created_at, scheduled_at, expires_at, email_status, email_error,
              push_status, push_error, broadcast_id::text`

function mapDeliveryStatus(raw: unknown): PartnerCustomerNotificationEmailStatus {
  const value = String(raw ?? 'none')
  return value === 'pending' || value === 'sent' || value === 'skipped' || value === 'failed'
    ? value
    : 'none'
}

function mapRow(r: Record<string, unknown>): PartnerCustomerNotificationRow {
  return {
    id: String(r.id),
    partnerId: String(r.partner_id),
    guestAccountId: String(r.guest_account_id),
    type: String(r.type ?? 'order'),
    title: String(r.title ?? ''),
    body: String(r.body ?? ''),
    href: String(r.href ?? ''),
    readAt: r.read_at ? String(r.read_at) : null,
    createdAt: String(r.created_at ?? ''),
    scheduledAt: String(r.scheduled_at ?? r.created_at ?? ''),
    expiresAt: r.expires_at ? String(r.expires_at) : null,
    emailStatus: mapDeliveryStatus(r.email_status),
    emailError: String(r.email_error ?? ''),
    pushStatus: mapDeliveryStatus(r.push_status),
    pushError: String(r.push_error ?? ''),
    broadcastId: r.broadcast_id ? String(r.broadcast_id) : null,
  }
}

function mapBroadcast(r: Record<string, unknown>): PartnerNotificationBroadcastRow {
  return {
    id: String(r.id),
    partnerId: String(r.partner_id),
    title: String(r.title ?? ''),
    body: String(r.body ?? ''),
    type: String(r.type ?? 'system'),
    scheduledAt: String(r.scheduled_at ?? ''),
    expiresAt: r.expires_at ? String(r.expires_at) : null,
    sendEmail: Boolean(r.send_email),
    audience: String(r.audience ?? 'import'),
    source: String(r.source ?? 'compose'),
    createdAt: String(r.created_at ?? ''),
    totalProcessed: Number(r.total_processed ?? 0) || 0,
    successCount: Number(r.success_count ?? 0) || 0,
    errorCount: Number(r.error_count ?? 0) || 0,
    emailSentCount: Number(r.email_sent_count ?? 0) || 0,
  }
}

export async function deleteExpiredPartnerCustomerNotificationsFromPg(input?: {
  partnerId?: string
  guestAccountId?: string
}): Promise<number> {
  if (!isPgConfigured()) return 0
  try {
    const partnerId = input?.partnerId?.trim() ?? ''
    const guestAccountId = input?.guestAccountId?.trim() ?? ''
    const rows = await pgQuery<{ id: string }>(
      `delete from public.messaging_partner_customer_notifications
       where expires_at is not null
         and expires_at <= timezone('utc'::text, now())
         and ($1 = '' or partner_id = $1::uuid)
         and ($2 = '' or guest_account_id = $2)
       returning id::text`,
      [partnerId, guestAccountId]
    )
    return rows.length
  } catch (e) {
    console.warn('[deleteExpiredPartnerCustomerNotificationsFromPg]', e)
    return 0
  }
}

export async function listPartnerCustomerNotificationsFromPg(input: {
  partnerId: string
  guestAccountId: string
  limit?: number
  offset?: number
}): Promise<PartnerCustomerNotificationRow[] | null> {
  if (!isPgConfigured()) return null
  const limit = Math.min(100, Math.max(1, Math.floor(input.limit ?? 50)))
  const offset = Math.max(0, Math.floor(input.offset ?? 0))
  await deleteExpiredPartnerCustomerNotificationsFromPg({
    partnerId: input.partnerId,
    guestAccountId: input.guestAccountId,
  })
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select ${NOTIFICATION_SELECT}
       from public.messaging_partner_customer_notifications
       where partner_id = $1::uuid
         and guest_account_id = $2
         and scheduled_at <= timezone('utc'::text, now())
         and (expires_at is null or expires_at > timezone('utc'::text, now()))
       order by scheduled_at desc, created_at desc
       limit $3 offset $4`,
      [input.partnerId, input.guestAccountId.trim(), limit, offset]
    )
    return rows.map(mapRow)
  } catch (e) {
    console.warn('[listPartnerCustomerNotificationsFromPg]', e)
    return null
  }
}

export async function countUnreadPartnerCustomerNotificationsFromPg(input: {
  partnerId: string
  guestAccountId: string
}): Promise<number> {
  if (!isPgConfigured()) return 0
  try {
    const row = await pgQueryOne<{ c: string }>(
      `select count(*)::text as c
       from public.messaging_partner_customer_notifications
       where partner_id = $1::uuid
         and guest_account_id = $2
         and read_at is null
         and scheduled_at <= timezone('utc'::text, now())
         and (expires_at is null or expires_at > timezone('utc'::text, now()))`,
      [input.partnerId, input.guestAccountId.trim()]
    )
    return Math.max(0, Number(row?.c ?? 0) || 0)
  } catch (e) {
    console.warn('[countUnreadPartnerCustomerNotificationsFromPg]', e)
    return 0
  }
}

export async function markPartnerCustomerNotificationReadFromPg(input: {
  partnerId: string
  guestAccountId: string
  notificationId: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.messaging_partner_customer_notifications
       set read_at = coalesce(read_at, timezone('utc'::text, now()))
       where id = $1::uuid
         and partner_id = $2::uuid
         and guest_account_id = $3
       returning id::text`,
      [input.notificationId, input.partnerId, input.guestAccountId.trim()]
    )
    return Boolean(row)
  } catch (e) {
    console.warn('[markPartnerCustomerNotificationReadFromPg]', e)
    return false
  }
}

export async function markAllPartnerCustomerNotificationsReadFromPg(input: {
  partnerId: string
  guestAccountId: string
}): Promise<number> {
  if (!isPgConfigured()) return 0
  try {
    const rows = await pgQuery<{ id: string }>(
      `update public.messaging_partner_customer_notifications
       set read_at = timezone('utc'::text, now())
       where partner_id = $1::uuid
         and guest_account_id = $2
         and read_at is null
         and scheduled_at <= timezone('utc'::text, now())
       returning id::text`,
      [input.partnerId, input.guestAccountId.trim()]
    )
    return rows.length
  } catch (e) {
    console.warn('[markAllPartnerCustomerNotificationsReadFromPg]', e)
    return 0
  }
}

export async function insertPartnerCustomerNotificationFromPg(input: {
  partnerId: string
  guestAccountId: string
  type?: string
  title: string
  body: string
  href?: string
  scheduledAt?: Date | string
  expiresAt?: Date | string | null
  emailStatus?: PartnerCustomerNotificationEmailStatus
  pushStatus?: PartnerCustomerNotificationPushStatus
  broadcastId?: string | null
}): Promise<PartnerCustomerNotificationRow | null> {
  if (!isPgConfigured()) return null
  const guestAccountId = input.guestAccountId.trim()
  if (!guestAccountId) return null
  const scheduledAt =
    input.scheduledAt instanceof Date
      ? input.scheduledAt.toISOString()
      : input.scheduledAt?.trim() || new Date().toISOString()
  const expiresAt =
    input.expiresAt instanceof Date
      ? input.expiresAt.toISOString()
      : input.expiresAt?.trim() || null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `insert into public.messaging_partner_customer_notifications (
         partner_id, guest_account_id, type, title, body, href, created_at,
         scheduled_at, expires_at, email_status, push_status, broadcast_id
       ) values (
         $1::uuid, $2, $3, $4, $5, $6, timezone('utc'::text, now()),
         $7::timestamptz, $8::timestamptz, $9, $10, $11::uuid
       )
       returning ${NOTIFICATION_SELECT}`,
      [
        input.partnerId,
        guestAccountId,
        (input.type ?? 'order').trim().slice(0, 40) || 'order',
        input.title.trim().slice(0, 180),
        input.body.trim().slice(0, 2000),
        (input.href ?? '').trim().slice(0, 500),
        scheduledAt,
        expiresAt,
        input.emailStatus ?? 'none',
        input.pushStatus ?? 'pending',
        input.broadcastId?.trim() || null,
      ]
    )
    return row ? mapRow(row) : null
  } catch (e) {
    console.warn('[insertPartnerCustomerNotificationFromPg]', e)
    return null
  }
}

export async function notifyPartnerCustomerOrderUpdateFromPg(input: {
  partnerId: string
  conversationId: string
  title: string
  body: string
}): Promise<void> {
  if (!isPgConfigured()) return
  try {
    const conv = await pgQueryOne<{ guest_account_id: string | null }>(
      `select guest_account_id::text as guest_account_id
       from public.customer_care_conversations
       where id = $1::uuid and partner_id = $2::uuid
       limit 1`,
      [input.conversationId, input.partnerId]
    )
    const guestAccountId = conv?.guest_account_id?.trim() ?? ''
    if (!guestAccountId) return

    const site = await pgQueryOne<{ site_slug: string }>(
      `select site_slug from public.messaging_partner_websites
       where partner_id = $1::uuid
       limit 1`,
      [input.partnerId]
    )
    const siteSlug = site?.site_slug?.trim() ?? ''
    const href = siteSlug ? partnerSiteAccountTabPath(siteSlug, 'orders') : ''

    const row = await insertPartnerCustomerNotificationFromPg({
      partnerId: input.partnerId,
      guestAccountId,
      type: 'order',
      title: input.title,
      body: input.body,
      href,
      pushStatus: 'pending',
    })
    if (row) {
      void import('@/lib/messaging/partner-customer-notification-push')
        .then((m) => m.deliverPendingPartnerNotificationPush(row))
        .catch((e) => console.warn('[notifyPartnerCustomerOrderUpdateFromPg] push', e))
    }
  } catch (e) {
    console.warn('[notifyPartnerCustomerOrderUpdateFromPg]', e)
  }
}

export async function insertPartnerNotificationBroadcastFromPg(input: {
  partnerId: string
  title: string
  body: string
  type?: string
  scheduledAt: Date | string
  expiresAt?: Date | string | null
  sendEmail: boolean
  audience: 'import' | 'all_customers'
  source: 'compose' | 'import'
  createdBy?: string | null
}): Promise<PartnerNotificationBroadcastRow | null> {
  if (!isPgConfigured()) return null
  const scheduledAt =
    input.scheduledAt instanceof Date ? input.scheduledAt.toISOString() : input.scheduledAt
  const expiresAt =
    input.expiresAt instanceof Date
      ? input.expiresAt.toISOString()
      : input.expiresAt?.trim() || null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `insert into public.messaging_partner_notification_broadcasts (
         partner_id, title, body, type, scheduled_at, expires_at, send_email,
         audience, source, created_by
       ) values (
         $1::uuid, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7, $8, $9, $10::uuid
       )
       returning id::text, partner_id::text, title, body, type, scheduled_at, expires_at,
                 send_email, audience, source, created_at, total_processed, success_count,
                 error_count, email_sent_count`,
      [
        input.partnerId,
        input.title.trim().slice(0, 180),
        input.body.trim().slice(0, 2000),
        (input.type ?? 'system').trim().slice(0, 40) || 'system',
        scheduledAt,
        expiresAt,
        input.sendEmail,
        input.audience,
        input.source,
        input.createdBy?.trim() || null,
      ]
    )
    return row ? mapBroadcast(row) : null
  } catch (e) {
    console.warn('[insertPartnerNotificationBroadcastFromPg]', e)
    return null
  }
}

export async function updatePartnerNotificationBroadcastStatsFromPg(input: {
  broadcastId: string
  totalProcessed: number
  successCount: number
  errorCount: number
  emailSentCount: number
}): Promise<void> {
  if (!isPgConfigured()) return
  try {
    await pgQuery(
      `update public.messaging_partner_notification_broadcasts
       set total_processed = $2, success_count = $3, error_count = $4, email_sent_count = $5
       where id = $1::uuid`,
      [input.broadcastId, input.totalProcessed, input.successCount, input.errorCount, input.emailSentCount]
    )
  } catch (e) {
    console.warn('[updatePartnerNotificationBroadcastStatsFromPg]', e)
  }
}

export async function incrementPartnerNotificationBroadcastEmailSentFromPg(
  broadcastId: string,
  delta = 1
): Promise<void> {
  if (!isPgConfigured() || !broadcastId.trim()) return
  try {
    await pgQuery(
      `update public.messaging_partner_notification_broadcasts
       set email_sent_count = email_sent_count + $2
       where id = $1::uuid`,
      [broadcastId, Math.max(0, Math.floor(delta))]
    )
  } catch (e) {
    console.warn('[incrementPartnerNotificationBroadcastEmailSentFromPg]', e)
  }
}

export async function listPartnerNotificationBroadcastsFromPg(input: {
  partnerId: string
  limit?: number
}): Promise<PartnerNotificationBroadcastRow[]> {
  if (!isPgConfigured()) return []
  const limit = Math.min(50, Math.max(1, Math.floor(input.limit ?? 20)))
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text, partner_id::text, title, body, type, scheduled_at, expires_at,
              send_email, audience, source, created_at, total_processed, success_count,
              error_count, email_sent_count
       from public.messaging_partner_notification_broadcasts
       where partner_id = $1::uuid
       order by created_at desc
       limit $2`,
      [input.partnerId, limit]
    )
    return rows.map(mapBroadcast)
  } catch (e) {
    console.warn('[listPartnerNotificationBroadcastsFromPg]', e)
    return []
  }
}

export async function listPendingPartnerNotificationEmailsFromPg(input?: {
  limit?: number
}): Promise<PartnerCustomerNotificationRow[]> {
  if (!isPgConfigured()) return []
  const limit = Math.min(80, Math.max(1, Math.floor(input?.limit ?? 40)))
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select ${NOTIFICATION_SELECT}
       from public.messaging_partner_customer_notifications
       where email_status = 'pending'
         and scheduled_at <= timezone('utc'::text, now())
       order by scheduled_at asc
       limit $1`,
      [limit]
    )
    return rows.map(mapRow)
  } catch (e) {
    console.warn('[listPendingPartnerNotificationEmailsFromPg]', e)
    return []
  }
}

export async function listPendingPartnerNotificationPushesFromPg(input?: {
  limit?: number
}): Promise<PartnerCustomerNotificationRow[]> {
  if (!isPgConfigured()) return []
  const limit = Math.min(80, Math.max(1, Math.floor(input?.limit ?? 40)))
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select ${NOTIFICATION_SELECT}
       from public.messaging_partner_customer_notifications
       where push_status = 'pending'
         and scheduled_at <= timezone('utc'::text, now())
         and (expires_at is null or expires_at > timezone('utc'::text, now()))
       order by scheduled_at asc
       limit $1`,
      [limit]
    )
    return rows.map(mapRow)
  } catch (e) {
    console.warn('[listPendingPartnerNotificationPushesFromPg]', e)
    return []
  }
}

export async function markPartnerCustomerNotificationPushStatusFromPg(input: {
  notificationId: string
  status: Exclude<PartnerCustomerNotificationPushStatus, 'none' | 'pending'>
  error?: string
}): Promise<void> {
  if (!isPgConfigured()) return
  try {
    await pgQuery(
      `update public.messaging_partner_customer_notifications
       set push_status = $2, push_error = $3
       where id = $1::uuid`,
      [input.notificationId, input.status, (input.error ?? '').trim().slice(0, 180)]
    )
  } catch (e) {
    console.warn('[markPartnerCustomerNotificationPushStatusFromPg]', e)
  }
}

export async function markPartnerCustomerNotificationEmailStatusFromPg(input: {
  notificationId: string
  status: Exclude<PartnerCustomerNotificationEmailStatus, 'none' | 'pending'>
  error?: string
}): Promise<void> {
  if (!isPgConfigured()) return
  try {
    await pgQuery(
      `update public.messaging_partner_customer_notifications
       set email_status = $2, email_error = $3
       where id = $1::uuid`,
      [input.notificationId, input.status, (input.error ?? '').trim().slice(0, 180)]
    )
  } catch (e) {
    console.warn('[markPartnerCustomerNotificationEmailStatusFromPg]', e)
  }
}

export type PartnerNotificationRecipient = {
  guestAccountId: string
  email: string
  phone: string
}

function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, '')
}

function phoneLookupKeys(raw: string): { full: string; tail: string } | null {
  let digits = normalizePhoneDigits(raw)
  if (digits.endsWith('0') && digits.length > 11 && raw.includes('.')) {
    digits = digits.replace(/0+$/, '')
  }
  if (digits.length < 8) return null
  if (digits.startsWith('84') && digits.length >= 11) {
    digits = `0${digits.slice(2)}`
  }
  return { full: digits, tail: digits.slice(-9) }
}

export async function findPartnerNotificationRecipientFromPg(input: {
  partnerId: string
  phone?: string
  email?: string
}): Promise<PartnerNotificationRecipient | null> {
  if (!isPgConfigured()) return null
  const email = input.email?.trim().toLowerCase() ?? ''
  const phoneKeys = input.phone ? phoneLookupKeys(input.phone) : null
  if (!email && !phoneKeys) return null

  try {
    if (email) {
      const byEmail = await pgQueryOne<{
        id: string
        email_normalized: string
        email_raw: string
        customer_phone: string | null
      }>(
        `select ga.id::text as id, ga.email_normalized, ga.email_raw,
                coalesce(p.customer_phone, '') as customer_phone
         from public.messaging_guest_accounts ga
         left join public.messaging_partner_customer_profiles p
           on p.partner_id = ga.partner_id and p.email_normalized = ga.email_normalized
         where ga.partner_id = $1::uuid and ga.email_normalized = $2
         limit 1`,
        [input.partnerId, email]
      )
      if (byEmail) {
        return {
          guestAccountId: byEmail.id,
          email: byEmail.email_raw?.trim() || byEmail.email_normalized,
          phone: byEmail.customer_phone?.trim() || '',
        }
      }
    }

    if (phoneKeys) {
      const byPhone = await pgQueryOne<{
        id: string
        email_normalized: string
        email_raw: string
        customer_phone: string | null
      }>(
        `select ga.id::text as id, ga.email_normalized, ga.email_raw,
                coalesce(p.customer_phone, o.customer_phone, '') as customer_phone
         from public.messaging_guest_accounts ga
         left join public.messaging_partner_customer_profiles p
           on p.partner_id = ga.partner_id and p.email_normalized = ga.email_normalized
         left join lateral (
           select customer_phone
           from public.messaging_partner_orders
           where partner_id = ga.partner_id
             and lower(trim(customer_email)) = ga.email_normalized
           order by created_at desc
           limit 1
         ) o on true
         where ga.partner_id = $1::uuid
           and (
             right(regexp_replace(coalesce(p.customer_phone, ''), '\\D', '', 'g'), 9) = $2
             or right(regexp_replace(coalesce(o.customer_phone, ''), '\\D', '', 'g'), 9) = $2
             or regexp_replace(coalesce(p.customer_phone, ''), '\\D', '', 'g') = $3
             or regexp_replace(coalesce(o.customer_phone, ''), '\\D', '', 'g') = $3
           )
         limit 1`,
        [input.partnerId, phoneKeys.tail, phoneKeys.full]
      )
      if (byPhone) {
        return {
          guestAccountId: byPhone.id,
          email: byPhone.email_raw?.trim() || byPhone.email_normalized,
          phone: byPhone.customer_phone?.trim() || '',
        }
      }

      const orderOnly = await pgQueryOne<{
        customer_email: string | null
        customer_phone: string | null
        guest_account_id: string | null
      }>(
        `select o.customer_email, o.customer_phone, c.guest_account_id::text
         from public.messaging_partner_orders o
         left join public.customer_care_conversations c
           on c.id = o.conversation_id and c.partner_id = o.partner_id
         where o.partner_id = $1::uuid
           and (
             right(regexp_replace(coalesce(o.customer_phone, ''), '\\D', '', 'g'), 9) = $2
             or regexp_replace(coalesce(o.customer_phone, ''), '\\D', '', 'g') = $3
           )
         order by o.created_at desc
         limit 1`,
        [input.partnerId, phoneKeys.tail, phoneKeys.full]
      )
      if (orderOnly?.guest_account_id) {
        return {
          guestAccountId: orderOnly.guest_account_id,
          email: (orderOnly.customer_email ?? '').trim().toLowerCase(),
          phone: (orderOnly.customer_phone ?? '').trim(),
        }
      }
      if (orderOnly?.customer_email?.trim()) {
        const emailFromOrder = orderOnly.customer_email.trim().toLowerCase()
        const guestFromOrder = await pgQueryOne<{ id: string; email_raw: string; email_normalized: string }>(
          `select id::text as id, email_raw, email_normalized
           from public.messaging_guest_accounts
           where partner_id = $1::uuid and email_normalized = $2
           limit 1`,
          [input.partnerId, emailFromOrder]
        )
        if (guestFromOrder) {
          return {
            guestAccountId: guestFromOrder.id,
            email: guestFromOrder.email_raw?.trim() || guestFromOrder.email_normalized,
            phone: (orderOnly.customer_phone ?? '').trim(),
          }
        }
      }
    }
  } catch (e) {
    console.warn('[findPartnerNotificationRecipientFromPg]', e)
  }
  return null
}

export async function listAllPartnerNotificationRecipientsFromPg(input: {
  partnerId: string
  limit?: number
}): Promise<PartnerNotificationRecipient[]> {
  if (!isPgConfigured()) return []
  const limit = Math.min(20000, Math.max(1, Math.floor(input.limit ?? 5000)))
  try {
    const rows = await pgQuery<{
      id: string
      email_normalized: string
      email_raw: string
      customer_phone: string | null
    }>(
      `select ga.id::text as id, ga.email_normalized, ga.email_raw,
              coalesce(p.customer_phone, '') as customer_phone
       from public.messaging_guest_accounts ga
       left join public.messaging_partner_customer_profiles p
         on p.partner_id = ga.partner_id and p.email_normalized = ga.email_normalized
       where ga.partner_id = $1::uuid
       order by ga.last_login_at desc nulls last
       limit $2`,
      [input.partnerId, limit]
    )
    return rows.map((r) => ({
      guestAccountId: r.id,
      email: r.email_raw?.trim() || r.email_normalized,
      phone: r.customer_phone?.trim() || '',
    }))
  } catch (e) {
    console.warn('[listAllPartnerNotificationRecipientsFromPg]', e)
    return []
  }
}

export async function fetchGuestEmailForNotificationFromPg(input: {
  partnerId: string
  guestAccountId: string
}): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ email_raw: string; email_normalized: string }>(
      `select email_raw, email_normalized
       from public.messaging_guest_accounts
       where partner_id = $1::uuid and id = $2::uuid
       limit 1`,
      [input.partnerId, input.guestAccountId]
    )
    const email = (row?.email_raw || row?.email_normalized || '').trim().toLowerCase()
    return email || null
  } catch (e) {
    console.warn('[fetchGuestEmailForNotificationFromPg]', e)
    return null
  }
}
