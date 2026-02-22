'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { getCredits } from '@/lib/credits'
import { useToast } from '@/hooks/use-toast'
import { trackEvent, setPendingGeneration, toFeatureFromRoute } from '@/lib/analytics-track'

export function useCredits() {
  const [credits, setCredits] = useState<number>(0)
  const { toast } = useToast()
  const pathname = usePathname()

  const fetchCredits = useCallback(async () => {
    const bal = await getCredits()
    setCredits(bal)
  }, [])

  useEffect(() => {
    fetchCredits()
    const onUpdated = () => fetchCredits()
    window.addEventListener('credits-updated', onUpdated)
    return () => window.removeEventListener('credits-updated', onUpdated)
  }, [fetchCredits])

  /** Kiểm tra đủ credits trước khi thực hiện. Nếu thiếu thì toast và return false. */
  function checkCreditsAndProceed(requiredCost: number, onSuccess: () => void | Promise<void>): boolean {
    if (credits < requiredCost) {
      trackEvent('generate_failed', {
        route: pathname,
        feature: toFeatureFromRoute(pathname),
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
    const feature = toFeatureFromRoute(pathname)
    setPendingGeneration({
      route: pathname,
      feature,
      requiredCost,
      startedAt: Date.now(),
    })
    trackEvent('generate_start', {
      route: pathname,
      feature,
      required_cost: requiredCost,
      available_credits: credits,
    })
    void onSuccess()
    return true
  }

  return { credits, fetchCredits, checkCreditsAndProceed }
}
