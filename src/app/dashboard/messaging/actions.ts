'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { getUserForCreditAction } from '@/lib/auth'
import { RESERVED_MESSAGING_GUEST_SLUGS } from '@/lib/messaging/reserved-guest-slugs'
import { normalizeGuestPurchaseFlow } from '@/lib/messaging/guest-purchase-flow'
import {
  assertPublicHttpsShippingLookupUrl,
  classifyShippingLookupQuery,
  lookupPartnerShipping,
} from '@/lib/messaging/partner-shipping-lookup'
import { GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'
import {
  clearMessagingPartnerAiImageSearchSecretFromPg,
  emergencyDisablePartnerAiVisionFromPg,
  fetchMessagingPartnerAiImageSearchAuthFromPg,
  fetchMessagingPartnerAiSettingsFullFromPg,
  fetchMessagingPartnerAiUpsertPrereqFromPg,
  fetchMessagingPartnerShippingLookupAuthFromPg,
  partnerMessagingAiSettingsRowExistsFromPg,
  peekMessagingPartnerAiImageSearchSecretFromPg,
  upsertMessagingPartnerAiSettingsDashboardFromPg,
  updateMessagingPartnerAiImageSearchEnabledFromPg,
  updateMessagingPartnerAiImageSearchSecretFromPg,
  updateMessagingPartnerAiVisionBgIdleFromPg,
  updateMessagingPartnerShippingLookupApiKeyFromPg,
  type PartnerAiSettingsDashboardUpsert,
} from '@/lib/db/messaging-partner-ai-settings-pg'
import {
  fetchPartnerOutboundWebhookFromPg,
  setPartnerOutboundWebhookSecretFromPg,
  upsertPartnerOutboundWebhookFromPg,
} from '@/lib/db/messaging-partner-outbound-webhooks-pg'
import { dispatchPartnerOutboundWebhook } from '@/lib/messaging/partner-outbound-webhook-dispatch'
import { emitPartnerOutboundPaymentPaid } from '@/lib/messaging/partner-outbound-webhook-emit'
import { sendPartnerMetaPurchaseCapiOnPaymentConfirmed } from '@/lib/tracking/meta-purchase-after-order'
import { PARTNER_OUTBOUND_WEBHOOK_EVENTS } from '@/lib/messaging/partner-outbound-webhook-types'
import {
  deletePartnerCustomDomainPg,
  fetchPartnerCustomDomainByPartnerIdPg,
  updatePartnerCustomDomainFlagsPg,
  updatePartnerCustomDomainVerificationPg,
  upsertPartnerCustomDomainPg,
} from '@/lib/db/messaging-partner-custom-domains-pg'
import {
  getPartnerCustomDomainCnameTarget,
  normalizePartnerCustomDomainHostname,
} from '@/lib/messaging/partner-custom-domain-hostname'
import { normalizePartnerShopOrigin } from '@/lib/partner-website/shop/partner-site-shop-sso'
import {
  probePartnerCustomDomainSsl,
  verifyPartnerCustomDomainCname,
} from '@/lib/messaging/partner-custom-domain-dns'
import {
  deletePartnerInventoryItemForPartnerFromPg,
  fetchPartnerInventoryActivePageWithCountFromPg,
  fetchPartnerInventoryEmbeddingStatsFromPg,
  fetchPartnerInventoryEmbeddingErrorCountFromPg,
  fetchPartnerInventoryEmbeddingErrorsAllFromPg,
  fetchPartnerInventoryEmbeddingErrorsPageFromPg,
  fetchPartnerInventoryTextEmbeddingStatsFromPg,
  clearStalePartnerInventoryImageEmbeddingErrorsFromPg,
  clearStalePartnerInventoryTextEmbeddingErrorsFromPg,
  type PartnerInventoryEmbeddingErrorRow,
  insertPartnerInventoryDashboardItemFromPg,
  updatePartnerInventoryDashboardItemFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import {
  clampCatalogAutoSyncIntervalMinutes,
  defaultPartnerInventoryExternalSyncSettings,
  fetchPartnerInventoryExternalSyncSettingsFromPg,
  normalizeCatalogAutoSyncTimeVn,
  upsertPartnerInventoryExternalSyncSettingsFromPg,
} from '@/lib/db/messaging-partner-inventory-external-sync-pg'
import {
  runPartnerExternalCatalogSyncJob,
  type ExternalCatalogSyncOutcome,
} from '@/lib/messaging/partner-inventory-external-catalog-sync'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import {
  emergencyClearVisionWarehouseRunnerFromPg,
  fetchVisionWarehouseRunnerLockFieldsFromPg,
  unlockVisionWarehouseImportLockFromPg,
} from '@/lib/db/vision-warehouse-runner-pg'
import {
  fetchConversationFullForPartnerFromPg,
  fetchConversationUiLocaleFromPg,
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
  fetchBirthdayPromoForPartnerFromPg,
  upsertBirthdayPromoForPartnerFromPg,
} from '@/lib/db/messaging-partner-birthday-promo-pg'
import {
  fetchMessagingPartnerEmbedKeyForOwnerFromPg,
  fetchMessagingPartnersForDashboardFromPg,
  insertMessagingPartnerForOwnerFromPg,
  updateMessagingPartnerFacebookMetaForOwnerFromPg,
  updateMessagingPartnerGa4ForOwnerFromPg,
  updateMessagingPartnerGoogleAdsForOwnerFromPg,
  updateMessagingPartnerTiktokPixelForOwnerFromPg,
  updateMessagingPartnerGtmContainerForOwnerFromPg,
  updateMessagingPartnerDefaultCurrencyForOwnerFromPg,
  updateMessagingPartnerContactChannelsForOwnerFromPg,
  fetchMessagingPartnerContactChannelsFromPg,
  updateMessagingPartnerProfileForOwnerFromPg,
  fetchPartnerCapabilitiesForPartnerFromPg,
  updatePartnerCapabilitiesForOwnerFromPg,
  fetchPartnerExternalShopSsoPg,
  updatePartnerExternalShopSsoPg,
} from '@/lib/db/messaging-partners-pg'
import type { PartnerCapabilities } from '@/lib/partner-website/partner-capabilities'
import {
  deleteMessagingPartnerMemberForOwnerFromPg,
  listMessagingPartnerMembersForOwnerFromPg,
  lookupAuthUserIdByEmailExcludeOwnerFromPg,
  upsertMessagingPartnerMemberForOwnerFromPg,
} from '@/lib/db/messaging-partner-members-pg'
import { assertPartnerStaffGate, resolvePartnerDashboardAccessFromPg } from '@/lib/messaging/partner-dashboard-access'
import type { PartnerStaffPermKey } from '@/lib/messaging/partner-staff-permissions'
import {
  defaultInviteStaffPermissions,
  partnerStaffHasPerm,
  type PartnerStaffPermissionMap,
} from '@/lib/messaging/partner-staff-permissions'
import { sqlPartnerMpActorHasPerm } from '@/lib/db/messaging-partner-access-sql'
import {
  cancelScheduledPartnerPurgeFromPg,
  generateWorkspaceDeletionOtp6,
  hashWorkspaceDeletionOtp,
  isWorkspaceDeletionOtpCooldownActiveFromPg,
  partnerPurgeGraceDays,
  replaceWorkspaceDeletionOtpForPartnerFromPg,
  verifyDeletionOtpAndSchedulePartnerPurgeFromPg,
} from '@/lib/db/messaging-partner-purge-pg'
import { sendSmtpMail, isSmtpConfigured } from '@/lib/email/smtp'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import { isPgConfigured } from '@/lib/db/pool'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import {
  fetchMessagingPartnerAiImageGenStatsFromPg,
  fetchMessagingPartnerAiTokenDailyByModelFromPg,
  fetchMessagingPartnerAiTokenDailyStatsFromPg,
  fetchMessagingPartnerAiTokenStatsByModelFromPg,
  fetchMessagingPartnerAiTokenStatsByUsageKindAndModelFromPg,
  fetchMessagingPartnerAiTokenStatsByUsageKindFromPg,
  fetchMessagingPartnerAiTokenUsageDetailsFromPg,
  type PartnerAiImageGenUsageStatRow,
  type PartnerAiTokenDailyStatRow,
  type PartnerAiTokenUsageKindStatRow,
  type PartnerAiTokenUsageDetailRow,
  type PartnerAiTokenUsageStatRow,
} from '@/lib/db/messaging-partner-ai-token-usage-pg'
import {
  fetchMessagingPartnerImageEmbedDetailsFromPg,
  fetchMessagingPartnerImageEmbedStatsBySourceFromPg,
} from '@/lib/db/messaging-partner-image-embed-usage-pg'
import {
  fetchMessagingPartnerTextEmbedDetailsFromPg,
  fetchMessagingPartnerTextEmbedStatsBySourceFromPg,
} from '@/lib/db/messaging-partner-text-embed-usage-pg'
import {
  fetchOwnerCreditEventDetailsFromPg,
  fetchOwnerCreditEventSummariesFromPg,
  fetchPartnerLogoCreditRowsInRangeFromPg,
} from '@/lib/db/partner-owner-credit-ledger-pg'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import type { Database, Json } from '@/types/database.types'
import { sendFacebookMessengerImageUrl, sendFacebookMessengerText } from '@/lib/customer-care/facebook-messenger'
import { sendZaloOaText } from '@/lib/customer-care/zalo-oa'
import { cancelPendingAiJobsForConversation } from '@/lib/messaging/partner-ai-inbound'
import { countActivePartnerAiJobsForConversationFromPg } from '@/lib/db/messaging-partner-ai-jobs-pg'
import {
  buildPartnerMediaPayload,
  isPartnerMessagingStoragePathForPartner,
  mimeFromGuestImagePath,
  partnerMediaPayloadToJson,
} from '@/lib/messaging/guest-chat-image'
import { getTryOnPublicUrlFromPath, tryOnObjectExistsByPath } from '@/lib/storage/try-on-public-upload'
import { validateInventoryImageUrl } from '@/lib/messaging/partner-inventory-excel'
import { syncPartnerInventoryEmbeddings } from '@/lib/messaging/partner-inventory-embedding'
import {
  buildPartnerInventoryEmbeddingErrorsCsvString,
  type PartnerInventoryEmbeddingErrorExportRow,
} from '@/lib/messaging/partner-inventory-embedding-errors-export'
import { syncPartnerInventoryTextEmbeddings } from '@/lib/messaging/partner-inventory-text-embedding'
import { isValidUuidString } from '@/lib/validate-uuid'
import { DEFAULT_WEB_LOCALE, normalizeWebLocale } from '@/lib/i18n/config'
import { assertStepUp, STEP_UP_REQUIRED } from '@/lib/auth/step-up-guard'
import {
  formatShippingUpdateChatBodyForCustomer,
  shippingStatusLabelForCustomerEmail,
} from '@/lib/messaging/order-customer-notify-i18n'
import { notifyPartnerCustomerOrderUpdateFromPg } from '@/lib/db/messaging-partner-customer-notifications-pg'
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai'
import { deductUserCredits, refundUserCredits } from '@/lib/music/deduct-user-credits'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import {
  activatePartnerLogoVersionFromPg,
  insertPartnerLogoVersionFromPg,
  listPartnerLogoVersionsFromPg,
} from '@/lib/db/messaging-partner-logo-versions-pg'
import {
  fetchPartnerOrderEventsForOwnerFromPg,
  fetchPartnerPaymentSettingsFromPg,
  fetchPartnerOrdersForOwnerFromPg,
  fetchPartnerOrdersForOwnerExportFromPg,
  fetchPartnerOrderStatsForOwnerFromPg,
  insertPartnerOrderEventFromPg,
  type PartnerOrderAdminRow,
  type PartnerOrderOwnerStats,
  type PartnerOrderEventRow,
  upsertPartnerPaymentSettingsFromPg,
  fetchPartnerOrderForOwnerFromPg,
  confirmPartnerOrderDepositForOwnerFromPg,
  updatePartnerOrderStatusForOwnerFromPg,
  updatePartnerOrderShippingStatusForOwnerFromPg,
  updatePartnerOrderRefundForOwnerFromPg,
} from '@/lib/db/messaging-partner-orders-pg'
import {
  fetchPartnerLoyaltyDashboardForActorFromPg,
  updatePartnerLoyaltyDashboardForActorFromPg,
} from '@/lib/db/messaging-partner-loyalty-pg'
import {
  emailCustomerOrderPaymentStatusChanged,
  emailCustomerShippingStatusChanged,
} from '@/lib/messaging/partner-order-customer-email'
import { maybeEmailCustomerOfflineShopReply } from '@/lib/messaging/partner-reply-offline-customer-email'
import {
  parseSpreadsheetId,
  queuePartnerOrderGoogleSheetsSync,
} from '@/lib/messaging/partner-order-google-sheets-sync'
import { assertValidGoogleServiceAccountJson } from '@/lib/messaging/google-service-account-json'
import {
  fetchPartnerGoogleSheetsServiceAccountJsonFromPg,
  fetchPartnerGoogleSheetsSettingsFromPg,
  upsertPartnerGoogleSheetsSettingsFromPg,
} from '@/lib/db/messaging-partner-google-sheets-pg'
import { buildPartnerOrdersXlsxBuffer } from '@/lib/messaging/partner-orders-excel-export'
import {
  buildPartnerAiUsageCostBreakdown,
  partnerAiAggregatedModelRowsEstimatedCostVnd,
  partnerAiTokenDetailRowEstimatedCostVnd,
  type PartnerAiUsageCostBreakdown,
} from '@/lib/pricing/api-token-cost'

export type {
  PartnerAiImageGenUsageStatRow,
  PartnerAiTokenDailyStatRow,
  PartnerAiTokenUsageKindStatRow,
  PartnerAiTokenUsageStatRow,
  PartnerAiTokenUsageDetailRow,
  PartnerAiUsageCostBreakdown,
}

export type PartnerAiTokenUsageStatRowWithCostEstimate = PartnerAiTokenUsageStatRow & {
  estimated_cost_vnd: number
}
export type PartnerAiTokenUsageDetailRowWithCostEstimate = PartnerAiTokenUsageDetailRow & {
  estimated_cost_vnd: number
}
export type {
  OwnerCreditEventDetailRow,
  OwnerCreditEventSummaryRow,
  PartnerLogoCreditRow,
} from '@/lib/db/partner-owner-credit-ledger-pg'
export type {
  PartnerImageEmbedUsageDetailRow,
  PartnerImageEmbedUsageSummaryRow,
} from '@/lib/db/messaging-partner-image-embed-usage-pg'
export type {
  PartnerTextEmbedUsageDetailRow,
  PartnerTextEmbedUsageSummaryRow,
} from '@/lib/db/messaging-partner-text-embed-usage-pg'

const PARTNER_INVENTORY_PAGE_SIZE = Math.max(
  50,
  Math.min(500, parseInt(process.env.PARTNER_INVENTORY_UI_PAGE_SIZE || '120', 10) || 120)
)
const LOGO_NORMALIZE_COST = 1.5

async function requireUser() {
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  return { user: result.user }
}

async function requireAccountStepUp(userId: string): Promise<{ ok: true } | { error: string }> {
  const step = await assertStepUp(userId, 'account')
  if ('error' in step) return { error: STEP_UP_REQUIRED }
  return { ok: true }
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

async function assertPartnerAnyStaffCapability(
  userId: string,
  partnerId: string,
  caps: PartnerStaffPermKey[]
): Promise<{ ok: true } | { error: string }> {
  const access = await resolvePartnerDashboardAccessFromPg(userId, partnerId)
  if (access === null) return { error: 'Forbidden.' }
  if (access === 'owner') return { ok: true }
  if (caps.some((c) => partnerStaffHasPerm(access, c))) return { ok: true }
  return { error: 'Forbidden.' }
}

function revalidateMessagingDashboard() {
  revalidatePath('/dashboard/messaging')
  revalidatePath('/dashboard/messaging/settings')
  revalidatePath('/dashboard/messaging/orders')
  revalidatePath('/dashboard/messaging/marketing')
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
    industry_key: 'fashion',
    brand_name: name,
    logo_url: null,
    owner_user_id: user.id,
  })
  if (!inserted) {
    return { error: 'Kh├┤ng tß║ío ─æ╞░ß╗úc workspace.' }
  }
  revalidateMessagingDashboard()
  return { partner: inserted }
}

type MessagingIndustryKey = 'fashion' | 'hotel' | 'food' | 'other'
const INDUSTRY_KEYS: readonly MessagingIndustryKey[] = ['fashion', 'hotel', 'food', 'other']

function normalizeIndustryKey(raw: string): MessagingIndustryKey {
  const t = raw.trim().toLowerCase()
  return INDUSTRY_KEYS.includes(t as MessagingIndustryKey) ? (t as MessagingIndustryKey) : 'fashion'
}

function normalizeLogoUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (!/^https?:\/\//i.test(t)) return null
  return t.slice(0, 600)
}

function logoMessagingIconPromptFromHint(hint: string): string {
  return [
    'Create an impressive bold circular messaging/chat icon based on this user design brief.',
    `User brief: "${hint}".`,
    'There is no logo reference image ΓÇö follow the brief above as the primary creative direction.',
    'CRITICAL: Inside the circle, include the Vietnamese words "nhß║»n tin" clearly and boldly ΓÇö under or beside the main mark ΓÇö so users recognize this as the chat/contact button. High contrast, readable at small sizes; do not omit.',
    'Use a cohesive color palette that fits the brief (avoid generic gray). Prefer one strong accent color with high contrast on white.',
    'Use circular composition only. Fill the circle with useful content and avoid wasted top/bottom space.',
    'Use bold shapes, strong silhouette, high contrast, and clean geometry for 48-64px readability.',
    'Aspect ratio 1:1, white background, centered composition with tight circular padding.',
    'Do NOT add watermark, mockup, or extra decorative objects.',
  ].join(' ')
}

function logoMessagingIconPromptWithReference(hint?: string): string {
  const hintLine = hint?.trim()
    ? `Additional user design brief (follow when compatible with the reference logo): "${hint.trim()}".`
    : 'No text brief was provided ΓÇö derive the icon purely from the reference logo image.'
  return [
    'Create an impressive bold circular messaging/chat icon from this customer logo reference image.',
    hintLine,
    'Goal: make a memorable circular icon for chat bubble usage while keeping original brand feel recognizable.',
    'CRITICAL ΓÇö COLORS: Preserve the source logo colors exactly (same brand hues and saturation; no recoloring, no new palette, no color grading that changes the brand look). Bolder shapes and lighting are OK only if colors stay true to the reference.',
    'CRITICAL: Inside the circle, include the Vietnamese words "nhß║»n tin" clearly and boldly ΓÇö under or beside the main mark ΓÇö so users recognize this as the chat/contact button. High contrast, readable at small sizes; do not omit.',
    'Simplify aggressively: remove tiny unreadable details and keep only strongest identity elements.',
    'Prioritize the main mark/text and scale it as large as possible.',
    'Use circular composition only. Fill the circle with useful logo content and avoid wasted top/bottom space.',
    'Use bold shapes, strong silhouette, high contrast, and clean geometry for 48-64px readability.',
    'Aspect ratio 1:1, white background, centered composition with tight circular padding.',
    'Do NOT shrink logo inside a big empty area. Main logo must look large and dominant.',
    'Do NOT invent unrelated concept. Do NOT add watermark, mockup, or extra decorative objects.',
  ].join(' ')
}

export async function createMessagingWorkspaceProfile(input: {
  displayName: string
  industryKey: string
  brandName: string
  logoUrl?: string
}) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const name = input.displayName.trim()
  const brand = input.brandName.trim() || name
  if (!name || name.length > 120) return { error: 'Invalid name.' }
  if (!brand || brand.length > 120) return { error: 'Invalid brand.' }

  let base = slugify(name)
  if (RESERVED_MESSAGING_GUEST_SLUGS.has(base)) base = `${base}-ws`
  const suffix = Math.random().toString(36).slice(2, 6)
  const slug = `${base}-${suffix}`

  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const inserted = await insertMessagingPartnerForOwnerFromPg({
    slug,
    display_name: name,
    industry_key: normalizeIndustryKey(input.industryKey),
    brand_name: brand,
    logo_url: normalizeLogoUrl(input.logoUrl ?? ''),
    owner_user_id: user.id,
  })
  if (!inserted) return { error: 'Kh├┤ng tß║ío ─æ╞░ß╗úc workspace.' }
  revalidateMessagingDashboard()
  return { partner: inserted }
}

export async function updateMessagingWorkspaceProfile(input: {
  partnerId: string
  displayName: string
  industryKey: string
  brandName: string
  logoUrl?: string
}) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const name = input.displayName.trim()
  const brand = input.brandName.trim() || name
  if (!name || name.length > 120) return { error: 'Invalid name.' }
  if (!brand || brand.length > 120) return { error: 'Invalid brand.' }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const gateBrand = await assertPartnerStaffGate(user.id, input.partnerId, 'workspace_branding')
  if ('error' in gateBrand) return { error: gateBrand.error }

  const updated = await updateMessagingPartnerProfileForOwnerFromPg({
    partner_id: input.partnerId,
    owner_user_id: user.id,
    display_name: name,
    industry_key: normalizeIndustryKey(input.industryKey),
    brand_name: brand,
    logo_url: normalizeLogoUrl(input.logoUrl ?? ''),
  })
  if (!updated) return { error: 'Kh├┤ng cß║¡p nhß║¡t ─æ╞░ß╗úc th├┤ng tin workspace.' }
  revalidateMessagingDashboard()
  return { partner: updated }
}

export async function getPartnerMessagingFacebookMeta(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'integrations_analytics')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  try {
    const row = await pgQueryOne<{ pixel: string | null; capi_set: boolean }>(
      `select nullif(trim(coalesce(mp.facebook_pixel_id, '')), '') as pixel,
              (mp.facebook_capi_access_token is not null and length(trim(coalesce(mp.facebook_capi_access_token, ''))) > 0) as capi_set
       from public.messaging_partners mp
       where mp.id = $1::uuid
         and ${sqlPartnerMpActorHasPerm(2, 'integrations_analytics')}
       limit 1`,
      [partnerId, user.id]
    )
    return {
      pixelId: row?.pixel ?? null,
      capiConfigured: row?.capi_set ?? false,
    }
  } catch (e) {
    console.warn('[getPartnerMessagingFacebookMeta]', e)
    return { error: 'Kh├┤ng ─æß╗ìc ─æ╞░ß╗úc c├ái ─æß║╖t Meta Pixel.' }
  }
}

export async function savePartnerMessagingFacebookMeta(partnerId: string, input: { pixelId: string; capiToken: string }) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const step = await requireAccountStepUp(user.id)
  if ('error' in step) return { error: step.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const pixel = input.pixelId.trim()
  const capiTok = input.capiToken.trim()
  const updateCapi = capiTok.length > 0
  const ok = await updateMessagingPartnerFacebookMetaForOwnerFromPg({
    partner_id: partnerId,
    owner_user_id: user.id,
    facebook_pixel_id: pixel || null,
    update_capi_token: updateCapi,
    facebook_capi_access_token: updateCapi ? capiTok : null,
  })
  if (!ok) return { error: 'Kh├┤ng l╞░u ─æ╞░ß╗úc Pixel / Conversions API.' }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function savePartnerMessagingGa4(partnerId: string, measurementId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const raw = measurementId.trim()
  if (raw && !/^G-[A-Z0-9]+$/i.test(raw)) {
    return { error: 'INVALID_GA4_ID' as const }
  }
  const ok = await updateMessagingPartnerGa4ForOwnerFromPg({
    partner_id: partnerId,
    owner_user_id: user.id,
    ga4_measurement_id: raw || null,
  })
  if (!ok) return { error: 'Kh├┤ng l╞░u ─æ╞░ß╗úc m├ú GA4.' }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function savePartnerMessagingGoogleAds(partnerId: string, googleAdsId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const raw = googleAdsId.trim().toUpperCase()
  if (raw && !/^AW-[A-Z0-9]+$/.test(raw)) {
    return { error: 'INVALID_GOOGLE_ADS_ID' as const }
  }
  const ok = await updateMessagingPartnerGoogleAdsForOwnerFromPg({
    partner_id: partnerId,
    owner_user_id: user.id,
    google_ads_id: raw || null,
  })
  if (!ok) return { error: 'Kh├┤ng l╞░u ─æ╞░ß╗úc m├ú Google Ads.' }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function savePartnerMessagingTiktokPixel(partnerId: string, tiktokPixelId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const raw = tiktokPixelId.trim()
  if (raw && !/^[A-Z0-9]{10,64}$/i.test(raw)) {
    return { error: 'INVALID_TIKTOK_PIXEL_ID' as const }
  }
  const ok = await updateMessagingPartnerTiktokPixelForOwnerFromPg({
    partner_id: partnerId,
    owner_user_id: user.id,
    tiktok_pixel_id: raw || null,
  })
  if (!ok) return { error: 'Kh├┤ng l╞░u ─æ╞░ß╗úc TikTok Pixel.' }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function savePartnerMessagingGtmContainer(partnerId: string, gtmContainerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const raw = gtmContainerId.trim().toUpperCase()
  if (raw && !/^GTM-[A-Z0-9]+$/.test(raw)) {
    return { error: 'INVALID_GTM_CONTAINER_ID' as const }
  }
  const ok = await updateMessagingPartnerGtmContainerForOwnerFromPg({
    partner_id: partnerId,
    owner_user_id: user.id,
    gtm_container_id: raw || null,
  })
  if (!ok) return { error: 'Khong luu duoc GTM container.' }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function savePartnerMessagingDefaultCurrency(partnerId: string, defaultCurrency: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const allowed = new Set(['VND', 'USD', 'THB', 'JPY', 'KRW', 'CNY'])
  const raw = defaultCurrency.trim().toUpperCase()
  if (!allowed.has(raw)) {
    return { error: 'INVALID_CURRENCY' as const }
  }
  const ok = await updateMessagingPartnerDefaultCurrencyForOwnerFromPg({
    partner_id: partnerId,
    owner_user_id: user.id,
    default_currency: raw,
  })
  if (!ok) return { error: 'Could not save default currency.' }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function getMessagingPartnerContactChannels(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const row = await fetchMessagingPartnerContactChannelsFromPg(partnerId)
  return {
    channels: {
      contact_phone: row?.contact_phone ?? '',
      contact_zalo_url: row?.contact_zalo_url ?? '',
      contact_messenger_url: row?.contact_messenger_url ?? '',
      contact_instagram_url: row?.contact_instagram_url ?? '',
    },
  }
}

export async function savePartnerMessagingContactChannels(
  partnerId: string,
  input: {
    contact_phone?: string
    contact_zalo_url?: string
    contact_messenger_url?: string
    contact_instagram_url?: string
  }
) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const {
    normalizeContactHttpUrl,
    normalizeContactPhone,
  } = await import('@/lib/partner-website/shop/partner-site-contact-channels')
  const ok = await updateMessagingPartnerContactChannelsForOwnerFromPg({
    partner_id: partnerId,
    owner_user_id: user.id,
    contact_phone: normalizeContactPhone(input.contact_phone),
    contact_zalo_url: normalizeContactHttpUrl(input.contact_zalo_url),
    contact_messenger_url: normalizeContactHttpUrl(input.contact_messenger_url),
    contact_instagram_url: normalizeContactHttpUrl(input.contact_instagram_url),
  })
  if (!ok) return { error: 'Could not save contact channels.' }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function getMessagingWorkspacePaymentSettings(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const row = await fetchPartnerPaymentSettingsFromPg(partnerId)
  return {
    settings: row ?? {
      partner_id: partnerId,
      bank_name: '',
      bank_bin: '',
      account_number: '',
      account_holder: '',
      default_deposit_percent: 30 as const,
      default_deposit_mode: 'percent' as const,
      default_deposit_amount: 0,
      notify_email: user.email?.trim() || '',
      require_payment_proof: true,
      sepay_enabled: false,
      sepay_bank_code: '',
      sepay_account_number: '',
      sepay_qr_template: 'compact' as const,
      sepay_webhook_token: randomBytes(12).toString('hex'),
      sepay_secret_key: '',
      shipping_fee_amount: 0,
      shipping_free_threshold_amount: null,
      ewallet_enabled: false,
      ewallet_provider_label: '',
      ewallet_account_name: '',
      ewallet_account_number: '',
      ewallet_qr_url: '',
      shipping_carrier_label: '',
      updated_at: new Date(0).toISOString(),
    },
  }
}

export async function getMessagingWorkspaceGoogleSheetsSettings(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const row = await fetchPartnerGoogleSheetsSettingsFromPg(partnerId)
  const serverFallbackAvailable = Boolean(process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON?.trim())
  const hasServiceAccount = row?.has_service_account === true
  return {
    settings: {
      enabled: row?.enabled === true,
      spreadsheetId: row?.spreadsheet_id ?? '',
      sheetName: (row?.sheet_name ?? '').trim() || 'Don hang',
    },
    hasServiceAccount,
    /** Host c├│ thß╗â cß║Ñu h├¼nh th├¬m mß╗Öt key d├╣ng chung (t├╣y chß╗ìn). */
    serverFallbackAvailable,
    /** ─Éß╗º ─æiß╗üu kiß╗çn gß╗ìi API Sheets: JSON shop hoß║╖c fallback host. */
    syncCredentialsReady: hasServiceAccount || serverFallbackAvailable,
  }
}

export async function saveMessagingWorkspaceGoogleSheetsSettings(input: {
  partnerId: string
  enabled: boolean
  spreadsheetIdOrUrl: string
  sheetName: string
  /** D├ín file JSON key mß╗¢i; kh├┤ng gß╗¡i field n├áy ─æß╗â giß╗» key ─æ├ú l╞░u. */
  serviceAccountJson?: string
  /** true = x├│a JSON ─æ├ú l╞░u cho shop (chß╗ë c├▓n fallback host nß║┐u c├│). */
  clearServiceAccountJson?: boolean
}) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, input.partnerId)
  if ('error' in gate) return { error: gate.error }
  const step = await requireAccountStepUp(user.id)
  if ('error' in step) return { error: step.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const sid = parseSpreadsheetId(input.spreadsheetIdOrUrl ?? '')
  if (input.enabled && !sid) {
    return { error: 'Can nhap link hoac ID Google Sheet khi bat dong bo.' }
  }
  const sheetName = String(input.sheetName ?? '').trim().slice(0, 80) || 'Don hang'

  const existingJson = await fetchPartnerGoogleSheetsServiceAccountJsonFromPg(input.partnerId)
  let nextServiceAccountJson: string | null = existingJson
  if (input.clearServiceAccountJson === true) {
    nextServiceAccountJson = null
  } else if (input.serviceAccountJson != null && String(input.serviceAccountJson).trim() !== '') {
    const v = assertValidGoogleServiceAccountJson(input.serviceAccountJson)
    if (!v.ok) return { error: v.error }
    nextServiceAccountJson = String(input.serviceAccountJson).trim()
  }

  const envFallback = Boolean(process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON?.trim())
  if (input.enabled && !nextServiceAccountJson && !envFallback) {
    return {
      error:
        'Cß║ºn d├ín file JSON service account (Google Cloud ΓåÆ IAM) v├áo ├┤ b├¬n d╞░ß╗¢i, hoß║╖c nhß╗¥ quß║ún trß╗ï host bß║¡t fallback.',
    }
  }

  const ok = await upsertPartnerGoogleSheetsSettingsFromPg({
    partnerId: input.partnerId,
    enabled: input.enabled === true && Boolean(sid),
    spreadsheetId: sid,
    sheetName,
    serviceAccountJson: nextServiceAccountJson,
  })
  if (!ok) return { error: 'Khong luu duoc cai dat Google Sheet.' }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function saveMessagingWorkspacePaymentSettings(input: {
  partnerId: string
  bankName: string
  bankBin: string
  accountNumber: string
  accountHolder: string
  defaultDepositPercent: number
  defaultDepositMode?: 'none' | 'percent' | 'fixed_amount'
  defaultDepositAmount?: number
  notifyEmail: string
  requirePaymentProof: boolean
  sepayEnabled?: boolean
  sepayBankCode?: string
  sepayAccountNumber?: string
  sepayQrTemplate?: '' | 'compact' | 'qronly'
  sepayWebhookToken?: string
  sepaySecretKey?: string
  /** W1.7 */
  shippingFeeAmount?: number
  shippingFreeThresholdAmount?: number | null
  ewalletEnabled?: boolean
  ewalletProviderLabel?: string
  ewalletAccountName?: string
  ewalletAccountNumber?: string
  ewalletQrUrl?: string
  shippingCarrierLabel?: string
}) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, input.partnerId)
  if ('error' in gate) return { error: gate.error }
  const step = await requireAccountStepUp(user.id)
  if ('error' in step) return { error: step.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const existing = await fetchPartnerPaymentSettingsFromPg(input.partnerId)
  const stableWebhookToken =
    (existing?.sepay_webhook_token ?? '').trim() || randomBytes(16).toString('hex')
  const ok = await upsertPartnerPaymentSettingsFromPg({
    partnerId: input.partnerId,
    bankName: input.bankName.trim().slice(0, 120),
    bankBin: input.bankBin.trim().slice(0, 12),
    accountNumber: input.accountNumber.trim().slice(0, 40),
    accountHolder: input.accountHolder.trim().slice(0, 120),
    defaultDepositPercent: Math.max(0, Math.min(100, Math.round(Number(input.defaultDepositPercent) || 0))),
    defaultDepositMode:
      input.defaultDepositMode === 'none'
        ? 'none'
        : input.defaultDepositMode === 'fixed_amount'
          ? 'fixed_amount'
          : 'percent',
    defaultDepositAmount: Math.max(0, Math.round(Number(input.defaultDepositAmount) || 0)),
    notifyEmail: input.notifyEmail.trim().slice(0, 180),
    requirePaymentProof: input.requirePaymentProof !== false,
    sepayEnabled: input.sepayEnabled === true,
    sepayBankCode: (input.sepayBankCode ?? '').trim().slice(0, 40),
    sepayAccountNumber: (input.sepayAccountNumber ?? '').trim().slice(0, 40),
    sepayQrTemplate: input.sepayQrTemplate === 'qronly' ? 'qronly' : input.sepayQrTemplate === '' ? '' : 'compact',
    sepayWebhookToken: stableWebhookToken,
    sepaySecretKey: (input.sepaySecretKey ?? '').trim().slice(0, 180),
    shippingFeeAmount: Math.max(0, Math.round(Number(input.shippingFeeAmount) || 0)),
    shippingFreeThresholdAmount:
      input.shippingFreeThresholdAmount == null ? null : Math.max(0, Math.round(Number(input.shippingFreeThresholdAmount) || 0)),
    ewalletEnabled: input.ewalletEnabled === true,
    ewalletProviderLabel: (input.ewalletProviderLabel ?? '').trim().slice(0, 60),
    ewalletAccountName: (input.ewalletAccountName ?? '').trim().slice(0, 120),
    ewalletAccountNumber: (input.ewalletAccountNumber ?? '').trim().slice(0, 60),
    ewalletQrUrl: (input.ewalletQrUrl ?? '').trim().slice(0, 2000),
    shippingCarrierLabel: (input.shippingCarrierLabel ?? '').trim().slice(0, 80),
  })
  if (!ok) return { error: 'Khong luu duoc cai dat thanh toan.' }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function getMessagingWorkspaceLoyaltySettings(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'orders')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const row = await fetchPartnerLoyaltyDashboardForActorFromPg({
    actorUserId: user.id,
    partnerId,
  })
  if (!row) return { error: 'Kh├┤ng ─æß╗ìc ─æ╞░ß╗úc cß║Ñu h├¼nh hß║íng th├ánh vi├¬n.' }
  return row
}

export async function saveMessagingWorkspaceLoyaltySettings(input: {
  partnerId: string
  enabled: boolean
  spendWindowDays: number
  maxTotalDiscountPercent: number
  tiers: Array<{
    id?: string | null
    tierCode: string
    tierName: string
    minSpend6Months: number
    discountPercent: number
    sortOrder: number
    isActive: boolean
  }>
}) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerStaffGate(user.id, input.partnerId, 'orders')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const ok = await updatePartnerLoyaltyDashboardForActorFromPg({
    actorUserId: user.id,
    partnerId: input.partnerId,
    enabled: input.enabled === true,
    spendWindowDays: Math.max(30, Math.min(730, Math.floor(Number(input.spendWindowDays) || 180))),
    maxTotalDiscountPercent: Math.max(0, Math.min(100, Number(input.maxTotalDiscountPercent) || 0)),
    tiers: input.tiers,
  })
  if (!ok) return { error: 'Kh├┤ng l╞░u ─æ╞░ß╗úc cß║Ñu h├¼nh hß║íng th├ánh vi├¬n.' }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

function normalizeOrderDateQuery(v: unknown): string | undefined {
  const s = String(v ?? '').trim()
  if (!s) return undefined
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined
}

export async function listMyMessagingOrders(input?: {
  partnerId?: string
  status?: string
  limit?: number
  /** YYYY-MM-DD ΓÇö ng├áy tß║ío ─æ╞ín (Asia/Ho_Chi_Minh) */
  createdFrom?: string
  createdTo?: string
}): Promise<{ rows: PartnerOrderAdminRow[]; stats: PartnerOrderOwnerStats } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error ?? 'Unauthorized.' }
  const { user } = auth
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const partnerId = input?.partnerId?.trim() || null
  const status = input?.status?.trim() || ''
  let createdFrom = normalizeOrderDateQuery(input?.createdFrom)
  let createdTo = normalizeOrderDateQuery(input?.createdTo)
  if (createdFrom && createdTo && createdFrom > createdTo) {
    const tmp = createdFrom
    createdFrom = createdTo
    createdTo = tmp
  }
  const [rows, stats] = await Promise.all([
    fetchPartnerOrdersForOwnerFromPg({
      ownerUserId: user.id,
      partnerId,
      status,
      createdFrom,
      createdTo,
      limit: input?.limit,
    }),
    fetchPartnerOrderStatsForOwnerFromPg({
      ownerUserId: user.id,
      partnerId,
      status,
      createdFrom,
      createdTo,
    }),
  ])
  if (rows === null || stats === null) return { error: 'Khong tai duoc don hang.' }
  return { rows, stats }
}

export type { PartnerOrderOwnerStats }

/** Xuß║Ñt tß║Ñt cß║ú ─æ╞ín khß╗¢p bß╗Ö lß╗ìc (workspace + trß║íng th├íi) ra file .xlsx ΓÇö tß╗æi ─æa theo biß║┐n m├┤i tr╞░ß╗¥ng / 50k d├▓ng. */
export async function exportMyMessagingOrdersExcel(input?: {
  partnerId?: string
  status?: string
  createdFrom?: string
  createdTo?: string
}): Promise<{ ok: true; base64: string; filename: string; count: number } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error ?? 'Unauthorized.' }
  const { user } = auth
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  let createdFrom = normalizeOrderDateQuery(input?.createdFrom)
  let createdTo = normalizeOrderDateQuery(input?.createdTo)
  if (createdFrom && createdTo && createdFrom > createdTo) {
    const tmp = createdFrom
    createdFrom = createdTo
    createdTo = tmp
  }
  const rows = await fetchPartnerOrdersForOwnerExportFromPg({
    ownerUserId: user.id,
    partnerId: input?.partnerId?.trim() || null,
    status: input?.status?.trim() || '',
    createdFrom,
    createdTo,
  })
  if (rows === null) return { error: 'Kh├┤ng tß║úi ─æ╞░ß╗úc ─æ╞ín h├áng.' }
  if (rows.length === 0) return { error: 'Kh├┤ng c├│ ─æ╞ín ─æß╗â xuß║Ñt (thß╗¡ ─æß╗òi bß╗Ö lß╗ìc).' }
  const buf = buildPartnerOrdersXlsxBuffer(rows)
  const dateStr = new Date().toISOString().slice(0, 10)
  return {
    ok: true,
    base64: buf.toString('base64'),
    filename: `don_hang_${dateStr}.xlsx`,
    count: rows.length,
  }
}

export async function updateMyMessagingOrderStatus(input: {
  orderId: string
  status: 'paid_verified' | 'pending_manual_review' | 'cancelled' | 'awaiting_payment' | 'payment_checking'
  verifiedNote?: string
}): Promise<{ ok: true } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error ?? 'Unauthorized.' }
  const { user } = auth
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  if (!isValidUuidString(input.orderId)) return { error: 'Invalid order id.' }
  const ok = await updatePartnerOrderStatusForOwnerFromPg({
    ownerUserId: user.id,
    orderId: input.orderId,
    status: input.status,
    verifiedNote: (input.verifiedNote ?? '').trim().slice(0, 1000),
  })
  if (!ok) return { error: 'Khong cap nhat duoc trang thai don.' }
  const row = await fetchPartnerOrderForOwnerFromPg(user.id, input.orderId)
  if (row) {
    queuePartnerOrderGoogleSheetsSync(row.partner_id, row.id)
    try {
      await emailCustomerOrderPaymentStatusChanged({ order: row })
    } catch (e) {
      console.warn('[updateMyMessagingOrderStatus] customer email', e)
    }
    // W5.2 — in-app notification (fire-and-forget)
    void notifyPartnerCustomerOrderUpdateFromPg({
      partnerId: row.partner_id,
      conversationId: row.conversation_id,
      title: `Order ${row.payment_reference || row.id.slice(0, 8)}`,
      body: `Payment status: ${input.status}`,
    })
    if (input.status === 'paid_verified') {
      emitPartnerOutboundPaymentPaid(row.partner_id, row)
      sendPartnerMetaPurchaseCapiOnPaymentConfirmed({ partnerId: row.partner_id, order: row }).catch((e) =>
        console.warn('[updateMyMessagingOrderStatus] Meta CAPI Purchase', e)
      )
    }
  }
  revalidateMessagingDashboard()
  return { ok: true }
}

export async function confirmMyMessagingOrderDeposit(input: {
  orderId: string
  verifiedNote?: string
}): Promise<{ ok: true } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error ?? 'Unauthorized.' }
  const { user } = auth
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  if (!isValidUuidString(input.orderId)) return { error: 'Invalid order id.' }
  const ok = await confirmPartnerOrderDepositForOwnerFromPg({
    ownerUserId: user.id,
    orderId: input.orderId,
    verifiedNote: (input.verifiedNote ?? '').trim().slice(0, 1000),
  })
  if (!ok) return { error: 'Khong xac nhan duoc coc.' }
  const row = await fetchPartnerOrderForOwnerFromPg(user.id, input.orderId)
  if (row) {
    await insertPartnerOrderEventFromPg({
      orderId: row.id,
      eventType: 'deposit_manual',
      title: 'Chu shop xac nhan da coc',
      detail: `Ghi nhan thanh toan: ${Math.round(Number(row.paid_amount) || 0)} VND.`,
      source: 'shop',
      createdBy: user.id,
    })
    queuePartnerOrderGoogleSheetsSync(row.partner_id, row.id)
    try {
      await emailCustomerOrderPaymentStatusChanged({ order: row })
    } catch (e) {
      console.warn('[confirmMyMessagingOrderDeposit] customer email', e)
    }
    emitPartnerOutboundPaymentPaid(row.partner_id, row)
    sendPartnerMetaPurchaseCapiOnPaymentConfirmed({ partnerId: row.partner_id, order: row }).catch((e) =>
      console.warn('[confirmMyMessagingOrderDeposit] Meta CAPI Purchase', e)
    )
  }
  revalidateMessagingDashboard()
  return { ok: true }
}

export async function listMyMessagingOrderEvents(input: {
  orderId: string
  limit?: number
}): Promise<{ rows: PartnerOrderEventRow[] } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error ?? 'Unauthorized.' }
  const { user } = auth
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  if (!isValidUuidString(input.orderId)) return { error: 'Invalid order id.' }
  const rows = await fetchPartnerOrderEventsForOwnerFromPg({
    ownerUserId: user.id,
    orderId: input.orderId,
    limit: input.limit,
  })
  if (rows === null) return { error: 'Khong tai duoc timeline.' }
  return { rows }
}

export async function updateMyMessagingOrderShipping(input: {
  orderId: string
  shippingStatus: 'pending' | 'confirmed' | 'packing' | 'shipping' | 'delivered' | 'returned' | 'cancelled'
  note?: string
}): Promise<{ ok: true } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error ?? 'Unauthorized.' }
  const { user } = auth
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  if (!isValidUuidString(input.orderId)) return { error: 'Invalid order id.' }
  const note = (input.note ?? '').trim().slice(0, 1000)
  const updated = await updatePartnerOrderShippingStatusForOwnerFromPg({
    ownerUserId: user.id,
    orderId: input.orderId,
    shippingStatus: input.shippingStatus,
    note,
  })
  if (!updated) return { error: 'Khong cap nhat duoc trang thai giao hang.' }
  queuePartnerOrderGoogleSheetsSync(updated.partner_id, updated.id)
  await insertPartnerOrderEventFromPg({
    orderId: updated.id,
    eventType: 'shipping_status',
    title: 'Cap nhat giao hang',
    detail: `Trang thai moi: ${input.shippingStatus}${note ? ` | ${note}` : ''}`,
    source: 'shop',
    createdBy: user.id,
  })
  const customerLocaleRaw = await fetchConversationUiLocaleFromPg(updated.conversation_id)
  const customerLocale = normalizeWebLocale(customerLocaleRaw ?? '') ?? DEFAULT_WEB_LOCALE
  const outboundOrderBody = formatShippingUpdateChatBodyForCustomer({
    locale: customerLocale,
    paymentReference: updated.payment_reference,
    shippingStatus: input.shippingStatus,
    shopNote: note || undefined,
  })
  await insertMessagePg({
    conversationId: updated.conversation_id,
    direction: 'outbound',
    body: outboundOrderBody,
    rawPayload: {
      source: 'system_order',
      order_id: updated.id,
      order_status: updated.status,
      order_shipping_status: input.shippingStatus,
      order_note: note,
      customer_ui_locale: customerLocale,
    },
  })
  try {
    await emailCustomerShippingStatusChanged({ order: updated, customerLocale: customerLocaleRaw })
  } catch (e) {
    console.warn('[updateMyMessagingOrderShipping] customer email', e)
  }
  // W5.2 — in-app notification (fire-and-forget)
  const shipLabel = shippingStatusLabelForCustomerEmail(customerLocale, input.shippingStatus)
  void notifyPartnerCustomerOrderUpdateFromPg({
    partnerId: updated.partner_id,
    conversationId: updated.conversation_id,
    title: `Order ${updated.payment_reference || updated.id.slice(0, 8)}`,
    body: outboundOrderBody || shipLabel,
  })
  revalidateMessagingDashboard()
  return { ok: true }
}

/** W1.7 — chủ shop đánh dấu hoàn tiền thủ công (không có cổng thanh toán thật nào tự động hoàn). */
export async function updateMyMessagingOrderRefund(input: {
  orderId: string
  refundStatus: 'none' | 'requested' | 'refunded'
  refundAmount: number
  refundNote?: string
}): Promise<{ ok: true } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error ?? 'Unauthorized.' }
  const { user } = auth
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  if (!isValidUuidString(input.orderId)) return { error: 'Invalid order id.' }
  const note = (input.refundNote ?? '').trim().slice(0, 1000)
  const updated = await updatePartnerOrderRefundForOwnerFromPg({
    ownerUserId: user.id,
    orderId: input.orderId,
    refundStatus: input.refundStatus,
    refundAmount: input.refundAmount,
    refundNote: note,
  })
  if (!updated) return { error: 'Khong cap nhat duoc trang thai hoan tien.' }
  await insertPartnerOrderEventFromPg({
    orderId: updated.id,
    eventType: 'refund_status',
    title: 'Cap nhat hoan tien',
    detail: `Trang thai: ${input.refundStatus}${input.refundAmount > 0 ? ` | So tien: ${input.refundAmount}` : ''}${note ? ` | ${note}` : ''}`,
    source: 'shop',
    createdBy: user.id,
  })
  if (input.refundStatus === 'refunded') {
    await insertMessagePg({
      conversationId: updated.conversation_id,
      direction: 'outbound',
      body: `Đơn hàng đã được hoàn tiền: **${new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.round(input.refundAmount)))}đ**.${note ? `\n${note}` : ''}`,
      rawPayload: {
        source: 'system_order',
        order_id: updated.id,
        order_status: updated.status,
        order_refund_status: input.refundStatus,
        order_refund_amount: input.refundAmount,
      },
    })
  }
  revalidateMessagingDashboard()
  return { ok: true }
}

export async function listMessagingWorkspaceLogoVersions(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'workspace_branding')
  if ('error' in gate) return { error: gate.error }
  const rows = await listPartnerLogoVersionsFromPg(partnerId)
  if (rows === null) return { error: 'Failed to load logo versions.' }
  return { rows }
}

export async function setMessagingWorkspaceActiveLogo(partnerId: string, versionId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'workspace_branding')
  if ('error' in gate) return { error: gate.error }
  const ok = await activatePartnerLogoVersionFromPg({ partnerId, versionId, ownerUserId: user.id })
  if (!ok) return { error: 'Kh├┤ng thß╗â ─æß╗òi logo ─æang d├╣ng.' }
  revalidateMessagingDashboard()
  return { ok: true }
}

export async function normalizeMessagingWorkspaceLogo(input: {
  partnerId: string
  sourceLogoUrl?: string
  iconHint?: string
}) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerStaffGate(user.id, input.partnerId, 'workspace_branding')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const sourceUrl = normalizeLogoUrl(input.sourceLogoUrl ?? '')
  const hint = input.iconHint?.trim() ?? ''
  if (!sourceUrl && !hint) {
    return { error: 'Can goi y text hoac anh logo tham chieu (it nhat mot trong hai) de tao icon.' }
  }
  if (!process.env.GOOGLE_API_KEY?.trim()) return { error: 'Missing GOOGLE_API_KEY.' }

  const charged = await deductUserCredits(user.id, LOGO_NORMALIZE_COST)
  if (!charged.ok) {
    return { error: charged.code === 'INSUFFICIENT_CREDITS' ? 'Khong du credits.' : charged.error }
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
    const model = genAI.getGenerativeModel({
      model: GEMINI_3_PRO_IMAGE.model,
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { imageSize: '2K', aspectRatio: '1:1' },
      },
    })
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    ]
    const prompt = sourceUrl
      ? logoMessagingIconPromptWithReference(hint || undefined)
      : logoMessagingIconPromptFromHint(hint)
    let result
    if (sourceUrl) {
      const imgRes = await fetch(sourceUrl)
      if (!imgRes.ok) {
        await refundUserCredits(user.id, LOGO_NORMALIZE_COST)
        return { error: 'Khong tai duoc logo tham chieu.' }
      }
      const buf = Buffer.from(await imgRes.arrayBuffer())
      const mime = imgRes.headers.get('content-type')?.trim() || 'image/png'
      result = await model.generateContent(
        [
          prompt,
          {
            inlineData: {
              data: buf.toString('base64'),
              mimeType: mime,
            },
          },
        ] as never,
        { safetySettings } as never
      )
    } else {
      result = await model.generateContent(prompt, { safetySettings } as never)
    }
    void trackFromUsageMetadata(
      result.response.usageMetadata,
      GEMINI_3_PRO_IMAGE.model,
      'messaging-workspace-logo-normalize',
      user.id,
      '2K'
    )
    const part = result.response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!part || !('inlineData' in part) || !part.inlineData?.data) {
      await refundUserCredits(user.id, LOGO_NORMALIZE_COST)
      return { error: 'AI khong tra ve anh logo hop le.' }
    }
    const out = Buffer.from(part.inlineData.data, 'base64')
    const path = `messaging-logo/${input.partnerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
    const { publicUrl } = await uploadTryOnImagePublic(path, out, { contentType: 'image/png', upsert: true })
    const version = await insertPartnerLogoVersionFromPg({
      partnerId: input.partnerId,
      sourceLogoUrl: sourceUrl ?? '',
      normalizedLogoUrl: publicUrl,
      model: GEMINI_3_PRO_IMAGE.model,
      prompt,
      chargedCredits: LOGO_NORMALIZE_COST,
      createdBy: user.id,
    })
    if (!version) {
      await refundUserCredits(user.id, LOGO_NORMALIZE_COST)
      return { error: 'Khong luu duoc phien ban logo.' }
    }
    revalidateMessagingDashboard()
    return { ok: true, version, deductedCredits: charged.charged, creditsRemaining: charged.balance }
  } catch (e) {
    await refundUserCredits(user.id, LOGO_NORMALIZE_COST)
    return { error: e instanceof Error ? e.message : 'Tao icon tin nhan that bai.' }
  }
}

export async function getPartnerChannelStatus(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'integrations_channels')
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
  const fromPg = await fetchMessagingPartnersForDashboardFromPg(user.id)
  if (fromPg === null) {
    return { error: 'Failed to load messaging workspaces.' }
  }
  return { rows: fromPg.filter((p) => p.industry_key !== 'hotel') }
}

function formatVnScheduleDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

/** Gß╗¡i m├ú OTP 6 sß╗æ tß╗¢i email ─æ─âng nhß║¡p ΓÇö b╞░ß╗¢c tr╞░ß╗¢c khi l├¬n lß╗ïch x├│a workspace. */
export async function requestMessagingWorkspaceDeletionOtp(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  if (!isValidUuidString(partnerId)) return { error: 'Invalid workspace.' }
  const email = user.email?.trim()
  if (!email) return { error: 'T├ái khoß║ún ch╞░a c├│ email ΓÇö kh├┤ng gß╗¡i ─æ╞░ß╗úc OTP.' }
  if (!isSmtpConfigured()) return { error: 'M├íy chß╗º ch╞░a cß║Ñu h├¼nh gß╗¡i email (SMTP).' }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }

  const pending = await pgQueryOne<{ purge_at: string | null }>(
    `select purge_at from public.messaging_partners where id = $1::uuid and owner_user_id = $2::uuid limit 1`,
    [partnerId, user.id]
  )
  if (pending?.purge_at) {
    return { error: 'Workspace ─æ├ú ─æ╞░ß╗úc l├¬n lß╗ïch x├│a. Bß║ín c├│ thß╗â hß╗ºy lß╗ïch tr╞░ß╗¢c khi hß║┐t hß║ín.' }
  }

  if (await isWorkspaceDeletionOtpCooldownActiveFromPg(partnerId)) {
    return { error: 'Vui l├▓ng ─æß╗úi v├ái chß╗Ñc gi├óy tr╞░ß╗¢c khi gß╗¡i lß║íi m├ú.' }
  }

  const otp = generateWorkspaceDeletionOtp6()
  const otpHash = hashWorkspaceDeletionOtp(partnerId, user.id, otp)
  const saved = await replaceWorkspaceDeletionOtpForPartnerFromPg({
    partnerId,
    ownerUserId: user.id,
    otpHash,
  })
  if (!saved) return { error: 'Kh├┤ng l╞░u ─æ╞░ß╗úc m├ú x├íc nhß║¡n.' }

  const sent = await sendSmtpMail({
    to: email,
    subject: 'M├ú OTP x├│a workspace nhß║»n tin',
    text: `M├ú OTP cß╗ºa bß║ín: ${otp}\n\nM├ú c├│ hiß╗çu lß╗▒c 10 ph├║t. Nß║┐u kh├┤ng phß║úi bß║ín y├¬u cß║ºu, h├úy bß╗Å qua email n├áy.`,
    html: `<p>M├ú OTP cß╗ºa bß║ín: <b>${otp}</b></p><p>M├ú c├│ hiß╗çu lß╗▒c 10 ph├║t. Nß║┐u kh├┤ng phß║úi bß║ín y├¬u cß║ºu, h├úy bß╗Å qua email n├áy.</p>`,
  })

  if (!sent.ok) {
    try {
      await pgQuery(`delete from public.messaging_partner_deletion_otps where partner_id = $1::uuid`, [partnerId])
    } catch (e) {
      console.warn('[requestMessagingWorkspaceDeletionOtp] rollback otp', e)
    }
    return { error: 'Kh├┤ng gß╗¡i ─æ╞░ß╗úc email. Kiß╗âm tra SMTP hoß║╖c thß╗¡ lß║íi sau.' }
  }

  return { ok: true as const }
}

/** X├íc nhß║¡n OTP v├á l├¬n lß╗ïch x├│a sau grace (mß║╖c ─æß╗ïnh 7 ng├áy); gß╗¡i email th├┤ng b├ío lß╗ïch x├│a. */
export async function confirmMessagingWorkspaceDeletionWithOtp(partnerId: string, otpRaw: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  if (!isValidUuidString(partnerId)) return { error: 'Invalid workspace.' }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }

  const scheduled = await verifyDeletionOtpAndSchedulePartnerPurgeFromPg({
    partnerId,
    ownerUserId: user.id,
    otp: otpRaw,
  })
  if (!scheduled) {
    return { error: 'M├ú OTP kh├┤ng ─æ├║ng hoß║╖c ─æ├ú hß║┐t hß║ín.' }
  }

  const email = user.email?.trim()
  const baseUrl = getPublicAppUrlForServer()
  const graceDays = partnerPurgeGraceDays()
  const when = formatVnScheduleDate(scheduled.purge_at)

  if (email && isSmtpConfigured()) {
    const sent = await sendSmtpMail({
      to: email,
      subject: `─É├ú l├¬n lß╗ïch x├│a workspace ΓÇö hß╗ºy trong ${graceDays} ng├áy`,
      text: [
        `─É├ú l├¬n lß╗ïch x├│a workspace nhß║»n tin cß╗ºa bß║ín.`,
        `Thß╗¥i ─æiß╗âm dß╗▒ kiß║┐n x├│a ho├án to├án: ${when} (giß╗¥ Viß╗çt Nam), sau ${graceDays} ng├áy.`,
        `Trong thß╗¥i gian chß╗¥, shop sß║╜ kh├┤ng nhß║¡n tin tß╗½ kh├ích (widget / Facebook / Zalo).`,
        `Bß║ín c├│ thß╗â hß╗ºy lß╗ïch x├│a trong dashboard: ${baseUrl}/dashboard/messaging/settings`,
        ``,
        `Nß║┐u kh├┤ng phß║úi bß║ín thao t├íc, h├úy ─æ─âng nhß║¡p v├á hß╗ºy ngay.`,
      ].join('\n'),
      html: `<p>─É├ú <b>l├¬n lß╗ïch x├│a</b> workspace nhß║»n tin cß╗ºa bß║ín.</p>
<p>Thß╗¥i ─æiß╗âm dß╗▒ kiß║┐n x├│a ho├án to├án: <b>${when}</b> (giß╗¥ Viß╗çt Nam), sau <b>${graceDays} ng├áy</b>.</p>
<p>Trong thß╗¥i gian chß╗¥, shop <b>kh├┤ng nhß║¡n tin</b> tß╗½ kh├ích (widget / Facebook / Zalo).</p>
<p><a href="${baseUrl}/dashboard/messaging/settings">Hß╗ºy lß╗ïch x├│a</a> trong dashboard nß║┐u ─æß╗òi ├╜.</p>`,
    })
    if (!sent.ok) {
      console.warn('[confirmMessagingWorkspaceDeletionWithOtp] schedule notice email failed', sent.error)
    }
  }

  revalidateMessagingDashboard()
  return { ok: true as const, purge_at: scheduled.purge_at }
}

/** Hß╗ºy lß╗ïch x├│a (kh├┤ng cß║ºn OTP). */
export async function cancelMessagingWorkspaceDeletionSchedule(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  if (!isValidUuidString(partnerId)) return { error: 'Invalid workspace.' }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }

  const ok = await cancelScheduledPartnerPurgeFromPg(partnerId, user.id)
  if (!ok) return { error: 'Kh├┤ng hß╗ºy ─æ╞░ß╗úc lß╗ïch x├│a (hoß║╖c workspace kh├┤ng c├▓n lß╗ïch x├│a).' }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function listPartnerConversations(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'inbox')
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

export async function listPartnerMessages(
  partnerId: string,
  conversationId: string,
  options?: { limit?: number; sinceCreatedAt?: string | null }
) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'inbox')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  try {
    const limit = Math.max(1, Math.min(500, Number(options?.limit || 250)))
    const sinceCreatedAt = typeof options?.sinceCreatedAt === 'string' ? options.sinceCreatedAt.trim() : null
    const bundle = await listPartnerMessagesBundleFromPg(partnerId, conversationId, {
      limit,
      sinceCreatedAt: sinceCreatedAt || null,
    })
    if (bundle === 'not_found') return { error: 'Conversation not found.' }
    if (bundle === null) return { error: 'Failed to load messages.' }
    return { rows: bundle.rows }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: msg }
  }
}

/** Trß║íng th├íi trß╗ú l├╜ AI ─æang chuß║⌐n bß╗ï tin (job pending/processing) ΓÇö hiß╗ân thß╗ï ┬½─æang soß║ín tin┬╗ tr├¬n inbox shop. */
export async function getPartnerAiComposingForConversation(partnerId: string, conversationId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'inbox')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  const n = await countActivePartnerAiJobsForConversationFromPg(partnerId, conversationId)
  if (n === null) return { error: 'Failed to load AI status.' }
  return { composing: n > 0 }
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
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'inbox')
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
    body = trimmed ? `≡ƒô╖ ${trimmed}` : '≡ƒô╖'
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
          ? `≡ƒô╖\n${imagePublicUrl}`
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

  if (conv.channel === 'widget') {
    void maybeEmailCustomerOfflineShopReply({
      conversation: conv,
      replyBody: body,
    })
  }

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
  const step = await requireAccountStepUp(user.id)
  if ('error' in step) return { error: step.error }
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
  const step = await requireAccountStepUp(user.id)
  if ('error' in step) return { error: step.error }
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

/** Gß╗¡i xuß╗æng client: kh├┤ng lß╗Ö image_search_api_secret. */
export type PartnerAiSettingsClientRow = Omit<
  MessagingPartnerAiSettingsRow,
  'image_search_api_secret' | 'shipping_lookup_api_key'
> & {
  image_search_api_key_configured: boolean
  shipping_lookup_api_key_configured: boolean
}

function toPartnerAiSettingsClient(row: MessagingPartnerAiSettingsRow | null): PartnerAiSettingsClientRow | null {
  if (!row) return null
  const { image_search_api_secret: _sec, shipping_lookup_api_key: _shipKey, ...rest } = row
  return {
    ...rest,
    image_search_api_key_configured: Boolean(_sec),
    shipping_lookup_api_key_configured: Boolean(_shipKey?.trim()),
  }
}

export type PartnerAiSettingsPayload = {
  enabled: boolean
  reply_delay_seconds: number
  typing_pause_min_ms: number
  typing_pause_max_ms: number
  /** Th├┤ng tin/ch├¡nh s├ích lu├┤n ─æ╞░a v├áo ngß╗» cß║únh t╞░ vß║Ñn sß║ún phß║⌐m. */
  product_consultation_context: string
  append_ai_disclosure: boolean
  disclosure_suffix: string
  vision_product_search_enabled: boolean
  /** ISO 3166-1 alpha-2 uppercase hoß║╖c rß╗ùng ΓåÆ l╞░u null */
  vision_shop_country: string
  vision_location: string
  vision_product_category: string
  vision_gcs_bucket: string
  image_search_api_enabled: boolean
  /** ─Éß║╖t h├áng trong chat vs mß╗ƒ trang SP / link giß╗Å web shop. */
  guest_purchase_flow: 'in_chat' | 'external_site' | 'external_cart_url'
  /** Mß║½u URL giß╗Å web ΓÇö bß║»t buß╗Öc khi `external_cart_url`, phß║úi chß╗⌐a `{sku}`. */
  guest_external_cart_url_template: string
  shop_checkout_login_required: boolean
  after_sales_return_address: string
  shipping_lookup_url: string
  /** Để trống = giữ khóa đã lưu. */
  shipping_lookup_api_key: string
}

const PARTNER_AI_USAGE_DETAIL_ROW_LIMIT = 250
const PARTNER_AI_CREDIT_EVENT_ROW_LIMIT = 80
const PARTNER_AI_LOGO_CREDIT_ROW_LIMIT = 80
const PARTNER_AI_IMAGE_EMBED_DETAIL_ROW_LIMIT = 80
const PARTNER_AI_TEXT_EMBED_DETAIL_ROW_LIMIT = 80

export type PartnerAiUsagePeriod = 'day' | 'week' | 'month'

/** Cß╗¡a sß╗ò l─ân (24h / 7d / 30d) hoß║╖c khoß║úng ng├áy lß╗ïch UTC [from, to] (YYYY-MM-DD). */
export type PartnerAiUsageQuery =
  | { type: 'rolling'; period: PartnerAiUsagePeriod }
  | { type: 'calendar'; fromDayUtc: string; toDayUtc: string }

const PARTNER_AI_USAGE_MAX_CALENDAR_DAYS = 400

function partnerAiUsageSinceIso(period: PartnerAiUsagePeriod): { sinceIso: string; lookbackDays: number } {
  const ms =
    period === 'day' ? 86400000 : period === 'week' ? 7 * 86400000 : 30 * 86400000
  const since = new Date(Date.now() - ms)
  const lookbackDays = period === 'day' ? 1 : period === 'week' ? 7 : 30
  return { sinceIso: since.toISOString(), lookbackDays }
}

function parsePartnerAiUsageDayUtcStrict(raw: string): string | null {
  const s = raw.trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const da = Number(m[3])
  const d = new Date(Date.UTC(y, mo - 1, da))
  if (d.getUTCFullYear() !== y || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== da) return null
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`
}

function resolvePartnerAiUsageWindow(query: PartnerAiUsageQuery):
  | { error: string }
  | {
      sinceIso: string
      untilIsoExclusive: string | null
      lookbackDays: number
      usageQuery: PartnerAiUsageQuery
    } {
  if (query.type === 'rolling') {
    const { sinceIso, lookbackDays } = partnerAiUsageSinceIso(query.period)
    return { sinceIso, untilIsoExclusive: null, lookbackDays, usageQuery: query }
  }
  const from = parsePartnerAiUsageDayUtcStrict(query.fromDayUtc)
  const to = parsePartnerAiUsageDayUtcStrict(query.toDayUtc)
  if (!from || !to) {
    return { error: 'Invalid date. Use YYYY-MM-DD (UTC calendar day).' }
  }
  if (from > to) {
    return { error: 'Start date must be on or before end date.' }
  }
  const startMs = Date.parse(`${from}T00:00:00.000Z`)
  const endMs = Date.parse(`${to}T00:00:00.000Z`)
  const spanDays = Math.floor((endMs - startMs) / 86400000) + 1
  if (spanDays > PARTNER_AI_USAGE_MAX_CALENDAR_DAYS) {
    return { error: `Date range cannot exceed ${PARTNER_AI_USAGE_MAX_CALENDAR_DAYS} days.` }
  }
  const sinceIso = `${from}T00:00:00.000Z`
  const untilIsoExclusive = new Date(endMs + 86400000).toISOString()
  return {
    sinceIso,
    untilIsoExclusive,
    lookbackDays: spanDays,
    usageQuery: { type: 'calendar', fromDayUtc: from, toDayUtc: to },
  }
}

/** Tß╗òng token theo model (API) trong cß╗¡a sß╗ò thß╗¥i gian ─æ├ú chß╗ìn ΓÇö chß╗º shop xem tr├¬n dashboard. */
export async function getPartnerAiTokenUsageStats(
  partnerId: string,
  usageQuery: PartnerAiUsageQuery = { type: 'rolling', period: 'month' }
) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'usage_reports')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  const win = resolvePartnerAiUsageWindow(usageQuery)
  if ('error' in win) return { error: win.error }
  const { sinceIso, untilIsoExclusive, lookbackDays, usageQuery: normalizedQuery } = win
  const [rows, imageGenRows, usageKindRows, dailyRows, dailyModelRows, kindModelRows] =
    await Promise.all([
      fetchMessagingPartnerAiTokenStatsByModelFromPg(partnerId, sinceIso, untilIsoExclusive),
      fetchMessagingPartnerAiImageGenStatsFromPg(partnerId, sinceIso, untilIsoExclusive),
      fetchMessagingPartnerAiTokenStatsByUsageKindFromPg(partnerId, sinceIso, untilIsoExclusive),
      fetchMessagingPartnerAiTokenDailyStatsFromPg(partnerId, sinceIso, untilIsoExclusive),
      fetchMessagingPartnerAiTokenDailyByModelFromPg(partnerId, sinceIso, untilIsoExclusive),
      fetchMessagingPartnerAiTokenStatsByUsageKindAndModelFromPg(partnerId, sinceIso, untilIsoExclusive),
    ])
  if (rows === null) return { error: 'Failed to load token usage stats.' }
  const costed = partnerAiAggregatedModelRowsEstimatedCostVnd(rows)
  let costBreakdown: PartnerAiUsageCostBreakdown | null = null
  if (dailyModelRows != null && kindModelRows != null) {
    costBreakdown = {
      ...buildPartnerAiUsageCostBreakdown(dailyModelRows, kindModelRows),
      periodTotalEstimatedVnd: costed.totalVnd,
    }
  }
  return {
    rows: costed.rows,
    tokenUsageEstimatedCostVndTotal: costed.totalVnd,
    imageGenRows: imageGenRows ?? [],
    usageKindRows: usageKindRows ?? [],
    dailyRows: dailyRows ?? [],
    costBreakdown,
    sinceIso,
    lookbackDays,
    usageQuery: normalizedQuery,
  }
}

/**
 * Thß╗æng k├¬ chi tiß║┐t: tß╗½ng lß║ºn gß╗ìi LLM inbox + c├íc khoß║ún trß╗½ credit (ledger + chuß║⌐n h├│a logo).
 * L╞░u ├╜: inbox LLM hiß╗çn chß╗ë ghi token; trß╗½ credit qua v├¡ c├│ thß╗â l├á gi├ío tr├¼nh/English coach (c├╣ng user chß╗º shop) hoß║╖c logo workspace.
 */
export async function getPartnerAiUsageAnalytics(
  partnerId: string,
  usageQuery: PartnerAiUsageQuery = { type: 'rolling', period: 'month' }
) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'usage_reports')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }

  const win = resolvePartnerAiUsageWindow(usageQuery)
  if ('error' in win) return { error: win.error }
  const { sinceIso, untilIsoExclusive, lookbackDays, usageQuery: normalizedQuery } = win

  const ownerRow = await pgQueryOne<{ owner: string | null }>(
    `select owner_user_id::text as owner from public.messaging_partners where id = $1::uuid limit 1`,
    [partnerId]
  )
  const ownerId = (ownerRow?.owner ?? '').trim() || null

  const [tokenDetails, creditSummaries, creditDetails, logoRows, embedSummaries, embedDetails, textEmbedSummaries, textEmbedDetails] =
    await Promise.all([
      fetchMessagingPartnerAiTokenUsageDetailsFromPg(
        partnerId,
        sinceIso,
        PARTNER_AI_USAGE_DETAIL_ROW_LIMIT,
        untilIsoExclusive
      ),
      ownerId
        ? fetchOwnerCreditEventSummariesFromPg(ownerId, sinceIso, untilIsoExclusive)
        : Promise.resolve(null),
      ownerId
        ? fetchOwnerCreditEventDetailsFromPg(
            ownerId,
            sinceIso,
            PARTNER_AI_CREDIT_EVENT_ROW_LIMIT,
            untilIsoExclusive
          )
        : Promise.resolve(null),
      fetchPartnerLogoCreditRowsInRangeFromPg(
        partnerId,
        sinceIso,
        PARTNER_AI_LOGO_CREDIT_ROW_LIMIT,
        untilIsoExclusive
      ),
      fetchMessagingPartnerImageEmbedStatsBySourceFromPg(partnerId, sinceIso, untilIsoExclusive),
      fetchMessagingPartnerImageEmbedDetailsFromPg(
        partnerId,
        sinceIso,
        PARTNER_AI_IMAGE_EMBED_DETAIL_ROW_LIMIT,
        untilIsoExclusive
      ),
      fetchMessagingPartnerTextEmbedStatsBySourceFromPg(partnerId, sinceIso, untilIsoExclusive),
      fetchMessagingPartnerTextEmbedDetailsFromPg(
        partnerId,
        sinceIso,
        PARTNER_AI_TEXT_EMBED_DETAIL_ROW_LIMIT,
        untilIsoExclusive
      ),
    ])

  if (tokenDetails === null) {
    return { error: 'Failed to load token usage details.' }
  }

  const tokenDetailsWithCost: PartnerAiTokenUsageDetailRowWithCostEstimate[] = tokenDetails.map((r) => ({
    ...r,
    estimated_cost_vnd: partnerAiTokenDetailRowEstimatedCostVnd(r),
  }))
  const tokenDetailsEstimatedCostVndTotal = tokenDetailsWithCost.reduce((s, r) => s + r.estimated_cost_vnd, 0)

  return {
    sinceIso,
    lookbackDays,
    usageQuery: normalizedQuery,
    tokenDetails: tokenDetailsWithCost,
    tokenDetailsEstimatedCostVndTotal,
    creditSummaries: creditSummaries ?? [],
    creditDetails: creditDetails ?? [],
    logoCreditRows: logoRows ?? [],
    ownerAccountLinked: Boolean(ownerId),
    imageEmbedSummaries: embedSummaries ?? [],
    imageEmbedDetails: embedDetails ?? [],
    textEmbedSummaries: textEmbedSummaries ?? [],
    textEmbedDetails: textEmbedDetails ?? [],
  }
}

export type PartnerVisionCatalogStats = {
  totalInInventory: number
  /** C├│ URL ß║únh https, kh├┤ng bß╗ï loß║íi trß╗½ Vision */
  withHttpsImageUrl: number
  /** Checksum khß╗¢p ß║únh+t├¬n hiß╗çn tß║íi ΓÇö luß╗ông ─æß╗ông bß╗Ö sß║╜ bß╗Å qua */
  syncedUpToDate: number
  /** Cß║ºn xß╗¡ l├╜: ch╞░a ─æß║⌐y, hoß║╖c ─æß╗òi ß║únh/t├¬n, hoß║╖c mß║Ñt URL nh╞░ng c├▓n checksum (gß╗í) */
  pendingSync: number
  visionCatalogExcluded: number
  /** Kh├┤ng loß║íi trß╗½ nh╞░ng kh├┤ng c├│ URL https */
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

export type PartnerInventoryEmbeddingErrorClientRow = {
  id: string
  sku: string | null
  name: string
  imageUrl: string
  imageError: string | null
  imageErrorAt: string | null
  textError: string | null
  textErrorAt: string | null
}

function mapPartnerInventoryEmbeddingErrorClientRow(
  row: PartnerInventoryEmbeddingErrorRow
): PartnerInventoryEmbeddingErrorClientRow {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    imageUrl: row.image_url,
    imageError: row.image_embedding_error,
    imageErrorAt: row.image_embedding_updated_at,
    textError: row.text_embedding_error,
    textErrorAt: row.text_embedding_updated_at,
  }
}

function mapPartnerInventoryEmbeddingErrorExportRow(
  row: PartnerInventoryEmbeddingErrorRow
): PartnerInventoryEmbeddingErrorExportRow {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    imageUrl: row.image_url,
    imageError: row.image_embedding_error,
    imageErrorAt: row.image_embedding_updated_at,
    textError: row.text_embedding_error,
    textErrorAt: row.text_embedding_updated_at,
  }
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
  const gate = await assertPartnerAnyStaffCapability(user.id, partnerId, ['ai_settings', 'inventory'])
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  const settings = await fetchMessagingPartnerAiSettingsFullFromPg(partnerId)
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
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'inventory')
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
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'inventory')
  if ('error' in gate) return { error: gate.error }

  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  await clearStalePartnerInventoryImageEmbeddingErrorsFromPg(partnerId)
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

export async function getPartnerInventoryEmbeddingErrors(
  partnerId: string,
  page = 0,
  pageSize = 50
) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'inventory')
  if ('error' in gate) return { error: gate.error }

  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }

  await Promise.all([
    clearStalePartnerInventoryImageEmbeddingErrorsFromPg(partnerId),
    clearStalePartnerInventoryTextEmbeddingErrorsFromPg(partnerId),
  ])

  const size = Math.max(10, Math.min(200, Math.floor(Number(pageSize) || 50)))
  const index = Math.max(0, Math.floor(Number(page) || 0))
  const from = index * size

  const [totalCount, pageRows] = await Promise.all([
    fetchPartnerInventoryEmbeddingErrorCountFromPg(partnerId),
    fetchPartnerInventoryEmbeddingErrorsPageFromPg(partnerId, from, size),
  ])
  if (totalCount === null || pageRows === null) {
    return { error: 'Failed to load embedding error list.' }
  }

  return {
    rows: pageRows.map(mapPartnerInventoryEmbeddingErrorClientRow),
    page: index,
    pageSize: size,
    totalCount,
    hasMore: from + pageRows.length < totalCount,
  }
}

export async function exportPartnerInventoryEmbeddingErrorsCsv(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'inventory')
  if ('error' in gate) return { error: gate.error }

  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }

  await Promise.all([
    clearStalePartnerInventoryImageEmbeddingErrorsFromPg(partnerId),
    clearStalePartnerInventoryTextEmbeddingErrorsFromPg(partnerId),
  ])

  const rows = await fetchPartnerInventoryEmbeddingErrorsAllFromPg(partnerId)
  if (rows === null) return { error: 'Failed to load embedding errors for export.' }
  if (rows.length === 0) return { error: 'NO_EXPORT_ROWS' }

  const locale = await getCurrentWebLocale()
  const t = (await import('@/lib/i18n/dictionaries')).getDictionary(locale).partnerMessagingAi
  const exportRows = rows.map(mapPartnerInventoryEmbeddingErrorExportRow)
  const csv = buildPartnerInventoryEmbeddingErrorsCsvString(exportRows, {
    sku: t.inventoryEmbeddingErrorsCsvHeaderSku,
    name: t.inventoryEmbeddingErrorsCsvHeaderName,
    id: t.inventoryEmbeddingErrorsCsvHeaderId,
    imageUrl: t.inventoryEmbeddingErrorsCsvHeaderImageUrl,
    imageError: t.inventoryEmbeddingErrorsCsvHeaderImageError,
    imageErrorAt: t.inventoryEmbeddingErrorsCsvHeaderImageErrorAt,
    textError: t.inventoryEmbeddingErrorsCsvHeaderTextError,
    textErrorAt: t.inventoryEmbeddingErrorsCsvHeaderTextErrorAt,
  })
  const dateStr = new Date().toISOString().slice(0, 10)
  return {
    ok: true as const,
    base64: Buffer.from(csv, 'utf8').toString('base64'),
    filename: `vector_loi_kho_${dateStr}.csv`,
    count: exportRows.length,
  }
}

export async function getPartnerInventoryTextEmbeddingStats(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'inventory')
  if ('error' in gate) return { error: gate.error }

  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  await clearStalePartnerInventoryTextEmbeddingErrorsFromPg(partnerId)
  const agg = await fetchPartnerInventoryTextEmbeddingStatsFromPg(partnerId)
  if (agg === null) return { error: 'Failed to load text embedding stats.' }
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
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'inventory')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }

  // Cap cứng: batch quá lớn từ client cũ dễ đẩy heap OOM trên VPS 11GB chia nhiều app.
  const batchLimit = Math.max(20, Math.min(400, Math.floor(Number(limit) || 200)))
  await Promise.all([
    clearStalePartnerInventoryImageEmbeddingErrorsFromPg(partnerId),
    clearStalePartnerInventoryTextEmbeddingErrorsFromPg(partnerId),
  ])
  const run = await syncPartnerInventoryEmbeddings(partnerId, { force: false, limit: batchLimit })
  if (!run.ok) return { error: run.error }
  const runText = await syncPartnerInventoryTextEmbeddings(partnerId, { force: false, limit: batchLimit })
  if (!runText.ok) return { error: runText.error }
  // Không revalidatePath toàn dashboard sau mỗi lô — client tự refresh stats; tránh RAM/CPU spike.
  return {
    ok: true as const,
    synced: run.synced + runText.synced,
    failed: run.failed + runText.failed,
    skipped: run.skipped + runText.skipped,
  }
}

export async function savePartnerAiSettings(partnerId: string, payload: PartnerAiSettingsPayload) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'ai_settings')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  const rawDelay = Number(payload.reply_delay_seconds)
  /** DB: `reply_delay_seconds` check 5..30 (xem migration messaging_ai_reply_delay_max_30). */
  const delay = Math.min(
    30,
    Math.max(5, Number.isFinite(rawDelay) ? Math.floor(rawDelay) : 20)
  )
  const tminRaw = Number(payload.typing_pause_min_ms)
  const tmaxRaw = Number(payload.typing_pause_max_ms)
  const tmin = Math.min(
    30000,
    Math.max(0, Number.isFinite(tminRaw) ? Math.floor(tminRaw) : 0)
  )
  const tmax = Math.min(
    30000,
    Math.max(0, Number.isFinite(tmaxRaw) ? Math.floor(tmaxRaw) : 0)
  )
  const vision_shop_country: string | null = null
  const vision_location = 'us-central1'
  const vision_product_category = 'general-v1'
  const vision_gcs_bucket = ''
  const purchaseFlow = normalizeGuestPurchaseFlow(payload.guest_purchase_flow)
  const cartTpl = (payload.guest_external_cart_url_template ?? '').trim()
  if (purchaseFlow === 'external_cart_url') {
    if (!cartTpl || !/\{sku\}/i.test(cartTpl) || !/^https?:\/\//i.test(cartTpl)) {
      return {
        error:
          'Cart URL template is required for this mode: use https://ΓÇª with {sku} (e.g. https://shop.vn/cart/add/{sku}?from=nanoai).',
      }
    }
  }
  const shippingLookupUrl = (payload.shipping_lookup_url ?? '').trim().slice(0, 2048)
  if (shippingLookupUrl && !assertPublicHttpsShippingLookupUrl(shippingLookupUrl)) {
    return { error: 'Shipping lookup URL must be public HTTPS (localhost allowed only in development).' }
  }
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
    product_consultation_context: (payload.product_consultation_context ?? '').slice(0, 16000),
    append_ai_disclosure: Boolean(payload.append_ai_disclosure),
    disclosure_suffix: payload.disclosure_suffix?.trim() || '',
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
    guest_purchase_flow: purchaseFlow,
    guest_external_cart_url_template:
      (payload.guest_external_cart_url_template ?? '').trim().slice(0, 2048) || null,
    shop_checkout_login_required: Boolean(payload.shop_checkout_login_required),
    after_sales_return_address: (payload.after_sales_return_address ?? '').trim().slice(0, 2000),
    shipping_lookup_url: shippingLookupUrl,
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
  const keyDraft = (payload.shipping_lookup_api_key ?? '').trim().slice(0, 512)
  if (keyDraft) {
    const keyOk = await updateMessagingPartnerShippingLookupApiKeyFromPg(partnerId, keyDraft, now)
    if (!keyOk) return { error: 'Failed to save shipping lookup API key.' }
  }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function clearPartnerShippingLookupApiKey(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'ai_settings')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const ok = await updateMessagingPartnerShippingLookupApiKeyFromPg(
    partnerId,
    null,
    new Date().toISOString()
  )
  if (!ok) return { error: 'Failed to clear shipping lookup API key.' }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

/** Gọi cổng shop (không lộ key). 200/400/404 = đã kết nối; 401/503 = sai key / API tắt. */
export async function testPartnerShippingLookup(
  partnerId: string,
  input?: { url?: string; apiKey?: string; q?: string }
) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'ai_settings')
  if ('error' in gate) return { error: gate.error }
  const saved = await fetchMessagingPartnerShippingLookupAuthFromPg(partnerId)
  const url = (input?.url ?? saved?.shipping_lookup_url ?? '').trim()
  const apiKey = (input?.apiKey ?? saved?.shipping_lookup_api_key ?? '').trim()
  if (!url || !assertPublicHttpsShippingLookupUrl(url)) {
    return { error: 'Enter a valid public HTTPS lookup URL first.' }
  }
  if (!apiKey) return { error: 'Enter or save the shop API key first.' }
  const qRaw = (input?.q ?? '').trim()
  const query = qRaw
    ? classifyShippingLookupQuery(qRaw) ?? { type: 'q' as const, value: qRaw.slice(0, 64) }
    : { type: 'q' as const, value: 'DH001' }
  const outcome = await lookupPartnerShipping({ url, apiKey, query })
  if (outcome.ok) {
    return {
      ok: true as const,
      httpStatus: outcome.hit.httpStatus,
      detail: outcome.hit.orderCode || outcome.hit.statusLabel || 'ok',
    }
  }
  if (outcome.httpStatus === 400 || outcome.httpStatus === 404) {
    return { ok: true as const, httpStatus: outcome.httpStatus, detail: outcome.detail }
  }
  return { error: outcome.detail || `HTTP ${outcome.httpStatus}`, httpStatus: outcome.httpStatus }
}

export async function generatePartnerImageSearchApiSecret(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const step = await requireAccountStepUp(user.id)
  if ('error' in step) return { error: step.error }
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

/** Kh├┤ng trß║ú secret ΓÇö chß╗ë meta cho UI mask / toggle */
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
  const webhookRow = await fetchPartnerOutboundWebhookFromPg(partnerId)
  return {
    ok: true as const,
    embedKey,
    imageSearchConfigured,
    imageSearchEnabled,
    aiSettingsRowExists,
    outboundWebhook: {
      configured: Boolean(webhookRow?.webhookUrl?.trim()),
      isEnabled: Boolean(webhookRow?.isEnabled),
      secretConfigured: Boolean(webhookRow?.webhookSecret?.trim()),
      events: webhookRow?.events ?? ['order.created', 'lead.created', 'payment.paid'],
      webhookUrl: webhookRow?.webhookUrl ?? '',
    },
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
  const step = await requireAccountStepUp(user.id)
  if ('error' in step) return { error: step.error }
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
      error: 'Save AI settings once in Messaging ΓåÆ AI settings before toggling the API.',
    }
  }
  const ok = await updateMessagingPartnerAiImageSearchEnabledFromPg(partnerId, enabled, now)
  if (!ok) return { error: 'Failed to update image search API.' }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function savePartnerOutboundWebhookSettings(input: {
  partnerId: string
  webhookUrl: string
  isEnabled: boolean
  events: string[]
}) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, input.partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const allowed = new Set<string>(PARTNER_OUTBOUND_WEBHOOK_EVENTS)
  const events = input.events.filter((e): e is (typeof PARTNER_OUTBOUND_WEBHOOK_EVENTS)[number] =>
    allowed.has(e)
  )

  const saved = await upsertPartnerOutboundWebhookFromPg({
    partnerId: input.partnerId,
    webhookUrl: input.webhookUrl.trim().slice(0, 2000),
    isEnabled: input.isEnabled,
    events: events.length > 0 ? events : [...PARTNER_OUTBOUND_WEBHOOK_EVENTS],
  })
  if (!saved) return { error: 'Failed to save webhook settings.' }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function generatePartnerOutboundWebhookSecret(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const step = await requireAccountStepUp(user.id)
  if ('error' in step) return { error: step.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const secret = randomBytes(24).toString('hex')
  const ok = await setPartnerOutboundWebhookSecretFromPg(partnerId, secret)
  if (!ok) return { error: 'Failed to generate webhook secret.' }
  revalidateMessagingDashboard()
  return { ok: true as const, secret }
}

export async function sendPartnerOutboundWebhookTest(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerOwner(user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const result = await dispatchPartnerOutboundWebhook({
    partnerId,
    event: 'webhook.test',
    data: { message: 'NanoAI webhook test delivery.', sent_at: new Date().toISOString() },
    force: true,
  })
  if (!result.ok) {
    return {
      error: result.error || `Delivery failed${result.status ? ` (HTTP ${result.status})` : ''}.`,
    }
  }
  return { ok: true as const, status: result.status ?? 200 }
}

export async function upsertPartnerInventoryItem(
  partnerId: string,
  itemId: string | null,
  fields: {
    name: string
    sku: string
    description: string
    stock_note: string
    stock_qty?: number
    price_hint: string
    image_url: string
    product_url: string
    product_video_url: string
    consult_note: string
    material_note: string
    material_detail_image_url: string
    real_use_image_url: string
    real_use_image_url_2: string
    remarketing_id: string
    sort_order: number
    /** W1.4 flash sale */
    sale_price_amount?: number | null
    sale_starts_at?: string | null
    sale_ends_at?: string | null
  }
) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'inventory')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) {
    return { error: 'DATABASE_URL is not set.' }
  }
  const now = new Date().toISOString()
  const sku = fields.sku.trim() || null
  const imageUrl = validateInventoryImageUrl(fields.image_url ?? '')
  const productUrl = validateInventoryImageUrl(fields.product_url ?? '')
  const productVideoUrl = validateInventoryImageUrl(fields.product_video_url ?? '')
  const materialDetailImageUrl = validateInventoryImageUrl(fields.material_detail_image_url ?? '')
  const realUseImageUrl = validateInventoryImageUrl(fields.real_use_image_url ?? '')
  const realUseImageUrl2 = validateInventoryImageUrl(fields.real_use_image_url_2 ?? '')
  const consult = (fields.consult_note ?? '').trim().slice(0, 2000)
  const materialNote = (fields.material_note ?? '').trim().slice(0, 8000)
  const remarketingId = fields.remarketing_id.trim().slice(0, 500) || null
  const shared = {
    name: fields.name.trim(),
    sku,
    description: fields.description ?? '',
    stock_note: fields.stock_note ?? '',
    stock_qty: Math.max(0, Math.floor(Number(fields.stock_qty ?? 0) || 0)),
    price_hint: fields.price_hint ?? '',
    image_url: imageUrl,
    product_url: productUrl,
    product_video_url: productVideoUrl,
    consult_note: consult,
    material_note: materialNote,
    material_detail_image_url: materialDetailImageUrl,
    real_use_image_url: realUseImageUrl,
    real_use_image_url_2: realUseImageUrl2,
    remarketing_id: remarketingId,
    sort_order: fields.sort_order,
  }
  if (itemId) {
    const ok = await updatePartnerInventoryDashboardItemFromPg(partnerId, itemId, {
      ...shared,
      updated_at: now,
      sale_price_amount:
        fields.sale_price_amount == null || fields.sale_price_amount === ('' as unknown)
          ? null
          : Math.max(0, Number(fields.sale_price_amount)),
      sale_starts_at: fields.sale_starts_at?.trim() || null,
      sale_ends_at: fields.sale_ends_at?.trim() || null,
    })
    if (!ok) return { error: 'Failed to update inventory item.' }
    await syncPartnerInventoryEmbeddings(partnerId, { inventoryIds: [itemId], force: false })
  } else {
    const newId = await insertPartnerInventoryDashboardItemFromPg(partnerId, {
      ...shared,
      created_at: now,
      updated_at: now,
    })
    if (!newId) return { error: 'Failed to insert inventory item.' }
    await syncPartnerInventoryEmbeddings(partnerId, { inventoryIds: [newId], force: false })
    await syncPartnerInventoryTextEmbeddings(partnerId, { inventoryIds: [newId], force: false })
  }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export type PartnerInventoryExternalSyncClientSettings = {
  partner_id: string
  site_origin: string
  product_path_template: string
  products_list_url: string
  field_mapping: Record<string, string>
  updated_at: string
  catalog_auto_sync_enabled: boolean
  catalog_auto_sync_interval_minutes: number
  catalog_auto_sync_time_vn: string
  catalog_last_sync_at: string | null
  catalog_last_sync_error: string | null
  catalog_initial_sync_status: 'pending' | 'running' | 'completed'
  catalog_initial_sync_next_page: number
  catalog_initial_sync_total_pages: number | null
  catalog_initial_sync_started_at: string | null
}

export type { ExternalCatalogSyncOutcome }

export async function getPartnerInventoryExternalSyncSettings(
  partnerId: string
): Promise<
  { ok: true; settings: PartnerInventoryExternalSyncClientSettings } | { error: string }
> {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error ?? 'Unauthorized.' }
  const { user } = auth
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'inventory')
  if ('error' in gate) return { error: gate.error ?? 'Forbidden.' }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const row = await fetchPartnerInventoryExternalSyncSettingsFromPg(partnerId)
  const base = defaultPartnerInventoryExternalSyncSettings(partnerId)
  if (!row) return { ok: true, settings: base }
  return {
    ok: true,
    settings: {
      ...base,
      site_origin: row.site_origin,
      product_path_template: row.product_path_template,
      products_list_url: row.products_list_url,
      field_mapping: row.field_mapping,
      updated_at: row.updated_at,
      catalog_auto_sync_enabled: row.catalog_auto_sync_enabled,
      catalog_auto_sync_interval_minutes: row.catalog_auto_sync_interval_minutes,
      catalog_auto_sync_time_vn: row.catalog_auto_sync_time_vn,
      catalog_last_sync_at: row.catalog_last_sync_at,
      catalog_last_sync_error: row.catalog_last_sync_error,
      catalog_initial_sync_status: row.catalog_initial_sync_status,
      catalog_initial_sync_next_page: row.catalog_initial_sync_next_page,
      catalog_initial_sync_total_pages: row.catalog_initial_sync_total_pages,
      catalog_initial_sync_started_at: row.catalog_initial_sync_started_at,
    },
  }
}

export async function savePartnerInventoryExternalSyncSettings(
  partnerId: string,
  payload: {
    siteOrigin: string
    productPathTemplate: string
    productsListUrl: string
    fieldMapping: Record<string, string>
    catalogAutoSyncEnabled: boolean
    catalogAutoSyncIntervalMinutes: number
    catalogAutoSyncTimeVn: string
  }
): Promise<{ ok: true } | { error: string }> {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error ?? 'Unauthorized.' }
  const { user } = auth
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'inventory')
  if ('error' in gate) return { error: gate.error ?? 'Forbidden.' }
  const step = await requireAccountStepUp(user.id)
  if ('error' in step) return { error: step.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const ok = await upsertPartnerInventoryExternalSyncSettingsFromPg({
    partnerId,
    siteOrigin: payload.siteOrigin,
    productPathTemplate: payload.productPathTemplate,
    productsListUrl: payload.productsListUrl,
    fieldMapping: payload.fieldMapping,
    catalogAutoSyncEnabled: payload.catalogAutoSyncEnabled,
    catalogAutoSyncIntervalMinutes: clampCatalogAutoSyncIntervalMinutes(
      payload.catalogAutoSyncIntervalMinutes
    ),
    catalogAutoSyncTimeVn: normalizeCatalogAutoSyncTimeVn(payload.catalogAutoSyncTimeVn),
  })
  if (!ok) return { error: 'Failed to save external inventory mapping.' }
  revalidateMessagingDashboard()
  return { ok: true }
}

export async function runPartnerExternalCatalogSyncNow(
  partnerId: string
): Promise<
  | { ok: true; outcome: ExternalCatalogSyncOutcome }
  | { error: string }
> {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error ?? 'Unauthorized.' }
  const { user } = auth
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'inventory')
  if ('error' in gate) return { error: gate.error ?? 'Forbidden.' }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const outcome = await runPartnerExternalCatalogSyncJob({
    partnerId,
    deferEmbeddings: true,
    reportLocale: getCurrentWebLocale(),
    reportSource: 'manual',
  })
  revalidateMessagingDashboard()
  return { ok: true, outcome }
}

export async function deletePartnerInventoryItem(partnerId: string, itemId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const { user } = auth
  const gate = await assertPartnerStaffGate(user.id, partnerId, 'inventory')
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

/** Xß║┐p h├áng ─æß╗ông bß╗Ö Vision nß╗ün (cron VPS). `resumeAfterId` null = qu├⌐t tß╗½ ─æß║ºu theo cursor server. */
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

/** ─É├│ng banner b├ío c├ío sau khi ─æ├ú xem (job ─æ├ú done/error). */
export async function dismissVisionCatalogBackgroundSyncReport(partnerId: string) {
  return cancelVisionCatalogBackgroundSync(partnerId)
}

/** Mß╗ƒ kh├│a import Vision Warehouse khi lock bß╗ï treo qu├í l├óu. */
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
 * Kill switch khß║⌐n cß║Ñp: tß║»t to├án bß╗Ö Vision cho shop hiß╗çn tß║íi v├á dß╗ìn mß╗ìi queue/lock runner.
 * D├╣ng khi chi ph├¡ Vision t─âng bß║Ñt th╞░ß╗¥ng hoß║╖c cß║ºn dß╗½ng tß╗⌐c th├¼ kh├┤ng qua SQL thß╗º c├┤ng.
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

export async function getPartnerBirthdayPromoSettings(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerStaffGate(auth.user.id, partnerId, 'ai_settings')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const row = await fetchBirthdayPromoForPartnerFromPg(partnerId)
  return {
    settings: row ?? {
      partner_id: partnerId,
      enabled: false,
      discount_percent: 10,
      offer_days_before_max: 7,
      offer_days_before_min: 1,
      updated_at: new Date().toISOString(),
    },
  }
}

export async function savePartnerBirthdayPromoSettings(
  partnerId: string,
  input: {
    enabled: boolean
    discountPercent: number
    offerDaysBeforeMax: number
    offerDaysBeforeMin: number
  }
) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerStaffGate(auth.user.id, partnerId, 'ai_settings')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const ok = await upsertBirthdayPromoForPartnerFromPg({
    partnerId,
    enabled: input.enabled,
    discountPercent: input.discountPercent,
    offerDaysBeforeMax: input.offerDaysBeforeMax,
    offerDaysBeforeMin: input.offerDaysBeforeMin,
  })
  if (!ok) return { error: 'Failed to save birthday promo settings.' }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

/** Chß╗ë chß╗º workspace: danh s├ích nh├ón vi├¬n v├á email (auth.users). */
export async function listMessagingPartnerStaffForOwner(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerOwner(auth.user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const rows = await listMessagingPartnerMembersForOwnerFromPg(partnerId, auth.user.id)
  return { rows }
}

/** Mß╗¥i nh├ón vi├¬n bß║▒ng email ─æ─âng k├╜ NanoAI (`auth.users`). Mß║╖c ─æß╗ïnh quyß╗ün inbox + ─æ╞ín; chß╗ënh sau trong C├ái ─æß║╖t. */
export async function inviteMessagingPartnerStaffByEmail(partnerId: string, emailRaw: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerOwner(auth.user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const step = await requireAccountStepUp(auth.user.id)
  if ('error' in step) return { error: step.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const found = await lookupAuthUserIdByEmailExcludeOwnerFromPg({
    email: emailRaw,
    ownerUserId: auth.user.id,
    partnerId,
  })
  if (!found.ok) {
    if (found.reason === 'invalid_email') return { error: 'INVALID_EMAIL' as const }
    if (found.reason === 'is_owner') return { error: 'INVITE_OWNER' as const }
    if (found.reason === 'duplicate_owner') return { error: 'INVITE_OWNER_ACCOUNT' as const }
    return { error: 'USER_NOT_FOUND' as const }
  }
  const invite = await upsertMessagingPartnerMemberForOwnerFromPg({
    partnerId,
    ownerUserId: auth.user.id,
    memberUserId: found.userId,
    permissions: defaultInviteStaffPermissions(),
  })
  if (!invite.ok) {
    if (invite.error === 'is_owner') return { error: 'INVITE_OWNER' as const }
    return { error: 'INVITE_FAILED' as const }
  }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function updateMessagingPartnerStaffMemberPermissions(input: {
  partnerId: string
  memberUserId: string
  permissions: PartnerStaffPermissionMap
}) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerOwner(auth.user.id, input.partnerId)
  if ('error' in gate) return { error: gate.error }
  const step = await requireAccountStepUp(auth.user.id)
  if ('error' in step) return { error: step.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const ok = await upsertMessagingPartnerMemberForOwnerFromPg({
    partnerId: input.partnerId,
    ownerUserId: auth.user.id,
    memberUserId: input.memberUserId.trim(),
    permissions: input.permissions,
  })
  if (!ok.ok) return { error: ok.error === 'is_owner' ? 'INVITE_OWNER' : 'UPDATE_FAILED' }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function removeMessagingPartnerStaffMember(partnerId: string, memberUserId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerOwner(auth.user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const step = await requireAccountStepUp(auth.user.id)
  if ('error' in step) return { error: step.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const rm = await deleteMessagingPartnerMemberForOwnerFromPg({
    partnerId,
    ownerUserId: auth.user.id,
    memberUserId: memberUserId.trim(),
  })
  if (!rm) return { error: 'REMOVE_FAILED' as const }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function getMessagingPartnerCustomDomainSettings(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerOwner(auth.user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const row = await fetchPartnerCustomDomainByPartnerIdPg(partnerId)
  const shopSso = await fetchPartnerExternalShopSsoPg(partnerId)
  return {
    domain: row,
    cnameTarget: getPartnerCustomDomainCnameTarget(),
    shopSso: {
      externalShopOrigin: shopSso?.external_shop_origin?.trim() ?? '',
      externalShopLoginPath: shopSso?.external_shop_login_path?.trim() || '/dang-nhap',
    },
  }
}

export async function saveMessagingPartnerShopSsoSettings(input: {
  partnerId: string
  externalShopOrigin: string
  externalShopLoginPath: string
}) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerOwner(auth.user.id, input.partnerId)
  if ('error' in gate) return { error: gate.error }
  const step = await requireAccountStepUp(auth.user.id)
  if ('error' in step) return { error: step.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const rawOrigin = input.externalShopOrigin.trim()
  let externalShopOrigin: string | null = null
  if (rawOrigin) {
    externalShopOrigin = normalizePartnerShopOrigin(rawOrigin)
    if (!externalShopOrigin) return { error: 'INVALID_SHOP_ORIGIN' as const }
  }

  const loginPathRaw = input.externalShopLoginPath.trim() || '/dang-nhap'
  const externalShopLoginPath = loginPathRaw.startsWith('/') ? loginPathRaw : `/${loginPathRaw}`

  const ok = await updatePartnerExternalShopSsoPg({
    partnerId: input.partnerId,
    externalShopOrigin,
    externalShopLoginPath,
  })
  if (!ok) return { error: 'SAVE_FAILED' as const }
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function saveMessagingPartnerCustomDomainSettings(input: {
  partnerId: string
  hostname: string
  useForChat: boolean
  useForSite: boolean
}) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerOwner(auth.user.id, input.partnerId)
  if ('error' in gate) return { error: gate.error }
  const step = await requireAccountStepUp(auth.user.id)
  if ('error' in step) return { error: step.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const hostname = normalizePartnerCustomDomainHostname(input.hostname)
  if (!hostname) return { error: 'INVALID_HOSTNAME' as const }

  const token = randomBytes(16).toString('hex')
  const row = await upsertPartnerCustomDomainPg({
    partnerId: input.partnerId,
    hostname,
    verificationToken: token,
    useForChat: input.useForChat,
    useForSite: input.useForSite,
  })
  if (!row) return { error: 'SAVE_FAILED' as const }
  revalidateMessagingDashboard()
  return { ok: true as const, domain: row, cnameTarget: getPartnerCustomDomainCnameTarget() }
}

export async function verifyMessagingPartnerCustomDomain(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerOwner(auth.user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const row = await fetchPartnerCustomDomainByPartnerIdPg(partnerId)
  if (!row) return { error: 'NOT_FOUND' as const }

  const cname = await verifyPartnerCustomDomainCname(row.hostname)
  if (!cname.ok) {
    await updatePartnerCustomDomainVerificationPg({
      partnerId,
      dnsVerified: false,
      sslStatus: 'pending',
      sslLastError: cname.detail,
    })
    return { error: 'DNS_FAILED' as const, detail: cname.detail }
  }

  const ssl = await probePartnerCustomDomainSsl(row.hostname)
  const sslStatus = ssl.ok ? 'ssl_active' : 'dns_ok'
  await updatePartnerCustomDomainVerificationPg({
    partnerId,
    dnsVerified: true,
    sslStatus,
    sslLastError: ssl.ok ? null : ssl.detail,
  })
  revalidateMessagingDashboard()
  const updated = await fetchPartnerCustomDomainByPartnerIdPg(partnerId)
  return {
    ok: true as const,
    domain: updated,
    dnsDetail: cname.detail,
    sslDetail: ssl.detail,
    sslActive: ssl.ok,
  }
}

export async function removeMessagingPartnerCustomDomain(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerOwner(auth.user.id, partnerId)
  if ('error' in gate) return { error: gate.error }
  const step = await requireAccountStepUp(auth.user.id)
  if ('error' in step) return { error: step.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  await deletePartnerCustomDomainPg(partnerId)
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function updateMessagingPartnerCustomDomainUsage(input: {
  partnerId: string
  useForChat: boolean
  useForSite: boolean
}) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerOwner(auth.user.id, input.partnerId)
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  await updatePartnerCustomDomainFlagsPg({
    partnerId: input.partnerId,
    useForChat: input.useForChat,
    useForSite: input.useForSite,
  })
  revalidateMessagingDashboard()
  return { ok: true as const }
}

export async function getPartnerCapabilitiesBundle(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerStaffGate(auth.user.id, partnerId, 'website')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const partners = await fetchMessagingPartnersForDashboardFromPg(auth.user.id)
  const row = partners?.find((p) => p.id === partnerId)
  const capabilities = await fetchPartnerCapabilitiesForPartnerFromPg(partnerId, row?.industry_key ?? null)
  return {
    capabilities,
    industry_key: row?.industry_key ?? null,
  }
}

export async function savePartnerCapabilities(partnerId: string, capabilities: PartnerCapabilities) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerStaffGate(auth.user.id, partnerId, 'website')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  const saved = await updatePartnerCapabilitiesForOwnerFromPg({
    partner_id: partnerId,
    owner_user_id: auth.user.id,
    capabilities,
  })
  if (!saved) return { error: 'Could not save capabilities.' }
  revalidateMessagingDashboard()
  return { ok: true as const, capabilities: saved }
}

