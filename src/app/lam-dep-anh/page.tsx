import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import LamDepAnhClientPage from './lam-dep-anh-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'

export const metadata: Metadata = buildMetadata({
  title: 'Làm đẹp ảnh',
  description: 'Làm đẹp ảnh 1–4 người như studio với AI. Retouch da, ánh sáng chuyên nghiệp, giữ nguyên nét khuôn mặt và nền gốc. Không thay nền/xóa nền, chỉ xóa phông chuyên nghiệp. Xuất 2K, 4K. 1,5–3 credits/ảnh.',
  path: '/lam-dep-anh',
  keywords: ['làm đẹp ảnh', 'retouch ảnh', 'chỉnh ảnh studio', 'AI làm đẹp', 'ảnh chân dung đẹp'],
})

export default async function LamDepAnhPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    'Làm đẹp ảnh với AI',
    'Retouch ảnh chân dung như studio, giữ nguyên nét khuôn mặt và nền gốc; chỉ xóa phông chuyên nghiệp.',
    `${SITE_URL}/lam-dep-anh`
  )

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <LamDepAnhClientPage />
    </div>
  )
}
