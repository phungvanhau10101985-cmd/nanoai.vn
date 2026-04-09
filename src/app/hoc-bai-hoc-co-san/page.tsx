import { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { buildMetadata } from '@/lib/seo'

const HocBaiHocCoSanClientPage = dynamic(
  () => import('../hoc-tieng-anh-ai/hoc-bai-hoc-co-san-client-page'),
  { ssr: false }
)

export const metadata: Metadata = buildMetadata({
  title: 'Bài học có sẵn theo lộ trình | NanoAI',
  description:
    'Mở và luyện các bài học có sẵn phù hợp cài đặt hiện tại. Giữ luồng luyện tập tách biệt với bài học live AI để dễ theo dõi.',
  path: '/hoc-bai-hoc-co-san',
  keywords: ['bài học có sẵn', 'ôn tập bài học', 'luyện nói theo bài lưu sẵn', 'học tiếng anh ai'],
})

export default function HocBaiHocCoSanPage() {
  return (
    <div className="app-shell">
      <HocBaiHocCoSanClientPage />
    </div>
  )
}

