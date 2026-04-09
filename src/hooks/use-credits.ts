'use client'

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { trackEvent, setPendingGeneration, toFeatureFromRoute } from '@/lib/analytics-track'
import { subscribeToUrlChanges } from '@/lib/client-history-navigation'

export function useCredits() {
  const [credits, setCredits] = useState<number>(0)
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
        return
      }
      const j = (await res.json()) as { balance?: number }
      setCredits(Number(j.balance ?? 0))
    } catch {
      setCredits(0)
    }
  }, [])

  useEffect(() => {
    void fetchCredits()
    const onUpdated = () => void fetchCredits()
    window.addEventListener('credits-updated', onUpdated)
    return () => window.removeEventListener('credits-updated', onUpdated)
  }, [fetchCredits])

  /** Kiểm tra đủ credits trước khi thực hiện. Nếu thiếu thì toast và return false. */
  function checkCreditsAndProceed(requiredCost: number, onSuccess: () => void | Promise<void>): boolean {
    const route =
      pathname ||
      (typeof window !== 'undefined' ? window.location.pathname || '' : '')
    if (credits < requiredCost) {
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

  return { credits, fetchCredits, checkCreditsAndProceed }
}
