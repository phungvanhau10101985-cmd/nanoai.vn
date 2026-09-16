import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { fetchGuestAccountEmailByIdPg } from '@/lib/db/messaging-guest-pg'
import {
  decodePartnerShopCartAddSkuParam,
  isGuestCartAddFromNanoAi,
} from '@/lib/messaging/guest-purchase-flow'
import { PartnerSiteCartAddClient } from '@/components/partner-website/shop/partner-site-cart-add-client'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { loadSiteProductForCartAddSku } from '@/lib/partner-website/shop/load-site-product-for-cart-add'
import { peekSiteVisitorAccountKey } from '@/lib/partner-website/shop/partner-site-personalization'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { applyPartnerStorefrontSaleFaces, loadPartnerSiteSaleOverlay } from '@/lib/partner-website/promotions/partner-site-sale-attach'

type Props = {
  params: Promise<{ slug: string; sku: string[] }>
  searchParams: Promise<{ from?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, sku } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({
      title: 'Cart',
      description: 'Cart',
      path: `/site/${slug}/cart/add/${sku.map(encodeURIComponent).join('/')}`,
      noIndex: true,
    })
  }
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${shop.site.title} — Cart`,
    description: shop.site.partnerDisplayName,
    path: '/cart',
    noIndex: true,
  })
}

export const dynamic = 'force-dynamic'

export default async function PartnerSiteCartAddPage({ params, searchParams }: Props) {
  const { slug, sku: skuParts } = await params
  const query = await searchParams
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()
  const sku = decodePartnerShopCartAddSkuParam(skuParts)
  const mapped = sku
    ? await loadSiteProductForCartAddSku({
        partnerId: shop.partnerId,
        siteSlug: shop.site.siteSlug,
        sku,
      })
    : null
  const overlay = await loadPartnerSiteSaleOverlay(shop.partnerId).catch(() => null)
  const accountKey = await peekSiteVisitorAccountKey()
  const sessionUser = await getEmailSessionUser()
  const guestEmail = sessionUser?.email?.trim()
    ? sessionUser.email.trim().toLowerCase()
    : /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountKey)
      ? (await fetchGuestAccountEmailByIdPg(shop.partnerId, accountKey).catch(() => null))?.emailNormalized
      : null
  const product = mapped
    ? (
        await applyPartnerStorefrontSaleFaces([mapped], {
          partnerId: shop.partnerId,
          accountKey,
          linkedUserId: sessionUser?.id ?? null,
          emailNormalized: guestEmail,
          overlay,
        })
      )[0] ?? mapped
    : null

  return (
    <PartnerSiteCartAddClient
      siteSlug={shop.site.siteSlug}
      partnerSlug={shop.partnerSlug}
      locale={shop.site.locale}
      product={product}
      fromNanoAi={isGuestCartAddFromNanoAi(query.from)}
    />
  )
}
