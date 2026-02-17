import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import TaoBannerClientPage from './tao-banner-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'

export const metadata: Metadata = buildMetadata({
  title: 'Tạo banner quảng cáo',
  description: 'Tạo banner quảng cáo chuyên nghiệp với AI. Mô tả nội dung, tải ảnh tham khảo. Xuất 2K, 4K. 1,5–3 credits/ảnh.',
  path: '/tao-banner',
  keywords: ['tạo banner', 'banner quảng cáo', 'AI thiết kế banner', 'banner marketing', 'thiết kế quảng cáo'],
})

export default async function TaoBannerPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    'Tạo banner quảng cáo với AI',
    'Thiết kế banner quảng cáo chuyên nghiệp, thu hút.',
    `${SITE_URL}/tao-banner`
  )

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <TaoBannerClientPage />
    </div>
  )
}
