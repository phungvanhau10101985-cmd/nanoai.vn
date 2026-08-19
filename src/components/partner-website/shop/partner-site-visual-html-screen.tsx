import { headers } from 'next/headers'
import { PartnerSitePublicClient } from '@/app/site/[slug]/partner-site-public-client'
import {
  readPartnerCustomDomainFromHeaders,
  readPartnerVisualDeviceFromHeaders,
} from '@/lib/auth/app-request-headers'
import type { PartnerWebsitePageKey } from '@/lib/partner-website/partner-website-page-catalog'
import type { PartnerWebsitePublicRow } from '@/lib/partner-website/partner-website-types'
import {
  preparePartnerVisualHtmlForPublic,
  resolvePartnerVisualHtmlForTarget,
} from '@/lib/partner-website/shop/render-partner-visual-html'
import {
  parseVisualDeviceQuery,
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
  const publicHtml = preparePartnerVisualHtmlForPublic(html, {
    siteSlug: site.siteSlug,
    locale: site.locale,
    onCustomDomain,
  })

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
      deviceHtmlAlreadyIsolated={Boolean(device)}
      hideChatLauncher={site.theme?.hideChatLauncher}
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
  const html = resolvePartnerVisualHtmlForTarget(site, { kind: 'page', pageKey }, device)
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
  const html = resolvePartnerVisualHtmlForTarget(site, { kind: 'category', categoryPath }, device)
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
  const html = resolvePartnerVisualHtmlForTarget(site, { kind: 'product', productId }, device)
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
  const html = resolvePartnerVisualHtmlForTarget(site, { kind: 'cms', cmsSlug }, device)
  if (html.length < 40) return null
  return <PartnerSiteVisualHtmlScreen site={site} html={html} device={device} />
}
