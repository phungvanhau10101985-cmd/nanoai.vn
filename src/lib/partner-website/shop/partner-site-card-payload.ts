import type { PartnerSiteShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'

/** Public list payload. Keep PDP-only text, galleries, options and product-info out. */
export function toPartnerSiteCardPayload(product: PartnerSiteShopProduct) {
  return {
    id: product.id,
    name: product.name,
    priceHint: product.priceHint,
    imageUrl: product.imageUrl,
    productUrl: product.productUrl,
    sku: product.sku,
    detailPath: product.detailPath,
    stockQty: product.stockQty,
    priceAmount: product.priceAmount ?? null,
    priceCurrency: product.priceCurrency ?? 'VND',
    salePriceAmount: product.salePriceAmount ?? null,
    saleStartsAt: product.saleStartsAt ?? null,
    saleEndsAt: product.saleEndsAt ?? null,
    isClearance: product.isClearance === true,
    siteSalePhase: product.siteSalePhase ?? 'off',
    siteSalePercent: product.siteSalePercent ?? 0,
    siteSaleExpectedPrice: product.siteSaleExpectedPrice ?? null,
    siteSale: product.siteSale ?? null,
    categoryId: product.categoryId ?? null,
    categoryPath: product.categoryPath ?? null,
    categoryL1: product.categoryL1 ?? null,
    categoryL2: product.categoryL2 ?? null,
    categoryL3: product.categoryL3 ?? null,
    remarketingId: product.remarketingId ?? null,
    likesCount: product.likesCount ?? 0,
    purchasesCount: product.purchasesCount ?? 0,
    reviewsCount: product.reviewsCount ?? 0,
    questionsCount: product.questionsCount ?? 0,
    ratingScore: product.ratingScore ?? 0,
  }
}
