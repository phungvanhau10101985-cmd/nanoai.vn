import { headers } from 'next/headers'
import { PartnerSitePublicClient } from '@/app/site/[slug]/partner-site-public-client'
import {
  readPartnerCustomDomainFromHeaders,
  readPartnerVisualDeviceFromHeaders,
} from '@/lib/auth/app-request-headers'
import type { PartnerWebsitePageKey } from '@/lib/partner-website/partner-website-page-catalog'
import type { PartnerWebsitePublicRow } from '@/lib/partner-website/partner-website-types'
import { injectPartnerCustomDomainLinkRewriteScript } from '@/lib/partner-website/shop/inject-partner-custom-domain-link-script'
import { injectPartnerLogoHomeLinkScript } from '@/lib/partner-website/shop/inject-partner-logo-home-link'
import { injectPartnerShopRuntimeScriptsIntoHtml } from '@/lib/partner-website/shop/inject-partner-shop-runtime-scripts'
import { injectPartnerShopChromeLayoutCss } from '@/lib/partner-website/shop/partner-shop-chrome-layout-css'
import {
  parseVisualDeviceQuery,
  resolvePublicVisualCategoryHtml,
  resolvePublicVisualCmsHtml,
  resolvePublicVisualPageHtml,
  resolvePublicVisualProductHtml,
  shouldServeVisualPageHtml,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'

/** `?pw-device=` from Sửa nhanh → Xem. Every page must serve the file that device saved. */
export type PartnerSiteSearchParams =
  | Promise<Record<string, string | string[] | undefined>>
  | undefined

export async function readVisualPreviewDevice(
  searchParams?: PartnerSiteSearchParams
): Promise<VisualDeviceVariant | null> {
  if (searchParams) {
    const fromQuery = parseVisualDeviceQuery((await searchParams)['pw-device'])
    if (fromQuery) return fromQuery
  }
  const headerStore = headers()
  return parseVisualDeviceQuery(readPartnerVisualDeviceFromHeaders((name) => headerStore.get(name)))
}

export function PartnerSiteVisualHtmlScreen({
  site,
  html,
  device = null,
}: {
  site: Pick<PartnerWebsitePublicRow, 'siteSlug' | 'title' | 'logoUrl' | 'locale' | 'chatPath' | 'theme'>
  html: string
  device?: VisualDeviceVariant | null
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
      initialDevice={device}
      hideChatLauncher={site.theme?.hideChatLauncher === true}
    />
  )
}

export function maybePartnerSiteVisualPage(
  site: Pick<
    PartnerWebsitePublicRow,
    'theme' | 'project' | 'htmlSource' | 'siteSlug' | 'title' | 'logoUrl' | 'locale' | 'chatPath'
  >,
  pageKey: PartnerWebsitePageKey,
  device?: VisualDeviceVariant | null
) {
  if (!shouldServeVisualPageHtml(pageKey)) return null
  const html = resolvePublicVisualPageHtml(site, pageKey, device)
  if (html.length < 40) return null
  return <PartnerSiteVisualHtmlScreen site={site} html={html} device={device} />
}

export function maybePartnerSiteVisualCategoryPage(
  site: Pick<
    PartnerWebsitePublicRow,
    'theme' | 'project' | 'htmlSource' | 'siteSlug' | 'title' | 'logoUrl' | 'locale' | 'chatPath'
  >,
  categoryPath: string,
  device?: VisualDeviceVariant | null
) {
  const html = resolvePublicVisualCategoryHtml(site, categoryPath, device)
  if (html.length < 40) return null
  return <PartnerSiteVisualHtmlScreen site={site} html={html} device={device} />
}

export function maybePartnerSiteVisualProductPage(
  site: Pick<
    PartnerWebsitePublicRow,
    'theme' | 'project' | 'htmlSource' | 'siteSlug' | 'title' | 'logoUrl' | 'locale' | 'chatPath'
  >,
  productId: string,
  device?: VisualDeviceVariant | null
) {
  const html = resolvePublicVisualProductHtml(site, productId, device)
  if (html.length < 40) return null
  return <PartnerSiteVisualHtmlScreen site={site} html={html} device={device} />
}

export function maybePartnerSiteVisualCmsPage(
  site: Pick<
    PartnerWebsitePublicRow,
    'theme' | 'project' | 'htmlSource' | 'siteSlug' | 'title' | 'logoUrl' | 'locale' | 'chatPath'
  >,
  cmsSlug: string,
  device?: VisualDeviceVariant | null
) {
  const html = resolvePublicVisualCmsHtml(site, cmsSlug, device)
  if (html.length < 40) return null
  return <PartnerSiteVisualHtmlScreen site={site} html={html} device={device} />
}
