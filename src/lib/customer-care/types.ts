export type CustomerCareChannel = 'facebook' | 'zalo' | 'internal' | 'widget'

export type InboundNormalized = {
  channel: CustomerCareChannel
  externalUserId: string
  text: string
  customerName?: string | null
  raw: Record<string, unknown>
  /** Facebook Page ID (webhook entry.id) — chỉ kênh facebook */
  facebookPageId?: string
}
