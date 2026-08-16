import { headers } from 'next/headers'
import { PartnerSitePublicClient } from '@/app/site/[slug]/partner-site-public-client'
import { readPartnerCustomDomainFromHeaders } from '@/lib/auth/app-request-headers'
import type { PartnerWebsitePageKey } from '@/lib/partner-website/partner-website-page-catalog'
import type { PartnerWebsitePublicRow } from '@/lib/partner-website/partner-website-types'
import { injectPartnerCustomDomainLinkRewriteScript } from '@/lib/partner-website/shop/inject-partner-custom-domain-link-script'
import { injectPartnerLogoHomeLinkScript } from '@/lib/partner-website/shop/inject-partner-logo-home-link'
import { injectPartnerShopRuntimeScriptsIntoHtml } from '@/lib/partner-website/shop/inject-partner-shop-runtime-scripts'
import { injectPartnerShopChromeLayoutCss } from '@/lib/partner-website/shop/partner-shop-chrome-layout-css'
import {
  resolvePublicVisualCategoryHtml,
  resolvePublicVisualCmsHtml,
  resolvePublicVisualPageHtml,
  resolvePublicVisualProductHtml,
  shouldServeVisualPageHtml,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'

export function PartnerSiteVisualHtmlScreen({
  site,
  html,
}: {
  site: Pick<PartnerWebsitePublicRow, 'siteSlug' | 'title' | 'logoUrl' | 'locale' | 'chatPath'>
  html: string
}) {
  const headerStore = headers()
  const onCustomDomain = Boolean(readPartnerCustomDomainFromHeaders((name) => headerStore.get(name)))
  const laidOut = injectPartnerLogoHomeLinkScript(
    injectPartnerShopRuntimeScriptsIntoHtml(injectPartnerShopChromeLayoutCss(html), {
      siteSlug: site.siteSlug,
      locale: site.locale,
    }),
    site.siteSlug,
    onCustomDomain
  )
  const publicHtml = onCustomDomain
    ? injectPartnerCustomDomainLinkRewriteScript(laidOut, site.siteSlug)
    : laidOut

  return (
    <PartnerSitePublicClient
      html={publicHtml}
      allowScripts
      chatPath={site.chatPath}
      shopName={site.title}
      logoUrl={site.logoUrl}
      locale={site.locale}
      inlineHtml={onCustomDomain}
    />
  )
}

export function maybePartnerSiteVisualPage(
  site: Pick<
    PartnerWebsitePublicRow,
    'theme' | 'project' | 'htmlSource' | 'siteSlug' | 'title' | 'logoUrl' | 'locale' | 'chatPath'
  >,
  pageKey: PartnerWebsitePageKey
) {
  if (!shouldServeVisualPageHtml(pageKey)) return null
  const html = resolvePublicVisualPageHtml(site, pageKey)
  if (html.length < 40) return null
  return <PartnerSiteVisualHtmlScreen site={site} html={html} />
}

export function maybePartnerSiteVisualCategoryPage(
  site: Pick<
    PartnerWebsitePublicRow,
    'theme' | 'project' | 'htmlSource' | 'siteSlug' | 'title' | 'logoUrl' | 'locale' | 'chatPath'
  >,
  categoryPath: string
) {
  const html = resolvePublicVisualCategoryHtml(site, categoryPath)
  if (html.length < 40) return null
  return <PartnerSiteVisualHtmlScreen site={site} html={html} />
}

export function maybePartnerSiteVisualProductPage(
  site: Pick<
    PartnerWebsitePublicRow,
    'theme' | 'project' | 'htmlSource' | 'siteSlug' | 'title' | 'logoUrl' | 'locale' | 'chatPath'
  >,
  productId: string
) {
  const html = resolvePublicVisualProductHtml(site, productId)
  if (html.length < 40) return null
  return <PartnerSiteVisualHtmlScreen site={site} html={html} />
}

export function maybePartnerSiteVisualCmsPage(
  site: Pick<
    PartnerWebsitePublicRow,
    'theme' | 'project' | 'htmlSource' | 'siteSlug' | 'title' | 'logoUrl' | 'locale' | 'chatPath'
  >,
  cmsSlug: string
) {
  const html = resolvePublicVisualCmsHtml(site, cmsSlug)
  if (html.length < 40) return null
  return <PartnerSiteVisualHtmlScreen site={site} html={html} />
}
