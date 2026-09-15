'use client'

import { type DependencyList, useLayoutEffect } from 'react'
import { PW_SHOP_SOFT_NAV_EVENT } from '@/components/partner-website/shop/partner-site-soft-nav-relay'

/**
 * Run destination-page boot without waiting for a tap.
 *
 * `useEffect` is a passive effect (MessageChannel / idle). After App Router
 * navigation — especially a nested `startTransition` around `router.push` —
 * Safari and Chrome can delay those effects until the next user gesture.
 * Layout effect runs during commit. `pageshow` / visibility cover bfcache.
 */
export function usePartnerSitePageReadyEffect(effect: () => void | (() => void), deps: DependencyList): void {
  useLayoutEffect(() => {
    let cleanup: void | (() => void)
    const run = () => {
      if (typeof cleanup === 'function') cleanup()
      cleanup = effect()
    }
    run()
    const onWake = () => {
      if (document.visibilityState === 'hidden') return
      run()
    }
    window.addEventListener('pageshow', onWake)
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener(PW_SHOP_SOFT_NAV_EVENT, onWake)
    return () => {
      if (typeof cleanup === 'function') cleanup()
      window.removeEventListener('pageshow', onWake)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener(PW_SHOP_SOFT_NAV_EVENT, onWake)
    }
    // Caller owns identity of `effect` via deps (same pattern as order/deposit boot).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
