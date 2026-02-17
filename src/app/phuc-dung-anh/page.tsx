import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import PhucDungClientPage from './phuc-dung-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'

export const metadata: Metadata = buildMetadata({
  title: 'Phục dựng ảnh',
  description: 'Phục dựng ảnh cũ, mờ, hư hỏng với AI. Sửa xước, tăng chất lượng, giữ nguyên màu hoặc phối màu như ảnh thật. Xuất 2K, 4K. 4–8 credits/ảnh.',
  path: '/phuc-dung-anh',
  keywords: ['phục dựng ảnh', 'khôi phục ảnh cũ', 'sửa ảnh mờ', 'tăng chất lượng ảnh', 'AI phục dựng ảnh', 'ảnh gia đình'],
})

export default async function PhucDungAnhPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    'Phục dựng ảnh với AI',
    'Sửa ảnh cũ, mờ, hư hỏng và tăng chất lượng. Giữ nguyên màu hoặc phối màu như ảnh thật.',
    `${SITE_URL}/phuc-dung-anh`
  )

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <PhucDungClientPage />
    </div>
  )
}
