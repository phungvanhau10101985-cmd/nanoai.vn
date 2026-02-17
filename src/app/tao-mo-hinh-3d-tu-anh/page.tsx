import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import TaoMoHinh3DTuAnhClientPage from './tao-mo-hinh-3d-tu-anh-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'

export const metadata: Metadata = buildMetadata({
  title: 'Tạo mô hình 3D từ ảnh',
  description: 'Chuyển ảnh thành mô hình 3D dạng hoạt hình: Pixar, Anime, Low-poly... AI tạo mô hình mới, không giữ ảnh gốc. 1,5–3 credits/ảnh.',
  path: '/tao-mo-hinh-3d-tu-anh',
  keywords: ['mô hình 3D từ ảnh', '2D to 3D', 'AI 3D', 'tạo 3D từ ảnh', '3D model from image'],
})

export default async function TaoMoHinh3DTuAnhPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    'Tạo mô hình 3D từ ảnh với AI',
    'Chuyển ảnh 2D thành preview mô hình 3D với thể tích và chiều sâu.',
    `${SITE_URL}/tao-mo-hinh-3d-tu-anh`
  )

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <TaoMoHinh3DTuAnhClientPage />
    </div>
  )
}
