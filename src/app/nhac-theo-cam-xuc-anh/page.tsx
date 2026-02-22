import { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'
import { FeatureSeoSection } from '@/components/feature-seo-section'
import { buildFeatureFaqJsonLd, getFeatureSeo } from '@/lib/feature-seo'

const NhacTheoCamXucAnhClientPage = dynamic(() => import('./nhac-theo-cam-xuc-anh-client-page'), { ssr: false })

const seo = getFeatureSeo('nhac-theo-cam-xuc-anh')

export const metadata: Metadata = buildMetadata({
  title: seo.pageTitle,
  description: seo.pageDescription,
  path: seo.path,
  keywords: seo.keywords,
})

export default function NhacTheoCamXucAnhPage() {
  const jsonLd = buildJsonLdService(seo.serviceName, seo.serviceDescription, `${SITE_URL}${seo.path}`)
  const faqJsonLd = buildFeatureFaqJsonLd(seo)

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <JsonLd data={faqJsonLd} />
      <NhacTheoCamXucAnhClientPage />
      <FeatureSeoSection seo={seo} />
    </div>
  )
}

