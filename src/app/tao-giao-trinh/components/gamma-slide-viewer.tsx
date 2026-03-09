'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X, Printer, ArrowRight, TrendingUp, CalendarCheck, Lightbulb, BookOpen, Target, BarChart2, Trash2, Play, Pause, Settings2, History, Edit3, Plus, ClipboardList } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { parseCurriculumToSlides, parseContentToBlocks, type AISlideData } from '../lib/curriculum-to-slides'
import { latexToReadable } from '../lib/latex-to-readable'
import { ContentEmbed, splitContentWithEmbeds, type EmbedType } from './content-embed'
import { EmbedInsertDialog } from './embed-insert-dialog'
import { SlideEditHistorySheet } from './slide-edit-history-sheet'
import { SlideProposalDialog } from './slide-proposal-dialog'
import { SlideProposalVote } from './slide-proposal-vote'
import { QuizPopupDialog } from './quiz-popup-dialog'
import { useToast } from '@/hooks/use-toast'
import { saveSlidesToCurriculum, saveUserCustomizedSlides, getSlideProposalsForCurriculum } from '../actions'

const DARK_GRADIENTS = [
  'linear-gradient(160deg, #1e3a5f 0%, #0f172a 50%)',
  'linear-gradient(160deg, #312e81 0%, #1e1b4b 50%)',
  'linear-gradient(160deg, #1e3a5f 0%, #0f172a 50%)',
  'linear-gradient(160deg, #1e3a5f 0%, #0c4a6e 50%)',
]

const ICON_MAP: Record<string, React.ReactNode> = {
  'định nghĩa': <ArrowRight className="h-5 w-5" />,
  'quy tắc': <TrendingUp className="h-5 w-5" />,
  'ứng dụng': <CalendarCheck className="h-5 w-5" />,
  'khởi động': <Lightbulb className="h-5 w-5" />,
  'hình thành kiến thức': <BookOpen className="h-5 w-5" />,
  'luyện tập': <Target className="h-5 w-5" />,
  'vận dụng': <CalendarCheck className="h-5 w-5" />,
  'nội dung': <BookOpen className="h-5 w-5" />,
}

function BlockContentWithEmbeds({ content, onRemoveEmbed, removeTitle, liveQuizContext, tr, hideQuiz }: { content: string; onRemoveEmbed?: (rawMarker: string) => void; removeTitle?: string; liveQuizContext?: { curriculumId: string; slideIndex: number; blockIndex: number }; tr?: (vi: string, en: string, zh: string, ja: string, ko: string) => string; hideQuiz?: boolean }) {
  const parts = splitContentWithEmbeds(content)
  return (
    <div className="[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_p]:my-2 text-base md:text-lg leading-relaxed">
      {parts.map((p, i) => {
        if (p.type === 'text') {
          return <div key={i} dangerouslySetInnerHTML={{ __html: markdownToHtml(p.value) }} />
        }
        const ep = p as { type: 'embed'; embedType: string; urlOrId: string; rawMarker: string }
        if (hideQuiz && ep.embedType === 'quiz') return null
        return (
          <div key={i} className="relative group">
            <ContentEmbed type={ep.embedType as EmbedType} urlOrId={ep.urlOrId} width={560} height={350} liveQuizContext={liveQuizContext} tr={tr} hideQuiz={hideQuiz} />
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

function getIconForHeader(header: string): React.ReactNode {
  const key = header.toLowerCase().trim()
  for (const [k, icon] of Object.entries(ICON_MAP)) {
    if (key.includes(k) || k.includes(key)) return icon
  }
  return <BookOpen className="h-5 w-5" />
}

function markdownToHtml(text: string): string {
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  const lines = html.split(/\n/)
  const out: string[] = []
  let inList = false
  for (const line of lines) {
    const bullet = line.match(/^[\-\*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/)
    if (bullet) {
      if (!inList) {
        out.push('<ul class="list-disc pl-5 space-y-1 text-sm">')
        inList = true
      }
      out.push(`<li>${bullet[1]}</li>`)
    } else {
      if (inList) {
        out.push('</ul>')
        inList = false
      }
  if (line.trim()) {
      out.push(`<p class="leading-relaxed">${line}</p>`)
      }
    }
  }
  if (inList) out.push('</ul>')
  return out.join('') || ''
}

type SlideItem = { title: string; content: string; blocks?: AISlideData['blocks']; imageUrl?: string }

export type SlideMode = 'original' | 'shared' | 'personal'

interface GammaSlideViewerProps {
  curriculumMarkdown: string
  topic: string
  onClose: () => void
  /** Slides từ AI – nếu có thì dùng trực tiếp, không parse từ markdown */
  aiSlides?: AISlideData[] | null
  curriculumId?: string | null
  subjectId?: string
  gradeLevelId?: string
  tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string
  /** Gọi khi lưu thành công – để parent refetch slides */
  onSlidesSaved?: () => void
  /** Chế độ: bản gốc, bản chung, bản riêng */
  slideMode?: SlideMode
  originalSlides?: AISlideData[] | null
  personalSlides?: AISlideData[] | null
  sharedSlides?: AISlideData[] | null
}

function getBaseSlides(curriculumMarkdown: string, topic: string, aiSlides: AISlideData[] | null | undefined): SlideItem[] {
  const hasEmbeds = /\[(geogebra|desmos|youtube|phet|maps|image|audio|quiz|code|latex):/.test(curriculumMarkdown)
  if (aiSlides && aiSlides.length > 0 && !hasEmbeds) {
    return aiSlides.map((s) => ({ title: s.title, content: '', blocks: s.blocks, imageUrl: s.imageUrl }))
  }
  const readable = latexToReadable(curriculumMarkdown)
  const parsed = parseCurriculumToSlides(readable)
  return topic ? [{ title: topic, content: '' }, ...parsed] : parsed
}

export function GammaSlideViewer({ curriculumMarkdown, topic, onClose, aiSlides, curriculumId, subjectId, gradeLevelId, tr, onSlidesSaved, slideMode, originalSlides, personalSlides, sharedSlides }: GammaSlideViewerProps) {
  const { toast } = useToast()
  const [slides, setSlides] = useState<SlideItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [autoPlay, setAutoPlay] = useState(false)
  const [autoPlayIntervalMs, setAutoPlayIntervalMs] = useState(5000)
  const [transitionDirection, setTransitionDirection] = useState<'next' | 'prev'>('next')
  const [personalViewSubMode, setPersonalViewSubMode] = useState<'current' | 'original'>('current')
  const [showEditHistory, setShowEditHistory] = useState(false)
  const [proposals, setProposals] = useState<Array<{ id: string; slide_index: number; block_index: number; segment_type: string; original_text?: string | null; proposed_text: string; proposed_header?: string | null; status: string; agree_count: number; disagree_count: number; proposed_by?: string | null; myVote?: string }>>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [editingBlock, setEditingBlock] = useState<{ slideIndex: number; blockIndex: number } | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [editingTitle, setEditingTitle] = useState<number | null>(null)
  const [editingTitleValue, setEditingTitleValue] = useState('')
  const [editingHeader, setEditingHeader] = useState<{ slideIndex: number; blockIndex: number } | null>(null)
  const [editingHeaderValue, setEditingHeaderValue] = useState('')
  const [proposalDialog, setProposalDialog] = useState<{ open: boolean; slideIndex: number; blockIndex: number; type: 'edit' | 'add'; originalContent?: string; blockHeader?: string } | null>(null)
  const [quizGenLoading, setQuizGenLoading] = useState(false)
  const [quizPopupOpen, setQuizPopupOpen] = useState(false)

  const INTERVAL_OPTIONS = [
    { value: 3000, label: '3s' },
    { value: 5000, label: '5s' },
    { value: 7000, label: '7s' },
    { value: 10000, label: '10s' },
    { value: 15000, label: '15s' },
  ] as const

  const baseSlidesForDisplay =
    slideMode === 'personal' && personalViewSubMode === 'original' && originalSlides && originalSlides.length > 0
      ? getBaseSlides(curriculumMarkdown, topic, originalSlides)
      : getBaseSlides(curriculumMarkdown, topic, aiSlides)

  useEffect(() => {
    setSlides(baseSlidesForDisplay)
    setCurrentIndex(0)
  }, [curriculumMarkdown, topic, aiSlides, slideMode, personalViewSubMode, originalSlides])

  const goNext = useCallback(() => {
    setAutoPlay(false)
    setTransitionDirection('next')
    setCurrentIndex((i) => Math.min(i + 1, slides.length - 1))
  }, [slides.length])

  const goPrev = useCallback(() => {
    setAutoPlay(false)
    setTransitionDirection('prev')
    setCurrentIndex((i) => Math.max(i - 1, 0))
  }, [])

  type EmbedPlacement = 'end' | 'newBlock' | number
  const handleInsertEmbed = useCallback((marker: string, placement: EmbedPlacement = 'end') => {
    setSlides((prev) => {
      const next = [...prev]
      const s = next[currentIndex]
      if (!s) return prev
      const blocks = s.blocks ?? parseContentToBlocks(s.content)
      const newBlocks = blocks.length > 0 ? blocks.map((b) => ({ ...b })) : [{ header: tr('Biểu đồ', 'Graph', '图表', 'グラフ', '그래프'), content: '' }]
      if (placement === 'newBlock') {
        newBlocks.push({ header: tr('Biểu đồ', 'Graph', '图表', 'グラフ', '그래프'), content: marker })
      } else if (typeof placement === 'number' && placement >= 0 && placement < newBlocks.length) {
        const b = newBlocks[placement]
        newBlocks[placement] = { ...b, content: b.content ? b.content + '\n\n' + marker : marker }
      } else {
        const lastIdx = newBlocks.length - 1
        const last = newBlocks[lastIdx]
        newBlocks[lastIdx] = { ...last, content: last.content ? last.content + '\n\n' + marker : marker }
      }
      return next.map((sl, i) => (i === currentIndex ? { ...sl, blocks: newBlocks, content: '' } : sl))
    })
    setEmbedDialogOpen(false)
  }, [currentIndex, tr])

  const handleRemoveEmbed = useCallback((rawMarker: string) => {
    setSlides((prev) => {
      const next = [...prev]
      const s = next[currentIndex]
      if (!s) return prev
      const blocks = s.blocks ?? parseContentToBlocks(s.content)
      const newBlocks = blocks.map((b) => {
        if (!b.content.includes(rawMarker)) return b
        const newContent = b.content.split(rawMarker).join('').replace(/\n\s*\n\s*\n/g, '\n\n').trim()
        return { ...b, content: newContent }
      })
      return next.map((sl, i) => (i === currentIndex ? { ...sl, blocks: newBlocks, content: '' } : sl))
    })
    toast({ title: tr('Đã xóa biểu đồ', 'Embed removed', '已删除图表', 'グラフを削除', '그래프 삭제됨'), duration: 1500 })
  }, [currentIndex, toast, tr])

  const handleGenerateQuiz = useCallback(async () => {
    const s = slides[currentIndex]
    if (!s) return
    setQuizGenLoading(true)
    try {
      const blocks = s.blocks ?? parseContentToBlocks(s.content)
      const res = await fetch('/api/slide-generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: s.title,
          content: s.content || blocks.map((b) => b.content).join('\n\n'),
          blocks: blocks.map((b) => ({ header: b.header, content: b.content })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.markers?.length) {
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: data?.error || tr('Không tạo được câu hỏi', 'Failed to generate quiz', '无法生成测验', 'クイズ作成失敗', '퀴즈 생성 실패'), variant: 'destructive' })
        return
      }
      const existingCount = (s.blocks ?? []).reduce((acc, b) => acc + (b.content?.match(/\[quiz:/g)?.length ?? 0), 0) + (s.content?.match(/\[quiz:/g)?.length ?? 0)
      const maxToAdd = Math.max(0, 2 - existingCount)
      const markers = (data.markers as string[]).slice(0, maxToAdd)
      if (markers.length === 0) {
        toast({ title: tr('Đã đủ 2 câu', 'Max 2 quiz per slide', '每 slide 最多 2 题', '1スライド最大2問', '슬라이드당 최대 2문제'), duration: 2000 })
        return
      }
      const markerText = markers.join('\n\n')
      setSlides((prev) => {
        const next = [...prev]
        const current = next[currentIndex]
        if (!current) return prev
        const blks = current.blocks ?? parseContentToBlocks(current.content)
        const newBlocks = blks.length > 0 ? blks.map((b) => ({ ...b })) : [{ header: tr('Trắc nghiệm', 'Quiz', '测验', 'クイズ', '퀴즈'), content: '' }]
        const last = newBlocks[newBlocks.length - 1]
        newBlocks[newBlocks.length - 1] = { ...last, content: last.content ? last.content + '\n\n' + markerText : markerText }
        return next.map((sl, i) => (i === currentIndex ? { ...sl, blocks: newBlocks, content: '' } : sl))
      })
      toast({ title: tr('Đã tạo câu hỏi trắc nghiệm', 'Quiz created', '已创建测验', 'クイズ作成完了', '퀴즈 생성됨'), duration: 2000 })
      if (curriculumId === undefined) return
      const updatedSlides = slides.map((sl, i) =>
        i === currentIndex
          ? (() => {
              const blks = sl.blocks ?? parseContentToBlocks(sl.content)
              const nb = blks.length > 0 ? blks.map((b) => ({ ...b })) : [{ header: tr('Trắc nghiệm', 'Quiz', '测验', 'クイズ', '퀴즈'), content: '' }]
              const last = nb[nb.length - 1]
              nb[nb.length - 1] = { ...last, content: last.content ? last.content + '\n\n' + markerText : markerText }
              return { ...sl, blocks: nb, content: '' }
            })()
          : sl
      )
      if (slideMode === 'personal') {
        const r = await saveUserCustomizedSlides({ curriculumId, slides: updatedSlides })
        if (r?.error) toast({ title: tr('Lỗi lưu', 'Save error', '保存错误', '保存エラー', '저장 오류'), description: r.error, variant: 'destructive' })
        else onSlidesSaved?.()
      } else if (slideMode === 'shared' || (!slideMode && curriculumId)) {
        const r = await saveSlidesToCurriculum({
          curriculumId,
          topic: topic || 'Bài giảng',
          subjectId: subjectId ?? 'toan',
          gradeLevelId: gradeLevelId ?? 'lop-6',
          slides: updatedSlides,
        })
        if (r?.error) toast({ title: tr('Lỗi lưu', 'Save error', '保存错误', '保存エラー', '저장 오류'), description: r.error, variant: 'destructive' })
        else onSlidesSaved?.()
      }
    } catch (e) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: e instanceof Error ? e.message : String(e), variant: 'destructive' })
    } finally {
      setQuizGenLoading(false)
    }
  }, [currentIndex, slides, curriculumId, slideMode, topic, subjectId, gradeLevelId, toast, tr, onSlidesSaved])

  const handleSaveShared = useCallback(async () => {
    if (!curriculumId || slides.length === 0) return
    setSaveLoading(true)
    const res = await saveSlidesToCurriculum({
      curriculumId,
      topic: topic.trim() || 'Bài giảng',
      subjectId: subjectId ?? 'toan',
      gradeLevelId: gradeLevelId ?? 'lop-6',
      slides: slides.map((s) => ({ title: s.title, blocks: s.blocks ?? [], imageUrl: s.imageUrl })),
    })
    setSaveLoading(false)
    if (res?.error) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: res.error, variant: 'destructive' })
    } else {
      toast({ title: tr('Đã lưu. Mọi người cùng dùng.', 'Saved. Everyone can use.', '已保存，大家共用。', '保存しました。みんなで共有。', '저장됨. 모두 사용 가능.'), duration: 2000 })
      onSlidesSaved?.()
    }
  }, [curriculumId, slides, topic, subjectId, gradeLevelId, toast, tr, onSlidesSaved])

  const handleSavePersonal = useCallback(async () => {
    if (!curriculumId || slides.length === 0) return
    setSaveLoading(true)
    const res = await saveUserCustomizedSlides({
      curriculumId,
      slides: slides.map((s) => ({ title: s.title, blocks: s.blocks ?? [], imageUrl: s.imageUrl })),
    })
    setSaveLoading(false)
    if (res?.error) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: res.error, variant: 'destructive' })
    } else {
      toast({ title: tr('Đã lưu bản riêng', 'Personal version saved', '个人版本已保存', '個人版を保存しました', '개인 버전 저장됨'), duration: 2000 })
      onSlidesSaved?.()
    }
  }, [curriculumId, slides, toast, tr, onSlidesSaved])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        goNext()
      }
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, goNext, goPrev])

  useEffect(() => {
    setEditingBlock(null)
    setEditingTitle(null)
    setEditingHeader(null)
  }, [currentIndex])

  useEffect(() => {
    if (!curriculumId) return
    if (slideMode === 'shared' || (!slideMode && curriculumId)) {
      getSlideProposalsForCurriculum(curriculumId).then((res) => {
        if (res?.success && res.items) {
          setProposals(res.items)
          setCurrentUserId(res.currentUserId ?? null)
        } else {
          setProposals([])
        }
      })
    } else setProposals([])
  }, [curriculumId, slideMode])

  useEffect(() => {
    if (!autoPlay || slides.length <= 1) return
    const id = window.setInterval(() => {
      setTransitionDirection('next')
      setCurrentIndex((i) => {
        if (i >= slides.length - 1) return 0
        return i + 1
      })
    }, autoPlayIntervalMs)
    return () => window.clearInterval(id)
  }, [autoPlay, slides.length, autoPlayIntervalMs])

  if (slides.length === 0) return null

  const slide = slides[currentIndex]
  const blocks = slide.blocks ?? parseContentToBlocks(slide.content)
  const gradient = DARK_GRADIENTS[currentIndex % DARK_GRADIENTS.length]
  const hasBlocks = blocks.length > 0

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 text-white/90 print:hidden">
        <span className="text-sm font-medium">{currentIndex + 1} / {slides.length}</span>
        <div className="flex items-center gap-2 flex-wrap">
          {curriculumId && slideMode === 'personal' && (
            <Button variant="ghost" size="sm" onClick={() => setEmbedDialogOpen(true)} className="text-white hover:bg-white/20 border border-white/30" title={tr('Chèn nội dung (YouTube, GeoGebra, ảnh, quiz...)', 'Insert content (YouTube, GeoGebra, image, quiz...)', '插入内容', 'コンテンツを挿入', '콘텐츠 삽입')}>
              <BarChart2 className="h-4 w-4 mr-1" /> {tr('Chèn', 'Insert', '插入', '挿入', '삽입')}
            </Button>
          )}
          {curriculumId && (
            <>
              {(slideMode === 'shared' || (!slideMode && curriculumId)) && (
                <Button variant="ghost" size="sm" onClick={() => setShowEditHistory(true)} className="text-white hover:bg-white/20 border border-white/30" title={tr('Lịch sử chỉnh sửa', 'Edit history', '编辑历史', '編集履歴', '편집 기록')}>
                  <History className="h-4 w-4 mr-1" />
                  {tr('Lịch sử', 'History', '历史', '履歴', '기록')}
                </Button>
              )}
              {slideMode === 'original' && (
                <Button variant="ghost" size="sm" onClick={() => void handleSavePersonal()} disabled={saveLoading} className="text-white hover:bg-white/20 border border-amber-400/50" title={tr('Lưu thành bản riêng', 'Save as personal version', '保存为个人版本', '個人版として保存', '개인 버전으로 저장')}>
                  {saveLoading ? tr('Đang lưu...', 'Saving...', '保存中...', '保存中...', '저장 중...') : tr('Lưu thành bản riêng', 'Save as personal', '保存为个人版', '個人版として保存', '개인으로 저장')}
                </Button>
              )}
              {slideMode === 'personal' && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPersonalViewSubMode((v) => (v === 'original' ? 'current' : 'original'))}
                    className="text-white hover:bg-white/20 border border-white/30"
                    title={personalViewSubMode === 'original' ? tr('Xem bản hiện tại', 'View current version', '查看当前版本', '現在の版を表示', '현재 버전 보기') : tr('Xem bản gốc', 'View original', '查看原版', 'オリジナルを表示', '원본 보기')}
                  >
                    {personalViewSubMode === 'original' ? tr('Bản hiện tại', 'Current', '当前', '現在', '현재') : tr('Bản gốc', 'Original', '原版', 'オリジナル', '원본')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void handleSavePersonal()} disabled={saveLoading} className="text-white hover:bg-white/20" title={tr('Lưu bản riêng', 'Save personal version', '保存个人版本', '個人版を保存', '개인 버전 저장')}>
                    {saveLoading ? tr('Đang lưu...', 'Saving...', '保存中...', '保存中...', '저장 중...') : tr('Lưu', 'Save', '保存', '保存', '저장')}
                  </Button>
                </>
              )}
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoPlay((v) => !v)}
            className="text-white hover:bg-white/20 border border-white/30"
            title={autoPlay ? tr('Dừng tự chạy', 'Stop auto-play', '停止自动播放', '自動再生を停止', '자동 재생 중지') : tr('Tự chạy', 'Auto-play', '自动播放', '自動再生', '자동 재생')}
          >
            {autoPlay ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
            {autoPlay ? tr('Dừng', 'Stop', '停止', '停止', '중지') : tr('Tự chạy', 'Auto', '自动', '自動', '자동')}
          </Button>
          <Select value={String(autoPlayIntervalMs)} onValueChange={(v) => setAutoPlayIntervalMs(Number(v))}>
            <SelectTrigger className="w-[72px] h-9 text-white hover:bg-white/20 border-white/30 bg-transparent focus:ring-white/30 [&>span]:text-white" title={tr('Thời gian mỗi trang', 'Time per slide', '每页时间', '各スライドの時間', '슬라이드당 시간')}>
              <Settings2 className="h-4 w-4 mr-1 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[110]">
              {INTERVAL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={goPrev} disabled={currentIndex === 0} className="text-white hover:bg-white/20" title={tr('Slide trước', 'Previous slide', '上一张', '前のスライド', '이전 슬라이드')}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button variant="ghost" size="icon" onClick={goNext} disabled={currentIndex === slides.length - 1} className="text-white hover:bg-white/20" title={tr('Slide sau', 'Next slide', '下一张', '次のスライド', '다음 슬라이드')}>
            <ChevronRight className="h-6 w-6" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => window.print()} className="text-white hover:bg-white/20" title={tr('In', 'Print', '打印', '印刷', '인쇄')}>
            <Printer className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20" title={tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <EmbedInsertDialog
        open={embedDialogOpen}
        onOpenChange={setEmbedDialogOpen}
        onInsert={(marker, placement) => handleInsertEmbed(marker, placement)}
        tr={tr}
        highZIndex
        blocks={slide.blocks ?? parseContentToBlocks(slide.content)}
      />
      <SlideEditHistorySheet open={showEditHistory} onOpenChange={setShowEditHistory} curriculumId={curriculumId ?? null} tr={tr} />
      <QuizPopupDialog
        open={quizPopupOpen}
        onOpenChange={setQuizPopupOpen}
        slide={slide}
        slideIndex={currentIndex}
        curriculumId={curriculumId}
        tr={tr}
        onGenerateQuiz={handleGenerateQuiz}
        quizGenLoading={quizGenLoading}
      />
      {proposalDialog && curriculumId && (
        <SlideProposalDialog
          open={proposalDialog.open}
          onOpenChange={(open) => !open && setProposalDialog(null)}
          curriculumId={curriculumId}
          slideIndex={proposalDialog.slideIndex}
          blockIndex={proposalDialog.blockIndex}
          segmentType={proposalDialog.type}
          originalContent={proposalDialog.originalContent}
          blockHeader={proposalDialog.blockHeader}
          tr={tr}
          onSuccess={() => getSlideProposalsForCurriculum(curriculumId).then((r) => r?.success && r.items && setProposals(r.items))}
        />
      )}

      {/* Slide - Layout split: trái visual (nền xanh đậm), phải content (nền trắng) */}
      <div className="flex-1 flex overflow-hidden print:hidden relative">
        <div
          key={currentIndex}
          className={cn(
            'absolute inset-0 flex animate-in fade-in duration-500 ease-out',
            transitionDirection === 'next' ? 'slide-in-from-right-8' : 'slide-in-from-left-8'
          )}
        >
        {/* Trái: Ảnh minh họa hoặc visual mặc định */}
        <div className="w-[45%] min-w-[300px] flex items-center justify-center relative p-8" style={{ background: gradient }}>
          <div className="absolute top-8 left-8 w-9 h-9 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
            {currentIndex + 1}
          </div>
          {slide.imageUrl ? (
            <div className="w-full max-w-[280px] aspect-square rounded-2xl overflow-hidden shadow-xl border border-white/10 bg-white/5 relative">
              <img src={slide.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
          ) : (
            <div className="w-full max-w-[240px] aspect-square rounded-2xl bg-white/5 backdrop-blur-sm flex items-center justify-center">
              <svg viewBox="0 0 200 200" className="w-4/5 h-4/5 text-white/40">
                <path d="M 30 150 Q 80 30 120 90 T 170 50" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
              </svg>
            </div>
          )}
        </div>

        {/* Phải: Nội dung chính – chữ to hơn */}
        <div className="flex-1 flex flex-col justify-center p-8 md:p-12 overflow-y-auto bg-white">
          {editingTitle === currentIndex ? (
            <div className="mb-6 space-y-2 print:hidden">
              <Textarea value={editingTitleValue} onChange={(e) => setEditingTitleValue(e.target.value)} className="text-2xl font-bold min-h-[80px]" placeholder={tr('Tiêu đề slide', 'Slide title', '幻灯片标题', 'スライドタイトル', '슬라이드 제목')} />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { setSlides((prev) => { const n = [...prev]; n[currentIndex] = { ...n[currentIndex], title: editingTitleValue }; return n }); setEditingTitle(null) }}>
                  {tr('Lưu', 'Save', '保存', '保存', '저장')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditingTitle(null)}>{tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}</Button>
              </div>
            </div>
          ) : (
            <div className="mb-6 flex items-start gap-2 flex-wrap">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 flex-1">
                {slide.title}
              </h2>
              <Button variant="outline" size="sm" onClick={() => setQuizPopupOpen(true)} className="shrink-0 border-violet-400 text-violet-700 hover:bg-violet-50 print:hidden">
                <ClipboardList className="h-4 w-4 mr-1.5" />
                {tr('Xem câu hỏi trắc nghiệm', 'View quiz', '查看测验', 'クイズを見る', '퀴즈 보기')}
              </Button>
              {curriculumId && slideMode === 'personal' && (
                <Button variant="ghost" size="sm" className="shrink-0 h-8 px-2 text-slate-500 hover:text-violet-600 print:hidden" onClick={() => { setEditingTitle(currentIndex); setEditingTitleValue(slide.title) }} title={tr('Sửa tiêu đề', 'Edit title', '编辑标题', 'タイトルを編集', '제목 편집')}>
                  <Edit3 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          {hasBlocks ? (
            <div className="space-y-4">
              {blocks.map((b, i) => {
                const blockProposals = proposals.filter((p) => p.slide_index === currentIndex && p.block_index === i)
                const showProposalUi = curriculumId && (slideMode === 'shared' || !slideMode)
                const showDirectEdit = curriculumId && slideMode === 'personal'
                const isEditing = editingBlock?.slideIndex === currentIndex && editingBlock?.blockIndex === i
                const isEditingHeader = editingHeader?.slideIndex === currentIndex && editingHeader?.blockIndex === i
                return (
                  <div key={i} className="flex rounded-lg overflow-hidden bg-white shadow-sm border border-slate-100">
                    <div className="w-24 min-w-[96px] bg-violet-100 flex flex-col items-center justify-center p-3">
                      <div className="text-violet-600">
                        {getIconForHeader(isEditingHeader ? editingHeaderValue : b.header)}
                      </div>
                      {isEditingHeader ? (
                        <div className="mt-2 w-full space-y-1 print:hidden">
                          <Input value={editingHeaderValue} onChange={(e) => setEditingHeaderValue(e.target.value)} className="h-7 text-xs text-center font-bold text-violet-700" placeholder={tr('Tiêu đề', 'Header', '标题', '見出し', '제목')} />
                          <div className="flex gap-0.5 justify-center">
                            <Button size="sm" className="h-5 px-1.5 text-[10px]" onClick={() => { setSlides((prev) => { const n = [...prev]; const blks = [...(n[currentIndex].blocks ?? parseContentToBlocks(n[currentIndex].content))]; if (blks[i]) blks[i] = { ...blks[i], header: editingHeaderValue }; n[currentIndex] = { ...n[currentIndex], blocks: blks }; return n }); setEditingHeader(null) }}>{tr('Lưu', 'Save', '保存', '保存', '저장')}</Button>
                            <Button variant="outline" size="sm" className="h-5 px-1.5 text-[10px]" onClick={() => setEditingHeader(null)}>{tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 w-full flex flex-col items-center gap-0.5">
                          <span className="text-xs font-bold text-violet-700 text-center leading-tight">
                            {b.header}
                          </span>
                          {showDirectEdit && (
                            <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px] text-violet-600 hover:text-violet-800 print:hidden" onClick={() => { setEditingHeader({ slideIndex: currentIndex, blockIndex: i }); setEditingHeaderValue(b.header) }}>
                              <Edit3 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 p-5 text-slate-800">
                      {isEditing ? (
                        <div className="space-y-2 print:hidden">
                          <Textarea
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="min-h-[120px] text-base"
                            placeholder={tr('Nội dung block...', 'Block content...', '块内容...', 'ブロック内容...', '블록 내용...')}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => {
                              setSlides((prev) => {
                                const next = [...prev]
                                const s = next[currentIndex]
                                const blks = [...(s.blocks ?? parseContentToBlocks(s.content))]
                                if (blks[i]) blks[i] = { ...blks[i], content: editingValue }
                                next[currentIndex] = { ...s, blocks: blks }
                                return next
                              })
                              setEditingBlock(null)
                            }}>
                              {tr('Lưu', 'Save', '保存', '保存', '저장')}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setEditingBlock(null)}>
                              {tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <BlockContentWithEmbeds content={b.content} onRemoveEmbed={slideMode === 'personal' ? handleRemoveEmbed : undefined} removeTitle={tr('Xóa biểu đồ này', 'Remove this graph', '删除此图表', 'このグラフを削除', '이 그래프 삭제')} liveQuizContext={curriculumId ? { curriculumId, slideIndex: currentIndex, blockIndex: i } : undefined} tr={tr} hideQuiz />
                          {showDirectEdit && (
                            <div className="mt-2 flex flex-wrap gap-1.5 print:hidden">
                              <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs text-violet-700 border-violet-300 hover:bg-violet-50" onClick={() => { setEditingBlock({ slideIndex: currentIndex, blockIndex: i }); setEditingValue(b.content) }}>
                                <Edit3 className="h-3 w-3" />
                                {tr('Sửa', 'Edit', '编辑', '編集', '편집')}
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                      {showProposalUi && (
                        <div className="mt-2 flex flex-wrap gap-1.5 print:hidden">
                          <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs text-amber-700 border-amber-300 hover:bg-amber-50" onClick={() => setProposalDialog({ open: true, slideIndex: currentIndex, blockIndex: i, type: 'edit', originalContent: b.content, blockHeader: b.header })}>
                            <Edit3 className="h-3 w-3" />
                            {tr('Đề xuất sửa', 'Propose edit', '建议编辑', '編集提案', '편집 제안')}
                          </Button>
                          <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50" onClick={() => setProposalDialog({ open: true, slideIndex: currentIndex, blockIndex: i, type: 'add', blockHeader: b.header })}>
                            <Plus className="h-3 w-3" />
                            {tr('Đề xuất bổ sung', 'Propose addition', '建议补充', '追加提案', '추가 제안')}
                          </Button>
                        </div>
                      )}
                      {blockProposals.map((p) => (
                        <SlideProposalVote key={p.id} proposal={p} currentUserId={currentUserId} tr={tr} onVoted={() => getSlideProposalsForCurriculum(curriculumId!).then((r) => { if (r?.success && r.items) { setProposals(r.items); setCurrentUserId(r.currentUserId ?? null) } })} onDeleted={() => getSlideProposalsForCurriculum(curriculumId!).then((r) => { if (r?.success && r.items) { setProposals(r.items); setCurrentUserId(r.currentUserId ?? null) } })} />
                      ))}
                    </div>
                  </div>
                )
              })}
              {curriculumId && slideMode === 'personal' && (
                <Button variant="outline" size="sm" className="w-full h-10 gap-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50 border-dashed print:hidden" onClick={() => setSlides((prev) => { const n = [...prev]; const s = n[currentIndex]; const blks = [...(s.blocks ?? parseContentToBlocks(s.content ?? ''))]; blks.push({ header: tr('Nội dung', 'Content', '内容', '内容', '내용'), content: '' }); n[currentIndex] = { ...s, blocks: blks, content: '' }; return n })}>
                  <Plus className="h-4 w-4" />
                  {tr('Thêm ý', 'Add point', '添加要点', '追加', '의견 추가')}
                </Button>
              )}
            </div>
          ) : slide.content ? (
            <div className="text-slate-700 text-base md:text-lg leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2">
              {(editingBlock?.slideIndex === currentIndex && editingBlock?.blockIndex === 0) ? (
                <div className="space-y-2 print:hidden">
                  <Textarea value={editingValue} onChange={(e) => setEditingValue(e.target.value)} className="min-h-[120px] text-base" placeholder={tr('Nội dung...', 'Content...', '内容...', '内容...', '내용...')} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => {
                      setSlides((prev) => { const n = [...prev]; n[currentIndex] = { ...n[currentIndex], content: editingValue }; return n })
                      setEditingBlock(null)
                    }}>{tr('Lưu', 'Save', '保存', '保存', '저장')}</Button>
                    <Button variant="outline" size="sm" onClick={() => setEditingBlock(null)}>{tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}</Button>
                  </div>
                </div>
              ) : (
                <>
                  <BlockContentWithEmbeds content={slide.content} onRemoveEmbed={slideMode === 'personal' ? handleRemoveEmbed : undefined} removeTitle={tr('Xóa biểu đồ này', 'Remove this graph', '删除此图表', 'このグラフを削除', '이 그래프 삭제')} liveQuizContext={curriculumId ? { curriculumId, slideIndex: currentIndex, blockIndex: 0 } : undefined} tr={tr} hideQuiz />
                  {curriculumId && slideMode === 'personal' && (
                    <div className="mt-2 flex flex-wrap gap-1.5 print:hidden">
                      <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs text-violet-700 border-violet-300 hover:bg-violet-50" onClick={() => { setEditingBlock({ slideIndex: currentIndex, blockIndex: 0 }); setEditingValue(slide.content) }}>
                        <Edit3 className="h-3 w-3" />
                        {tr('Sửa', 'Edit', '编辑', '編集', '편집')}
                      </Button>
                    </div>
                  )}
                </>
              )}
              {curriculumId && (slideMode === 'shared' || !slideMode) && (
                <div className="mt-2 flex flex-wrap gap-1.5 print:hidden">
                  <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs text-amber-700 border-amber-300 hover:bg-amber-50" onClick={() => setProposalDialog({ open: true, slideIndex: currentIndex, blockIndex: 0, type: 'edit', originalContent: slide.content })}>
                    <Edit3 className="h-3 w-3" />
                    {tr('Đề xuất sửa', 'Propose edit', '建议编辑', '編集提案', '편집 제안')}
                  </Button>
                  <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50" onClick={() => setProposalDialog({ open: true, slideIndex: currentIndex, blockIndex: 0, type: 'add' })}>
                    <Plus className="h-3 w-3" />
                    {tr('Đề xuất bổ sung', 'Propose addition', '建议补充', '追加提案', '추가 제안')}
                  </Button>
                </div>
              )}
              {proposals.filter((p) => p.slide_index === currentIndex && p.block_index === 0).map((p) => (
                <SlideProposalVote key={p.id} proposal={p} currentUserId={currentUserId} tr={tr} onVoted={() => curriculumId && getSlideProposalsForCurriculum(curriculumId).then((r) => { if (r?.success && r.items) { setProposals(r.items); setCurrentUserId(r.currentUserId ?? null) } })} onDeleted={() => curriculumId && getSlideProposalsForCurriculum(curriculumId).then((r) => { if (r?.success && r.items) { setProposals(r.items); setCurrentUserId(r.currentUserId ?? null) } })} />
              ))}
              {curriculumId && slideMode === 'personal' && (
                <Button variant="outline" size="sm" className="mt-4 w-full h-10 gap-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50 border-dashed print:hidden" onClick={() => setSlides((prev) => { const n = [...prev]; const s = n[currentIndex]; const blks = parseContentToBlocks(s.content ?? ''); blks.push({ header: tr('Nội dung', 'Content', '内容', '内容', '내용'), content: '' }); n[currentIndex] = { ...s, blocks: blks, content: '' }; return n })}>
                  <Plus className="h-4 w-4" />
                  {tr('Thêm ý', 'Add point', '添加要点', '追加', '의견 추가')}
                </Button>
              )}
            </div>
          ) : null}
        </div>
        </div>
      </div>

      {/* Print: tất cả slide - layout giống màn hình */}
      <div className="hidden print:block">
        {slides.map((s, i) => {
          const slideBlocks = s.blocks ?? parseContentToBlocks(s.content)
          const slideGrad = DARK_GRADIENTS[i % DARK_GRADIENTS.length]
          return (
            <div
              key={i}
              className="min-h-[100vh] flex"
              style={{ pageBreakAfter: i < slides.length - 1 ? 'always' : 'auto' }}
            >
              <div className="w-[45%] flex items-center justify-center relative p-8" style={{ background: slideGrad }}>
                <div className="absolute top-6 left-6 w-9 h-9 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-sm">
                  {i + 1}
                </div>
                {s.imageUrl ? (
                  <div className="w-48 h-48 rounded-2xl overflow-hidden border border-white/10">
                    <img src={s.imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-48 h-48 rounded-2xl bg-white/5 flex items-center justify-center">
                    <div className="w-3/4 h-3/4 border-2 border-white/30 rounded-full" />
                  </div>
                )}
              </div>
              <div className="flex-1 bg-white p-10 flex flex-col justify-center">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">{s.title}</h2>
                {slideBlocks.length > 0 ? (
                  <div className="space-y-3">
                    {slideBlocks.map((b, j) => (
                      <div key={j} className="flex rounded-lg overflow-hidden border border-slate-200">
                        <div className="w-24 min-w-[96px] bg-violet-100 flex flex-col items-center justify-center p-2">
                          <span className="text-xs font-bold text-violet-700 text-center leading-tight">{b.header}</span>
                        </div>
                        <div className="flex-1 p-4 text-base text-slate-800">
                          <div className="[&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-1 [&_ul]:text-base">
                            <BlockContentWithEmbeds content={b.content} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : s.content ? (
                  <div className="text-slate-700 text-base [&_ul]:list-disc [&_ul]:pl-5">
                    <BlockContentWithEmbeds content={s.content} />
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
