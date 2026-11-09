'use client'

import { useEffect, useState } from 'react'

/** Máy Apple cho giáo trình trình chiếu. Windows luôn là `other` và không gắn attribute. */
export type AppleSlideDevice = 'ios' | 'mac' | 'other'

const STYLE_ID = 'apple-slide-shell-css'

const APPLE_SLIDE_CSS = `
[data-apple-slide='ios'],
[data-apple-slide='mac'] {
  top: var(--apple-slide-top, 0px) !important;
  bottom: auto !important;
  left: 0 !important;
  right: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
  height: var(--apple-slide-vh, 100dvh) !important;
  max-height: var(--apple-slide-vh, 100dvh) !important;
  padding-top: env(safe-area-inset-top);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  overscroll-behavior: none;
  -webkit-text-size-adjust: 100%;
}
[data-apple-slide='ios'] {
  touch-action: manipulation;
}
[data-apple-slide='ios'] input,
[data-apple-slide='ios'] textarea,
[data-apple-slide='ios'] select {
  font-size: 16px !important;
}
[data-apple-slide='ios'] button {
  touch-action: manipulation;
}
[data-apple-slide='ios'] button[data-control],
[data-apple-slide='ios'] [data-control] button {
  min-height: 44px;
}
[data-apple-slide='ios'] [data-infographic-toolbar] button {
  min-height: 36px;
  min-width: 36px;
}
[data-apple-slide='ios'] .overflow-y-auto,
[data-apple-slide='ios'] .overflow-y-scroll,
[data-apple-slide='mac'] .overflow-y-auto,
[data-apple-slide='mac'] .overflow-y-scroll {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
`.trim()

export function detectAppleSlideDevice(): AppleSlideDevice {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent || ''
  const platform = navigator.platform || ''
  const touchPoints = navigator.maxTouchPoints || 0
  const iPhone = /iPhone|iPod/.test(ua)
  const iPad = /iPad/.test(ua) || (platform === 'MacIntel' && touchPoints > 1)
  if (iPhone || iPad) return 'ios'
  const mac = /Mac/.test(platform) || /Macintosh|Mac OS X/.test(ua)
  if (mac) return 'mac'
  return 'other'
}

function ensureAppleSlideCss() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = APPLE_SLIDE_CSS
  document.head.appendChild(style)
}

export type AppleSlideShell = {
  ios: boolean
  mac: boolean
  shellProps: { 'data-apple-slide'?: 'ios' | 'mac' }
}

/**
 * Gắn sau khi mount để không lệch hydrate.
 * Windows không nhận `data-apple-slide`, nên class và kích thước cũ giữ nguyên.
 */
export function useAppleSlideShell(): AppleSlideShell {
  const [device, setDevice] = useState<AppleSlideDevice>('other')

  useEffect(() => {
    ensureAppleSlideCss()
    const next = detectAppleSlideDevice()
    setDevice(next)
    if (next === 'other') return

    const root = document.documentElement
    const apply = () => {
      const viewport = window.visualViewport
      const height = Math.round(viewport?.height ?? window.innerHeight)
      const offsetTop = Math.round(viewport?.offsetTop ?? 0)
      root.style.setProperty('--apple-slide-vh', `${Math.max(1, height)}px`)
      root.style.setProperty('--apple-slide-top', `${Math.max(0, offsetTop)}px`)
    }
    apply()
    window.visualViewport?.addEventListener('resize', apply)
    window.visualViewport?.addEventListener('scroll', apply)
    window.addEventListener('orientationchange', apply)
    return () => {
      window.visualViewport?.removeEventListener('resize', apply)
      window.visualViewport?.removeEventListener('scroll', apply)
      window.removeEventListener('orientationchange', apply)
      root.style.removeProperty('--apple-slide-vh')
      root.style.removeProperty('--apple-slide-top')
    }
  }, [])

  if (device === 'other') return { ios: false, mac: false, shellProps: {} }
  return { ios: device === 'ios', mac: device === 'mac', shellProps: { 'data-apple-slide': device } }
}
