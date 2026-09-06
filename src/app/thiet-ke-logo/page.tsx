import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import ThietKeLogoClientPage from './thiet-ke-logo-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'
import { getFeatureSeo, buildFeatureFaqJsonLd } from '@/lib/feature-seo'
import { FeatureSeoSection } from '@/components/feature-seo-section'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'

export const maxDuration = 180

const seo = getFeatureSeo('thiet-ke-logo')

export const metadata: Metadata = buildMetadata({
  title: seo.pageTitle,
  description: seo.pageDescription,
  path: seo.path,
  keywords: seo.keywords,
})

export default async function ThietKeLogoPage() {
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()

  const jsonLd = buildJsonLdService(
    seo.serviceName,
    seo.serviceDescription,
    `${SITE_URL}/thiet-ke-logo`
  )
  const faqJsonLd = buildFeatureFaqJsonLd(seo)

  return (
    <div className="app-shell">
      <JsonLd data={jsonLd} />
      <JsonLd data={faqJsonLd} />
      <CreationToolPageShell currentHref={seo.path}>
        <ThietKeLogoClientPage />
      </CreationToolPageShell>
      <FeatureSeoSection seo={seo} />
    </div>
  )
}
