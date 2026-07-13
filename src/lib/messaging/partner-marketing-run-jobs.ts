import { fetchCustomerCareConversationByIdPg, insertMessagePg } from '@/lib/db/customer-care-pg'
import {
  completeMarketingCampaignFromPg,
  countPendingMarketingDeliveriesFromPg,
  fetchConversationForMarketingDeliveryFromPg,
  fetchPendingMarketingDeliveriesFromPg,
  fetchRunningOrQueuedMarketingCampaignFromPg,
  hasRecentMarketingSentSlotFromPg,
  markMarketingDeliveryFailedFromPg,
  markMarketingDeliverySentChatEmailFromPg,
  markMarketingDeliverySentChatFromPg,
  markMarketingDeliverySkippedFromPg,
  tryClaimMarketingSentSlotFromPg,
  type MarketingCampaignRow,
} from '@/lib/db/messaging-partner-marketing-campaigns-pg'
import { fetchMessagingPartnersByIdsFromPg } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { getPublicAppUrlForServer } from '@/lib/auth/public-app-url'
import {
  buildMarketingRenderContext,
  renderMarketingTemplate,
} from '@/lib/messaging/partner-marketing-render'
import { sendMarketingEmailForDelivery } from '@/lib/messaging/partner-marketing-email'
import { MARKETING_CAMPAIGN_COOLDOWN_DAYS } from '@/lib/messaging/partner-marketing-segment'

const BATCH_SIZE = 25
const DELAY_MS_BETWEEN_RECIPIENTS = 2000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type MarketingCampaignRunResult = {
  campaignId: string | null
  processed: number
  sentChat: number
  sentEmail: number
  skipped: number
  failed: number
  completed: boolean
}

async function processDelivery(
  campaign: MarketingCampaignRow,
  deliveryId: string,
  conversationId: string | null,
  recipientKey: string,
  shopSlug: string,
  shopDisplayName: string,
  senderAdminId: string | null
): Promise<'sent' | 'sent_email' | 'skipped' | 'failed'> {
  if (!conversationId) {
    await markMarketingDeliverySkippedFromPg(deliveryId, 'no_conversation')
    return 'skipped'
  }

  const recent = await hasRecentMarketingSentSlotFromPg({
    partnerId: campaign.partner_id,
    recipientKey,
    withinDays: MARKETING_CAMPAIGN_COOLDOWN_DAYS,
  })
  if (recent) {
    await markMarketingDeliverySkippedFromPg(deliveryId, 'rate_limit')
    return 'skipped'
  }

  const claimed = await tryClaimMarketingSentSlotFromPg({
    partnerId: campaign.partner_id,
    recipientKey,
    campaignKey: campaign.id,
  })
  if (!claimed) {
    await markMarketingDeliverySkippedFromPg(deliveryId, 'dedup_campaign')
    return 'skipped'
  }

  const recipient = await fetchConversationForMarketingDeliveryFromPg(campaign.partner_id, conversationId)
  if (!recipient) {
    await markMarketingDeliverySkippedFromPg(deliveryId, 'not_in_segment')
    return 'skipped'
  }

  if (!recipient.customer_email?.trim()) {
    await markMarketingDeliverySkippedFromPg(deliveryId, 'no_email')
    return 'skipped'
  }

  const origin = getPublicAppUrlForServer()
  const ctx = await buildMarketingRenderContext({
    partnerId: campaign.partner_id,
    shopName: shopDisplayName,
    shopSlug,
    offerPercent: campaign.offer_percent,
    recipient,
    appOrigin: origin,
  })
  const body = renderMarketingTemplate(campaign.template_body_chat, ctx)
  if (!body.trim()) {
    await markMarketingDeliverySkippedFromPg(deliveryId, 'empty_body')
    return 'skipped'
  }

  const ins = await insertMessagePg({
    conversationId,
    direction: 'outbound',
    body,
    rawPayload: { marketing_campaign_id: campaign.id },
    senderAdminId,
  })
  if (!ins) {
    await markMarketingDeliveryFailedFromPg(deliveryId, 'insert_failed')
    return 'failed'
  }

  // Kênh phụ: email nhắc offline (chỉ khi campaign bật + khách đủ điều kiện an toàn).
  if (campaign.channel_email) {
    try {
      const conv = await fetchCustomerCareConversationByIdPg(conversationId)
      if (conv) {
        const emailRes = await sendMarketingEmailForDelivery({
          campaign,
          recipient,
          conversation: conv,
          shopSlug,
          shopDisplayName,
          customerName: ctx.customerName,
          appOrigin: origin,
        })
        if (emailRes.status === 'sent') {
          await markMarketingDeliverySentChatEmailFromPg({
            deliveryId,
            renderedBodyChat: body,
            renderedBodyEmail: emailRes.renderedBodyEmail,
            email: emailRes.email,
          })
          return 'sent_email'
        }
      }
    } catch (e) {
      console.warn('[processDelivery] email', e)
    }
  }

  await markMarketingDeliverySentChatFromPg(deliveryId, body)
  return 'sent'
}

export async function runPartnerMarketingCampaignBatch(): Promise<MarketingCampaignRunResult> {
  const empty: MarketingCampaignRunResult = {
    campaignId: null,
    processed: 0,
    sentChat: 0,
    sentEmail: 0,
    skipped: 0,
    failed: 0,
    completed: false,
  }
  if (!isPgConfigured()) return empty

  const campaign = await fetchRunningOrQueuedMarketingCampaignFromPg()
  if (!campaign) return empty

  const partners = await fetchMessagingPartnersByIdsFromPg([campaign.partner_id])
  const partner = partners?.[0]
  if (!partner?.slug) {
    await completeMarketingCampaignFromPg(campaign.id)
    return { ...empty, campaignId: campaign.id, completed: true }
  }

  const deliveries = await fetchPendingMarketingDeliveriesFromPg(campaign.id, BATCH_SIZE)
  if (!deliveries.length) {
    const pending = await countPendingMarketingDeliveriesFromPg(campaign.id)
    if (pending === 0) {
      await completeMarketingCampaignFromPg(campaign.id)
      return { ...empty, campaignId: campaign.id, completed: true }
    }
    return { ...empty, campaignId: campaign.id }
  }

  let sentChat = 0
  let sentEmail = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < deliveries.length; i++) {
    const d = deliveries[i]
    if (i > 0) await sleep(DELAY_MS_BETWEEN_RECIPIENTS)

    const result = await processDelivery(
      campaign,
      d.id,
      d.conversation_id,
      d.recipient_key,
      partner.slug,
      partner.display_name?.trim() || 'Shop',
      campaign.created_by_user_id
    )
    if (result === 'sent' || result === 'sent_email') {
      sentChat += 1
      if (result === 'sent_email') sentEmail += 1
    } else if (result === 'skipped') skipped += 1
    else failed += 1
  }

  const pendingAfter = await countPendingMarketingDeliveriesFromPg(campaign.id)
  const completed = pendingAfter === 0
  if (completed) {
    await completeMarketingCampaignFromPg(campaign.id)
  }

  return {
    campaignId: campaign.id,
    processed: deliveries.length,
    sentChat,
    sentEmail,
    skipped,
    failed,
    completed,
  }
}
