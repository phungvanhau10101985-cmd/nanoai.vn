'use client'

import { useEffect, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

/**
 * Đọc locale từ cookie trên client, cập nhật khi tab focus / visibility — không poll 1s
 * (tránh re-render định kỳ trên toàn trang / overlay ảnh).
 */
export function useWebLocaleFromDocumentCookie(): WebLocale {
  const [locale, setLocale] = useState<WebLocale>(() => readWebLocaleFromDocumentCookie())
  useEffect(() => {
    const sync = () => {
      const next = readWebLocaleFromDocumentCookie()
      setLocale((prev) => (prev === next ? prev : next))
    }
    sync()
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])
  return locale
}
