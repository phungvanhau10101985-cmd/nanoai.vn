'use client'

import { useEffect } from 'react'
import { REFERRAL_STORAGE_KEY, REFERRAL_STORAGE_KEY_LEGACY, parseReferrerUuid } from '@/lib/referral'

/**
 * Đọc ?ref= hoặc ?invite= trên URL (client), lưu UUID người mời vào localStorage.
 */
export function ReferralCapture() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const params = new URLSearchParams(window.location.search)
      const id = parseReferrerUuid(params.get('ref') || params.get('invite'))
      if (!id) return
      localStorage.setItem(REFERRAL_STORAGE_KEY, id)
      localStorage.setItem(REFERRAL_STORAGE_KEY_LEGACY, id)
      if (params.has('ref') || params.has('invite')) {
        const url = new URL(window.location.href)
        url.searchParams.delete('ref')
        url.searchParams.delete('invite')
        const next = `${url.pathname}${url.search}${url.hash}`
        window.history.replaceState(null, '', next)
      }
    } catch {
      /* ignore quota / private mode */
    }
  }, [])

  return null
}
