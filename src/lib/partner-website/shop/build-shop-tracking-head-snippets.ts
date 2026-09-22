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

/** Live visual HTML: verification metas + sanitized custom HTML. Pixels stay in React bootstrap (consent). */
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
  const noscript = buildShopTrackingGtmNoscript(config.gtmContainerId)
  const openBlock = [noscript, bodyOpen ? `<!-- pw-custom-body-open -->\n${bodyOpen}` : ''].filter(Boolean).join('\n')
  if (openBlock) out = insertAfterBodyOpen(out, openBlock)
  const bodyClose = sanitizePartnerShopCustomEmbedHtml(config.customEmbedBodyCloseHtml)
  if (bodyClose) out = insertBeforeBodyClose(out, `<!-- pw-custom-body-close -->\n${bodyClose}`)
  return out
}
