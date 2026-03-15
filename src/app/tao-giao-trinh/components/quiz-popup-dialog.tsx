'use client'

import { useCallback, useEffect } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogPortal,
  DialogOverlay,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ContentEmbed, parseContentEmbeds, parseQuizData } from './content-embed'
import { QuizErrorBoundary } from './quiz-error-boundary'
import { Sparkles, X } from 'lucide-react'

type SlideBlock = { header?: string; content?: string }
type VisualCell = { visualEmbed?: string; imageUrl?: string }

export function extractQuizFromSlide(slide: { blocks?: SlideBlock[]; content?: string; visualEmbed?: string; visualCells?: VisualCell[] }): Array<{ urlOrId: string; rawMarker: string }> {
  const texts: string[] = []
  for (const b of slide.blocks ?? []) {
    if (b.content) texts.push(b.content)
  }
  if (slide.content) texts.push(slide.content)
  if (slide.visualEmbed) texts.push(slide.visualEmbed)
  for (const c of slide.visualCells ?? []) {
    if (c.visualEmbed) texts.push(c.visualEmbed)
  }
  const all = parseContentEmbeds(texts.join('\n\n')).filter((e) => e.type === 'quiz')
  return all.map((e) => ({ urlOrId: e.urlOrId, rawMarker: e.rawMarker }))
}

interface QuizPopupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slide: { title: string; blocks?: SlideBlock[]; content?: string; visualEmbed?: string; visualCells?: VisualCell[] }
  slideIndex: number
  curriculumId?: string | null
  tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string
  /** Chế độ giáo viên: hiện nút tạo/thay câu hỏi. Học sinh: chỉ xem. */
  teacherMode?: boolean
  onGenerateQuiz?: () => Promise<void>
  onReplaceBrokenQuiz?: (rawMarker: string) => Promise<void>
  quizGenLoading?: boolean
  /** Mã phiên quiz đã tạo – đồng bộ từ giáo viên sang học sinh */
  quizSessionCodes?: Record<string, string>
  /** Thời gian đồng hồ cát (giây) – đồng bộ từ giáo viên sang học sinh */
  quizSessionTimers?: Record<string, number>
  /** Chế độ mở đáp án khi hết giờ – đồng bộ từ giáo viên sang học sinh */
  quizSessionAutoReveal?: Record<string, boolean>
  /** Callback khi giáo viên tạo phiên quiz */
  onQuizSessionCreated?: (slideIndex: number, blockIndex: number, sessionCode: string, quizDurationSeconds?: number) => void
  /** Callback khi giáo viên đổi cài đặt quiz trước khi bắt đầu */
  onQuizSettingsChange?: (slideIndex: number, blockIndex: number, settings: { quizDurationSeconds: number; autoRevealOnTimerEnd: boolean }) => void
}

export function QuizPopupDialog({
  open,
  onOpenChange,
  slide,
  slideIndex,
  curriculumId,
  tr,
  teacherMode = false,
  onGenerateQuiz,
  onReplaceBrokenQuiz,
  quizGenLoading = false,
  quizSessionCodes = {},
  quizSessionTimers = {},
  quizSessionAutoReveal = {},
  onQuizSessionCreated,
  onQuizSettingsChange,
}: QuizPopupDialogProps) {
  const quizzes = extractQuizFromSlide(slide)
  const hasQuiz = quizzes.length > 0
  const slideContentKey = [
    slide.blocks?.map((b) => b.content).join('\n'),
    slide.content,
    slide.visualEmbed,
    slide.visualCells?.map((c) => c.visualEmbed).join('\n'),
  ].filter(Boolean).join('\n---\n') || 'empty'

  const handleGenerate = useCallback(async () => {
    if (onGenerateQuiz) await onGenerateQuiz()
  }, [onGenerateQuiz])

  useEffect(() => {
    if (!open || typeof window === 'undefined') return
    import('@/lib/utils')
      .then((m) => console.log('[QuizPopup] cn available:', typeof m?.cn))
      .catch((e) => console.error('[QuizPopup] utils import error:', e))
    const h = (e: ErrorEvent) => {
      if (e.message?.includes('cn')) console.error('[QuizPopup] window.error:', e.message, e.filename, e.lineno, e.colno, e.error?.stack)
    }
    window.addEventListener('error', h)
    return () => window.removeEventListener('error', h)
  }, [open])

  const zClass = 'z-[110]'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className={zClass} />
        <DialogPrimitive.Content
          data-quiz-popup
          className={`fixed left-[50%] top-[50%] flex flex-col w-full max-w-2xl max-h-[85vh] translate-x-[-50%] translate-y-[-50%] border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg overflow-hidden ${zClass}`}
        >
          <div className="shrink-0 flex items-start justify-between gap-4 p-6 pb-0 border-b bg-background">
            <DialogHeader className="p-0 space-y-0">
              <DialogTitle className="pr-8 text-base">
                {tr('Câu hỏi trắc nghiệm', 'Quiz questions', '测验题', 'クイズ', '퀴즈')} – {slide.title}
              </DialogTitle>
            </DialogHeader>
            <DialogClose className="shrink-0 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none p-1">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>
          <div data-quiz-popup-scroll className="flex-1 overflow-y-auto min-h-0 p-6 pt-4">
          <QuizErrorBoundary>
          <div className="space-y-6" key={slideContentKey}>
            {hasQuiz ? (
              quizzes.map((q, i) => {
                const parsed = parseQuizData(q.urlOrId)
                if (!parsed) {
                  return (
                    <div key={`${i}-${q.urlOrId.slice(0, 30)}`} className="border border-amber-200 rounded-lg p-4 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
                      <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                        {tr('Câu hỏi chưa hiển thị được. Định dạng có thể không đúng.', 'Quiz could not be displayed. Format may be invalid.', '题目无法显示，格式可能不正确。', 'クイズを表示できません。形式が不正かもしれません。', '퀴즈를 표시할 수 없습니다. 형식이 잘못되었을 수 있습니다.')}
                      </p>
                      {teacherMode && onReplaceBrokenQuiz && (
                        <Button
                          onClick={() => onReplaceBrokenQuiz(q.rawMarker)}
                          disabled={quizGenLoading}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          {quizGenLoading
                            ? tr('Đang tạo...', 'Creating...', '创建中...', '作成中...', '생성 중...')
                            : tr('Tạo lại câu hỏi trắc nghiệm', 'Regenerate quiz', '重新生成测验', 'クイズを再生成', '퀴즈 다시 생성')}
                        </Button>
                      )}
                    </div>
                  )
                }
                return (
                  <div key={`${i}-${q.urlOrId.slice(0, 30)}`} className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-900/30">
                    <ContentEmbed
                      type="quiz"
                      urlOrId={q.urlOrId}
                      width={560}
                      height={200}
                      liveQuizContext={{
                        curriculumId: curriculumId ?? '',
                        slideIndex,
                        blockIndex: i,
                        initialSessionCode: quizSessionCodes[`${slideIndex}-${i}`] ?? null,
                        initialQuizDurationSeconds: quizSessionTimers[`${slideIndex}-${i}`],
                        initialAutoRevealOnTimerEnd: quizSessionAutoReveal[`${slideIndex}-${i}`],
                        onSessionCreated: onQuizSessionCreated,
                        onSettingsChange: onQuizSettingsChange,
                        teacherMode,
                      }}
                      tr={tr}
                    />
                  </div>
                )
              })
            ) : teacherMode ? (
              <div className="text-center py-8 space-y-4">
                <p className="text-muted-foreground">
                  {tr('Slide này chưa có câu hỏi trắc nghiệm.', 'This slide has no quiz yet.', '此幻灯片暂无测验。', 'このスライドにクイズがありません。', '이 슬라이드에 퀴즈가 없습니다.')}
                </p>
                <Button
                  onClick={handleGenerate}
                  disabled={quizGenLoading}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {quizGenLoading
                    ? tr('Đang tạo...', 'Creating...', '创建中...', '作成中...', '생성 중...')
                    : tr('Bắt đầu tạo câu hỏi trắc nghiệm', 'Generate quiz questions', '生成测验题', 'クイズを生成', '퀴즈 생성')}
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {tr('Slide này chưa có câu hỏi trắc nghiệm.', 'This slide has no quiz yet.', '此幻灯片暂无测验。', 'このスライドにクイズがありません。', '이 슬라이드에 퀴즈가 없습니다.')}
                </p>
              </div>
            )}
          </div>
          </QuizErrorBoundary>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
