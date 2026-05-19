'use client'

import { useEffect } from 'react'
import { isLikelyBotTraffic } from '@/lib/analytics-bot-filter'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
    __nanoShopGa4MeasurementId?: string
  }
}

function ensureShopGtagLoaded(measurementId: string): void {
  window.dataLayer = window.dataLayer || []
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args)
    }
    window.gtag('js', new Date())
  }

  const scriptId = `shop-gtag-js-${measurementId}`
  if (document.getElementById(scriptId)) return
  const script = document.createElement('script')
  script.id = scriptId
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
  document.head.appendChild(script)
}

/**
 * Trang khách hàng tự nạp GA4 của shop, không phụ thuộc GA/GTM toàn cục của NanoAI.
 */
export function PartnerGuestGa4Config({ measurementId }: { measurementId: string | null | undefined }) {
  useEffect(() => {
    const id = typeof measurementId === 'string' ? measurementId.trim() : ''
    if (!id || !/^G-[A-Z0-9]+$/i.test(id)) return
    if (isLikelyBotTraffic()) return

    window.__nanoShopGa4MeasurementId = id.toUpperCase()
    ensureShopGtagLoaded(id)
    window.gtag?.('config', id, { send_page_view: true })
  }, [measurementId])

  return null
}
