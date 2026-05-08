import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import { getServerDictionary } from '@/lib/i18n/server'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { ImageResultDisplaySettingsClient } from './image-result-display-settings-client'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'
import { getFeatureSeo, buildFeatureFaqJsonLd } from '@/lib/feature-seo'
import { FeatureSeoSection } from '@/components/feature-seo-section'

const seo = getFeatureSeo('cai-dat-hien-thi-ket-qua-anh')

export const metadata: Metadata = buildMetadata({
  title: seo.pageTitle,
  description: seo.pageDescription,
  path: seo.path,
  keywords: seo.keywords,
})

export default async function CaiDatHienThiKetQuaAnhPage() {
  const user = await getUserOrBypass()
  if (!user) redirectToLogin()

  const { t } = await getServerDictionary()
  const jsonLd = buildJsonLdService(seo.serviceName, seo.serviceDescription, `${SITE_URL}${seo.path}`)
  const faqJsonLd = buildFeatureFaqJsonLd(seo)

  return (
    <div className="app-shell">
      <JsonLd data={jsonLd} />
      <JsonLd data={faqJsonLd} />
      <CreationToolPageShell currentHref={seo.path}>
        <ImageResultDisplaySettingsClient copy={t.imageResultDisplay} />
      </CreationToolPageShell>
      <FeatureSeoSection seo={seo} />
    </div>
  )
}
