import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { isCatalogShopper } from '@/lib/catalog/catalog-shopper'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'
import { getFeatureSeo, buildFeatureFaqJsonLd } from '@/lib/feature-seo'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { HomeworkHelpLanding } from '@/components/student-study/homework-help-landing'
import { getServerDictionary } from '@/lib/i18n/server'
import HoTroLamBaiClient from '@/app/ho-tro-lam-bai/ho-tro-lam-bai-client'

const seo = getFeatureSeo('ho-tro-lam-bai')

/** Khớp nginx /ho-tro-lam-bai 500s. Self-host không cắt sớm hơn nginx. */
export const maxDuration = 500

export const metadata = buildMetadata({
  title: seo.pageTitle,
  description: seo.pageDescription,
  path: seo.path,
  keywords: seo.keywords,
})

export default async function HoTroLamBaiPage() {
  const sessionUser = await getEmailSessionUser()
  const { locale, t } = getServerDictionary()
  const jsonLd = buildJsonLdService(seo.serviceName, seo.serviceDescription, `${SITE_URL}/ho-tro-lam-bai`)
  const faqJsonLd = buildFeatureFaqJsonLd(seo)
  if (!isCatalogShopper(sessionUser)) {
    const loginHref = `/auth/login?next=${encodeURIComponent(seo.path)}`
    return (
      <div className="app-shell">
        <JsonLd data={jsonLd} />
        <JsonLd data={faqJsonLd} />
        <HomeworkHelpLanding copy={t.homeworkHelpLanding} loginHref={loginHref} />
        <div className="h-16 lg:hidden" aria-hidden />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <JsonLd data={jsonLd} />
      <JsonLd data={faqJsonLd} />
      <CreationToolPageShell currentHref={seo.path}>
        <h1 className="mb-4 text-2xl font-semibold tracking-tight max-md:sr-only">{t.tool.homework_help}</h1>
        <HoTroLamBaiClient locale={locale} />
      </CreationToolPageShell>
    </div>
  )
}
