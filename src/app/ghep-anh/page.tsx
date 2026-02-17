import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import GhepAnhClientPage from './ghep-anh-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'

export const metadata: Metadata = buildMetadata({
  title: 'Ghép ảnh',
  description: 'Ghép nhiều ảnh thành một với AI. Kết hợp nội dung hài hòa, tự nhiên. Xuất 2K, 4K. Tối thiểu 2, tối đa 6 ảnh. 1,5–3 credits/ảnh.',
  path: '/ghep-anh',
  keywords: ['ghép ảnh', 'merge ảnh', 'kết hợp ảnh', 'AI ghép ảnh', 'composite ảnh', 'collage ảnh'],
})

export default async function GhepAnhPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    'Ghép ảnh với AI',
    'Kết hợp nhiều ảnh thành một bức ảnh hài hòa, tự nhiên.',
    `${SITE_URL}/ghep-anh`
  )

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <GhepAnhClientPage />
    </div>
  )
}
