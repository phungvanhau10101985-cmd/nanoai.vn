'use client'

import { ensureMetaPixelBootstrapDom } from './meta-fbq-bootstrap'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

const initedPixelIds = new Set<string>()

/** Bootstrap + `fbq('init')` tối đa một lần / Pixel / phiên trang. `autoConfig:false` tránh PageView kép. */
export function ensureFbqPixelInitialized(
  pixelId: string,
  advancedMatching?: Record<string, string>
): boolean {
  if (typeof window === 'undefined') return false
  const pid = pixelId.trim()
  if (!pid) return false
  ensureMetaPixelBootstrapDom()
  const w = window
  if (!w.fbq) return false
  const am = advancedMatching && Object.keys(advancedMatching).length ? advancedMatching : undefined
  if (!initedPixelIds.has(pid)) {
    w.fbq('set', 'autoConfig', false, pid)
    if (am) w.fbq('init', pid, am, { autoConfig: false })
    else w.fbq('init', pid, {}, { autoConfig: false })
    initedPixelIds.add(pid)
  } else if (am) {
    w.fbq('init', pid, am, { autoConfig: false })
  }
  return true
}
