'use client'

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { trackEvent, setPendingGeneration, toFeatureFromRoute } from '@/lib/analytics-track'
import { subscribeToUrlChanges } from '@/lib/client-history-navigation'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'

export function useCredits() {
  const [credits, setCredits] = useState<number>(0)
  const [guestTrialRemaining, setGuestTrialRemaining] = useState<number>(0)
  const [guestTrialBudget, setGuestTrialBudget] = useState<number>(0)
  const [pathname, setPathname] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    const sync = () => {
      if (typeof window === 'undefined') return
      setPathname(window.location.pathname || '')
    }
    sync()
    return subscribeToUrlChanges(sync)
  }, [])

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch('/api/account/credits', { credentials: 'same-origin' })
      if (!res.ok) {
        setCredits(0)
        setGuestTrialRemaining(0)
        return
      }
      const j = (await res.json()) as { balance?: number; guestTrialRemaining?: number; guestTrialBudget?: number }
      setCredits(Number(j.balance ?? 0))
      setGuestTrialRemaining(Math.max(0, Number(j.guestTrialRemaining ?? 0)))
      setGuestTrialBudget(Math.max(0, Number(j.guestTrialBudget ?? 0)))
    } catch {
      setCredits(0)
      setGuestTrialRemaining(0)
      setGuestTrialBudget(0)
    }
  }, [])

  useEffect(() => {
    void fetchCredits()
    const onUpdated = () => void fetchCredits()
    window.addEventListener('credits-updated', onUpdated)
    return () => window.removeEventListener('credits-updated', onUpdated)
  }, [fetchCredits])

  function redirectToLoginForTrialExhausted(route: string): void {
    if (typeof window === 'undefined') return
    const next = sanitizeLoginNext(`${route || window.location.pathname || '/'}${window.location.search || ''}`)
    window.location.assign(`/auth/login?next=${encodeURIComponent(next)}`)
  }

  /** Kiểm tra đủ credits trước khi thực hiện. Nếu thiếu thì toast và return false. */
  function checkCreditsAndProceed(requiredCost: number, onSuccess: () => void | Promise<void>): boolean {
    const route =
      pathname ||
      (typeof window !== 'undefined' ? window.location.pathname || '' : '')
    if (credits < requiredCost) {
      if (guestTrialRemaining >= requiredCost) {
        const feature = toFeatureFromRoute(route)
        setPendingGeneration({
          route,
          feature,
          requiredCost,
          startedAt: Date.now(),
        })
        trackEvent('generate_start', {
          route,
          feature,
          required_cost: requiredCost,
          available_credits: credits,
          guest_trial_remaining: guestTrialRemaining,
        })
        void onSuccess()
        return true
      }
      if (guestTrialBudget > 0) {
        trackEvent('generate_failed', {
          route,
          feature: toFeatureFromRoute(route),
          reason: 'guest_trial_exhausted',
          required_cost: requiredCost,
          guest_trial_remaining: guestTrialRemaining,
        })
        redirectToLoginForTrialExhausted(route)
        return false
      }
      trackEvent('generate_failed', {
        route,
        feature: toFeatureFromRoute(route),
        reason: 'insufficient_credits',
        required_cost: requiredCost,
        available_credits: credits,
      })
      toast({
        title: 'Thiếu credits',
        description: `Cần ${requiredCost.toLocaleString('vi-VN')} credits, hiện có ${credits.toLocaleString('vi-VN')}. Vui lòng nạp thêm.`,
        variant: 'destructive',
        duration: 5000,
      })
      return false
    }
    const feature = toFeatureFromRoute(route)
    setPendingGeneration({
      route,
      feature,
      requiredCost,
      startedAt: Date.now(),
    })
    trackEvent('generate_start', {
      route,
      feature,
      required_cost: requiredCost,
      available_credits: credits,
    })
    void onSuccess()
    return true
  }

  return { credits, fetchCredits, checkCreditsAndProceed, guestTrialRemaining, guestTrialBudget }
}
