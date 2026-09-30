/**
 * Snippet HTML tracking. File này bị preview Sửa nhanh import trên trình duyệt —
 * cấm import `pg` / `pool` ở đây. Đọc DB nằm ở `load-partner-shop-google-tag-ids.ts`.
 */
import type { PartnerSiteShopTrackingConfig } from '@/lib/partner-website/shop/partner-site-shop-tracking-types'
import {
  partnerShopVerifyMetaTags,
  sanitizePartnerShopCustomEmbedHtml,
} from '@/lib/partner-website/shop/sanitize-partner-shop-custom-embed'

function escapeAttr(raw: string): string {
  return raw.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function escapeScriptString(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function insertBeforeHeadClose(html: string, inject: string): string {
  if (!inject.trim()) return html
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${inject}\n</head>`)
  if (/<html\b/i.test(html)) return html.replace(/<html\b[^>]*>/i, (m) => `${m}<head>${inject}</head>`)
  return `${inject}\n${html}`
}

function insertAfterBodyOpen(html: string, inject: string): string {
  if (!inject.trim()) return html
  if (/<body\b[^>]*>/i.test(html)) return html.replace(/<body\b[^>]*>/i, (m) => `${m}\n${inject}`)
  return `${inject}\n${html}`
}

function insertBeforeBodyClose(html: string, inject: string): string {
  if (!inject.trim()) return html
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${inject}\n</body>`)
  return `${html}\n${inject}`
}

export function buildShopTrackingGtmNoscript(containerId: string | null | undefined): string {
  const gtm = String(containerId ?? '').trim().toUpperCase()
  if (!/^GTM-[A-Z0-9]+$/.test(gtm)) return ''
  return (
    `<noscript data-pw-shop-gtm-noscript="1"><iframe src="https://www.googletagmanager.com/ns.html?id=${escapeAttr(gtm)}" ` +
    `height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`
  )
}

/**
 * Base pixel snippets for full HTML documents (legacy compose). No PageView / ttq.page —
 * the shop tracking engine fires those after consent.
 */
export function buildShopTrackingHeadSnippets(config: PartnerSiteShopTrackingConfig): string[] {
  const snippets: string[] = []

  const ga4 = (config.ga4MeasurementId ?? '').trim()
  if (/^G-[A-Z0-9]+$/i.test(ga4)) {
    const id = ga4.toUpperCase()
    snippets.push(`<!-- GA4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}',{send_page_view:false});</script>`)
  }

  const googleAds = (config.googleAdsId ?? '').trim()
  if (/^AW-[A-Z0-9]+$/i.test(googleAds)) {
    const aw = googleAds.toUpperCase()
    snippets.push(`<!-- Google Ads -->
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${aw}');</script>`)
  }

  const gtm = (config.gtmContainerId ?? '').trim().toUpperCase()
  if (/^GTM-[A-Z0-9]+$/.test(gtm)) {
    snippets.push(`<!-- GTM -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');</script>`)
  }

  const meta = (config.facebookPixelId ?? '').trim()
  if (meta) {
    const pid = escapeScriptString(meta)
    snippets.push(`<!-- Meta Pixel -->
<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod? n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('set','autoConfig',false,'${pid}');fbq('init','${pid}');</script>`)
  }

  const tiktok = (config.tiktokPixelId ?? '').trim()
  if (tiktok) {
    const tt = escapeScriptString(tiktok)
    snippets.push(`<!-- TikTok Pixel -->
<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${tt}');}(window,document,'ttq');</script>`)
  }

  return snippets
}

export function injectShopTrackingSnippetsIntoHtml(html: string, config: PartnerSiteShopTrackingConfig): string {
  const snippets = buildShopTrackingHeadSnippets(config)
  let out = html
  if (snippets.length) out = insertBeforeHeadClose(out, snippets.join('\n'))
  const noscript = buildShopTrackingGtmNoscript(config.gtmContainerId)
  if (noscript) out = insertAfterBodyOpen(out, noscript)
  return out
}

const GA4_ID_RE = /^G-[A-Z0-9]+$/i
const GOOGLE_ADS_ID_RE = /^AW-[A-Z0-9]+$/i
const META_PIXEL_ID_RE = /^\d{10,20}$/
const TIKTOK_PIXEL_ID_RE = /^[A-Z0-9]{10,64}$/i
const GTM_ID_RE = /^GTM-[A-Z0-9]+$/

export type PartnerShopMetaPixelInstall = {
  pixelId: string
  /** Parser-blocking: tải fbevents, init, PageView một lần. */
  inlineJs: string
}

/**
 * Meta Pixel trong HTML đầu của tài liệu Next.js — cùng chỗ GA4.
 * `autoConfig:false` tránh PageView kép; cờ `__nanoShopMetaPageViewTracked` để React bỏ lần PageView đầu.
 */
export function buildPartnerShopMetaPixelInstall(
  pixelId?: string | null
): PartnerShopMetaPixelInstall | null {
  const id = String(pixelId ?? '').trim()
  if (!META_PIXEL_ID_RE.test(id)) return null
  return {
    pixelId: id,
    inlineJs: [
      `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');`,
      `fbq('set','autoConfig',false,'${id}');`,
      `fbq('init','${id}');`,
      `if(!window.__nanoShopMetaPageViewTracked){fbq('track','PageView');window.__nanoShopMetaPageViewTracked=true;}`,
    ].join(''),
  }
}

export type PartnerShopGoogleTagInstall = {
  /** Same id `ensureGtagLoaded` uses, so React does not inject a second copy. */
  scriptId: string
  src: string
  /** Parser-blocking snippet: consent granted, then gtag('config'). */
  inlineJs: string
}

/** Google tag trong HTML đầu. Consent Mode mặc định granted — vào trang là đo, không hỏi. */
export function buildPartnerShopGoogleTagInstall(input: {
  ga4MeasurementId?: string | null
  googleAdsId?: string | null
}): PartnerShopGoogleTagInstall | null {
  const ga4 = (input.ga4MeasurementId ?? '').trim().toUpperCase()
  const ads = (input.googleAdsId ?? '').trim().toUpperCase()
  const ga4Ok = GA4_ID_RE.test(ga4)
  const adsOk = GOOGLE_ADS_ID_RE.test(ads)
  if (!ga4Ok && !adsOk) return null
  const primary = ga4Ok ? ga4 : ads
  const lines = [
    'window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}',
    "gtag('consent','default',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'});",
    "gtag('js',new Date());",
  ]
  if (ga4Ok) lines.push(`gtag('config','${ga4}',{send_page_view:false});`)
  if (adsOk) {
    lines.push(`gtag('config','${ads}');`)
    lines.push('window.__nanoShopAdsPageViewTracked=true;')
  }
  return {
    scriptId: `shop-gtag-js-${primary}`,
    src: `https://www.googletagmanager.com/gtag/js?id=${primary}`,
    inlineJs: lines.join('\n'),
  }
}

export type PartnerShopTiktokPixelInstall = {
  pixelId: string
  inlineJs: string
}

/** TikTok Pixel trong HTML đầu. `ttq.page()` một lần; React bỏ page đầu, soft-nav sau vẫn bắn. */
export function buildPartnerShopTiktokPixelInstall(
  pixelId?: string | null
): PartnerShopTiktokPixelInstall | null {
  const id = String(pixelId ?? '').trim()
  if (!TIKTOK_PIXEL_ID_RE.test(id)) return null
  const safe = escapeScriptString(id)
  return {
    pixelId: id,
    inlineJs: [
      `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${safe}');}(window,document,'ttq');`,
      `if(window.ttq&&!window.__nanoShopTiktokPageTracked){window.ttq.page();window.__nanoShopTiktokPageTracked=true;}`,
      `window.__nanoShopTiktokPixelId='${safe}';`,
    ].join(''),
  }
}

export type PartnerShopGtmInstall = {
  containerId: string
  /** Cùng id `ensureGtmLoaded` để React không nhét bản thứ hai. */
  inlineJs: string
}

/** GTM trong HTML đầu. Script gắn `shop-gtm-js-{id}` để bootstrap React nhận ra. */
export function buildPartnerShopGtmInstall(containerId?: string | null): PartnerShopGtmInstall | null {
  const id = String(containerId ?? '').trim().toUpperCase()
  if (!GTM_ID_RE.test(id)) return null
  return {
    containerId: id,
    inlineJs: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.id='shop-gtm-js-'+i;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');`,
  }
}

/** Live visual HTML: verification metas + sanitized custom HTML. Pixel / Ads / TikTok / GTM nằm ở `<head>` Next.js. */
export function injectPartnerShopLiveTrackingHtml(
  html: string,
  config: PartnerSiteShopTrackingConfig | null | undefined
): string {
  if (!html.trim() || !config) return html
  let out = html
  const verify = partnerShopVerifyMetaTags({
    googleSearchConsoleVerify: config.googleSearchConsoleVerify,
    googleMerchantCenterVerify: config.googleMerchantCenterVerify,
    facebookDomainVerification: config.facebookDomainVerification,
  })
  if (verify) out = insertBeforeHeadClose(out, verify)
  const headCustom = sanitizePartnerShopCustomEmbedHtml(config.customEmbedHeadHtml)
  if (headCustom) out = insertBeforeHeadClose(out, `<!-- pw-custom-head -->\n${headCustom}`)
  const bodyOpen = sanitizePartnerShopCustomEmbedHtml(config.customEmbedBodyOpenHtml)
  if (bodyOpen) out = insertAfterBodyOpen(out, `<!-- pw-custom-body-open -->\n${bodyOpen}`)
  const bodyClose = sanitizePartnerShopCustomEmbedHtml(config.customEmbedBodyCloseHtml)
  if (bodyClose) out = insertBeforeBodyClose(out, `<!-- pw-custom-body-close -->\n${bodyClose}`)
  return out
}
