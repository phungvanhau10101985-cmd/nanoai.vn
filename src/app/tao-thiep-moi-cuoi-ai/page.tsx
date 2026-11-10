import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { JsonLd } from '@/components/seo-json-ld'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { WeddingCardLanding } from '@/components/wedding/wedding-card-landing'
import { WeddingReviewRail } from '@/components/wedding/wedding-review-rail'
import { getUserOrBypass } from '@/lib/auth'
import { isCatalogShopper } from '@/lib/catalog/catalog-shopper'
import { listWeddingCardReviews } from '@/lib/wedding/wedding-reviews'
import { getFeatureSeo, buildFeatureFaqJsonLd } from '@/lib/feature-seo'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildJsonLdService, buildMetadata, SITE_URL } from '@/lib/seo'
import { buildWeddingCommerceProductJsonLd } from '@/lib/wedding/wedding-commerce-events'
import { weddingOccasionDemos, weddingSampleCardTitle, weddingSampleScrollStrip } from '@/lib/wedding/wedding-sample-cards'
import { INVITATION_OCCASION_KEYS } from '@/lib/wedding/invitation-occasion'
import { weddingGuestSampleLoginPath } from '@/lib/wedding/wedding-sample-use-target'
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

export default async function TaoThiepMoiCuoiAiPage({
  searchParams,
}: {
  searchParams?: { useSample?: string } | Promise<{ useSample?: string }>
}) {
  const user = await getUserOrBypass()
  const params = searchParams ? await Promise.resolve(searchParams) : {}
  if (!user) {
    const login = weddingGuestSampleLoginPath(params.useSample)
    if (login) redirect(login)
  }
  const { locale, t } = getServerDictionary()
  const jsonLd = buildJsonLdService(seo.serviceName, seo.serviceDescription, `${SITE_URL}${seo.path}`)
  const productJsonLd = buildWeddingCommerceProductJsonLd(`${SITE_URL}${seo.path}`, seo.pageDescription)
  const faqJsonLd = buildFeatureFaqJsonLd(seo)
  const loginHref = `/auth/login?next=${encodeURIComponent(seo.path)}`
  const signedIn = isCatalogShopper(user)
  const reviews = await listWeddingCardReviews()
  const reviewCopy = {
    title: t.weddingCardAiLanding.reviewTitle,
    lead: t.weddingCardAiLanding.reviewLead,
    placeholder: t.weddingCardAiLanding.reviewPlaceholder,
    send: t.weddingCardAiLanding.reviewSend,
    login: t.weddingCardAiLanding.reviewLogin,
    thanks: t.weddingCardAiLanding.reviewThanks,
    error: t.weddingCardAiLanding.reviewError,
  }
  const plates = user ? [] : [...WEDDING_LANDING_DEMOS]
  const themes = user
    ? []
    : INVITATION_OCCASION_KEYS.flatMap((occasionKey) => weddingOccasionDemos(occasionKey).map((sample) => ({
        id: sample.id,
        title: weddingSampleCardTitle(locale, sample),
        image: weddingSampleScrollStrip(sample),
        cover: sample.coverPhotoUrl,
        occasionKey,
      }))).filter((item) => item.title && item.image)

  return (
    <div className="app-shell">
      <JsonLd data={jsonLd} />
      <JsonLd data={productJsonLd} />
      <JsonLd data={faqJsonLd} />
      {user ? (
        <>
          <CreationToolPageShell currentHref={seo.path} hideAside>
            <WeddingCardAiClientPage />
          </CreationToolPageShell>
          <WeddingReviewRail reviews={reviews} signedIn={signedIn} loginHref={loginHref} locale={locale} copy={reviewCopy} />
        </>
      ) : (
        <WeddingCardLanding
          copy={t.weddingCardAiLanding}
          locale={locale}
          loginHref={loginHref}
          plates={plates}
          themes={themes}
          reviews={reviews}
          signedIn={signedIn}
        />
      )}
      <FeatureSeoSection seo={seo} />
      {user ? null : <div className="h-16 lg:hidden" aria-hidden />}
    </div>
  )
}
