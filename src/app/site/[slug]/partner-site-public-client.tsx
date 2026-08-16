'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { PartnerSiteChatWidgetProvider } from '@/components/partner-website/shop/partner-site-chat-widget-provider'
import type { WebLocale } from '@/lib/i18n/config'
import {
  isolateVisualHtmlForDevice,
  VISUAL_MOBILE_PREVIEW_PX,
  VISUAL_TABLET_PREVIEW_PX,
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
}: {
  html: string
  allowScripts?: boolean
  chatPath: string
  shopName: string
  logoUrl?: string | null
  locale: WebLocale
  /** Render landing HTML in-page (custom domain) instead of iframe — links update browser URL. */
  inlineHtml?: boolean
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
          forceDevice={null}
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
}) {
  const params = useSearchParams()
  return <PartnerSitePublicFrame {...props} forceDevice={readForcedDevice(params)} />
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
  const previewWidth = forceDevice === 'tablet' ? VISUAL_TABLET_PREVIEW_PX : VISUAL_MOBILE_PREVIEW_PX
  const previewHtml = forceDevice ? isolateVisualHtmlForDevice(html, forceDevice) || html : html
  if (inlineHtml && !compactPreview) {
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
          compactPreview ? 'flex min-h-screen justify-center bg-neutral-200' : 'min-h-screen bg-white'
        }
      >
        <iframe
          title="Landing page"
          srcDoc={previewHtml}
          sandbox={sandbox}
          className={
            compactPreview
              ? 'block h-[100dvh] max-w-full border-0 bg-white shadow-lg'
              : 'fixed inset-0 h-full w-full border-0 bg-white'
          }
          style={compactPreview ? { width: previewWidth } : undefined}
        />
      </div>
    </PartnerSiteChatWidgetProvider>
  )
}
