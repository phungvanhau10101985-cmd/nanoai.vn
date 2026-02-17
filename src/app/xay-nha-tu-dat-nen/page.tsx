import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import XayNhaTuDatNenClientPage from './xay-nha-tu-dat-nen-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'

export const metadata: Metadata = buildMetadata({
  title: 'Nhà của bạn',
  description: 'AI tạo mặt tiền nhà 3D. Nhập kích thước, phong cách, số tầng... AI tạo ảnh nhà mặt tiền.',
  path: '/xay-nha-tu-dat-nen',
  keywords: ['nhà của bạn', 'thiết kế nhà AI', 'mặt tiền nhà 3D', 'AI kiến trúc'],
})

export default async function XayNhaTuDatNenPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    'Nhà của bạn',
    'AI tạo mặt tiền nhà 3D. Nhập kích thước, phong cách, số tầng... AI tạo ảnh nhà mặt tiền.',
    `${SITE_URL}/xay-nha-tu-dat-nen`
  )

  return (
    <div className="container max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <JsonLd data={jsonLd} />
      <XayNhaTuDatNenClientPage />
    </div>
  )
}
