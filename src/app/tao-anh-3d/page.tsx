import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import TaoAnh3DClientPage from './tao-anh-3d-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'

export const metadata: Metadata = buildMetadata({
  title: 'Tạo ảnh 3D (Mockup sản phẩm)',
  description: 'Ảnh 1: Sản phẩm (hoặc chọn mẫu). Ảnh 2: Logo in lên sản phẩm. Mockup 3D chuyên nghiệp. 1,5–3 credits/ảnh.',
  path: '/tao-anh-3d',
  keywords: ['ảnh 3D', 'mockup sản phẩm', 'mockup 3D', 'AI mockup', 'thiết kế 3D', 'Shopee', 'TikTok Shop'],
})

export default async function TaoAnh3DPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    'Tạo ảnh 3D Mockup với AI',
    'Đặt thiết kế lên mockup 3D chuyên nghiệp.',
    `${SITE_URL}/tao-anh-3d`
  )

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <TaoAnh3DClientPage />
    </div>
  )
}
