import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { isCatalogShopper } from '@/lib/catalog/catalog-shopper'
import { CurriculumLanding } from '@/components/curriculum/curriculum-landing'
import TaoGiaoTrinhClientPage from './tao-giao-trinh-client-page'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'
import { getFeatureSeo, buildFeatureFaqJsonLd } from '@/lib/feature-seo'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { getServerDictionary } from '@/lib/i18n/server'

const seo = getFeatureSeo('tao-giao-trinh')

export const metadata = buildMetadata({
  title: seo.pageTitle,
  description: seo.pageDescription,
  path: seo.path,
  keywords: seo.keywords,
})

export default async function TaoGiaoTrinhPage() {
  const sessionUser = await getEmailSessionUser()
  const { locale, t } = getServerDictionary()
  const jsonLd = buildJsonLdService(seo.serviceName, seo.serviceDescription, `${SITE_URL}${seo.path}`)
  const faqJsonLd = buildFeatureFaqJsonLd(seo)
  if (!isCatalogShopper(sessionUser)) {
    const loginHref = `/auth/login?next=${encodeURIComponent(seo.path)}`
    return (
      <div className="app-shell">
        <JsonLd data={jsonLd} />
        <JsonLd data={faqJsonLd} />
        <CurriculumLanding copy={t.curriculumLanding} loginHref={loginHref} />
        <div className="h-16 lg:hidden" aria-hidden />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <JsonLd data={jsonLd} />
      <JsonLd data={faqJsonLd} />
      <CreationToolPageShell currentHref={seo.path}>
        <TaoGiaoTrinhClientPage initialWebLocale={locale} />
      </CreationToolPageShell>
    </div>
  )
}
