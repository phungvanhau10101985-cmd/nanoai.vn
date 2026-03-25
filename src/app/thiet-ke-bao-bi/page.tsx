import { createClient } from '@/lib/supabase/server'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import ThietKeBaoBiClientPage from './thiet-ke-bao-bi-client-page'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'
import { getFeatureSeo, buildFeatureFaqJsonLd } from '@/lib/feature-seo'
import { FeatureSeoSection } from '@/components/feature-seo-section'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'

const seo = getFeatureSeo('thiet-ke-bao-bi')

export const metadata = buildMetadata({
  title: seo.pageTitle,
  description: seo.pageDescription,
  path: seo.path,
  keywords: seo.keywords,
})

export default async function ThietKeBaoBiPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirectToLogin()

  const jsonLd = buildJsonLdService(
    seo.serviceName,
    seo.serviceDescription,
    `${SITE_URL}/thiet-ke-bao-bi`
  )
  const faqJsonLd = buildFeatureFaqJsonLd(seo)

  return (
    <div className="app-shell">
      <JsonLd data={jsonLd} />
      <JsonLd data={faqJsonLd} />
      <CreationToolPageShell currentHref={seo.path}>
        <ThietKeBaoBiClientPage />
      </CreationToolPageShell>
      <FeatureSeoSection seo={seo} />
    </div>
  )
}
