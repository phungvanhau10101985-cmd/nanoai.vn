'use client'

import { Trash2 } from 'lucide-react'
import { ContentEmbed, splitContentWithEmbeds, type EmbedType } from './content-embed'
import { AnimatedCharReveal } from './animated-char-reveal'
import { slideMarkdownToHtml } from './slide-markdown-to-html'

function getTextSegmentCount(text: string): number {
  return text.length
}

const WRAPPER_CLASS =
  '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_p]:my-2 text-base md:text-lg leading-relaxed'

export type CurriculumBlockContentWithEmbedsProps = {
  content: string
  onRemoveEmbed?: (rawMarker: string) => void
  removeTitle?: string
  liveQuizContext?: { curriculumId: string; slideIndex: number; blockIndex: number }
  tr?: (vi: string, en: string, zh: string, ja: string, ko: string) => string
  hideQuiz?: boolean
  animateReveal?: boolean
  animateTrigger?: string | number
  wordDelayMs?: number
  /** Chỉ dùng cùng `animateReveal` (hiệu ứng viết giáo trình). Không hỗ trợ slice segment khi tắt animate — dùng `WorksheetBlockContentWithEmbeds` cho phiếu bài tập. */
  visibleCountInBlock?: number
}

/**
 * Nội dung block slide **giáo trình**: embed, quiz, hiệu ứng viết (AnimatedCharReveal).
 * Không chứa logic “gõ lời giải phiếu” (segment slice khi không animate).
 */
export function CurriculumBlockContentWithEmbeds({
  content,
  onRemoveEmbed,
  removeTitle,
  liveQuizContext,
  tr,
  hideQuiz,
  animateReveal,
  animateTrigger,
  wordDelayMs,
  visibleCountInBlock,
}: CurriculumBlockContentWithEmbedsProps) {
  const parts = splitContentWithEmbeds(content)
  let consumed = 0
  return (
    <div className={WRAPPER_CLASS}>
      {parts.map((p, i) => {
        if (p.type === 'text') {
          const partLen = getTextSegmentCount(p.value)
          const remaining = visibleCountInBlock != null ? visibleCountInBlock - consumed : partLen
          const showCount = visibleCountInBlock != null ? Math.max(0, Math.min(partLen, remaining)) : partLen
          consumed += partLen
          if (animateReveal) {
            if (visibleCountInBlock != null) {
              const cursorHere = showCount > 0 && showCount < partLen
              return (
                <div key={i} className="[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
                  <AnimatedCharReveal text={p.value} visibleCount={showCount} showCursor={cursorHere} />
                </div>
              )
            }
            if (animateTrigger != null) {
              return (
                <div key={i} className="[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
                  <AnimatedCharReveal text={p.value} trigger={animateTrigger} delayMs={wordDelayMs} />
                </div>
              )
            }
          }
          return <div key={i} dangerouslySetInnerHTML={{ __html: slideMarkdownToHtml(p.value) }} />
        }
        const ep = p as { type: 'embed'; embedType: string; urlOrId: string; rawMarker: string }
        if (hideQuiz && ep.embedType === 'quiz') return null
        const showEmbed = visibleCountInBlock == null || visibleCountInBlock > consumed
        consumed += 1
        if (!showEmbed) return null
        return (
          <div key={i} className="relative group">
            <ContentEmbed
              type={ep.embedType as EmbedType}
              urlOrId={ep.urlOrId}
              width={560}
              height={350}
              liveQuizContext={liveQuizContext}
              tr={tr}
              hideQuiz={hideQuiz}
            />
            {onRemoveEmbed && (
              <button
                type="button"
                onClick={() => onRemoveEmbed(ep.rawMarker)}
                className="absolute top-2 right-2 opacity-60 hover:opacity-100 group-hover:opacity-100 transition-opacity p-1.5 rounded-md bg-red-500/90 text-white hover:bg-red-600 shadow-lg print:hidden"
                title={removeTitle ?? 'Xóa biểu đồ'}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
