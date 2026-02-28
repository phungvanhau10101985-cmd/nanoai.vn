import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import TryOnClientPage from '../try-on-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'
import { getFeatureSeo, buildFeatureFaqJsonLd } from '@/lib/feature-seo'
import { FeatureSeoSection } from '@/components/feature-seo-section'
import { Suspense } from 'react'
import { getCurrentWebLocale } from '@/lib/i18n/server'

const MODE_MAP: Record<string, { mode: 'single' | 'couple' | 'group' | 'group4' | 'group5'; title: string; description: string; keywords: string[] }> = {
  '1-nguoi': { mode: 'single', title: 'Thử đồ 1 người', description: 'Thử đồ ảo 1 người với AI. Tải ảnh của bạn và ảnh trang phục, AI sẽ áp trang phục lên người. Hỗ trợ 2K, 4K.', keywords: ['thử đồ 1 người', 'thử đồ ảo', 'AI thử đồ', 'phối đồ'] },
  '2-nguoi': { mode: 'couple', title: 'Thử đồ 2 người', description: 'Phối đồ đôi với AI. Thử đồ cho ảnh cặp đôi. Tải ảnh khách và ảnh sản phẩm cho từng người.', keywords: ['thử đồ 2 người', 'phối đồ đôi', 'AI thử đồ', 'couple try-on'] },
  '3-nguoi': { mode: 'group', title: 'Thử đồ 3 người', description: 'Thử đồ nhóm 3 người với AI. Thử đồ cho ảnh gia đình, bạn bè. Phân biệt vị trí trái, giữa, phải.', keywords: ['thử đồ 3 người', 'thử đồ nhóm', 'AI thử đồ', 'group try-on'] },
  '4-nguoi': { mode: 'group4', title: 'Thử đồ 4 người', description: 'Thử đồ nhóm 4 người với AI. Thử đồ cho ảnh nhóm. Phân biệt vị trí từng người để áp đúng trang phục.', keywords: ['thử đồ 4 người', 'thử đồ nhóm', 'AI thử đồ'] },
  '5-nguoi': { mode: 'group5', title: 'Thử đồ 5 người', description: 'Thử đồ nhóm 5 người với AI. Thử đồ cho ảnh đại gia đình. Hỗ trợ tối đa 5 người.', keywords: ['thử đồ 5 người', 'thử đồ nhóm', 'AI thử đồ'] },
}

const SEO_KEYS: Record<string, string> = {
  '1-nguoi': 'thu-do-online-1-nguoi',
  '2-nguoi': 'thu-do-online-2-nguoi',
  '3-nguoi': 'thu-do-online-3-nguoi',
  '4-nguoi': 'thu-do-online-4-nguoi',
  '5-nguoi': 'thu-do-online-5-nguoi',
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const config = MODE_MAP[params.slug]
  if (!config) return { title: 'Thử đồ Online' }
  const seoKey = SEO_KEYS[params.slug]
  if (!seoKey) return buildMetadata({ title: config.title, description: config.description, path: `/thu-do-online/${params.slug}`, keywords: config.keywords })
  const seo = getFeatureSeo(seoKey)
  return buildMetadata({
    title: seo.pageTitle,
    description: seo.pageDescription,
    path: seo.path,
    keywords: seo.keywords,
  })
}

export default async function TryOnSlugPage({ params }: { params: { slug: string } }) {
  const locale = getCurrentWebLocale()
  const config = MODE_MAP[params.slug]
  if (!config) notFound()

  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const rawGender = (user?.user_metadata?.gender as string) || 'male'
  const gender = rawGender === 'female' ? 'female' : 'male'

  const seoKey = SEO_KEYS[params.slug]
  const seo = seoKey ? getFeatureSeo(seoKey) : null

  const jsonLd = buildJsonLdService(
    seo?.serviceName ?? config.title,
    seo?.serviceDescription ?? config.description,
    `${SITE_URL}/thu-do-online/${params.slug}`
  )
  const faqJsonLd = seo ? buildFeatureFaqJsonLd(seo) : null

  return (
    <div className="app-shell">
      <JsonLd data={jsonLd} />
      {faqJsonLd && <JsonLd data={faqJsonLd} />}
      <Suspense fallback={<div className="text-sm text-muted-foreground">{locale === 'vi' ? 'Đang tải công cụ thử đồ...' : locale === 'en' ? 'Loading virtual try-on tool...' : locale === 'zh' ? '正在加载试衣工具...' : locale === 'ja' ? 'バーチャル試着ツールを読み込み中...' : '가상피팅 도구를 불러오는 중...'}</div>}>
        <TryOnClientPage gender={gender} initialMode={config.mode} />
      </Suspense>
      {seo && <FeatureSeoSection seo={seo} />}
    </div>
  )
}
