'use client'

import { Suspense, useEffect, useLayoutEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PartnerSiteChatWidgetProvider } from '@/components/partner-website/shop/partner-site-chat-widget-provider'
import type { WebLocale } from '@/lib/i18n/config'
import { FASHION_SHOP_GOOGLE_FONTS_HREF } from '@/lib/partner-website/shop/fashion-shop-design'
import {
  buildPartnerShopFontCss,
  extractVisualHtmlBodyMarkup,
  PARTNER_SHOP_FONT_STYLE_ID,
} from '@/lib/partner-website/shop/inject-partner-shop-fonts'
import {
  extractVisualDocumentCssText,
  extractVisualDocumentStyleLinks,
} from '@/lib/partner-website/shop/merge-visual-home-styles'
import { htmlHasChromeChatMua } from '@/lib/partner-website/visual-editor/chrome-widgets'
import {
  isolateVisualHtmlForDevice,
  isDesktopBrowserWindow,
  parseVisualDeviceQuery,
  visualDevicePreviewFrameStyle,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'

function hideChatLaunchersInHtml(html: string, hide: boolean): string {
  if (!hide || !html.trim() || html.includes('data-pw-hide-chat-launcher')) return html
  const style =
    '<style data-pw-hide-chat-launcher>.pw-fab-chat,[data-nanoai-chat-bubble="1"],[data-pw-chat-launcher="1"]{display:none!important}</style>'
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${style}</head>`)
  return `${style}${html}`
}

/** `dangerouslySetInnerHTML` does not execute `<script>` — re-arm shop runtime APIs (badges, search, cats). */
function PartnerSiteInlineVisualScripts() {
  useEffect(() => {
    const root = document.querySelector('[data-pw-inline-visual-root]')
    if (!root) return
    const scripts = root.querySelectorAll('script')
    scripts.forEach((old) => {
      if (old.getAttribute('data-pw-script-armed') === '1') return
      old.setAttribute('data-pw-script-armed', '1')
      const next = document.createElement('script')
      next.textContent = old.textContent
      Array.from(old.attributes).forEach((attr) => {
        if (attr.name === 'data-pw-script-armed') return
        next.setAttribute(attr.name, attr.value)
      })
      next.setAttribute('data-pw-script-armed', '1')
      old.replaceWith(next)
    })
    window.setTimeout(() => {
      document.dispatchEvent(new Event('pw-cart-updated'))
      document.dispatchEvent(new Event('pw-shop-notifications-refresh'))
    }, 80)
  }, [])
  return null
}

function readForcedDevice(search: URLSearchParams | null): VisualDeviceVariant | null {
  return parseVisualDeviceQuery(search?.get('pw-device') || '')
}

function PartnerSiteInlineVisualHead({ html }: { html: string }) {
  const links = extractVisualDocumentStyleLinks(html)
  const css = extractVisualDocumentCssText(html)
  const hasGoogleFont = links.some((link) => /fonts\.googleapis\.com/i.test(link.href))
  return (
    <>
      {!hasGoogleFont ? (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href={FASHION_SHOP_GOOGLE_FONTS_HREF} data-pw-shop-fonts="1" />
        </>
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
    </>
  )
}

export function PartnerSitePublicClient({
  html,
  allowScripts,
  chatPath,
  shopName,
  logoUrl,
  locale,
  inlineHtml = false,
  initialDevice = null,
  deviceHtmlAlreadyIsolated = false,
  hideChatLauncher,
}: {
  html: string
  allowScripts?: boolean
  chatPath: string
  shopName: string
  logoUrl?: string | null
  locale: WebLocale
  /** Render landing HTML in-page (custom domain) instead of iframe — links update browser URL. */
  inlineHtml?: boolean
  /** From `?pw-device=` on the server so the first paint already locks desktop width. */
  initialDevice?: VisualDeviceVariant | null
  /** Server already returned the exact `?pw-device=` file, so the client should not slice again. */
  deviceHtmlAlreadyIsolated?: boolean
  /** Omit or true = hide legacy embed FAB; false = opt-in to platform bubble. */
  hideChatLauncher?: boolean
}) {
  return (
    <Suspense
      fallback={
        <PartnerSitePublicFrame
          html={html}
          allowScripts={allowScripts}
          chatPath={chatPath}
          shopName={shopName}
          logoUrl={logoUrl}
          locale={locale}
          inlineHtml={inlineHtml}
          forceDevice={initialDevice}
          deviceHtmlAlreadyIsolated={deviceHtmlAlreadyIsolated}
          hideChatLauncher={hideChatLauncher}
        />
      }
    >
      <PartnerSitePublicClientWithParams
        html={html}
        allowScripts={allowScripts}
        chatPath={chatPath}
        shopName={shopName}
        logoUrl={logoUrl}
        locale={locale}
        inlineHtml={inlineHtml}
        initialDevice={initialDevice}
        deviceHtmlAlreadyIsolated={deviceHtmlAlreadyIsolated}
        hideChatLauncher={hideChatLauncher}
      />
    </Suspense>
  )
}

function PartnerSitePublicClientWithParams(props: {
  html: string
  allowScripts?: boolean
  chatPath: string
  shopName: string
  logoUrl?: string | null
  locale: WebLocale
  inlineHtml?: boolean
  initialDevice?: VisualDeviceVariant | null
  deviceHtmlAlreadyIsolated?: boolean
  hideChatLauncher?: boolean
}) {
  const params = useSearchParams()
  return (
    <PartnerSitePublicFrame
      {...props}
      forceDevice={readForcedDevice(params) ?? props.initialDevice ?? null}
    />
  )
}

function PartnerSitePublicFrame({
  html,
  allowScripts,
  chatPath,
  shopName,
  logoUrl,
  locale,
  inlineHtml = false,
  forceDevice,
  deviceHtmlAlreadyIsolated = false,
  hideChatLauncher,
}: {
  html: string
  allowScripts?: boolean
  chatPath: string
  shopName: string
  logoUrl?: string | null
  locale: WebLocale
  inlineHtml?: boolean
  forceDevice: VisualDeviceVariant | null
  deviceHtmlAlreadyIsolated?: boolean
  hideChatLauncher?: boolean
}) {
  const hideEmbedFab = hideChatLauncher !== false || htmlHasChromeChatMua(html)
  const compactPreview = forceDevice === 'mobile' || forceDevice === 'tablet'
  const desktopLocked = forceDevice === 'desktop' || forceDevice === 'laptop'
  const [desktopWindowLock, setDesktopWindowLock] = useState(false)
  useLayoutEffect(() => {
    // Custom-domain live HTML must stay in-page. A srcDoc iframe keeps the address
    // bar on `/` while inner links hit nanoai.vn and Chrome blocks them
    // (X-Frame-Options: SAMEORIGIN → "nanoai.vn đã từ chối kết nối").
    if (inlineHtml || forceDevice) {
      setDesktopWindowLock(false)
      return
    }
    const sync = () => setDesktopWindowLock(isDesktopBrowserWindow(window))
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [forceDevice, inlineHtml])
  /** Keep desktop iframe ≥1280px when the Chrome window is desktop — F12 docked does not shrink outerWidth. */
  const frameLocked = desktopLocked || desktopWindowLock
  const previewFrameStyle = visualDevicePreviewFrameStyle(
    forceDevice ?? (desktopWindowLock ? 'desktop' : null)
  )
  const previewHtml = hideChatLaunchersInHtml(
    forceDevice && !deviceHtmlAlreadyIsolated ? isolateVisualHtmlForDevice(html, forceDevice) || html : html,
    hideEmbedFab
  )
  /** Live custom domain: never srcDoc-iframe (except compact ?pw-device= preview). */
  if (inlineHtml && !compactPreview) {
    return (
      <PartnerSiteChatWidgetProvider
        chatPath={chatPath}
        shopName={shopName}
        logoUrl={logoUrl}
        locale={locale}
        listenLandingPostMessage
        hideLauncher={hideEmbedFab}
      >
        <PartnerSiteInlineVisualHead html={previewHtml} />
        <PartnerSiteInlineVisualScripts />
        <div
          data-pw-inline-visual-root="1"
          className="min-h-screen bg-white"
          dangerouslySetInnerHTML={{ __html: extractVisualHtmlBodyMarkup(previewHtml) }}
        />
      </PartnerSiteChatWidgetProvider>
    )
  }

  const sandbox = allowScripts
    ? 'allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-top-navigation-by-user-activation'
    : 'allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation'
  return (
    <PartnerSiteChatWidgetProvider
      chatPath={chatPath}
      shopName={shopName}
      logoUrl={logoUrl}
      locale={locale}
      listenLandingPostMessage
      hideLauncher={hideEmbedFab}
    >
      <div
        className={
          compactPreview
            ? 'flex min-h-screen justify-center bg-neutral-200'
            : frameLocked
              ? 'min-h-screen overflow-x-auto bg-white'
              : 'min-h-screen bg-white'
        }
      >
        <iframe
          title="Landing page"
          srcDoc={previewHtml}
          sandbox={sandbox}
          className={
            compactPreview
              ? 'block h-[100dvh] max-w-full border-0 bg-white shadow-lg'
              : frameLocked
                ? 'block h-[100dvh] border-0 bg-white'
                : 'fixed inset-0 h-full w-full border-0 bg-white'
          }
          style={compactPreview || frameLocked ? previewFrameStyle : undefined}
        />
      </div>
    </PartnerSiteChatWidgetProvider>
  )
}
