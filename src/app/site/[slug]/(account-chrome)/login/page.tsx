import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { readPartnerCustomDomainFromHeaders } from '@/lib/auth/app-request-headers'
import { fetchPartnerShopSiteCustomDomainOriginPg } from '@/lib/db/messaging-partner-custom-domains-pg'
import { buildPartnerShopBrandDocumentTitle } from '@/lib/partner-website/shop/partner-shop-brand-document-title'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  extractSloganFromHtml,
  partnerShopSloganFromTheme,
} from '@/lib/partner-website/shop/partner-site-shop-slogan'
import { PartnerSiteShopLoginClient } from '@/components/partner-website/shop/partner-site-shop-login-client'
import { resolvePartnerShopSso } from '@/lib/partner-website/shop/resolve-partner-shop-sso'
import { sanitizePartnerShopReturnLocation } from '@/lib/partner-website/shop/partner-site-shop-auth-redirect'

type Props = {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ redirect?: string; next?: string }>
}

function partnerShopLoginSlogan(
  shop: Awaited<ReturnType<typeof loadPartnerSiteShopContext>>
): string {
  if (!shop) return ''
  return (
    partnerShopSloganFromTheme(shop.site.theme) || extractSloganFromHtml(shop.site.htmlSource || '')
  )
}

async function partnerShopLoginDocumentTitle(
  slug: string,
  shop: Awaited<ReturnType<typeof loadPartnerSiteShopContext>>,
  customDomainHost: string
): Promise<string> {
  let dbHost = ''
  if (!customDomainHost && shop?.partnerId) {
    const origin = await fetchPartnerShopSiteCustomDomainOriginPg(shop.partnerId).catch(() => null)
    dbHost = origin || ''
  }
  return buildPartnerShopBrandDocumentTitle({
    hostname: customDomainHost || dbHost,
    slogan: partnerShopLoginSlogan(shop),
    fallbackName: shop?.site.title || slug,
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const headerStore = headers()
  const customDomainHost = readPartnerCustomDomainFromHeaders((name) => headerStore.get(name))
  const shop = await loadPartnerSiteShopContext(slug).catch(() => null)
  const title = await partnerShopLoginDocumentTitle(slug, shop, customDomainHost)
  if (!shop) {
    return { title: { absolute: title }, robots: { index: false, follow: false } }
  }
  const site = shop.site
  return buildPartnerSiteMetadata({
    siteSlug: site.siteSlug,
    siteName: site.title,
    title,
    description: partnerShopLoginSlogan(shop) || site.partnerDisplayName,
    path: '/login',
    noIndex: true,
  })
}

export const dynamic = 'force-dynamic'

/** Login always uses React auth shell — never frozen visual HTML (form must work). */
export default async function PartnerSiteLoginPage({ params, searchParams }: Props) {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()
  const partnerSlug = shop.partnerSlug
  if (!partnerSlug.trim()) notFound()
  const sso = await resolvePartnerShopSso(shop.partnerId)
  const headerStore = headers()
  const customDomainHost = readPartnerCustomDomainFromHeaders((name) => headerStore.get(name))
  const customDomain = Boolean(customDomainHost)
  const sp = (await searchParams) ?? {}
  const initialReturnDest = sanitizePartnerShopReturnLocation(
    shop.site.siteSlug,
    sp.redirect || sp.next || '',
    { customDomain }
  )
  const documentTitle = await partnerShopLoginDocumentTitle(shop.site.siteSlug, shop, customDomainHost)

  return (
    <PartnerSiteShopLoginClient
      siteSlug={shop.site.siteSlug}
      partnerSlug={partnerSlug}
      shopTitle={shop.site.title}
      documentTitle={documentTitle}
      locale={shop.site.locale}
      googleAuthEnabled={sso.platformGoogleAuthEnabled}
      platformAuthOrigin={sso.platformAuthOrigin}
      shopRequestOrigin={customDomainHost ? `https://${customDomainHost}` : ''}
      initialReturnDest={initialReturnDest}
    />
  )
}
