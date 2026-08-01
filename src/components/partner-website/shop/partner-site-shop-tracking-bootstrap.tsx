'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { isLikelyBotTraffic } from '@/lib/analytics-bot-filter'
import { ensureFbqPixelInitialized } from '@/app/messaging/p/[slug]/meta-pixel-session'
import type { PartnerSiteShopTrackingConfig } from '@/lib/partner-website/shop/partner-site-shop-tracking-types'
import {
  normalizeGoogleAdsId,
  normalizeTiktokPixelId,
  trackPartnerSitePageView,
} from '@/lib/partner-website/shop/partner-site-shop-tracking'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
    ttq?: {
      page?: () => void
      track?: (event: string, params?: Record<string, unknown>) => void
    }
    __nanoShopGa4MeasurementId?: string
    __nanoShopGoogleAdsId?: string
    __nanoShopTiktokPixelId?: string
  }
}

function ensureGtagLoaded(tagId: string): void {
  window.dataLayer = window.dataLayer || []
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args)
    }
    window.gtag('js', new Date())
  }
  const scriptId = `shop-gtag-js-${tagId}`
  if (document.getElementById(scriptId)) return
  const script = document.createElement('script')
  script.id = scriptId
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tagId)}`
  document.head.appendChild(script)
}

function ensureTiktokPixel(pixelId: string): void {
  if (window.__nanoShopTiktokPixelId === pixelId && typeof window.ttq?.track === 'function') return
  const scriptId = `shop-ttq-${pixelId}`
  if (document.getElementById(scriptId)) {
    window.__nanoShopTiktokPixelId = pixelId
    return
  }
  const script = document.createElement('script')
  script.id = scriptId
  script.text = `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${pixelId.replace(/'/g, "\\'")}');ttq.page();}(window,document,'ttq');`
  document.head.appendChild(script)
  window.__nanoShopTiktokPixelId = pixelId
}

type Props = {
  tracking: PartnerSiteShopTrackingConfig
}

export function PartnerSiteShopTrackingBootstrap({ tracking }: Props) {
  const pathname = usePathname()

  useEffect(() => {
    if (isLikelyBotTraffic()) return

    const ga4 = (tracking.ga4MeasurementId ?? '').trim()
    if (/^G-[A-Z0-9]+$/i.test(ga4)) {
      const id = ga4.toUpperCase()
      window.__nanoShopGa4MeasurementId = id
      ensureGtagLoaded(id)
      window.gtag?.('config', id, { send_page_view: false })
    }

    const googleAds = normalizeGoogleAdsId(tracking.googleAdsId)
    if (googleAds) {
      window.__nanoShopGoogleAdsId = googleAds
      ensureGtagLoaded(googleAds)
      window.gtag?.('config', googleAds)
    }

    const meta = (tracking.facebookPixelId ?? '').trim()
    if (meta) {
      ensureFbqPixelInitialized(meta)
    }

    const tiktok = normalizeTiktokPixelId(tracking.tiktokPixelId)
    if (tiktok) {
      ensureTiktokPixel(tiktok)
    }
  }, [tracking])

  useEffect(() => {
    if (isLikelyBotTraffic()) return
    trackPartnerSitePageView(tracking)
  }, [pathname, tracking])

  return null
}
