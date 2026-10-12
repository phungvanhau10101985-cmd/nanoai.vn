import { classifyWidgetInboundIntent } from '@/lib/messaging/partner-ai-widget-intent-classifier'
import type { PartnerAiRouteDecision } from '@/lib/messaging/partner-ai-intent-router'

/** Mỗi ngành một cửa nhận định. Không gom shop CNTT vào prompt bán hàng thời trang. */
export type ShopIndustryIntentBranch = 'fashion' | 'it' | 'hotel' | 'food' | 'machinery' | 'other'

export function shopIndustryIntentBranch(
  industryKey: string | null | undefined
): ShopIndustryIntentBranch {
  if (
    industryKey === 'fashion' ||
    industryKey === 'it' ||
    industryKey === 'hotel' ||
    industryKey === 'food' ||
    industryKey === 'machinery'
  ) {
    return industryKey
  }
  return 'other'
}

/**
 * Thời trang giữ nguyên classifier bán hàng.
 * CNTT và khách sạn không gọi classifier đó.
 * Food / máy móc / ngành khác vẫn gọi classifier hiện có, trong nhánh riêng, cho đến khi có prompt của ngành đó.
 */
export async function classifyInboundForShopIndustry(input: {
  industryKey: string | null | undefined
  partnerId: string
  customerText: string
  lastShopMessage: string | null
}): Promise<PartnerAiRouteDecision | null> {
  const branch = shopIndustryIntentBranch(input.industryKey)
  if (branch === 'it' || branch === 'hotel') return null
  const payload = {
    partnerId: input.partnerId,
    customerText: input.customerText,
    lastShopMessage: input.lastShopMessage,
  }
  if (branch === 'fashion') return classifyWidgetInboundIntent(payload)
  if (branch === 'food') return classifyWidgetInboundIntent(payload)
  if (branch === 'machinery') return classifyWidgetInboundIntent(payload)
  return classifyWidgetInboundIntent(payload)
}
