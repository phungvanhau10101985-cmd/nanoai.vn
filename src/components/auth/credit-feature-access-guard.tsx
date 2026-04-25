'use client'

import { useEffect, useRef } from 'react'
import { subscribeToUrlChanges } from '@/lib/client-history-navigation'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'
import { isCreditTrialRoute } from '@/lib/credit-trial-routes'

async function enforceCreditFeatureAccess(pathnameWithQuery: string): Promise<void> {
  if (typeof window === 'undefined') return
  const [pathname = '/'] = pathnameWithQuery.split('?', 1)
  if (!isCreditTrialRoute(pathname)) return
  const res = await fetch('/api/account/credits', { credentials: 'same-origin', cache: 'no-store' })
  if (res.status !== 401) return
  const next = sanitizeLoginNext(pathnameWithQuery || '/')
  window.location.assign(`/auth/login?next=${encodeURIComponent(next)}`)
}

export function CreditFeatureAccessGuard() {
  const inFlight = useRef(false)
  const lastChecked = useRef<string>('')

  useEffect(() => {
    const checkCurrentRoute = async () => {
      if (typeof window === 'undefined') return
      const pathWithQuery = `${window.location.pathname || '/'}${window.location.search || ''}`
      if (lastChecked.current === pathWithQuery || inFlight.current) return
      inFlight.current = true
      try {
        await enforceCreditFeatureAccess(pathWithQuery)
        lastChecked.current = pathWithQuery
      } catch {
        // Ignore transient failure; API calls still re-check auth on action submit.
      } finally {
        inFlight.current = false
      }
    }
    void checkCurrentRoute()
    return subscribeToUrlChanges(() => {
      void checkCurrentRoute()
    })
  }, [])

  return null
}
