import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

type Db = SupabaseClient<Database>

export async function findFacebookChannelByPageId(db: Db, facebookPageId: string) {
  const { data, error } = await db
    .from('messaging_partner_channels')
    .select('partner_id, page_access_token, webhook_verify_token')
    .eq('provider', 'facebook_messenger')
    .eq('external_page_id', facebookPageId)
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { channel: null as null }
  return { channel: data }
}

export async function findFacebookChannelByVerifyToken(db: Db, verifyToken: string) {
  const { data, error } = await db
    .from('messaging_partner_channels')
    .select('id, partner_id, external_page_id')
    .eq('provider', 'facebook_messenger')
    .eq('webhook_verify_token', verifyToken)
    .limit(1)
  if (error) return { error: error.message }
  return { row: data?.[0] ?? null }
}

export async function findZaloChannelByWebhookSecret(db: Db, secret: string) {
  const { data, error } = await db
    .from('messaging_partner_channels')
    .select('partner_id, zalo_access_token')
    .eq('provider', 'zalo_oa')
    .eq('zalo_webhook_secret', secret)
    .limit(1)
  if (error) return { error: error.message }
  return { row: data?.[0] ?? null }
}

export async function getFacebookSendToken(
  db: Db,
  partnerId: string,
  facebookPageId: string
): Promise<{ token: string | null; error?: string }> {
  const { data, error } = await db
    .from('messaging_partner_channels')
    .select('page_access_token')
    .eq('provider', 'facebook_messenger')
    .eq('partner_id', partnerId)
    .eq('external_page_id', facebookPageId)
    .maybeSingle()
  if (error) return { token: null, error: error.message }
  return { token: data?.page_access_token ?? null }
}

export async function getZaloSendToken(db: Db, partnerId: string): Promise<{ token: string | null; error?: string }> {
  const { data, error } = await db
    .from('messaging_partner_channels')
    .select('zalo_access_token')
    .eq('provider', 'zalo_oa')
    .eq('partner_id', partnerId)
    .limit(1)
  if (error) return { token: null, error: error.message }
  return { token: data?.[0]?.zalo_access_token ?? null }
}

export async function upsertFacebookMessengerChannel(
  db: Db,
  params: {
    partnerId: string
    facebookPageId: string
    pageAccessToken: string
    webhookVerifyToken?: string | null
  }
) {
  const { partnerId, facebookPageId, pageAccessToken, webhookVerifyToken } = params
  const { data: existing, error: selErr } = await db
    .from('messaging_partner_channels')
    .select('id')
    .eq('provider', 'facebook_messenger')
    .eq('external_page_id', facebookPageId)
    .maybeSingle()
  if (selErr) return { error: selErr.message }
  if (existing?.id) {
    const { data: ownerRow, error: ownErr } = await db
      .from('messaging_partner_channels')
      .select('partner_id')
      .eq('id', existing.id)
      .single()
    if (ownErr) return { error: ownErr.message }
    if (ownerRow?.partner_id !== partnerId) {
      return { error: 'This Facebook Page is already linked to another workspace.' }
    }
  }
  const now = new Date().toISOString()
  const row = {
    partner_id: partnerId,
    provider: 'facebook_messenger' as const,
    external_page_id: facebookPageId,
    page_access_token: pageAccessToken,
    webhook_verify_token: webhookVerifyToken ?? null,
    updated_at: now,
  }
  if (existing?.id) {
    const { error } = await db.from('messaging_partner_channels').update(row).eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await db.from('messaging_partner_channels').insert({ ...row, created_at: now })
    if (error) return { error: error.message }
  }
  return { ok: true as const }
}

export async function upsertZaloOaChannel(
  db: Db,
  params: {
    partnerId: string
    zaloAccessToken: string
    zaloWebhookSecret: string
  }
) {
  const { partnerId, zaloAccessToken, zaloWebhookSecret } = params
  const { data: existing, error: selErr } = await db
    .from('messaging_partner_channels')
    .select('id')
    .eq('provider', 'zalo_oa')
    .eq('partner_id', partnerId)
    .maybeSingle()
  if (selErr) return { error: selErr.message }
  const now = new Date().toISOString()
  const row = {
    partner_id: partnerId,
    provider: 'zalo_oa' as const,
    external_page_id: 'default',
    zalo_access_token: zaloAccessToken,
    zalo_webhook_secret: zaloWebhookSecret,
    page_access_token: null,
    webhook_verify_token: null,
    updated_at: now,
  }
  if (existing?.id) {
    const { error } = await db.from('messaging_partner_channels').update(row).eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await db.from('messaging_partner_channels').insert({ ...row, created_at: now })
    if (error) return { error: error.message }
  }
  return { ok: true as const }
}
