import type { PartnerSiteShopTrackingConfig } from '@/lib/partner-website/shop/partner-site-shop-tracking-types'

function escapeScriptString(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export function buildShopTrackingHeadSnippets(config: PartnerSiteShopTrackingConfig): string[] {
  const snippets: string[] = []

  const ga4 = (config.ga4MeasurementId ?? '').trim()
  if (/^G-[A-Z0-9]+$/i.test(ga4)) {
    const id = ga4.toUpperCase()
    snippets.push(`<!-- GA4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');</script>`)
  }

  const googleAds = (config.googleAdsId ?? '').trim()
  if (/^AW-[A-Z0-9]+$/i.test(googleAds)) {
    const aw = googleAds.toUpperCase()
    snippets.push(`<!-- Google Ads -->
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${aw}');</script>`)
  }

  const meta = (config.facebookPixelId ?? '').trim()
  if (meta) {
    const pid = escapeScriptString(meta)
    snippets.push(`<!-- Meta Pixel -->
<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod? n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pid}');fbq('track','PageView');</script>`)
  }

  const tiktok = (config.tiktokPixelId ?? '').trim()
  if (tiktok) {
    const tt = escapeScriptString(tiktok)
    snippets.push(`<!-- TikTok Pixel -->
<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${tt}');ttq.page();}(window,document,'ttq');</script>`)
  }

  return snippets
}

export function injectShopTrackingSnippetsIntoHtml(html: string, config: PartnerSiteShopTrackingConfig): string {
  const snippets = buildShopTrackingHeadSnippets(config)
  if (snippets.length === 0) return html
  const inject = snippets.join('\n')
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${inject}\n</head>`)
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${inject}\n</body>`)
  return `${html}\n${inject}`
}
