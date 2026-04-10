'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { getUserForAction } from '@/lib/auth'
import { RESERVED_MESSAGING_GUEST_SLUGS } from '@/lib/messaging/reserved-guest-slugs'
import {
  clearMessagingPartnerAiImageSearchSecretFromPg,
  emergencyDisablePartnerAiVisionFromPg,
  fetchMessagingPartnerAiImageSearchAuthFromPg,
  fetchMessagingPartnerAiSettingsFullFromPg,
  fetchMessagingPartnerAiUpsertPrereqFromPg,
  partnerMessagingAiSettingsRowExistsFromPg,
  peekMessagingPartnerAiImageSearchSecretFromPg,
  upsertMessagingPartnerAiSettingsDashboardFromPg,
  updateMessagingPartnerAiImageSearchEnabledFromPg,
  updateMessagingPartnerAiImageSearchSecretFromPg,
  updateMessagingPartnerAiVisionBgIdleFromPg,
  type PartnerAiSettingsDashboardUpsert,
} from '@/lib/db/messaging-partner-ai-settings-pg'
import {
  deleteMessagingPartnerFaqByIdFromPg,
  fetchMessagingPartnerFaqsAllFromPg,
  fetchMessagingPartnerFaqIdByPresetFromPg,
  insertMessagingPartnerFaqFromPg,
  updateMessagingPartnerFaqByIdFromPg,
  updateMessagingPartnerFaqPresetRowFromPg,
} from '@/lib/db/messaging-partner-faq-pg'
import {
  deletePartnerInventoryItemForPartnerFromPg,
  fetchPartnerInventoryActivePageWithCountFromPg,
  fetchPartnerInventoryEmbeddingStatsFromPg,
  insertPartnerInventoryDashboardItemFromPg,
  updatePartnerInventoryDashboardItemFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import {
  emergencyClearVisionWarehouseRunnerFromPg,
  fetchVisionWarehouseRunnerLockFieldsFromPg,
  unlockVisionWarehouseImportLockFromPg,
} from '@/lib/db/vision-warehouse-runner-pg'
import {
  fetchConversationFullForPartnerFromPg,
  fetchPartnerConversationsFromPg,
  insertMessagePg,
  listPartnerMessagesBundleFromPg,
} from '@/lib/db/customer-care-pg'
import {
  fetchPartnerChannelStatusRowsFromPg,
  getFacebookSendTokenFromPg,
  getZaloSendTokenFromPg,
  upsertFacebookMessengerChannelPg,
  upsertZaloOaChannelPg,
} from '@/lib/db/messaging-partner-channels-pg'
import {
  deactivateMessagingPartnerForOwnerFromPg,
  fetchMessagingPartnerEmbedKeyForOwnerFromPg,
  fetchMessagingPartnersByOwnerFromPg,
  insertMessagingPartnerForOwnerFromPg,
} from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchMessagingPartnerAiTokenStatsByModelFromPg } from '@/lib/db/messaging-partner-ai-token-usage-pg'
import { pgQueryOne } from '@/lib/db/pg-query'
import type { Database } from '@/types/database.types'
import { sendFacebookMessengerImageUrl, sendFacebookMessengerText } from '@/lib/customer-care/facebook-messenger'
import { sendZaloOaText } from '@/lib/customer-care/zalo-oa'
import { cancelPendingAiJobsForConversation } from '@/lib/messaging/partner-ai-inbound'
import type { Json } from '@/types/database.types'
import {
  buildPartnerMediaPayload,
  isPartnerMessagingStoragePathForPartner,
  mimeFromGuestImagePath,
  partnerMediaPayloadToJson,
} from '@/lib/messaging/guest-chat-image'
import { getTryOnPublicUrlFromPath, tryOnObjectExistsByPath } from '@/lib/storage/try-on-public-upload'
import { validateInventoryImageUrl } from '@/lib/messaging/partner-inventory-excel'
import { parseTriggerKeywords } from '@/lib/messaging/partner-ai-faq'
import {
  isPartnerFaqPresetKey,
  PARTNER_FAQ_CUSTOM_KEYWORDS_REQUIRED,
  PARTNER_FAQ_PRESET_ANSWER_REQUIRED,
  presetSortOrder,
} from '@/lib/messaging/partner-faq-presets'
import { syncPartnerInventoryEmbeddings } from '@/lib/messaging/partner-inventory-embedding'
import { isValidUuidString } from '@/lib/validate-uuid'

export type { PartnerAiTokenUsageStatRow } from '@/lib/db/messaging-partner-ai-token-usage-pg'

const PARTNER_INVENTORY_PAGE_SIZE = Math.max(
  50,
  Math.min(500, parseInt(process.env.PARTNER_INVENTORY_UI_PAGE_SIZE || '120', 10) || 120)
)

async function requireUser() {
  const result = await getUserForAction()
  if ('error' in result) return { error: result.error }
  return { user: result.user }
}

async function assertPartnerOwner(userId: string, partnerId: string) {
  if (!isValidUuidString(userId) || !isValidUuidString(partnerId)) {
    return { error: 'Forbidden.' }
  }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  try {
    const row = await pgQueryOne<{ id: string }>(
      `select id::text from public.messaging_partners
       where id = $1::uuid and owner_user_id = $2::uuid limit 1`,
      [partnerId, userId]
    )
    if (row) return { ok: true as const }
  } catch (e) {
    console.warn('[assertPartnerOwner] PG check failed', e)
  }
  return { error: 'Forbidden.' }
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

function normalizeCatalogImageUrl(raw: string | null | undefined): string {
  const t = (raw ?? '').trim()
  if (!t) return ''
  if (t.startsWith('//')) return `https:${t}`
  return t
}

function isCatalogImageSyncable(raw: string | null | undefined): boolean {
  const n = normalizeCatalogImageUrl(raw)
  return !!(n && /^https?:\/\//i.test(n))
}

function catalogFingerprintForRow(row: { image_url?: string | null; name?: string | null }): string {
  const imgKey = normalizeCatalogImageUrl(row.image_url)
  const n = (row.name ?? '').trim()
  return `${imgKey}\n${n}`
}

export async function createMessagingWorkspace(displayName: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const name = displayName.trim()
  if (!name || name.length > 120) return { error: 'Invalid name.' }

  let base = slugify(name)
  if (RESERVED_MESSAGING_GUEST_SLUGS.has(base)) base = `${base}-ws`
  const suffix = Math.random().toString(36).slice(2, 6)
  const slug = `${base}-${suffix}`

  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  const inserted = await insertMessagingPartnerForOwnerFromPg({
    slug,
    display_name: name,
    owner_user_id: user.id,
  })
  if (!inserted) {
    return { error: 'Không tạo được workspace.' }
  }
  revalidateMessagingDashboard()
  return { partner: inserted }
}

export async function getPartnerChannelStatus(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  try {
    const fromPg = await fetchPartnerChannelStatusRowsFromPg(partnerId)
    if (fromPg === null) {
      return { error: 'Failed to load channel status.' }
    }
    const fb = fromPg.facebook
    const zalo = fromPg.zalo
    return {
      facebookPageId: fb?.external_page_id ?? null,
      facebookHasToken: Boolean(fb?.page_access_token),
      facebookHasVerify: Boolean(fb?.webhook_verify_token),
      zaloConfigured: Boolean(zalo?.zalo_access_token && zalo?.zalo_webhook_secret),
    }
  } catch (e) {
    console.warn('[getPartnerChannelStatus] PG failed', e)
    return { error: e instanceof Error ? e.message : 'Failed to load channel status.' }
  }
}

export async function listMyMessagingPartners() {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  const fromPg = await fetchMessagingPartnersByOwnerFromPg(user.id)
  if (fromPg === null) {
    return { error: 'Failed to load messaging workspaces.' }
  }
  return { rows: fromPg }
}

export async function removeMyMessagingWorkspace(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  if (!isValidUuidString(partnerId)) return { error: 'Invalid workspace.' }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  const ok = await deactivateMessagingPartnerForOwnerFromPg(partnerId, user.id)
  if (!ok) return { error: 'Không xóa được workspace.' }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function listPartnerConversations(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  try {
    const rows = await fetchPartnerConversationsFromPg(partnerId)
    if (rows === null) return { error: 'Failed to load conversations.' }
    return { rows }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: msg }
  }
}

export async function listPartnerMessages(partnerId: string, conversationId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  try {
    const bundle = await listPartnerMessagesBundleFromPg(partnerId, conversationId)
    if (bundle === 'not_found') return { error: 'Conversation not found.' }
    if (bundle === null) return { error: 'Failed to load messages.' }
    return { rows: bundle.rows }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: msg }
  }
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
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }

  let conv: Database['public']['Tables']['customer_care_conversations']['Row'] | null = null
  try {
    const c = await fetchConversationFullForPartnerFromPg(partnerId, conversationId)
    if (c === 'not_found') return { error: 'Conversation not found.' }
    if (c === null) return { error: 'Conversation not found.' }
    conv = c
  } catch (e) {
    console.warn('[sendPartnerReply] PG conv load failed', e)
    return { error: 'Conversation not found.' }
  }
  if (!conv) return { error: 'Conversation not found.' }

  await cancelPendingAiJobsForConversation(conversationId)

  let rawPayload: Json | null = null
  let imagePublicUrl: string | null = null
  let body: string

  if (imgPath) {
    if (!isPartnerMessagingStoragePathForPartner(imgPath, partnerId)) {
      return { error: 'Invalid image path.' }
    }
    let exists: boolean
    try {
      exists = await tryOnObjectExistsByPath(imgPath)
    } catch {
      return { error: 'Server configuration error.' }
    }
    if (!exists) return { error: 'Image not found.' }
    const mime = mimeFromGuestImagePath(imgPath)
    imagePublicUrl = getTryOnPublicUrlFromPath(imgPath)
    rawPayload = partnerMediaPayloadToJson(buildPartnerMediaPayload(imagePublicUrl, imgPath, mime))
    body = trimmed ? `📷 ${trimmed}` : '📷'
  } else {
    body = trimmed
  }

  const externalId = conv.external_thread_id

  if (conv.channel === 'facebook') {
    let pageToken: string | null = null
    try {
      const pageId = conv.channel_external_ref
      if (pageId) {
        pageToken = await getFacebookSendTokenFromPg(conv.partner_id, pageId)
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
      zaloToken = await getZaloSendTokenFromPg(conv.partner_id)
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

  const ins = await insertMessagePg({
    conversationId,
    direction: 'outbound',
    body,
    rawPayload,
    senderAdminId: user.id,
  })
  if (!ins) return { error: 'Failed to save message.' }

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
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  const pageId = facebookPageId.trim()
  let token = pageAccessToken.trim()
  let verifyTok = webhookVerifyToken?.trim() ?? ''
  try {
    const st = await fetchPartnerChannelStatusRowsFromPg(partnerId)
    const existingFb = st?.facebook ?? null
    if (!token && existingFb?.external_page_id === pageId && existingFb.page_access_token) {
      token = existingFb.page_access_token
    }
    if (!verifyTok && existingFb?.external_page_id === pageId && existingFb.webhook_verify_token) {
      verifyTok = existingFb.webhook_verify_token
    }
    if (!pageId || !token) return { error: 'Page ID and Page access token are required (or leave token blank only when updating the same Page already saved).' }
    const r = await upsertFacebookMessengerChannelPg({
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
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  let sec = zaloWebhookSecret.trim()
  let tok = zaloAccessToken.trim()
  try {
    const st = await fetchPartnerChannelStatusRowsFromPg(partnerId)
    const existingZalo = st?.zalo ?? null
    if (!tok && existingZalo?.zalo_access_token) tok = existingZalo.zalo_access_token
    if (!sec && existingZalo?.zalo_webhook_secret) sec = existingZalo.zalo_webhook_secret
    if (!sec || !tok) return { error: 'Webhook secret and OA access token are required (or leave blank to keep saved values).' }
    const r = await upsertZaloOaChannelPg({
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

const PARTNER_AI_TOKEN_STATS_LOOKBACK_DAYS = 30

/** Tổng token theo model (API) trong N ngày gần đây — chủ shop xem trên dashboard. */
export async function getPartnerAiTokenUsageStats(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - PARTNER_AI_TOKEN_STATS_LOOKBACK_DAYS)
  const sinceIso = since.toISOString()
  const rows = await fetchMessagingPartnerAiTokenStatsByModelFromPg(partnerId, sinceIso)
  if (rows === null) return { error: 'Failed to load token usage stats.' }
  return {
    rows,
    sinceIso,
    lookbackDays: PARTNER_AI_TOKEN_STATS_LOOKBACK_DAYS,
  }
}

export type PartnerVisionCatalogStats = {
  totalInInventory: number
  /** Có URL ảnh https, không bị loại trừ Vision */
  withHttpsImageUrl: number
  /** Checksum khớp ảnh+tên hiện tại — luồng đồng bộ sẽ bỏ qua */
  syncedUpToDate: number
  /** Cần xử lý: chưa đẩy, hoặc đổi ảnh/tên, hoặc mất URL nhưng còn checksum (gỡ) */
  pendingSync: number
  visionCatalogExcluded: number
  /** Không loại trừ nhưng không có URL https */
  noHttpsImageUrl: number
}

export type PartnerVisionSyncHealth = {
  lockBusy: boolean
  lockBusyAt: string | null
  lockAgeSec: number | null
  lockOwner: string | null
  lockHeartbeatAt: string | null
  lockHeartbeatAgeSec: number | null
  pendingCount: number
  checksumDoneCount: number
  syncableCount: number
  lastProgressAt: string | null
}

export type PartnerInventoryEmbeddingStats = {
  total: number
  eligible: number
  done: number
  pending: number
  failed: number
}

function buildPartnerVisionCatalogStats(
  rows: Database['public']['Tables']['messaging_partner_inventory']['Row'][]
): PartnerVisionCatalogStats {
  let withHttpsImageUrl = 0
  let syncedUpToDate = 0
  let pendingSync = 0
  let visionCatalogExcluded = 0
  let noHttpsImageUrl = 0

  for (const row of rows) {
    if (row.vision_catalog_excluded) {
      visionCatalogExcluded += 1
      continue
    }
    const valid = isCatalogImageSyncable(row.image_url)
    if (!valid) {
      noHttpsImageUrl += 1
      if (row.vision_catalog_checksum) pendingSync += 1
      continue
    }
    withHttpsImageUrl += 1
    const fp = catalogFingerprintForRow(row)
    if (row.vision_catalog_checksum === fp) syncedUpToDate += 1
    else pendingSync += 1
  }

  return {
    totalInInventory: rows.length,
    withHttpsImageUrl,
    syncedUpToDate,
    pendingSync,
    visionCatalogExcluded,
    noHttpsImageUrl,
  }
}

function buildPartnerVisionSyncHealth(
  rows: Database['public']['Tables']['messaging_partner_inventory']['Row'][],
  runner: {
    assets_import_busy?: boolean | null
    assets_import_busy_at?: string | null
    assets_import_owner?: string | null
    assets_import_heartbeat_at?: string | null
  } | null
): PartnerVisionSyncHealth {
  let syncable = 0
  let done = 0
  let lastProgressAt: string | null = null

  for (const row of rows) {
    if (row.vision_catalog_excluded) continue
    if (!isCatalogImageSyncable(row.image_url)) continue
    syncable += 1
    if (row.vision_catalog_checksum) {
      done += 1
      const at = row.vision_catalog_synced_at ?? null
      if (at && (!lastProgressAt || at > lastProgressAt)) lastProgressAt = at
    }
  }

  const lockBusy = Boolean(runner?.assets_import_busy)
  const lockBusyAt = runner?.assets_import_busy_at ?? null
  const lockOwner = runner?.assets_import_owner?.trim() || null
  const lockHeartbeatAt = runner?.assets_import_heartbeat_at ?? null
  const lockAgeSec =
    lockBusy && lockBusyAt ? Math.max(0, Math.floor((Date.now() - Date.parse(lockBusyAt)) / 1000)) : null
  const lockHeartbeatAgeSec =
    lockBusy && lockHeartbeatAt
      ? Math.max(0, Math.floor((Date.now() - Date.parse(lockHeartbeatAt)) / 1000))
      : null

  return {
    lockBusy,
    lockBusyAt,
    lockAgeSec: Number.isFinite(lockAgeSec ?? NaN) ? lockAgeSec : null,
    lockOwner,
    lockHeartbeatAt,
    lockHeartbeatAgeSec: Number.isFinite(lockHeartbeatAgeSec ?? NaN) ? lockHeartbeatAgeSec : null,
    pendingCount: Math.max(0, syncable - done),
    checksumDoneCount: done,
    syncableCount: syncable,
    lastProgressAt,
  }
}

export async function getPartnerAiBundle(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  const settings = await fetchMessagingPartnerAiSettingsFullFromPg(partnerId)
  const faqsRaw = await fetchMessagingPartnerFaqsAllFromPg(partnerId)
  if (faqsRaw === null) return { error: 'Failed to load FAQs.' }
  const invPg = await fetchPartnerInventoryActivePageWithCountFromPg(
    partnerId,
    0,
    PARTNER_INVENTORY_PAGE_SIZE
  )
  if (invPg === null) return { error: 'Failed to load inventory.' }
  const runner = (await fetchVisionWarehouseRunnerLockFieldsFromPg(1)) ?? null
  const inv = invPg.rows
  const total = Math.max(inv.length, invPg.count)
  return {
    settings: toPartnerAiSettingsClient(settings ?? null),
    faqs: faqsRaw,
    inventory: inv,
    inventoryTotalCount: total,
    inventoryPageSize: PARTNER_INVENTORY_PAGE_SIZE,
    visionCatalogStats: buildPartnerVisionCatalogStats(inv),
    visionSyncHealth: buildPartnerVisionSyncHealth(inv, runner ?? null),
  }
}

export async function getPartnerInventoryPage(partnerId: string, page: number, pageSize?: number) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }

  const size = Math.max(20, Math.min(500, Math.floor(Number(pageSize) || PARTNER_INVENTORY_PAGE_SIZE)))
  const index = Math.max(0, Math.floor(Number(page) || 0))
  const from = index * size

  const invPg = await fetchPartnerInventoryActivePageWithCountFromPg(partnerId, from, size)
  if (invPg === null) return { error: 'Failed to load inventory.' }
  const outRows = invPg.rows
  const outTotal = Math.max(outRows.length, invPg.count)
  return {
    rows: outRows,
    page: index,
    pageSize: size,
    totalCount: outTotal,
    hasMore: from + outRows.length < outTotal,
  }
}

export async function getPartnerInventoryEmbeddingStats(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }

  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  const agg = await fetchPartnerInventoryEmbeddingStatsFromPg(partnerId)
  if (agg === null) return { error: 'Failed to load embedding stats.' }
  const stats: PartnerInventoryEmbeddingStats = {
    total: agg.total,
    eligible: agg.eligible,
    done: agg.done,
    pending: agg.pending,
    failed: agg.failed,
  }
  return { stats }
}

export async function triggerPartnerInventoryEmbeddingSync(partnerId: string, limit = 400) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }

  const batchLimit = Math.max(20, Math.min(5000, Math.floor(Number(limit) || 400)))
  const run = await syncPartnerInventoryEmbeddings(partnerId, { force: false, limit: batchLimit })
  if (!run.ok) return { error: run.error }
  revalidateMessagingDashboard()
  return run
}

export async function savePartnerAiSettings(partnerId: string, payload: PartnerAiSettingsPayload) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  const delay = Math.min(30, Math.max(5, Math.floor(Number(payload.reply_delay_seconds) || 10)))
  const tmin = Math.min(30000, Math.max(0, Math.floor(Number(payload.typing_pause_min_ms) || 700)))
  const tmax = Math.min(30000, Math.max(0, Math.floor(Number(payload.typing_pause_max_ms) || 1200)))
  const vision_shop_country: string | null = null
  const vision_location = 'us-central1'
  const vision_product_category = 'general-v1'
  const vision_gcs_bucket = ''
  const now = new Date().toISOString()
  const existingAi = await fetchMessagingPartnerAiUpsertPrereqFromPg(partnerId)

  const visionOff = true
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

  const upsertPayload: PartnerAiSettingsDashboardUpsert = {
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
    vision_product_search_enabled: false,
    vision_shop_country,
    vision_location,
    vision_product_category,
    vision_gcs_bucket: vision_gcs_bucket,
    vision_index_ready: existingAi?.vision_index_ready ?? false,
    vision_index_synced_at: existingAi?.vision_index_synced_at ?? null,
    vision_index_error: existingAi?.vision_index_error ?? '',
    image_search_api_enabled: Boolean(payload.image_search_api_enabled),
    image_search_api_secret: existingAi?.image_search_api_secret ?? null,
    ...(visionBgReset as Pick<
      PartnerAiSettingsDashboardUpsert,
      | 'vision_bg_sync_status'
      | 'vision_bg_sync_resume_after_id'
      | 'vision_bg_sync_rounds'
      | 'vision_bg_sync_imported'
      | 'vision_bg_sync_removed'
      | 'vision_bg_sync_started_at'
      | 'vision_bg_sync_finished_at'
      | 'vision_bg_sync_error'
      | 'vision_bg_sync_report'
    >),
    updated_at: now,
  }
  const ok = await upsertMessagingPartnerAiSettingsDashboardFromPg(upsertPayload)
  if (!ok) return { error: 'Failed to save AI settings.' }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function generatePartnerImageSearchApiSecret(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  const secret = randomBytes(32).toString('hex')
  const now = new Date().toISOString()
  const ex = await partnerMessagingAiSettingsRowExistsFromPg(partnerId)
  if (ex === null) return { error: 'Failed to verify AI settings.' }
  if (!ex) return { error: 'Save AI settings once before generating an API key.' }
  const upd = await updateMessagingPartnerAiImageSearchSecretFromPg(partnerId, secret, now)
  if (!upd) return { error: 'Failed to save API key.' }
  revalidateMessagingDashboard()
  return { ok: true as const, secret }
}

/** Không trả secret — chỉ meta cho UI mask / toggle */
export async function getPartnerApiKeysBundle(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  const embedKey = (await fetchMessagingPartnerEmbedKeyForOwnerFromPg(partnerId, user.id))?.trim() ?? ''
  const aiPg = await fetchMessagingPartnerAiImageSearchAuthFromPg(partnerId)
  const imageSearchConfigured = Boolean(aiPg?.image_search_api_secret?.trim())
  const imageSearchEnabled = Boolean(aiPg?.image_search_api_enabled)
  const aiSettingsRowExists = Boolean(aiPg)
  return {
    ok: true as const,
    embedKey,
    imageSearchConfigured,
    imageSearchEnabled,
    aiSettingsRowExists,
  }
}

export async function getPartnerImageSearchApiSecret(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  const peek = await peekMessagingPartnerAiImageSearchSecretFromPg(partnerId)
  if (peek === null) return { error: 'Failed to load API key.' }
  if (!peek.secret) return { error: 'No API key set.' }
  return { ok: true as const, secret: peek.secret }
}

export async function clearPartnerImageSearchApiSecret(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  const now = new Date().toISOString()
  const ok = await clearMessagingPartnerAiImageSearchSecretFromPg(partnerId, now)
  if (!ok) return { error: 'Failed to clear API key.' }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function setPartnerImageSearchApiEnabled(partnerId: string, enabled: boolean) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  const now = new Date().toISOString()
  const ex = await partnerMessagingAiSettingsRowExistsFromPg(partnerId)
  if (ex === null) return { error: 'Failed to verify AI settings.' }
  if (!ex) {
    return {
      error: 'Save AI settings once in Messaging → AI settings before toggling the API.',
    }
  }
  const ok = await updateMessagingPartnerAiImageSearchEnabledFromPg(partnerId, enabled, now)
  if (!ok) return { error: 'Failed to update image search API.' }
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
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  if (fields.is_active && parseTriggerKeywords(fields.trigger_keywords).length === 0) {
    return { error: PARTNER_FAQ_CUSTOM_KEYWORDS_REQUIRED }
  }
  const now = new Date().toISOString()
  const title = fields.custom_title.trim()
  if (faqId) {
    const ok = await updateMessagingPartnerFaqByIdFromPg(partnerId, faqId, {
      custom_title: title,
      trigger_keywords: fields.trigger_keywords,
      answer: fields.answer,
      sort_order: fields.sort_order,
      is_active: fields.is_active,
      updated_at: now,
    })
    if (!ok) return { error: 'Failed to update FAQ.' }
  } else {
    const ok = await insertMessagingPartnerFaqFromPg({
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
    if (!ok) return { error: 'Failed to insert FAQ.' }
  }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function savePartnerFaqPreset(
  partnerId: string,
  presetKey: string,
  fields: { custom_title: string; answer: string; is_active: boolean }
) {
  if (!isPartnerFaqPresetKey(presetKey)) return { error: 'Invalid FAQ preset.' }
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }

  const customTitle = fields.custom_title.trim()
  const answer = fields.answer.trim()
  if (fields.is_active && !answer) {
    return { error: PARTNER_FAQ_PRESET_ANSWER_REQUIRED }
  }

  const now = new Date().toISOString()
  const sortOrder = presetSortOrder(presetKey)

  const existingId: string | null = await fetchMessagingPartnerFaqIdByPresetFromPg(partnerId, presetKey)

  if (!fields.is_active && !answer) {
    if (existingId) {
      const ok = await deleteMessagingPartnerFaqByIdFromPg(partnerId, existingId)
      if (!ok) return { error: 'Failed to delete FAQ preset.' }
    }
    revalidateMessagingDashboard()
    return { ok: true as const }
  }

  if (existingId) {
    const ok = await updateMessagingPartnerFaqPresetRowFromPg(partnerId, existingId, {
      custom_title: customTitle,
      answer,
      is_active: fields.is_active,
      sort_order: sortOrder,
      preset_key: presetKey,
      updated_at: now,
    })
    if (!ok) return { error: 'Failed to update FAQ preset.' }
  } else {
    const ok = await insertMessagingPartnerFaqFromPg({
      partner_id: partnerId,
      preset_key: presetKey,
      custom_title: customTitle,
      trigger_keywords: '',
      answer,
      sort_order: sortOrder,
      is_active: fields.is_active,
      created_at: now,
      updated_at: now,
    })
    if (!ok) return { error: 'Failed to insert FAQ preset.' }
  }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function deletePartnerFaq(partnerId: string, faqId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  const ok = await deleteMessagingPartnerFaqByIdFromPg(partnerId, faqId)
  if (!ok) return { error: 'Failed to delete FAQ.' }
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
    image_url: string
    product_url: string
    consult_note: string
    sort_order: number
  }
) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  const now = new Date().toISOString()
  const sku = fields.sku.trim() || null
  const imageUrl = validateInventoryImageUrl(fields.image_url ?? '')
  const productUrl = validateInventoryImageUrl(fields.product_url ?? '')
  const consult = (fields.consult_note ?? '').trim().slice(0, 2000)
  if (itemId) {
    const ok = await updatePartnerInventoryDashboardItemFromPg(partnerId, itemId, {
      name: fields.name.trim(),
      sku,
      description: fields.description ?? '',
      stock_note: fields.stock_note ?? '',
      price_hint: fields.price_hint ?? '',
      image_url: imageUrl,
      product_url: productUrl,
      consult_note: consult,
      sort_order: fields.sort_order,
      updated_at: now,
    })
    if (!ok) return { error: 'Failed to update inventory item.' }
    await syncPartnerInventoryEmbeddings(partnerId, { inventoryIds: [itemId], force: false })
  } else {
    const newId = await insertPartnerInventoryDashboardItemFromPg(partnerId, {
      name: fields.name.trim(),
      sku,
      description: fields.description ?? '',
      stock_note: fields.stock_note ?? '',
      price_hint: fields.price_hint ?? '',
      image_url: imageUrl,
      product_url: productUrl,
      consult_note: consult,
      sort_order: fields.sort_order,
      created_at: now,
      updated_at: now,
    })
    if (!newId) return { error: 'Failed to insert inventory item.' }
    await syncPartnerInventoryEmbeddings(partnerId, { inventoryIds: [newId], force: false })
  }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function deletePartnerInventoryItem(partnerId: string, itemId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  const ok = await deletePartnerInventoryItemForPartnerFromPg(partnerId, itemId)
  if (!ok) return { error: 'Failed to delete inventory item.' }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export type VisionBgSyncEnqueueErrorCode = 'already_active' | 'enable_vision_first' | 'no_ai_row'

/** Xếp hàng đồng bộ Vision nền (cron VPS). `resumeAfterId` null = quét từ đầu theo cursor server. */
export async function enqueueVisionCatalogBackgroundSync(
  partnerId: string,
  resumeAfterId: string | null
): Promise<
  { ok: true } | { error: string; code?: VisionBgSyncEnqueueErrorCode }
> {
  void partnerId
  void resumeAfterId
  return {
    code: 'enable_vision_first',
    error: 'Vision Warehouse background sync has been removed from this project.',
  }
}

export async function cancelVisionCatalogBackgroundSync(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  const now = new Date().toISOString()
  const ok = await updateMessagingPartnerAiVisionBgIdleFromPg(partnerId, now)
  if (!ok) return { error: 'Failed to cancel background sync.' }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

/** Đóng banner báo cáo sau khi đã xem (job đã done/error). */
export async function dismissVisionCatalogBackgroundSyncReport(partnerId: string) {
  return cancelVisionCatalogBackgroundSync(partnerId)
}

/** Mở khóa import Vision Warehouse khi lock bị treo quá lâu. */
export async function unlockVisionWarehouseImportLock(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }

  const now = new Date().toISOString()
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  const ok = await unlockVisionWarehouseImportLockFromPg(1, now)
  if (!ok) return { error: 'Failed to unlock import lock.' }

  revalidateMessagingDashboard()
  return { ok: true as const }
}

/**
 * Kill switch khẩn cấp: tắt toàn bộ Vision cho shop hiện tại và dọn mọi queue/lock runner.
 * Dùng khi chi phí Vision tăng bất thường hoặc cần dừng tức thì không qua SQL thủ công.
 */
export async function emergencyDisableVisionForPartner(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }

  const now = new Date().toISOString()

  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  const okAi = await emergencyDisablePartnerAiVisionFromPg(partnerId, now)
  const okRun = await emergencyClearVisionWarehouseRunnerFromPg(1, now)
  if (!okAi || !okRun) {
    return { error: 'Failed to apply emergency Vision disable.' }
  }

  revalidateMessagingDashboard()
  return { ok: true as const }
}
