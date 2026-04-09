'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useEffect } from 'react'

/** Locale UI trình chiếu học sinh (cookie web) — dùng chung file nhỏ, không gắn logic giáo trình/phiếu. */
export function getWebLocale(): 'vi' | 'en' | 'zh' | 'ja' | 'ko' {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = readWebLocaleFromDocumentCookie()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

export function tr(locale: string, vi: string, en: string, zh: string, ja: string, ko: string) {
  if (locale === 'en') return en
  if (locale === 'zh') return zh
  if (locale === 'ja') return ja
  if (locale === 'ko') return ko
  return vi
}

export function useOpenerFullscreenOnMount() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.opener) return
    const req =
      document.documentElement.requestFullscreen ??
      (document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen
    if (req) {
      const t = setTimeout(() => req.call(document.documentElement).catch(() => {}), 300)
      return () => clearTimeout(t)
    }
  }, [])
}
