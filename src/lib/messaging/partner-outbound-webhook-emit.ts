import type { PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'
import type { PartnerWebsiteLeadRow } from '@/lib/db/partner-website-leads-pg'
import { mapPartnerOrderToHeadlessSnapshot } from '@/lib/messaging/partner-headless-order-mapper'
import { queuePartnerOutboundWebhook } from '@/lib/messaging/partner-outbound-webhook-dispatch'

export function emitPartnerOutboundLeadCreated(partnerId: string, lead: PartnerWebsiteLeadRow): void {
  queuePartnerOutboundWebhook(partnerId, 'lead.created', {
    lead_id: lead.id,
    site_slug: lead.siteSlug,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    message: lead.message,
    status: lead.status,
    created_at: lead.createdAt,
  })
}

export function emitPartnerOutboundOrderCreated(partnerId: string, order: PartnerOrderRow): void {
  queuePartnerOutboundWebhook(partnerId, 'order.created', {
    ...mapPartnerOrderToHeadlessSnapshot(order),
  })
}

export function emitPartnerOutboundPaymentPaid(partnerId: string, order: PartnerOrderRow): void {
  if (order.status !== 'paid_verified') return
  queuePartnerOutboundWebhook(partnerId, 'payment.paid', {
    ...mapPartnerOrderToHeadlessSnapshot(order),
    paid_amount: order.paid_amount,
    verified_at: order.verified_at,
  })
}
