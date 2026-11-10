'use client'

import { ensureMetaPixelBootstrapDom } from './meta-fbq-bootstrap'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
    __nanoShopMetaAm?: Record<string, string>
    __nanoShopMetaPixels?: Record<string, number>
  }
}

const initedPixelIds = new Set<string>()

function mergeAdvancedMatching(next?: Record<string, string>): Record<string, string> | undefined {
  const out: Record<string, string> = {}
  const prev = typeof window !== 'undefined' ? window.__nanoShopMetaAm : undefined
  if (prev) {
    for (const [key, value] of Object.entries(prev)) {
      if (typeof value === 'string' && value) out[key] = value
    }
  }
  if (next) {
    for (const [key, value] of Object.entries(next)) {
      if (typeof value === 'string' && value) out[key] = value
    }
  }
  if (!Object.keys(out).length) return undefined
  window.__nanoShopMetaAm = out
  return out
}

/** Bootstrap + `fbq('init')`. Lần sau chỉ cập nhật khi có dữ liệu khách — không ghi đè bằng `{}`. */
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
  const am = mergeAdvancedMatching(advancedMatching)
  const already = initedPixelIds.has(pid) || Boolean(w.__nanoShopMetaPixels?.[pid])
  if (!already) {
    w.fbq('set', 'autoConfig', false, pid)
    w.fbq('init', pid, am ?? {}, { autoConfig: false })
    initedPixelIds.add(pid)
    w.__nanoShopMetaPixels = w.__nanoShopMetaPixels || {}
    w.__nanoShopMetaPixels[pid] = 1
  } else if (am && advancedMatching && Object.keys(advancedMatching).length) {
    w.fbq('init', pid, am, { autoConfig: false })
    initedPixelIds.add(pid)
    w.__nanoShopMetaPixels = w.__nanoShopMetaPixels || {}
    w.__nanoShopMetaPixels[pid] = 1
  }
  return true
}
