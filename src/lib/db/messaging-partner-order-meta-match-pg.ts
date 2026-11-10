import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type PartnerOrderMetaMatch = {
  clientIp: string | null
  userAgent: string | null
  fbp: string | null
  fbc: string | null
  externalId: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function clip(raw: string | null | undefined, max: number): string | null {
  const value = String(raw ?? '').trim()
  if (!value) return null
  return value.slice(0, max)
}

/** Ghi lúc tạo đơn. Bảng chưa migrate thì bỏ qua, không chặn đơn. */
export async function savePartnerOrderMetaMatch(input: {
  orderId: string
  partnerId: string
  clientIp?: string | null
  userAgent?: string | null
  fbp?: string | null
  fbc?: string | null
  externalId?: string | null
}): Promise<void> {
  if (!isPgConfigured()) return
  if (!UUID_RE.test(input.orderId) || !UUID_RE.test(input.partnerId)) return
  try {
    await pgQuery(
      `insert into public.messaging_partner_order_meta_match (
         order_id, partner_id, client_ip, user_agent, fbp, fbc, external_id, updated_at
       ) values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, now())
       on conflict (order_id) do update set
         client_ip = coalesce(excluded.client_ip, messaging_partner_order_meta_match.client_ip),
         user_agent = coalesce(excluded.user_agent, messaging_partner_order_meta_match.user_agent),
         fbp = coalesce(excluded.fbp, messaging_partner_order_meta_match.fbp),
         fbc = coalesce(excluded.fbc, messaging_partner_order_meta_match.fbc),
         external_id = coalesce(excluded.external_id, messaging_partner_order_meta_match.external_id),
         updated_at = now()`,
      [
        input.orderId,
        input.partnerId,
        clip(input.clientIp, 80),
        clip(input.userAgent, 512),
        clip(input.fbp, 256),
        clip(input.fbc, 512),
        clip(input.externalId, 128),
      ]
    )
  } catch (e) {
    console.warn('[savePartnerOrderMetaMatch]', e instanceof Error ? e.message : 'failed')
  }
}

export async function readPartnerOrderMetaMatch(orderId: string): Promise<PartnerOrderMetaMatch | null> {
  if (!isPgConfigured() || !UUID_RE.test(orderId)) return null
  try {
    const row = await pgQueryOne<{
      client_ip: string | null
      user_agent: string | null
      fbp: string | null
      fbc: string | null
      external_id: string | null
    }>(
      `select client_ip, user_agent, fbp, fbc, external_id
       from public.messaging_partner_order_meta_match
       where order_id = $1::uuid
       limit 1`,
      [orderId]
    )
    if (!row) return null
    return {
      clientIp: row.client_ip?.trim() || null,
      userAgent: row.user_agent?.trim() || null,
      fbp: row.fbp?.trim() || null,
      fbc: row.fbc?.trim() || null,
      externalId: row.external_id?.trim() || null,
    }
  } catch (e) {
    console.warn('[readPartnerOrderMetaMatch]', e instanceof Error ? e.message : 'failed')
    return null
  }
}
