import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import ThietKeNoiNgoaiThatClientPage from './thiet-ke-noi-ngoai-that-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'
import { getFeatureSeo, buildFeatureFaqJsonLd } from '@/lib/feature-seo'
import { FeatureSeoSection } from '@/components/feature-seo-section'

const seo = getFeatureSeo('thiet-ke-noi-ngoai-that')

export const metadata: Metadata = buildMetadata({
  title: seo.pageTitle,
  description: seo.pageDescription,
  path: seo.path,
  keywords: seo.keywords,
})

export default async function ThietKeNoiNgoaiThatPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    seo.serviceName,
    seo.serviceDescription,
    `${SITE_URL}/thiet-ke-noi-ngoai-that`
  )
  const faqJsonLd = buildFeatureFaqJsonLd(seo)

  return (
    <div className="container max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <JsonLd data={jsonLd} />
      <JsonLd data={faqJsonLd} />
      <ThietKeNoiNgoaiThatClientPage />
      <FeatureSeoSection seo={seo} />
    </div>
  )
}
