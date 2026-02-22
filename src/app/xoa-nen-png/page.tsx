import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import XoaNenPngClientPage from './xoa-nen-png-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'

export const metadata: Metadata = buildMetadata({
  title: 'Xóa nền PNG trong suốt',
  description: 'Tách nền ảnh và xuất PNG trong suốt (RGBA) bằng AI mask + Python PIL. Phù hợp bán hàng TMĐT, thiết kế và ghép nền.',
  path: '/xoa-nen-png',
  keywords: ['xóa nền png', 'ảnh nền trong suốt', 'remove background png', 'tách nền sản phẩm'],
})

export default async function XoaNenPngPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    'Xóa nền PNG trong suốt',
    'Tách nền ảnh thành PNG trong suốt bằng luồng mask chuyên dụng.',
    `${SITE_URL}/xoa-nen-png`
  )

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <XoaNenPngClientPage />
    </div>
  )
}
