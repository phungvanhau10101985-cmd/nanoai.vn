import { headers } from 'next/headers'
import { PartnerSitePublicClient } from '@/app/site/[slug]/partner-site-public-client'
import { PartnerSiteLiveVisualDocument } from '@/components/partner-website/shop/partner-site-live-visual-document'
import { buildPartnerLiveDocumentStampScript } from '@/lib/partner-website/shop/inject-partner-shop-fonts'
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
import type { LivePdpBindProduct } from '@/lib/partner-website/shop/bind-live-product-to-pdp-html'
import type { LiveCategoryListingBind } from '@/lib/partner-website/shop/bind-live-category-listing-to-html'
import { stripPersonalizeBannerHostsInHtml } from '@/lib/partner-website/shop/bind-live-marketing-banner'
import { applyLiveVisualOverlays } from '@/lib/partner-website/shop/compose-live-visual-overlays'
import {
  preparePartnerVisualHtmlForPublic,
  resolvePartnerVisualHtmlForDevice,
  selectPartnerVisualHtmlDevice,
  type PartnerVisualHtmlByDevice,
  type PartnerVisualHtmlTarget,
} from '@/lib/partner-website/shop/render-partner-visual-html'
import { ensureLiveVisualWebsite } from '@/lib/partner-website/shop/load-live-visual-website'
import { inferLiveVisualRequestDevice } from '@/lib/partner-website/shop/infer-live-visual-request-device-server'
import { loadSiteLiveCategoryBind } from '@/lib/partner-website/shop/load-site-live-category-bind'
import { loadSiteLiveMarketingBanners } from '@/lib/partner-website/shop/load-site-live-marketing-banners'
import { loadSiteLiveCatalogGrids } from '@/lib/partner-website/shop/load-site-live-catalog-grids'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { loadPartnerShopLiveBrandTheme } from '@/lib/partner-website/promotions/partner-sale-icon-live'
import { resolvePartnerSiteAbsoluteUrl } from '@/lib/partner-website/shop/partner-site-absolute-url'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  PARTNER_SITE_PLATFORM_INFO_KEYS,
  type PartnerSiteInfoPageKey,
} from '@/lib/partner-website/shop/partner-site-shop-info-pages'
import { fillMissingShopVisualDeviceFiles } from '@/lib/partner-website/shop/seed-shop-template-visual-website'
import { shopBrowserChromeColor } from '@/lib/partner-website/template/partner-website-theme-tokens'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import {
  parseVisualDeviceQuery,
  shouldServeVisualPageHtml,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'
export { inferLiveVisualRequestDevice } from '@/lib/partner-website/shop/infer-live-visual-request-device-server'

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
  if (PARTNER_SITE_PLATFORM_INFO_KEYS.includes(slug as PartnerSiteInfoPageKey)) return `/${slug}`
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
    followWhenNoIndex?: boolean
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
    followWhenNoIndex: opts?.followWhenNoIndex,
  })
}

function LiveVisualDocumentStamp({
  html,
  device,
}: {
  html: string
  device?: VisualDeviceVariant | null
}) {
  const script = buildPartnerLiveDocumentStampScript(html, device)
  if (!script) return null
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}

export async function PartnerSiteVisualHtmlScreen({
  site,
  html,
  htmlByDevice,
  device = null,
  infoSeo,
  liveProduct = null,
  liveListing = null,
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
    followWhenNoIndex?: boolean
  }
  /** Bind tồn kho sau khi chọn đúng 1 máy — không bind 4 file trước khi trả HTML. */
  liveProduct?: LivePdpBindProduct | null
  /** Bind tên / breadcrumb / categoryId listing — cùng vỏ collection.html cho mọi `/c/{path}`. */
  liveListing?: LiveCategoryListingBind | null
}) {
  const headerStore = headers()
  const onCustomDomain = Boolean(readPartnerCustomDomainFromHeaders((name) => headerStore.get(name)))
  const pageKey = String(infoSeo?.pageKey || infoSeo?.cmsSlug || 'page')
  const wantsHomeBanners = pageKey === 'home'
  const hasFeaturedHost =
    /data-pw-featured-categories\s*=|\bpw-categories\b|data-pw-region=["']categories["']/i.test(html)
  const navOnly = !wantsHomeBanners && !hasFeaturedHost
  const shopCtx = await loadPartnerSiteShopContext(site.siteSlug).catch(() => null)
  const tracking = partnerSiteTrackingFromPublicRow(site)
  const trackingCacheToken = [
    'track-188-1',
    site.gtmContainerId || '',
    site.googleSearchConsoleVerify || '',
    site.googleMerchantCenterVerify || '',
    site.facebookDomainVerification || '',
    String(site.customEmbedHeadHtml?.length || 0),
    String(site.customEmbedBodyOpenHtml?.length || 0),
    String(site.customEmbedBodyCloseHtml?.length || 0),
  ].join('|')
  const [liveCategoryBind, liveMarketingBanners, liveBrand] = await Promise.all([
    loadSiteLiveCategoryBind(site.siteSlug, navOnly),
    wantsHomeBanners ? loadSiteLiveMarketingBanners(site.siteSlug) : Promise.resolve(null),
    shopCtx
      ? loadPartnerShopLiveBrandTheme({ partnerId: shopCtx.partnerId, theme: site.theme })
      : Promise.resolve({ theme: site.theme, saleIconUrl: null, cacheToken: 'off' }),
  ])
  const prepareShell = async (sourceHtml: string, sourceDevice: VisualDeviceVariant | null) => {
    const prepare = () => {
      const seoHtml = withInfoPageAdvancedSeo(site, sourceHtml, infoSeo)
      return preparePartnerVisualHtmlForPublic(seoHtml, {
        siteSlug: site.siteSlug,
        locale: site.locale,
        onCustomDomain,
        pageKey: infoSeo?.pageKey,
        cmsSlug: infoSeo?.cmsSlug,
        theme: liveBrand.theme,
        variant: sourceDevice || undefined,
        tracking,
      })
    }
    return withSiteHtmlCache({
      slug: site.siteSlug,
      pageKey,
      device: sourceDevice || 'auto',
      extra: [
        onCustomDomain ? 'd1' : 'd0',
        infoSeo?.datePublished || '',
        infoSeo?.dateModified || '',
        infoSeo?.noIndex ? '1' : '0',
        infoSeo?.followWhenNoIndex ? 'f1' : 'f0',
        'promo-home-1',
        'live-chrome-stamp-3',
        `sale-icon-${liveBrand.cacheToken}`,
        trackingCacheToken,
      ].join(':'),
      load: async () => prepare(),
    })
  }

  const inferredRequestDevice = inferLiveVisualRequestDevice()
  const requested = device || inferredRequestDevice
  const selected = htmlByDevice ? selectPartnerVisualHtmlDevice(htmlByDevice, requested) : null
  const sourceDevice = selected?.sourceDevice || device || inferredRequestDevice
  const sourceHtml = selected?.html || html
  const shellPromise = prepareShell(sourceHtml, sourceDevice)
  const gridsPromise = shopCtx
    ? loadSiteLiveCatalogGrids({
        html: sourceHtml,
        partnerId: shopCtx.partnerId,
        siteSlug: site.siteSlug,
        locale: site.locale,
        device: sourceDevice,
        liveListing,
      }).catch(() => null)
    : Promise.resolve(null)
  const [shell, liveCatalogGrids] = await Promise.all([shellPromise, gridsPromise])
  const overlaid = applyLiveVisualOverlays(shell, {
    liveProduct,
    liveListing,
    liveCategoryBind,
    liveMarketingBanners,
    liveCatalogGrids,
    locale: site.locale,
    siteSlug: site.siteSlug,
    device: sourceDevice,
  })
  const publicHtml = wantsHomeBanners ? overlaid : stripPersonalizeBannerHostsInHtml(overlaid)
  const liveDevice = device || sourceDevice
  const previewLock = Boolean(
    parseVisualDeviceQuery(readPartnerVisualDeviceFromHeaders((name) => headerStore.get(name)))
  )

  if (previewLock) {
    return (
      <>
        <LiveVisualDocumentStamp html={publicHtml} device={liveDevice} />
        <PartnerSitePublicClient
          html={publicHtml}
          allowScripts
          chatPath={site.chatPath}
          shopName={site.title}
          logoUrl={site.logoUrl}
          locale={site.locale}
          inlineHtml
          initialDevice={liveDevice}
          deviceHtmlAlreadyIsolated
          hideChatLauncher={site.theme?.hideChatLauncher}
          browserThemeColor={shopBrowserChromeColor(site.theme)}
          siteSlug={site.siteSlug}
          tracking={tracking}
        />
      </>
    )
  }

  return (
    <PartnerSiteLiveVisualDocument
      html={publicHtml}
      device={liveDevice}
      siteSlug={site.siteSlug}
      locale={site.locale}
      chatPath={site.chatPath}
      shopName={site.title}
      logoUrl={site.logoUrl}
      hideChatLauncher={site.theme?.hideChatLauncher}
      tracking={tracking}
      browserThemeColor={shopBrowserChromeColor(site.theme)}
    />
  )
}

function pageKeysForVisualTarget(target: PartnerVisualHtmlTarget): PartnerWebsitePageKey[] {
  if (target.kind === 'page') {
    return target.pageKey === 'home' ? ['home'] : ['home', target.pageKey]
  }
  if (target.kind === 'product') return ['home', 'product_detail']
  if (target.kind === 'category') return ['home', 'collection']
  return ['home']
}

type PartnerVisualSite = Pick<
  PartnerWebsitePublicRow,
  | 'theme'
  | 'project'
  | 'htmlSource'
  | 'pages'
  | 'locale'
  | 'siteSlug'
  | 'title'
  | 'logoUrl'
  | 'templateId'
  | 'chatPath'
  | 'renderMode'
>

function withFilledVisualDevices(
  site: PartnerVisualSite,
  target: PartnerVisualHtmlTarget,
  device: VisualDeviceVariant
) {
  if (site.renderMode !== 'template') return site
  const filled = fillMissingShopVisualDeviceFiles({
    project: site.project ?? { entryPath: 'index.html', files: [] },
    theme: site.theme,
    pages: site.pages,
    locale: site.locale,
    siteSlug: site.siteSlug,
    brand: site.title,
    logoUrl: site.logoUrl,
    templateId: site.templateId,
    chatPath: site.chatPath,
    htmlSource: site.htmlSource,
    pageKeys: pageKeysForVisualTarget(target),
    devices: [device],
  })
  return {
    ...site,
    project: filled.project,
    theme: filled.theme,
    htmlSource: filled.htmlSource || site.htmlSource,
  }
}

function resolveVisualTargetForScreen(
  site: PartnerVisualSite,
  target: PartnerVisualHtmlTarget,
  device: VisualDeviceVariant
): {
  html: string
  sourceDevice: VisualDeviceVariant
} | null {
  const website = withFilledVisualDevices(site, target, device)
  const selected = resolvePartnerVisualHtmlForDevice(website, target, device)
  return selected ? { html: selected.html, sourceDevice: selected.sourceDevice } : null
}

async function loadVisualTargetForScreen(
  site: PartnerVisualSite,
  target: PartnerVisualHtmlTarget,
  device?: VisualDeviceVariant | null
) {
  const requested = device || inferLiveVisualRequestDevice()
  const loaded = await ensureLiveVisualWebsite(site, target, requested)
  return resolveVisualTargetForScreen(loaded, target, requested)
}

export async function maybePartnerSiteVisualPage(
  site: PartnerVisualSite,
  pageKey: PartnerWebsitePageKey,
  device?: VisualDeviceVariant | null,
  infoSeo?: {
    datePublished?: string | null
    dateModified?: string | null
    noIndex?: boolean
  }
) {
  if (!shouldServeVisualPageHtml(pageKey)) return null
  const resolved = await loadVisualTargetForScreen(site, { kind: 'page', pageKey }, device)
  if (!resolved) return null
  return (
    <PartnerSiteVisualHtmlScreen
      site={site}
      html={resolved.html}
      device={resolved.sourceDevice}
      infoSeo={{ pageKey, ...infoSeo }}
    />
  )
}

export async function maybePartnerSiteVisualCategoryPage(
  site: PartnerVisualSite,
  categoryPath: string,
  device?: VisualDeviceVariant | null,
  liveListing?: LiveCategoryListingBind | null,
  infoSeo?: { noIndex?: boolean; followWhenNoIndex?: boolean }
) {
  const resolved = await loadVisualTargetForScreen(site, { kind: 'category', categoryPath }, device)
  if (!resolved) return null
  return (
    <PartnerSiteVisualHtmlScreen
      site={site}
      html={resolved.html}
      device={resolved.sourceDevice}
      infoSeo={{ pageKey: 'collection', noIndex: infoSeo?.noIndex, followWhenNoIndex: infoSeo?.followWhenNoIndex }}
      liveListing={liveListing || null}
    />
  )
}

/** Start the product shell fetch before sale/email work so PDP TTFB overlaps those queries. */
export function loadPartnerSiteVisualProductDocument(
  site: PartnerVisualSite,
  productId: string,
  device?: VisualDeviceVariant | null
) {
  return loadVisualTargetForScreen(site, { kind: 'product', productId }, device)
}

export async function maybePartnerSiteVisualProductPage(
  site: PartnerVisualSite,
  productId: string,
  device?: VisualDeviceVariant | null,
  product?: LivePdpBindProduct | null
) {
  const resolved = await loadVisualTargetForScreen(site, { kind: 'product', productId }, device)
  if (!resolved) return null
  return (
    <PartnerSiteVisualHtmlScreen
      site={site}
      html={resolved.html}
      device={resolved.sourceDevice}
      infoSeo={{ pageKey: 'product_detail' }}
      liveProduct={product || null}
    />
  )
}

export async function maybePartnerSiteVisualCmsPage(
  site: PartnerVisualSite,
  cmsSlug: string,
  device?: VisualDeviceVariant | null,
  infoSeo?: {
    datePublished?: string | null
    dateModified?: string | null
    noIndex?: boolean
  }
) {
  const resolved = await loadVisualTargetForScreen(site, { kind: 'cms', cmsSlug }, device)
  if (!resolved) return null
  return (
    <PartnerSiteVisualHtmlScreen
      site={site}
      html={resolved.html}
      device={resolved.sourceDevice}
      infoSeo={{ cmsSlug, ...infoSeo }}
    />
  )
}
