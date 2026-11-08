'use client'

import { useRouter } from 'next/navigation'
import { NanoAISlideViewer } from '@/app/tao-giao-trinh/components/nano-ai-slide-viewer'
import type { AISlideData } from '@/app/tao-giao-trinh/lib/curriculum-to-slides'
import { tr } from '@/app/tao-giao-trinh/components/xem-slide-student-ui-locale'

export function ReviewSlideClient({
  slides,
  markdown,
  topic,
  backHref,
  locale,
}: {
  slides: AISlideData[]
  markdown: string
  topic: string
  backHref: string
  locale: string
}) {
  const router = useRouter()
  return (
    <NanoAISlideViewer
      curriculumMarkdown={markdown}
      topic={topic}
      onClose={() => router.push(backHref)}
      aiSlides={slides}
      tr={tr.bind(null, locale)}
      initialSlideIndex={0}
      isTeacherView={false}
      worksheetPresentation={false}
    />
  )
}
