'use client'

import { PartnerSiteChatWidgetProvider } from '@/components/partner-website/shop/partner-site-chat-widget-provider'
import type { WebLocale } from '@/lib/i18n/config'

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
  if (inlineHtml) {
    return (
      <PartnerSiteChatWidgetProvider
        chatPath={chatPath}
        shopName={shopName}
        logoUrl={logoUrl}
        locale={locale}
        listenLandingPostMessage
      >
        <div className="min-h-screen bg-white" dangerouslySetInnerHTML={{ __html: html }} />
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
      <iframe
        title="Landing page"
        srcDoc={html}
        sandbox={sandbox}
        className="fixed inset-0 h-full w-full border-0 bg-white"
      />
    </PartnerSiteChatWidgetProvider>
  )
}
