import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import ThayNenSanPhamClientPage from './thay-nen-san-pham-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'

export const metadata: Metadata = buildMetadata({
  title: 'Thay nền sản phẩm (AI Product Photography)',
  description: 'Tách sản phẩm, đặt vào bối cảnh studio, bãi biển, phòng khách. Dành cho shop bán hàng online. 1,5–3 credits/ảnh.',
  path: '/thay-nen-san-pham',
  keywords: ['thay nền sản phẩm', 'AI product', 'chụp ảnh sản phẩm', 'tách nền', 'Shopee', 'TikTok Shop'],
})

export default async function ThayNenSanPhamPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    'Thay nền sản phẩm với AI',
    'Tách sản phẩm, đặt vào bối cảnh chuyên nghiệp.',
    `${SITE_URL}/thay-nen-san-pham`
  )

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <ThayNenSanPhamClientPage />
    </div>
  )
}
