import { LanguageLearningLanding } from '@/components/hoc-ngoai-ngu/language-landing'
import { isCatalogShopper } from '@/lib/catalog/catalog-shopper'
import { getUserOrBypass } from '@/lib/auth'
import { redirectToPracticeRoomWhenFreeLessonsUsed } from '@/lib/hoc-ngoai-ngu/skip-landing-after-free-lessons'
import { listLanguageCoachReviews } from '@/lib/hoc-ngoai-ngu/reviews'
import { getFeatureSeo } from '@/lib/feature-seo'
import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'

const seo = getFeatureSeo('hoc-tieng-viet')
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

export default async function HocTiengVietPage() {
  await redirectToPracticeRoomWhenFreeLessonsUsed('/hoc-tieng-anh-ai/luyen-noi?hoc=vi&me=en')
  const user = await getUserOrBypass()
  const reviews = await listLanguageCoachReviews('hoc-tieng-viet')
  return (
    <div className="app-shell">
      <LanguageLearningLanding reviews={reviews} signedIn={isCatalogShopper(user)} variant="vietnamese" />
    </div>
  )
}
