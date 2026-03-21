'use client'

import { useCallback, useEffect, useState } from 'react'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { latexToReadable } from '@/app/tao-giao-trinh/lib/latex-to-readable'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type TrFn = (vi: string, en: string, zh: string, ja: string, ko: string) => string

type CatalogTypeFilter = 'all' | 'quiz' | 'essay'

type CatalogItem = {
  id: string
  type: string
  topic: string
  subject_id: string
  grade_level_id: string
  source: string
  difficulty: string
  order?: number
  created_at: string
  preview: string
}

type QuickDetailPayload =
  | {
      type: 'quiz'
      topic: string
      question: string
      options: string[]
      correctIndex: number
      correctLabel: string
    }
  | { type: 'essay'; topic: string; problem: string; solution: string }

const PAGE_SIZE = 50

function catalogSourceBadge(
  source: string,
  tr: TrFn
): { label: string; className: string } {
  const v = (source || 'ai').toLowerCase()
  if (v === 'sgk') {
    return {
      label: tr('SGK', 'SGK', '教材', 'SGK', 'SGK'),
      className:
        'border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-600/50',
    }
  }
  if (v === 'official') {
    return {
      label: tr('Chính thức', 'Official', '官方', '公式', '공식'),
      className:
        'border-emerald-500/50 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-600/50',
    }
  }
  if (v === 'edited') {
    return {
      label: tr('Đã sửa', 'Edited', '已编辑', '編集済み', '편집됨'),
      className:
        'border-violet-500/50 bg-violet-50 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200 dark:border-violet-600/50',
    }
  }
  return {
    label: tr('AI tạo', 'AI', 'AI 生成', 'AI', 'AI'),
    className:
      'border-sky-500/50 bg-sky-50 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200 dark:border-sky-600/50',
  }
}

function catalogDifficultyLabel(difficulty: string, qType: string, tr: TrFn): string {
  const d = (difficulty || '').toLowerCase()
  if (qType === 'quiz') {
    if (d === 'easy') return tr('Dễ', 'Easy', '易', '易', '쉬움')
    if (d === 'hard') return tr('Khó', 'Hard', '难', '難', '어려움')
    return tr('Trung bình', 'Medium', '中', '中', '보통')
  }
  const essay: Record<string, string> = {
    'nhan-biet': tr('Nhận biết', 'Recall', '识记', '知識', '인지'),
    'thong-hieu': tr('Thông hiểu', 'Understand', '理解', '理解', '이해'),
    'van-dung-thap': tr('Vận dụng thấp', 'Apply (low)', '应用（低）', '応用（低）', '적용(하)'),
    'van-dung-cao': tr('Vận dụng cao', 'Apply (high)', '应用（高）', '応用（高）', '적용(상)'),
    'thuc-te': tr('Thực tế', 'Real-world', '实际', '実践', '실전'),
  }
  return essay[d] || difficulty || tr('—', '—', '—', '—', '—')
}

export function CurriculumExerciseListDialog({
  open,
  onOpenChange,
  curriculumId,
  tr,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  curriculumId: string | null
  tr: TrFn
}) {
  const { toast } = useToast()
  const [catalogTypeFilter, setCatalogTypeFilter] = useState<CatalogTypeFilter>('all')
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [catalogTotal, setCatalogTotal] = useState(0)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [slideTopic, setSlideTopic] = useState('')
  const [buildLoading, setBuildLoading] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailData, setDetailData] = useState<QuickDetailPayload | null>(null)

  const t = {
    title: tr('Danh sách bài tập (trắc nghiệm & tự luận)', 'Exercise list (quiz & essay)', '习题列表（选择与问答）', '演習一覧（選択・記述）', '문제 목록(객관식·서술형)'),
    description: tr(
      'Danh sách xếp theo số bài (1.1, 1.2…) từ nhỏ đến lớn. Chọn câu rồi tạo phiếu — khi mở slide chữa bài: hết trắc nghiệm rồi tới tự luận.',
      'Sorted by exercise number (1.1, 1.2…) ascending. Pick questions to build a worksheet; review slides order: all multiple choice, then essay.',
      '按题号（1.1、1.2…）从小到大排列。选题生成作业单；讲评幻灯片顺序：先全部选择题，再问答题。',
      '番号順（1.1, 1.2…）に並びます。選んでワークシート作成；解説スライドは選択式→記述式の順。',
      '문항 번호(1.1, 1.2…) 오름차순. 선택 후 워크시트 생성; 해설 슬라이드는 객관식 → 서술형 순.',
    ),
    filterLabel: tr('Loại', 'Type', '类型', '種類', '유형'),
    filterAll: tr('Tất cả', 'All', '全部', 'すべて', '전체'),
    filterQuiz: tr('Trắc nghiệm', 'Multiple choice', '选择题', '選択式', '객관식'),
    filterEssay: tr('Tự luận', 'Essay', '问答题', '記述式', '서술형'),
    loadMore: tr('Tải thêm', 'Load more', '加载更多', 'さらに読み込む', '더 보기'),
    selectedLabel: tr('Đã chọn', 'Selected', '已选', '選択中', '선택됨'),
    selectAllVisible: tr('Chọn tất cả trên trang', 'Select all on page', '全选本页', 'このページをすべて選択', '이 페이지 모두 선택'),
    clearSelection: tr('Bỏ chọn', 'Clear', '清除选择', '選択解除', '선택 해제'),
    emptyCatalog: tr('Chưa có câu hỏi.', 'No questions yet.', '暂无题目。', '設問がありません。', '문항이 없습니다.'),
    openTeacherSlides: tr('Tạo phiếu & mở slide chữa bài', 'Create worksheet & open slides', '生成作业单并打开讲评', 'ワークシート作成してスライドを開く', '워크시트 만들고 슬라이드 열기'),
    creatingWorksheet: tr('Đang tạo phiếu…', 'Creating worksheet…', '正在生成作业单…', 'ワークシート作成中…', '워크시트 생성 중…'),
    catalogLoading: tr('Đang tải…', 'Loading…', '加载中…', '読み込み中…', '불러오는 중…'),
    slideTopicLabel: tr('Tiêu đề phiếu (tùy chọn)', 'Worksheet title (optional)', '作业单标题（可选）', 'ワークシートタイトル（任意）', '워크시트 제목(선택)'),
    slideTopicPlaceholder: tr('Ví dụ: Slide chữa bài tập', 'e.g. Exercise review slides', '例如：习题讲评幻灯片', '例：演習解説スライド', '예: 문제 해설 슬라이드'),
    closeDialog: tr('Đóng', 'Close', '关闭', '閉じる', '닫기'),
    saveCurriculumFirst: tr(
      'Vui lòng lưu giáo trình vào kho trước để xem danh sách câu hỏi.',
      'Save the curriculum to the library first to load questions.',
      '请先将课程保存到库以加载题目。',
      '設問一覧を読み込むには、先にカリキュラムをライブラリに保存してください。',
      '문항 목록을 보려면 먼저 교육과정을 라이브러리에 저장하세요.',
    ),
    toastErr: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
    quickDetail: tr('Xem chi tiết', 'Quick view', '快速查看', '詳細を見る', '빠른 보기'),
    detailLoading: tr('Đang tải chi tiết…', 'Loading details…', '正在加载详情…', '詳細を読み込み中…', '상세 불러오는 중…'),
    detailErr: tr('Không tải được chi tiết.', 'Could not load details.', '无法加载详情。', '詳細を読み込めません。', '상세를 불러올 수 없습니다.'),
    correctAnswer: tr('Đáp án đúng', 'Correct answer', '正确答案', '正解', '정답'),
    essaySolution: tr('Lời giải', 'Solution', '解答', '解答', '해설'),
  }

  useEffect(() => {
    if (!open || !curriculumId) return
    let cancelled = false
    setCatalogLoading(true)
    ;(async () => {
      try {
        const res = await fetch(
          `/api/worksheet/curriculum-questions-catalog?curriculumId=${encodeURIComponent(curriculumId)}&type=${encodeURIComponent(catalogTypeFilter)}&limit=${PAGE_SIZE}&offset=0`
        )
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          toast({ title: t.toastErr, description: data.error ?? String(res.status), variant: 'destructive' })
          setCatalogItems([])
          setCatalogTotal(0)
          return
        }
        setCatalogItems((data.items ?? []) as CatalogItem[])
        setCatalogTotal(Number(data.total) || 0)
      } catch (e) {
        if (!cancelled) {
          toast({
            title: t.toastErr,
            description: e instanceof Error ? e.message : String(e),
            variant: 'destructive',
          })
          setCatalogItems([])
          setCatalogTotal(0)
        }
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tr() changes identity each parent render; avoid refetch loop
  }, [open, curriculumId, catalogTypeFilter, toast])

  const loadMoreCatalog = useCallback(async () => {
    if (!curriculumId || catalogLoading || catalogItems.length >= catalogTotal) return
    setCatalogLoading(true)
    try {
      const off = catalogItems.length
      const res = await fetch(
        `/api/worksheet/curriculum-questions-catalog?curriculumId=${encodeURIComponent(curriculumId)}&type=${encodeURIComponent(catalogTypeFilter)}&limit=${PAGE_SIZE}&offset=${off}`
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: t.toastErr, description: data.error ?? String(res.status), variant: 'destructive' })
        return
      }
      const next = (data.items ?? []) as CatalogItem[]
      setCatalogItems((prev) => [...prev, ...next])
    } catch (e) {
      toast({
        title: t.toastErr,
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      })
    } finally {
      setCatalogLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tr() via `t` not listed to avoid churn
  }, [catalogItems.length, catalogLoading, catalogTotal, catalogTypeFilter, curriculumId, toast])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const selectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = [...prev]
      for (const it of catalogItems) {
        if (!next.includes(it.id)) next.push(it.id)
      }
      return next
    })
  }

  const clearSelection = () => setSelectedIds([])

  const openQuickDetail = useCallback(
    async (questionId: string) => {
      if (!curriculumId) return
      setDetailOpen(true)
      setDetailLoading(true)
      setDetailData(null)
      try {
        const res = await fetch(
          `/api/worksheet/question-detail?curriculumId=${encodeURIComponent(curriculumId)}&questionId=${encodeURIComponent(questionId)}`
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast({
            title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
            description: typeof data.error === 'string' ? data.error : tr('Không tải được chi tiết.', 'Could not load details.', '无法加载详情。', '詳細を読み込めません。', '상세를 불러올 수 없습니다.'),
            variant: 'destructive',
          })
          setDetailOpen(false)
          return
        }
        setDetailData(data as QuickDetailPayload)
      } catch (e) {
        toast({
          title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
          description: e instanceof Error ? e.message : String(e),
          variant: 'destructive',
        })
        setDetailOpen(false)
      } finally {
        setDetailLoading(false)
      }
    },
    [curriculumId, toast, tr]
  )

  const handleBuildSlides = async () => {
    if (!curriculumId || selectedIds.length === 0) return
    setBuildLoading(true)
    try {
      const res = await fetch('/api/worksheet/build-review-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionIds: selectedIds,
          topic: slideTopic.trim() || undefined,
          curriculumId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: t.toastErr, description: data.error ?? String(res.status), variant: 'destructive' })
        return
      }
      const path = data.teacherPath as string | undefined
      if (path) {
        window.open(path, '_blank', 'noopener,noreferrer')
        onOpenChange(false)
      }
    } catch (e) {
      toast({
        title: t.toastErr,
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      })
    } finally {
      setBuildLoading(false)
    }
  }

  const typeBadge = (type: string) => {
    if (type === 'quiz') {
      return (
        <Badge variant="secondary" className="text-xs font-medium shrink-0">
          {t.filterQuiz}
        </Badge>
      )
    }
    if (type === 'essay') {
      return (
        <Badge variant="outline" className="text-xs font-medium shrink-0 border-emerald-600/40 text-emerald-800 dark:text-emerald-200">
          {t.filterEssay}
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="text-xs shrink-0">
        {type}
      </Badge>
    )
  }

  const hasMore = catalogItems.length < catalogTotal

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) {
          setSelectedIds([])
          setSlideTopic('')
          setCatalogItems([])
          setCatalogTotal(0)
        }
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden sm:max-w-3xl">
        <div className="p-6 pb-2">
          <DialogHeader>
            <DialogTitle>{t.title}</DialogTitle>
            <DialogDescription>{t.description}</DialogDescription>
          </DialogHeader>
        </div>
        {!curriculumId ? (
          <div className="px-6 pb-6 text-sm text-muted-foreground">{t.saveCurriculumFirst}</div>
        ) : (
          <>
            <div className="px-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b pb-3">
              <div className="space-y-2 flex-1 max-w-xs">
                <Label htmlFor="curriculum-catalog-type">{t.filterLabel}</Label>
                <Select value={catalogTypeFilter} onValueChange={(v) => setCatalogTypeFilter(v as CatalogTypeFilter)}>
                  <SelectTrigger id="curriculum-catalog-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.filterAll}</SelectItem>
                    <SelectItem value="quiz">{t.filterQuiz}</SelectItem>
                    <SelectItem value="essay">{t.filterEssay}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={selectAllVisible} disabled={catalogItems.length === 0}>
                  {t.selectAllVisible}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={clearSelection} disabled={selectedIds.length === 0}>
                  {t.clearSelection}
                </Button>
              </div>
            </div>
            <div className="px-6 py-2 text-sm text-muted-foreground">
              {t.selectedLabel}: {selectedIds.length}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-2">
              {catalogLoading && catalogItems.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">{t.catalogLoading}</p>
              ) : catalogItems.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">{t.emptyCatalog}</p>
              ) : (
                <ul className="space-y-2 pb-4">
                  {catalogItems.map((row) => {
                    const checked = selectedIds.includes(row.id)
                    const srcBadge = catalogSourceBadge(row.source, tr)
                    const diffText = catalogDifficultyLabel(row.difficulty, row.type, tr)
                    return (
                      <li key={row.id}>
                        <div
                          className={cn(
                            'flex gap-3 rounded-md border p-4 text-sm transition-colors hover:bg-muted/50',
                            checked && 'border-primary/50 bg-muted/30',
                          )}
                        >
                          <label className="flex min-w-0 flex-1 cursor-pointer gap-3">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 shrink-0 rounded border-input"
                              checked={checked}
                              onChange={() => toggleSelect(row.id)}
                            />
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {typeBadge(row.type)}
                                <Badge variant="outline" className={cn('text-xs font-normal', srcBadge.className)}>
                                  {srcBadge.label}
                                </Badge>
                                <Badge variant="secondary" className="text-xs font-normal">
                                  {diffText}
                                </Badge>
                                <span className="font-mono text-xs text-muted-foreground">{row.id.slice(0, 8)}…</span>
                                {row.topic ? (
                                  <span className="text-xs text-muted-foreground break-words whitespace-pre-wrap max-w-full min-w-0">
                                    {latexToReadable(row.topic)}
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-foreground break-words whitespace-pre-wrap leading-relaxed text-[15px]">
                                {latexToReadable(row.preview || '—')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {row.subject_id} · {row.grade_level_id}
                                {row.created_at ? ` · ${new Date(row.created_at).toLocaleString()}` : ''}
                              </p>
                            </div>
                          </label>
                          <div className="flex shrink-0 flex-col justify-end self-stretch">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="whitespace-nowrap border-amber-500/40 text-amber-900 hover:bg-amber-50 dark:text-amber-100 dark:hover:bg-amber-950/40"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                void openQuickDetail(row.id)
                              }}
                            >
                              <Eye className="h-4 w-4 shrink-0 sm:mr-1" aria-hidden />
                              <span className="hidden sm:inline">{t.quickDetail}</span>
                            </Button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            {hasMore && (
              <div className="px-6 pb-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => void loadMoreCatalog()}
                  disabled={catalogLoading}
                >
                  {catalogLoading ? t.catalogLoading : t.loadMore}
                </Button>
              </div>
            )}
            <div className="px-6 py-3 border-t space-y-2 bg-muted/20">
              <Label htmlFor="curriculum-slide-topic">{t.slideTopicLabel}</Label>
              <Input
                id="curriculum-slide-topic"
                value={slideTopic}
                onChange={(e) => setSlideTopic(e.target.value)}
                placeholder={t.slideTopicPlaceholder}
              />
            </div>
            <DialogFooter className="p-6 pt-3 border-t sm:justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t.closeDialog}
              </Button>
              <Button
                type="button"
                onClick={() => void handleBuildSlides()}
                disabled={buildLoading || selectedIds.length === 0}
              >
                {buildLoading ? t.creatingWorksheet : t.openTeacherSlides}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>

    <Sheet
      open={detailOpen}
      onOpenChange={(o) => {
        setDetailOpen(o)
        if (!o) setDetailData(null)
      }}
    >
      <SheetContent highZIndex side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t.quickDetail}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4 text-sm">
          {detailLoading ? (
            <p className="text-muted-foreground">{t.detailLoading}</p>
          ) : detailData ? (
            <>
              {detailData.topic ? (
                <p className="text-muted-foreground whitespace-pre-wrap break-words">{latexToReadable(detailData.topic)}</p>
              ) : null}
              {detailData.type === 'quiz' ? (
                <div className="space-y-3">
                  <div className="whitespace-pre-wrap break-words leading-relaxed">{latexToReadable(detailData.question)}</div>
                  <ul className="space-y-2 list-none">
                    {detailData.options.map((opt, i) => (
                      <li key={i} className="flex gap-2 break-words">
                        <span className="font-semibold shrink-0">{String.fromCharCode(65 + i)}.</span>
                        <span>{latexToReadable(opt)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="rounded-md border border-emerald-500/30 bg-emerald-50/80 px-3 py-2 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                    <span className="font-semibold">{t.correctAnswer}:</span> {detailData.correctLabel}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="whitespace-pre-wrap break-words leading-relaxed font-medium">
                    {latexToReadable(detailData.problem)}
                  </div>
                  <p className="font-semibold text-foreground">{t.essaySolution}</p>
                  <div className="whitespace-pre-wrap break-words leading-relaxed text-muted-foreground">
                    {latexToReadable(detailData.solution)}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">{t.detailErr}</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
    </>
  )
}
