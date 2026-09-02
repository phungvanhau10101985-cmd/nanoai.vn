import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import { liveVisualHomeChromeShellProps } from '@/lib/partner-website/shop/live-visual-home-chrome'
import { fetchPublishedPartnerStaticPageBySlugFromPg } from '@/lib/db/messaging-partner-static-pages-pg'
import { splitStaticPageContentToParagraphs } from '@/lib/partner-website/pages/partner-static-page-types'
import {
  maybePartnerSiteVisualCmsPage,
  readVisualPreviewDevice,
  type PartnerSiteSearchParams,
} from '@/components/partner-website/shop/partner-site-visual-html-screen'
import { PW_EL, PW_PAGE, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = {
  params: Promise<{ slug: string; pageSlug: string }>
  searchParams?: PartnerSiteSearchParams
}

/** W3.4 — trang tĩnh tự do do merchant tạo qua CMS (không phải 1 trong 8 trang có sẵn). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, pageSlug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({ title: 'Page', description: 'Page', path: `/site/${slug}/pages/${pageSlug}`, noIndex: true })
  }
  const page = await fetchPublishedPartnerStaticPageBySlugFromPg(shop.partnerId, pageSlug)
  if (!page) {
    return buildPartnerSiteMetadata({
      siteSlug: shop.site.siteSlug,
      siteName: shop.site.title,
      title: shop.site.title,
      description: shop.site.partnerDisplayName,
      path: `/pages/${pageSlug}`,
      noIndex: true,
    })
  }
  const firstParagraph = splitStaticPageContentToParagraphs(page.content)[0] ?? ''
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: page.seoTitle || `${shop.site.title} — ${page.title}`,
    description: page.seoDescription || firstParagraph || page.title,
    path: `/pages/${pageSlug}`,
    noIndex: !page.seoIndex,
    image: shop.site.logoUrl,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteCustomPage({ params, searchParams }: Props) {
  const { slug, pageSlug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()

  const page = await fetchPublishedPartnerStaticPageBySlugFromPg(shop.partnerId, pageSlug)
  if (!page) notFound()
  const device = await readVisualPreviewDevice(searchParams)

  const visual = maybePartnerSiteVisualCmsPage(
    shop.site,
    page.slug,
    device
  )
  if (visual) return visual

  const paragraphs = splitStaticPageContentToParagraphs(page.content)

  return (
    <PartnerSiteShopShell
      siteSlug={shop.site.siteSlug}
      partnerSlug={shop.partnerSlug}
      title={shop.site.title}
      logoUrl={shop.site.logoUrl}
      theme={shop.site.theme}
      locale={shop.site.locale}
      chatPath={shop.site.chatPath}
      tracking={partnerSiteTrackingFromPublicRow(shop.site)}
      footerJson={shop.site.footerJson}
      navJson={shop.site.navJson}
      pageKind={PW_PAGE.info}
      {...(await liveVisualHomeChromeShellProps(shop.site, device))}
    >
      <article className="pw-shop-info" data-pw-region={PW_REGION.content}>
        <h1 data-pw-el={PW_EL.heading}>{page.title}</h1>
        {paragraphs.map((p) => (
          <p key={p.slice(0, 24)} data-pw-el={PW_EL.body}>{p}</p>
        ))}
      </article>
    </PartnerSiteShopShell>
  )
}
