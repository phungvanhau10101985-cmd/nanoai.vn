import { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { buildMetadata } from '@/lib/seo'
import { LiveLessonsMarketplace } from './components/live-lessons-marketplace'

const HocTiengAnhAiClientPage = dynamic(() => import('./hoc-tieng-anh-ai-client-page'), { ssr: false })

export const metadata: Metadata = buildMetadata({
  title: 'Học ngoại ngữ tương tác với giáo viên AI bản địa | NanoAI',
  description:
    'Luyện nói tiếng Anh tương tác trực tiếp với giáo viên AI bản địa (Anh/Mỹ, nam/nữ), sửa lỗi ngữ pháp và phát âm theo từng lượt hội thoại.',
  path: '/hoc-tieng-anh-ai',
  keywords: ['học tiếng anh ai', 'luyện nói tiếng anh', 'giáo viên ai bản địa', 'sửa phát âm tiếng anh'],
})

export default function HocTiengAnhAiPage() {
  return (
    <div className="app-shell space-y-8">
      <HocTiengAnhAiClientPage />
      <LiveLessonsMarketplace />
    </div>
  )
}

