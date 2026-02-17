import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import KeChuyenBangHinhAnhClientPage from './ke-chuyen-bang-hinh-anh-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'

export const metadata: Metadata = buildMetadata({
  title: 'Kể chuyện bằng hình ảnh',
  description: 'Đưa ý tưởng, AI viết câu chuyện dẫn dắt đúng chuẩn khoa học (không bịa) rồi tạo ảnh minh họa, chữ tiếng Việt. Xuất 2K, 4K. 3–6 credits/ảnh.',
  path: '/ke-chuyen-bang-hinh-anh',
  keywords: ['kể chuyện bằng hình ảnh', 'AI tạo ảnh minh họa', 'infographic', 'sách thiếu nhi', 'tạo ảnh từ mô tả'],
})

export default async function KeChuyenBangHinhAnhPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    'Kể chuyện bằng hình ảnh với AI',
    'Mô tả câu chuyện, AI tạo ảnh minh họa sinh động như trang sách thiếu nhi.',
    `${SITE_URL}/ke-chuyen-bang-hinh-anh`
  )

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <KeChuyenBangHinhAnhClientPage />
    </div>
  )
}
