import type { Json } from '@/types/database.types'
import { postWidgetHospitalityGuestMessage } from '@/lib/hospitality/post-widget-hospitality-message'

export async function postHospitalityGuestMessage(params: {
  partnerId: string
  externalThreadId: string
  linkedUserId?: string | null
  customerName: string
  metadata: Json
  uiLocale?: string | null
  text?: string
  imageStoragePath?: string
  autoOpening?: boolean
  landingSourceUrl?: string | null
  pageContext?: {
    inventoryId?: string
    source?: string
    checkinAt?: string
    checkoutAt?: string
  }
}): Promise<
  | { ok: true; shopTyping?: { maxWaitMs: number } }
  | { error: string; requireAuth?: boolean }
> {
  const text = String(params.text ?? '').trim()
  if (!text) return { error: 'Invalid message.' }
  if (params.imageStoragePath?.trim()) {
    return { error: 'Hospitality chat currently supports text messages only.' }
  }

  return postWidgetHospitalityGuestMessage({
    partnerId: params.partnerId,
    externalThreadId: params.externalThreadId,
    linkedUserId: params.linkedUserId ?? null,
    customerName: params.customerName,
    metadata: params.metadata,
    uiLocale: params.uiLocale ?? null,
    text,
    landingSourceUrl: params.landingSourceUrl ?? null,
    autoOpening: params.autoOpening,
    pageContext: params.pageContext
      ? {
          roomTypeId: typeof params.pageContext.inventoryId === 'string' ? params.pageContext.inventoryId : undefined,
          checkinAt: typeof params.pageContext.checkinAt === 'string' ? params.pageContext.checkinAt : undefined,
          checkoutAt: typeof params.pageContext.checkoutAt === 'string' ? params.pageContext.checkoutAt : undefined,
          source: params.pageContext.source,
        }
      : undefined,
  })
}
