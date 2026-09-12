'use client'

import Link from 'next/link'
import type { WebLocale } from '@/lib/i18n/config'
import { shopCardDisplaySrc } from '@/lib/partner-website/shop/inventory-shop-detail'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { PW_EL } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import {
  PartnerSiteSaleMediaMarks,
  PartnerSiteSalePriceBlock,
} from '@/components/partner-website/shop/partner-site-sale-face'

type SaleCardProduct = Parameters<typeof PartnerSiteSaleMediaMarks>[0]['product']

/** Listing / search / category card — 188 SimpleProductCard: heart + ★ + Đã bán, no Chi tiết. */
export type PartnerSiteListingCardProduct = {
  id?: string
  inventory_id?: string
  name?: string
  detailPath?: string
  detail_path?: string
  product_url?: string
  imageUrl?: string | null
  image_url?: string | null
  priceHint?: string | null
  price_hint?: string | null
  ratingScore?: number | null
  rating_score?: number | null
  purchasesCount?: number | null
  purchases_count?: number | null
  priceAmount?: number | null
  salePriceAmount?: number | null
  saleStartsAt?: string | null
  saleEndsAt?: string | null
  isClearance?: boolean
  siteSalePhase?: 'off' | 'teaser' | 'active' | null
  siteSalePercent?: number | null
  siteSaleExpectedPrice?: number | null
  siteSale?: unknown
  birthdayOfferPercent?: number | null
  birthdayOfferEndsAt?: string | null
  birthdayOffer?: { percent?: number; countdownTo?: string | null } | null
}

function listingCardId(product: PartnerSiteListingCardProduct): string {
  return String(product.id || product.inventory_id || '').trim()
}

function listingCardHref(product: PartnerSiteListingCardProduct, href?: string): string {
  return String(href || product.detailPath || product.detail_path || product.product_url || '#').trim() || '#'
}

function listingCardImage(product: PartnerSiteListingCardProduct): string {
  const raw = String(product.imageUrl || product.image_url || '').trim()
  return shopCardDisplaySrc(raw) || raw
}

export function listingCardRating(product: PartnerSiteListingCardProduct): number {
  const n = Number(product.ratingScore ?? product.rating_score)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function listingCardSold(product: PartnerSiteListingCardProduct): number {
  return Math.max(0, Math.round(Number(product.purchasesCount ?? product.purchases_count) || 0))
}

const HEART_PATH =
  'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'

export function PartnerSiteListingFavoriteButton({
  inventoryId,
  label,
  pressed,
  onClick,
}: {
  inventoryId: string
  label: string
  pressed?: boolean
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type="button"
      className="pw-rec-fav"
      {...(onClick ? {} : { 'data-pw-favorite': '1' })}
      data-inventory-id={inventoryId || undefined}
      aria-pressed={pressed ? 'true' : 'false'}
      aria-label={label}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick?.(event)
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={HEART_PATH} />
      </svg>
    </button>
  )
}

export function PartnerSiteListingCardStats({
  product,
  locale,
}: {
  product: PartnerSiteListingCardProduct
  locale: WebLocale
}) {
  const t = getPartnerSiteShopCopy(locale)
  const rating = listingCardRating(product)
  const sold = listingCardSold(product)
  return (
    <div className="pw-rec-stats">
      <span>★ {rating.toFixed(1)}</span>
      <span>
        {t.pdpPurchasesLabel}: {sold}
      </span>
    </div>
  )
}

export function PartnerSiteListingProductCard({
  locale,
  product,
  href,
  className = 'pw-shop-card pw-product-card',
  newBadge,
  favorited,
  onFavorite,
}: {
  locale: WebLocale
  product: PartnerSiteListingCardProduct
  href?: string
  className?: string
  newBadge?: boolean
  favorited?: boolean
  onFavorite?: (event: React.MouseEvent<HTMLButtonElement>) => void
}) {
  const t = getPartnerSiteShopCopy(locale)
  const id = listingCardId(product)
  const dest = listingCardHref(product, href)
  const img = listingCardImage(product)
  const name = String(product.name || '').trim()
  const priceHint = product.priceHint ?? product.price_hint ?? null
  return (
    <article
      className={className}
      data-pw-el={PW_EL.card}
      data-inventory-id={id || undefined}
      data-pw-actions-ready="1"
    >
      <Link className="pw-product-card-hit" href={dest} aria-label={name || dest} tabIndex={-1} />
      <div className="pw-product-card-media" data-pw-el={PW_EL.cardMedia}>
        {img ? <img src={img} alt="" loading="lazy" decoding="async" /> : null}
        <PartnerSiteSaleMediaMarks product={product as SaleCardProduct} locale={locale} />
        {newBadge ? <span className="pw-badge-new">NEW</span> : null}
        {id ? (
          <PartnerSiteListingFavoriteButton
            inventoryId={id}
            label={t.favoriteAdd}
            pressed={favorited}
            onClick={onFavorite}
          />
        ) : null}
      </div>
      <div className="pw-shop-card-body pw-product-card-body">
        <h3 data-pw-el={PW_EL.cardName}>{name}</h3>
        <PartnerSiteSalePriceBlock product={product as SaleCardProduct} locale={locale} fallback={priceHint} />
        <PartnerSiteListingCardStats product={product} locale={locale} />
      </div>
    </article>
  )
}
