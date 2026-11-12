'use client'

import { useEffect } from 'react'
import { isLikelyBotTraffic } from '@/lib/analytics-bot-filter'
import { classifyWeddingAdSource, weddingAdVisitShouldIgnore } from '@/lib/wedding/wedding-ad-source'

/** Ghi một lượt khi khách mở thiệp đã xuất bản từ Facebook, TikTok hoặc Google Ads. */
export function WeddingCardTrafficBeacon({ cardId }: { cardId: string }) {
  useEffect(() => {
    if (!cardId) return
    if (window.top !== window.self) return
    if (isLikelyBotTraffic()) return
    const search = window.location.search || ''
    if (weddingAdVisitShouldIgnore(search)) return
    const source = classifyWeddingAdSource(search, document.referrer || '')
    if (!source) return
    const storageKey = `pw-thiep-ad:${cardId}:${source}`
    try {
      if (window.sessionStorage.getItem(storageKey)) return
      window.sessionStorage.setItem(storageKey, '1')
    } catch {
      // Vẫn gửi một lần cho lần mở này.
    }
    const body = JSON.stringify({
      cardId,
      search: search.slice(0, 2000),
      referrer: (document.referrer || '').slice(0, 500),
    })
    fetch('/api/thiep-moi-cuoi/ad-visit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => {})
  }, [cardId])

  return null
}
