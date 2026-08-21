'use client'

import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import {
  PARTNER_SHOP_SCENE_CENTER_SCRIPT,
  PARTNER_SHOP_SCENE_CENTER_SCRIPT_ID,
  pwSceneCanvasWidth,
  pwSceneLiveZoomScale,
  pwSceneLockForAvailableHtml,
  pwSceneLockFromWindowWidth,
  type PwSceneDevice,
} from '@/lib/partner-website/visual-editor/pw-scene'

function lockLiveSceneCanvas(forceDevice?: VisualDeviceVariant | null) {
  if (typeof document === 'undefined') return
  const stamped =
    forceDevice ||
    document.documentElement.getAttribute('data-pw-edit-device') ||
    ''
  const vv = window.visualViewport
  const inner = vv?.width || window.innerWidth || 0
  const outer = window.outerWidth || 0
  const screenW = window.screen?.width || window.screen?.availWidth || 0
  const preferred: PwSceneDevice =
    stamped === 'mobile' || stamped === 'tablet' || stamped === 'laptop' || stamped === 'desktop'
      ? stamped
      : pwSceneLockFromWindowWidth(Math.max(outer, inner))
  const key = pwSceneLockForAvailableHtml(preferred, document)
  if (!key) return
  const zoom = stamped ? 1 : pwSceneLiveZoomScale(inner, outer, screenW)
  document.documentElement.setAttribute('data-pw-scene-lock', key)
  document.documentElement.style.setProperty('--pw-scene-w', `${pwSceneCanvasWidth(key)}px`)
  document.documentElement.style.setProperty('--pw-scene-zoom', String(zoom))
  const root = document.querySelector('[data-pw-inline-visual-root]') as HTMLElement | null
  if (root) {
    const h = root.scrollHeight || 0
    root.style.marginBottom = zoom > 1 && h > 0 ? `${Math.round((zoom - 1) * h)}px` : ''
  }
}

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
      <script
        id={PARTNER_SHOP_SCENE_CENTER_SCRIPT_ID}
        dangerouslySetInnerHTML={{ __html: PARTNER_SHOP_SCENE_CENTER_SCRIPT }}
      />
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
  const devicePreview = Boolean(forceDevice)
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
  useLayoutEffect(() => {
    if (!inlineHtml || forceDevice) return
    const sync = () => lockLiveSceneCanvas(forceDevice)
    sync()
    window.addEventListener('resize', sync)
    const vv = window.visualViewport
    vv?.addEventListener('resize', sync)
    return () => {
      window.removeEventListener('resize', sync)
      vv?.removeEventListener('resize', sync)
    }
  }, [inlineHtml, forceDevice])
  /** Keep desktop iframe ≥1280px when the Chrome window is desktop — F12 docked does not shrink outerWidth. */
  const frameLocked = desktopLocked || desktopWindowLock
  const previewFrameStyle = visualDevicePreviewFrameStyle(
    forceDevice ?? (desktopWindowLock ? 'desktop' : null)
  )
  const previewWrapRef = useRef<HTMLDivElement>(null)
  const centerPreviewWrap = useCallback(() => {
    const el = previewWrapRef.current
    if (!el) return
    const center = () => {
      const extraX = Math.max(0, el.scrollWidth - el.clientWidth)
      el.scrollLeft = extraX / 2
    }
    center()
    window.requestAnimationFrame(center)
    window.setTimeout(center, 80)
    window.setTimeout(center, 240)
  }, [])
  useLayoutEffect(() => {
    centerPreviewWrap()
    window.addEventListener('resize', centerPreviewWrap)
    const vv = window.visualViewport
    vv?.addEventListener('resize', centerPreviewWrap)
    return () => {
      window.removeEventListener('resize', centerPreviewWrap)
      vv?.removeEventListener('resize', centerPreviewWrap)
    }
  }, [centerPreviewWrap, devicePreview, frameLocked, previewFrameStyle.width])
  const previewHtml = hideChatLaunchersInHtml(
    forceDevice && !deviceHtmlAlreadyIsolated ? isolateVisualHtmlForDevice(html, forceDevice) || html : html,
    hideEmbedFab
  )
  /** Live custom domain: never srcDoc-iframe (except `?pw-device=` preview frames). */
  if (inlineHtml && !devicePreview) {
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
        ref={previewWrapRef}
        className={
          devicePreview
            ? 'min-h-screen overflow-x-auto bg-neutral-200'
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
            devicePreview
              ? 'block h-[100dvh] shrink-0 border-0 bg-white shadow-lg'
              : frameLocked
                ? 'block h-[100dvh] shrink-0 border-0 bg-white'
                : 'fixed inset-0 h-full w-full border-0 bg-white'
          }
          style={
            devicePreview || frameLocked
              ? previewFrameStyle
              : undefined
          }
          onLoad={centerPreviewWrap}
        />
      </div>
    </PartnerSiteChatWidgetProvider>
  )
}
