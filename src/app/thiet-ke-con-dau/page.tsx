import { buildMetadata } from '@/lib/seo'
import { getFeatureSeo, buildFeatureFaqJsonLd } from '@/lib/feature-seo'
import { JsonLd } from '@/components/seo-json-ld'
import { FeatureSeoSection } from '@/components/feature-seo-section'
import { buildJsonLdService, SITE_URL } from '@/lib/seo'
import ThietKeConDauClientPage from './thiet-ke-con-dau-client-page'

const seo = getFeatureSeo('thiet-ke-con-dau')

export const metadata = buildMetadata({
  title: seo.pageTitle,
  description: seo.pageDescription,
  path: seo.path,
  keywords: seo.keywords,
})

export default function ThietKeConDauPage() {
  const jsonLd = buildJsonLdService(
    seo.serviceName,
    seo.serviceDescription,
    `${SITE_URL}/thiet-ke-con-dau`
  )
  const faqJsonLd = buildFeatureFaqJsonLd(seo)

  return (
    <div className="app-shell">
      <JsonLd data={jsonLd} />
      <JsonLd data={faqJsonLd} />
      <ThietKeConDauClientPage />
      <FeatureSeoSection seo={seo} />
    </div>
  )
}
