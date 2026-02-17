import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import LamNetAnhClientPage from './lam-net-anh-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'

export const metadata: Metadata = buildMetadata({
  title: 'Làm nét ảnh',
  description: 'Làm nét ảnh mờ, tăng độ sắc nét và chi tiết với AI. Xuất 2K, 4K. Giữ nguyên nội dung, bố cục, màu sắc. 1,5–3 credits/ảnh.',
  path: '/lam-net-anh',
  keywords: ['làm nét ảnh', 'tăng độ sắc nét', 'AI làm nét', 'enhance ảnh', 'sharpening ảnh', 'upscale ảnh'],
})

export default async function LamNetAnhPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    'Làm nét ảnh với AI',
    'Tăng độ sắc nét, giảm mờ, tăng chi tiết. Xuất 2K, 4K.',
    `${SITE_URL}/lam-net-anh`
  )

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <LamNetAnhClientPage />
    </div>
  )
}
