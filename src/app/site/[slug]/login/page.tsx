import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchPublishedPartnerWebsiteBySlugPg } from '@/lib/db/messaging-partner-websites-pg'
import { buildMetadata } from '@/lib/seo'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import { PartnerSiteShopLoginClient } from '@/components/partner-website/shop/partner-site-shop-login-client'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import { visualHomeChromeShellProps } from '@/lib/partner-website/shop/visual-home-chrome'
import { readVisualPreviewDevice, type PartnerSiteSearchParams } from '@/components/partner-website/shop/partner-site-visual-html-screen'
import { PW_PAGE } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = { params: Promise<{ slug: string }>; searchParams?: PartnerSiteSearchParams }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const site = await fetchPublishedPartnerWebsiteBySlugPg(slug, { allowDraft: true }).catch(() => null)
  if (!site) {
    return buildMetadata({ title: 'Login', description: 'Login', path: `/site/${slug}/login`, noIndex: true })
  }
  return buildPartnerSiteMetadata({
    siteSlug: site.siteSlug,
    siteName: site.title,
    title: `${site.title} — Login`,
    description: site.partnerDisplayName,
    path: '/login',
    noIndex: true,
  })
}

export const dynamic = 'force-dynamic'

/** Login always uses React auth shell — never frozen visual HTML (form must work). */
export default async function PartnerSiteLoginPage({ params, searchParams }: Props) {
  const { slug } = await params
  const site = await fetchPublishedPartnerWebsiteBySlugPg(slug, { allowDraft: true }).catch(() => null)
  if (!site) notFound()

  const shop = await loadPartnerSiteShopContext(slug)
  const device = await readVisualPreviewDevice(searchParams)
  const partnerSlug = shop?.partnerSlug ?? site.partnerSlug
  if (!partnerSlug.trim()) notFound()

  const shellSite = shop?.site ?? site

  return (
    <PartnerSiteShopShell
      siteSlug={shellSite.siteSlug}
      partnerSlug={partnerSlug}
      title={shellSite.title}
      logoUrl={shellSite.logoUrl}
      theme={shellSite.theme}
      locale={shellSite.locale}
      chatPath={shellSite.chatPath}
      tracking={partnerSiteTrackingFromPublicRow(shellSite)}
      footerJson={shellSite.footerJson}
      navJson={shellSite.navJson}
      activeNav="account"
      pageKind={PW_PAGE.account}
      hideAccountNav
      {...visualHomeChromeShellProps(shellSite, device)}
    >
      <PartnerSiteShopLoginClient
        siteSlug={shellSite.siteSlug}
        partnerSlug={partnerSlug}
        shopTitle={shellSite.title}
        locale={shellSite.locale}
      />
    </PartnerSiteShopShell>
  )
}
