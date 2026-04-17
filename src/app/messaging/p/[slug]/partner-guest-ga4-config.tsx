'use client'

import { useEffect } from 'react'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

/**
 * Gửi thêm `gtag('config', shopMeasurementId)` trên trang tư vấn để chủ shop xem Realtime trong GA4.
 * Layout gốc có thể đã tải gtag — chỉ thêm property thứ hai.
 */
export function PartnerGuestGa4Config({ measurementId }: { measurementId: string | null | undefined }) {
  useEffect(() => {
    const id = typeof measurementId === 'string' ? measurementId.trim() : ''
    if (!id || !/^G-[A-Z0-9]+$/i.test(id)) return

    const run = () => {
      if (typeof window.gtag !== 'function') return false
      window.gtag('config', id, { send_page_view: true })
      return true
    }

    if (run()) return

    let n = 0
    const max = 200
    const t = window.setInterval(() => {
      n += 1
      if (run() || n >= max) window.clearInterval(t)
    }, 50)

    return () => window.clearInterval(t)
  }, [measurementId])

  return null
}
