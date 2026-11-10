import { TranslateDocumentLanding } from '@/components/dich-anh-tai-lieu/translate-document-landing'
import { isCatalogShopper } from '@/lib/catalog/catalog-shopper'
import { getUserOrBypass } from '@/lib/auth'
import { listDocumentTranslateReviews } from '@/lib/dich-anh-tai-lieu/reviews'
import { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { getFeatureSeo } from '@/lib/feature-seo'

const seo = getFeatureSeo('dich-anh-tai-lieu')
const pageMeta = buildMetadata({
  title: seo.pageTitle,
  description: seo.pageDescription,
  path: seo.path,
  keywords: seo.keywords,
})

export const metadata: Metadata = {
  ...pageMeta,
  title: { absolute: `${seo.pageTitle} | NanoAI` },
  openGraph: pageMeta.openGraph ? { ...pageMeta.openGraph, title: `${seo.pageTitle} | NanoAI` } : undefined,
  twitter: pageMeta.twitter ? { ...pageMeta.twitter, title: `${seo.pageTitle} | NanoAI` } : undefined,
}

export default async function DichAnhTaiLieuPage() {
  const user = await getUserOrBypass()
  const reviews = await listDocumentTranslateReviews()
  return (
    <div className="app-shell">
      <TranslateDocumentLanding reviews={reviews} signedIn={isCatalogShopper(user)} />
    </div>
  )
}
