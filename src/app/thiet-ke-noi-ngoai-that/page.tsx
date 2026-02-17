import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import ThietKeNoiNgoaiThatClientPage from './thiet-ke-noi-ngoai-that-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'

export const metadata: Metadata = buildMetadata({
  title: 'Thiết kế nội thất & ngoại thất',
  description: 'AI phân tích nội thất, dọn dẹp phòng, đổi phong cách, Virtual Staging. Chuyên nghiệp cho BĐS, thiết kế.',
  path: '/thiet-ke-noi-ngoai-that',
  keywords: ['thiết kế nội thất', 'AI nội thất', 'Virtual Staging', 'dọn dẹp phòng AI', 'đổi phong cách phòng', 'BĐS'],
})

export default async function ThietKeNoiNgoaiThatPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    'Thiết kế nội thất & ngoại thất với AI',
    'Phân tích, dọn dẹp, đổi phong cách, Virtual Staging. Vision AI chuyên nghiệp.',
    `${SITE_URL}/thiet-ke-noi-ngoai-that`
  )

  return (
    <div className="container max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <JsonLd data={jsonLd} />
      <ThietKeNoiNgoaiThatClientPage />
    </div>
  )
}
