'use client'

import { useCallback } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogPortal,
  DialogOverlay,
  DialogClose,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ContentEmbed, parseContentEmbeds, parseQuizData } from './content-embed'
import { Sparkles, X } from 'lucide-react'

type SlideBlock = { header: string; content: string }

export function extractQuizFromSlide(slide: { blocks?: SlideBlock[]; content?: string }): Array<{ urlOrId: string; rawMarker: string }> {
  const texts: string[] = []
  for (const b of slide.blocks ?? []) {
    if (b.content) texts.push(b.content)
  }
  if (slide.content) texts.push(slide.content)
  const all = parseContentEmbeds(texts.join('\n\n')).filter((e) => e.type === 'quiz')
  return all.map((e) => ({ urlOrId: e.urlOrId, rawMarker: e.rawMarker }))
}

interface QuizPopupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slide: { title: string; blocks?: SlideBlock[]; content?: string }
  slideIndex: number
  curriculumId?: string | null
  tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string
  /** Chế độ giáo viên: hiện nút tạo/thay câu hỏi. Học sinh: chỉ xem. */
  teacherMode?: boolean
  onGenerateQuiz?: () => Promise<void>
  onReplaceBrokenQuiz?: (rawMarker: string) => Promise<void>
  quizGenLoading?: boolean
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
}: QuizPopupDialogProps) {
  const quizzes = extractQuizFromSlide(slide)
  const hasQuiz = quizzes.length > 0
  const slideContentKey = slide.blocks?.map((b) => b.content).join('\n') ?? slide.content ?? ''

  const handleGenerate = useCallback(async () => {
    if (onGenerateQuiz) await onGenerateQuiz()
  }, [onGenerateQuiz])

  const zClass = 'z-[110]'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className={zClass} />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-[50%] top-[50%] grid w-full max-w-2xl max-h-[85vh] overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg',
            zClass
          )}
        >
          <DialogHeader>
            <DialogTitle>
              {tr('Câu hỏi trắc nghiệm', 'Quiz questions', '测验题', 'クイズ', '퀴즈')} – {slide.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4" key={slideContentKey}>
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
                      liveQuizContext={curriculumId ? { curriculumId, slideIndex, blockIndex: i } : undefined}
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
          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
