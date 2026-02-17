import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import XoaVatTheClientPage from './xoa-vat-the-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'

export const metadata: Metadata = buildMetadata({
  title: 'Xóa vật thể thừa (Magic Eraser)',
  description: 'Xóa người lạ, rác, dây điện trong ảnh. AI tự bù đắp nền như chưa từng có gì. 1,5–3 credits/ảnh.',
  path: '/xoa-vat-the',
  keywords: ['xóa vật thể', 'Magic Eraser', 'xóa người lạ', 'inpainting', 'AI xóa ảnh'],
})

export default async function XoaVatThePage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    'Xóa vật thể thừa với AI (Magic Eraser)',
    'Xóa người lạ, rác, dây điện. AI bù đắp nền tự nhiên.',
    `${SITE_URL}/xoa-vat-the`
  )

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <XoaVatTheClientPage />
    </div>
  )
}
