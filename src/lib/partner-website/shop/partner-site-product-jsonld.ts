/** Google merchant listing: Product.name is 1–150 characters. */
export const PARTNER_PRODUCT_JSONLD_NAME_MAX = 150
/** Google brand attribute: Brand.name is 1–70 characters. */
export const PARTNER_PRODUCT_JSONLD_BRAND_MAX = 70
/**
 * Same window already printed on every PDP (`pdpShippingNote`: đổi trả trong 7 ngày
 * nếu lỗi hoặc không đúng mô tả).
 */
export const PARTNER_PRODUCT_RETURN_DAYS = 7
/**
 * Shipping page says the order is handled after the shop confirms, then transit
 * depends on area. This is the outer window for schema — not a same-day promise.
 * handling 1–2 days, transit 2–7 days, nationwide (`addressCountry` VN).
 */
export const PARTNER_PRODUCT_HANDLING_DAYS = { min: 1, max: 2 } as const
export const PARTNER_PRODUCT_TRANSIT_DAYS = { min: 2, max: 7 } as const

export type PartnerProductJsonLdReview = {
  authorName: string
  rating: number
  body?: string | null
  datePublished?: string | null
}

export function partnerSiteProductPlainText(value: string | null | undefined, max = 300): string {
  const text = String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`
}

/** PDP meta description: product text first, shop name only as a suffix. */
export function partnerSiteProductMetaDescription(input: {
  name?: string | null
  description?: string | null
  siteName?: string | null
  max?: number
}): string {
  const max = input.max ?? 300
  const desc = partnerSiteProductPlainText(input.description, 2000)
  const name = partnerSiteProductPlainText(input.name, 180)
  let text = desc || name
  const site = partnerSiteProductPlainText(input.siteName, 80)
  if (site && text && !text.toLowerCase().includes(site.toLowerCase())) {
    const joined = `${text} — ${site}`
    if (joined.length <= max) text = joined
  }
  if (!text) text = site
  return partnerSiteProductPlainText(text, max)
}

function clampSchemaString(value: string | null | undefined, max: number): string {
  const text = partnerSiteProductPlainText(value, 20000)
  const chars = Array.from(text)
  if (chars.length <= max) return text
  return chars.slice(0, max).join('').trimEnd()
}

function schemaPersonName(value: string | null | undefined): string | null {
  const text = clampSchemaString(value, 80)
  if (text.length < 2 || !/\p{L}/u.test(text)) return null
  return text
}

function shippingDayRange(range: { min: number; max: number }): Record<string, unknown> {
  return {
    '@type': 'QuantitativeValue',
    minValue: range.min,
    maxValue: range.max,
    unitCode: 'DAY',
  }
}

function productReviewNodes(reviews: PartnerProductJsonLdReview[] | null | undefined): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = []
  for (const review of reviews || []) {
    const authorName = schemaPersonName(review.authorName)
    const ratingValue = Math.round(Number(review.rating))
    if (!authorName || ratingValue < 1 || ratingValue > 5) continue
    const body = partnerSiteProductPlainText(review.body, 1000)
    const datePublished = /^\d{4}-\d{2}-\d{2}$/.test(String(review.datePublished || ''))
      ? String(review.datePublished)
      : ''
    nodes.push({
      '@type': 'Review',
      author: { '@type': 'Person', name: authorName },
      reviewRating: {
        '@type': 'Rating',
        ratingValue,
        bestRating: 5,
        worstRating: 1,
      },
      ...(body ? { reviewBody: body } : {}),
      ...(datePublished ? { datePublished } : {}),
    })
    if (nodes.length >= 5) break
  }
  return nodes
}

export function buildPartnerSiteProductJsonLd(input: {
  name: string
  description?: string | null
  images?: Array<string | null | undefined>
  url: string
  sku?: string | null
  brandName?: string | null
  sellerName: string
  price: number | null
  priceCurrency?: string | null
  inStock: boolean
  /** null = shop fee unknown — omit shippingDetails so the schema does not claim free shipping. */
  shippingFeeAmount: number | null
  returnPolicyUrl: string
  rating?: { average: number; total: number } | null
  /** Real reviews already shown on the PDP. Omitted when the product has none. */
  reviews?: PartnerProductJsonLdReview[] | null
}): Record<string, unknown> {
  const currency = String(input.priceCurrency || 'VND').trim() || 'VND'
  const description = partnerSiteProductPlainText(input.description, 5000)
  const images = [
    ...new Set(
      (input.images || [])
        .map((url) => String(url || '').trim())
        .filter((url) => /^https?:\/\//i.test(url))
    ),
  ].slice(0, 10)
  const sellerName =
    clampSchemaString(input.sellerName, PARTNER_PRODUCT_JSONLD_NAME_MAX) || 'Shop'
  const name =
    clampSchemaString(input.name, PARTNER_PRODUCT_JSONLD_NAME_MAX) || sellerName
  const brand =
    clampSchemaString(input.brandName, PARTNER_PRODUCT_JSONLD_BRAND_MAX) ||
    clampSchemaString(sellerName, PARTNER_PRODUCT_JSONLD_BRAND_MAX)
  const sku = String(input.sku || '').trim()
  const price = input.price != null && Number.isFinite(input.price) ? input.price : null
  const shippingFee =
    input.shippingFeeAmount != null && Number.isFinite(input.shippingFeeAmount)
      ? Math.max(0, Math.round(input.shippingFeeAmount))
      : null
  const rating = input.rating && input.rating.total > 0 ? input.rating : null
  const reviews = productReviewNodes(input.reviews)
  const ratingValue =
    rating && Number.isFinite(rating.average)
      ? Math.min(5, Math.max(1, Math.round(rating.average * 10) / 10))
      : null

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    ...(description ? { description } : {}),
    ...(images.length ? { image: images } : {}),
    url: input.url,
    ...(sku ? { sku } : {}),
    brand: { '@type': 'Brand', name: brand },
    ...(price != null
      ? {
          offers: {
            '@type': 'Offer',
            url: input.url,
            priceCurrency: currency,
            price,
            availability: input.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            seller: { '@type': 'Organization', name: sellerName },
            ...(shippingFee != null
              ? {
                  shippingDetails: {
                    '@type': 'OfferShippingDetails',
                    shippingRate: {
                      '@type': 'MonetaryAmount',
                      value: shippingFee,
                      currency,
                    },
                    shippingDestination: {
                      '@type': 'DefinedRegion',
                      addressCountry: 'VN',
                    },
                    deliveryTime: {
                      '@type': 'ShippingDeliveryTime',
                      handlingTime: shippingDayRange(PARTNER_PRODUCT_HANDLING_DAYS),
                      transitTime: shippingDayRange(PARTNER_PRODUCT_TRANSIT_DAYS),
                    },
                  },
                }
              : {}),
            hasMerchantReturnPolicy: {
              '@type': 'MerchantReturnPolicy',
              applicableCountry: 'VN',
              returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
              merchantReturnDays: PARTNER_PRODUCT_RETURN_DAYS,
              returnMethod: 'https://schema.org/ReturnByMail',
              url: input.returnPolicyUrl,
            },
          },
        }
      : {}),
    ...(rating && ratingValue != null
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue,
            reviewCount: Math.max(1, Math.round(rating.total)),
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(rating && ratingValue != null && reviews.length ? { review: reviews } : {}),
  }
}
