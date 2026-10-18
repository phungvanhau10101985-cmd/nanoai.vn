'use client'

import { nanoAiFeatureRemarketing } from '@/lib/catalog/nanoai-feature-remarketing'
import { broadcastNanoAiCommerce } from '@/lib/tracking/nanoai-platform-commerce-client'

/** Xem một tính năng: Facebook + Google + TikTok, id khớp nguồn cấp dữ liệu. */
export function trackNanoAiFeatureView(href: string, contentName: string): boolean {
  const { contentId, valueVnd } = nanoAiFeatureRemarketing(href)
  return broadcastNanoAiCommerce({
    event: 'ViewContent',
    contentId,
    contentName: contentName.trim() || contentId,
    valueVnd,
    skipDedupe: true,
    extra: { feature_route: href },
  })
}
