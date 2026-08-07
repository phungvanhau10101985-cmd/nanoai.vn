'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { isLikelyBotTraffic } from '@/lib/analytics-bot-filter'
import { ensureFbqPixelInitialized } from '@/app/messaging/p/[slug]/meta-pixel-session'
import type { PartnerSiteShopTrackingConfig } from '@/lib/partner-website/shop/partner-site-shop-tracking-types'
import {
  normalizeGoogleAdsId,
  normalizeTiktokPixelId,
  trackPartnerSitePageView,
} from '@/lib/partner-website/shop/partner-site-shop-tracking'
import {
  getPartnerSiteConsent,
  PARTNER_SITE_CONSENT_CHANGED_EVENT,
} from '@/lib/partner-website/shop/partner-site-consent'

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
    __nanoShopCurrency?: string
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

/**
 * S0.4 — GTM container do merchant tự nhập (M3.1). Chèn client-side qua `useEffect` (không phải
 * `useLayoutEffect` — xem docs/188_BEHAVIOR_SPEC.md mục E.5 gợi ý `useLayoutEffect` để tracking
 * function sẵn sàng trước các effect khác; ở đây dùng `useEffect` nhất quán với phần script
 * GA4/Meta/TikTok đã có, ưu tiên không đổi hành vi các phần đã chạy ổn định).
 * Bỏ qua `<noscript>` iframe (chỉ có ý nghĩa khi chèn server-side ngay sau `<body>`).
 */
function ensureGtmLoaded(containerId: string): void {
  window.dataLayer = window.dataLayer || []
  const scriptId = `shop-gtm-js-${containerId}`
  if (document.getElementById(scriptId)) return
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
  const script = document.createElement('script')
  script.id = scriptId
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`
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

/**
 * S0.9 — không tải bất kỳ script tracking nào (GA4/Ads/Meta/TikTok/GTM) cho tới khi khách CHỌN
 * "Đồng ý" ở banner cookie. `useState(false)` mặc định an toàn (chưa từng đồng ý) — tránh nhấp
 * nháy tải trước rồi mới ẩn khi chưa kiểm tra xong localStorage.
 */
function useTrackingConsentGranted(siteSlug: string | null | undefined): boolean {
  const [granted, setGranted] = useState(false)
  useEffect(() => {
    const slug = (siteSlug ?? '').trim()
    if (!slug) {
      // Không có siteSlug (context cũ/chat) — giữ hành vi trước đây, không chặn theo consent.
      setGranted(true)
      return
    }
    setGranted(getPartnerSiteConsent(slug) === 'accepted')
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ siteSlug: string; choice: string }>).detail
      if (detail?.siteSlug === slug) setGranted(detail.choice === 'accepted')
    }
    window.addEventListener(PARTNER_SITE_CONSENT_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(PARTNER_SITE_CONSENT_CHANGED_EVENT, onChange)
  }, [siteSlug])
  return granted
}

export function PartnerSiteShopTrackingBootstrap({ tracking }: Props) {
  const pathname = usePathname()
  const consentGranted = useTrackingConsentGranted(tracking.siteSlug)

  useEffect(() => {
    if (isLikelyBotTraffic()) return
    const currency = String(tracking.currency ?? '')
      .trim()
      .toUpperCase()
    if (currency) {
      window.__nanoShopCurrency = currency
    }
    if (!consentGranted) return

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

    const gtm = (tracking.gtmContainerId ?? '').trim().toUpperCase()
    if (/^GTM-[A-Z0-9]+$/.test(gtm)) {
      ensureGtmLoaded(gtm)
    }
  }, [tracking, consentGranted])

  useEffect(() => {
    if (isLikelyBotTraffic()) return
    if (!consentGranted) return
    trackPartnerSitePageView(tracking)
  }, [pathname, tracking, consentGranted])

  return null
}
