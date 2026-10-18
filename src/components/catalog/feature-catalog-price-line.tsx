import { JsonLd } from '@/components/seo-json-ld'
import { catalogOfferForPath } from '@/lib/catalog/nanoai-facebook-catalog'
import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'
import { getServerDictionary } from '@/lib/i18n/server'
import { SITE_URL } from '@/lib/seo'

export function formatCatalogPriceVnd(priceVnd: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(priceVnd)}₫`
}

type Props = {
  path: string
  title?: string
  description?: string
  withSchema?: boolean
}

/** Giá nhìn thấy trên trang, khớp số tiền trong nguồn cấp dữ liệu. */
export function FeatureCatalogPriceLine({ path, title, description, withSchema = false }: Props) {
  const { t } = getServerDictionary()
  const offer = catalogOfferForPath(path)
  const priceVnd = offer?.priceVnd ?? CREDIT_UNIT_PRICE_VND
  const heading = title || offer?.title || ''
  const body = description || offer?.description || heading
  const pagePath = path.startsWith('/') ? path : `/${path}`
  const priceText = formatCatalogPriceVnd(priceVnd)
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: heading || offer?.title || 'NanoAI',
    description: body,
    brand: { '@type': 'Brand', name: 'NanoAI' },
    offers: {
      '@type': 'Offer',
      price: String(priceVnd),
      priceCurrency: 'VND',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}${pagePath}`,
    },
  }

  return (
    <div className="mx-auto mt-6 max-w-4xl lg:max-w-5xl">
      {withSchema ? <JsonLd data={productJsonLd} /> : null}
      <p className="text-sm text-muted-foreground">{t.featureCatalogOffer.priceLabel}</p>
      <p className="text-3xl font-bold tracking-tight text-foreground">{priceText}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t.featureCatalogOffer.note}</p>
    </div>
  )
}
