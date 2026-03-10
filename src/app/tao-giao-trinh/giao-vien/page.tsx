'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Timer, Play, Pause, RotateCcw, ChevronLeft, ChevronRight, LayoutGrid, Square, Sparkles, Edit3, Plus, Save, FileText, FileEdit, History, BarChart2, Maximize2, X, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'
import { canSplitBlockAtQuiz, splitContentWithEmbeds, parseQuizData, parseContentEmbeds, ContentEmbed } from '../components/content-embed'
import { parseContentToBlocks } from '../lib/curriculum-to-slides'
import { SlideProposalDialog } from '../components/slide-proposal-dialog'
import { SlideProposalVote } from '../components/slide-proposal-vote'
import { PersonalHistorySheet } from '../components/personal-history-sheet'
import { SlideEditHistorySheet } from '../components/slide-edit-history-sheet'
import { EmbedInsertDialog } from '../components/embed-insert-dialog'
import { QuizPopupDialog, extractQuizFromSlide } from '../components/quiz-popup-dialog'
import { getSlideProposalsForCurriculum, resetPersonalToOriginal } from '../actions'

type VisualCell = { visualEmbed?: string; imageUrl?: string }
type SlideItem = {
  title: string
  blocks?: Array<{ header?: string; content?: string }>
  teacherNotes?: string
  content?: string
  imageUrl?: string
  visualEmbed?: string
  visualLayout?: 1 | 2 | 4
  visualCells?: VisualCell[]
}

function getVisualCells(slide: SlideItem): { layout: 1 | 2 | 4; cells: VisualCell[] } {
  const layout = slide.visualLayout ?? 1
  const numCells = layout === 1 ? 1 : layout === 2 ? 2 : 4
  if (slide.visualCells && slide.visualCells.length >= numCells) {
    return { layout, cells: slide.visualCells.slice(0, numCells) }
  }
  if (slide.visualEmbed || slide.imageUrl) {
    const cell: VisualCell = slide.visualEmbed ? { visualEmbed: slide.visualEmbed } : { imageUrl: slide.imageUrl! }
    return { layout: 1, cells: [cell] }
  }
  return { layout, cells: Array.from({ length: numCells }, () => ({})) }
}

type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'
function getWebLocaleFromCookie(): UiLocale {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = document.cookie
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('nanoai_locale='))
    ?.split('=')[1]
    ?.trim()
    .toLowerCase()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

function getQuizCount(blocks: SlideItem['blocks']): number {
  return (blocks ?? []).reduce((acc, b) => acc + (b.content?.match(/\[quiz:/g)?.length ?? 0), 0)
}

/** Tách giáo trình thành các section theo ## hoặc ### */
function splitCurriculumSections(content: string): string[] {
  const parts = content.split(/\n(?=#{2,3}\s)/)
  return parts.filter((s) => s.trim())
}

/** Chuẩn hóa text để so khớp (bỏ markdown, khoảng trắng thừa) */
function normalizeForMatch(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/\[[^\]]+\]/g, '')
    .trim()
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Tìm các đoạn khớp trong section – trả về [start, end) trong text gốc, dùng regex linh hoạt khoảng trắng */
function getMatchRangesInSection(section: string, slideTexts: string[]): Array<[number, number]> {
  const ranges: Array<[number, number]> = []

  for (const blockText of slideTexts) {
    const norm = normalizeForMatch(blockText)
    if (norm.length < 10) continue
    for (const len of [80, 50, 30, 20]) {
      const chunk = norm.slice(0, len)
      if (chunk.length < 12) break
      const words = chunk.split(/\s+/).filter(Boolean)
      if (words.length < 3) continue
      try {
        const pattern = words.map(escapeRegex).join('\\s+')
        const re = new RegExp(pattern, 'i')
        const m = section.match(re)
        if (m && m.index != null) {
          ranges.push([m.index, m.index + m[0].length])
          break
        }
      } catch {
        /* ignore invalid regex */
      }
    }
  }

  if (ranges.length === 0) return []
  ranges.sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = [ranges[0]]
  for (let i = 1; i < ranges.length; i++) {
    const [a, b] = merged[merged.length - 1]
    const [c, d] = ranges[i]
    if (c <= b + 5) merged[merged.length - 1] = [a, Math.max(b, d)]
    else merged.push([c, d])
  }
  return merged
}

/** Tìm index section tương ứng slide – chỉ khớp khi có ký tự trùng trong nội dung */
function getSectionIndexForSlide(sections: string[], slides: SlideItem[], currentIndex: number): number {
  const slide = slides[currentIndex]
  if (!slide) return Math.min(currentIndex, Math.max(0, sections.length - 1))

  const blocks = slide.blocks ?? (slide.content ? parseContentToBlocks(slide.content) : [])
  const slideTexts = blocks.length > 0
    ? blocks.map((b) => (b?.content ?? '').trim()).filter(Boolean)
    : slide.content
      ? [slide.content.trim()]
      : []

  if (slideTexts.length === 0) {
    const title = slide.title?.trim()
    if (title) {
      for (let i = 0; i < sections.length; i++) {
        const sectionNorm = normalizeForMatch(sections[i])
        const titleNorm = normalizeForMatch(title)
        if (sectionNorm.includes(titleNorm) || titleNorm.includes(sectionNorm)) return i
      }
    }
    return Math.min(currentIndex, Math.max(0, sections.length - 1))
  }

  let bestIndex = -1
  let bestScore = 0

  for (let i = 0; i < sections.length; i++) {
    const sectionNorm = normalizeForMatch(sections[i])
    if (!sectionNorm) continue

    let score = 0
    for (const blockText of slideTexts) {
      const norm = normalizeForMatch(blockText)
      if (norm.length < 5) continue
      let chunkMatched = false
      for (const len of [100, 60, 40, 20]) {
        const chunk = norm.slice(0, len)
        if (chunk.length >= 15 && sectionNorm.includes(chunk)) {
          score += len * 2
          chunkMatched = true
          break
        }
      }
      if (!chunkMatched) {
        const words = norm.split(/\s+/).filter((w) => w.length > 2)
        const matchCount = words.filter((w) => sectionNorm.includes(w)).length
        if (matchCount >= 3) score += matchCount
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestIndex = i
    }
  }

  if (bestIndex >= 0 && bestScore > 0) return bestIndex
  return Math.min(currentIndex, Math.max(0, sections.length - 1))
}

export default function CurriculumViewPage() {
  const [content, setContent] = useState('')
  const [topic, setTopic] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [slideTitles, setSlideTitles] = useState<string[]>([])
  const [slides, setSlides] = useState<SlideItem[]>([])
  const [teacherTimerSeconds, setTeacherTimerSeconds] = useState(0)
  const [teacherTimerRunning, setTeacherTimerRunning] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [slideViewMode, setSlideViewMode] = useState<'single' | 'triple'>('single')
  const [splitAtBlock, setSplitAtBlock] = useState<number | null>(null)
  const [curriculumId, setCurriculumId] = useState<string | null>(null)
  const [quizGenLoading, setQuizGenLoading] = useState<number | null>(null)
  const [proposals, setProposals] = useState<Array<{ id: string; slide_index: number; block_index: number; segment_type?: string; proposed_text: string; proposed_header?: string | null; original_text?: string | null; status: string; agree_count: number; disagree_count: number; proposed_by?: string | null; myVote?: 'agree' | 'disagree' }>>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [proposalDialog, setProposalDialog] = useState<{ open: boolean; slideIndex: number; blockIndex: number; type: 'edit' | 'add'; originalContent?: string; blockHeader?: string } | null>(null)
  const [slideMode, setSlideMode] = useState<'original' | 'shared' | 'personal' | null>(null)
  const [personalViewSubMode, setPersonalViewSubMode] = useState<'current' | 'original'>('current')
  const [hasOriginalSlides, setHasOriginalSlides] = useState(false)
  const [editingBlock, setEditingBlock] = useState<{ slideIndex: number; blockIndex: number } | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [editingHeader, setEditingHeader] = useState<{ slideIndex: number; blockIndex: number } | null>(null)
  const [editingHeaderValue, setEditingHeaderValue] = useState('')
  const [editingTitle, setEditingTitle] = useState<number | null>(null)
  const [editingTitleValue, setEditingTitleValue] = useState('')
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [resetLoading, setResetLoading] = useState(false)
  const [personalHistoryOpen, setPersonalHistoryOpen] = useState(false)
  const [sharedHistoryOpen, setSharedHistoryOpen] = useState(false)
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false)
  const [leftPanelMode, setLeftPanelMode] = useState<'curriculum' | 'slide' | 'visual'>('curriculum')
  const [visualFullscreenOpen, setVisualFullscreenOpen] = useState(false)
  const [quizPopupOpen, setQuizPopupOpen] = useState(false)
  const prevSlideModeRef = useRef<string | null>(null)
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([])
  const firstMatchRef = useRef<HTMLElement | null>(null)

  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const requestCurriculum = useCallback(() => {
    if (window.opener) window.opener.postMessage({ type: 'request-curriculum' }, window.location.origin)
  }, [])

  const sendTeacherTimer = useCallback((action: 'teacher-timer-start' | 'teacher-timer-stop' | 'teacher-timer-reset') => {
    if (window.opener) window.opener.postMessage({ type: action }, window.location.origin)
  }, [])

  const sendSlideControl = useCallback((action: 'slide-prev' | 'slide-next') => {
    if (window.opener) window.opener.postMessage({ type: action }, window.location.origin)
  }, [])

  const sendNotesToParent = useCallback((value: string) => {
    if (window.opener) window.opener.postMessage({ type: 'update-notes', slideIndex: currentIndex, teacherNotes: value }, window.location.origin)
  }, [currentIndex])

  const sendMergeSlides = useCallback((index: number) => {
    if (window.opener) window.opener.postMessage({ type: 'merge-slides', index }, window.location.origin)
  }, [])

  const sendSplitSlide = useCallback((index: number, splitAtBlock: number) => {
    if (window.opener) window.opener.postMessage({ type: 'split-slide', index, splitAtBlock }, window.location.origin)
    setSplitAtBlock(null)
  }, [])

  /** splitAtBlock: -1 = tách tại ranh giới quiz (khi 1 block có quiz + nội dung sau) */
  const sendSplitAtQuiz = useCallback((index: number) => {
    if (window.opener) window.opener.postMessage({ type: 'split-slide', index, splitAtBlock: -1 }, window.location.origin)
    setSplitAtBlock(null)
  }, [])

  const handleGenerateQuiz = useCallback(async (slideIndex: number) => {
    const s = slides[slideIndex]
    if (!s) return
    setQuizGenLoading(slideIndex)
    try {
      const blocks = s.blocks ?? parseContentToBlocks((s as { content?: string }).content ?? '')
      const existingCount = getQuizCount(blocks)
      if (existingCount >= 1) return
      const body = {
        title: s.title,
        content: blocks.map((b) => b?.content ?? '').join('\n\n'),
        blocks: blocks.map((b) => ({ header: b?.header, content: b?.content ?? '' })),
      }
      const res = await fetch('/api/slide-generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.markers?.length) return
      const markers = (data.markers as string[]).slice(0, 1)
      if (markers.length === 0) return
      const markerText = markers.join('\n\n')
      const newBlocks = blocks.length > 0 ? blocks.map((b) => ({ ...b })) : [{ header: 'Trắc nghiệm', content: '' }]
      const last = newBlocks[newBlocks.length - 1]
      newBlocks[newBlocks.length - 1] = { ...last, content: last.content ? last.content + '\n\n' + markerText : markerText }
      if (window.opener) {
        window.opener.postMessage({ type: 'update-slide-blocks', slideIndex, blocks: newBlocks }, window.location.origin)
      }
      setSlides((prev) => prev.map((sl, i) => (i === slideIndex ? { ...sl, blocks: newBlocks } : sl)))
    } finally {
      setQuizGenLoading(null)
    }
  }, [slides])

  useEffect(() => {
    const syncLocale = () => setUiLocale(getWebLocaleFromCookie())
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    requestCurriculum()
    const t1 = setTimeout(requestCurriculum, 500)
    const t2 = setTimeout(requestCurriculum, 1500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [requestCurriculum])

  useEffect(() => {
    if (!curriculumId) return
    getSlideProposalsForCurriculum(curriculumId).then((res) => {
      if (res?.success && res.items) {
        setProposals(res.items)
        setCurrentUserId(res.currentUserId ?? null)
      } else {
        setProposals([])
      }
    })
  }, [curriculumId])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'curriculum-data') {
        setContent(e.data.content ?? '')
        setTopic(e.data.topic ?? '')
        setCurrentIndex(e.data.currentIndex ?? 0)
        setCurriculumId(typeof e.data.curriculumId === 'string' ? e.data.curriculumId : null)
        const mode = e.data.slideMode === 'personal' || e.data.slideMode === 'shared' || e.data.slideMode === 'original' ? e.data.slideMode : null
        setSlideMode(mode)
        if ((mode === 'personal' || mode === 'shared') && prevSlideModeRef.current !== mode) setSlideViewMode('single')
        prevSlideModeRef.current = mode
        setPersonalViewSubMode(e.data.personalViewSubMode === 'original' || e.data.personalViewSubMode === 'current' ? e.data.personalViewSubMode : 'current')
        setHasOriginalSlides(Boolean(e.data.hasOriginalSlides))
        const sl = Array.isArray(e.data.slides) ? e.data.slides : []
        setSlideTitles(sl.map((s: SlideItem) => s?.title ?? ''))
        setSlides(sl)
        setTeacherTimerSeconds(typeof e.data.teacherTimerSeconds === 'number' ? e.data.teacherTimerSeconds : 0)
        setTeacherTimerRunning(Boolean(e.data.teacherTimerRunning))
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  useEffect(() => {
    setNotesValue(slides[currentIndex]?.teacherNotes ?? '')
    setSplitAtBlock(null)
  }, [currentIndex, slides])

  const handleBlur = useCallback(() => {
    sendNotesToParent(notesValue)
  }, [notesValue, sendNotesToParent])

  const refreshProposals = useCallback(() => {
    if (!curriculumId) return
    getSlideProposalsForCurriculum(curriculumId).then((res) => {
      if (res?.success && res.items) {
        setProposals(res.items)
        setCurrentUserId(res.currentUserId ?? null)
      }
    })
  }, [curriculumId])

  const sendUpdateSlideBlocks = useCallback((slideIndex: number, blocks: Array<{ header?: string; content?: string }>) => {
    if (window.opener) window.opener.postMessage({ type: 'update-slide-blocks', slideIndex, blocks }, window.location.origin)
  }, [])

  const sendUpdateSlideTitle = useCallback((slideIndex: number, title: string) => {
    if (window.opener) window.opener.postMessage({ type: 'update-slide-title', slideIndex, title }, window.location.origin)
  }, [])

  const sendPersonalViewSubMode = useCallback((value: 'current' | 'original') => {
    if (window.opener) window.opener.postMessage({ type: 'set-personal-view-submode', value }, window.location.origin)
    setPersonalViewSubMode(value)
  }, [])

  const sendSaveNow = useCallback(() => {
    if (window.opener) window.opener.postMessage({ type: 'save-slides-now' }, window.location.origin)
  }, [])

  const sendRefreshPersonalAfterReset = useCallback(() => {
    if (window.opener) window.opener.postMessage({ type: 'refresh-personal-after-reset' }, window.location.origin)
  }, [])

  const handleResetToOriginal = useCallback(async () => {
    if (!curriculumId) return
    setResetLoading(true)
    try {
      const res = await resetPersonalToOriginal(curriculumId)
      if (res?.success) {
        sendRefreshPersonalAfterReset()
        setPersonalViewSubMode('current')
        sendPersonalViewSubMode('current')
        setSlides((prev) => prev)
      } else {
        alert(res?.error ?? tr('Reset thất bại', 'Reset failed', '重置失败', 'リセット失敗', '리셋 실패'))
      }
    } finally {
      setResetLoading(false)
    }
  }, [curriculumId, sendRefreshPersonalAfterReset, sendPersonalViewSubMode, tr])

  useEffect(() => {
    setEditingBlock(null)
    setEditingHeader(null)
    setEditingTitle(null)
  }, [currentIndex])

  const sections = content ? splitCurriculumSections(content) : []
  const highlightIndex = getSectionIndexForSlide(sections, slides, currentIndex)

  const slide = slides[currentIndex]
  const slideTextsForMatch = (() => {
    if (!slide) return []
    const blocks = slide.blocks ?? (slide.content ? parseContentToBlocks(slide.content) : [])
    const fromBlocks = blocks.map((b) => (b?.content ?? '').trim()).filter(Boolean)
    if (fromBlocks.length > 0) return fromBlocks
    return slide.content ? [slide.content.trim()] : []
  })()

  useEffect(() => {
    if (sections.length === 0 || leftPanelMode !== 'curriculum') return
    const el = firstMatchRef.current ?? sectionRefs.current[highlightIndex]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [currentIndex, content, sections.length, highlightIndex, leftPanelMode])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    if (!visualFullscreenOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setVisualFullscreenOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visualFullscreenOpen])

  return (
    <div className="fixed inset-0 z-50 h-screen w-screen overflow-hidden bg-slate-950 text-white flex flex-col">
      <header className="shrink-0 px-5 py-3 border-b border-slate-700/80 bg-slate-900/80 backdrop-blur-sm flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-amber-400/95 tracking-tight">{tr('Giáo trình + Ghi chú', 'Curriculum + Notes', '课程+备注', 'カリキュラム+メモ', '교육과정+메모')}</h1>
          {(slideMode || slideMode === null) && slides.length > 0 && (
            <span className={['text-xs font-medium px-2.5 py-1 rounded-md', slideMode === 'personal' ? 'bg-violet-500/25 text-violet-200 border border-violet-400/40' : 'bg-amber-500/25 text-amber-200 border border-amber-400/40'].join(' ')}>
              {slideMode === 'personal' ? tr('Bản riêng', 'Personal', '个人版', '個人版', '개인') : tr('Bản chung', 'Shared', '共享版', '共有版', '공유')}
            </span>
          )}
          {!curriculumId && slides.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded bg-slate-600/40 text-amber-200/90" title={tr('Lưu giáo trình vào kho để sửa và đề xuất', 'Save curriculum to edit and propose', '保存课程以编辑和建议', '保存して編集・提案', '저장 후 편집·제안')}>
              {tr('Lưu giáo trình vào kho', 'Save to library', '保存到库', '保存して利用', '저장 후 사용')}
            </span>
          )}
          {slideMode === 'personal' && (
            <div className="flex items-center gap-2">
              {hasOriginalSlides && (
                <div className="flex rounded-lg border border-slate-600/60 overflow-hidden bg-slate-800/40">
                  <button
                    type="button"
                    onClick={() => sendPersonalViewSubMode('current')}
                    className={['px-2.5 py-1.5 text-xs font-medium transition-colors flex items-center gap-1', personalViewSubMode === 'current' ? 'bg-violet-500/30 text-violet-200 border-r border-slate-600/60' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'].join(' ')}
                    title={tr('Bản bạn đang chỉnh sửa', 'Your edited version', '您编辑的版本', '編集中の版', '편집 중인 버전')}
                  >
                    <FileEdit className="h-3.5 w-3.5" />
                    {tr('Bản hiện tại', 'Current', '当前', '現在', '현재')}
                  </button>
                  <button
                    type="button"
                    onClick={() => sendPersonalViewSubMode('original')}
                    className={['px-2.5 py-1.5 text-xs font-medium transition-colors flex items-center gap-1', personalViewSubMode === 'original' ? 'bg-slate-600/50 text-slate-200' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'].join(' ')}
                    title={tr('Bản gốc AI tạo', 'Original AI version', 'AI原始版本', 'AIオリジナル', 'AI 원본')}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {tr('Bản gốc', 'Original', '原版', 'オリジナル', '원본')}
                  </button>
                </div>
              )}
              {curriculumId && personalViewSubMode === 'current' && (
                <button
                  type="button"
                  onClick={sendSaveNow}
                  className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-emerald-500/25 text-emerald-200 border border-emerald-400/40 hover:bg-emerald-500/35 flex items-center gap-1.5 transition-colors"
                  title={tr('Lưu bản riêng', 'Save personal version', '保存个人版本', '個人版を保存', '개인 버전 저장')}
                >
                  <Save className="h-3.5 w-3.5" />
                  {tr('Lưu', 'Save', '保存', '保存', '저장')}
                </button>
              )}
              {curriculumId && personalViewSubMode === 'original' && (
                <button
                  type="button"
                  onClick={() => void handleResetToOriginal()}
                  disabled={resetLoading}
                  className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-amber-500/25 text-amber-200 border border-amber-400/40 hover:bg-amber-500/35 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  title={tr('Reset bản riêng về bản gốc. Bản hiện tại lưu vào lịch sử, khôi phục trong 5 ngày.', 'Reset personal to original. Current version saved to history, restorable within 5 days.', '将个人版重置为原版。当前版本保存到历史，5天内可恢复。', '個人版を原版にリセット。現在の版は履歴に保存、5日以内に復元可能。', '개인 버전을 원본으로 리셋. 현재 버전은 기록에 저장, 5일 이내 복원 가능.')}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {resetLoading ? tr('Đang reset...', 'Resetting...', '重置中...', 'リセット中...', '리셋 중...') : tr('Reset về bản gốc', 'Reset to original', '重置为原版', '原版にリセット', '원본으로 리셋')}
                </button>
              )}
              {curriculumId && slideMode === 'personal' && (
                <button
                  type="button"
                  onClick={() => setPersonalHistoryOpen(true)}
                  className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-600/40 text-slate-200 border border-slate-500/50 hover:bg-slate-600/60 flex items-center gap-1.5 transition-colors"
                  title={tr('Lịch sử bản riêng – khôi phục trong 5 ngày', 'Personal history – restore within 5 days', '个人历史–5天内恢复', '個人履歴–5日以内に復元', '개인 기록–5일 이내 복원')}
                >
                  <History className="h-3.5 w-3.5" />
                  {tr('Lịch sử', 'History', '历史', '履歴', '기록')}
                </button>
              )}
            </div>
          )}
          {slideMode === 'shared' && curriculumId && (
            <button
              type="button"
              onClick={() => setSharedHistoryOpen(true)}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-600/40 text-slate-200 border border-slate-500/50 hover:bg-slate-600/60 flex items-center gap-1.5 transition-colors"
              title={tr('Lịch sử chỉnh sửa bản chung', 'Shared version edit history', '共享版本编辑历史', '共有版の編集履歴', '공유 버전 편집 기록')}
            >
              <History className="h-3.5 w-3.5" />
              {tr('Lịch sử', 'History', '历史', '履歴', '기록')}
            </button>
          )}
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {topic && <span className="text-slate-400 text-sm truncate max-w-[180px]" title={topic}>{topic}</span>}
          {slideTitles.length > 0 && (
            <span className="text-slate-300 text-sm font-medium tabular-nums">
              {currentIndex + 1} / {slideTitles.length}
            </span>
          )}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/30" title={tr('Bấm giờ giảng dạy', 'Teaching timer', '教学计时', '授業タイマー', '수업 타이머')}>
            <Timer className="h-4 w-4 text-emerald-400/90 shrink-0" />
            <span className="font-mono font-semibold text-emerald-300 min-w-[2.5rem]">{formatTimer(teacherTimerSeconds)}</span>
            <button type="button" onClick={() => sendTeacherTimer(teacherTimerRunning ? 'teacher-timer-stop' : 'teacher-timer-start')} className="p-1 rounded-md hover:bg-emerald-500/25 text-emerald-300 transition-colors" title={teacherTimerRunning ? tr('Tạm dừng', 'Pause', '暂停', '一時停止', '일시정지') : tr('Bắt đầu', 'Start', '开始', '開始', '시작')}>{teacherTimerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}</button>
            <button type="button" onClick={() => sendTeacherTimer('teacher-timer-reset')} className="p-1 rounded-md hover:bg-emerald-500/25 text-emerald-300 transition-colors" title={tr('Đặt lại', 'Reset', '重置', 'リセット', '초기화')}><RotateCcw className="h-3.5 w-3.5" /></button>
          </div>
          <div className="flex items-center gap-1">
            <div className="flex rounded-lg border border-slate-600/80 overflow-hidden bg-slate-800/50">
              <button type="button" onClick={() => setSlideViewMode('single')} className={['px-2.5 py-1.5 text-xs font-medium transition-colors', slideViewMode === 'single' ? 'bg-amber-500/30 text-amber-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'].join(' ')} title="1 slide"><Square className="h-3.5 w-3.5 inline mr-1" />1</button>
              <button type="button" onClick={() => setSlideViewMode('triple')} className={['px-2.5 py-1.5 text-xs font-medium transition-colors', slideViewMode === 'triple' ? 'bg-amber-500/30 text-amber-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'].join(' ')} title="3 slide"><LayoutGrid className="h-3.5 w-3.5 inline mr-1" />3</button>
            </div>
            <button type="button" onClick={() => sendSlideControl('slide-prev')} disabled={currentIndex === 0} className="p-2 rounded-lg bg-slate-700/80 hover:bg-slate-600 disabled:opacity-35 disabled:cursor-not-allowed transition-colors" title={tr('Slide trước', 'Prev slide', '上一张', '前へ', '이전')}><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" onClick={() => sendSlideControl('slide-next')} disabled={currentIndex >= slides.length - 1} className="p-2 rounded-lg bg-slate-700/80 hover:bg-slate-600 disabled:opacity-35 disabled:cursor-not-allowed transition-colors" title={tr('Slide sau', 'Next slide', '下一张', '次へ', '다음')}><ChevronRight className="h-5 w-5" /></button>
          </div>
        </div>
      </header>

      {!content ? (
        <div className="flex-1 flex items-center justify-center p-8 bg-slate-900/30">
          <div className="text-center space-y-6 max-w-sm">
            <p className="text-slate-400 text-sm leading-relaxed">{tr('Đang chờ dữ liệu từ cửa sổ trình chiếu. Mở slide và bấm "Giáo trình + Ghi chú".', 'Waiting for data from slide window. Open slides and click "Curriculum + Notes".', '等待幻灯片窗口数据。打开幻灯片并点击"课程+备注"。', 'スライドウィンドウのデータを待機中。スライドを開き「カリキュラム+メモ」をクリック。', '슬라이드 창 데이터 대기 중. 슬라이드를 열고 "교육과정+메모" 클릭.')}</p>
            <button type="button" onClick={requestCurriculum} className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium text-sm transition-colors shadow-lg shadow-amber-500/20">
              {tr('Tải giáo trình', 'Load curriculum', '加载课程', 'カリキュラムを読み込む', '교육과정 로드')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0 overflow-hidden isolate">
          {/* Trái: Giáo trình hoặc Slide hiện tại */}
          <div className="w-1/2 min-w-0 border-r border-slate-700/60 flex flex-col overflow-hidden isolate bg-slate-900/20">
            <div className="px-4 py-2.5 text-slate-400 text-xs font-medium uppercase tracking-wider border-b border-slate-700/60 shrink-0 flex items-center justify-between gap-2 flex-wrap">
              <span>{leftPanelMode === 'curriculum' ? tr('Giáo trình', 'Curriculum', '课程', 'カリキュラム', '교육과정') : leftPanelMode === 'visual' ? tr('Visual (như học sinh)', 'Visual (as student)', '视觉（学生视图）', 'ビジュアル（生徒表示）', '비주얼 (학생 화면)') : tr('Slide hiện tại', 'Current slide', '当前幻灯片', '表示中のスライド', '표시 중 슬라이드')}</span>
              <div className="flex items-center gap-2">
                {(leftPanelMode === 'visual' || leftPanelMode === 'slide') && extractQuizFromSlide(slides[currentIndex] ?? {}).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setQuizPopupOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/20 border border-violet-400/40 text-violet-300 hover:bg-violet-500/30 text-[11px] font-medium transition-colors"
                    title={tr('Mở quiz: thời gian, đồng hồ cát, thống kê', 'Open quiz: duration, timer, stats', '打开测验：时间、沙漏、统计', 'クイズを開く：時間・砂時計・統計', '퀴즈 열기: 시간·모래시계·통계')}
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    {tr('Mở quiz', 'Open quiz', '打开测验', 'クイズを開く', '퀴즈 열기')}
                  </button>
                )}
                <div className="flex rounded-lg border border-slate-600/80 overflow-hidden bg-slate-800/50">
                <button type="button" onClick={() => setLeftPanelMode('curriculum')} className={['px-2.5 py-1 text-[11px] font-medium transition-colors', leftPanelMode === 'curriculum' ? 'bg-amber-500/30 text-amber-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'].join(' ')}>
                  {tr('Giáo trình', 'Curriculum', '课程', 'カリキュラム', '교육과정')}
                </button>
                <button type="button" onClick={() => setLeftPanelMode('slide')} className={['px-2.5 py-1 text-[11px] font-medium transition-colors', leftPanelMode === 'slide' ? 'bg-amber-500/30 text-amber-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'].join(' ')}>
                  {tr('Slide', 'Slide', '幻灯片', 'スライド', '슬라이드')}
                </button>
                <button type="button" onClick={() => setLeftPanelMode('visual')} className={['px-2.5 py-1 text-[11px] font-medium transition-colors', leftPanelMode === 'visual' ? 'bg-amber-500/30 text-amber-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'].join(' ')}>
                  {tr('Visual', 'Visual', '视觉', 'ビジュアル', '비주얼')}
                </button>
              </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-scroll overflow-x-hidden overscroll-y-contain p-4 space-y-3 pr-2 scroll-smooth min-h-0 text-left">
              {leftPanelMode === 'visual' ? (
                (() => {
                  const s = slides[currentIndex]
                  if (!s) return <p className="text-slate-500 text-sm">{tr('Không có slide', 'No slide', '无幻灯片', 'スライドなし', '슬라이드 없음')}</p>
                  const { layout, cells } = getVisualCells(s)
                  const hasAny = cells.some((c) => c.visualEmbed || c.imageUrl)
                  const gridClass = layout === 2 ? 'grid grid-rows-2 gap-2' : layout === 4 ? 'grid grid-cols-2 grid-rows-2 gap-2' : ''
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-amber-300 font-medium text-sm">{currentIndex + 1}/{slides.length} {s.title}</span>
                        {hasAny && (
                          <button
                            type="button"
                            onClick={() => setVisualFullscreenOpen(true)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 hover:bg-amber-500/30 text-xs font-medium transition-colors"
                            title={tr('Mở rộng full màn hình', 'Expand fullscreen', '全屏展开', '全画面表示', '전체 화면')}
                          >
                            <Maximize2 className="h-3.5 w-3.5" />
                            {tr('Mở rộng', 'Expand', '展开', '展開', '확장')}
                          </button>
                        )}
                      </div>
                      <div className={cn('rounded-xl bg-slate-800/60 border border-slate-600/60 overflow-hidden', layout === 1 ? 'flex flex-col' : gridClass)} style={layout === 1 ? { minHeight: 200 } : {}}>
                        {cells.map((cell, idx) => (
                          <div key={idx} className="relative rounded-lg overflow-hidden bg-black/30 border border-slate-600/60 min-h-[160px]">
                            {cell.visualEmbed ? (
                              (() => {
                                const embeds = parseContentEmbeds(cell.visualEmbed)
                                const first = embeds[0]
                                if (!first) return <div className="w-full h-full min-h-[160px]" />
                                return <div className="w-full h-full min-h-[160px]"><ContentEmbed type={first.type} urlOrId={first.urlOrId} width={320} height={200} tr={tr} hideQuiz className="!my-0 !rounded-lg !border-0" /></div>
                              })()
                            ) : cell.imageUrl ? (
                              <img src={cell.imageUrl} alt="" className="w-full h-full min-h-[160px] object-contain" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full min-h-[160px] flex items-center justify-center text-slate-500 text-sm">{tr('Không có ảnh', 'No image', '无图片', '画像なし', '이미지 없음')}</div>
                            )}
                          </div>
                        ))}
                      </div>
                      {!hasAny && <p className="text-slate-500 text-sm">{tr('Slide này chưa có ảnh/visual', 'This slide has no image/visual', '此幻灯片无图片', 'このスライドに画像なし', '이 슬라이드에 이미지 없음')}</p>}
                    </div>
                  )
                })()
              ) : leftPanelMode === 'slide' ? (
                (() => {
                  const s = slides[currentIndex]
                  const blks = !s ? [] : (s.blocks?.length ? s.blocks : s.content ? parseContentToBlocks(s.content ?? '') : [])
                  return (
                    <div className="space-y-3">
                      <div className="rounded-xl bg-amber-500/10 ring-2 ring-amber-400/40 border border-amber-400/30 p-3">
                        <div className="text-amber-300 font-medium text-sm mb-2">{currentIndex + 1}/{slides.length} {s?.title ?? ''}</div>
                        {blks.length > 0 ? (
                          <div className="space-y-2">
                            {blks.map((b, i) => {
                              const parts = splitContentWithEmbeds(b.content ?? '')
                              return (
                                <div key={i} className="rounded-lg bg-slate-800/60 p-2.5 border border-slate-600/60">
                                  {b.header && <div className="text-amber-300/95 font-medium text-xs mb-1">{b.header}</div>}
                                  <div className="text-slate-200/95 text-sm whitespace-pre-wrap break-words leading-relaxed min-w-0 text-left space-y-2">
                                    {parts.map((p, j) => {
                                      if (p.type === 'text') return p.value ? <span key={j}>{p.value}</span> : null
                                      if (p.type === 'embed' && p.embedType === 'quiz') {
                                        const q = parseQuizData(p.urlOrId)
                                        if (!q) return null
                                        return (
                                          <div key={j} className="rounded-lg bg-violet-500/15 border border-violet-400/30 p-2.5 mt-1.5">
                                            <div className="text-violet-200 font-medium text-xs mb-1.5">{tr('Câu hỏi trắc nghiệm', 'Quiz question', '测验题', 'クイズ', '퀴즈')}</div>
                                            <p className="text-slate-200/95 text-sm mb-2">{q.question}</p>
                                            <div className="space-y-1">
                                              {q.options.map((opt, k) => (
                                                <div key={k} className={['text-xs pl-2 border-l-2', k === q.correctIndex ? 'border-emerald-400 text-emerald-300' : 'border-slate-600 text-slate-300'].join(' ')}>
                                                  {String.fromCharCode(65 + k)}. {opt}
                                                  {k === q.correctIndex && <span className="ml-1.5 text-emerald-400/80 text-[10px]">({tr('Đáp án đúng', 'Correct', '正确', '正解', '정답')})</span>}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )
                                      }
                                      if (p.type === 'embed') {
                                        return (
                                          <div key={j} className="mt-2 rounded-lg overflow-hidden border border-slate-600/60">
                                            <ContentEmbed type={p.embedType} urlOrId={p.urlOrId} width={280} height={160} tr={tr} />
                                          </div>
                                        )
                                      }
                                      return null
                                    })}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : s?.content ? (
                          (() => {
                            const parts = splitContentWithEmbeds(s.content)
                            return (
                              <div className="space-y-2">
                                {parts.map((p, j) => {
                                  if (p.type === 'text') return p.value ? <span key={j} className="text-slate-200/95 text-sm whitespace-pre-wrap break-words leading-relaxed min-w-0 text-left">{p.value}</span> : null
                                  if (p.type === 'embed' && p.embedType === 'quiz') {
                                    const q = parseQuizData(p.urlOrId)
                                    if (!q) return null
                                    return (
                                      <div key={j} className="rounded-lg bg-violet-500/15 border border-violet-400/30 p-2.5">
                                        <div className="text-violet-200 font-medium text-xs mb-1.5">{tr('Câu hỏi trắc nghiệm', 'Quiz question', '测验题', 'クイズ', '퀴즈')}</div>
                                        <p className="text-slate-200/95 text-sm mb-2">{q.question}</p>
                                        <div className="space-y-1">
                                          {q.options.map((opt, k) => (
                                            <div key={k} className={['text-xs pl-2 border-l-2', k === q.correctIndex ? 'border-emerald-400 text-emerald-300' : 'border-slate-600 text-slate-300'].join(' ')}>
                                              {String.fromCharCode(65 + k)}. {opt}
                                              {k === q.correctIndex && <span className="ml-1.5 text-emerald-400/80 text-[10px]">({tr('Đáp án đúng', 'Correct', '正确', '正解', '정답')})</span>}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )
                                  }
                                  if (p.type === 'embed') {
                                    return (
                                      <div key={j} className="mt-2 rounded-lg overflow-hidden border border-slate-600/60">
                                        <ContentEmbed type={p.embedType} urlOrId={p.urlOrId} width={280} height={160} tr={tr} />
                                      </div>
                                    )
                                  }
                                  return null
                                })}
                              </div>
                            )
                          })()
                        ) : (
                          <p className="text-slate-500 text-sm">{tr('Không có nội dung', 'No content', '无内容', 'コンテンツなし', '내용 없음')}</p>
                        )}
                      </div>
                    </div>
                  )
                })()
              ) : sections.length > 0 ? (
                (() => {
                  let isFirstMatch = true
                  return sections.map((section, i) => {
                    const ranges = getMatchRangesInSection(section, slideTextsForMatch)
                    const hasMatch = ranges.length > 0
                    const parts: React.ReactNode[] = []
                    let lastEnd = 0
                    for (const [s, e] of ranges) {
                      if (s > lastEnd) parts.push(section.slice(lastEnd, s))
                      parts.push(
                        <mark
                          key={`${i}-${s}`}
                          ref={isFirstMatch ? firstMatchRef : undefined}
                          className="bg-amber-400/40 text-amber-100 rounded px-0.5"
                        >
                          {section.slice(s, e)}
                        </mark>
                      )
                      if (isFirstMatch) isFirstMatch = false
                      lastEnd = e
                    }
                    if (lastEnd < section.length) parts.push(section.slice(lastEnd))
                    return (
                      <div
                        key={i}
                        ref={(el) => { sectionRefs.current[i] = el }}
                        className={[
                          'rounded-xl p-4 whitespace-pre-wrap break-words text-sm font-sans leading-relaxed transition-all duration-200 min-w-0 text-left',
                          hasMatch ? 'bg-amber-500/10 ring-1 ring-amber-400/40' : i === highlightIndex ? 'bg-amber-500/15 ring-2 ring-amber-400/60 shadow-lg shadow-amber-500/5' : 'bg-slate-800/50 opacity-75 hover:opacity-100 hover:bg-slate-800/70',
                        ].join(' ')}
                      >
                        <pre className="text-slate-200/95 text-[13px] whitespace-pre-wrap break-words min-w-0 text-left">
                          {parts.length > 0 ? parts : section}
                        </pre>
                      </div>
                    )
                  })
                })()
              ) : (
                <pre className="whitespace-pre-wrap break-words min-w-0 text-left text-slate-200/95 text-sm font-sans leading-relaxed bg-slate-800/50 rounded-xl p-4">{content}</pre>
              )}
            </div>
          </div>

          {/* Phải: Slide */}
          <div className="w-1/2 min-w-0 flex flex-col overflow-hidden isolate">
            <div className="px-4 py-2.5 text-slate-400 text-xs font-medium uppercase tracking-wider border-b border-slate-700/60 shrink-0 bg-slate-900/30">
              {slideViewMode === 'single' ? tr('Slide đang hiển thị', 'Current slide', '当前幻灯片', '表示中のスライド', '표시 중 슬라이드') : tr('3 slide: trước · hiện tại · sau', '3 slides: prev · current · next', '3张: 前·当前·后', '3枚: 前·現在·次', '3장: 이전·현재·다음')}
            </div>
            {slideViewMode === 'single' ? (
              <div className="flex-1 overflow-y-scroll overflow-x-hidden overscroll-y-contain p-3 space-y-2 min-h-0 flex flex-col text-left">
                {(() => {
                  const s = slides[currentIndex]
                  const blks = !s ? [] : (s.blocks?.length ? s.blocks : s.content ? parseContentToBlocks(s.content ?? '') : [])
                  const showDirectEdit = curriculumId && slideMode === 'personal' && personalViewSubMode === 'current'
                  return (
                    <>
                      {slideMode === 'personal' && personalViewSubMode === 'current' && !curriculumId && (
                        <div className="rounded-lg bg-violet-500/15 border border-violet-400/30 px-4 py-2 text-sm text-violet-200">
                          {tr('Lưu giáo trình vào kho để sửa bản riêng.', 'Save curriculum to library to edit personal version.', '保存课程到库以编辑个人版。', 'カリキュラムを保存して個人版を編集。', '교육과정 저장 후 개인 버전 편집.')}
                        </div>
                      )}
                      <div className="rounded-xl bg-amber-500/10 ring-2 ring-amber-400/40 border border-amber-400/30 p-2.5 shadow-lg flex flex-col">
                        <div className="flex items-center justify-between gap-1.5 mb-2 flex-wrap shrink-0">
                          {editingTitle === currentIndex ? (
                            <div className="flex-1 flex gap-2 items-center flex-wrap min-w-0">
                              <input value={editingTitleValue} onChange={(e) => setEditingTitleValue(e.target.value)} className="flex-1 min-w-[140px] rounded-lg bg-slate-700/80 px-3 py-2 text-amber-300 text-sm font-medium border border-slate-600 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30" placeholder={tr('Tiêu đề slide', 'Slide title', '幻灯片标题', 'スライドタイトル', '슬라이드 제목')} />
                              <button type="button" onClick={() => { setSlides((prev) => prev.map((sl, j) => j === currentIndex ? { ...sl, title: editingTitleValue } : sl)); sendUpdateSlideTitle(currentIndex, editingTitleValue); setEditingTitle(null) }} className="text-xs font-medium text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/30">{tr('Lưu', 'Save', '保存', '保存', '저장')}</button>
                              <button type="button" onClick={() => setEditingTitle(null)} className="text-xs text-slate-400 hover:text-slate-300 px-2 py-1.5">{tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}</button>
                            </div>
                          ) : (
                            <>
                              <span className="text-amber-300 font-medium text-sm">{currentIndex + 1}/{slides.length} {s?.title ?? ''}</span>
                              <div className="flex items-center gap-2 flex-wrap">
                                {curriculumId && ((slideMode === 'personal' && personalViewSubMode === 'current') || slideMode === 'shared' || slideMode === 'original') && (
                                  <>
                                    {currentIndex > 0 && (
                                      <button type="button" onClick={() => setSlideViewMode('triple')} className="text-[11px] text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25" title={tr('Xem 3 slide trước khi gộp', 'View 3 slides before merge', '合并前查看3张', '結合前に3枚表示', '병합 전 3장 보기')}>
                                        {tr('Gộp trước', 'Merge prev', '合并前', '前を結合', '이전 병합')}
                                      </button>
                                    )}
                                    {currentIndex >= 0 && currentIndex < slides.length - 1 && (
                                      <button type="button" onClick={() => setSlideViewMode('triple')} className="text-[11px] text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25" title={tr('Xem 3 slide trước khi gộp', 'View 3 slides before merge', '合并前查看3张', '結合前に3枚表示', '병합 전 3장 보기')}>
                                        {tr('Gộp sau', 'Merge next', '合并后', '次を結合', '다음 병합')}
                                      </button>
                                    )}
                                  </>
                                )}
                                {showDirectEdit && (
                                  <button type="button" onClick={() => { setEditingTitle(currentIndex); setEditingTitleValue(s?.title ?? '') }} className="text-xs text-slate-400 hover:text-amber-400 px-2 py-1 rounded-md hover:bg-slate-700/50 transition-colors">{tr('Sửa tiêu đề', 'Edit title', '编辑标题', 'タイトル編集', '제목 편집')}</button>
                                )}
                                {getQuizCount(blks) < 1 && editingTitle !== currentIndex && (
                                  <button
                                    type="button"
                                    onClick={() => void handleGenerateQuiz(currentIndex)}
                                    disabled={quizGenLoading !== null}
                                    className="text-xs text-violet-400 hover:text-violet-300 px-2.5 py-1 rounded-lg bg-violet-500/15 border border-violet-400/30 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                    title={tr('Tạo câu hỏi trắc nghiệm', 'Generate quiz', '生成测验', 'クイズ作成', '퀴즈 생성')}
                                  >
                                    <Sparkles className="h-3.5 w-3.5" />
                                    {quizGenLoading === currentIndex ? tr('Đang tạo...', 'Creating...', '创建中...', '作成中...', '생성 중...') : tr('Tạo câu hỏi', 'Add quiz', '添加测验', 'クイズ追加', '퀴즈 추가')}
                                  </button>
                                )}
                                {curriculumId && (
                                  <button
                                    type="button"
                                    onClick={() => setEmbedDialogOpen(true)}
                                    className="text-xs text-slate-300 hover:text-amber-300 px-2.5 py-1 rounded-lg bg-slate-600/40 border border-slate-500/50 hover:bg-amber-500/15 hover:border-amber-400/40 flex items-center gap-1.5 transition-colors"
                                    title={tr('Chèn nội dung (YouTube, GeoGebra, ảnh, quiz...)', 'Insert content (YouTube, GeoGebra, image, quiz...)', '插入内容', 'コンテンツを挿入', '콘텐츠 삽입')}
                                  >
                                    <BarChart2 className="h-3.5 w-3.5" />
                                    {tr('Chèn', 'Insert', '插入', '挿入', '삽입')}
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        {blks.length > 0 ? (
                          <div className="space-y-2 min-h-0 overflow-y-auto">
                            {blks.map((b, i) => {
                              const blockProposals = proposals.filter((p) => p.slide_index === currentIndex && p.block_index === i)
                              const isEditing = editingBlock?.slideIndex === currentIndex && editingBlock?.blockIndex === i
                              const isEditingHeader = editingHeader?.slideIndex === currentIndex && editingHeader?.blockIndex === i
                              const isBảnChung = slideMode === 'shared' || slideMode === 'original' || slideMode === null
                              const showProposalUi = curriculumId && isBảnChung
                              const showDirectEdit = curriculumId && slideMode === 'personal' && personalViewSubMode === 'current'
                              return (
                                <div key={i} className="rounded-lg bg-slate-800/60 p-2.5 border border-slate-600/60 hover:border-slate-500/50 transition-colors">
                                    {isEditingHeader ? (
                                    <div className="mb-2 flex gap-1.5 flex-wrap">
                                      <input value={editingHeaderValue} onChange={(e) => setEditingHeaderValue(e.target.value)} className="flex-1 min-w-[120px] rounded-lg bg-slate-700/80 px-3 py-2 text-amber-300 text-sm border border-slate-600 focus:border-amber-500/50" placeholder={tr('Tiêu đề block', 'Block header', '块标题', 'ブロックタイトル', '블록 제목')} />
                                      <button type="button" onClick={() => {
                                        const newBlocks = blks.map((bl, j) => j === i ? { ...bl, header: editingHeaderValue } : bl)
                                        setSlides((prev) => prev.map((sl, j) => j === currentIndex ? { ...sl, blocks: newBlocks } : sl))
                                        sendUpdateSlideBlocks(currentIndex, newBlocks)
                                        setEditingHeader(null)
                                      }} className="text-xs font-medium text-emerald-400 px-3 py-1.5 rounded-lg bg-emerald-500/20">{tr('Lưu', 'Save', '保存', '保存', '저장')}</button>
                                      <button type="button" onClick={() => setEditingHeader(null)} className="text-xs text-slate-400 hover:text-slate-300 px-2 py-1.5">{tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}</button>
                                    </div>
                                  ) : (
                                    b.header && (
                                      <div className="flex items-center gap-1.5 mb-1.5">
                                        <div className="text-amber-300/95 font-medium text-sm">{b.header}</div>
                                        {showDirectEdit && (
                                          <button type="button" onClick={() => { setEditingHeader({ slideIndex: currentIndex, blockIndex: i }); setEditingHeaderValue(b.header ?? '') }} className="text-[11px] text-slate-400 hover:text-amber-400 px-1.5 py-0.5 rounded hover:bg-slate-700/50 transition-colors">{tr('Sửa', 'Edit', '编辑', '編集', '편집')}</button>
                                        )}
                                      </div>
                                    )
                                  )}
                                  {isEditing ? (
                                    <div className="space-y-2">
                                      <textarea value={editingValue} onChange={(e) => setEditingValue(e.target.value)} className="w-full rounded-lg bg-slate-700/80 p-2.5 text-slate-200 text-sm min-h-[80px] border border-slate-600 focus:border-amber-500/40 resize-y" placeholder={tr('Nội dung block...', 'Block content...', '块内容...', 'ブロック内容...', '블록 내용...')} />
                                      <div className="flex gap-2">
                                        <button type="button" onClick={() => {
                                          const newBlocks = blks.map((bl, j) => j === i ? { ...bl, content: editingValue } : bl)
                                          setSlides((prev) => prev.map((sl, j) => j === currentIndex ? { ...sl, blocks: newBlocks } : sl))
                                          sendUpdateSlideBlocks(currentIndex, newBlocks)
                                          setEditingBlock(null)
                                        }} className="text-xs font-medium text-emerald-400 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30">{tr('Lưu', 'Save', '保存', '保存', '저장')}</button>
                                        <button type="button" onClick={() => setEditingBlock(null)} className="text-xs text-slate-400 hover:text-slate-300 px-2 py-1.5">{tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="text-slate-200/95 text-sm whitespace-pre-wrap break-words leading-relaxed min-w-0 text-left space-y-2">
                                        {(splitContentWithEmbeds(b.content ?? '')).map((p, j) => {
                                          if (p.type === 'text') return p.value ? <span key={j}>{p.value}</span> : null
                                          if (p.type === 'embed' && p.embedType === 'quiz') {
                                            const q = parseQuizData(p.urlOrId)
                                            if (!q) return null
                                            return (
                                              <div key={j} className="rounded-lg bg-violet-500/15 border border-violet-400/30 p-2.5">
                                                <div className="text-violet-200 font-medium text-xs mb-1.5">{tr('Câu hỏi trắc nghiệm', 'Quiz question', '测验题', 'クイズ', '퀴즈')}</div>
                                                <p className="text-slate-200/95 text-sm mb-2">{q.question}</p>
                                                <div className="space-y-1">
                                                  {q.options.map((opt, k) => (
                                                    <div key={k} className={['text-xs pl-2 border-l-2', k === q.correctIndex ? 'border-emerald-400 text-emerald-300' : 'border-slate-600 text-slate-300'].join(' ')}>
                                                      {String.fromCharCode(65 + k)}. {opt}
                                                      {k === q.correctIndex && <span className="ml-1.5 text-emerald-400/80 text-[10px]">({tr('Đáp án đúng', 'Correct', '正确', '正解', '정답')})</span>}
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )
                                          }
                                          if (p.type === 'embed') {
                                            return (
                                              <div key={j} className="rounded-lg overflow-hidden border border-slate-600/60">
                                                <ContentEmbed type={p.embedType} urlOrId={p.urlOrId} width={280} height={160} tr={tr} />
                                              </div>
                                            )
                                          }
                                          return null
                                        })}
                                      </div>
                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        {showDirectEdit && (
                                          <button type="button" onClick={() => { setEditingBlock({ slideIndex: currentIndex, blockIndex: i }); setEditingValue(b.content ?? '') }} className="text-xs font-medium text-violet-300 hover:text-violet-200 px-2 py-1 rounded-lg bg-violet-500/20 border border-violet-400/30 flex items-center gap-1 transition-colors">
                                            <Edit3 className="h-3.5 w-3.5" />
                                            {tr('Sửa', 'Edit', '编辑', '編集', '편집')}
                                          </button>
                                        )}
                                        {showProposalUi && (
                                          <>
                                            <button type="button" onClick={() => setProposalDialog({ open: true, slideIndex: currentIndex, blockIndex: i, type: 'edit', originalContent: b.content, blockHeader: b.header })} className="text-xs font-medium text-amber-300 hover:text-amber-200 px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-400/30 flex items-center gap-1 transition-colors">
                                              <Edit3 className="h-3.5 w-3.5" />{tr('Đề xuất sửa', 'Propose edit', '建议编辑', '編集提案', '편집 제안')}
                                            </button>
                                            <button type="button" onClick={() => setProposalDialog({ open: true, slideIndex: currentIndex, blockIndex: i, type: 'add', blockHeader: b.header })} className="text-xs font-medium text-emerald-300 hover:text-emerald-200 px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center gap-1 transition-colors">
                                              <Plus className="h-3.5 w-3.5" />{tr('Đề xuất bổ sung', 'Propose addition', '建议补充', '追加提案', '추가 제안')}
                                            </button>
                                          </>
                                        )}
                                      </div>
                                      {blockProposals.length > 0 && (
                                        <div className="mt-2 space-y-1.5">
                                          {blockProposals.map((p) => (
                                            <SlideProposalVote key={p.id} proposal={p} currentUserId={currentUserId} tr={tr} onVoted={refreshProposals} onDeleted={refreshProposals} />
                                          ))}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              )
                            })}
                            {slideMode === 'personal' && personalViewSubMode === 'current' && curriculumId && (
                              <button type="button" onClick={() => {
                                const newBlocks = [...blks, { header: tr('Nội dung', 'Content', '内容', '内容', '내용'), content: '' }]
                                setSlides((prev) => prev.map((sl, i) => i === currentIndex ? { ...sl, blocks: newBlocks } : sl))
                                sendUpdateSlideBlocks(currentIndex, newBlocks)
                              }} className="w-full py-2 rounded-lg border-2 border-dashed border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/15 hover:border-emerald-400/60 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors">
                                <Plus className="h-3.5 w-3.5" />
                                {tr('Thêm ý', 'Add point', '添加要点', '追加', '의견 추가')}
                              </button>
                            )}
                          </div>
                        ) : s?.content ? (
                          <div className="space-y-2">
                            <div className="rounded-lg bg-slate-800/60 p-2.5 border border-slate-600/60">
                              {(editingBlock?.slideIndex === currentIndex && editingBlock?.blockIndex === 0) ? (
                                <div className="space-y-2">
                                  <textarea value={editingValue} onChange={(e) => setEditingValue(e.target.value)} className="w-full rounded bg-slate-700 p-2 text-slate-200 text-sm min-h-[80px]" />
                                  <div className="flex gap-2">
                                    <button type="button" onClick={() => {
                                      const newBlocks = parseContentToBlocks(editingValue)
                                      setSlides((prev) => prev.map((sl, j) => j === currentIndex ? { ...sl, blocks: newBlocks, content: '' } : sl))
                                      sendUpdateSlideBlocks(currentIndex, newBlocks)
                                      setEditingBlock(null)
                                    }} className="text-xs text-emerald-400 px-2 py-1">{tr('Lưu', 'Save', '保存', '保存', '저장')}</button>
                                    <button type="button" onClick={() => setEditingBlock(null)} className="text-xs text-slate-400">{tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="text-slate-200 text-sm whitespace-pre-wrap break-words leading-relaxed min-w-0 text-left space-y-2">
                                    {(splitContentWithEmbeds(s.content ?? '')).map((p, j) => {
                                      if (p.type === 'text') return p.value ? <span key={j}>{p.value}</span> : null
                                      if (p.type === 'embed' && p.embedType === 'quiz') {
                                        const q = parseQuizData(p.urlOrId)
                                        if (!q) return null
                                        return (
                                          <div key={j} className="rounded-lg bg-violet-500/15 border border-violet-400/30 p-2.5">
                                            <div className="text-violet-200 font-medium text-xs mb-1.5">{tr('Câu hỏi trắc nghiệm', 'Quiz question', '测验题', 'クイズ', '퀴즈')}</div>
                                            <p className="text-slate-200/95 text-sm mb-2">{q.question}</p>
                                            <div className="space-y-1">
                                              {q.options.map((opt, k) => (
                                                <div key={k} className={['text-xs pl-2 border-l-2', k === q.correctIndex ? 'border-emerald-400 text-emerald-300' : 'border-slate-600 text-slate-300'].join(' ')}>
                                                  {String.fromCharCode(65 + k)}. {opt}
                                                  {k === q.correctIndex && <span className="ml-1.5 text-emerald-400/80 text-[10px]">({tr('Đáp án đúng', 'Correct', '正确', '正解', '정답')})</span>}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )
                                      }
                                      if (p.type === 'embed') {
                                        return (
                                          <div key={j} className="rounded-lg overflow-hidden border border-slate-600/60">
                                            <ContentEmbed type={p.embedType} urlOrId={p.urlOrId} width={280} height={160} tr={tr} />
                                          </div>
                                        )
                                      }
                                      return null
                                    })}
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {slideMode === 'personal' && personalViewSubMode === 'current' && curriculumId && (
                                      <button type="button" onClick={() => { setEditingBlock({ slideIndex: currentIndex, blockIndex: 0 }); setEditingValue(s.content ?? '') }} className="text-xs font-medium text-violet-300 hover:text-violet-200 px-2 py-1 rounded-lg bg-violet-500/20 border border-violet-400/30 flex items-center gap-1">
                                        <Edit3 className="h-3.5 w-3.5" />{tr('Sửa', 'Edit', '编辑', '編集', '편집')}
                                      </button>
                                    )}
                                    {(slideMode === 'shared' || slideMode === 'original' || slideMode === null) && curriculumId && (
                                      <>
                                        <button type="button" onClick={() => setProposalDialog({ open: true, slideIndex: currentIndex, blockIndex: 0, type: 'edit', originalContent: s.content })} className="text-xs font-medium text-amber-300 hover:text-amber-200 px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-400/30 flex items-center gap-1">
                                          <Edit3 className="h-3.5 w-3.5" />{tr('Đề xuất sửa', 'Propose edit', '建议编辑', '編集提案', '편집 제안')}
                                        </button>
                                        <button type="button" onClick={() => setProposalDialog({ open: true, slideIndex: currentIndex, blockIndex: 0, type: 'add' })} className="text-xs font-medium text-emerald-300 hover:text-emerald-200 px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center gap-1">
                                          <Plus className="h-3.5 w-3.5" />{tr('Đề xuất bổ sung', 'Propose addition', '建议补充', '追加提案', '추가 제안')}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                  {proposals.filter((p) => p.slide_index === currentIndex && p.block_index === 0).map((p) => (
                                    <SlideProposalVote key={p.id} proposal={p} currentUserId={currentUserId} tr={tr} onVoted={refreshProposals} onDeleted={refreshProposals} />
                                  ))}
                                </>
                              )}
                            </div>
                            {slideMode === 'personal' && personalViewSubMode === 'current' && curriculumId && (
                              <button type="button" onClick={() => {
                                const newBlocks = [...parseContentToBlocks(s.content ?? ''), { header: tr('Nội dung', 'Content', '内容', '内容', '내용'), content: '' }]
                                setSlides((prev) => prev.map((sl, j) => j === currentIndex ? { ...sl, blocks: newBlocks, content: '' } : sl))
                                sendUpdateSlideBlocks(currentIndex, newBlocks)
                              }} className="w-full py-2 rounded-lg border-2 border-dashed border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/15 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors">
                                <Plus className="h-3.5 w-3.5" />{tr('Thêm ý', 'Add point', '添加要点', '追加', '의견 추가')}
                              </button>
                            )}
                          </div>
                        ) : (
                          <p className="text-slate-500 text-sm py-2">{tr('Không có nội dung', 'No content', '无内容', 'コンテンツなし', '내용 없음')}</p>
                        )}
                      </div>
                      <div className="rounded-lg bg-slate-800/50 p-2 border border-slate-600/60 shrink-0">
                        <label className="block text-amber-300/95 font-medium mb-1 text-xs">{tr('Ghi chú', 'Notes', '备注', 'メモ', '메모')}</label>
                        <textarea value={notesValue} onChange={(e) => setNotesValue(e.target.value)} onBlur={handleBlur} placeholder={tr('Gợi ý câu hỏi, ví dụ...', 'Question hints, examples...', '问题提示、示例...', '質問のヒント、例...', '질문 힌트, 예시...')} className="w-full rounded-lg bg-slate-700/60 p-2 min-h-[44px] max-h-[100px] text-slate-200 placeholder-slate-500 border border-slate-600 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 text-xs resize-y transition-colors" />
                      </div>
                    </>
                  )
                })()}
              </div>
            ) : (
            <div className="flex-1 min-h-0 flex flex-col gap-1.5 p-3 overflow-hidden">
              {[
                { idx: currentIndex - 1, label: tr('Slide trước', 'Prev slide', '上一张', '前のスライド', '이전 슬라이드'), isCurrent: false },
                { idx: currentIndex, label: tr('Đang hiển thị', 'Displaying', '正在显示', '表示中', '표시 중'), isCurrent: true },
                { idx: currentIndex + 1, label: tr('Slide sau', 'Next slide', '下一张', '次のスライド', '다음 슬라이드'), isCurrent: false },
              ].map(({ idx, label, isCurrent }) => {
                const s = slides[idx]
                const blks = !s ? [] : (s.blocks?.length ? s.blocks : s.content ? parseContentToBlocks(s.content ?? '') : [])
                const canGo = idx >= 0 && idx < slides.length && idx !== currentIndex
                return (
                  <div
                    key={`${idx}-${currentIndex}`}
                    className={[
                      'rounded-lg border p-2 min-h-0 flex-1 flex flex-col transition-all overflow-hidden',
                      isCurrent ? 'bg-amber-500/10 ring-2 ring-amber-400/50 border-amber-400/40 shadow-lg' : 'bg-slate-800/40 border-slate-600/60 opacity-90 hover:opacity-95',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1 shrink-0 flex-wrap">
                      <span className={['text-xs font-medium truncate', isCurrent ? 'text-amber-300' : 'text-slate-500'].join(' ')}>
                        {idx >= 0 && idx < slides.length ? `${idx + 1}/${slides.length} ${s?.title ?? ''}` : label} {isCurrent && `· ${label}`}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {canGo && (
                          <button type="button" onClick={() => window.opener?.postMessage({ type: 'slide-go', index: idx }, window.location.origin)} className="text-[11px] text-amber-400 hover:text-amber-300 px-2 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 transition-colors">
                            {tr('Chuyển đến', 'Go to', '转到', '移動', '이동')}
                          </button>
                        )}
                        {isCurrent && idx > 0 && (
                          <button type="button" onClick={() => sendMergeSlides(idx - 1)} className="text-[11px] text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25" title={tr('Gộp slide trước', 'Merge prev', '合并上一张', '前を結合', '이전 병합')}>
                            {tr('Gộp trước', 'Merge prev', '合并前', '前を結合', '이전 병합')}
                          </button>
                        )}
                        {isCurrent && idx >= 0 && idx < slides.length - 1 && (
                          <button type="button" onClick={() => sendMergeSlides(idx)} className="text-[11px] text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25" title={tr('Gộp slide sau', 'Merge next', '合并下一张', '次を結合', '다음 병합')}>
                            {tr('Gộp sau', 'Merge next', '合并后', '次を結合', '다음 병합')}
                          </button>
                        )}
                        {isCurrent && getQuizCount(blks) < 1 && (
                          <button
                            type="button"
                            onClick={() => void handleGenerateQuiz(idx)}
                            disabled={quizGenLoading !== null}
                            className="text-xs text-violet-400 hover:text-violet-300 px-1.5 py-0.5 rounded bg-slate-700/50 flex items-center gap-1"
                            title="Tạo câu hỏi trắc nghiệm cho slide này"
                          >
                            <Sparkles className="h-3 w-3" />
                            {quizGenLoading === idx ? 'Đang tạo...' : 'Tạo câu hỏi'}
                          </button>
                        )}
                        {isCurrent && curriculumId && (
                          <button
                            type="button"
                            onClick={() => setEmbedDialogOpen(true)}
                            className="text-xs text-slate-400 hover:text-amber-300 px-1.5 py-0.5 rounded bg-slate-700/50 flex items-center gap-0.5"
                            title={tr('Chèn nội dung', 'Insert content', '插入内容', 'コンテンツを挿入', '콘텐츠 삽입')}
                          >
                            <BarChart2 className="h-3 w-3" />
                            {tr('Chèn', 'Insert', '插入', '挿入', '삽입')}
                          </button>
                        )}
                        {isCurrent && (blks.length >= 2 || (blks.length === 1 && canSplitBlockAtQuiz(blks[0]?.content ?? ''))) && (
                          splitAtBlock !== null && splitAtBlock >= 0 ? (
                            <span className="flex items-center gap-1">
                              <select value={splitAtBlock} onChange={(e) => setSplitAtBlock(Number(e.target.value))} className="text-xs bg-slate-700 text-slate-200 rounded px-1 py-0.5 border border-slate-600">
                                {blks.slice(0, -1).map((_, i) => (
                                  <option key={i} value={i}>Sau block {i + 1}</option>
                                ))}
                              </select>
                              <button type="button" onClick={() => sendSplitSlide(idx, splitAtBlock)} className="text-xs text-amber-400 hover:text-amber-300">Tách</button>
                              <button type="button" onClick={() => setSplitAtBlock(null)} className="text-xs text-slate-400">Hủy</button>
                            </span>
                          ) : blks.length === 1 && canSplitBlockAtQuiz(blks[0]?.content ?? '') ? (
                            <button type="button" onClick={() => sendSplitAtQuiz(idx)} className="text-xs text-amber-400 hover:text-amber-300 px-1.5 py-0.5 rounded bg-slate-700/50" title="Tách slide tại ranh giới câu hỏi trắc nghiệm">
                              Tách tại câu hỏi
                            </button>
                          ) : (
                            <button type="button" onClick={() => setSplitAtBlock(0)} className="text-xs text-amber-400 hover:text-amber-300 px-1.5 py-0.5 rounded bg-slate-700/50" title="Tách slide tại ranh giới block">
                              Tách slide
                            </button>
                          )
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-1 text-sm">
                      {blks.length > 0 ? (
                        blks.map((b, i) => {
                          const blockProposals = isCurrent && curriculumId ? proposals.filter((p) => p.slide_index === idx && p.block_index === i) : []
                          const isEditing = isCurrent && editingBlock?.slideIndex === idx && editingBlock?.blockIndex === i
                        const isBảnChung = slideMode === 'shared' || slideMode === 'original' || slideMode === null
                        const showProposalUi = isCurrent && curriculumId && isBảnChung
                        const showDirectEdit = isCurrent && curriculumId && slideMode === 'personal' && personalViewSubMode === 'current'
                          return (
                            <div key={i} className="rounded-lg bg-slate-800/50 p-2 border border-slate-600/50">
                              {b.header && <div className="text-amber-300/90 font-medium text-xs mb-0.5">{b.header}</div>}
                              {isEditing ? (
                                <div className="space-y-1">
                                  <textarea value={editingValue} onChange={(e) => setEditingValue(e.target.value)} className="w-full rounded bg-slate-700 p-1.5 text-slate-200 text-xs min-h-[60px]" />
                                  <div className="flex gap-1">
                                    <button type="button" onClick={() => {
                                      const newBlocks = blks.map((bl, j) => j === i ? { ...bl, content: editingValue } : bl)
                                      setSlides((prev) => prev.map((sl, j) => j === idx ? { ...sl, blocks: newBlocks } : sl))
                                      sendUpdateSlideBlocks(idx, newBlocks)
                                      setEditingBlock(null)
                                    }} className="text-[10px] text-emerald-400">{tr('Lưu', 'Save', '保存', '保存', '저장')}</button>
                                    <button type="button" onClick={() => setEditingBlock(null)} className="text-[10px] text-slate-400">{tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="text-slate-200 text-xs whitespace-pre-wrap break-words leading-relaxed min-w-0 text-left space-y-1">
                                    {(splitContentWithEmbeds(b.content ?? '')).map((p, j) => {
                                      if (p.type === 'text') return p.value ? <span key={j} className="line-clamp-3">{p.value}</span> : null
                                      if (p.type === 'embed' && p.embedType === 'quiz') {
                                        const q = parseQuizData(p.urlOrId)
                                        if (!q) return null
                                        return (
                                          <div key={j} className="rounded bg-violet-500/15 border border-violet-400/30 p-1.5">
                                            <div className="text-violet-200 font-medium text-[10px] mb-0.5">{tr('Câu hỏi trắc nghiệm', 'Quiz', '测验', 'クイズ', '퀴즈')}</div>
                                            <p className="text-slate-200/95 text-[11px] line-clamp-2">{q.question}</p>
                                          </div>
                                        )
                                      }
                                      if (p.type === 'embed') {
                                        return (
                                          <div key={j} className="rounded overflow-hidden border border-slate-600/60">
                                            <ContentEmbed type={p.embedType} urlOrId={p.urlOrId} width={200} height={120} tr={tr} />
                                          </div>
                                        )
                                      }
                                      return null
                                    })}
                                  </div>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {showDirectEdit && (
                                      <button type="button" onClick={() => { setEditingBlock({ slideIndex: idx, blockIndex: i }); setEditingValue(b.content ?? '') }} className="text-[10px] font-medium text-violet-300 hover:text-violet-200 px-1.5 py-0.5 rounded bg-violet-500/20 flex items-center gap-0.5">
                                        <Edit3 className="h-2.5 w-2.5" />{tr('Sửa', 'Edit', '编辑', '編集', '편집')}
                                      </button>
                                    )}
                                    {showProposalUi && (
                                      <>
                                        <button type="button" onClick={() => setProposalDialog({ open: true, slideIndex: idx, blockIndex: i, type: 'edit', originalContent: b.content, blockHeader: b.header })} className="text-[10px] font-medium text-amber-300 hover:text-amber-200 px-1.5 py-0.5 rounded bg-amber-500/20 flex items-center gap-0.5">
                                          <Edit3 className="h-2.5 w-2.5" />{tr('Đề xuất sửa', 'Propose', '建议', '提案', '제안')}
                                        </button>
                                        <button type="button" onClick={() => setProposalDialog({ open: true, slideIndex: idx, blockIndex: i, type: 'add', blockHeader: b.header })} className="text-[10px] font-medium text-emerald-300 hover:text-emerald-200 px-1.5 py-0.5 rounded bg-emerald-500/20 flex items-center gap-0.5">
                                          <Plus className="h-2.5 w-2.5" />{tr('Đề xuất thêm', 'Propose add', '建议添加', '追加提案', '추가 제안')}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                  {blockProposals.map((p) => (
                                    <SlideProposalVote key={p.id} proposal={p} currentUserId={currentUserId} tr={tr} onVoted={refreshProposals} onDeleted={refreshProposals} />
                                  ))}
                                </>
                              )}
                            </div>
                          )
                        })
                      ) : null}
                      {blks.length > 0 && isCurrent && slideMode === 'personal' && personalViewSubMode === 'current' && curriculumId && (
                        <button type="button" onClick={() => {
                          const newBlocks = [...blks, { header: tr('Nội dung', 'Content', '内容', '内容', '내용'), content: '' }]
                          setSlides((prev) => prev.map((sl, j) => j === idx ? { ...sl, blocks: newBlocks } : sl))
                          sendUpdateSlideBlocks(idx, newBlocks)
                        }} className="w-full py-1.5 rounded border border-dashed border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/15 text-[10px] font-medium flex items-center justify-center gap-1 transition-colors">
                          <Plus className="h-2.5 w-2.5" />{tr('Thêm ý', 'Add', '添加', '追加', '추가')}
                        </button>
                      )}
                      {blks.length === 0 ? (s?.content ? (
                        <div className="rounded-lg bg-slate-800/50 p-2 border border-slate-600/50">
                          {(isCurrent && editingBlock?.slideIndex === idx && editingBlock?.blockIndex === 0) ? (
                            <div className="space-y-1">
                              <textarea value={editingValue} onChange={(e) => setEditingValue(e.target.value)} className="w-full rounded bg-slate-700 p-1.5 text-slate-200 text-xs min-h-[50px]" />
                              <div className="flex gap-1">
                                <button type="button" onClick={() => {
                                  const newBlocks = parseContentToBlocks(editingValue)
                                  setSlides((prev) => prev.map((sl, j) => j === idx ? { ...sl, blocks: newBlocks, content: '' } : sl))
                                  sendUpdateSlideBlocks(idx, newBlocks)
                                  setEditingBlock(null)
                                }} className="text-[10px] text-emerald-400">{tr('Lưu', 'Save', '保存', '保存', '저장')}</button>
                                <button type="button" onClick={() => setEditingBlock(null)} className="text-[10px] text-slate-400">{tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="text-slate-200 text-xs whitespace-pre-wrap break-words leading-relaxed min-w-0 text-left space-y-1">
                                {(splitContentWithEmbeds(s.content ?? '')).map((p, j) => {
                                  if (p.type === 'text') return p.value ? <span key={j} className="line-clamp-3">{p.value}</span> : null
                                  if (p.type === 'embed' && p.embedType === 'quiz') {
                                    const q = parseQuizData(p.urlOrId)
                                    if (!q) return null
                                    return (
                                      <div key={j} className="rounded bg-violet-500/15 border border-violet-400/30 p-1.5">
                                        <div className="text-violet-200 font-medium text-[10px] mb-0.5">{tr('Câu hỏi trắc nghiệm', 'Quiz', '测验', 'クイズ', '퀴즈')}</div>
                                        <p className="text-slate-200/95 text-[11px] line-clamp-2">{q.question}</p>
                                      </div>
                                    )
                                  }
                                  if (p.type === 'embed') {
                                    return (
                                      <div key={j} className="rounded overflow-hidden border border-slate-600/60">
                                        <ContentEmbed type={p.embedType} urlOrId={p.urlOrId} width={200} height={120} tr={tr} />
                                      </div>
                                    )
                                  }
                                  return null
                                })}
                              </div>
                              {isCurrent && slideMode === 'personal' && personalViewSubMode === 'current' && curriculumId && (
                                <div className="mt-1">
                                  <button type="button" onClick={() => { setEditingBlock({ slideIndex: idx, blockIndex: 0 }); setEditingValue(s.content ?? '') }} className="text-[10px] text-violet-400 hover:text-violet-300 px-1.5 py-0.5 rounded bg-slate-700/50 flex items-center gap-0.5 border border-violet-500/50">
                                    <Edit3 className="h-2.5 w-2.5" />{tr('Sửa', 'Edit', '编辑', '編集', '편집')}
                                  </button>
                                </div>
                              )}
                              {isCurrent && (slideMode === 'shared' || slideMode === 'original' || slideMode === null) && curriculumId && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  <button type="button" onClick={() => setProposalDialog({ open: true, slideIndex: idx, blockIndex: 0, type: 'edit', originalContent: s.content })} className="text-[10px] text-amber-400 hover:text-amber-300 px-1.5 py-0.5 rounded bg-slate-700/50 flex items-center gap-0.5 border border-amber-500/50">
                                    <Edit3 className="h-2.5 w-2.5" />{tr('Đề xuất sửa', 'Propose edit', '建议编辑', '編集提案', '편집 제안')}
                                  </button>
                                  <button type="button" onClick={() => setProposalDialog({ open: true, slideIndex: idx, blockIndex: 0, type: 'add' })} className="text-[10px] text-emerald-400 hover:text-emerald-300 px-1.5 py-0.5 rounded bg-slate-700/50 flex items-center gap-0.5 border border-emerald-500/50">
                                    <Plus className="h-2.5 w-2.5" />{tr('Đề xuất bổ sung', 'Propose addition', '建议补充', '追加提案', '추가 제안')}
                                  </button>
                                </div>
                              )}
                              {proposals.filter((p) => p.slide_index === idx && p.block_index === 0).map((p) => (
                                <SlideProposalVote key={p.id} proposal={p} currentUserId={currentUserId} tr={tr} onVoted={refreshProposals} onDeleted={refreshProposals} />
                              ))}
                            </>
                          )}
                        </div>
                      ) : (
                        <p className="text-slate-500 text-xs">{tr('Không có nội dung', 'No content', '无内容', 'コンテンツなし', '내용 없음')}</p>
                      )) : null}
                      {blks.length === 0 && s?.content && isCurrent && slideMode === 'personal' && personalViewSubMode === 'current' && curriculumId && (
                        <button type="button" onClick={() => {
                          const newBlocks = [...parseContentToBlocks(s.content ?? ''), { header: tr('Nội dung', 'Content', '内容', '内容', '내용'), content: '' }]
                          setSlides((prev) => prev.map((sl, j) => j === idx ? { ...sl, blocks: newBlocks, content: '' } : sl))
                          sendUpdateSlideBlocks(idx, newBlocks)
                        }} className="w-full py-1 rounded border border-dashed border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 text-[10px] flex items-center justify-center gap-0.5 mt-0.5">
                          <Plus className="h-3 w-3" />{tr('Thêm ý', 'Add point', '添加要点', '追加', '의견 추가')}
                        </button>
                      )}
                    </div>
                    {isCurrent && (
                      <div className="mt-1.5 pt-1.5 border-t border-slate-600/60 shrink-0">
                        <label className="block text-amber-300/90 font-medium text-[10px] mb-0.5">{tr('Ghi chú', 'Notes', '备注', 'メモ', '메모')}</label>
                        <textarea
                          value={notesValue}
                          onChange={(e) => setNotesValue(e.target.value)}
                          onBlur={handleBlur}
                          placeholder={tr('Gợi ý câu hỏi, ví dụ...', 'Question hints, examples...', '问题提示、示例...', '質問のヒント、例...', '질문 힌트, 예시...')}
                          className="w-full rounded bg-slate-700/50 p-1.5 min-h-[36px] max-h-[64px] text-slate-200 placeholder-slate-500 border border-slate-600 focus:border-amber-500/50 text-xs resize-y transition-colors"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            )}
          </div>
        </div>
      )}
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
          onSuccess={refreshProposals}
        />
      )}
      <PersonalHistorySheet
        open={personalHistoryOpen}
        onOpenChange={setPersonalHistoryOpen}
        curriculumId={curriculumId}
        tr={tr}
        onRestored={sendRefreshPersonalAfterReset}
      />
      <SlideEditHistorySheet
        open={sharedHistoryOpen}
        onOpenChange={setSharedHistoryOpen}
        curriculumId={curriculumId}
        tr={tr}
      />
      {curriculumId && slides.length > 0 && (
        <EmbedInsertDialog
          open={embedDialogOpen}
          onOpenChange={setEmbedDialogOpen}
          onInsert={(marker, placement, alsoTo) => {
            if (window.opener) {
              window.opener.postMessage({ type: 'insert-embed', marker, placement, alsoApplyToSlideIndices: alsoTo }, window.location.origin)
            }
            setEmbedDialogOpen(false)
          }}
          onReplaceSlideImage={(markerOrUrl, alsoTo, layout, cellIndex) => {
            if (window.opener) {
              window.opener.postMessage({ type: 'replace-slide-image', markerOrUrl, alsoApplyToSlideIndices: alsoTo, layout, cellIndex }, window.location.origin)
            }
            setEmbedDialogOpen(false)
          }}
          onDeleteVisual={(alsoTo) => {
            if (window.opener) {
              window.opener.postMessage({ type: 'delete-visual', alsoApplyToSlideIndices: alsoTo }, window.location.origin)
            }
            setEmbedDialogOpen(false)
          }}
          tr={tr}
          highZIndex
          blocks={(() => {
            const s = slides[currentIndex]
            const blks = s?.blocks?.length ? s.blocks : s?.content ? parseContentToBlocks(s.content) : []
            return blks.map((b) => ({ header: b.header ?? tr('Nội dung', 'Content', '内容', '内容', '내용'), content: b.content }))
          })()}
          slides={slides.map((s) => ({ title: s.title }))}
          currentSlideIndex={currentIndex}
          currentVisual={slides[currentIndex] ? getVisualCells(slides[currentIndex]) : undefined}
        />
      )}
      {visualFullscreenOpen && leftPanelMode === 'visual' && slides[currentIndex] && (() => {
        const s = slides[currentIndex]
        const { layout, cells } = getVisualCells(s)
        const gridClass = layout === 2 ? 'grid grid-cols-2 gap-4' : layout === 4 ? 'grid grid-cols-2 grid-rows-2 gap-4' : ''
        return (
          <div
            className="fixed inset-0 z-[105] bg-black flex flex-col"
            onClick={(e) => { if (e.target === e.currentTarget) setVisualFullscreenOpen(false) }}
          >
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-700/80 bg-slate-900/80">
              <span className="text-amber-300 font-medium">{currentIndex + 1}/{slides.length} {s.title}</span>
              <button
                type="button"
                onClick={() => setVisualFullscreenOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-700/60 text-slate-300 hover:text-white transition-colors"
                title={tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className={cn('flex-1 overflow-auto p-4 flex items-center justify-center', layout === 1 ? 'flex flex-col gap-4' : gridClass)}>
              {cells.map((cell, i) => (
                <div key={i} className="flex items-center justify-center">
                  {cell.visualEmbed ? (
                    (() => {
                      const embeds = parseContentEmbeds(cell.visualEmbed)
                      const first = embeds[0]
                      if (!first) return null
                      return (
                        <div className="w-full max-w-3xl aspect-video rounded-lg overflow-hidden bg-slate-800">
                          <ContentEmbed type={first.type} urlOrId={first.urlOrId} width={960} height={540} tr={tr} hideQuiz className="!my-0 !rounded-lg !border-0 !w-full !h-full !min-w-0 !min-h-0" />
                        </div>
                      )
                    })()
                  ) : cell.imageUrl ? (
                    <img src={cell.imageUrl} alt="" className="max-w-full max-h-[70vh] object-contain rounded-lg" referrerPolicy="no-referrer" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )
      })()}
      {slides[currentIndex] && (
        <QuizPopupDialog
          open={quizPopupOpen}
          onOpenChange={setQuizPopupOpen}
          slide={slides[currentIndex]}
          slideIndex={currentIndex}
          curriculumId={curriculumId ?? undefined}
          tr={tr}
          teacherMode
        />
      )}
    </div>
  )
}
