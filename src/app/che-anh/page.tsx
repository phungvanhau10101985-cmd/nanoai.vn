import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import CheAnhClientPage from './che-anh-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'

export const metadata: Metadata = buildMetadata({
  title: 'Chế ảnh',
  description: 'Chế ảnh theo ý tưởng của bạn với AI. Biến tấu, chỉnh sửa sáng tạo. Xuất 2K, 4K. 1,5–3 credits/ảnh.',
  path: '/che-anh',
  keywords: ['chế ảnh', 'meme ảnh', 'AI chế ảnh', 'biến tấu ảnh', 'chỉnh sửa ảnh sáng tạo'],
})

export default async function CheAnhPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    'Chế ảnh với AI',
    'Chỉnh sửa, biến tấu ảnh theo ý tưởng của bạn.',
    `${SITE_URL}/che-anh`
  )

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <CheAnhClientPage />
    </div>
  )
}
