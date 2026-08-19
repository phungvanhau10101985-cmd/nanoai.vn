import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchPublishedPartnerLandingBySiteAndSlugPg } from '@/lib/db/messaging-partner-landing-pages-pg'
import { listLandingSectionsPg } from '@/lib/db/messaging-partner-landing-sections-pg'
import { loadPartnerLandingProductSnapshots } from '@/lib/partner-website/landing/partner-landing-products'
import { buildLandingAiContext } from '@/lib/partner-website/landing/landing-ai-context'
import { renderPartnerLandingHtml } from '@/lib/partner-website/landing/render-partner-landing-html'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { PartnerSitePublicClient } from '../../partner-site-public-client'
import { PartnerSiteChatWidgetProvider } from '@/components/partner-website/shop/partner-site-chat-widget-provider'
import { LandingAiSectionsView } from '@/components/partner-website/landing/landing-ai-sections-view'
import { fetchPublishedPartnerWebsiteBySlugPg } from '@/lib/db/messaging-partner-websites-pg'
import {
  buildThemeCssVarBlock,
  rewriteThemeCssVarsInHtml,
} from '@/lib/partner-website/template/partner-website-theme-tokens'

type Props = {
  params: Promise<{ slug: string; landingSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, landingSlug } = await params
  const landing = await fetchPublishedPartnerLandingBySiteAndSlugPg(slug, landingSlug).catch(
    () => null
  )
  if (!landing) {
    return buildMetadata({
      title: 'Landing',
      description: 'Landing page',
      path: `/site/${slug}/lp/${landingSlug}`,
      noIndex: true,
    })
  }
  // L3.7 — SEO tự sinh (metaTitle/metaDescription) ưu tiên khi có, guardrail chống trùng trang danh mục.
  return buildPartnerSiteMetadata({
    siteSlug: landing.siteSlug,
    siteName: landing.title,
    title: landing.metaTitle || landing.title,
    description: landing.metaDescription || landing.briefText.slice(0, 160) || landing.title,
    path: `/lp/${landing.landingSlug}`,
    image: landing.logoUrl,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerLandingPublicPage({ params }: Props) {
  const { slug, landingSlug } = await params
  const landing = await fetchPublishedPartnerLandingBySiteAndSlugPg(slug, landingSlug).catch(
    () => null
  )
  if (!landing) notFound()

  // L3.8 — chỉ chuyển sang render React (engine section mới) khi hero đã "ready" thật — tương tự
  // điều kiện publish. Landing cũ mới mở panel "Quản lý nội dung AI" (tự bootstrap section rỗng,
  // toàn "pending") KHÔNG được đổi cách render công khai khi chưa có nội dung thật — tránh hiện
  // trang rỗng cho landing cũ đã publish bằng HTML tự do.
  const website = await fetchPublishedPartnerWebsiteBySlugPg(landing.siteSlug).catch(() => null)
  const sections = await listLandingSectionsPg(landing.id).catch(() => [])
  const heroReady = sections.some((s) => s.sectionType === 'hero' && s.status === 'ready')
  if (heroReady) {
    const context = await buildLandingAiContext(landing.partnerId, landing)
    if (context) {
      if (landing.sourceType === 'products' && context.products.length === 1 && context.products[0]?.detailPath) {
        redirect(context.products[0].detailPath)
      }
      const themeCss = website?.theme ? `:root{${buildThemeCssVarBlock(website.theme)}}` : ''
      return (
        <PartnerSiteChatWidgetProvider
          chatPath={landing.chatPath}
          shopName={landing.title}
          logoUrl={landing.logoUrl}
          locale={landing.locale}
          hideLauncher={website?.theme?.hideChatLauncher !== false}
        >
          {themeCss ? <style dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
          <LandingAiSectionsView sections={sections} context={context} />
        </PartnerSiteChatWidgetProvider>
      )
    }
  }

  const products = await loadPartnerLandingProductSnapshots({
    partnerId: landing.partnerId,
    siteSlug: landing.siteSlug,
    inventoryIds: landing.inventoryIds,
  })

  const html = renderPartnerLandingHtml({
    project: landing.project,
    htmlSource: landing.htmlSource,
    chatPath: landing.chatPath,
    siteSlug: landing.siteSlug,
    locale: landing.locale,
    products,
  })
  const themed = website?.theme ? rewriteThemeCssVarsInHtml(html, website.theme) : html

  return (
    <PartnerSitePublicClient
      html={themed}
      allowScripts
      chatPath={landing.chatPath}
      shopName={landing.title}
      logoUrl={landing.logoUrl}
      locale={landing.locale}
      hideChatLauncher={website?.theme?.hideChatLauncher}
    />
  )
}
