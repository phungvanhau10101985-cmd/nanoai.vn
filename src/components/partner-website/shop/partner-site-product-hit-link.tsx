import { shopCardDisplaySrc } from '@/lib/partner-website/shop/inventory-shop-detail'
import { partnerSiteStorefrontProductHref } from '@/lib/partner-website/shop/partner-site-shop-paths'
import type { AnchorHTMLAttributes } from 'react'

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string
  children: React.ReactNode
}

/** Real `<a href>` so first-click / soft-nav open the shop PDP. Empty href = not a link. */
export function PartnerSiteProductHitLink({ href, className, children, ...rest }: Props) {
  const dest = href.trim()
  if (!dest) return <>{children}</>
  return (
    <a href={dest} className={className} {...rest}>
      {children}
    </a>
  )
}

type HitsProps = {
  siteSlug: string
  customDomain?: boolean
  inventoryId?: string | null
  name?: string | null
  imageUrl?: string | null
  productUrl?: string | null
  className?: string
}

/** Ảnh + tên đơn/cọc → PDP shop, không theo URL 1688/Taobao. */
export function PartnerSiteStorefrontProductHits({
  siteSlug,
  customDomain,
  inventoryId,
  name,
  imageUrl,
  productUrl,
  className = 'pw-shop-order-product',
}: HitsProps) {
  const title = String(name || '').trim()
  const img = String(imageUrl || '').trim()
  if (!title && !img) return null
  const href = partnerSiteStorefrontProductHref(siteSlug, {
    inventoryId,
    name: title,
    productUrl,
    customDomain,
  })
  const src = shopCardDisplaySrc(img) || img
  return (
    <p className={className}>
      {src ? (
        <PartnerSiteProductHitLink href={href} className="pw-shop-product-hit-media" aria-label={title}>
          <img
            src={src}
            alt={title}
            className="pw-shop-order-thumb"
            width={72}
            height={72}
            loading="lazy"
            decoding="async"
          />
        </PartnerSiteProductHitLink>
      ) : null}
      {title ? (
        <PartnerSiteProductHitLink href={href} className="pw-shop-product-hit-name">
          {title}
        </PartnerSiteProductHitLink>
      ) : null}
    </p>
  )
}
