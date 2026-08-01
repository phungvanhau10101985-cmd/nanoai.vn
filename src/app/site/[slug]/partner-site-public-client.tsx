'use client'

import { HubLandingHtmlDocument } from '@/app/share/landing/[token]/hub-landing-html-document'
import { PartnerSiteChatWidgetProvider } from '@/components/partner-website/shop/partner-site-chat-widget-provider'
import type { WebLocale } from '@/lib/i18n/config'

export function PartnerSitePublicClient({
  html,
  allowScripts,
  chatPath,
  shopName,
  logoUrl,
  locale,
}: {
  html: string
  allowScripts?: boolean
  chatPath: string
  shopName: string
  logoUrl?: string | null
  locale: WebLocale
}) {
  return (
    <PartnerSiteChatWidgetProvider
      chatPath={chatPath}
      shopName={shopName}
      logoUrl={logoUrl}
      locale={locale}
      listenLandingPostMessage
    >
      <HubLandingHtmlDocument html={html} allowScripts={allowScripts} />
    </PartnerSiteChatWidgetProvider>
  )
}
