import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { partnerSiteAccountTabPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

/**
 * W5.2 — in-app notifications for guest customers (no push/email in v1).
 * Schema: db/migrations/20260806150000_messaging_partner_customer_notifications.sql
 */

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
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text, partner_id::text, guest_account_id::text, type, title, body, href,
              read_at, created_at
       from public.messaging_partner_customer_notifications
       where partner_id = $1::uuid and guest_account_id = $2
       order by created_at desc
       limit $3 offset $4`,
      [input.partnerId, input.guestAccountId.trim(), limit, offset]
    )
    return rows.map(mapRow)
  } catch (e) {
    console.warn('[listPartnerCustomerNotificationsFromPg]', e)
    return null
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
}): Promise<PartnerCustomerNotificationRow | null> {
  if (!isPgConfigured()) return null
  const guestAccountId = input.guestAccountId.trim()
  if (!guestAccountId) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `insert into public.messaging_partner_customer_notifications (
         partner_id, guest_account_id, type, title, body, href, created_at
       ) values (
         $1::uuid, $2, $3, $4, $5, $6, timezone('utc'::text, now())
       )
       returning id::text, partner_id::text, guest_account_id::text, type, title, body, href,
                 read_at, created_at`,
      [
        input.partnerId,
        guestAccountId,
        (input.type ?? 'order').trim().slice(0, 40) || 'order',
        input.title.trim().slice(0, 180),
        input.body.trim().slice(0, 2000),
        (input.href ?? '').trim().slice(0, 500),
      ]
    )
    return row ? mapRow(row) : null
  } catch (e) {
    console.warn('[insertPartnerCustomerNotificationFromPg]', e)
    return null
  }
}

/**
 * Fire-and-forget helper: resolve guest_account_id from conversation + site slug,
 * then insert an order-related notification. Safe to call without awaiting.
 */
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

    await insertPartnerCustomerNotificationFromPg({
      partnerId: input.partnerId,
      guestAccountId,
      type: 'order',
      title: input.title,
      body: input.body,
      href,
    })
  } catch (e) {
    console.warn('[notifyPartnerCustomerOrderUpdateFromPg]', e)
  }
}
