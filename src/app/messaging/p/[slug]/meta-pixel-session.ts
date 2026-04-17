'use client'

import { ensureMetaPixelBootstrapDom } from './meta-fbq-bootstrap'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

const initedPixelIds = new Set<string>()

/** Bootstrap + `fbq('init')` tối đa một lần / Pixel / phiên trang. */
export function ensureFbqPixelInitialized(pixelId: string): boolean {
  if (typeof window === 'undefined') return false
  const pid = pixelId.trim()
  if (!pid) return false
  ensureMetaPixelBootstrapDom()
  const w = window
  if (!w.fbq) return false
  if (!initedPixelIds.has(pid)) {
    w.fbq('init', pid)
    initedPixelIds.add(pid)
  }
  return true
}
