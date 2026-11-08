'use client'

import { isLikelyBotTraffic } from '@/lib/analytics-bot-filter'
import { buildNanoAiDynamicRemarketingPage } from '@/lib/tracking/nanoai-platform-dynamic-remarketing'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    __nanoPlatformGoogleAdsId?: string
    __nanoPlatformGaId?: string
  }
}

/** Một page_view gửi thẳng vào AW, kèm id trang. Không gửi `value` để không đổi giá trị chuyển đổi lượt xem trang. */
export function fireNanoAiDynamicRemarketingPageView(pathname: string, matchedFeature: string | null): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  if (isLikelyBotTraffic() || window.top !== window.self) return
  const aw = String(window.__nanoPlatformGoogleAdsId || '').trim().toUpperCase()
  if (!/^AW-[A-Z0-9]+$/.test(aw)) return
  const page = buildNanoAiDynamicRemarketingPage(pathname, matchedFeature)
  const item: Record<string, unknown> = {
    id: page.contentId,
    item_id: page.contentId,
    google_business_vertical: 'custom',
    quantity: 1,
  }
  if (page.valueVnd > 0) item.price = page.valueVnd
  const body: Record<string, unknown> = {
    send_to: aw,
    ecomm_pagetype: page.pagetype,
    ecomm_prodid: page.contentId,
    items: [item],
  }
  if (page.valueVnd > 0) body.ecomm_totalvalue = page.valueVnd
  window.gtag('event', 'page_view', body)
}
