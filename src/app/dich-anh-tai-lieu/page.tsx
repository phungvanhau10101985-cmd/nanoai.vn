import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import DichAnhTaiLieuClientPage from './dich-anh-tai-lieu-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'
import { getFeatureSeo, buildFeatureFaqJsonLd } from '@/lib/feature-seo'
import { FeatureSeoSection } from '@/components/feature-seo-section'
import { Suspense } from 'react'

const seo = getFeatureSeo('dich-anh-tai-lieu')

export const metadata: Metadata = buildMetadata({
  title: seo.pageTitle,
  description: seo.pageDescription,
  path: seo.path,
  keywords: seo.keywords,
})

export default async function DichAnhTaiLieuPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    seo.serviceName,
    seo.serviceDescription,
    `${SITE_URL}/dich-anh-tai-lieu`
  )
  const faqJsonLd = buildFeatureFaqJsonLd(seo)

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <JsonLd data={faqJsonLd} />
      <Suspense fallback={<div className="text-sm text-muted-foreground">Đang tải công cụ dịch ảnh tài liệu...</div>}>
        <DichAnhTaiLieuClientPage />
      </Suspense>
      <FeatureSeoSection seo={seo} />
    </div>
  )
}
