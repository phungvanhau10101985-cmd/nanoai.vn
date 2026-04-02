'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import type { Database } from '@/types/database.types'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { sendFacebookMessengerImageUrl, sendFacebookMessengerText } from '@/lib/customer-care/facebook-messenger'
import { sendZaloOaText } from '@/lib/customer-care/zalo-oa'
import { insertMessage } from '@/lib/customer-care/conversation-service'
import { getFacebookSendToken, getZaloSendToken, upsertFacebookMessengerChannel, upsertZaloOaChannel } from '@/lib/messaging/partner-channels-db'
import { cancelPendingAiJobsForConversation } from '@/lib/messaging/partner-ai-inbound'
import type { Json } from '@/types/database.types'
import {
  GUEST_CHAT_IMAGE_BUCKET,
  buildPartnerMediaPayload,
  guestImageObjectExists,
  isPartnerMessagingStoragePathForPartner,
  mimeFromGuestImagePath,
  partnerMediaPayloadToJson,
} from '@/lib/messaging/guest-chat-image'

async function requireUser() {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser(), 'Authentication required.')
  if ('error' in result) return { error: result.error }
  return { user: result.user, supabase }
}

async function assertPartnerOwner(supabase: SupabaseClient<Database>, userId: string, partnerId: string) {
  const { data, error } = await supabase
    .from('messaging_partners')
    .select('id')
    .eq('id', partnerId)
    .eq('owner_user_id', userId)
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: 'Forbidden.' }
  return { ok: true as const }
}

function revalidateMessagingDashboard() {
  revalidatePath('/dashboard/messaging')
  revalidatePath('/dashboard/messaging/settings')
}

function slugify(name: string) {
  const s = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return s || 'shop'
}

export async function createMessagingWorkspace(displayName: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth
  const name = displayName.trim()
  if (!name || name.length > 120) return { error: 'Invalid name.' }

  let base = slugify(name)
  if (base === 'nanoai') base = `${base}-ws`
  const suffix = Math.random().toString(36).slice(2, 6)
  const slug = `${base}-${suffix}`

  const { data, error } = await supabase
    .from('messaging_partners')
    .insert({ slug, display_name: name, owner_user_id: user.id })
    .select('*')
    .single()

  if (error) return { error: error.message }
  revalidateMessagingDashboard()
  return { partner: data }
}

export async function getPartnerChannelStatus(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth
  const gate = await assertPartnerOwner(supabase, user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const svc = createServiceRoleClient()
  const { data: fb } = await svc
    .from('messaging_partner_channels')
    .select('external_page_id, page_access_token, webhook_verify_token')
    .eq('partner_id', partnerId)
    .eq('provider', 'facebook_messenger')
    .maybeSingle()
  const { data: zalo } = await svc
    .from('messaging_partner_channels')
    .select('zalo_access_token, zalo_webhook_secret')
    .eq('partner_id', partnerId)
    .eq('provider', 'zalo_oa')
    .maybeSingle()
  return {
    facebookPageId: fb?.external_page_id ?? null,
    facebookHasToken: Boolean(fb?.page_access_token),
    facebookHasVerify: Boolean(fb?.webhook_verify_token),
    zaloConfigured: Boolean(zalo?.zalo_access_token && zalo?.zalo_webhook_secret),
  }
}

export async function listMyMessagingPartners() {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth
  const { data, error } = await supabase
    .from('messaging_partners')
    .select('*')
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) return { error: error.message }
  return { rows: data ?? [] }
}

export async function listPartnerConversations(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth
  const gate = await assertPartnerOwner(supabase, user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const { data, error } = await supabase
    .from('customer_care_conversations')
    .select('*')
    .eq('partner_id', partnerId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(100)
  if (error) return { error: error.message }
  return { rows: data ?? [] }
}

export async function listPartnerMessages(partnerId: string, conversationId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth
  const gate = await assertPartnerOwner(supabase, user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const { data: conv } = await supabase
    .from('customer_care_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('partner_id', partnerId)
    .maybeSingle()
  if (!conv) return { error: 'Conversation not found.' }
  const { data, error } = await supabase
    .from('customer_care_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) return { error: error.message }
  return { rows: data ?? [] }
}

export async function sendPartnerReply(
  partnerId: string,
  conversationId: string,
  text: string,
  imageStoragePath?: string | null
) {
  const trimmed = text.trim()
  const imgPath = typeof imageStoragePath === 'string' ? imageStoragePath.trim() : ''
  if (!trimmed && !imgPath) return { error: 'Empty message.' }
  if (trimmed.length > 8000) return { error: 'Message too long.' }

  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth
  const gate = await assertPartnerOwner(supabase, user.id, partnerId)
  if ('error' in gate) return { error: gate.error }

  const { data: conv, error: convErr } = await supabase
    .from('customer_care_conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('partner_id', partnerId)
    .single()

  if (convErr || !conv) return { error: 'Conversation not found.' }

  await cancelPendingAiJobsForConversation(conversationId)

  let rawPayload: Json | null = null
  let imagePublicUrl: string | null = null
  let body: string

  if (imgPath) {
    if (!isPartnerMessagingStoragePathForPartner(imgPath, partnerId)) {
      return { error: 'Invalid image path.' }
    }
    let svc: ReturnType<typeof createServiceRoleClient>
    try {
      svc = createServiceRoleClient()
    } catch {
      return { error: 'Server configuration error.' }
    }
    const exists = await guestImageObjectExists(svc, imgPath)
    if (!exists) return { error: 'Image not found.' }
    const mime = mimeFromGuestImagePath(imgPath)
    const { data: pub } = svc.storage.from(GUEST_CHAT_IMAGE_BUCKET).getPublicUrl(imgPath)
    imagePublicUrl = pub.publicUrl
    rawPayload = partnerMediaPayloadToJson(buildPartnerMediaPayload(imagePublicUrl, imgPath, mime))
    body = trimmed ? `📷 ${trimmed}` : '📷'
  } else {
    body = trimmed
  }

  const externalId = conv.external_thread_id

  if (conv.channel === 'facebook') {
    let pageToken: string | null = null
    try {
      const svc = createServiceRoleClient()
      const pageId = conv.channel_external_ref
      if (pageId) {
        const r = await getFacebookSendToken(svc, conv.partner_id, pageId)
        if (r.error) return { error: r.error }
        pageToken = r.token ?? null
      }
    } catch {
      return { error: 'Server configuration error.' }
    }
    if (!pageToken) return { error: 'Configure Facebook Page token in channel settings.' }
    if (trimmed) {
      const sentT = await sendFacebookMessengerText(externalId, trimmed, pageToken)
      if ('error' in sentT) return { error: sentT.error }
    }
    if (imagePublicUrl) {
      const sentI = await sendFacebookMessengerImageUrl(externalId, imagePublicUrl, pageToken)
      if ('error' in sentI) return { error: sentI.error }
    }
  } else if (conv.channel === 'zalo') {
    let zaloToken: string | null = null
    try {
      const svc = createServiceRoleClient()
      const r = await getZaloSendToken(svc, conv.partner_id)
      if (r.error) return { error: r.error }
      zaloToken = r.token ?? null
    } catch {
      return { error: 'Server configuration error.' }
    }
    if (!zaloToken) return { error: 'Configure Zalo OA token in channel settings.' }
    const zaloBody =
      trimmed && imagePublicUrl
        ? `${trimmed}\n${imagePublicUrl}`
        : imagePublicUrl
          ? `📷\n${imagePublicUrl}`
          : trimmed
    const sent = await sendZaloOaText(externalId, zaloBody, zaloToken)
    if ('error' in sent) return { error: sent.error }
  }

  const ins = await insertMessage(supabase, {
    conversationId,
    direction: 'outbound',
    body,
    rawPayload,
    senderAdminId: user.id,
  })
  if ('error' in ins) return { error: ins.error }

  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function savePartnerFacebookChannel(
  partnerId: string,
  facebookPageId: string,
  pageAccessToken: string,
  webhookVerifyToken?: string
) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth
  const gate = await assertPartnerOwner(supabase, user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const pageId = facebookPageId.trim()
  let token = pageAccessToken.trim()
  let verifyTok = webhookVerifyToken?.trim() ?? ''
  try {
    const svc = createServiceRoleClient()
    const { data: existingFb } = await svc
      .from('messaging_partner_channels')
      .select('external_page_id, page_access_token, webhook_verify_token')
      .eq('partner_id', partnerId)
      .eq('provider', 'facebook_messenger')
      .maybeSingle()
    if (!token && existingFb?.external_page_id === pageId && existingFb.page_access_token) {
      token = existingFb.page_access_token
    }
    if (!verifyTok && existingFb?.external_page_id === pageId && existingFb.webhook_verify_token) {
      verifyTok = existingFb.webhook_verify_token
    }
    if (!pageId || !token) return { error: 'Page ID and Page access token are required (or leave token blank only when updating the same Page already saved).' }
    const r = await upsertFacebookMessengerChannel(svc, {
      partnerId,
      facebookPageId: pageId,
      pageAccessToken: token,
      webhookVerifyToken: verifyTok || null,
    })
    if ('error' in r) return { error: r.error }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Server error.' }
  }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function savePartnerZaloChannel(partnerId: string, zaloWebhookSecret: string, zaloAccessToken: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth
  const gate = await assertPartnerOwner(supabase, user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  let sec = zaloWebhookSecret.trim()
  let tok = zaloAccessToken.trim()
  try {
    const svc = createServiceRoleClient()
    const { data: existingZalo } = await svc
      .from('messaging_partner_channels')
      .select('zalo_access_token, zalo_webhook_secret')
      .eq('partner_id', partnerId)
      .eq('provider', 'zalo_oa')
      .maybeSingle()
    if (!tok && existingZalo?.zalo_access_token) tok = existingZalo.zalo_access_token
    if (!sec && existingZalo?.zalo_webhook_secret) sec = existingZalo.zalo_webhook_secret
    if (!sec || !tok) return { error: 'Webhook secret and OA access token are required (or leave blank to keep saved values).' }
    const r = await upsertZaloOaChannel(svc, {
      partnerId,
      zaloAccessToken: tok,
      zaloWebhookSecret: sec,
    })
    if ('error' in r) return { error: r.error }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Server error.' }
  }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export type PartnerAiSettingsPayload = {
  enabled: boolean
  reply_delay_seconds: number
  typing_pause_min_ms: number
  typing_pause_max_ms: number
  shop_policy: string
  tone_instructions: string
  append_ai_disclosure: boolean
  disclosure_suffix: string
}

export async function getPartnerAiBundle(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth
  const gate = await assertPartnerOwner(supabase, user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const { data: settings } = await supabase
    .from('messaging_partner_ai_settings')
    .select('*')
    .eq('partner_id', partnerId)
    .maybeSingle()
  const { data: faqs } = await supabase
    .from('messaging_partner_faq')
    .select('*')
    .eq('partner_id', partnerId)
    .order('sort_order', { ascending: true })
  const { data: inventory } = await supabase
    .from('messaging_partner_inventory')
    .select('*')
    .eq('partner_id', partnerId)
    .order('sort_order', { ascending: true })
  return { settings: settings ?? null, faqs: faqs ?? [], inventory: inventory ?? [] }
}

export async function savePartnerAiSettings(partnerId: string, payload: PartnerAiSettingsPayload) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth
  const gate = await assertPartnerOwner(supabase, user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const delay = Math.min(900, Math.max(15, Math.floor(Number(payload.reply_delay_seconds) || 60)))
  const tmin = Math.min(30000, Math.max(0, Math.floor(Number(payload.typing_pause_min_ms) || 1200)))
  const tmax = Math.min(30000, Math.max(0, Math.floor(Number(payload.typing_pause_max_ms) || 3800)))
  const now = new Date().toISOString()
  const { error } = await supabase.from('messaging_partner_ai_settings').upsert(
    {
      partner_id: partnerId,
      enabled: Boolean(payload.enabled),
      reply_delay_seconds: delay,
      typing_pause_min_ms: Math.min(tmin, tmax),
      typing_pause_max_ms: Math.max(tmin, tmax),
      shop_policy: payload.shop_policy ?? '',
      tone_instructions: payload.tone_instructions ?? '',
      append_ai_disclosure: Boolean(payload.append_ai_disclosure),
      disclosure_suffix:
        payload.disclosure_suffix?.trim() ||
        '(Automated message from the shop’s AI assistant.)',
      updated_at: now,
    },
    { onConflict: 'partner_id' }
  )
  if (error) return { error: error.message }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function upsertPartnerFaq(
  partnerId: string,
  faqId: string | null,
  fields: { trigger_keywords: string; answer: string; sort_order: number; is_active: boolean }
) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth
  const gate = await assertPartnerOwner(supabase, user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const now = new Date().toISOString()
  if (faqId) {
    const { error } = await supabase
      .from('messaging_partner_faq')
      .update({
        trigger_keywords: fields.trigger_keywords,
        answer: fields.answer,
        sort_order: fields.sort_order,
        is_active: fields.is_active,
        updated_at: now,
      })
      .eq('id', faqId)
      .eq('partner_id', partnerId)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('messaging_partner_faq').insert({
      partner_id: partnerId,
      trigger_keywords: fields.trigger_keywords,
      answer: fields.answer,
      sort_order: fields.sort_order,
      is_active: fields.is_active,
      created_at: now,
      updated_at: now,
    })
    if (error) return { error: error.message }
  }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function deletePartnerFaq(partnerId: string, faqId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth
  const gate = await assertPartnerOwner(supabase, user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const { error } = await supabase.from('messaging_partner_faq').delete().eq('id', faqId).eq('partner_id', partnerId)
  if (error) return { error: error.message }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function upsertPartnerInventoryItem(
  partnerId: string,
  itemId: string | null,
  fields: {
    name: string
    sku: string
    description: string
    stock_note: string
    price_hint: string
    sort_order: number
    is_active: boolean
  }
) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth
  const gate = await assertPartnerOwner(supabase, user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const now = new Date().toISOString()
  const sku = fields.sku.trim() || null
  if (itemId) {
    const { error } = await supabase
      .from('messaging_partner_inventory')
      .update({
        name: fields.name.trim(),
        sku,
        description: fields.description ?? '',
        stock_note: fields.stock_note ?? '',
        price_hint: fields.price_hint ?? '',
        sort_order: fields.sort_order,
        is_active: fields.is_active,
        updated_at: now,
      })
      .eq('id', itemId)
      .eq('partner_id', partnerId)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('messaging_partner_inventory').insert({
      partner_id: partnerId,
      name: fields.name.trim(),
      sku,
      description: fields.description ?? '',
      stock_note: fields.stock_note ?? '',
      price_hint: fields.price_hint ?? '',
      sort_order: fields.sort_order,
      is_active: fields.is_active,
      created_at: now,
      updated_at: now,
    })
    if (error) return { error: error.message }
  }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function deletePartnerInventoryItem(partnerId: string, itemId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth
  const gate = await assertPartnerOwner(supabase, user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const { error } = await supabase
    .from('messaging_partner_inventory')
    .delete()
    .eq('id', itemId)
    .eq('partner_id', partnerId)
  if (error) return { error: error.message }
  revalidateMessagingDashboard()
  return { ok: true as const }
}
