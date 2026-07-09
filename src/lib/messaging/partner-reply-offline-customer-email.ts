import type { Database, Json } from '@/types/database.types'
import { getAuthUserEmailFromPg } from '@/lib/db/auth-user-email-pg'
import {
  mergeConversationMetadataPatchFromPg,
  readIsoTimestampFromConversationMetadata,
} from '@/lib/db/customer-care-pg'
import { fetchGuestAccountEmailByIdPg } from '@/lib/db/messaging-guest-pg'
import { fetchMessagingPartnersByIdsFromPg } from '@/lib/db/messaging-partners-pg'
import { isSmtpConfigured, sendSmtpMail } from '@/lib/email/smtp'
import { formatOfflineShopReplyEmailContent } from '@/lib/messaging/partner-reply-offline-email-i18n'
import { buildOfflineReplyAutoLoginChatUrl } from '@/lib/messaging/offline-reply-magic-chat-link'

type ConvRow = Database['public']['Tables']['customer_care_conversations']['Row']

/** Khách poll chat ~18s; coi «đang live» nếu heartbeat trong khoảng này. */
export const GUEST_VIEWER_LIVE_THRESHOLD_MS = 50_000

/** Tránh gửi nhiều email liên tiếp khi shop trả lời nhiều tin. */
export const OFFLINE_REPLY_EMAIL_COOLDOWN_MS = 20 * 60 * 1000

const METADATA_GUEST_VIEWER_LAST_SEEN = 'guest_viewer_last_seen_at'
const METADATA_LAST_OFFLINE_REPLY_EMAIL = 'last_offline_reply_email_at'

function isValidEmail(em: string): boolean {
  const t = em.trim().toLowerCase()
  return Boolean(t && /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(t))
}

async function resolveCustomerEmailForConversation(conv: ConvRow): Promise<string | null> {
  const guestAccountId = conv.guest_account_id?.trim()
  if (guestAccountId) {
    const ga = await fetchGuestAccountEmailByIdPg(conv.partner_id, guestAccountId)
    const em = ga?.emailRaw?.trim() || ga?.emailNormalized?.trim()
    if (em && isValidEmail(em)) return em.toLowerCase()
  }
  const linkedUserId = conv.linked_user_id?.trim()
  if (linkedUserId) {
    const em = await getAuthUserEmailFromPg(linkedUserId)
    if (em && isValidEmail(em)) return em.trim().toLowerCase()
  }
  return null
}

function guestViewerIsLive(metadata: Json | null | undefined, nowMs = Date.now()): boolean {
  const lastSeenMs = readIsoTimestampFromConversationMetadata(metadata, METADATA_GUEST_VIEWER_LAST_SEEN)
  if (lastSeenMs == null) return false
  return nowMs - lastSeenMs <= GUEST_VIEWER_LIVE_THRESHOLD_MS
}

function offlineReplyEmailCooldownActive(metadata: Json | null | undefined, nowMs = Date.now()): boolean {
  const lastEmailMs = readIsoTimestampFromConversationMetadata(metadata, METADATA_LAST_OFFLINE_REPLY_EMAIL)
  if (lastEmailMs == null) return false
  return nowMs - lastEmailMs < OFFLINE_REPLY_EMAIL_COOLDOWN_MS
}

/**
 * Shop (nhân viên hoặc AI) vừa gửi tin outbound trên widget —
 * nếu khách không còn mở chat và có email, gửi thông báo quay lại đọc hội thoại.
 */
export async function maybeEmailCustomerOfflineShopReply(input: {
  conversation: ConvRow
  replyBody: string
  shopDisplayName?: string
  shopSlug?: string | null
}): Promise<void> {
  try {
    const conv = input.conversation
    if (conv.channel !== 'widget') return
    if (!isSmtpConfigured()) return

    let shopDisplayName = input.shopDisplayName?.trim() || ''
    let shopSlug = input.shopSlug?.trim() || null

    if (!shopDisplayName || !shopSlug) {
      const partners = await fetchMessagingPartnersByIdsFromPg([conv.partner_id])
      const p = partners?.[0]
      if (!p) return
      if (!shopDisplayName) shopDisplayName = String(p.display_name ?? '').trim()
      if (!shopSlug) shopSlug = String(p.slug ?? '').trim() || null
    }

    if (!shopSlug) return
    if (guestViewerIsLive(conv.metadata)) return
    if (offlineReplyEmailCooldownActive(conv.metadata)) return

    const to = await resolveCustomerEmailForConversation(conv)
    if (!to) return

    const chatUrl = await buildOfflineReplyAutoLoginChatUrl({
      partnerId: conv.partner_id,
      slug: shopSlug,
      email: to,
      conversation: conv,
    })
    const { subject, text, html } = formatOfflineShopReplyEmailContent({
      shopDisplayName: shopDisplayName || 'Shop',
      chatUrl,
      replyPreview: input.replyBody,
      metadata: conv.metadata,
    })

    const sent = await sendSmtpMail({ to, subject, text, html })
    if (!sent.ok) {
      console.warn('[maybeEmailCustomerOfflineShopReply] send failed', sent.error)
      return
    }

    await mergeConversationMetadataPatchFromPg(conv.id, {
      [METADATA_LAST_OFFLINE_REPLY_EMAIL]: new Date().toISOString(),
    })
  } catch (e) {
    console.warn('[maybeEmailCustomerOfflineShopReply]', e)
  }
}
