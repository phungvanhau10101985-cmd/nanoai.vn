import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import ThietKeLogoClientPage from './thiet-ke-logo-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'

export const metadata: Metadata = buildMetadata({
  title: 'Thiết kế logo thương hiệu',
  description: 'Thiết kế logo thương hiệu chuyên nghiệp với AI. Mô tả tên, ngành nghề, phong cách. Xuất 2K, 4K. 1,5–3 credits/ảnh.',
  path: '/thiet-ke-logo',
  keywords: ['thiết kế logo', 'logo thương hiệu', 'AI thiết kế logo', 'tạo logo', 'brand logo'],
})

export default async function ThietKeLogoPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    'Thiết kế logo thương hiệu với AI',
    'Thiết kế logo chuyên nghiệp, độc đáo, dễ nhận diện.',
    `${SITE_URL}/thiet-ke-logo`
  )

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <ThietKeLogoClientPage />
    </div>
  )
}
