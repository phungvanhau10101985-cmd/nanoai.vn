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
  resolvePartnerVisualHtmlVariantsForTarget,
  selectPartnerVisualHtmlDevice,
  type PartnerVisualHtmlByDevice,
  type PartnerVisualHtmlTarget,
} from '@/lib/partner-website/shop/render-partner-visual-html'
import { resolvePartnerSiteAbsoluteUrl } from '@/lib/partner-website/shop/partner-site-absolute-url'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import type { PartnerSiteInfoPageKey } from '@/lib/partner-website/shop/partner-site-shop-info-pages'
import {
  parseVisualDeviceQuery,
  shouldServeVisualPageHtml,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'
import { pwResolveCoordinateDevice } from '@/lib/partner-website/visual-editor/pw-coordinate-space'

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
  htmlByDevice,
  device = null,
  infoSeo,
  skipHtmlCache = false,
  liveProduct = null,
}: {
  site: Pick<PartnerWebsitePublicRow, 'siteSlug' | 'title' | 'logoUrl' | 'locale' | 'chatPath' | 'theme'>
  html: string
  htmlByDevice?: PartnerVisualHtmlByDevice
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
  /** Bind tồn kho sau khi chọn đúng 1 máy — không bind 4 file trước khi trả HTML. */
  liveProduct?: LivePdpBindProduct | null
}) {
  const headerStore = headers()
  const onCustomDomain = Boolean(readPartnerCustomDomainFromHeaders((name) => headerStore.get(name)))
  const pageKey = String(infoSeo?.pageKey || infoSeo?.cmsSlug || 'page')
  const prepareOne = async (sourceHtml: string, sourceDevice: VisualDeviceVariant | null) => {
    const prepare = () => {
      const seoHtml = withInfoPageAdvancedSeo(site, sourceHtml, infoSeo)
      return preparePartnerVisualHtmlForPublic(seoHtml, {
        siteSlug: site.siteSlug,
        locale: site.locale,
        onCustomDomain,
        pageKey: infoSeo?.pageKey,
        cmsSlug: infoSeo?.cmsSlug,
        theme: site.theme,
      })
    }
    if (skipHtmlCache) return prepare()
    return withSiteHtmlCache({
      slug: site.siteSlug,
      pageKey,
      device: sourceDevice || 'auto',
      extra: [
        onCustomDomain ? 'd1' : 'd0',
        infoSeo?.datePublished || '',
        infoSeo?.dateModified || '',
        infoSeo?.noIndex ? '1' : '0',
      ].join(':'),
      load: async () => prepare(),
    })
  }

  const requestViewportWidth = Number(
    headerStore.get('sec-ch-viewport-width') || headerStore.get('viewport-width') || 0
  )
  const requestDpr = Number(headerStore.get('sec-ch-dpr') || 0)
  const userAgent = headerStore.get('user-agent') || ''
  const inferredRequestDevice = Number.isFinite(requestViewportWidth) && requestViewportWidth > 0
    ? pwResolveCoordinateDevice({
        outerWidth: requestViewportWidth,
        layoutWidth: requestViewportWidth,
        devicePixelRatio: requestDpr,
      })
    : /ipad|tablet|kindle|silk/i.test(userAgent)
      ? 'tablet'
      : /mobile|iphone|ipod|android/i.test(userAgent)
        ? 'mobile'
        : 'desktop'

  const bindLive = (source: string) =>
    liveProduct
      ? bindLiveProductToPdpHtml(source, liveProduct, {
          locale: site.locale,
          siteSlug: site.siteSlug,
        })
      : source

  if (liveProduct) {
    const requested = device || inferredRequestDevice
    const selected = htmlByDevice ? selectPartnerVisualHtmlDevice(htmlByDevice, requested) : null
    const sourceDevice = selected?.sourceDevice || device || inferredRequestDevice
    const publicHtml = await prepareOne(bindLive(selected?.html || html), sourceDevice)
    return (
      <PartnerSitePublicClient
        html={publicHtml}
        allowScripts
        chatPath={site.chatPath}
        shopName={site.title}
        logoUrl={site.logoUrl}
        locale={site.locale}
        inlineHtml
        initialDevice={device || sourceDevice}
        deviceHtmlAlreadyIsolated
        hideChatLauncher={site.theme?.hideChatLauncher}
      />
    )
  }

  const preparedByDevice: PartnerVisualHtmlByDevice = {}
  if (htmlByDevice) {
    await Promise.all(
      (Object.keys(htmlByDevice) as VisualDeviceVariant[]).map(async (sourceDevice) => {
        const source = htmlByDevice[sourceDevice]
        if (!source) return
        preparedByDevice[sourceDevice] = await prepareOne(source, sourceDevice)
      })
    )
  }
  const initialSelection = htmlByDevice
    ? selectPartnerVisualHtmlDevice(preparedByDevice, inferredRequestDevice)
    : null
  const publicHtml = initialSelection?.html || (await prepareOne(html, device))

  return (
    <PartnerSitePublicClient
      html={publicHtml}
      htmlByDevice={Object.keys(preparedByDevice).length ? preparedByDevice : undefined}
      allowScripts
      chatPath={site.chatPath}
      shopName={site.title}
      logoUrl={site.logoUrl}
      locale={site.locale}
      inlineHtml
      initialDevice={device || initialSelection?.sourceDevice || null}
      deviceHtmlAlreadyIsolated={Boolean(device)}
      hideChatLauncher={site.theme?.hideChatLauncher}
    />
  )
}

function resolveVisualTargetForScreen(
  site: Pick<
    PartnerWebsitePublicRow,
    'theme' | 'project' | 'htmlSource'
  >,
  target: PartnerVisualHtmlTarget,
  device?: VisualDeviceVariant | null
): {
  html: string
  htmlByDevice?: PartnerVisualHtmlByDevice
  sourceDevice?: VisualDeviceVariant
} | null {
  const variants = resolvePartnerVisualHtmlVariantsForTarget(site, target)
  if (device) {
    const selected = selectPartnerVisualHtmlDevice(variants, device)
    return selected
      ? { html: selected.html, sourceDevice: selected.sourceDevice }
      : null
  }
  const initial = selectPartnerVisualHtmlDevice(variants, 'desktop')
  return initial ? { html: initial.html, htmlByDevice: variants } : null
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
  const resolved = resolveVisualTargetForScreen(site, { kind: 'page', pageKey }, device)
  if (!resolved) return null
  return (
    <PartnerSiteVisualHtmlScreen
      site={site}
      html={resolved.html}
      htmlByDevice={resolved.htmlByDevice}
      device={device ? resolved.sourceDevice : null}
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
  const resolved = resolveVisualTargetForScreen(site, { kind: 'category', categoryPath }, device)
  if (!resolved) return null
  return (
    <PartnerSiteVisualHtmlScreen
      site={site}
      html={resolved.html}
      htmlByDevice={resolved.htmlByDevice}
      device={device ? resolved.sourceDevice : null}
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
  const resolved = resolveVisualTargetForScreen(site, { kind: 'product', productId }, device)
  if (!resolved) return null
  return (
    <PartnerSiteVisualHtmlScreen
      site={site}
      html={resolved.html}
      htmlByDevice={resolved.htmlByDevice}
      device={device ? resolved.sourceDevice : null}
      infoSeo={{ pageKey: 'product_detail' }}
      skipHtmlCache
      liveProduct={product || null}
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
  const resolved = resolveVisualTargetForScreen(site, { kind: 'cms', cmsSlug }, device)
  if (!resolved) return null
  return (
    <PartnerSiteVisualHtmlScreen
      site={site}
      html={resolved.html}
      htmlByDevice={resolved.htmlByDevice}
      device={device ? resolved.sourceDevice : null}
      infoSeo={{ cmsSlug, ...infoSeo }}
    />
  )
}
