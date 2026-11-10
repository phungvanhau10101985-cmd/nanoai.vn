import dynamic from 'next/dynamic'
import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'

const HocTiengAnhAiClientPage = dynamic(() => import('../hoc-tieng-anh-ai-client-page'), { ssr: false })

const roomMeta = buildMetadata({
  title: 'Phòng luyện nói ngoại ngữ AI',
  description: 'Phòng nói với giáo viên AI. Chọn tiếng mẹ đẻ, tiếng đang học, rồi nói và nghe câu sửa.',
  path: '/hoc-tieng-anh-ai/luyen-noi',
  noIndex: true,
})

export const metadata: Metadata = {
  ...roomMeta,
  title: { absolute: 'Phòng luyện nói ngoại ngữ AI | NanoAI' },
}

export default function LuyenNoiPage() {
  return (
    <div className="app-shell">
      <HocTiengAnhAiClientPage />
    </div>
  )
}
