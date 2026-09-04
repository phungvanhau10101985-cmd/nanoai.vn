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
import type { LivePdpBindProduct } from '@/lib/partner-website/shop/bind-live-product-to-pdp-html'
import { applyLiveVisualOverlays } from '@/lib/partner-website/shop/compose-live-visual-overlays'
import {
  preparePartnerVisualHtmlForPublic,
  resolvePartnerVisualHtmlForDevice,
  selectPartnerVisualHtmlDevice,
  type PartnerVisualHtmlByDevice,
  type PartnerVisualHtmlTarget,
} from '@/lib/partner-website/shop/render-partner-visual-html'
import { ensureLiveVisualWebsite } from '@/lib/partner-website/shop/load-live-visual-website'
import { inferLiveVisualRequestDevice } from '@/lib/partner-website/shop/infer-live-visual-request-device'
import { loadSiteLiveCategoryBind } from '@/lib/partner-website/shop/load-site-live-category-bind'
import { resolvePartnerSiteAbsoluteUrl } from '@/lib/partner-website/shop/partner-site-absolute-url'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import type { PartnerSiteInfoPageKey } from '@/lib/partner-website/shop/partner-site-shop-info-pages'
import { fillMissingShopVisualDeviceFiles } from '@/lib/partner-website/shop/seed-shop-template-visual-website'
import {
  parseVisualDeviceQuery,
  shouldServeVisualPageHtml,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'
export { inferLiveVisualRequestDevice } from '@/lib/partner-website/shop/infer-live-visual-request-device'

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
  /** Bind tồn kho sau khi chọn đúng 1 máy — không bind 4 file trước khi trả HTML. */
  liveProduct?: LivePdpBindProduct | null
}) {
  const headerStore = headers()
  const onCustomDomain = Boolean(readPartnerCustomDomainFromHeaders((name) => headerStore.get(name)))
  const pageKey = String(infoSeo?.pageKey || infoSeo?.cmsSlug || 'page')
  const liveCategoryBind = await loadSiteLiveCategoryBind(site.siteSlug)
  const prepareShell = async (sourceHtml: string, sourceDevice: VisualDeviceVariant | null) => {
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

  const finish = (shell: string) =>
    applyLiveVisualOverlays(shell, {
      liveProduct,
      liveCategoryBind,
      locale: site.locale,
      siteSlug: site.siteSlug,
    })

  const inferredRequestDevice = inferLiveVisualRequestDevice()

  if (liveProduct) {
    const requested = device || inferredRequestDevice
    const selected = htmlByDevice ? selectPartnerVisualHtmlDevice(htmlByDevice, requested) : null
    const sourceDevice = selected?.sourceDevice || device || inferredRequestDevice
    const publicHtml = finish(await prepareShell(selected?.html || html, sourceDevice))
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
        preparedByDevice[sourceDevice] = finish(await prepareShell(source, sourceDevice))
      })
    )
  }
  const initialSelection = htmlByDevice
    ? selectPartnerVisualHtmlDevice(preparedByDevice, inferredRequestDevice)
    : null
  const publicHtml = initialSelection?.html || finish(await prepareShell(html, device))

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
  device?: VisualDeviceVariant | null
) {
  const resolved = await loadVisualTargetForScreen(site, { kind: 'category', categoryPath }, device)
  if (!resolved) return null
  return (
    <PartnerSiteVisualHtmlScreen
      site={site}
      html={resolved.html}
      device={resolved.sourceDevice}
      infoSeo={{ cmsSlug: `c:${categoryPath}` }}
    />
  )
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
