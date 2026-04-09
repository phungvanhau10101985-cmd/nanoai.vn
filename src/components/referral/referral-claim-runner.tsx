'use client'

import { useEffect, useRef } from 'react'
import { getClientUserId } from '@/lib/auth/get-client-user-id'
import { useToast } from '@/hooks/use-toast'
import {
  clearReferrerFromLocalStorage,
  readReferrerIdFromLocalStorage,
} from '@/lib/referral'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

const SILENT_RPC_ERRORS = new Set([
  'already_claimed',
  'account_too_old',
  'invalid_inviter',
  'missing_inviter',
  'no_invitee',
  'not_authenticated',
  'self_referral',
])

/**
 * Sau khi đăng nhập: nếu có mã mời trong localStorage thì gọi API claim (một lần / phiên).
 */
export function ReferralClaimRunner() {
  const { toast } = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const run = async () => {
      if (inFlightRef.current) return
      const inviterId = readReferrerIdFromLocalStorage()
      if (!inviterId) return

      const uid = await getClientUserId()
      if (!uid) return

      if (uid === inviterId) {
        clearReferrerFromLocalStorage()
        return
      }

      inFlightRef.current = true

      const locale = readWebLocaleFromDocumentCookie()
      const t = getDictionary(locale).referral

      try {
        const res = await fetch('/api/referral/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviterId }),
        })
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>

        const clearRef = res.ok || (res.status >= 400 && res.status < 500 && res.status !== 401)
        if (clearRef) clearReferrerFromLocalStorage()
        if (!res.ok && res.status >= 500) {
          return
        }

        if (json?.ok === true && json?.applied === true) {
          return
        }
        if (json?.ok === true && json?.applied === false && json?.reason === 'already_claimed') {
          return
        }
        if (json?.error === 'self_referral') {
          return
        }
        if (json?.ok === false) {
          const err = typeof json.error === 'string' ? json.error : ''
          if (SILENT_RPC_ERRORS.has(err)) return
          toastRef.current({ title: t.errorGeneric, variant: 'destructive', duration: 4000 })
        }
      } catch {
        /* network — giữ localStorage để thử lại sau */
      } finally {
        inFlightRef.current = false
      }
    }

    void run()
  }, [])

  return null
}
