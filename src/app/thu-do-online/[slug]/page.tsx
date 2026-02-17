import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getUserOrBypass } from '@/lib/auth'
import TryOnClientPage from '../try-on-client-page'
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'

const MODE_MAP: Record<string, { mode: 'single' | 'couple' | 'group' | 'group4' | 'group5'; title: string; description: string; keywords: string[] }> = {
  '1-nguoi': { mode: 'single', title: 'Thử đồ 1 người', description: 'Thử đồ ảo 1 người với AI. Tải ảnh của bạn và ảnh trang phục, AI sẽ áp trang phục lên người. Hỗ trợ 2K, 4K.', keywords: ['thử đồ 1 người', 'thử đồ ảo', 'AI thử đồ', 'phối đồ'] },
  '2-nguoi': { mode: 'couple', title: 'Thử đồ 2 người', description: 'Phối đồ đôi với AI. Thử đồ cho ảnh cặp đôi. Tải ảnh khách và ảnh sản phẩm cho từng người.', keywords: ['thử đồ 2 người', 'phối đồ đôi', 'AI thử đồ', 'couple try-on'] },
  '3-nguoi': { mode: 'group', title: 'Thử đồ 3 người', description: 'Thử đồ nhóm 3 người với AI. Thử đồ cho ảnh gia đình, bạn bè. Phân biệt vị trí trái, giữa, phải.', keywords: ['thử đồ 3 người', 'thử đồ nhóm', 'AI thử đồ', 'group try-on'] },
  '4-nguoi': { mode: 'group4', title: 'Thử đồ 4 người', description: 'Thử đồ nhóm 4 người với AI. Thử đồ cho ảnh nhóm. Phân biệt vị trí từng người để áp đúng trang phục.', keywords: ['thử đồ 4 người', 'thử đồ nhóm', 'AI thử đồ'] },
  '5-nguoi': { mode: 'group5', title: 'Thử đồ 5 người', description: 'Thử đồ nhóm 5 người với AI. Thử đồ cho ảnh đại gia đình. Hỗ trợ tối đa 5 người.', keywords: ['thử đồ 5 người', 'thử đồ nhóm', 'AI thử đồ'] },
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const config = MODE_MAP[params.slug]
  if (!config) return { title: 'Thử đồ Online' }
  return buildMetadata({
    title: config.title,
    description: config.description,
    path: `/thu-do-online/${params.slug}`,
    keywords: config.keywords,
  })
}

export default async function TryOnSlugPage({ params }: { params: { slug: string } }) {
  const config = MODE_MAP[params.slug]
  if (!config) notFound()

  const supabase = createClient()
  const user = await getUserOrBypass(() => supabase.auth.getUser())
  if (!user) redirect('/auth/login')

  const rawGender = (user?.user_metadata?.gender as string) || 'male'
  const gender = rawGender === 'female' ? 'female' : 'male'

  const jsonLd = buildJsonLdService(
    config.title,
    config.description,
    `${SITE_URL}/thu-do-online/${params.slug}`
  )

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <TryOnClientPage gender={gender} initialMode={config.mode} />
    </div>
  )
}
