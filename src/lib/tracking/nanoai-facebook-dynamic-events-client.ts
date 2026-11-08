'use client'

import {
  buildNanoAiFacebookDynamicCustomData,
  sanitizeNanoAiFacebookSearchString,
  type NanoAiFacebookDynamicEvent,
} from '@/lib/tracking/nanoai-facebook-dynamic-events'
import { fireMetaStandardEvent } from '@/lib/tracking/meta-standard-events-client'

/** Pixel + CAPI, cùng event id. Không bắn khi thiếu mã catalog. */
export function fireNanoAiFacebookDynamicEvent(input: {
  event: NanoAiFacebookDynamicEvent
  contentId: string
  contentName: string
  valueVnd: number
  searchString?: string
  orderId?: string
  quantity?: number
  category?: string
  dedupeKey?: string
  skipDedupe?: boolean
  eventId?: string
}): boolean {
  const contentId = String(input.contentId || '').trim()
  if (!contentId && input.event !== 'Search') return false
  if (input.event === 'Search' && !sanitizeNanoAiFacebookSearchString(input.searchString || '')) return false
  const customData = buildNanoAiFacebookDynamicCustomData(input)
  return fireMetaStandardEvent(input.event, {
    dedupeKey: input.dedupeKey,
    skipDedupe: input.skipDedupe,
    eventId: input.eventId,
    customData,
  })
}
