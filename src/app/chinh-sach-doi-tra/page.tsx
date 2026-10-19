import type { Metadata } from 'next'
import { LegalPageDocument } from '@/components/legal/legal-documents'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildMetadata } from '@/lib/seo'

const RETURN_POLICY_URL = 'https://nanoai.vn/chinh-sach-doi-tra'

const returnPolicyJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'OnlineStore',
  name: 'NanoAI',
  url: 'https://nanoai.vn',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    email: 'support@nanoai.vn',
    availableLanguage: ['Vietnamese', 'English'],
  },
  hasMerchantReturnPolicy: {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'VN',
    returnPolicyCountry: 'VN',
    merchantReturnLink: RETURN_POLICY_URL,
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: 30,
    itemCondition: [
      'https://schema.org/NewCondition',
      'https://schema.org/UsedCondition',
      'https://schema.org/DamagedCondition',
    ],
    returnFees: 'https://schema.org/FreeReturn',
    customerRemorseReturnFees: 'https://schema.org/FreeReturn',
    itemDefectReturnFees: 'https://schema.org/FreeReturn',
    refundType: 'https://schema.org/FullRefund',
    restockingFee: 0,
  },
}

export function generateMetadata(): Metadata {
  const { t } = getServerDictionary()
  const path = '/chinh-sach-doi-tra'
  return buildMetadata({
    title: t.legal.returns.pageTitle,
    description: t.legal.returns.metaDescription,
    path,
    keywords: [
      'chính sách đổi trả',
      'hoàn tiền',
      'return policy',
      'NanoAI',
      '退款',
      '返金',
      '환불',
    ],
  })
}

export default function ReturnPolicyPage() {
  const { t } = getServerDictionary()
  return (
    <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(returnPolicyJsonLd) }}
      />
      <header className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight">{t.legal.returns.pageTitle}</h1>
        <p className="text-muted-foreground">{t.legal.returns.metaDescription}</p>
      </header>
      <div className="prose prose-neutral dark:prose-invert max-w-none pt-6">
        <LegalPageDocument doc={t.legal.returns} />
      </div>
    </div>
  )
}
