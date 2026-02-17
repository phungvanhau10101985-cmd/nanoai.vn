import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import TaoVideoTuAnhClientPage from './tao-video-tu-anh-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'

export const metadata: Metadata = buildMetadata({
  title: 'Tạo video từ ảnh',
  description:
    'Chuyển ảnh thành video 8 giây với AI Veo 3.1. 2 chất lượng: 720p và 1080p. Video có âm thanh, phong cách điện ảnh.',
  path: '/tao-video-tu-anh',
  keywords: ['tạo video từ ảnh', 'AI video', 'Veo', 'ảnh thành video', 'image to video'],
})

export default async function TaoVideoTuAnhPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    'Tạo video từ ảnh với AI Veo 3.1',
    'Chuyển ảnh tĩnh thành video 8 giây với chuyển động tự nhiên và âm thanh.',
    `${SITE_URL}/tao-video-tu-anh`
  )

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <TaoVideoTuAnhClientPage />
    </div>
  )
}
