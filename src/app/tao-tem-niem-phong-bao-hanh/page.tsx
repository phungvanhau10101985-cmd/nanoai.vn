import { buildMetadata } from '@/lib/seo'
import { getFeatureSeo, buildFeatureFaqJsonLd } from '@/lib/feature-seo'
import { JsonLd } from '@/components/seo-json-ld'
import { FeatureSeoSection } from '@/components/feature-seo-section'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { buildJsonLdService, SITE_URL } from '@/lib/seo'
import TaoTemNiemPhongBaoHanhClientPage from './tao-tem-niem-phong-bao-hanh-client-page'

const seo = getFeatureSeo('tao-tem-niem-phong-bao-hanh')

export const metadata = buildMetadata({
  title: seo.pageTitle,
  description: seo.pageDescription,
  path: seo.path,
  keywords: seo.keywords,
})

export default function TaoTemNiemPhongBaoHanhPage() {
  const jsonLd = buildJsonLdService(
    seo.serviceName,
    seo.serviceDescription,
    `${SITE_URL}/tao-tem-niem-phong-bao-hanh`
  )
  const faqJsonLd = buildFeatureFaqJsonLd(seo)

  return (
    <div className="app-shell">
      <JsonLd data={jsonLd} />
      <JsonLd data={faqJsonLd} />
      <CreationToolPageShell currentHref={seo.path}>
        <TaoTemNiemPhongBaoHanhClientPage />
      </CreationToolPageShell>
      <FeatureSeoSection seo={seo} />
    </div>
  )
}
