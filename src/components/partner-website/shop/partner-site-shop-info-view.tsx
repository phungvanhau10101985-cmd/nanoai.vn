import Link from 'next/link'
import { headers } from 'next/headers'
import type { WebLocale } from '@/lib/i18n/config'
import { readPartnerCustomDomainFromHeaders } from '@/lib/auth/app-request-headers'
import {
  getPartnerSiteInfoPage,
  type PartnerSiteInfoPageKey,
} from '@/lib/partner-website/shop/partner-site-shop-info-pages'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteProductsPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

export function PartnerSiteShopInfoView({
  siteSlug,
  locale,
  pageKey,
}: {
  siteSlug: string
  locale: WebLocale
  pageKey: PartnerSiteInfoPageKey
}) {
  const block = getPartnerSiteInfoPage(pageKey, locale)
  const t = getPartnerSiteShopCopy(locale)
  const headerStore = headers()
  const customDomain = Boolean(readPartnerCustomDomainFromHeaders((name) => headerStore.get(name)))

  return (
    <article className="pw-shop-info">
      <h1>{block.title}</h1>
      {block.paragraphs.map((p) => (
        <p key={p.slice(0, 24)}>{p}</p>
      ))}
      {block.bullets?.length ? (
        <ul>
          {block.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
      {block.faq?.map((item) => (
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
    </article>
  )
}
