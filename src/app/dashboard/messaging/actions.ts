'use server'

import { randomBytes } from 'node:crypto'
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
import { tryDeleteVisionProductForInventoryItem } from '@/lib/messaging/partner-vision-product-search'
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
import { parseTriggerKeywords } from '@/lib/messaging/partner-ai-faq'
import {
  isPartnerFaqPresetKey,
  PARTNER_FAQ_CUSTOM_KEYWORDS_REQUIRED,
  PARTNER_FAQ_PRESET_ANSWER_REQUIRED,
  presetSortOrder,
} from '@/lib/messaging/partner-faq-presets'
import {
  VISION_LOCATIONS,
  VISION_PRODUCT_CATEGORIES,
  type VisionProductCategory,
} from '@/lib/messaging/partner-vision-constants'
import {
  getVisionLocationForShopCountry,
  isVisionShopCountryCode,
} from '@/lib/messaging/partner-vision-shop-country-presets'

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
  revalidatePath('/dashboard/api-integration')
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

type MessagingPartnerAiSettingsRow = Database['public']['Tables']['messaging_partner_ai_settings']['Row']

/** Gửi xuống client: không lộ image_search_api_secret. */
export type PartnerAiSettingsClientRow = Omit<MessagingPartnerAiSettingsRow, 'image_search_api_secret'> & {
  image_search_api_key_configured: boolean
}

function toPartnerAiSettingsClient(row: MessagingPartnerAiSettingsRow | null): PartnerAiSettingsClientRow | null {
  if (!row) return null
  const { image_search_api_secret: _sec, ...rest } = row
  return { ...rest, image_search_api_key_configured: Boolean(_sec) }
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
  vision_product_search_enabled: boolean
  /** ISO 3166-1 alpha-2 uppercase hoặc rỗng → lưu null */
  vision_shop_country: string
  vision_location: string
  vision_product_category: string
  vision_gcs_bucket: string
  image_search_api_enabled: boolean
}

export type PartnerAiTokenUsageStatRow = {
  provider: string
  model: string
  call_count: number
  sum_prompt_tokens: number
  sum_completion_tokens: number
  sum_total_tokens: number
}

const PARTNER_AI_TOKEN_STATS_LOOKBACK_DAYS = 30

/** Tổng token theo model (API) trong N ngày gần đây — chủ shop xem trên dashboard. */
export async function getPartnerAiTokenUsageStats(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth
  const gate = await assertPartnerOwner(supabase, user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - PARTNER_AI_TOKEN_STATS_LOOKBACK_DAYS)
  const sinceIso = since.toISOString()
  const { data, error } = await supabase.rpc('messaging_partner_ai_token_stats_by_model', {
    p_partner_id: partnerId,
    p_since: sinceIso,
  })
  if (error) return { error: error.message }
  return {
    rows: (data ?? []) as PartnerAiTokenUsageStatRow[],
    sinceIso,
    lookbackDays: PARTNER_AI_TOKEN_STATS_LOOKBACK_DAYS,
  }
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
  return {
    settings: toPartnerAiSettingsClient(settings ?? null),
    faqs: faqs ?? [],
    inventory: inventory ?? [],
  }
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
  const shopCountryRaw = payload.vision_shop_country?.trim().toUpperCase() ?? ''
  const vision_shop_country = isVisionShopCountryCode(shopCountryRaw) ? shopCountryRaw : null

  const locRaw = payload.vision_location?.trim() || 'us-east1'
  let vision_location = (VISION_LOCATIONS as readonly string[]).includes(locRaw) ? locRaw : 'us-east1'
  if (vision_shop_country) {
    const mapped = getVisionLocationForShopCountry(vision_shop_country)
    if (mapped) vision_location = mapped
  }
  const catRaw = (payload.vision_product_category?.trim() || 'general-v1') as VisionProductCategory
  const vision_product_category = VISION_PRODUCT_CATEGORIES.includes(catRaw) ? catRaw : 'general-v1'
  const vision_gcs_bucket = payload.vision_gcs_bucket?.trim().slice(0, 200) ?? ''
  const now = new Date().toISOString()
  const { data: existingAi } = await supabase
    .from('messaging_partner_ai_settings')
    .select('vision_index_ready, vision_index_synced_at, vision_index_error, image_search_api_secret')
    .eq('partner_id', partnerId)
    .maybeSingle()

  const visionOff = !Boolean(payload.vision_product_search_enabled)
  const visionBgReset = visionOff
    ? {
        vision_bg_sync_status: 'idle' as const,
        vision_bg_sync_resume_after_id: null as string | null,
        vision_bg_sync_rounds: 0,
        vision_bg_sync_imported: 0,
        vision_bg_sync_removed: 0,
        vision_bg_sync_started_at: null as string | null,
        vision_bg_sync_finished_at: null as string | null,
        vision_bg_sync_error: '',
        vision_bg_sync_report: '',
      }
    : {}

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
      vision_product_search_enabled: Boolean(payload.vision_product_search_enabled),
      vision_shop_country,
      vision_location,
      vision_product_category,
      vision_gcs_bucket: vision_gcs_bucket,
      vision_index_ready: existingAi?.vision_index_ready ?? false,
      vision_index_synced_at: existingAi?.vision_index_synced_at ?? null,
      vision_index_error: existingAi?.vision_index_error ?? '',
      image_search_api_enabled: Boolean(payload.image_search_api_enabled),
      image_search_api_secret: existingAi?.image_search_api_secret ?? null,
      ...visionBgReset,
      updated_at: now,
    },
    { onConflict: 'partner_id' }
  )
  if (error) return { error: error.message }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function generatePartnerImageSearchApiSecret(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth
  const gate = await assertPartnerOwner(supabase, user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const { data: row } = await supabase
    .from('messaging_partner_ai_settings')
    .select('partner_id')
    .eq('partner_id', partnerId)
    .maybeSingle()
  if (!row) return { error: 'Save AI settings once before generating an API key.' }
  const secret = randomBytes(32).toString('hex')
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('messaging_partner_ai_settings')
    .update({ image_search_api_secret: secret, updated_at: now })
    .eq('partner_id', partnerId)
  if (error) return { error: error.message }
  revalidateMessagingDashboard()
  return { ok: true as const, secret }
}

/** Không trả secret — chỉ meta cho UI mask / toggle */
export async function getPartnerApiKeysBundle(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth
  const gate = await assertPartnerOwner(supabase, user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const { data: partner, error: pErr } = await supabase
    .from('messaging_partners')
    .select('embed_key')
    .eq('id', partnerId)
    .maybeSingle()
  if (pErr) return { error: pErr.message }
  const { data: ai, error: aiErr } = await supabase
    .from('messaging_partner_ai_settings')
    .select('image_search_api_enabled, image_search_api_secret')
    .eq('partner_id', partnerId)
    .maybeSingle()
  if (aiErr) return { error: aiErr.message }
  return {
    ok: true as const,
    embedKey: (partner?.embed_key ?? '').trim(),
    imageSearchConfigured: Boolean(ai?.image_search_api_secret?.trim()),
    imageSearchEnabled: Boolean(ai?.image_search_api_enabled),
    aiSettingsRowExists: Boolean(ai),
  }
}

export async function getPartnerImageSearchApiSecret(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth
  const gate = await assertPartnerOwner(supabase, user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const { data, error } = await supabase
    .from('messaging_partner_ai_settings')
    .select('image_search_api_secret')
    .eq('partner_id', partnerId)
    .maybeSingle()
  if (error) return { error: error.message }
  const secret = data?.image_search_api_secret?.trim() || null
  if (!secret) return { error: 'No API key set.' }
  return { ok: true as const, secret }
}

export async function clearPartnerImageSearchApiSecret(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth
  const gate = await assertPartnerOwner(supabase, user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('messaging_partner_ai_settings')
    .update({ image_search_api_secret: null, updated_at: now })
    .eq('partner_id', partnerId)
  if (error) return { error: error.message }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function setPartnerImageSearchApiEnabled(partnerId: string, enabled: boolean) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth
  const gate = await assertPartnerOwner(supabase, user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const { data: row } = await supabase
    .from('messaging_partner_ai_settings')
    .select('partner_id')
    .eq('partner_id', partnerId)
    .maybeSingle()
  if (!row) return { error: 'Save AI settings once in Messaging → AI settings before toggling the API.' }
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('messaging_partner_ai_settings')
    .update({ image_search_api_enabled: enabled, updated_at: now })
    .eq('partner_id', partnerId)
  if (error) return { error: error.message }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function upsertPartnerFaq(
  partnerId: string,
  faqId: string | null,
  fields: {
    custom_title: string
    trigger_keywords: string
    answer: string
    sort_order: number
    is_active: boolean
  }
) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth
  const gate = await assertPartnerOwner(supabase, user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (fields.is_active && parseTriggerKeywords(fields.trigger_keywords).length === 0) {
    return { error: PARTNER_FAQ_CUSTOM_KEYWORDS_REQUIRED }
  }
  const now = new Date().toISOString()
  const title = fields.custom_title.trim()
  if (faqId) {
    const { error } = await supabase
      .from('messaging_partner_faq')
      .update({
        custom_title: title,
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
      preset_key: null,
      custom_title: title,
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

export async function savePartnerFaqPreset(
  partnerId: string,
  presetKey: string,
  fields: { answer: string; is_active: boolean }
) {
  if (!isPartnerFaqPresetKey(presetKey)) return { error: 'Invalid FAQ preset.' }
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth
  const gate = await assertPartnerOwner(supabase, user.id, partnerId)
  if ('error' in gate) return { error: gate.error }

  const answer = fields.answer.trim()
  if (fields.is_active && !answer) {
    return { error: PARTNER_FAQ_PRESET_ANSWER_REQUIRED }
  }

  const now = new Date().toISOString()
  const sortOrder = presetSortOrder(presetKey)

  const { data: existing } = await supabase
    .from('messaging_partner_faq')
    .select('id')
    .eq('partner_id', partnerId)
    .eq('preset_key', presetKey)
    .maybeSingle()

  if (!fields.is_active && !answer) {
    if (existing?.id) {
      const { error } = await supabase.from('messaging_partner_faq').delete().eq('id', existing.id).eq('partner_id', partnerId)
      if (error) return { error: error.message }
    }
    revalidateMessagingDashboard()
    return { ok: true as const }
  }

  if (existing?.id) {
    const { error } = await supabase
      .from('messaging_partner_faq')
      .update({
        answer,
        is_active: fields.is_active,
        trigger_keywords: '',
        sort_order: sortOrder,
        preset_key: presetKey,
        updated_at: now,
      })
      .eq('id', existing.id)
      .eq('partner_id', partnerId)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('messaging_partner_faq').insert({
      partner_id: partnerId,
      preset_key: presetKey,
      trigger_keywords: '',
      answer,
      sort_order: sortOrder,
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

function normalizePartnerInventoryImageUrl(raw: string): string {
  const u = raw.trim()
  if (!u || u.length > 2048) return ''
  try {
    const parsed = new URL(u)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
    return u
  } catch {
    return ''
  }
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
    image_url: string
    product_url: string
    consult_note: string
    sort_order: number
  }
) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth
  const gate = await assertPartnerOwner(supabase, user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const now = new Date().toISOString()
  const sku = fields.sku.trim() || null
  const imageUrl = normalizePartnerInventoryImageUrl(fields.image_url ?? '')
  const productUrl = normalizePartnerInventoryImageUrl(fields.product_url ?? '')
  const consult = (fields.consult_note ?? '').trim().slice(0, 2000)
  if (itemId) {
    const { error } = await supabase
      .from('messaging_partner_inventory')
      .update({
        name: fields.name.trim(),
        sku,
        description: fields.description ?? '',
        stock_note: fields.stock_note ?? '',
        price_hint: fields.price_hint ?? '',
        image_url: imageUrl,
        product_url: productUrl,
        consult_note: consult,
        sort_order: fields.sort_order,
        is_active: true,
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
      image_url: imageUrl,
      product_url: productUrl,
      consult_note: consult,
      sort_order: fields.sort_order,
      is_active: true,
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
  await tryDeleteVisionProductForInventoryItem(supabase, partnerId, itemId)
  const { error } = await supabase
    .from('messaging_partner_inventory')
    .delete()
    .eq('id', itemId)
    .eq('partner_id', partnerId)
  if (error) return { error: error.message }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

const VISION_BG_SYNC_IDLE_PATCH = {
  vision_bg_sync_status: 'idle' as const,
  vision_bg_sync_resume_after_id: null as string | null,
  vision_bg_sync_rounds: 0,
  vision_bg_sync_imported: 0,
  vision_bg_sync_removed: 0,
  vision_bg_sync_started_at: null as string | null,
  vision_bg_sync_finished_at: null as string | null,
  vision_bg_sync_error: '',
  vision_bg_sync_report: '',
}

export type VisionBgSyncEnqueueErrorCode = 'already_active' | 'enable_vision_first' | 'no_ai_row'

/** Xếp hàng đồng bộ Vision nền (cron VPS). `resumeAfterId` null = quét từ đầu theo cursor server. */
export async function enqueueVisionCatalogBackgroundSync(
  partnerId: string,
  resumeAfterId: string | null
): Promise<
  { ok: true } | { error: string; code?: VisionBgSyncEnqueueErrorCode }
> {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error ?? 'Authentication required.' }
  const { user, supabase } = auth
  const gate = await assertPartnerOwner(supabase, user.id, partnerId)
  if ('error' in gate) return { error: gate.error ?? 'Forbidden.' }
  const { data: row, error: selErr } = await supabase
    .from('messaging_partner_ai_settings')
    .select('vision_product_search_enabled, vision_bg_sync_status')
    .eq('partner_id', partnerId)
    .maybeSingle()
  if (selErr) return { error: selErr.message }
  if (!row) {
    return {
      code: 'no_ai_row',
      error: 'Save AI settings once before starting background sync.',
    }
  }
  if (!row.vision_product_search_enabled) {
    return {
      code: 'enable_vision_first',
      error: 'Enable image-based suggestions before background catalog sync.',
    }
  }
  if (row.vision_bg_sync_status === 'queued' || row.vision_bg_sync_status === 'running') {
    return { code: 'already_active', error: 'Background sync is already queued or running.' }
  }
  const now = new Date().toISOString()
  const resume = resumeAfterId?.trim() || null
  const { error } = await supabase
    .from('messaging_partner_ai_settings')
    .update({
      vision_bg_sync_status: 'queued',
      vision_bg_sync_resume_after_id: resume,
      vision_bg_sync_rounds: 0,
      vision_bg_sync_imported: 0,
      vision_bg_sync_removed: 0,
      vision_bg_sync_started_at: null,
      vision_bg_sync_finished_at: null,
      vision_bg_sync_error: '',
      vision_bg_sync_report: '',
      updated_at: now,
    })
    .eq('partner_id', partnerId)
  if (error) return { error: error.message }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function cancelVisionCatalogBackgroundSync(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase } = auth
  const gate = await assertPartnerOwner(supabase, user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('messaging_partner_ai_settings')
    .update({
      ...VISION_BG_SYNC_IDLE_PATCH,
      updated_at: now,
    })
    .eq('partner_id', partnerId)
  if (error) return { error: error.message }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

/** Đóng banner báo cáo sau khi đã xem (job đã done/error). */
export async function dismissVisionCatalogBackgroundSyncReport(partnerId: string) {
  return cancelVisionCatalogBackgroundSync(partnerId)
}
