import { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'
import { FeatureSeoSection } from '@/components/feature-seo-section'
import { buildFeatureFaqJsonLd, getFeatureSeo } from '@/lib/feature-seo'

const NhacNenAiClientPage = dynamic(() => import('./nhac-nen-ai-client-page'), { ssr: false })

const seo = getFeatureSeo('nhac-nen-ai')

export const metadata: Metadata = buildMetadata({
  title: seo.pageTitle,
  description: seo.pageDescription,
  path: seo.path,
  keywords: seo.keywords,
})

export default function NhacNenAiPage() {
  const jsonLd = buildJsonLdService(seo.serviceName, seo.serviceDescription, `${SITE_URL}${seo.path}`)
  const faqJsonLd = buildFeatureFaqJsonLd(seo)

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <JsonLd data={faqJsonLd} />
      <NhacNenAiClientPage />
      <FeatureSeoSection seo={seo} />
    </div>
  )
}

