'use server'

import { revalidatePath } from 'next/cache'
import { getUserForCreditAction } from '@/lib/auth'
import { assertPartnerStaffGate } from '@/lib/messaging/partner-dashboard-access'
import { isPgConfigured } from '@/lib/db/pool'
import {
  bulkInsertMarketingDeliveriesFromPg,
  cancelMarketingCampaignFromPg,
  countMarketingChatSentForPartnerThisMonthFromPg,
  countMarketingEmailsSentForPartnerThisMonthFromPg,
  countMarketingOptOutForPartnerFromPg,
  countMarketingSegmentRecipientsFromPg,
  fetchMarketingCampaignForPartnerFromPg,
  findMarketingRecipientByEmailForPartnerFromPg,
  insertMarketingCampaignFromPg,
  listMarketingCampaignsForPartnerFromPg,
  listMarketingDeliveriesForCampaignFromPg,
  listMarketingSegmentRecipientsFromPg,
  queueMarketingCampaignFromPg,
  updateMarketingCampaignTemplateFromPg,
} from '@/lib/db/messaging-partner-marketing-campaigns-pg'
import { fetchCustomerCareConversationByIdPg } from '@/lib/db/customer-care-pg'
import { buildOfflineReplyAutoLoginChatUrl } from '@/lib/messaging/offline-reply-magic-chat-link'
import {
  DEFAULT_MARKETING_TEMPLATE_CHAT,
  formatSegmentRecipientLabel,
  MARKETING_CAMPAIGN_COOLDOWN_DAYS,
  normalizeMarketingSegmentJson,
  segmentRulesFromJson,
  type MarketingSegmentJson,
} from '@/lib/messaging/partner-marketing-segment'
import { MARKETING_EMAIL_COOLDOWN_DAYS } from '@/lib/messaging/partner-marketing-email'
import {
  buildMarketingRenderContext,
  fetchMarketingInterestProducts,
  renderMarketingTemplate,
} from '@/lib/messaging/partner-marketing-render'
import { formatMarketingCampaignEmailContent } from '@/lib/messaging/partner-marketing-email-i18n'
import { buildMarketingOptOutUrl } from '@/lib/messaging/marketing-opt-out-token'
import { isSmtpConfigured, sendSmtpMail } from '@/lib/email/smtp'
import { fetchMessagingPartnersByIdsFromPg } from '@/lib/db/messaging-partners-pg'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'

function isValidEmailAddress(v: string): boolean {
  const t = v.trim().toLowerCase()
  return Boolean(t && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t))
}

async function requireUser() {
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  return { user: result.user }
}

function revalidateMarketingPaths() {
  revalidatePath('/dashboard/messaging/marketing')
}

export async function previewMarketingSegment(partnerId: string, segmentJson: MarketingSegmentJson) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerStaffGate(auth.user.id, partnerId, 'marketing_campaigns')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const seg = normalizeMarketingSegmentJson(segmentJson)
  const rules = segmentRulesFromJson(seg)
  const recipients = await listMarketingSegmentRecipientsFromPg({
    partnerId,
    daysSinceChat: rules.daysSinceChat,
    requireHasOrder: rules.requireHasOrder,
    limit: 5000,
  })
  const samples = recipients.slice(0, 3).map((r) => ({
    conversationId: r.conversation_id,
    recipientKey: r.recipient_key,
    customerName: r.customer_name?.trim() || null,
    email: r.customer_email,
    lastMessageAt: r.last_message_at,
  }))
  const [emailsSentThisMonth, chatSentThisMonth] = await Promise.all([
    countMarketingEmailsSentForPartnerThisMonthFromPg(partnerId),
    countMarketingChatSentForPartnerThisMonthFromPg(partnerId),
  ])
  return {
    ok: true as const,
    count: recipients.length,
    samples,
    segment: seg,
    emailsSentThisMonth,
    chatSentThisMonth,
    emailCooldownDays: MARKETING_EMAIL_COOLDOWN_DAYS,
    chatCooldownDays: MARKETING_CAMPAIGN_COOLDOWN_DAYS,
  }
}

export async function listMarketingSegmentRecipientsFull(
  partnerId: string,
  segmentJson: MarketingSegmentJson
) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerStaffGate(auth.user.id, partnerId, 'marketing_campaigns')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const seg = normalizeMarketingSegmentJson(segmentJson)
  const rules = segmentRulesFromJson(seg)
  const recipients = await listMarketingSegmentRecipientsFromPg({
    partnerId,
    daysSinceChat: rules.daysSinceChat,
    requireHasOrder: rules.requireHasOrder,
    limit: 5000,
  })
  return {
    ok: true as const,
    recipients: recipients.map((r) => ({
      conversationId: r.conversation_id,
      recipientKey: r.recipient_key,
      customerName: r.customer_name?.trim() || null,
      email: r.customer_email?.trim() || null,
      lastMessageAt: r.last_message_at,
    })),
    count: recipients.length,
  }
}

export async function createMarketingCampaignDraft(input: {
  partnerId: string
  segmentJson: MarketingSegmentJson
  templateBodyChat?: string
  offerPercent?: number | null
  channelEmail?: boolean
  templateBodyEmail?: string | null
}) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerStaffGate(auth.user.id, input.partnerId, 'marketing_campaigns')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const template = (input.templateBodyChat?.trim() || DEFAULT_MARKETING_TEMPLATE_CHAT).slice(0, 8000)
  const seg = normalizeMarketingSegmentJson(input.segmentJson)
  const row = await insertMarketingCampaignFromPg({
    partnerId: input.partnerId,
    createdByUserId: auth.user.id,
    segmentJson: seg,
    templateBodyChat: template,
    offerPercent: input.offerPercent ?? null,
    channelEmail: Boolean(input.channelEmail),
    templateBodyEmail: input.templateBodyEmail ?? null,
  })
  if (!row) return { error: 'Failed to create campaign.' }
  revalidateMarketingPaths()
  return { ok: true as const, campaign: row }
}

export async function updateMarketingCampaignDraft(input: {
  partnerId: string
  campaignId: string
  templateBodyChat: string
  offerPercent?: number | null
  channelEmail?: boolean
  templateBodyEmail?: string | null
}) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerStaffGate(auth.user.id, input.partnerId, 'marketing_campaigns')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const ok = await updateMarketingCampaignTemplateFromPg(
    input.campaignId,
    input.partnerId,
    input.templateBodyChat,
    input.offerPercent ?? null,
    { channelEmail: input.channelEmail, templateBodyEmail: input.templateBodyEmail ?? null }
  )
  if (!ok) return { error: 'Campaign not found or not editable.' }
  revalidateMarketingPaths()
  return { ok: true as const }
}

export async function queueMarketingCampaign(partnerId: string, campaignId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerStaffGate(auth.user.id, partnerId, 'marketing_campaigns')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const campaign = await fetchMarketingCampaignForPartnerFromPg(partnerId, campaignId)
  if (!campaign) return { error: 'Campaign not found.' }
  if (campaign.status !== 'draft') return { error: 'Campaign is not a draft.' }

  const rules = segmentRulesFromJson(campaign.segment_json)
  const recipients = await listMarketingSegmentRecipientsFromPg({
    partnerId,
    daysSinceChat: rules.daysSinceChat,
    requireHasOrder: rules.requireHasOrder,
    limit: 5000,
  })
  if (!recipients.length) return { error: 'NO_RECIPIENTS' }

  const inserted = await bulkInsertMarketingDeliveriesFromPg(
    campaignId,
    partnerId,
    recipients.map((r) => ({
      conversationId: r.conversation_id,
      recipientKey: r.recipient_key,
      email: r.customer_email,
    }))
  )
  if (inserted === 0) return { error: 'Failed to queue deliveries.' }

  const queued = await queueMarketingCampaignFromPg(campaignId, partnerId, inserted)
  if (!queued) return { error: 'Failed to queue campaign.' }

  revalidateMarketingPaths()
  return { ok: true as const, totalQueued: inserted }
}

export async function cancelMarketingCampaign(partnerId: string, campaignId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerStaffGate(auth.user.id, partnerId, 'marketing_campaigns')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const ok = await cancelMarketingCampaignFromPg(campaignId, partnerId)
  if (!ok) return { error: 'Campaign cannot be cancelled.' }
  revalidateMarketingPaths()
  return { ok: true as const }
}

export async function listPartnerMarketingCampaigns(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerStaffGate(auth.user.id, partnerId, 'marketing_campaigns')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const campaigns = await listMarketingCampaignsForPartnerFromPg(partnerId, 30)
  return { ok: true as const, campaigns }
}

export async function getMarketingCampaignDetail(partnerId: string, campaignId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerStaffGate(auth.user.id, partnerId, 'marketing_campaigns')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const campaign = await fetchMarketingCampaignForPartnerFromPg(partnerId, campaignId)
  if (!campaign) return { error: 'Campaign not found.' }
  const deliveries = await listMarketingDeliveriesForCampaignFromPg(campaignId, 200)
  return { ok: true as const, campaign, deliveries }
}

export async function previewMarketingMessageRender(input: {
  partnerId: string
  conversationId: string
  templateBodyChat: string
  offerPercent?: number | null
}) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerStaffGate(auth.user.id, input.partnerId, 'marketing_campaigns')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const partners = await fetchMessagingPartnersByIdsFromPg([input.partnerId])
  const partner = partners?.[0]
  if (!partner?.slug) return { error: 'Partner not found.' }

  const recipients = await listMarketingSegmentRecipientsFromPg({
    partnerId: input.partnerId,
    daysSinceChat: 365,
    limit: 5000,
  })
  const recipient = recipients.find((r) => r.conversation_id === input.conversationId)
  if (!recipient) return { error: 'Sample not in segment.' }

  const ctx = await buildMarketingRenderContext({
    partnerId: input.partnerId,
    shopName: partner.display_name?.trim() || 'Shop',
    shopSlug: partner.slug,
    offerPercent: input.offerPercent ?? null,
    recipient,
    appOrigin: getPublicAppUrlForServer(),
  })
  const body = renderMarketingTemplate(input.templateBodyChat, ctx)
  return { ok: true as const, body, label: formatSegmentRecipientLabel(recipient) }
}

export async function getMarketingOptOutCount(partnerId: string) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerStaffGate(auth.user.id, partnerId, 'marketing_campaigns')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const count = await countMarketingOptOutForPartnerFromPg(partnerId)
  return { ok: true as const, count }
}

export async function sendMarketingTestEmail(input: {
  partnerId: string
  toEmail: string
  offerPercent?: number | null
  emailIntro?: string | null
}) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerStaffGate(auth.user.id, input.partnerId, 'marketing_campaigns')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }
  if (!isSmtpConfigured()) return { error: 'SMTP_NOT_CONFIGURED' }

  const to = input.toEmail.trim().toLowerCase()
  if (!isValidEmailAddress(to)) return { error: 'INVALID_EMAIL' }

  const partners = await fetchMessagingPartnersByIdsFromPg([input.partnerId])
  const partner = partners?.[0]
  if (!partner?.slug) return { error: 'Partner not found.' }
  const shopName = partner.display_name?.trim() || 'Shop'
  const origin = getPublicAppUrlForServer()

  // Email test chỉ gửi tới khách đã từng nhắn tin với shop (để test đúng dữ liệu thật).
  const recipient = await findMarketingRecipientByEmailForPartnerFromPg(input.partnerId, to)
  if (!recipient) return { error: 'EMAIL_NOT_CUSTOMER' }

  const conv = await fetchCustomerCareConversationByIdPg(recipient.conversation_id)

  const ctx = await buildMarketingRenderContext({
    partnerId: input.partnerId,
    shopName,
    shopSlug: partner.slug,
    offerPercent: input.offerPercent ?? null,
    recipient,
    appOrigin: origin,
  })

  const products = await fetchMarketingInterestProducts({
    partnerId: input.partnerId,
    recipient,
    maxProducts: 2,
  })

  const chatUrl = conv
    ? await buildOfflineReplyAutoLoginChatUrl({
        partnerId: input.partnerId,
        slug: partner.slug,
        email: to,
        conversation: conv,
      })
    : `${origin.replace(/\/$/, '')}/messaging/p/${encodeURIComponent(partner.slug)}`

  const optOutUrl = buildMarketingOptOutUrl({
    appOrigin: origin,
    slug: partner.slug,
    payload: { partnerId: input.partnerId, recipientKey: recipient.recipient_key, email: to },
  })

  const { subject, text, html, listUnsubscribe } = formatMarketingCampaignEmailContent({
    shopDisplayName: shopName,
    customerName: ctx.customerName,
    chatUrl,
    optOutUrl,
    products,
    offerPercent: input.offerPercent ?? null,
    emailIntro: input.emailIntro ?? null,
    metadata: conv?.metadata ?? null,
  })

  const sent = await sendSmtpMail({
    to,
    subject: `[TEST] ${subject}`,
    text,
    html,
    fromName: shopName,
    listUnsubscribe,
  })
  if (!sent.ok) return { error: `SEND_FAILED:${sent.error}` }
  return { ok: true as const, to, productCount: products.length }
}

export async function countMarketingSegmentForPartner(partnerId: string, segmentJson: MarketingSegmentJson) {
  const auth = await requireUser()
  if ('error' in auth) return { error: auth.error }
  const gate = await assertPartnerStaffGate(auth.user.id, partnerId, 'marketing_campaigns')
  if ('error' in gate) return { error: gate.error }
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set.' }

  const seg = normalizeMarketingSegmentJson(segmentJson)
  const rules = segmentRulesFromJson(seg)
  const count = await countMarketingSegmentRecipientsFromPg({
    partnerId,
    daysSinceChat: rules.daysSinceChat,
    requireHasOrder: rules.requireHasOrder,
  })
  return { ok: true as const, count, segment: seg }
}
