import Link from 'next/link'
import { headers } from 'next/headers'
import type { WebLocale } from '@/lib/i18n/config'
import { readPartnerCustomDomainFromHeaders } from '@/lib/auth/app-request-headers'
import {
  getPartnerSiteInfoPage,
  type PartnerSiteInfoPageKey,
} from '@/lib/partner-website/shop/partner-site-shop-info-pages'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteAccountTabPath,
  partnerSiteOrdersPath,
  partnerSiteProductsPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'

export function PartnerSiteShopInfoView({
  siteSlug,
  locale,
  pageKey,
  override,
  orderId = null,
}: {
  siteSlug: string
  locale: WebLocale
  pageKey: PartnerSiteInfoPageKey
  /** W3.4 — merchant tự ghi đè nội dung qua CMS; null/undefined = dùng nội dung mặc định hardcode. */
  override?: { title: string; paragraphs: string[] } | null
  /** W3.2 — mã đơn trên trang cảm ơn. */
  orderId?: string | null
}) {
  const block = getPartnerSiteInfoPage(pageKey, locale)
  const t = getPartnerSiteShopCopy(locale)
  const headerStore = headers()
  const customDomain = Boolean(readPartnerCustomDomainFromHeaders((name) => headerStore.get(name)))
  const title = override?.title || block.title
  const paragraphs = override?.paragraphs?.length ? override.paragraphs : block.paragraphs
  const order = orderId?.trim() || ''

  return (
    <article className="pw-shop-info">
      <h1>{title}</h1>
      {pageKey === 'thank-you' && order ? (
        <p className="pw-shop-thankyou-order">
          {t.thankYouOrderLabel}: <strong>{order}</strong>
        </p>
      ) : null}
      {paragraphs.map((p) => (
        <p key={p.slice(0, 24)}>{p}</p>
      ))}
      {!override && block.bullets?.length ? (
        <ul>
          {block.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
      {!override &&
        block.faq?.map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      {pageKey === 'sale' || pageKey === 'contact' ? (
        <p style={{ marginTop: 20 }}>
          <Link href={partnerSiteProductsPath(siteSlug, { customDomain })} className="pw-shop-btn">
            {t.navProducts}
          </Link>
        </p>
      ) : null}
      {pageKey === 'thank-you' ? (
        <p style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Link
            href={partnerSiteAccountTabPath(siteSlug, 'orders', { customDomain })}
            className="pw-shop-btn"
          >
            {t.navOrders}
          </Link>
          <Link href={partnerSiteOrdersPath(siteSlug, { customDomain })} className="pw-shop-btn pw-shop-btn-outline">
            {t.thankYouTrackCta}
          </Link>
          <Link href={partnerSiteProductsPath(siteSlug, { customDomain })} className="pw-shop-btn pw-shop-btn-outline">
            {t.backToShop}
          </Link>
        </p>
      ) : null}
    </article>
  )
}
