import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import TaoAnhChainDungClientPage from './tao-anh-chain-dung-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'

export const metadata: Metadata = buildMetadata({
  title: 'Tạo ảnh chân dung chuyên nghiệp (AI Headshot)',
  description: 'Biến selfie thành ảnh LinkedIn, CV chuyên nghiệp. Áo vest, ánh sáng studio. 2–4 credits/ảnh.',
  path: '/tao-anh-chain-dung',
  keywords: ['ảnh chân dung', 'AI headshot', 'LinkedIn', 'CV ảnh', 'ảnh đại diện chuyên nghiệp'],
})

export default async function TaoAnhChainDungPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    'Tạo ảnh chân dung chuyên nghiệp với AI',
    'Biến selfie thành ảnh LinkedIn, CV.',
    `${SITE_URL}/tao-anh-chain-dung`
  )

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <TaoAnhChainDungClientPage />
    </div>
  )
}
