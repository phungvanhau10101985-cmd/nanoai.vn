import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import TaoNhanGianClientPage from './tao-nhan-gian-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'

export const metadata: Metadata = buildMetadata({
  title: 'Tạo nhãn gián nền trong suốt',
  description: 'Đưa ý tưởng nhãn gián, AI mở rộng chi tiết rồi tạo ảnh PNG nền trong suốt, phù hợp in sticker. Xuất 2K, 4K. 2–4 credits/ảnh.',
  path: '/tao-nhan-gian',
  keywords: ['tạo nhãn gián', 'sticker nền trong suốt', 'AI tạo sticker', 'nhãn dán', 'PNG trong suốt'],
})

export default async function TaoNhanGianPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    'Tạo nhãn gián nền trong suốt với AI',
    'Đưa ý tưởng, AI tạo nhãn gián/sticker PNG nền trong suốt, phù hợp in ấn.',
    `${SITE_URL}/tao-nhan-gian`
  )

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <TaoNhanGianClientPage />
    </div>
  )
}
