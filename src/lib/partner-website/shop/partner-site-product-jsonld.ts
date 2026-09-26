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
  const brand = String(input.brandName || '').trim() || input.sellerName
  const sku = String(input.sku || '').trim()
  const price = input.price != null && Number.isFinite(input.price) ? input.price : null
  const shippingFee =
    input.shippingFeeAmount != null && Number.isFinite(input.shippingFeeAmount)
      ? Math.max(0, Math.round(input.shippingFeeAmount))
      : null
  const rating = input.rating && input.rating.total > 0 ? input.rating : null

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
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
            seller: { '@type': 'Organization', name: input.sellerName },
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
                  },
                }
              : {}),
            hasMerchantReturnPolicy: {
              '@type': 'MerchantReturnPolicy',
              applicableCountry: 'VN',
              url: input.returnPolicyUrl,
            },
          },
        }
      : {}),
    ...(rating
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: rating.average,
            reviewCount: rating.total,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  }
}
