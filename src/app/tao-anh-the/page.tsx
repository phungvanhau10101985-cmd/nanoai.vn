import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import TaoAnhTheClientPage from './tao-anh-the-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'

export const metadata: Metadata = buildMetadata({
  title: 'Tạo ảnh thẻ',
  description: 'Tạo ảnh thẻ chứng minh, căn cước với AI. Tách nền, thay nền trắng/xanh. Chuẩn 3x4, 4x6. Xuất 2K, 4K. 1,5–3 credits/ảnh.',
  path: '/tao-anh-the',
  keywords: ['tạo ảnh thẻ', 'ảnh chứng minh', 'ảnh căn cước', 'AI ảnh thẻ', 'ảnh 3x4', 'ảnh 4x6'],
})

export default async function TaoAnhThePage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    'Tạo ảnh thẻ với AI',
    'Tách nền, thay nền trắng/xanh. Chuẩn 3x4, 4x6.',
    `${SITE_URL}/tao-anh-the`
  )

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <TaoAnhTheClientPage />
    </div>
  )
}
