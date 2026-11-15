import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Luyện nói live với AI | NanoAI',
  description: 'Học nói trực tiếp với giáo viên AI. Mỗi buổi là hội thoại mới.',
  path: '/hoc-tieng-anh-ai/luyen-noi',
  keywords: ['luyện nói live', 'học ngoại ngữ ai', 'giáo viên ai'],
})

type Search = Record<string, string | string[] | undefined>

export default async function HocBaiHocCoSanPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const params = await searchParams
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value) query.set(key, value)
    else if (Array.isArray(value) && value[0]) query.set(key, value[0])
  }
  const suffix = query.toString()
  redirect(`/hoc-tieng-anh-ai/luyen-noi${suffix ? `?${suffix}` : ''}`)
}
