import type { Metadata } from 'next'
import { LegalPageDocument } from '@/components/legal/legal-documents'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'

const shippingJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'OfferShippingDetails',
  shippingRate: {
    '@type': 'MonetaryAmount',
    value: '0',
    currency: 'VND',
  },
  shippingDestination: {
    '@type': 'DefinedRegion',
    addressCountry: 'VN',
  },
  deliveryTime: {
    '@type': 'ShippingDeliveryTime',
    handlingTime: {
      '@type': 'QuantitativeValue',
      minValue: 0,
      maxValue: 0,
      unitCode: 'DAY',
    },
    transitTime: {
      '@type': 'QuantitativeValue',
      minValue: 0,
      maxValue: 0,
      unitCode: 'DAY',
    },
  },
}

export function generateMetadata(): Metadata {
  const { t } = getServerDictionary()
  return buildMetadata({
    title: t.legal.shipping.pageTitle,
    description: t.legal.shipping.metaDescription,
    path: '/chinh-sach-giao-hang',
    keywords: ['chính sách giao hàng', 'shipping policy', 'NanoAI', '配送', '배송'],
  })
}

export default function ShippingPolicyPage() {
  const { t } = getServerDictionary()
  return (
    <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(shippingJsonLd) }} />
      <header className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight">{t.legal.shipping.pageTitle}</h1>
        <p className="text-muted-foreground">{t.legal.shipping.metaDescription}</p>
      </header>
      <div className="prose prose-neutral dark:prose-invert max-w-none pt-6">
        <LegalPageDocument doc={t.legal.shipping} />
      </div>
    </div>
  )
}
