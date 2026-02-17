import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import MoRongKhungHinhClientPage from './mo-rong-khung-hinh-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'

export const metadata: Metadata = buildMetadata({
  title: 'Mở rộng khung hình (AI Outpainting)',
  description: 'Ảnh dọc thành banner ngang. AI vẽ thêm nền tự nhiên. Hữu ích cho banner. 1,5–3 credits/ảnh.',
  path: '/mo-rong-khung-hinh',
  keywords: ['mở rộng ảnh', 'outpainting', 'mở rộng khung hình', 'banner', 'AI extend'],
})

export default async function MoRongKhungHinhPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    'Mở rộng khung hình với AI',
    'Vẽ thêm nền, ảnh dọc thành banner ngang.',
    `${SITE_URL}/mo-rong-khung-hinh`
  )

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <MoRongKhungHinhClientPage />
    </div>
  )
}
