import { PartnerSiteLiveVisualIslands } from '@/components/partner-website/shop/partner-site-live-visual-islands'
import type { WebLocale } from '@/lib/i18n/config'
import { FASHION_SHOP_GOOGLE_FONTS_HREF } from '@/lib/partner-website/shop/fashion-shop-design'
import {
  buildPartnerLiveDocumentStampScript,
  buildPartnerShopFontCss,
  extractVisualHtmlBodyMarkup,
  extractVisualHtmlDocumentCodes,
  PARTNER_SHOP_FONT_STYLE_ID,
} from '@/lib/partner-website/shop/inject-partner-shop-fonts'
import {
  extractVisualDocumentCssText,
  extractVisualDocumentStyleLinks,
} from '@/lib/partner-website/shop/merge-visual-home-styles'
import type { PartnerSiteShopTrackingConfig } from '@/lib/partner-website/shop/partner-site-shop-tracking-types'
import {
  splitVisualHtmlBodyScripts,
  type VisualHtmlHoistedScript,
} from '@/lib/partner-website/shop/split-visual-html-scripts'
import {
  PARTNER_SHOP_LISTING_HEAD_SCRIPT,
  PARTNER_SHOP_LISTING_HEAD_SCRIPT_ID,
} from '@/lib/partner-website/shop/listing-head'
import {
  PARTNER_SHOP_MOBILE_HEADER_LOGO_SCRIPT,
  PARTNER_SHOP_MOBILE_HEADER_LOGO_SCRIPT_ID,
} from '@/lib/partner-website/shop/mobile-header-logo-collapse'
import {
  PARTNER_SHOP_SCENE_CENTER_SCRIPT,
  PARTNER_SHOP_SCENE_CENTER_SCRIPT_ID,
} from '@/lib/partner-website/visual-editor/pw-scene'
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'

function hideChatLaunchersInHtml(html: string, hide: boolean): string {
  if (!hide || !html.trim() || html.includes('data-pw-hide-chat-launcher')) return html
  const style =
    '<style data-pw-hide-chat-launcher>.pw-fab-chat,[data-nanoai-chat-bubble="1"],[data-pw-chat-launcher="1"]{display:none!important}</style>'
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${style}</head>`)
  return `${style}${html}`
}

function htmlHasVisibleChromeChatMua(html: string): boolean {
  if (!html) return false
  const re = /<(?:a|button)\b[^>]*\bdata-pw-chrome-btn=["']chat["'][^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    if (!/\bdata-pw-hidden=["']1["']/i.test(m[0])) return true
  }
  return false
}

function hoistedScriptDataProps(script: VisualHtmlHoistedScript): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, value] of script.dataAttrs) {
    if (!/^data-[a-z0-9-]+$/i.test(name)) continue
    out[name] = value === '' ? 'true' : String(value)
  }
  return out
}

function PartnerSiteLiveHoistedScript({ script }: { script: VisualHtmlHoistedScript }) {
  const data = hoistedScriptDataProps(script)
  if (script.src) {
    return (
      <script
        src={script.src}
        defer={script.defer || !script.async}
        async={script.async || undefined}
        id={script.id || undefined}
        type={script.type || undefined}
        {...data}
      />
    )
  }
  return (
    <script
      id={script.id || undefined}
      type={script.type || undefined}
      {...data}
      dangerouslySetInnerHTML={{ __html: script.body }}
    />
  )
}

function PartnerSiteLiveVisualHead({
  html,
  device,
}: {
  html: string
  device?: VisualDeviceVariant | null
}) {
  const links = extractVisualDocumentStyleLinks(html).filter((link) => Boolean(link.href))
  const css = extractVisualDocumentCssText(html)
  const hasGoogleFont = links.some((link) => /fonts\.googleapis\.com/i.test(link.href))
  const stampScript = buildPartnerLiveDocumentStampScript(html, device)
  const preload = html.match(/<link\b[^>]*\bdata-pw-lcp-preload=["']1["'][^>]*>/i)?.[0] || ''
  const preloadHref = preload.match(/\bhref=["']([^"']+)["']/i)?.[1] || ''
  const preconnects = Array.from(
    html.matchAll(/<link\b[^>]*\bdata-pw-cdn-preconnect=["']1["'][^>]*>/gi)
  )
    .map((m) => m[0].match(/\bhref=["']([^"']+)["']/i)?.[1] || '')
    .filter(Boolean)
  return (
    <>
      {stampScript ? <script dangerouslySetInnerHTML={{ __html: stampScript }} /> : null}
      {!hasGoogleFont ? (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href={FASHION_SHOP_GOOGLE_FONTS_HREF} data-pw-shop-fonts="1" />
        </>
      ) : null}
      {preconnects.map((href) => (
        <link key={href} rel="preconnect" href={href} crossOrigin="anonymous" />
      ))}
      {preloadHref ? (
        <link rel="preload" as="image" href={preloadHref} fetchPriority="high" />
      ) : null}
      {links.map((link) => (
        <link
          key={`${link.rel}:${link.href}`}
          rel={link.rel}
          href={link.href}
          {...(link.as ? { as: link.as } : {})}
          {...(link.crossOrigin ? { crossOrigin: link.crossOrigin } : {})}
        />
      ))}
      {css.includes(PARTNER_SHOP_FONT_STYLE_ID) ? (
        <style data-pw-inline-visual-css="1" dangerouslySetInnerHTML={{ __html: css }} />
      ) : (
        <>
          <style id={PARTNER_SHOP_FONT_STYLE_ID} dangerouslySetInnerHTML={{ __html: buildPartnerShopFontCss() }} />
          {css ? <style data-pw-inline-visual-css="1" dangerouslySetInnerHTML={{ __html: css }} /> : null}
        </>
      )}
      <script
        id={`${PARTNER_SHOP_LISTING_HEAD_SCRIPT_ID}-early`}
        dangerouslySetInnerHTML={{ __html: PARTNER_SHOP_LISTING_HEAD_SCRIPT }}
      />
      <script
        id={`${PARTNER_SHOP_MOBILE_HEADER_LOGO_SCRIPT_ID}-early`}
        dangerouslySetInnerHTML={{ __html: PARTNER_SHOP_MOBILE_HEADER_LOGO_SCRIPT }}
      />
      <script
        id={PARTNER_SHOP_SCENE_CENTER_SCRIPT_ID}
        dangerouslySetInnerHTML={{ __html: PARTNER_SHOP_SCENE_CENTER_SCRIPT }}
      />
    </>
  )
}

/**
 * Server Component. Do not wrap shop HTML / `<script>` / `<style>` in a Client
 * Component — Next RSC omits the real error in production and only shows a digest.
 */
export function PartnerSiteLiveVisualDocument({
  html,
  device = null,
  siteSlug,
  locale,
  chatPath,
  shopName,
  logoUrl,
  hideChatLauncher,
  tracking,
  browserThemeColor,
}: {
  html: string
  device?: VisualDeviceVariant | null
  siteSlug: string
  locale: WebLocale
  chatPath: string
  shopName: string
  logoUrl?: string | null
  hideChatLauncher?: boolean
  tracking?: PartnerSiteShopTrackingConfig | null
  browserThemeColor?: string
}) {
  const previewHtml = hideChatLaunchersInHtml(html, Boolean(hideChatLauncher))
  const codes = extractVisualHtmlDocumentCodes(previewHtml)
  const { markup, scripts } = splitVisualHtmlBodyScripts(extractVisualHtmlBodyMarkup(previewHtml))
  const hideEmbedFab = htmlHasVisibleChromeChatMua(previewHtml)
  return (
    <>
      <PartnerSiteLiveVisualHead html={previewHtml} device={device} />
      <div
        data-pw-inline-visual-root="1"
        data-pw-page={codes['data-pw-page'] || undefined}
        data-pw-look={codes['data-pw-look'] || undefined}
        data-pw-coordinate-version={codes['data-pw-coordinate-version'] || undefined}
        data-pw-listing-category={codes['data-pw-listing-category'] || undefined}
        data-pw-active-device={device || undefined}
        data-pw-edit-device={device || undefined}
        className="bg-white"
        dangerouslySetInnerHTML={{ __html: markup }}
      />
      {scripts.map((script, i) => (
        <PartnerSiteLiveHoistedScript key={script.id || script.src || `pw-inline-${i}`} script={script} />
      ))}
      <PartnerSiteLiveVisualIslands
        siteSlug={siteSlug}
        locale={locale}
        chatPath={chatPath}
        shopName={shopName}
        logoUrl={logoUrl || null}
        hideChatLauncher={hideChatLauncher !== false && hideEmbedFab}
        tracking={tracking || null}
        browserThemeColor={browserThemeColor || ''}
        device={device}
        pageKind={codes['data-pw-page'] || ''}
      />
    </>
  )
}
