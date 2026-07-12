import type { Database } from '@/types/database.types'
import { isSmtpConfigured, sendSmtpMail } from '@/lib/email/smtp'
import {
  hasMarketingOptOutFromPg,
  hasRecentMarketingEmailSlotFromPg,
  tryClaimMarketingEmailSlotFromPg,
  type MarketingCampaignRow,
  type MarketingSegmentRecipientRow,
} from '@/lib/db/messaging-partner-marketing-campaigns-pg'
import {
  guestViewerIsLive,
  resolveCustomerEmailForConversation,
} from '@/lib/messaging/partner-reply-offline-customer-email'
import { buildOfflineReplyAutoLoginChatUrl } from '@/lib/messaging/offline-reply-magic-chat-link'
import { buildMarketingOptOutUrl } from '@/lib/messaging/marketing-opt-out-token'
import { fetchMarketingInterestProducts } from '@/lib/messaging/partner-marketing-render'
import { formatMarketingCampaignEmailContent } from '@/lib/messaging/partner-marketing-email-i18n'

type ConvRow = Database['public']['Tables']['customer_care_conversations']['Row']

/** Marketing email: tối đa 1 email / khách / 7 ngày (transactional không tính). */
export const MARKETING_EMAIL_COOLDOWN_DAYS = 7

export type MarketingEmailResult =
  | { status: 'sent'; email: string; renderedBodyEmail: string }
  | { status: 'skipped'; reason: string }

/**
 * Gửi email nhắc offline cho một recipient sau khi đã insert tin chat.
 * An toàn deliverability: chỉ khi khách offline, có email, chưa opt-out, chưa vượt cooldown.
 */
export async function sendMarketingEmailForDelivery(input: {
  campaign: MarketingCampaignRow
  recipient: MarketingSegmentRecipientRow
  conversation: ConvRow
  shopSlug: string
  shopDisplayName: string
  customerName: string
  appOrigin: string
}): Promise<MarketingEmailResult> {
  const { campaign, recipient, conversation } = input

  if (!campaign.channel_email) return { status: 'skipped', reason: 'email_off' }
  if (!isSmtpConfigured()) return { status: 'skipped', reason: 'smtp_off' }

  if (guestViewerIsLive(conversation.metadata)) {
    return { status: 'skipped', reason: 'live_on_chat' }
  }

  const email = await resolveCustomerEmailForConversation(conversation)
  if (!email) return { status: 'skipped', reason: 'no_email' }

  const optedOut = await hasMarketingOptOutFromPg({
    partnerId: campaign.partner_id,
    recipientKey: recipient.recipient_key,
    email,
  })
  if (optedOut) return { status: 'skipped', reason: 'opt_out' }

  const recentEmail = await hasRecentMarketingEmailSlotFromPg({
    partnerId: campaign.partner_id,
    recipientKey: recipient.recipient_key,
    withinDays: MARKETING_EMAIL_COOLDOWN_DAYS,
  })
  if (recentEmail) return { status: 'skipped', reason: 'email_rate_limit' }

  const claimed = await tryClaimMarketingEmailSlotFromPg({
    partnerId: campaign.partner_id,
    recipientKey: recipient.recipient_key,
    campaignId: campaign.id,
  })
  if (!claimed) return { status: 'skipped', reason: 'email_dedup' }

  const products = await fetchMarketingInterestProducts({
    partnerId: campaign.partner_id,
    recipient,
    maxProducts: 2,
  })

  const chatUrl = await buildOfflineReplyAutoLoginChatUrl({
    partnerId: campaign.partner_id,
    slug: input.shopSlug,
    email,
    conversation,
  })

  const optOutUrl = buildMarketingOptOutUrl({
    appOrigin: input.appOrigin,
    slug: input.shopSlug,
    payload: {
      partnerId: campaign.partner_id,
      recipientKey: recipient.recipient_key,
      email,
    },
  })

  const { subject, text, html, listUnsubscribe } = formatMarketingCampaignEmailContent({
    shopDisplayName: input.shopDisplayName,
    customerName: input.customerName,
    chatUrl,
    optOutUrl,
    products,
    offerPercent: campaign.offer_percent,
    emailIntro: campaign.template_body_email,
    metadata: conversation.metadata,
  })

  const sent = await sendSmtpMail({
    to: email,
    subject,
    text,
    html,
    fromName: input.shopDisplayName.trim() || undefined,
    listUnsubscribe,
  })
  if (!sent.ok) {
    return { status: 'skipped', reason: `email_send_failed:${sent.error}`.slice(0, 60) }
  }

  return { status: 'sent', email, renderedBodyEmail: text }
}
