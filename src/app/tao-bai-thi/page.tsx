import { FeatureCatalogPublicOffer } from '@/components/catalog/feature-catalog-public-offer'
import { isCatalogShopper } from '@/lib/catalog/catalog-shopper'
import { getUserOrBypass } from '@/lib/auth'
import TaoBaiThiClientPage from './tao-bai-thi-client-page'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'
import { getFeatureSeo, buildFeatureFaqJsonLd } from '@/lib/feature-seo'
import { FeatureSeoSection } from '@/components/feature-seo-section'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { getServerDictionary } from '@/lib/i18n/server'

const seo = getFeatureSeo('tao-bai-thi')

export const metadata = buildMetadata({
  title: seo.pageTitle,
  description: seo.pageDescription,
  path: seo.path,
  keywords: seo.keywords,
})

export default async function TaoBaiThiPage() {
  const user = await getUserOrBypass()
  if (!isCatalogShopper(user)) {
    return (
      <div className="app-shell">
        <FeatureCatalogPublicOffer path={seo.path} title={seo.pageTitle} overview={seo.overview} />
        <FeatureSeoSection seo={seo} showCatalogPrice={false} />
      </div>
    )
  }

  const jsonLd = buildJsonLdService(
    seo.serviceName,
    seo.serviceDescription,
    `${SITE_URL}/tao-bai-thi`
  )
  const faqJsonLd = buildFeatureFaqJsonLd(seo)
  const { locale } = getServerDictionary()

  return (
    <div className="app-shell">
      <JsonLd data={jsonLd} />
      <JsonLd data={faqJsonLd} />
      <CreationToolPageShell currentHref={seo.path}>
        <TaoBaiThiClientPage initialWebLocale={locale} />
      </CreationToolPageShell>
      <FeatureSeoSection seo={seo} />
    </div>
  )
}
