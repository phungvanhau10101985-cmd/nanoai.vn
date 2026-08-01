export const PARTNER_OUTBOUND_WEBHOOK_EVENTS = [
  'order.created',
  'lead.created',
  'payment.paid',
] as const

export type PartnerOutboundWebhookEvent = (typeof PARTNER_OUTBOUND_WEBHOOK_EVENTS)[number]

export type PartnerOutboundWebhookTestEvent = 'webhook.test'

export type PartnerOutboundWebhookAnyEvent =
  | PartnerOutboundWebhookEvent
  | PartnerOutboundWebhookTestEvent
