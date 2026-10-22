import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { isCatalogShopper } from '@/lib/catalog/catalog-shopper'
import { CurriculumLanding } from '@/components/curriculum/curriculum-landing'
import TaoGiaoTrinhClientPage from './tao-giao-trinh-client-page'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { rewriteLegacyBunnyCdnUrl } from '@/lib/bunny-cdn-url'
import { CREDIT_UNIT_PRICE_VND } from '@/lib/credit-unit-price'
import { CURRICULUM_CONTENT_ID } from '@/lib/tracking/nanoai-platform-commerce'
import { JsonLd } from '@/components/seo-json-ld'
import { getFeatureSeo, buildFeatureFaqJsonLd } from '@/lib/feature-seo'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { getServerDictionary } from '@/lib/i18n/server'

const seo = getFeatureSeo('tao-giao-trinh')

const CATALOG_IMAGE = rewriteLegacyBunnyCdnUrl(
  'https://nanoai.b-cdn.net/catalog/feature-ads/tao-giao-trinh_1777113160093.png',
)

export const metadata = buildMetadata({
  title: seo.pageTitle,
  description: seo.pageDescription,
  path: seo.path,
  keywords: seo.keywords,
  ogImage: CATALOG_IMAGE,
})

export default async function TaoGiaoTrinhPage() {
  const sessionUser = await getEmailSessionUser()
  const { locale, t } = getServerDictionary()
  const jsonLd = buildJsonLdService(seo.serviceName, seo.serviceDescription, `${SITE_URL}${seo.path}`)
  const faqJsonLd = buildFeatureFaqJsonLd(seo)
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: seo.serviceName,
    description: seo.pageDescription,
    sku: CURRICULUM_CONTENT_ID,
    image: CATALOG_IMAGE,
    brand: { '@type': 'Brand', name: 'NanoAI' },
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}${seo.path}`,
      priceCurrency: 'VND',
      price: String(CREDIT_UNIT_PRICE_VND),
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  }
  if (!isCatalogShopper(sessionUser)) {
    const loginHref = `/auth/login?next=${encodeURIComponent(seo.path)}`
    return (
      <div className="app-shell">
        <JsonLd data={jsonLd} />
        <JsonLd data={faqJsonLd} />
        <JsonLd data={productJsonLd} />
        <CurriculumLanding copy={t.curriculumLanding} loginHref={loginHref} />
        <div className="h-16 lg:hidden" aria-hidden />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <JsonLd data={jsonLd} />
      <JsonLd data={faqJsonLd} />
      <JsonLd data={productJsonLd} />
      <CreationToolPageShell currentHref={seo.path}>
        <TaoGiaoTrinhClientPage initialWebLocale={locale} />
      </CreationToolPageShell>
    </div>
  )
}
