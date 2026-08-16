import Link from 'next/link'
import { Metadata } from 'next'
import { JsonLd } from '@/components/seo-json-ld'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { Button } from '@/components/ui/button'
import { getUserOrBypass } from '@/lib/auth'
import { getFeatureSeo, buildFeatureFaqJsonLd } from '@/lib/feature-seo'
import { getServerDictionary } from '@/lib/i18n/server'
import { buildJsonLdService, buildMetadata, SITE_URL } from '@/lib/seo'
import { FeatureSeoSection } from '@/components/feature-seo-section'
import WeddingCardAiClientPage from './wedding-card-ai-client-page'

const seo = getFeatureSeo('tao-thiep-moi-cuoi-ai')

export const metadata: Metadata = buildMetadata({
  title: seo.pageTitle,
  description: seo.pageDescription,
  path: seo.path,
  keywords: seo.keywords,
})

export default async function TaoThiepMoiCuoiAiPage() {
  const user = await getUserOrBypass()
  const { t } = getServerDictionary()
  const jsonLd = buildJsonLdService(seo.serviceName, seo.serviceDescription, `${SITE_URL}${seo.path}`)
  const faqJsonLd = buildFeatureFaqJsonLd(seo)
  const loginHref = `/auth/login?next=${encodeURIComponent(seo.path)}`

  return (
    <div className="app-shell">
      <JsonLd data={jsonLd} />
      <JsonLd data={faqJsonLd} />
      <CreationToolPageShell currentHref={seo.path}>
        {user ? (
          <WeddingCardAiClientPage />
        ) : (
          <section className="mx-auto max-w-3xl rounded-3xl bg-gradient-to-br from-rose-50 via-white to-amber-50 p-6 shadow-sm ring-1 ring-rose-100 sm:p-8">
            <p className="text-sm font-medium text-rose-600">{t.tool.wedding_invitation_ai}</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950 md:text-3xl">{seo.pageTitle}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{t.weddingCardAiBrief.loginGateLead}</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{t.weddingCardAiBrief.loginGateHint}</p>
            <Button asChild className="mt-5">
              <Link href={loginHref}>{t.weddingCardAiBrief.loginGateCta}</Link>
            </Button>
          </section>
        )}
      </CreationToolPageShell>
      <FeatureSeoSection seo={seo} />
    </div>
  )
}
