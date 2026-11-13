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

export default async function TaoThiepMoiCuoiAiPage({
  searchParams,
}: {
  searchParams?: { useSample?: string; landing?: string } | Promise<{ useSample?: string; landing?: string }>
}) {
  const user = await getUserOrBypass()
  const params = searchParams ? await Promise.resolve(searchParams) : {}
  const previewLanding = process.env.NODE_ENV !== 'production' && params.landing === '1'
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
  const showLanding = !user || previewLanding
  const themes = showLanding
    ? INVITATION_OCCASION_KEYS.flatMap((occasionKey) => weddingOccasionDemos(occasionKey).map((sample) => ({
        id: sample.id,
        title: weddingSampleCardTitle(locale, sample),
        image: weddingSampleScrollStrip(sample),
        cover: sample.coverPhotoUrl,
        occasionKey,
      }))).filter((item) => item.title && item.image)
    : []

  return (
    <div className="app-shell">
      <JsonLd data={jsonLd} />
      <JsonLd data={productJsonLd} />
      <JsonLd data={faqJsonLd} />
      {showLanding ? (
        <WeddingCardLanding
          copy={t.weddingCardAiLanding}
          locale={locale}
          loginHref={loginHref}
          themes={themes}
          reviews={reviews}
          signedIn={signedIn}
        />
      ) : (
        <>
          <CreationToolPageShell currentHref={seo.path} hideAside>
            <WeddingCardAiClientPage />
          </CreationToolPageShell>
          <WeddingReviewRail reviews={reviews} signedIn={signedIn} loginHref={loginHref} locale={locale} copy={reviewCopy} />
        </>
      )}
      <FeatureSeoSection seo={seo} showCatalogPrice={false} />
      {showLanding ? <div className="h-[calc(5.25rem+env(safe-area-inset-bottom,0px))] lg:hidden" aria-hidden /> : null}
    </div>
  )
}
