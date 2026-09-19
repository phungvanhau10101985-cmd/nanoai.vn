'use client'

import { useLayoutEffect } from 'react'
import { parseVisualDeviceQuery } from '@/lib/partner-website/visual-editor/visual-editor-pages'
import {
  persistPartnerLiveVisualDeviceCookie,
  resolveLiveVisualDeviceFromViewport,
} from '@/lib/partner-website/shop/infer-live-visual-request-device'

/**
 * Remember the live machine in a cookie so the *next* navigation serves that HTML file.
 * Never `location.reload` — an open deposit / editor / cart tab must stay put.
 */
export function PartnerSiteLiveDeviceCookieSync({ locked = false }: { locked?: boolean }) {
  useLayoutEffect(() => {
    if (locked) return
    if (parseVisualDeviceQuery(new URLSearchParams(window.location.search).get('pw-device') || '')) {
      return
    }
    const apply = () => {
      const device = resolveLiveVisualDeviceFromViewport({
        userAgent: navigator.userAgent || '',
        innerWidth: window.innerWidth || document.documentElement.clientWidth || 0,
        outerWidth: window.outerWidth || 0,
        screenWidth: Math.max(window.screen?.width || 0, window.screen?.availWidth || 0),
        devicePixelRatio: window.devicePixelRatio || 0,
        maxTouchPoints: navigator.maxTouchPoints || 0,
      })
      persistPartnerLiveVisualDeviceCookie(device, navigator.userAgent || '')
      const html = document.documentElement
      if (!html.getAttribute('data-pw-scene-lock') && !html.getAttribute('data-pw-edit-device')) {
        html.setAttribute('data-pw-scene-lock', device)
      }
    }
    apply()
    let timer = 0
    const onResize = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(apply, 400)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', onResize)
    }
  }, [locked])
  return null
}
