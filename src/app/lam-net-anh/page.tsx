import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import LamNetAnhClientPage from './lam-net-anh-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'
import { getFeatureSeo, buildFeatureFaqJsonLd } from '@/lib/feature-seo'
import { FeatureSeoSection } from '@/components/feature-seo-section'

const seo = getFeatureSeo('lam-net-anh')

export const metadata: Metadata = buildMetadata({
  title: seo.pageTitle,
  description: seo.pageDescription,
  path: seo.path,
  keywords: seo.keywords,
})

export default async function LamNetAnhPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    seo.serviceName,
    seo.serviceDescription,
    `${SITE_URL}/lam-net-anh`
  )
  const faqJsonLd = buildFeatureFaqJsonLd(seo)

  return (
    <div className="app-shell">
      <JsonLd data={jsonLd} />
      <JsonLd data={faqJsonLd} />
      <LamNetAnhClientPage />
      <FeatureSeoSection seo={seo} />
    </div>
  )
}
