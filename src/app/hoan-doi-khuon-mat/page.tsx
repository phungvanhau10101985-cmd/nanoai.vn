import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import HoanDoiKhuonMatClientPage from './hoan-doi-khuon-mat-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'

export const metadata: Metadata = buildMetadata({
  title: 'Hoán đổi khuôn mặt (Face Swap)',
  description: 'Ghép mặt bạn vào nhân vật phim ảnh, siêu anh hùng. Giải trí, viral. 2–4 credits/ảnh.',
  path: '/hoan-doi-khuon-mat',
  keywords: ['face swap', 'hoán đổi khuôn mặt', 'ghép mặt', 'AI face swap', 'deepfake'],
})

export default async function HoanDoiKhuonMatPage() {
  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const jsonLd = buildJsonLdService(
    'Hoán đổi khuôn mặt với AI',
    'Ghép mặt vào nhân vật phim ảnh, siêu anh hùng.',
    `${SITE_URL}/hoan-doi-khuon-mat`
  )

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <HoanDoiKhuonMatClientPage />
    </div>
  )
}
