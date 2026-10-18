import { Metadata } from 'next'
import { JsonLd } from '@/components/seo-json-ld'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { WeddingCardLanding } from '@/components/wedding/wedding-card-landing'
import { getUserOrBypass } from '@/lib/auth'
import { listWeddingBackgroundLibrary } from '@/lib/db/wedding-cards-pg'
import { getFeatureSeo, buildFeatureFaqJsonLd } from '@/lib/feature-seo'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildJsonLdService, buildMetadata, SITE_URL } from '@/lib/seo'
import { buildWeddingCommerceProductJsonLd } from '@/lib/wedding/wedding-commerce-events'
import { FeatureSeoSection } from '@/components/feature-seo-section'
import WeddingCardAiClientPage from './wedding-card-ai-client-page'

const seo = getFeatureSeo('tao-thiep-moi-cuoi-ai')

export const metadata: Metadata = buildMetadata({
  title: seo.pageTitle,
  description: seo.pageDescription,
  path: seo.path,
  keywords: seo.keywords,
})

async function loadLandingPlates(): Promise<string[]> {
  try {
    const rows = await listWeddingBackgroundLibrary(48)
    return rows
      .filter((row) => row.imageType === 'master' && row.imageUrl && !row.imageUrl.includes('private_bg'))
      .slice(0, 6)
      .map((row) => row.imageUrl)
  } catch {
    return []
  }
}

export default async function TaoThiepMoiCuoiAiPage() {
  const user = await getUserOrBypass()
  const { t } = getServerDictionary()
  const jsonLd = buildJsonLdService(seo.serviceName, seo.serviceDescription, `${SITE_URL}${seo.path}`)
  const productJsonLd = buildWeddingCommerceProductJsonLd(`${SITE_URL}${seo.path}`, seo.pageDescription)
  const faqJsonLd = buildFeatureFaqJsonLd(seo)
  const loginHref = `/auth/login?next=${encodeURIComponent(seo.path)}`
  const plates = user ? [] : await loadLandingPlates()

  return (
    <div className="app-shell">
      <JsonLd data={jsonLd} />
      <JsonLd data={productJsonLd} />
      <JsonLd data={faqJsonLd} />
      {user ? (
        <CreationToolPageShell currentHref={seo.path}>
          <WeddingCardAiClientPage />
        </CreationToolPageShell>
      ) : (
        <WeddingCardLanding copy={t.weddingCardAiLanding} loginHref={loginHref} plates={plates} />
      )}
      <FeatureSeoSection seo={seo} />
      {user ? null : <div className="h-16 lg:hidden" aria-hidden />}
    </div>
  )
}
