import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type PartnerGuestPushSubscriptionRow = {
  id: string
  partnerId: string
  guestAccountId: string
  endpoint: string
  p256dh: string
  auth: string
  customDomain: boolean
}

function mapRow(r: Record<string, unknown>): PartnerGuestPushSubscriptionRow {
  return {
    id: String(r.id),
    partnerId: String(r.partner_id),
    guestAccountId: String(r.guest_account_id),
    endpoint: String(r.endpoint),
    p256dh: String(r.p256dh),
    auth: String(r.auth),
    customDomain: Boolean(r.custom_domain),
  }
}

export async function upsertPartnerGuestPushSubscriptionFromPg(input: {
  partnerId: string
  guestAccountId: string
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string | null
  customDomain: boolean
}): Promise<{ ok: boolean; error?: string }> {
  if (!isPgConfigured()) return { ok: false, error: 'database_not_configured' }
  const guestAccountId = input.guestAccountId.trim()
  const endpoint = input.endpoint.trim()
  if (!guestAccountId || !endpoint || !input.p256dh.trim() || !input.auth.trim()) {
    return { ok: false, error: 'invalid_subscription' }
  }
  try {
    await pgQuery(
      `insert into public.messaging_partner_guest_push_subscriptions (
         partner_id, guest_account_id, endpoint, p256dh, auth, user_agent, custom_domain, updated_at
       ) values (
         $1::uuid, $2, $3, $4, $5, $6, $7, timezone('utc'::text, now())
       )
       on conflict (partner_id, guest_account_id, endpoint) do update set
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         user_agent = excluded.user_agent,
         custom_domain = excluded.custom_domain,
         updated_at = timezone('utc'::text, now())`,
      [
        input.partnerId,
        guestAccountId,
        endpoint,
        input.p256dh.trim(),
        input.auth.trim(),
        (input.userAgent ?? '').trim().slice(0, 500) || null,
        input.customDomain,
      ]
    )
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function listPartnerGuestPushSubscriptionsFromPg(input: {
  partnerId: string
  guestAccountId: string
}): Promise<PartnerGuestPushSubscriptionRow[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text, partner_id::text, guest_account_id::text, endpoint, p256dh, auth, custom_domain
       from public.messaging_partner_guest_push_subscriptions
       where partner_id = $1::uuid and guest_account_id = $2`,
      [input.partnerId, input.guestAccountId.trim()]
    )
    return rows.map(mapRow)
  } catch (e) {
    console.warn('[listPartnerGuestPushSubscriptionsFromPg]', e)
    return []
  }
}

export async function countPartnerGuestPushSubscriptionsFromPg(input: {
  partnerId: string
  guestAccountId: string
}): Promise<number> {
  if (!isPgConfigured()) return 0
  try {
    const row = await pgQueryOne<{ c: string }>(
      `select count(*)::text as c
       from public.messaging_partner_guest_push_subscriptions
       where partner_id = $1::uuid and guest_account_id = $2`,
      [input.partnerId, input.guestAccountId.trim()]
    )
    return Math.max(0, Number(row?.c ?? 0) || 0)
  } catch (e) {
    console.warn('[countPartnerGuestPushSubscriptionsFromPg]', e)
    return 0
  }
}

export async function deletePartnerGuestPushSubscriptionByIdFromPg(id: string): Promise<void> {
  if (!isPgConfigured() || !id.trim()) return
  try {
    await pgQuery(`delete from public.messaging_partner_guest_push_subscriptions where id = $1::uuid`, [id])
  } catch (e) {
    console.warn('[deletePartnerGuestPushSubscriptionByIdFromPg]', e)
  }
}

export async function deletePartnerGuestPushSubscriptionFromPg(input: {
  partnerId: string
  guestAccountId: string
  endpoint?: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    if (input.endpoint?.trim()) {
      await pgQuery(
        `delete from public.messaging_partner_guest_push_subscriptions
         where partner_id = $1::uuid and guest_account_id = $2 and endpoint = $3`,
        [input.partnerId, input.guestAccountId.trim(), input.endpoint.trim()]
      )
    } else {
      await pgQuery(
        `delete from public.messaging_partner_guest_push_subscriptions
         where partner_id = $1::uuid and guest_account_id = $2`,
        [input.partnerId, input.guestAccountId.trim()]
      )
    }
    return true
  } catch (e) {
    console.warn('[deletePartnerGuestPushSubscriptionFromPg]', e)
    return false
  }
}
