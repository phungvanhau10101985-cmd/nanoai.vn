import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'
import { getFeatureSeo, buildFeatureFaqJsonLd } from '@/lib/feature-seo'
import { FeatureSeoSection } from '@/components/feature-seo-section'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { getServerDictionary } from '@/lib/i18n/server'
import GiaSuAiClient from '@/app/gia-su-ai/gia-su-ai-client'

const seo = getFeatureSeo('gia-su-ai')

export const metadata = buildMetadata({
  title: seo.pageTitle,
  description: seo.pageDescription,
  path: seo.path,
  keywords: seo.keywords,
})

export default async function GiaSuAiPage() {
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()

  const { locale, t } = getServerDictionary()
  const jsonLd = buildJsonLdService(seo.serviceName, seo.serviceDescription, `${SITE_URL}/gia-su-ai`)
  const faqJsonLd = buildFeatureFaqJsonLd(seo)

  return (
    <div className="app-shell">
      <JsonLd data={jsonLd} />
      <JsonLd data={faqJsonLd} />
      <CreationToolPageShell currentHref={seo.path}>
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">{t.tool.ai_tutor}</h1>
        <GiaSuAiClient locale={locale} />
      </CreationToolPageShell>
      <FeatureSeoSection seo={seo} />
    </div>
  )
}
