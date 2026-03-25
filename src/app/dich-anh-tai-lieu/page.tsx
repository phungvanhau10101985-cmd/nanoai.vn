import { createClient } from '@/lib/supabase/server'
import { redirectToLogin } from '@/lib/auth/login-redirect'
import { getUserOrBypass } from '@/lib/auth'
import DichAnhTaiLieuClientPage from './dich-anh-tai-lieu-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'
import { getFeatureSeo, buildFeatureFaqJsonLd } from '@/lib/feature-seo'
import { FeatureSeoSection } from '@/components/feature-seo-section'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { Suspense } from 'react'
import { getCurrentWebLocale } from '@/lib/i18n/server'

const seo = getFeatureSeo('dich-anh-tai-lieu')

export const metadata: Metadata = buildMetadata({
  title: seo.pageTitle,
  description: seo.pageDescription,
  path: seo.path,
  keywords: seo.keywords,
})

export default async function DichAnhTaiLieuPage() {
  const locale = getCurrentWebLocale()
  const loadingText =
    locale === 'en'
      ? 'Loading document image translator...'
      : locale === 'zh'
        ? '正在加载文档图片翻译工具...'
        : locale === 'ja'
          ? '文書画像翻訳ツールを読み込み中...'
          : locale === 'ko'
            ? '문서 이미지 번역 도구를 불러오는 중...'
            : 'Đang tải công cụ dịch ảnh tài liệu...'
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirectToLogin()

  const jsonLd = buildJsonLdService(
    seo.serviceName,
    seo.serviceDescription,
    `${SITE_URL}/dich-anh-tai-lieu`
  )
  const faqJsonLd = buildFeatureFaqJsonLd(seo)

  return (
    <div className="app-shell">
      <JsonLd data={jsonLd} />
      <JsonLd data={faqJsonLd} />
      <CreationToolPageShell currentHref={seo.path}>
        <Suspense fallback={<div className="text-sm text-muted-foreground">{loadingText}</div>}>
          <DichAnhTaiLieuClientPage />
        </Suspense>
      </CreationToolPageShell>
      <FeatureSeoSection seo={seo} />
    </div>
  )
}
