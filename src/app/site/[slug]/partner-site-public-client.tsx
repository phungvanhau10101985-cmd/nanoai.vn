'use client'

import { Suspense, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PartnerSiteChatWidgetProvider } from '@/components/partner-website/shop/partner-site-chat-widget-provider'
import type { WebLocale } from '@/lib/i18n/config'
import { FASHION_SHOP_GOOGLE_FONTS_HREF } from '@/lib/partner-website/shop/fashion-shop-design'
import {
  buildPartnerShopFontCss,
  extractVisualHtmlBodyMarkup,
  extractVisualHtmlLook,
  extractVisualHtmlPageKind,
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
} from '@/lib/partner-website/visual-editor/pw-scene'
import {
  liveVisualDeviceVisibleInUserAgent,
  resolveLiveVisualRequestDevice,
} from '@/lib/partner-website/shop/infer-live-visual-request-device'
import type { PartnerVisualHtmlByDevice } from '@/lib/partner-website/shop/render-partner-visual-html'
import { PARTNER_LIVE_DEVICE_COOKIE } from '@/lib/auth/app-request-headers'

function hideChatLaunchersInHtml(html: string, hide: boolean): string {
  if (!hide || !html.trim() || html.includes('data-pw-hide-chat-launcher')) return html
  const style =
    '<style data-pw-hide-chat-launcher>.pw-fab-chat,[data-nanoai-chat-bubble="1"],[data-pw-chat-launcher="1"]{display:none!important}</style>'
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${style}</head>`)
  return `${style}${html}`
}

/** `dangerouslySetInnerHTML` does not execute `<script>` — re-arm shop runtime APIs (badges, search, cats). */
function PartnerSiteInlineVisualScripts({ revision }: { revision: string }) {
  useLayoutEffect(() => {
    const root = document.querySelector('[data-pw-inline-visual-root]')
    if (!root) return
    document
      .querySelectorAll(
        '[data-pw-live-chrome],[data-pw-live-dock],[data-pw-live-fixed-layer]'
      )
      .forEach((host) => {
        const hostRevision = host.getAttribute('data-pw-runtime-revision')
        if (hostRevision && hostRevision !== revision) host.remove()
      })
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
      const apply = (window as Window & { __pwSceneCenterApply?: () => void }).__pwSceneCenterApply
      if (typeof apply === 'function') apply()
    }, 80)
  }, [revision])
  return null
}

function readForcedDevice(search: URLSearchParams | null): VisualDeviceVariant | null {
  return parseVisualDeviceQuery(search?.get('pw-device') || '')
}

function readVisualHtmlFaviconHref(html: string): string {
  const byRelThenHref =
    html.match(/<link\b[^>]*\brel=["'](?:shortcut icon|icon)["'][^>]*\bhref=["']([^"']+)["']/i)?.[1]
  if (byRelThenHref?.trim()) return byRelThenHref.trim()
  return (
    html.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["'](?:shortcut icon|icon)["']/i)?.[1]?.trim() ||
    ''
  )
}

function applyLiveDocumentFavicon(href: string) {
  if (!href || typeof document === 'undefined') return
  const rels = ['icon', 'shortcut icon']
  for (const rel of rels) {
    let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
    if (!el) {
      el = document.createElement('link')
      el.setAttribute('rel', rel)
      document.head.appendChild(el)
    }
    el.setAttribute('type', 'image/png')
    el.setAttribute('href', href)
  }
}

function visualHtmlRevision(html: string, device: VisualDeviceVariant): string {
  let hash = 2166136261
  for (let i = 0; i < html.length; i += Math.max(1, Math.floor(html.length / 2048))) {
    hash ^= html.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `${device}:${html.length}:${hash >>> 0}`
}

function PartnerSiteInlineVisualHead({ html }: { html: string }) {
  const links = extractVisualDocumentStyleLinks(html)
  const css = extractVisualDocumentCssText(html)
  const hasGoogleFont = links.some((link) => /fonts\.googleapis\.com/i.test(link.href))
  const look = extractVisualHtmlLook(html)
  return (
    <>
      {look ? (
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.setAttribute("data-pw-look",${JSON.stringify(look)})`,
          }}
        />
      ) : null}
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
  htmlByDevice,
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
  htmlByDevice?: PartnerVisualHtmlByDevice
  allowScripts?: boolean
  chatPath: string
  shopName: string
  logoUrl?: string | null
  locale: WebLocale
  /** Render landing HTML in-page (custom domain) instead of iframe — links update browser URL. */
  inlineHtml?: boolean
  /** From `?pw-device=` on the server so the first paint already locks desktop width. */
  initialDevice?: VisualDeviceVariant | null
  /** Server already returned one machine file, so the client should not slice again. Not a preview lock. */
  deviceHtmlAlreadyIsolated?: boolean
  /** Omit or true = hide legacy embed FAB; false = opt-in to platform bubble. */
  hideChatLauncher?: boolean
}) {
  return (
    <Suspense
      fallback={
        <PartnerSitePublicFrame
          html={html}
          htmlByDevice={htmlByDevice}
          allowScripts={allowScripts}
          chatPath={chatPath}
          shopName={shopName}
          logoUrl={logoUrl}
          locale={locale}
          inlineHtml={inlineHtml}
          initialDevice={initialDevice}
          forceDevice={null}
          deviceHtmlAlreadyIsolated={deviceHtmlAlreadyIsolated}
          hideChatLauncher={hideChatLauncher}
        />
      }
    >
      <PartnerSitePublicClientWithParams
        html={html}
        htmlByDevice={htmlByDevice}
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
  htmlByDevice?: PartnerVisualHtmlByDevice
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
      forceDevice={readForcedDevice(params)}
    />
  )
}

function PartnerSitePublicFrame({
  html,
  htmlByDevice,
  allowScripts,
  chatPath,
  shopName,
  logoUrl,
  locale,
  inlineHtml = false,
  initialDevice = null,
  forceDevice,
  deviceHtmlAlreadyIsolated = false,
  hideChatLauncher,
}: {
  html: string
  htmlByDevice?: PartnerVisualHtmlByDevice
  allowScripts?: boolean
  chatPath: string
  shopName: string
  logoUrl?: string | null
  locale: WebLocale
  inlineHtml?: boolean
  initialDevice?: VisualDeviceVariant | null
  forceDevice: VisualDeviceVariant | null
  deviceHtmlAlreadyIsolated?: boolean
  hideChatLauncher?: boolean
}) {
  const availableDevices = useMemo(
    () =>
      (Object.keys(htmlByDevice || {}) as VisualDeviceVariant[]).filter(
        (device) => (htmlByDevice?.[device]?.trim().length ?? 0) >= 40
      ),
    [htmlByDevice]
  )
  const firstDevice =
    forceDevice ||
    initialDevice ||
    'desktop'
  const [activeDevice, setActiveDevice] = useState<VisualDeviceVariant>(firstDevice)
  useLayoutEffect(() => {
    const viewportDevice = () => {
      const ua = navigator.userAgent || ''
      const fromUa = liveVisualDeviceVisibleInUserAgent(ua)
      const cssWidth =
        window.innerWidth || document.documentElement.clientWidth || 0
      return (
        forceDevice ||
        resolveLiveVisualRequestDevice({
          viewportWidth:
            fromUa === 'mobile' || fromUa === 'tablet'
              ? cssWidth
              : window.outerWidth || cssWidth,
          devicePixelRatio: window.devicePixelRatio || 0,
          userAgent: ua,
          maxTouchPoints: navigator.maxTouchPoints || 0,
        })
      )
    }
    const choose = () => {
      const requested = viewportDevice()
      if (!availableDevices.length || availableDevices.includes(requested)) {
        setActiveDevice((current) => (current === requested ? current : requested))
      }
      if (forceDevice) return
      if (requested === initialDevice) {
        try {
          sessionStorage.removeItem('pw-live-device-reload')
        } catch {
          /* private mode */
        }
        return
      }
      if (!initialDevice || htmlByDevice?.[requested]) return
      try {
        const flag = sessionStorage.getItem('pw-live-device-reload')
        if (flag === requested) return
        sessionStorage.setItem('pw-live-device-reload', requested)
      } catch {
        /* private mode */
      }
      const uaVisible = liveVisualDeviceVisibleInUserAgent(navigator.userAgent || '')
      if (uaVisible === 'mobile' || uaVisible === 'tablet') {
        document.cookie = `${PARTNER_LIVE_DEVICE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
      } else {
        document.cookie = `${PARTNER_LIVE_DEVICE_COOKIE}=${requested}; Path=/; Max-Age=1800; SameSite=Lax`
      }
      window.location.reload()
    }
    choose()
    if (forceDevice) return
    window.addEventListener('resize', choose)
    return () => window.removeEventListener('resize', choose)
  }, [availableDevices, forceDevice, htmlByDevice, initialDevice])
  const selectedHtml =
    (htmlByDevice && htmlByDevice[activeDevice]) ||
    (forceDevice && !deviceHtmlAlreadyIsolated
      ? isolateVisualHtmlForDevice(html, forceDevice) || html
      : html)
  const hideEmbedFab = hideChatLauncher !== false || htmlHasChromeChatMua(selectedHtml)
  const devicePreview = Boolean(forceDevice)
  const desktopLocked = activeDevice === 'desktop' || activeDevice === 'laptop'
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
    forceDevice ? activeDevice : desktopWindowLock ? 'desktop' : null
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
  const previewHtml = hideChatLaunchersInHtml(selectedHtml, hideEmbedFab)
  const revision = visualHtmlRevision(previewHtml, activeDevice)
  const visualPageKind = extractVisualHtmlPageKind(previewHtml)
  const visualLook = extractVisualHtmlLook(previewHtml)
  useLayoutEffect(() => {
    if (!inlineHtml) return
    const root = document.documentElement
    root.setAttribute('data-pw-edit-device', activeDevice)
    root.setAttribute('data-pw-scene-lock', activeDevice)
    if (visualLook) root.setAttribute('data-pw-look', visualLook)
    else root.removeAttribute('data-pw-look')
    const faviconHref = readVisualHtmlFaviconHref(previewHtml)
    if (faviconHref) applyLiveDocumentFavicon(faviconHref)
    const apply = (window as Window & { __pwSceneCenterApply?: () => void }).__pwSceneCenterApply
    if (typeof apply === 'function') apply()
    return () => {
      if (!visualLook) return
      if (root.getAttribute('data-pw-look') === visualLook) root.removeAttribute('data-pw-look')
    }
  }, [activeDevice, inlineHtml, previewHtml, selectedHtml, visualLook])
  useLayoutEffect(() => {
    if (!inlineHtml || !visualPageKind) return
    const root = document.documentElement
    root.setAttribute('data-pw-page', visualPageKind)
    return () => {
      if (root.getAttribute('data-pw-page') === visualPageKind) {
        root.removeAttribute('data-pw-page')
      }
    }
  }, [inlineHtml, visualPageKind, revision])
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
        <PartnerSiteInlineVisualScripts revision={revision} />
        <div
          key={revision}
          data-pw-inline-visual-root="1"
          data-pw-page={visualPageKind || undefined}
          data-pw-look={visualLook || undefined}
          data-pw-active-device={activeDevice}
          data-pw-runtime-revision={revision}
          className="bg-white"
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
            ? 'flex min-h-screen justify-center overflow-x-auto bg-neutral-200'
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
              ? 'mx-auto block h-[100dvh] shrink-0 border-0 bg-white shadow-lg'
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
