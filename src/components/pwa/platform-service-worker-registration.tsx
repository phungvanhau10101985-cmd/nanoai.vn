'use client'

import { useEffect } from 'react'
import { unregisterAllServiceWorkers } from '@/lib/pwa/unregister-service-workers'

/**
 * The platform PWA worker is intentionally registered only on NanoAI-owned
 * surfaces. Partner storefronts register their tenant-specific worker instead.
 *
 * Never register in `next dev`: leftover `public/sw.js` from a production build
 * precaches a stale `_buildManifest` hash that does not exist in `.next-dev`.
 */
export function PlatformServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') {
      void unregisterAllServiceWorkers()
      return
    }
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      /* PWA remains optional when worker registration is unavailable. */
    })
  }, [])

  return null
}
