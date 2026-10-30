import { Metadata } from 'next'
import { JsonLd } from '@/components/seo-json-ld'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { WeddingCardLanding } from '@/components/wedding/wedding-card-landing'
import { getUserOrBypass } from '@/lib/auth'
import { getFeatureSeo, buildFeatureFaqJsonLd } from '@/lib/feature-seo'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildJsonLdService, buildMetadata, SITE_URL } from '@/lib/seo'
import { buildWeddingCommerceProductJsonLd } from '@/lib/wedding/wedding-commerce-events'
import { WEDDING_SAMPLE_CARDS, weddingSampleCardTitle } from '@/lib/wedding/wedding-sample-cards'
import { FeatureSeoSection } from '@/components/feature-seo-section'
import WeddingCardAiClientPage from './wedding-card-ai-client-page'

const seo = getFeatureSeo('tao-thiep-moi-cuoi-ai')

export const metadata: Metadata = buildMetadata({
  title: seo.pageTitle,
  description: seo.pageDescription,
  path: seo.path,
  keywords: seo.keywords,
})

const WEDDING_LANDING_DEMOS = [
  '/wedding/landing-demo/red-rose.png',
  '/wedding/landing-demo/rainbow.png',
  '/wedding/landing-demo/crane.png',
  '/wedding/landing-demo/peony.png',
  '/wedding/landing-demo/cream-rose.png',
]

export default async function TaoThiepMoiCuoiAiPage() {
  const user = await getUserOrBypass()
  const { locale, t } = getServerDictionary()
  const jsonLd = buildJsonLdService(seo.serviceName, seo.serviceDescription, `${SITE_URL}${seo.path}`)
  const productJsonLd = buildWeddingCommerceProductJsonLd(`${SITE_URL}${seo.path}`, seo.pageDescription)
  const faqJsonLd = buildFeatureFaqJsonLd(seo)
  const loginHref = `/auth/login?next=${encodeURIComponent(seo.path)}`
  const plates = user ? [] : [...WEDDING_LANDING_DEMOS]
  const themes = user
    ? []
    : WEDDING_SAMPLE_CARDS.map((sample) => ({
        id: sample.id,
        title: weddingSampleCardTitle(locale, sample),
        image: sample.libraryImageUrl || sample.coverPhotoUrl,
      })).filter((item) => item.title && item.image)

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
        <WeddingCardLanding copy={t.weddingCardAiLanding} loginHref={loginHref} plates={plates} themes={themes} />
      )}
      <FeatureSeoSection seo={seo} />
      {user ? null : <div className="h-16 lg:hidden" aria-hidden />}
    </div>
  )
}
