'use client'

import { useEffect, useRef } from 'react'
import { unregisterAllServiceWorkers } from '@/lib/pwa/unregister-service-workers'

/**
 * Sau mỗi deploy, service worker mới activate → `controllerchange`.
 * Reload một lần để tab không giữ JS/HTML phiên bản cũ.
 * Bỏ qua lần đầu (cài SW lần đầu trên tab — chưa có controller trước đó).
 *
 * Trong development (localhost, LAN, ngrok): luôn gỡ SW leftover từ bản production.
 */
export function SwUpdateReload() {
  const skipFirstActivate = useRef(
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator && !navigator.serviceWorker.controller
  )

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      void unregisterAllServiceWorkers()
      return
    }
    if (!('serviceWorker' in navigator)) return

    let reloading = false
    const onControllerChange = () => {
      if (reloading) return
      if (skipFirstActivate.current) {
        skipFirstActivate.current = false
        return
      }
      reloading = true
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
  }, [])

  return null
}
