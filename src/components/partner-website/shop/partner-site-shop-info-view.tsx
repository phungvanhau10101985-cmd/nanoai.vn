import Link from 'next/link'
import { headers } from 'next/headers'
import type { WebLocale } from '@/lib/i18n/config'
import { readPartnerCustomDomainFromHeaders } from '@/lib/auth/app-request-headers'
import {
  ensureAdsPlatformPolicyParagraphs,
  getPartnerSiteInfoPage,
  isPartnerSiteAdsPolicyPageKey,
  type PartnerSiteInfoPageKey,
} from '@/lib/partner-website/shop/partner-site-shop-info-pages'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteAccountEditPath,
  partnerSiteAccountTabPath,
  partnerSiteHomePath,
  partnerSiteOrdersPath,
  partnerSiteProductsPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'

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
  const rawParagraphs = override?.paragraphs?.length ? override.paragraphs : block.paragraphs
  const paragraphs = isPartnerSiteAdsPolicyPageKey(pageKey)
    ? ensureAdsPlatformPolicyParagraphs(rawParagraphs, locale)
    : rawParagraphs
  const order = orderId?.trim() || ''

  return (
    <article className="pw-shop-info" data-pw-region={PW_REGION.content} data-pw-info-article="1">
      <h1 data-pw-el={PW_EL.heading} data-pw-info-title="1">{title}</h1>
      <div data-pw-info-body="1" data-pw-el={PW_EL.body}>
      {pageKey === 'thank-you' && order ? (
        <p className="pw-shop-thankyou-order" data-pw-el={PW_EL.body}>
          {t.thankYouOrderLabel}: <strong>{order}</strong>
        </p>
      ) : null}
      {paragraphs.map((p) => (
        <p key={p.slice(0, 24)} data-pw-el={PW_EL.body}>{p}</p>
      ))}
      {!override && block.bullets?.length ? (
        <ul data-pw-el={PW_EL.body}>
          {block.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
      {!override &&
        block.faq?.map((item) => (
          <details key={item.q} data-pw-el={PW_EL.faqItem}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      {pageKey === 'goi-y-tuoi-gioi' ? (
        <p style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Link
            href={partnerSiteAccountEditPath(siteSlug, { customDomain })}
            className="pw-shop-btn"
            data-pw-el={PW_EL.cta}
          >
            {t.accountEditProfile}
          </Link>
          <Link href={partnerSiteHomePath(siteSlug, { customDomain })} className="pw-shop-btn pw-shop-btn-outline" data-pw-el={PW_EL.link}>
            {t.navHome}
          </Link>
        </p>
      ) : null}
      {pageKey === 'sale' || pageKey === 'contact' ? (
        <p style={{ marginTop: 20 }}>
          <Link href={partnerSiteProductsPath(siteSlug, { customDomain })} className="pw-shop-btn" data-pw-el={PW_EL.cta}>
            {t.navProducts}
          </Link>
        </p>
      ) : null}
      {pageKey === 'thank-you' ? (
        <p style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Link
            href={partnerSiteAccountTabPath(siteSlug, 'orders', { customDomain })}
            className="pw-shop-btn"
            data-pw-el={PW_EL.cta}
          >
            {t.navOrders}
          </Link>
          <Link href={partnerSiteOrdersPath(siteSlug, { customDomain })} className="pw-shop-btn pw-shop-btn-outline" data-pw-el={PW_EL.link}>
            {t.thankYouTrackCta}
          </Link>
          <Link href={partnerSiteProductsPath(siteSlug, { customDomain })} className="pw-shop-btn pw-shop-btn-outline" data-pw-el={PW_EL.link}>
            {t.backToShop}
          </Link>
        </p>
      ) : null}
      </div>
    </article>
  )
}
