import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { readPartnerCustomDomainFromHeaders } from '@/lib/auth/app-request-headers'
import { fetchMessagingPartnerContactChannelsBySiteSlugFromPg } from '@/lib/db/messaging-partners-pg'
import { fetchPartnerPaymentSettingsFromPg } from '@/lib/db/messaging-partner-orders-pg'
import { PartnerSiteShopShell } from '@/components/partner-website/shop/partner-site-shop-shell'
import { PartnerSiteWhyDeposit } from '@/components/partner-website/shop/partner-site-why-deposit'
import { readVisualPreviewDevice } from '@/components/partner-website/shop/partner-site-visual-html-screen'
import { buildMetadata } from '@/lib/seo'
import { liveVisualHomeChromeShellProps } from '@/lib/partner-website/shop/live-visual-home-chrome'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { buildPartnerSiteMetadata } from '@/lib/partner-website/shop/partner-site-seo-metadata'
import { partnerSiteTrackingFromPublicRow } from '@/lib/partner-website/shop/partner-site-tracking-from-site'
import {
  partnerSiteInfoPath,
  partnerSiteOrderDepositPath,
  partnerSiteOrdersPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { resolvePartnerShopZaloClickUrl } from '@/lib/partner-website/shop/partner-shop-chat-widgets'
import { getWhyDepositCopy } from '@/lib/partner-website/shop/why-deposit-copy'
import {
  fillWhyDeposit,
  oneWhyDepositQuery,
  safeWhyDepositOrderCode,
  safeWhyDepositOrderId,
  whyDepositPolicyFromSettings,
} from '@/lib/partner-website/shop/why-deposit'
import { PW_PAGE } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = {
  params: Promise<{ slug: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return buildMetadata({
      title: 'Deposit',
      description: 'Deposit',
      path: `/site/${slug}/tai-sao-dat-coc`,
      noIndex: true,
    })
  }
  const copy = getWhyDepositCopy(shop.site.locale)
  const shopName = shop.site.title.trim() || shop.site.partnerDisplayName || 'Shop'
  return buildPartnerSiteMetadata({
    siteSlug: shop.site.siteSlug,
    siteName: shop.site.title,
    title: `${shopName} — ${copy.pageTitle}`,
    description: fillWhyDeposit(copy.metaDescription, { shop: shopName }),
    path: '/tai-sao-dat-coc',
    image: shop.site.logoUrl,
    locale: shop.site.locale === 'vi' ? 'vi_VN' : shop.site.locale,
    type: 'article',
  })
}

export default async function PartnerSiteWhyDepositPage({ params, searchParams }: Props) {
  const { slug } = await params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) notFound()
  const sp = searchParams ? await searchParams : {}
  const orderId = safeWhyDepositOrderId(oneWhyDepositQuery(sp.order))
  const orderCode = safeWhyDepositOrderCode(oneWhyDepositQuery(sp.code))
  const headerStore = headers()
  const customDomain = Boolean(readPartnerCustomDomainFromHeaders((name) => headerStore.get(name)))
  const [payment, channels] = await Promise.all([
    fetchPartnerPaymentSettingsFromPg(shop.partnerId),
    fetchMessagingPartnerContactChannelsBySiteSlugFromPg(shop.site.siteSlug),
  ])
  const zaloUrl =
    channels?.contact_zalo_url ||
    resolvePartnerShopZaloClickUrl({
      zaloOpen: shop.site.zaloOpen,
      zaloPersonalUrl: shop.site.zaloPersonalUrl,
      zaloOaId: shop.site.zaloOaId,
    })
  const shopName = shop.site.title.trim() || shop.site.partnerDisplayName || 'Shop'
  const backHref = orderId
    ? partnerSiteOrderDepositPath(shop.site.siteSlug, orderId, { customDomain })
    : partnerSiteOrdersPath(shop.site.siteSlug, { customDomain })
  const device = await readVisualPreviewDevice()

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
      <PartnerSiteWhyDeposit
        locale={shop.site.locale}
        shopName={shopName}
        orderId={orderId}
        orderCode={orderCode}
        zaloUrl={zaloUrl}
        policy={whyDepositPolicyFromSettings(payment)}
        backHref={backHref}
        howToBuyHref={partnerSiteInfoPath(shop.site.siteSlug, 'how-to-buy', { customDomain })}
      />
    </PartnerSiteShopShell>
  )
}
