import { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { buildMetadata } from '@/lib/seo'

const TuMoiClientPage = dynamic(() => import('./tu-moi-client-page'), { ssr: false })

export const metadata: Metadata = buildMetadata({
  title: 'Danh sách từ mới của tôi | NanoAI',
  description:
    'Xem tất cả từ mới bạn đã lưu từ các buổi học Live AI và bài học có sẵn.',
  path: '/hoc-tieng-anh-ai/tu-moi',
  keywords: ['từ mới', 'danh sách từ vựng', 'học ngoại ngữ', 'từ vựng tiếng anh'],
})

export default function TuMoiPage() {
  return (
    <div className="app-shell">
      <TuMoiClientPage />
    </div>
  )
}
