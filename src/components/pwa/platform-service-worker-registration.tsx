'use client'

import { useEffect } from 'react'

/**
 * The platform PWA worker is intentionally registered only on NanoAI-owned
 * surfaces. Partner storefronts register their tenant-specific worker instead.
 */
export function PlatformServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      /* PWA remains optional when worker registration is unavailable. */
    })
  }, [])

  return null
}
