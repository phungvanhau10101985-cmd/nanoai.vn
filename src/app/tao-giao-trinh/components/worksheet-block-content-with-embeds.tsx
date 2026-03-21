'use client'

import { useMemo } from 'react'
import { PenLine } from 'lucide-react'
import { ContentEmbed, splitContentWithEmbeds, type EmbedType } from './content-embed'
import { slideMarkdownToHtml } from './slide-markdown-to-html'
import { worksheetAnswerDisplaySegmentCount } from '../lib/worksheet-answer-segments'

function getTextSegmentCount(text: string): number {
  return text.length
}

const WRAPPER_CLASS =
  '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_p]:my-2 text-base md:text-lg leading-relaxed'

/** Giống lucide `PenLine` (stroke 2.5 ≈ 2 trong SVG 24px) — dùng HTML để bút nằm inline sau chữ, xuống dòng vẫn đúng. */
const WORKSHEET_TYPING_PEN_HTML = `<span class="inline-flex shrink-0 items-baseline align-baseline ml-0.5 translate-y-px animate-write text-violet-600" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="drop-shadow-sm"><path d="M13 21h8"/><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg></span>`

/** Chèn bút vào *trong* khối cuối (trước `</p>` / `</li>`…) để flow inline theo chữ, không dùng cột grid. */
function appendWorksheetTypingPenInline(html: string, penSnippet: string): string {
  const t = html.trimEnd()
  if (!t) return penSnippet
  const blockEnds = ['</p>', '</li>', '</h1>', '</h2>', '</h3>', '</h4>']
  let best = -1
  for (const tag of blockEnds) {
    const idx = t.lastIndexOf(tag)
    if (idx > best) best = idx
  }
  if (best === -1) return t + penSnippet
  return t.slice(0, best) + penSnippet + t.slice(best)
}

function WorksheetTypingPen() {
  return (
    <span className="inline-flex shrink-0 items-baseline animate-write align-baseline" aria-hidden>
      <PenLine className="h-4 w-4 text-violet-600 drop-shadow-sm" strokeWidth={2.5} />
    </span>
  )
}

/** Bút đứng sau segment vừa “gõ” xong: v = số segment đã lộ, [from, from+len) là khoảng segment của phần này. */
function penFollowsSegment(
  showTypingPen: boolean,
  v: number,
  segmentStart: number,
  segmentLen: number
): boolean {
  if (!showTypingPen || segmentLen <= 0) return false
  if (v === 0 && segmentStart === 0) return true
  return v > segmentStart && v <= segmentStart + segmentLen
}

export type WorksheetBlockContentWithEmbedsProps = {
  content: string
  liveQuizContext?: { curriculumId: string; slideIndex: number; blockIndex: number }
  tr?: (vi: string, en: string, zh: string, ja: string, ko: string) => string
  hideQuiz?: boolean
  /**
   * Số segment đã hiện (ký tự + embed). `undefined` = hiện toàn bộ (tắt gõ / tạm dừng theo giáo viên).
   * Phải khớp đồng bộ từ GV (`worksheetAnswerSegmentCount` / `sliceWorksheetAnswerPartsToSegments`).
   * Đếm segment hiển thị HS (khi `hideQuiz`) dùng `worksheetAnswerDisplaySegmentCount`.
   */
  visibleSegmentCount?: number
  /**
   * Khi true và `visibleSegmentCount === 0`: không vẽ bút “đang gõ” (tránh 2 bút cùng lúc với tiêu đề slide đang Viết).
   */
  suppressTypingPenAtZero?: boolean
  /**
   * Khi false và `visibleSegmentCount === 0`: không vẽ bút ở đầu khối (slide nhiều block — chỉ block “đang tới lượt” hiện bút).
   * @default true
   */
  allowTypingPenAtRevealStart?: boolean
}

/**
 * Chỉ dùng cho **đáp án phiếu bài tập** (học sinh xem-slide): cắt nội dung theo segment khi GV “gõ”,
 * không dùng AnimatedCharReveal. Tách khỏi `CurriculumBlockContentWithEmbeds` để giáo trình không bị ảnh hưởng.
 */
export function WorksheetBlockContentWithEmbeds({
  content,
  liveQuizContext,
  tr,
  hideQuiz,
  visibleSegmentCount,
  suppressTypingPenAtZero = false,
  allowTypingPenAtRevealStart = true,
}: WorksheetBlockContentWithEmbedsProps) {
  const parts = splitContentWithEmbeds(content)
  const displaySegmentTotal = useMemo(
    () => worksheetAnswerDisplaySegmentCount(content, hideQuiz),
    [content, hideQuiz]
  )
  const showTypingPen =
    visibleSegmentCount != null &&
    displaySegmentTotal > 0 &&
    visibleSegmentCount < displaySegmentTotal &&
    (visibleSegmentCount > 0 || (!suppressTypingPenAtZero && allowTypingPenAtRevealStart))

  let consumed = 0
  return (
    <div className={WRAPPER_CLASS}>
      {parts.map((p, i) => {
        if (p.type === 'text') {
          const partLen = getTextSegmentCount(p.value)
          if (visibleSegmentCount == null) {
            consumed += partLen
            return <div key={i} dangerouslySetInnerHTML={{ __html: slideMarkdownToHtml(p.value) }} />
          }
          const segmentStart = consumed
          const remaining = visibleSegmentCount - segmentStart
          const showCount = Math.max(0, Math.min(partLen, remaining))
          consumed += partLen
          const sliceText = showCount >= partLen ? p.value : p.value.slice(0, showCount)
          const v = visibleSegmentCount
          const penHere = penFollowsSegment(showTypingPen, v, segmentStart, partLen)
          if (!sliceText && !penHere) return null
          const rawHtml = sliceText ? slideMarkdownToHtml(sliceText) : ''
          const htmlWithPen =
            sliceText && penHere ? appendWorksheetTypingPenInline(rawHtml, WORKSHEET_TYPING_PEN_HTML) : rawHtml
          return (
            <div
              key={i}
              className="min-w-0 max-w-full text-slate-800 [&_p:last-child]:mb-0"
              dangerouslySetInnerHTML={{
                __html:
                  sliceText && penHere
                    ? htmlWithPen
                    : sliceText
                      ? rawHtml
                      : `<span class="inline-block min-h-[1.25em] min-w-0" aria-hidden="true"></span>${WORKSHEET_TYPING_PEN_HTML}`,
              }}
            />
          )
        }
        const ep = p as { type: 'embed'; embedType: string; urlOrId: string; rawMarker: string }
        if (hideQuiz && ep.embedType === 'quiz') return null
        if (visibleSegmentCount == null) {
          consumed += 1
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
            </div>
          )
        }
        const segmentStart = consumed
        const v = visibleSegmentCount
        const showEmbed = v > segmentStart
        consumed += 1
        if (!showEmbed) {
          if (showTypingPen && v === segmentStart && segmentStart === 0) {
            return (
              <div key={i} className="flex items-end gap-1">
                <WorksheetTypingPen />
              </div>
            )
          }
          return null
        }
        const penHere = penFollowsSegment(showTypingPen, v, segmentStart, 1)
        return (
          <div key={i} className="relative group flex max-w-full flex-row flex-wrap items-end gap-x-1.5">
            <ContentEmbed
              type={ep.embedType as EmbedType}
              urlOrId={ep.urlOrId}
              width={560}
              height={350}
              liveQuizContext={liveQuizContext}
              tr={tr}
              hideQuiz={hideQuiz}
            />
            {penHere ? <WorksheetTypingPen /> : null}
          </div>
        )
      })}
    </div>
  )
}
