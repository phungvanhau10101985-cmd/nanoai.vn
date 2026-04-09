import type { Database } from '@/types/database.types'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type MessagingPartnerChannelRow = Database['public']['Tables']['messaging_partner_channels']['Row']

export async function findFacebookChannelByPageIdFromPg(facebookPageId: string): Promise<
  { partner_id: string; page_access_token: string | null; webhook_verify_token: string | null } | null
> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<Record<string, unknown>>(
    `select partner_id::text, page_access_token, webhook_verify_token
     from public.messaging_partner_channels
     where provider = 'facebook_messenger' and external_page_id = $1
     limit 1`,
    [facebookPageId]
  )
  if (!row) return null
  return {
    partner_id: String(row.partner_id),
    page_access_token: row.page_access_token != null ? String(row.page_access_token) : null,
    webhook_verify_token: row.webhook_verify_token != null ? String(row.webhook_verify_token) : null,
  }
}

export async function findFacebookChannelByVerifyTokenFromPg(verifyToken: string): Promise<{
  id: string
  partner_id: string
  external_page_id: string
} | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<Record<string, unknown>>(
    `select id::text as id, partner_id::text, external_page_id
     from public.messaging_partner_channels
     where provider = 'facebook_messenger' and webhook_verify_token = $1
     limit 1`,
    [verifyToken]
  )
  if (!row) return null
  return {
    id: String(row.id),
    partner_id: String(row.partner_id),
    external_page_id: String(row.external_page_id ?? ''),
  }
}

export async function findZaloChannelByWebhookSecretFromPg(secret: string): Promise<{
  partner_id: string
  zalo_access_token: string | null
} | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<Record<string, unknown>>(
    `select partner_id::text, zalo_access_token
     from public.messaging_partner_channels
     where provider = 'zalo_oa' and zalo_webhook_secret = $1
     limit 1`,
    [secret]
  )
  if (!row) return null
  return {
    partner_id: String(row.partner_id),
    zalo_access_token: row.zalo_access_token != null ? String(row.zalo_access_token) : null,
  }
}

export async function getFacebookSendTokenFromPg(
  partnerId: string,
  facebookPageId: string
): Promise<string | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<{ t: string | null }>(
    `select page_access_token as t from public.messaging_partner_channels
     where provider = 'facebook_messenger' and partner_id = $1::uuid and external_page_id = $2
     limit 1`,
    [partnerId, facebookPageId]
  )
  return row?.t ?? null
}

export async function getZaloSendTokenFromPg(partnerId: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<{ t: string | null }>(
    `select zalo_access_token as t from public.messaging_partner_channels
     where provider = 'zalo_oa' and partner_id = $1::uuid
     limit 1`,
    [partnerId]
  )
  return row?.t ?? null
}

export async function findFacebookChannelRowByPageForUpsertFromPg(
  facebookPageId: string
): Promise<{ id: string; partner_id: string } | null> {
  const row = await pgQueryOne<Record<string, unknown>>(
    `select id::text as id, partner_id::text from public.messaging_partner_channels
     where provider = 'facebook_messenger' and external_page_id = $1
     limit 1`,
    [facebookPageId]
  )
  if (!row) return null
  return { id: String(row.id), partner_id: String(row.partner_id) }
}

export async function findZaloChannelRowForPartnerFromPg(partnerId: string): Promise<{ id: string } | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<{ id: string }>(
    `select id::text as id from public.messaging_partner_channels
     where provider = 'zalo_oa' and partner_id = $1::uuid
     limit 1`,
    [partnerId]
  )
  return row ?? null
}

export async function upsertFacebookMessengerChannelPg(params: {
  partnerId: string
  facebookPageId: string
  pageAccessToken: string
  webhookVerifyToken?: string | null
}): Promise<{ ok: true } | { error: string }> {
  if (!isPgConfigured()) return { error: 'Postgres not configured.' }
  const { partnerId, facebookPageId, pageAccessToken, webhookVerifyToken } = params
  const existing = await findFacebookChannelRowByPageForUpsertFromPg(facebookPageId)
  if (existing && existing.partner_id !== partnerId) {
    return { error: 'This Facebook Page is already linked to another workspace.' }
  }
  const now = new Date().toISOString()
  if (existing?.id) {
    const u = await getPgPool().query(
      `update public.messaging_partner_channels set
         partner_id = $1::uuid,
         page_access_token = $2,
         webhook_verify_token = $3,
         updated_at = $4::timestamptz
       where id = $5::uuid`,
      [partnerId, pageAccessToken, webhookVerifyToken ?? null, now, existing.id]
    )
    if ((u.rowCount ?? 0) < 1) {
      return { error: 'Could not save Facebook channel (row missing or conflict).' }
    }
  } else {
    const ins = await getPgPool().query(
      `insert into public.messaging_partner_channels (
         partner_id, provider, external_page_id, page_access_token, webhook_verify_token, created_at, updated_at
       ) values ($1::uuid, 'facebook_messenger', $2, $3, $4, $5::timestamptz, $5::timestamptz)`,
      [partnerId, facebookPageId, pageAccessToken, webhookVerifyToken ?? null, now]
    )
    if ((ins.rowCount ?? 0) < 1) {
      return { error: 'Could not create Facebook channel.' }
    }
  }
  return { ok: true as const }
}

export async function upsertZaloOaChannelPg(params: {
  partnerId: string
  zaloAccessToken: string
  zaloWebhookSecret: string
}): Promise<{ ok: true } | { error: string }> {
  if (!isPgConfigured()) return { error: 'Postgres not configured.' }
  const { partnerId, zaloAccessToken, zaloWebhookSecret } = params
  const existing = await findZaloChannelRowForPartnerFromPg(partnerId)
  const now = new Date().toISOString()
  if (existing?.id) {
    const u = await getPgPool().query(
      `update public.messaging_partner_channels set
         zalo_access_token = $1,
         zalo_webhook_secret = $2,
         page_access_token = null,
         webhook_verify_token = null,
         updated_at = $3::timestamptz
       where id = $4::uuid`,
      [zaloAccessToken, zaloWebhookSecret, now, existing.id]
    )
    if ((u.rowCount ?? 0) < 1) {
      return { error: 'Could not save Zalo channel (row missing or conflict).' }
    }
  } else {
    const ins = await getPgPool().query(
      `insert into public.messaging_partner_channels (
         partner_id, provider, external_page_id, page_access_token, webhook_verify_token,
         zalo_access_token, zalo_webhook_secret, created_at, updated_at
       ) values ($1::uuid, 'zalo_oa', 'default', null, null, $2, $3, $4::timestamptz, $4::timestamptz)`,
      [partnerId, zaloAccessToken, zaloWebhookSecret, now]
    )
    if ((ins.rowCount ?? 0) < 1) {
      return { error: 'Could not create Zalo channel.' }
    }
  }
  return { ok: true as const }
}

/** Đọc kênh FB/Zalo cho dashboard (embed API integration). */
export async function fetchPartnerChannelStatusRowsFromPg(partnerId: string): Promise<{
  facebook: Pick<
    MessagingPartnerChannelRow,
    'external_page_id' | 'page_access_token' | 'webhook_verify_token'
  > | null
  zalo: Pick<MessagingPartnerChannelRow, 'zalo_access_token' | 'zalo_webhook_secret'> | null
} | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select provider, external_page_id, page_access_token, webhook_verify_token,
              zalo_access_token, zalo_webhook_secret
       from public.messaging_partner_channels
       where partner_id = $1::uuid`,
      [partnerId]
    )
    let facebook: {
      external_page_id: string
      page_access_token: string | null
      webhook_verify_token: string | null
    } | null = null
    let zalo: { zalo_access_token: string | null; zalo_webhook_secret: string | null } | null = null
    for (const r of rows) {
      const p = String(r.provider ?? '')
      if (p === 'facebook_messenger') {
        facebook = {
          external_page_id: String(r.external_page_id ?? ''),
          page_access_token: r.page_access_token != null ? String(r.page_access_token) : null,
          webhook_verify_token: r.webhook_verify_token != null ? String(r.webhook_verify_token) : null,
        }
      }
      if (p === 'zalo_oa') {
        zalo = {
          zalo_access_token: r.zalo_access_token != null ? String(r.zalo_access_token) : null,
          zalo_webhook_secret: r.zalo_webhook_secret != null ? String(r.zalo_webhook_secret) : null,
        }
      }
    }
    return { facebook, zalo }
  } catch (e) {
    console.error('[messaging-partner-channels-pg] fetchPartnerChannelStatusRowsFromPg', e)
    return null
  }
}
