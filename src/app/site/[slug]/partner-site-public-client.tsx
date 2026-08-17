'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { PartnerSiteChatWidgetProvider } from '@/components/partner-website/shop/partner-site-chat-widget-provider'
import type { WebLocale } from '@/lib/i18n/config'
import {
  isolateVisualHtmlForDevice,
  visualDevicePreviewFrameStyle,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'

function readForcedDevice(search: URLSearchParams | null): 'mobile' | 'tablet' | 'desktop' | null {
  const raw = search?.get('pw-device') || ''
  if (raw === 'mobile' || raw === 'tablet' || raw === 'desktop') return raw
  return null
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
  initialDevice?: 'mobile' | 'tablet' | 'desktop' | null
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
  initialDevice?: 'mobile' | 'tablet' | 'desktop' | null
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
}: {
  html: string
  allowScripts?: boolean
  chatPath: string
  shopName: string
  logoUrl?: string | null
  locale: WebLocale
  inlineHtml?: boolean
  forceDevice: 'mobile' | 'tablet' | 'desktop' | null
}) {
  const compactPreview = forceDevice === 'mobile' || forceDevice === 'tablet'
  const desktopLocked = forceDevice === 'desktop'
  const previewFrameStyle = visualDevicePreviewFrameStyle(forceDevice)
  const previewHtml = forceDevice ? isolateVisualHtmlForDevice(html, forceDevice) || html : html
  /** Desktop + F12 must stay in an iframe: in-page HTML uses the shrunk window for media queries. */
  if (inlineHtml && !compactPreview && !desktopLocked) {
    return (
      <PartnerSiteChatWidgetProvider
        chatPath={chatPath}
        shopName={shopName}
        logoUrl={logoUrl}
        locale={locale}
        listenLandingPostMessage
      >
        <div className="min-h-screen bg-white" dangerouslySetInnerHTML={{ __html: previewHtml }} />
      </PartnerSiteChatWidgetProvider>
    )
  }

  const sandbox = allowScripts
    ? 'allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms'
    : 'allow-same-origin allow-popups allow-popups-to-escape-sandbox'
  return (
    <PartnerSiteChatWidgetProvider
      chatPath={chatPath}
      shopName={shopName}
      logoUrl={logoUrl}
      locale={locale}
      listenLandingPostMessage
    >
      <div
        className={
          compactPreview
            ? 'flex min-h-screen justify-center bg-neutral-200'
            : desktopLocked
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
              : desktopLocked
                ? 'block h-[100dvh] border-0 bg-white'
                : 'fixed inset-0 h-full w-full border-0 bg-white'
          }
          style={compactPreview || desktopLocked ? previewFrameStyle : undefined}
        />
      </div>
    </PartnerSiteChatWidgetProvider>
  )
}
