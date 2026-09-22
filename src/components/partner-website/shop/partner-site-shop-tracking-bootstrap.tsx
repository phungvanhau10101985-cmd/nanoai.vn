'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isLikelyBotTraffic } from '@/lib/analytics-bot-filter'
import { ensureFbqPixelInitialized } from '@/app/messaging/p/[slug]/meta-pixel-session'
import type { PartnerSiteShopTrackingConfig } from '@/lib/partner-website/shop/partner-site-shop-tracking-types'
import {
  bindPartnerSiteNativeTracking,
  normalizeGoogleAdsId,
  normalizeTiktokPixelId,
  trackPartnerSitePageView,
} from '@/lib/partner-website/shop/partner-site-shop-tracking'
import {
  persistPartnerSiteMetaClickIds,
  partnerSiteMetaMatchingParams,
} from '@/lib/partner-website/shop/partner-site-meta-attribution'
import {
  getPartnerSiteConsent,
  PARTNER_SITE_CONSENT_CHANGED_EVENT,
} from '@/lib/partner-website/shop/partner-site-consent'
import { PW_SHOP_SOFT_NAV_EVENT } from '@/components/partner-website/shop/partner-site-soft-nav-relay'
import {
  partnerShopVerifyMetaTags,
  sanitizePartnerShopCustomEmbedHtml,
} from '@/lib/partner-website/shop/sanitize-partner-shop-custom-embed'

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
  script.text = `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${pixelId.replace(/'/g, "\\'")}');}(window,document,'ttq');`
  document.head.appendChild(script)
  window.__nanoShopTiktokPixelId = pixelId
}

function applyVerifyMetas(tracking: PartnerSiteShopTrackingConfig): void {
  const html = partnerShopVerifyMetaTags({
    googleSearchConsoleVerify: tracking.googleSearchConsoleVerify,
    googleMerchantCenterVerify: tracking.googleMerchantCenterVerify,
    facebookDomainVerification: tracking.facebookDomainVerification,
  })
  if (!html || typeof document === 'undefined') return
  const wrap = document.createElement('div')
  wrap.innerHTML = html
  wrap.querySelectorAll('meta').forEach((meta) => {
    const name = meta.getAttribute('name')
    const content = meta.getAttribute('content')
    if (!name || !content) return
    const sel = `meta[name="${name}"]${meta.getAttribute('data-pw-merchant-verify') ? '[data-pw-merchant-verify]' : ''}`
    if (document.head.querySelector(sel)) return
    document.head.appendChild(meta)
  })
}

function applyCustomHtml(html: string, where: 'head' | 'body-start' | 'body-end'): void {
  const safe = sanitizePartnerShopCustomEmbedHtml(html)
  if (!safe || typeof document === 'undefined') return
  const mark = `data-pw-custom-embed="${where}"`
  if (document.querySelector(`[${mark}]`)) return
  const host = document.createElement('div')
  host.setAttribute('data-pw-custom-embed', where)
  host.innerHTML = safe
  const target =
    where === 'head' ? document.head : where === 'body-start' ? document.body : document.body
  const nodes = Array.from(host.childNodes)
  nodes.forEach((node) => {
    if (node.nodeName === 'SCRIPT') {
      const old = node as HTMLScriptElement
      const next = document.createElement('script')
      Array.from(old.attributes).forEach((a) => next.setAttribute(a.name, a.value))
      next.text = old.text
      if (where === 'body-start' && document.body.firstChild) {
        document.body.insertBefore(next, document.body.firstChild)
      } else if (where === 'head') {
        document.head.appendChild(next)
      } else {
        document.body.appendChild(next)
      }
      return
    }
    if (where === 'body-start' && document.body.firstChild) {
      document.body.insertBefore(node, document.body.firstChild)
    } else if (where === 'head') {
      document.head.appendChild(node)
    } else {
      document.body.appendChild(node)
    }
  })
  void target
}

type Props = {
  tracking: PartnerSiteShopTrackingConfig
}

function useTrackingConsentGranted(siteSlug: string | null | undefined): boolean {
  const [granted, setGranted] = useState(false)
  useEffect(() => {
    const slug = (siteSlug ?? '').trim()
    if (!slug) {
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

async function applyAdvancedMatching(siteSlug: string, pixelId: string): Promise<void> {
  try {
    const res = await fetch(`/api/site/${encodeURIComponent(siteSlug)}/personalization/profile`, {
      credentials: 'same-origin',
    })
    if (!res.ok) return
    const json = (await res.json()) as {
      email?: string
      customer_name?: string
      greeting_name?: string
      phone?: string
      guest_account_id?: string
      linked_user_id?: string
    }
    const params = partnerSiteMetaMatchingParams({
      email: json.email,
      phone: json.phone,
      fullName: json.customer_name || json.greeting_name,
      externalId: json.linked_user_id || json.guest_account_id,
    })
    if (Object.keys(params).length) ensureFbqPixelInitialized(pixelId, params)
  } catch {
    /* ignore */
  }
}

export function PartnerSiteShopTrackingBootstrap({ tracking }: Props) {
  const consentGranted = useTrackingConsentGranted(tracking.siteSlug)
  const pageViewedRef = useRef(false)

  useLayoutEffect(() => {
    applyVerifyMetas(tracking)
    const slug = (tracking.siteSlug ?? '').trim()
    if (slug) persistPartnerSiteMetaClickIds(slug)
  }, [tracking])

  useEffect(() => {
    if (isLikelyBotTraffic()) return
    const currency = String(tracking.currency ?? '')
      .trim()
      .toUpperCase()
    if (currency) {
      window.__nanoShopCurrency = currency
    }
    if (!consentGranted) return

    applyCustomHtml(tracking.customEmbedHeadHtml || '', 'head')
    applyCustomHtml(tracking.customEmbedBodyOpenHtml || '', 'body-start')
    applyCustomHtml(tracking.customEmbedBodyCloseHtml || '', 'body-end')

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
      const slug = (tracking.siteSlug ?? '').trim()
      if (slug) void applyAdvancedMatching(slug, meta)
    }

    const tiktok = normalizeTiktokPixelId(tracking.tiktokPixelId)
    if (tiktok) {
      ensureTiktokPixel(tiktok)
    }

    const gtm = (tracking.gtmContainerId ?? '').trim().toUpperCase()
    if (/^GTM-[A-Z0-9]+$/.test(gtm)) {
      ensureGtmLoaded(gtm)
    }
    bindPartnerSiteNativeTracking(tracking)
    if (!pageViewedRef.current) {
      pageViewedRef.current = true
      trackPartnerSitePageView(tracking)
    }
  }, [tracking, consentGranted])

  useEffect(() => {
    if (!consentGranted) return
    const onNav = () => trackPartnerSitePageView(tracking)
    window.addEventListener(PW_SHOP_SOFT_NAV_EVENT, onNav)
    return () => window.removeEventListener(PW_SHOP_SOFT_NAV_EVENT, onNav)
  }, [tracking, consentGranted])

  return null
}
