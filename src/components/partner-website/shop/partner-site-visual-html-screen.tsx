import { headers } from 'next/headers'
import { PartnerSitePublicClient } from '@/app/site/[slug]/partner-site-public-client'
import { withSiteHtmlCache } from '@/lib/cache/partner-shop-cache'
import {
  readPartnerCustomDomainFromHeaders,
  readPartnerVisualDeviceFromHeaders,
} from '@/lib/auth/app-request-headers'
import type { PartnerWebsitePageKey } from '@/lib/partner-website/partner-website-page-catalog'
import type { PartnerWebsitePublicRow } from '@/lib/partner-website/partner-website-types'
import {
  injectPartnerInfoPageAdvancedSeoInHtml,
} from '@/lib/partner-website/pages/partner-info-page-advanced-seo'
import { isInfoVisualHtml, visualInfoPageCmsSlug } from '@/lib/partner-website/pages/partner-info-page-visual'
import { isPartnerTextArticlePage } from '@/lib/partner-website/pages/partner-text-article-page'
import { bindLiveProductToPdpHtml, type LivePdpBindProduct } from '@/lib/partner-website/shop/bind-live-product-to-pdp-html'
import {
  preparePartnerVisualHtmlForPublic,
  resolvePartnerVisualHtmlForTarget,
} from '@/lib/partner-website/shop/render-partner-visual-html'
import { resolvePartnerSiteAbsoluteUrl } from '@/lib/partner-website/shop/partner-site-absolute-url'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import type { PartnerSiteInfoPageKey } from '@/lib/partner-website/shop/partner-site-shop-info-pages'
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

function infoPagePublicSubpath(pageKey: PartnerWebsitePageKey | null, cmsSlug?: string | null): string {
  const slug = visualInfoPageCmsSlug(pageKey, cmsSlug)
  if (!slug) return '/'
  const builtins: PartnerSiteInfoPageKey[] = [
    'about',
    'contact',
    'faq',
    'sale',
    'shipping',
    'returns',
    'privacy',
    'terms',
    'payment',
    'thank-you',
    'stores',
    'lookbook',
    'size-guide',
    'blog',
  ]
  if (builtins.includes(slug as PartnerSiteInfoPageKey)) return `/${slug}`
  return `/pages/${encodeURIComponent(slug)}`
}

function withInfoPageAdvancedSeo(
  site: Pick<PartnerWebsitePublicRow, 'siteSlug' | 'title' | 'logoUrl' | 'locale'>,
  html: string,
  opts?: {
    pageKey?: PartnerWebsitePageKey | null
    cmsSlug?: string | null
    datePublished?: string | null
    dateModified?: string | null
    noIndex?: boolean
  }
): string {
  if (!isInfoVisualHtml(html) && !isPartnerTextArticlePage({ pageKey: opts?.pageKey, cmsSlug: opts?.cmsSlug, html })) {
    return html
  }
  const subpath = infoPagePublicSubpath(opts?.pageKey || null, opts?.cmsSlug)
  const pageUrl = resolvePartnerSiteAbsoluteUrl(site.siteSlug, subpath)
  const homeUrl = resolvePartnerSiteAbsoluteUrl(site.siteSlug, '/')
  const t = getPartnerSiteShopCopy(site.locale)
  return injectPartnerInfoPageAdvancedSeoInHtml(html, {
    pageUrl,
    homeUrl,
    siteName: site.title,
    logoUrl: site.logoUrl,
    locale: site.locale,
    homeLabel: t.navHome,
    datePublished: opts?.datePublished,
    dateModified: opts?.dateModified,
    noIndex: opts?.noIndex,
  })
}

export async function PartnerSiteVisualHtmlScreen({
  site,
  html,
  device = null,
  infoSeo,
  skipHtmlCache = false,
}: {
  site: Pick<PartnerWebsitePublicRow, 'siteSlug' | 'title' | 'logoUrl' | 'locale' | 'chatPath' | 'theme'>
  html: string
  device?: VisualDeviceVariant | null
  infoSeo?: {
    pageKey?: PartnerWebsitePageKey | null
    cmsSlug?: string | null
    datePublished?: string | null
    dateModified?: string | null
    noIndex?: boolean
  }
  /** PDP bind tồn kho sống — không cache HTML đã gắn 1 SP. */
  skipHtmlCache?: boolean
}) {
  const headerStore = headers()
  const onCustomDomain = Boolean(readPartnerCustomDomainFromHeaders((name) => headerStore.get(name)))
  const pageKey = String(infoSeo?.pageKey || infoSeo?.cmsSlug || 'page')
  const deviceKey = device || 'auto'
  const prepare = () => {
    const seoHtml = withInfoPageAdvancedSeo(site, html, infoSeo)
    return preparePartnerVisualHtmlForPublic(seoHtml, {
      siteSlug: site.siteSlug,
      locale: site.locale,
      onCustomDomain,
      pageKey: infoSeo?.pageKey,
      cmsSlug: infoSeo?.cmsSlug,
      theme: site.theme,
    })
  }
  const publicHtml = skipHtmlCache
    ? prepare()
    : await withSiteHtmlCache({
        slug: site.siteSlug,
        pageKey,
        device: deviceKey,
        extra: [
          onCustomDomain ? 'd1' : 'd0',
          infoSeo?.datePublished || '',
          infoSeo?.dateModified || '',
          infoSeo?.noIndex ? '1' : '0',
        ].join(':'),
        load: async () => prepare(),
      })

  return (
    <PartnerSitePublicClient
      html={publicHtml}
      allowScripts
      chatPath={site.chatPath}
      shopName={site.title}
      logoUrl={site.logoUrl}
      locale={site.locale}
      inlineHtml
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
  device?: VisualDeviceVariant | null,
  infoSeo?: {
    datePublished?: string | null
    dateModified?: string | null
    noIndex?: boolean
  }
) {
  if (!shouldServeVisualPageHtml(pageKey)) return null
  const html = resolvePartnerVisualHtmlForTarget(site, { kind: 'page', pageKey }, device)
  if (html.length < 40) return null
  return (
    <PartnerSiteVisualHtmlScreen
      site={site}
      html={html}
      device={device}
      infoSeo={{ pageKey, ...infoSeo }}
    />
  )
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
  return (
    <PartnerSiteVisualHtmlScreen
      site={site}
      html={html}
      device={device}
      infoSeo={{ cmsSlug: `c:${categoryPath}` }}
    />
  )
}

export function maybePartnerSiteVisualProductPage(
  site: Pick<
    PartnerWebsitePublicRow,
    'theme' | 'project' | 'htmlSource' | 'siteSlug' | 'title' | 'logoUrl' | 'locale' | 'chatPath'
  >,
  productId: string,
  device?: VisualDeviceVariant | null,
  product?: LivePdpBindProduct | null
) {
  const html = resolvePartnerVisualHtmlForTarget(site, { kind: 'product', productId }, device)
  if (html.length < 40) return null
  const bound = product
    ? bindLiveProductToPdpHtml(html, product, { locale: site.locale, siteSlug: site.siteSlug })
    : html
  return (
    <PartnerSiteVisualHtmlScreen
      site={site}
      html={bound}
      device={device}
      infoSeo={{ pageKey: 'product_detail' }}
      skipHtmlCache
    />
  )
}

export function maybePartnerSiteVisualCmsPage(
  site: Pick<
    PartnerWebsitePublicRow,
    'theme' | 'project' | 'htmlSource' | 'siteSlug' | 'title' | 'logoUrl' | 'locale' | 'chatPath'
  >,
  cmsSlug: string,
  device?: VisualDeviceVariant | null,
  infoSeo?: {
    datePublished?: string | null
    dateModified?: string | null
    noIndex?: boolean
  }
) {
  const html = resolvePartnerVisualHtmlForTarget(site, { kind: 'cms', cmsSlug }, device)
  if (html.length < 40) return null
  return (
    <PartnerSiteVisualHtmlScreen
      site={site}
      html={html}
      device={device}
      infoSeo={{ cmsSlug, ...infoSeo }}
    />
  )
}
