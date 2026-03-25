'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { REFERRAL_STORAGE_KEY, parseReferrerUuid } from '@/lib/referral'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { DEFAULT_WEB_LOCALE, type WebLocale } from '@/lib/i18n/config'

const SILENT_RPC_ERRORS = new Set([
  'already_claimed',
  'account_too_old',
  'invalid_inviter',
  'missing_inviter',
  'no_invitee',
  'not_authenticated',
  'self_referral',
])

function localeFromCookie(): WebLocale {
  if (typeof document === 'undefined') return DEFAULT_WEB_LOCALE
  const cookieValue = document.cookie
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('nanoai_locale='))
    ?.split('=')[1]
    ?.trim()
    .toLowerCase()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') {
    return cookieValue
  }
  return 'vi'
}

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
      let inviterRaw: string | null = null
      try {
        inviterRaw = localStorage.getItem(REFERRAL_STORAGE_KEY)
      } catch {
        return
      }
      const inviterId = parseReferrerUuid(inviterRaw)
      if (!inviterId) return

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      if (user.id === inviterId) {
        try {
          localStorage.removeItem(REFERRAL_STORAGE_KEY)
        } catch {
          /* ignore */
        }
        return
      }

      inFlightRef.current = true

      const locale = localeFromCookie()
      const t = getDictionary(locale).referral

      try {
        const res = await fetch('/api/referral/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviterId }),
        })
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>

        const clearRef = res.ok || (res.status >= 400 && res.status < 500 && res.status !== 401)
        if (clearRef) {
          try {
            localStorage.removeItem(REFERRAL_STORAGE_KEY)
          } catch {
            /* ignore */
          }
        }
        if (!res.ok && res.status >= 500) {
          return
        }

        if (json?.ok === true && json?.applied === true) {
          window.dispatchEvent(new Event('credits-updated'))
          toastRef.current({
            title: t.toastApplied,
            description: t.toastAppliedHint,
            duration: 4500,
          })
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

    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) void run()
    })

    return () => subscription.unsubscribe()
  }, [])

  return null
}
