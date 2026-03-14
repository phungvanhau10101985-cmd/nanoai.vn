'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Timer, Play, Pause, RotateCcw, ChevronLeft, ChevronRight, LayoutGrid, Square, Sparkles, Edit3, Plus, Save, FileText, FileEdit, History, BarChart2, Maximize2, X, ClipboardList, Flag, Presentation, Settings2, MoreVertical, Trash2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { canSplitBlockAtQuiz, splitContentWithEmbeds, splitBlockContentAtQuizBoundary, parseQuizData, parseContentEmbeds, ContentEmbed, type EmbedType } from '../components/content-embed'
import { parseContentToBlocks } from '../lib/curriculum-to-slides'
import { SlideProposalDialog } from '../components/slide-proposal-dialog'
import { SlideProposalVote } from '../components/slide-proposal-vote'
import { PersonalHistorySheet } from '../components/personal-history-sheet'
import { SlideEditHistorySheet } from '../components/slide-edit-history-sheet'
import { EmbedInsertDialog, type EmbedPlacement } from '../components/embed-insert-dialog'
import { PresentationControlBar } from '../components/presentation-control-bar'
import { QuizPopupDialog, extractQuizFromSlide } from '../components/quiz-popup-dialog'
import { getSlideProposalsForCurriculum, getSlidesByCurriculumId, resetPersonalToOriginal, saveSlidesToCurriculum, saveUserCustomizedSlides } from '../actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

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

const DARK_GRADIENTS = [
  'linear-gradient(160deg, #1e3a5f 0%, #0f172a 50%)',
  'linear-gradient(160deg, #312e81 0%, #1e1b4b 50%)',
  'linear-gradient(160deg, #1e3a5f 0%, #0f172a 50%)',
  'linear-gradient(160deg, #1e3a5f 0%, #0c4a6e 50%)',
]
const QUIZ_DIFFICULTIES = ['easy', 'medium', 'hard'] as const

/** Vùng ảnh thực sự hiển thị (object-contain) – dùng tâm ảnh + tỷ lệ để tính chuột ảo */
function getVisibleImageBounds(img: HTMLImageElement): { left: number; top: number; width: number; height: number } {
  const rect = img.getBoundingClientRect()
  const nw = img.naturalWidth || rect.width
  const nh = img.naturalHeight || rect.height
  if (nw <= 0 || nh <= 0) return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
  const cw = rect.width
  const ch = rect.height
  const scale = Math.min(cw / nw, ch / nh)
  const dw = nw * scale
  const dh = nh * scale
  const ox = (cw - dw) / 2
  const oy = (ch - dh) / 2
  return { left: rect.left + ox, top: rect.top + oy, width: dw, height: dh }
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
  return (Array.isArray(blocks) ? blocks : []).reduce((acc, b) => acc + (b.content?.match(/\[quiz:/g)?.length ?? 0), 0)
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
const asArray = <T,>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : [])

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

  const blocks = Array.isArray(slide.blocks) && slide.blocks.length > 0 ? slide.blocks : (slide.content ? parseContentToBlocks(slide.content) : [])
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
  const [quizDifficultyPopoverSlide, setQuizDifficultyPopoverSlide] = useState<number | null>(null)
  const [quizReportLoading, setQuizReportLoading] = useState<string | null>(null)
  const { toast } = useToast()
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
  const [embedDialogInitialMode, setEmbedDialogInitialMode] = useState<'insert' | 'replaceImage'>('insert')
  const [embedReplaceContext, setEmbedReplaceContext] = useState<{ slideIndex: number; blockIndex: number; rawMarker: string; urlOrId: string; embedType: EmbedType } | null>(null)
  const [leftPanelMode, setLeftPanelMode] = useState<'curriculum' | 'slide' | 'visual'>('curriculum')
  const [visualFullscreenOpen, setVisualFullscreenOpen] = useState(false)
  const [teacherExpandedCellIndex, setTeacherExpandedCellIndex] = useState<number | null>(null)
  const [quizPopupOpen, setQuizPopupOpen] = useState(false)
  const [studentMousePos, setStudentMousePos] = useState<{ x: number; y: number } | null>(null)
  const prevSlideModeRef = useRef<string | null>(null)
  const studentViewWindowRef = useRef<Window | null>(null)
  const [remoteTeacherWritingMode, setRemoteTeacherWritingMode] = useState(false)
  const [remoteTeacherWritingSpeedMs, setRemoteTeacherWritingSpeedMs] = useState(80)
  const [remoteAutoPlay, setRemoteAutoPlay] = useState(false)
  const [remoteAutoPlayIntervalMs, setRemoteAutoPlayIntervalMs] = useState(5000)
  const pointerThrottleRef = useRef(0)
  const syncSeqRef = useRef(1)
  const syncChannelRef = useRef<BroadcastChannel | null>(null)
  const quizPopupScrollApplyingRef = useRef(false)
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([])
  const firstMatchRef = useRef<HTMLElement | null>(null)
  const teacherVisualFrameRef = useRef<HTMLDivElement | null>(null)
  const [layoutWidth, setLayoutWidth] = useState(1280)
  const [viewportW, setViewportW] = useState(1280)
  useEffect(() => {
    const sync = () => {
      const w = window.innerWidth
      setViewportW(w)
      setLayoutWidth((prev) => Math.max(prev, Math.max(1280, w)))
    }
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])
  const clipLeft = viewportW >= 768 && viewportW < layoutWidth
  const isMobile = viewportW < 768

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
    if (action === 'teacher-timer-start') setTeacherTimerRunning(true)
    else if (action === 'teacher-timer-stop') setTeacherTimerRunning(false)
    else if (action === 'teacher-timer-reset') { setTeacherTimerRunning(false); setTeacherTimerSeconds(0) }
    if (window.opener) window.opener.postMessage({ type: action }, window.location.origin)
    try {
      const w = studentViewWindowRef.current
      if (w && !w.closed) w.postMessage({ type: action }, window.location.origin)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!teacherTimerRunning) return
    const id = window.setInterval(() => setTeacherTimerSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [teacherTimerRunning])

  const sendSlideControl = useCallback((action: 'slide-prev' | 'slide-next') => {
    const nextIndex = action === 'slide-next'
      ? Math.min(currentIndex + 1, slides.length - 1)
      : Math.max(currentIndex - 1, 0)
    setCurrentIndex(nextIndex)
    if (window.opener) window.opener.postMessage({ type: action }, window.location.origin)
    try {
      const w = studentViewWindowRef.current
      if (w && !w.closed) w.postMessage({ type: 'slide-go', index: nextIndex }, window.location.origin)
    } catch {
      /* ignore */
    }
  }, [currentIndex, slides.length])

  const sendToStudentView = useCallback((msg: Record<string, unknown>) => {
    const payload = { ...msg, __syncSeq: syncSeqRef.current++ }
    try {
      const w = studentViewWindowRef.current
      if (w && !w.closed) w.postMessage(payload, window.location.origin)
    } catch {
      /* ignore */
    }
    try {
      syncChannelRef.current?.postMessage(payload)
    } catch {
      /* ignore */
    }
  }, [])

  const sendCurriculumDataToStudent = useCallback((slidesToSend: SlideItem[], currentIndexOverride?: number) => {
    const idx = typeof currentIndexOverride === 'number' ? currentIndexOverride : currentIndex
    const payload = {
      type: 'curriculum-data',
      content,
      topic,
      currentIndex: Math.max(0, Math.min(idx, slidesToSend.length - 1)),
      curriculumId: curriculumId ?? null,
      slideMode: slideMode ?? null,
      personalViewSubMode,
      hasOriginalSlides,
      slides: slidesToSend.map((s) => ({
        title: s.title,
        blocks: s.blocks ?? [],
        teacherNotes: s.teacherNotes ?? '',
        imageUrl: s.imageUrl,
        visualEmbed: s.visualEmbed,
        visualLayout: s.visualLayout,
        visualCells: s.visualCells,
      })),
      teacherTimerSeconds,
      teacherTimerRunning,
    }
    try {
      const w = studentViewWindowRef.current
      if (w && !w.closed) w.postMessage(payload, window.location.origin)
    } catch {
      /* ignore */
    }
    try {
      syncChannelRef.current?.postMessage(payload)
    } catch {
      /* ignore */
    }
  }, [content, topic, currentIndex, curriculumId, slideMode, personalViewSubMode, hasOriginalSlides, teacherTimerSeconds, teacherTimerRunning])

  const persistSlidesRef = useRef<(s: SlideItem[]) => Promise<void>>(async () => {})
  useEffect(() => {
    persistSlidesRef.current = async (updatedSlides: SlideItem[]) => {
      if (!curriculumId || updatedSlides.length === 0) return
      const payload = updatedSlides.map((s) => ({
        title: s.title,
        blocks: (s.blocks ?? []).map((b) => ({ header: b.header ?? 'Nội dung', content: b.content ?? '' })),
        imageUrl: s.imageUrl,
        visualEmbed: s.visualEmbed,
        visualLayout: s.visualLayout,
        visualCells: s.visualCells,
        teacherNotes: s.teacherNotes,
      }))
      if (slideMode === 'personal' || slideMode === 'original') {
        const r = await saveUserCustomizedSlides({ curriculumId, slides: payload })
        if (r?.error) toast({ title: tr('Lỗi lưu', 'Save error', '保存错误', '保存エラー', '저장 오류'), description: r.error, variant: 'destructive' })
        else { toast({ title: tr('Đã lưu', 'Saved', '已保存', '保存しました', '저장됨'), duration: 1500 }) }
      } else if (slideMode === 'shared' || !slideMode) {
        const r = await saveSlidesToCurriculum({ curriculumId, topic: topic || 'Bài giảng', subjectId: 'toan', gradeLevelId: 'lop-6', slides: payload })
        if (r?.error) toast({ title: tr('Lỗi lưu', 'Save error', '保存错误', '保存エラー', '저장 오류'), description: r.error, variant: 'destructive' })
        else { toast({ title: tr('Đã lưu', 'Saved', '已保存', '保存しました', '저장됨'), duration: 1500 }) }
      }
    }
  }, [curriculumId, slideMode, topic, toast, tr])
  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel('tao-giao-trinh-sync')
    syncChannelRef.current = channel
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'request-curriculum' || !content) return
      channel.postMessage({
        type: 'curriculum-data',
        content,
        topic,
        currentIndex,
        curriculumId: curriculumId ?? null,
        slideMode: slideMode ?? null,
        personalViewSubMode,
        hasOriginalSlides,
        slides: slides.map((s) => ({
          title: s.title,
          blocks: (s.blocks ?? []).map((b) => ({ header: b.header ?? 'Nội dung', content: b.content ?? '' })),
          teacherNotes: s.teacherNotes ?? '',
          imageUrl: s.imageUrl,
          visualEmbed: s.visualEmbed,
          visualLayout: s.visualLayout,
          visualCells: s.visualCells,
        })),
        teacherTimerSeconds,
        teacherTimerRunning,
      })
      channel.postMessage({ type: 'presentation-mode', mode: 'slide-interaction' })
      channel.postMessage({ type: 'set-teacher-writing-mode', value: remoteTeacherWritingMode })
      channel.postMessage({ type: 'set-teacher-writing-speed', ms: remoteTeacherWritingSpeedMs })
      channel.postMessage({ type: 'set-auto-play', value: remoteAutoPlay })
      channel.postMessage({ type: 'set-auto-play-interval', ms: remoteAutoPlayIntervalMs })
      if (visualFullscreenOpen) channel.postMessage({ type: 'visual-fullscreen-open', cellIndex: undefined })
      channel.postMessage({ type: 'quiz-popup-open', value: quizPopupOpen })
      if (quizPopupOpen) {
        const scrollEl = document.querySelector('[data-quiz-popup-scroll]') as HTMLElement | null
        if (scrollEl) channel.postMessage({ type: 'quiz-popup-scroll', scrollTop: scrollEl.scrollTop })
      }
    }
    channel.addEventListener('message', onMessage)
    return () => {
      channel.removeEventListener('message', onMessage)
      channel.close()
      if (syncChannelRef.current === channel) syncChannelRef.current = null
    }
  }, [content, topic, currentIndex, curriculumId, slideMode, personalViewSubMode, hasOriginalSlides, slides, teacherTimerSeconds, teacherTimerRunning, remoteTeacherWritingMode, remoteTeacherWritingSpeedMs, remoteAutoPlay, remoteAutoPlayIntervalMs, visualFullscreenOpen, quizPopupOpen])

  const openTeacherVisualFullscreen = useCallback((cellIndex?: number) => {
    setTeacherExpandedCellIndex(typeof cellIndex === 'number' ? cellIndex : null)
    setVisualFullscreenOpen(true)
    sendToStudentView({ type: 'visual-fullscreen-open', cellIndex: typeof cellIndex === 'number' ? cellIndex : undefined })
  }, [sendToStudentView])

  const closeTeacherVisualFullscreen = useCallback(() => {
    setVisualFullscreenOpen(false)
    setTeacherExpandedCellIndex(null)
    sendToStudentView({ type: 'visual-fullscreen-close' })
  }, [sendToStudentView])

  useEffect(() => {
    sendToStudentView({ type: 'quiz-popup-open', value: quizPopupOpen })
  }, [quizPopupOpen, sendToStudentView])

  useEffect(() => {
    if (!quizPopupOpen) setStudentMousePos(null)
  }, [quizPopupOpen])

  useEffect(() => {
    if (!quizPopupOpen) return
    let cancelled = false
    let throttleId: ReturnType<typeof setTimeout> | null = null
    let lastSent = 0
    const THROTTLE_MS = 80
    let scrollEl: HTMLElement | null = null
    let attached = false
    const sendScroll = () => {
      if (!scrollEl || cancelled) return
      if (quizPopupScrollApplyingRef.current) return
      const now = Date.now()
      if (now - lastSent < THROTTLE_MS) {
        if (throttleId == null) {
          throttleId = setTimeout(() => {
            throttleId = null
            lastSent = Date.now()
            if (cancelled || !scrollEl || quizPopupScrollApplyingRef.current) return
            sendToStudentView({ type: 'quiz-popup-scroll', scrollTop: scrollEl!.scrollTop })
          }, THROTTLE_MS - (now - lastSent))
        }
        return
      }
      lastSent = now
      sendToStudentView({ type: 'quiz-popup-scroll', scrollTop: scrollEl!.scrollTop })
    }
    const attach = () => {
      if (cancelled || attached) return
      const el = document.querySelector('[data-quiz-popup-scroll]') as HTMLElement | null
      if (!el) return
      scrollEl = el
      attached = true
      sendScroll()
      el.addEventListener('scroll', sendScroll, { passive: true })
    }
    attach()
    const t1 = setTimeout(attach, 50)
    const t2 = setTimeout(attach, 150)
    const t3 = setTimeout(attach, 400)
    return () => {
      cancelled = true
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      if (throttleId != null) clearTimeout(throttleId)
      if (scrollEl) scrollEl.removeEventListener('scroll', sendScroll)
    }
  }, [quizPopupOpen, sendToStudentView])

  useEffect(() => {
    const getQuizPopupRect = () => {
      const el = document.querySelector('[data-quiz-popup]')
      return el ? (el as HTMLElement).getBoundingClientRect() : null
    }
    const sendPointerMove = (e: MouseEvent) => {
      const now = Date.now()
      if (now - pointerThrottleRef.current < 16) return
      pointerThrottleRef.current = now
      const w = window.innerWidth || 1
      const h = window.innerHeight || 1
      if (quizPopupOpen) {
        const rect = getQuizPopupRect()
        if (rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const relX = rect.right - e.clientX
          const relY = e.clientY - rect.top
          sendToStudentView({ type: 'mouse-pos', quizPopup: true, relX, relY })
          return
        }
      }
      if (visualFullscreenOpen && teacherVisualFrameRef.current) {
        const frame = teacherVisualFrameRef.current
        const children = Array.from(frame.children) as HTMLElement[]
        let sent = false
        for (let i = 0; i < children.length; i++) {
          const cell = children[i]
          const rect = cell.getBoundingClientRect()
          if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
            const img = cell.querySelector('img')
            if (img?.complete && img.naturalWidth > 0) {
              const vis = getVisibleImageBounds(img)
              const cx = vis.left + vis.width / 2
              const cy = vis.top + vis.height / 2
              const dx = e.clientX - cx
              const dy = e.clientY - cy
              sendToStudentView({
                type: 'mouse-pos',
                visualFrame: true,
                imageCenter: true,
                cellIndex: i,
                dxFromCenter: dx,
                dyFromCenter: dy,
                visW: vis.width,
                visH: vis.height,
              })
            } else {
              const cx = rect.left + rect.width / 2
              const cy = rect.top + rect.height / 2
              sendToStudentView({
                type: 'mouse-pos',
                visualFrame: true,
                imageCenter: true,
                cellIndex: i,
                dxFromCenter: e.clientX - cx,
                dyFromCenter: e.clientY - cy,
                visW: rect.width,
                visH: rect.height,
              })
            }
            sent = true
            break
          }
        }
        if (!sent) {
          const rect = frame.getBoundingClientRect()
          const relX = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5
          const relY = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0.5
          sendToStudentView({ type: 'mouse-pos', visualFrame: true, relX, relY })
        }
      } else {
        sendToStudentView({
          type: 'mouse-pos',
          xrPx: Math.max(0, w - e.clientX),
          yPx: Math.max(0, Math.min(h, e.clientY)),
        })
      }
    }
    const sendPointerClick = (e: MouseEvent) => {
      const w = window.innerWidth || 1
      const h = window.innerHeight || 1
      if (quizPopupOpen) {
        const rect = getQuizPopupRect()
        if (rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const relX = rect.right - e.clientX
          const relY = e.clientY - rect.top
          sendToStudentView({ type: 'mouse-click', quizPopup: true, relX, relY })
          return
        }
      }
      if (visualFullscreenOpen && teacherVisualFrameRef.current) {
        const frame = teacherVisualFrameRef.current
        const children = Array.from(frame.children) as HTMLElement[]
        let sent = false
        for (let i = 0; i < children.length; i++) {
          const cell = children[i]
          const rect = cell.getBoundingClientRect()
          if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
            const img = cell.querySelector('img')
            if (img?.complete && img.naturalWidth > 0) {
              const vis = getVisibleImageBounds(img)
              const cx = vis.left + vis.width / 2
              const cy = vis.top + vis.height / 2
              sendToStudentView({
                type: 'mouse-click',
                visualFrame: true,
                imageCenter: true,
                cellIndex: i,
                dxFromCenter: e.clientX - cx,
                dyFromCenter: e.clientY - cy,
                visW: vis.width,
                visH: vis.height,
              })
            } else {
              const cx = rect.left + rect.width / 2
              const cy = rect.top + rect.height / 2
              sendToStudentView({
                type: 'mouse-click',
                visualFrame: true,
                imageCenter: true,
                cellIndex: i,
                dxFromCenter: e.clientX - cx,
                dyFromCenter: e.clientY - cy,
                visW: rect.width,
                visH: rect.height,
              })
            }
            sent = true
            break
          }
        }
        if (!sent) {
          const rect = frame.getBoundingClientRect()
          const relX = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5
          const relY = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0.5
          sendToStudentView({ type: 'mouse-click', visualFrame: true, relX, relY })
        }
      } else {
        sendToStudentView({
          type: 'mouse-click',
          xrPx: Math.max(0, w - e.clientX),
          yPx: Math.max(0, Math.min(h, e.clientY)),
        })
      }
    }
    window.addEventListener('mousemove', sendPointerMove)
    window.addEventListener('mousedown', sendPointerClick)
    return () => {
      window.removeEventListener('mousemove', sendPointerMove)
      window.removeEventListener('mousedown', sendPointerClick)
    }
  }, [sendToStudentView, visualFullscreenOpen, quizPopupOpen])

  const openStudentView = useCallback(() => {
    const existing = studentViewWindowRef.current
    if (existing && !existing.closed) {
      existing.focus()
      const send = () => {
        try {
          if (!existing.closed) {
            existing.postMessage(
              {
                type: 'curriculum-data',
                content,
                topic,
                currentIndex,
                curriculumId: curriculumId ?? null,
                slideMode: slideMode ?? null,
                personalViewSubMode,
                hasOriginalSlides,
                slides: slides.map((s) => ({
                  title: s.title,
                  blocks: s.blocks ?? [],
                  teacherNotes: s.teacherNotes ?? '',
                  imageUrl: s.imageUrl,
                  visualEmbed: s.visualEmbed,
                  visualLayout: s.visualLayout,
                  visualCells: s.visualCells,
                })),
                teacherTimerSeconds,
                teacherTimerRunning,
              },
              window.location.origin
            )
          }
        } catch { /* ignore */ }
      }
      setTimeout(send, 0)
      setTimeout(() => {
        try {
          if (!existing.closed) {
            existing.postMessage({ type: 'presentation-mode', mode: 'slide-interaction' }, window.location.origin)
            if (visualFullscreenOpen) {
              existing.postMessage({ type: 'visual-fullscreen-open', cellIndex: undefined }, window.location.origin)
            }
            existing.postMessage({ type: 'teacher-timer-sync', seconds: teacherTimerSeconds, running: teacherTimerRunning }, window.location.origin)
            existing.postMessage({ type: 'set-teacher-writing-mode', value: remoteTeacherWritingMode }, window.location.origin)
            existing.postMessage({ type: 'set-teacher-writing-speed', ms: remoteTeacherWritingSpeedMs }, window.location.origin)
            existing.postMessage({ type: 'set-auto-play', value: remoteAutoPlay }, window.location.origin)
            existing.postMessage({ type: 'set-auto-play-interval', ms: remoteAutoPlayIntervalMs }, window.location.origin)
            existing.postMessage({ type: 'quiz-popup-open', value: quizPopupOpen }, window.location.origin)
            if (quizPopupOpen) {
              const scrollEl = document.querySelector('[data-quiz-popup-scroll]') as HTMLElement | null
              if (scrollEl) existing.postMessage({ type: 'quiz-popup-scroll', scrollTop: scrollEl.scrollTop }, window.location.origin)
            }
          }
        } catch { /* ignore */ }
      }, 100)
      return
    }
    const sw = typeof screen !== 'undefined' ? screen.availWidth || 1920 : 1920
    const sh = typeof screen !== 'undefined' ? screen.availHeight || 1080 : 1080
    const w = window.open(
      '/tao-giao-trinh/xem-slide?t=' + Date.now(),
      'xem-slide',
      `width=${sw},height=${sh},left=0,top=0,scrollbars=no,resizable=yes`
    )
    studentViewWindowRef.current = w
    if (w) {
      const send = () => {
        try {
          if (!w.closed) {
            w.postMessage(
              {
                type: 'curriculum-data',
                content,
                topic,
                currentIndex,
                curriculumId: curriculumId ?? null,
                slideMode: slideMode ?? null,
                personalViewSubMode,
                hasOriginalSlides,
                slides: slides.map((s) => ({
                  title: s.title,
                  blocks: s.blocks ?? [],
                  teacherNotes: s.teacherNotes ?? '',
                  imageUrl: s.imageUrl,
                  visualEmbed: s.visualEmbed,
                  visualLayout: s.visualLayout,
                  visualCells: s.visualCells,
                })),
                teacherTimerSeconds,
                teacherTimerRunning,
              },
              window.location.origin
            )
          }
        } catch {
          /* ignore */
        }
      }
      setTimeout(send, 200)
      setTimeout(send, 700)
      setTimeout(() => {
        try {
          if (!w.closed) {
            w.postMessage({ type: 'presentation-mode', mode: 'slide-interaction' }, window.location.origin)
            if (visualFullscreenOpen) {
              w.postMessage({ type: 'visual-fullscreen-open', cellIndex: undefined }, window.location.origin)
            }
            w.postMessage({ type: 'teacher-timer-sync', seconds: teacherTimerSeconds, running: teacherTimerRunning }, window.location.origin)
            w.postMessage({ type: 'set-teacher-writing-mode', value: remoteTeacherWritingMode }, window.location.origin)
            w.postMessage({ type: 'set-teacher-writing-speed', ms: remoteTeacherWritingSpeedMs }, window.location.origin)
            w.postMessage({ type: 'set-auto-play', value: remoteAutoPlay }, window.location.origin)
            w.postMessage({ type: 'set-auto-play-interval', ms: remoteAutoPlayIntervalMs }, window.location.origin)
            w.postMessage({ type: 'quiz-popup-open', value: quizPopupOpen }, window.location.origin)
            if (quizPopupOpen) {
              const scrollEl = document.querySelector('[data-quiz-popup-scroll]') as HTMLElement | null
              if (scrollEl) w.postMessage({ type: 'quiz-popup-scroll', scrollTop: scrollEl.scrollTop }, window.location.origin)
            }
          }
        } catch { /* ignore */ }
      }, 1000)
    }
  }, [content, topic, currentIndex, curriculumId, slideMode, personalViewSubMode, hasOriginalSlides, slides, teacherTimerSeconds, teacherTimerRunning, remoteTeacherWritingMode, remoteTeacherWritingSpeedMs, remoteAutoPlay, remoteAutoPlayIntervalMs, visualFullscreenOpen, quizPopupOpen])

  const applyEmbedToSlide = useCallback((sl: SlideItem, marker: string, placement: EmbedPlacement = 'end'): SlideItem => {
    const blocks = (Array.isArray(sl.blocks) && sl.blocks.length > 0) ? sl.blocks : parseContentToBlocks(sl.content ?? '')
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
    return { ...sl, blocks: newBlocks, content: '' }
  }, [tr])

  const handleInsertEmbed = useCallback((marker: string, placement: EmbedPlacement = 'end', alsoApplyToSlideIndices?: number[]) => {
    const indicesToUpdate = new Set([currentIndex, ...(alsoApplyToSlideIndices ?? [])])
    const updatedSlides = slides.map((sl, i) =>
      indicesToUpdate.has(i) ? applyEmbedToSlide(sl, marker, placement) : sl
    )
    setSlides(updatedSlides)
    if (curriculumId) void persistSlidesRef.current(updatedSlides)
    if (window.opener) window.opener.postMessage({ type: 'insert-embed', marker, placement, alsoApplyToSlideIndices: alsoApplyToSlideIndices }, window.location.origin)
    sendToStudentView({ type: 'insert-embed', marker, placement, alsoApplyToSlideIndices: alsoApplyToSlideIndices })
    sendCurriculumDataToStudent(updatedSlides)
    const count = indicesToUpdate.size
    if (count > 1) toast({ title: tr(`Đã chèn vào ${count} slide`, `Inserted into ${count} slides`, `已插入到${count}张幻灯片`, `${count}スライドに挿入`, `${count}개 슬라이드에 삽입`), duration: 1500 })
  }, [currentIndex, slides, curriculumId, applyEmbedToSlide, sendToStudentView, sendCurriculumDataToStudent, toast, tr])

  const handleReplaceSlideImage = useCallback((markerOrUrl: string, alsoApplyToSlideIndices?: number[], layout: 1 | 2 | 4 = 1, cellIndex?: number) => {
    const isEmbed = markerOrUrl.trim().startsWith('[')
    const cell: VisualCell = isEmbed ? { visualEmbed: markerOrUrl } : { imageUrl: markerOrUrl }
    const indicesToUpdate = new Set([currentIndex, ...(alsoApplyToSlideIndices ?? [])])
    const updatedSlides = slides.map((sl, i) => {
      if (!indicesToUpdate.has(i)) return sl
      const numCells = layout === 1 ? 1 : layout === 2 ? 2 : 4
      let cells: VisualCell[] = [...(sl.visualCells ?? [])]
      if (cells.length !== numCells) cells = Array.from({ length: numCells }, (_, j) => cells[j] ?? {})
      if (cellIndex !== undefined && cellIndex >= 0) {
        cells[cellIndex] = cell
      } else {
        cells = Array(numCells).fill(cell).map((c) => ({ ...c }))
      }
      return {
        ...sl,
        visualLayout: layout,
        visualCells: cells,
        visualEmbed: layout === 1 ? (isEmbed ? markerOrUrl : undefined) : undefined,
        imageUrl: layout === 1 ? (isEmbed ? undefined : markerOrUrl) : undefined,
      }
    })
    setSlides(updatedSlides)
    if (curriculumId) void persistSlidesRef.current(updatedSlides)
    if (window.opener) window.opener.postMessage({ type: 'replace-slide-image', markerOrUrl, alsoApplyToSlideIndices: alsoApplyToSlideIndices, layout, cellIndex }, window.location.origin)
    sendToStudentView({ type: 'replace-slide-image', markerOrUrl, alsoApplyToSlideIndices: alsoApplyToSlideIndices, layout, cellIndex })
    sendCurriculumDataToStudent(updatedSlides)
    const count = indicesToUpdate.size
    toast({ title: count > 1 ? tr(`Đã thay visual ${count} slide`, `Visual replaced on ${count} slides`, `已替换${count}张幻灯片视觉`, `${count}スライドのビジュアルを差し替え`, `${count}개 슬라이드 비주얼 교체됨`) : tr('Đã thay visual slide', 'Slide visual replaced', '已替换幻灯片视觉', 'スライドのビジュアルを差し替えました', '슬라이드 비주얼 교체됨'), duration: 1500 })
  }, [currentIndex, slides, curriculumId, sendToStudentView, sendCurriculumDataToStudent, toast, tr])

  const handleDeleteVisual = useCallback((alsoApplyToSlideIndices?: number[]) => {
    const indicesToUpdate = new Set([currentIndex, ...(alsoApplyToSlideIndices ?? [])])
    const updatedSlides = slides.map((sl, i) =>
      indicesToUpdate.has(i)
        ? { ...sl, visualEmbed: undefined, imageUrl: undefined, visualLayout: 1 as 1 | 2 | 4, visualCells: undefined }
        : sl
    )
    setSlides(updatedSlides)
    if (curriculumId) void persistSlidesRef.current(updatedSlides)
    if (window.opener) window.opener.postMessage({ type: 'delete-visual', alsoApplyToSlideIndices: alsoApplyToSlideIndices }, window.location.origin)
    sendToStudentView({ type: 'delete-visual', alsoApplyToSlideIndices: alsoApplyToSlideIndices })
    sendCurriculumDataToStudent(updatedSlides)
    toast({ title: tr('Đã xóa visual', 'Visual deleted', '已删除视觉', 'ビジュアルを削除', '비주얼 삭제됨'), duration: 1500 })
  }, [currentIndex, slides, curriculumId, sendToStudentView, sendCurriculumDataToStudent, toast, tr])

  const handleDeleteSlide = useCallback(() => {
    if (slides.length <= 1) return
    const idx = currentIndex
    const next = slides.filter((_, i) => i !== idx)
    const newIdx = idx >= 1 ? idx - 1 : 0
    setSlides(next)
    setCurrentIndex(newIdx)
    if (curriculumId) void persistSlidesRef.current(next)
    if (window.opener) window.opener.postMessage({ type: 'delete-slide', index: idx }, window.location.origin)
    sendToStudentView({ type: 'delete-slide', index: idx })
    sendCurriculumDataToStudent(next, newIdx)
    toast({ title: tr('Đã xóa slide', 'Slide deleted', '已删除幻灯片', 'スライドを削除', '슬라이드 삭제됨'), duration: 1500 })
  }, [currentIndex, slides, curriculumId, sendToStudentView, sendCurriculumDataToStudent, toast, tr])

  const sendNotesToParent = useCallback((value: string) => {
    if (window.opener) window.opener.postMessage({ type: 'update-notes', slideIndex: currentIndex, teacherNotes: value }, window.location.origin)
  }, [currentIndex])

  const sendMergeSlides = useCallback((index: number) => {
    setSlides((prev) => {
      if (index < 0 || index >= prev.length - 1) return prev
      const a = prev[index]
      const b = prev[index + 1]
      const merged: SlideItem = {
        ...a,
        blocks: [...(a.blocks ?? []), ...(b.blocks ?? [])],
        teacherNotes: (a.teacherNotes || '') + (b.teacherNotes ? '\n\n' + b.teacherNotes : ''),
      }
      const next = [...prev.slice(0, index), merged, ...prev.slice(index + 2)]
      if (curriculumId) void persistSlidesRef.current(next)
      if (window.opener) window.opener.postMessage({ type: 'merge-slides', index }, window.location.origin)
      try {
        const w = studentViewWindowRef.current
        if (w && !w.closed) w.postMessage({ type: 'merge-slides', index }, window.location.origin)
      } catch { /* ignore */ }
      return next
    })
    setCurrentIndex((i) => (i === index + 1 ? index : i > index + 1 ? i - 1 : i))
    toast({ title: tr('Đã gộp 2 slide', 'Merged 2 slides', '已合并2张幻灯片', '2スライドを結合', '2개 슬라이드 병합'), duration: 1500 })
  }, [curriculumId, toast, tr])

  const sendSplitSlide = useCallback((index: number, splitAtBlock: number) => {
    let nextIndex = index
    setSlides((prev) => {
      const s = prev[index]
      const blks = Array.isArray(s?.blocks) ? s.blocks : (s?.content ? parseContentToBlocks(s.content) : [])
      let firstBlocks: typeof blks
      let secondBlocks: typeof blks
      let secondHeader: string
      if (splitAtBlock === -1 && blks.length === 1) {
        const singleBlock = blks[0]
        const content = singleBlock?.content ?? ''
        const split = splitBlockContentAtQuizBoundary(content)
        if (!split) return prev
        firstBlocks = [{ header: singleBlock?.header ?? 'Nội dung', content: split.before }]
        secondBlocks = [{ header: singleBlock?.header ?? s.title, content: split.after }]
        secondHeader = singleBlock?.header ?? s.title
      } else if (splitAtBlock >= 0 && splitAtBlock < blks.length - 1) {
        firstBlocks = blks.slice(0, splitAtBlock + 1)
        secondBlocks = blks.slice(splitAtBlock + 1)
        secondHeader = secondBlocks[0]?.header ?? s.title
      } else {
        return prev
      }
      const slide1: SlideItem = { ...s, blocks: firstBlocks }
      const slide2: SlideItem = { ...s, title: secondHeader, blocks: secondBlocks, teacherNotes: '', imageUrl: undefined, visualEmbed: undefined, visualLayout: undefined, visualCells: undefined }
      const next = [...prev.slice(0, index), slide1, slide2, ...prev.slice(index + 1)]
      if (curriculumId) void persistSlidesRef.current(next)
      if (window.opener) window.opener.postMessage({ type: 'split-slide', index, splitAtBlock }, window.location.origin)
      try {
        const w = studentViewWindowRef.current
        if (w && !w.closed) w.postMessage({ type: 'split-slide', index, splitAtBlock }, window.location.origin)
      } catch { /* ignore */ }
      return next
    })
    setCurrentIndex((i) => (i > index ? i + 1 : i))
    setSplitAtBlock(null)
    toast({ title: tr('Đã tách slide', 'Split slide', '已拆分幻灯片', 'スライドを分割', '슬라이드 분할'), duration: 1500 })
  }, [curriculumId, toast, tr])

  /** splitAtBlock: -1 = tách tại ranh giới quiz (khi 1 block có quiz + nội dung sau) */
  const sendSplitAtQuiz = useCallback((index: number) => {
    sendSplitSlide(index, -1)
  }, [sendSplitSlide])

  const handleGenerateQuiz = useCallback(async (slideIndex: number, difficulty: 'easy' | 'medium' | 'hard' = 'medium') => {
    const s = slides[slideIndex]
    if (!s) return
    setQuizGenLoading(slideIndex)
    setQuizDifficultyPopoverSlide(null)
    try {
      const blocks = s.blocks ?? parseContentToBlocks((s as { content?: string }).content ?? '')
      const existingCount = getQuizCount(blocks)
      if (existingCount >= 1) return
      const body = {
        title: s.title,
        content: blocks.map((b) => b?.content ?? '').join('\n\n'),
        blocks: blocks.map((b) => ({ header: b?.header, content: b?.content ?? '' })),
        difficulty,
        lessonContext: {
          topic,
          allSlideTitles: slides.map((sl) => sl.title || 'Slide'),
          currentSlideIndex: slideIndex,
          totalSlides: slides.length,
        },
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
      const updated = slides.map((sl, i) => (i === slideIndex ? { ...sl, blocks: newBlocks } : sl))
      setSlides(updated)
      if (curriculumId) void persistSlidesRef.current(updated)
      sendCurriculumDataToStudent(updated)
    } finally {
      setQuizGenLoading(null)
    }
  }, [slides, topic, curriculumId, sendCurriculumDataToStudent])

  const sendUpdateSlideBlocks = useCallback((slideIndex: number, blocks: Array<{ header?: string; content?: string }>) => {
    if (window.opener) window.opener.postMessage({ type: 'update-slide-blocks', slideIndex, blocks }, window.location.origin)
  }, [])

  const updateSlideBlocksAndPersist = useCallback((slideIndex: number, newBlocks: Array<{ header?: string; content?: string }>, contentOverride?: string) => {
    const updated = slides.map((sl, i) =>
      i === slideIndex ? { ...sl, blocks: newBlocks, ...(contentOverride !== undefined ? { content: contentOverride } : {}) } : sl
    )
    setSlides(updated)
    if (curriculumId) void persistSlidesRef.current(updated)
    sendUpdateSlideBlocks(slideIndex, newBlocks)
    sendCurriculumDataToStudent(updated)
  }, [slides, curriculumId, sendUpdateSlideBlocks, sendCurriculumDataToStudent])

  const handleRemoveEmbed = useCallback((slideIndex: number, blockIndex: number, rawMarker: string) => {
    const s = slides[slideIndex]
    if (!s) return
    const blks = s.blocks ?? (s.content ? parseContentToBlocks(s.content) : [])
    const bl = blks[blockIndex]
    const rawContent = bl?.content ?? (blockIndex === 0 && s.content ? s.content : '')
    if (!rawContent?.includes(rawMarker)) return
    const newContent = rawContent.replace(rawMarker, '')
    const newBlocks = blks.length > 0
      ? blks.map((b, j) => (j === blockIndex ? { ...b, content: newContent } : b))
      : parseContentToBlocks(newContent)
    const updated = slides.map((sl, i) => (i === slideIndex ? { ...sl, blocks: newBlocks, content: blks.length === 0 ? newContent : undefined } : sl))
    setSlides(updated)
    if (curriculumId) void persistSlidesRef.current(updated)
    sendUpdateSlideBlocks(slideIndex, newBlocks)
    sendCurriculumDataToStudent(updated)
    toast({ title: tr('Đã xóa nội dung chèn', 'Embed removed', '已删除嵌入内容', '埋め込みを削除', '삽입 내용 삭제됨'), duration: 1500 })
  }, [slides, curriculumId, sendUpdateSlideBlocks, sendCurriculumDataToStudent, toast, tr])

  const handleReplaceEmbed = useCallback((slideIndex: number, blockIndex: number, oldRawMarker: string, newMarker: string) => {
    const s = slides[slideIndex]
    if (!s) return
    const blks = s.blocks ?? (s.content ? parseContentToBlocks(s.content) : [])
    const bl = blks[blockIndex]
    const rawContent = bl?.content ?? (blockIndex === 0 && s.content ? s.content : '')
    if (!rawContent?.includes(oldRawMarker)) return
    const newContent = rawContent.replace(oldRawMarker, newMarker)
    const newBlocks = blks.length > 0
      ? blks.map((b, j) => (j === blockIndex ? { ...b, content: newContent } : b))
      : parseContentToBlocks(newContent)
    const updated = slides.map((sl, i) => (i === slideIndex ? { ...sl, blocks: newBlocks, content: blks.length === 0 ? newContent : undefined } : sl))
    setSlides(updated)
    if (curriculumId) void persistSlidesRef.current(updated)
    sendUpdateSlideBlocks(slideIndex, newBlocks)
    sendCurriculumDataToStudent(updated)
    toast({ title: tr('Đã thay nội dung chèn', 'Embed replaced', '已替换嵌入内容', '埋め込みを差し替え', '삽입 내용 교체됨'), duration: 1500 })
  }, [slides, curriculumId, sendUpdateSlideBlocks, sendCurriculumDataToStudent, toast, tr])

  const reportQuizWrong = useCallback(async (opts: {
    curriculumId: string
    slideIndex: number
    blockIndex: number
    quizMarker: string
    slideTitle: string
    slideContent: string
  }) => {
    const key = `${opts.curriculumId}-${opts.slideIndex}-${opts.blockIndex}-${opts.quizMarker.slice(0, 30)}`
    setQuizReportLoading(key)
    try {
      const res = await fetch('/api/slide-quiz-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curriculumId: opts.curriculumId,
          slideIndex: opts.slideIndex,
          blockIndex: opts.blockIndex,
          quizMarker: opts.quizMarker,
          slideTitle: opts.slideTitle,
          slideContent: opts.slideContent,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: data?.error ?? String(res.status), variant: 'destructive' })
        return
      }
      if (data.action === 'replaced' && data.newMarker) {
        const s = slides[opts.slideIndex]
        const blks = s?.blocks ?? (s?.content ? parseContentToBlocks(s.content) : [])
        const block = blks[opts.blockIndex]
        const rawContent = block?.content ?? (opts.blockIndex === 0 && s?.content ? s.content : '')
        if (rawContent?.includes(opts.quizMarker)) {
          const newContent = rawContent.replace(opts.quizMarker, data.newMarker)
          const newBlocks = blks.length > 0
            ? blks.map((b, j) => (j === opts.blockIndex ? { ...b, content: newContent } : b))
            : parseContentToBlocks(newContent)
          updateSlideBlocksAndPersist(opts.slideIndex, newBlocks, blks.length === 0 ? newContent : undefined)
        }
        toast({ title: tr('Đã thay câu mới', 'Replaced with new question', '已替换为新题目', '新しい問題に置き換えました', '새 문제로 교체됨'), description: data.reasoning?.slice(0, 120), duration: 4000 })
      } else if (data.action === 'kept') {
        toast({ title: tr('AI đã kiểm tra', 'AI checked', 'AI已检查', 'AIが確認しました', 'AI 확인됨'), description: data.reasoning?.slice(0, 120) ?? tr('Câu hỏi đúng theo nội dung. Vui lòng xem lại.', 'Question is correct. Please review.', '题目正确。请复查。', '問題は正しいです。再確認してください。', '문제가 맞습니다. 다시 확인해 주세요.'), duration: 4000 })
      } else if (data.action === 'admin_pending') {
        toast({ title: tr('Đã gửi admin', 'Sent to admin', '已发送给管理员', '管理者に送信しました', '관리자에게 전송됨'), description: data.message ?? '', duration: 3000 })
      }
    } finally {
      setQuizReportLoading(null)
    }
  }, [slides, toast, tr, updateSlideBlocksAndPersist])

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

  const hasShownResolvedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!curriculumId) return
    if (hasShownResolvedRef.current === curriculumId) return
    fetch(`/api/slide-quiz-report?curriculumId=${encodeURIComponent(curriculumId)}&resolved=1`)
      .then((res) => res.json())
      .then((data) => {
        const items = data?.items ?? []
        if (items.length > 0) {
          hasShownResolvedRef.current = curriculumId
          toast({
            title: tr('Báo cáo đã được xử lý', 'Report resolved', '报告已处理', '報告は処理されました', '신고 처리됨'),
            description: tr(
              `Admin đã xử lý ${items.length} báo cáo câu hỏi sai của bạn. Vui lòng xem lại slide.`,
              `Admin has resolved ${items.length} of your quiz reports. Please review the slides.`,
              `管理员已处理您的${items.length}个题目报告。请复查幻灯片。`,
              `管理者が${items.length}件の報告を処理しました。スライドを確認してください。`,
              `관리자가 ${items.length}건의 신고를 처리했습니다. 슬라이드를 확인해 주세요.`
            ),
            duration: 6000,
          })
        }
      })
      .catch(() => {})
  }, [curriculumId, toast, tr])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'request-curriculum' && e.source && content) {
        try {
          const src = e.source as Window
          src.postMessage(
            {
              type: 'curriculum-data',
              content,
              topic,
              currentIndex,
              curriculumId: curriculumId ?? null,
              slideMode: slideMode ?? null,
              personalViewSubMode,
              hasOriginalSlides,
              slides: slides.map((s) => ({
                title: s.title,
                blocks: s.blocks ?? [],
                teacherNotes: s.teacherNotes ?? '',
                imageUrl: s.imageUrl,
                visualEmbed: s.visualEmbed,
                visualLayout: s.visualLayout,
                visualCells: s.visualCells,
              })),
              teacherTimerSeconds,
              teacherTimerRunning,
            },
            window.location.origin
          )
          src.postMessage({ type: 'presentation-mode', mode: 'slide-interaction' }, window.location.origin)
        } catch {
          /* ignore */
        }
      }
      if (e.data?.type === 'visual-fullscreen-close' && e.source === studentViewWindowRef.current) {
        setVisualFullscreenOpen(false)
      }
      if (e.data?.type === 'slide-go' && typeof e.data?.index === 'number' && e.source === studentViewWindowRef.current) {
        const idx = Math.max(0, Math.min(e.data.index, slides.length - 1))
        setCurrentIndex(idx)
      }
      if (e.data?.type === 'quiz-popup-scroll' && e.data?.fromStudent && typeof e.data?.scrollTop === 'number' && e.source === studentViewWindowRef.current && quizPopupOpen) {
        const scrollTop = e.data.scrollTop
        const el = document.querySelector('[data-quiz-popup-scroll]') as HTMLElement | null
        if (el && Math.abs(el.scrollTop - scrollTop) > 2) {
          quizPopupScrollApplyingRef.current = true
          el.scrollTop = scrollTop
          setTimeout(() => { quizPopupScrollApplyingRef.current = false }, 80)
        }
      }
      if (e.data?.type === 'mouse-pos' && e.data?.fromStudent && e.source === studentViewWindowRef.current) {
        if (e.data?.quizPopup && typeof e.data?.relX === 'number' && typeof e.data?.relY === 'number') {
          const el = document.querySelector('[data-quiz-popup]')
          const rect = el ? (el as HTMLElement).getBoundingClientRect() : null
          if (rect) {
            setStudentMousePos({ x: rect.right - e.data.relX, y: rect.top + e.data.relY })
          }
        } else if (typeof e.data?.x === 'number' && typeof e.data?.y === 'number') {
          const w = window.innerWidth || 1
          const h = window.innerHeight || 1
          setStudentMousePos({ x: e.data.x * w, y: e.data.y * h })
        }
      }
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
  }, [content, topic, currentIndex, curriculumId, slideMode, personalViewSubMode, hasOriginalSlides, slides, teacherTimerSeconds, teacherTimerRunning, quizPopupOpen])

  useEffect(() => {
    setNotesValue(slides[currentIndex]?.teacherNotes ?? '')
    setSplitAtBlock(null)
  }, [currentIndex, slides])

  const handleBlur = useCallback(() => {
    setSlides((prev) => {
      const next = prev.map((s, i) => (i === currentIndex ? { ...s, teacherNotes: notesValue } : s))
      if (curriculumId) void persistSlidesRef.current(next)
      return next
    })
    sendNotesToParent(notesValue)
  }, [notesValue, currentIndex, curriculumId, sendNotesToParent])

  const refreshProposals = useCallback(() => {
    if (!curriculumId) return
    getSlideProposalsForCurriculum(curriculumId).then((res) => {
      if (res?.success && res.items) {
        setProposals(res.items)
        setCurrentUserId(res.currentUserId ?? null)
      }
    })
  }, [curriculumId])

  const sendUpdateSlideTitle = useCallback((slideIndex: number, title: string) => {
    if (window.opener) window.opener.postMessage({ type: 'update-slide-title', slideIndex, title }, window.location.origin)
  }, [])

  const sendPersonalViewSubMode = useCallback((value: 'current' | 'original') => {
    if (window.opener) window.opener.postMessage({ type: 'set-personal-view-submode', value }, window.location.origin)
    setPersonalViewSubMode(value)
  }, [])

  const sendSaveNow = useCallback(() => {
    if (window.opener) {
      window.opener.postMessage({ type: 'save-slides-now' }, window.location.origin)
    } else if (curriculumId && slides.length > 0) {
      void persistSlidesRef.current(slides)
    }
  }, [curriculumId, slides])

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
  const tripleIdxPrev = currentIndex - 1
  const tripleIdxCur = currentIndex
  const tripleIdxNext = currentIndex + 1

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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeTeacherVisualFullscreen() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visualFullscreenOpen, closeTeacherVisualFullscreen])

  return (
    <div className={cn('fixed inset-0 z-50 h-screen w-screen overflow-x-hidden overflow-y-auto bg-slate-950 text-white flex flex-col', !isMobile && clipLeft ? 'items-end' : 'items-stretch')}>
      {/* Desktop: layoutWidth khi thu hẹp. Mobile: luôn full width */}
      <div className="flex-1 flex flex-col min-h-0 shrink-0 w-full" style={!isMobile && clipLeft ? { width: layoutWidth, minWidth: layoutWidth, maxWidth: layoutWidth } : undefined}>
      {/* Thanh điều khiển đặt trên cùng để trùng tọa độ với màn học sinh */}
      <div className="shrink-0 border-b border-slate-700/80 bg-slate-900/80 backdrop-blur-sm">
        <PresentationControlBar
          variant="teacher"
          tr={tr}
          currentIndex={currentIndex}
          totalSlides={slideTitles.length || slides.length}
          teacherTimerSeconds={teacherTimerSeconds}
          teacherTimerRunning={teacherTimerRunning}
          onTeacherTimerStart={() => sendTeacherTimer('teacher-timer-start')}
          onTeacherTimerStop={() => sendTeacherTimer('teacher-timer-stop')}
          onTeacherTimerReset={() => sendTeacherTimer('teacher-timer-reset')}
          teacherTimerInteractive
          curriculumId={curriculumId ?? undefined}
          onInsertClick={() => { setEmbedDialogInitialMode('insert'); setEmbedReplaceContext(null); setEmbedDialogOpen(true) }}
          writingMode={remoteTeacherWritingMode}
          onWritingModeToggle={() => { setRemoteTeacherWritingMode((v) => !v); sendToStudentView({ type: 'set-teacher-writing-mode', value: !remoteTeacherWritingMode }) }}
          writingSpeedMs={remoteTeacherWritingSpeedMs}
          onWritingSpeedChange={(ms) => { setRemoteTeacherWritingSpeedMs(ms); sendToStudentView({ type: 'set-teacher-writing-speed', ms }) }}
          autoPlay={remoteAutoPlay}
          onAutoPlayToggle={() => { setRemoteAutoPlay((v) => !v); sendToStudentView({ type: 'set-auto-play', value: !remoteAutoPlay }) }}
          autoPlayIntervalMs={remoteAutoPlayIntervalMs}
          onAutoPlayIntervalChange={(ms) => { setRemoteAutoPlayIntervalMs(ms); sendToStudentView({ type: 'set-auto-play-interval', ms }) }}
          sandTimerSeconds={0}
          sandTimerRunning={false}
          onSandTimerStart={(sec) => sendToStudentView({ type: 'sand-timer-start', seconds: sec })}
          onPrev={() => sendSlideControl('slide-prev')}
          onNext={() => sendSlideControl('slide-next')}
          slideViewMode={slideViewMode}
          onSlideViewModeChange={(m) => setSlideViewMode(m)}
          onOpenStudentView={slides.length > 0 ? openStudentView : undefined}
          hideIndex
          hideInsert
        />
      </div>

      <header className="shrink-0 border-b border-slate-700/80 bg-slate-900/80 backdrop-blur-sm flex flex-col">
        {/* Hàng thông tin – mobile: wrap, desktop: flex-nowrap */}
        <div className="px-3 md:px-5 py-2 flex items-center justify-end gap-2 md:gap-3 flex-wrap md:flex-nowrap landscape:flex-nowrap min-w-0 overflow-x-hidden">
          <div className="flex items-center gap-2 md:gap-3 flex-wrap md:flex-nowrap landscape:flex-nowrap shrink-0">
            <span className="text-xs md:text-sm font-medium tabular-nums shrink-0 text-slate-300">{currentIndex + 1}/{slideTitles.length || slides.length}</span>
            <h1 className="text-sm md:text-base font-semibold text-amber-400/95 tracking-tight">{tr('Giáo trình + Ghi chú', 'Curriculum + Notes', '课程+备注', 'カリキュラム+メモ', '교육과정+메모')}</h1>
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
                    <button type="button" onClick={() => sendPersonalViewSubMode('current')} className={['px-2.5 py-1.5 text-xs font-medium transition-colors flex items-center gap-1', personalViewSubMode === 'current' ? 'bg-violet-500/30 text-violet-200 border-r border-slate-600/60' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'].join(' ')} title={tr('Bản bạn đang chỉnh sửa', 'Your edited version', '您编辑的版本', '編集中の版', '편집 중인 버전')}>
                      <FileEdit className="h-3.5 w-3.5" />
                      {tr('Bản hiện tại', 'Current', '当前', '現在', '현재')}
                    </button>
                    <button type="button" onClick={() => sendPersonalViewSubMode('original')} className={['px-2.5 py-1.5 text-xs font-medium transition-colors flex items-center gap-1', personalViewSubMode === 'original' ? 'bg-slate-600/50 text-slate-200' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'].join(' ')} title={tr('Bản gốc AI tạo', 'Original AI version', 'AI原始版本', 'AIオリジナル', 'AI 원본')}>
                      <FileText className="h-3.5 w-3.5" />
                      {tr('Bản gốc', 'Original', '原版', 'オリジナル', '원본')}
                    </button>
                  </div>
                )}
                {curriculumId && personalViewSubMode === 'current' && (
                  <button type="button" onClick={sendSaveNow} className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-emerald-500/25 text-emerald-200 border border-emerald-400/40 hover:bg-emerald-500/35 flex items-center gap-1.5 transition-colors" title={tr('Lưu bản riêng', 'Save personal version', '保存个人版本', '個人版を保存', '개인 버전 저장')}>
                    <Save className="h-3.5 w-3.5" />
                    {tr('Lưu', 'Save', '保存', '保存', '저장')}
                  </button>
                )}
                {curriculumId && personalViewSubMode === 'original' && (
                  <button type="button" onClick={() => void handleResetToOriginal()} disabled={resetLoading} className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-amber-500/25 text-amber-200 border border-amber-400/40 hover:bg-amber-500/35 flex items-center gap-1.5 transition-colors disabled:opacity-50" title={tr('Reset bản riêng về bản gốc', 'Reset personal to original', '将个人版重置为原版', '原版にリセット', '원본으로 리셋')}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    {resetLoading ? tr('Đang reset...', 'Resetting...', '重置中...', 'リセット中...', '리셋 중...') : tr('Reset về bản gốc', 'Reset to original', '重置为原版', '原版にリセット', '원본으로 리셋')}
                  </button>
                )}
                {curriculumId && slideMode === 'personal' && (
                  <button type="button" onClick={() => setPersonalHistoryOpen(true)} className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-600/40 text-slate-200 border border-slate-500/50 hover:bg-slate-600/60 flex items-center gap-1.5 transition-colors" title={tr('Lịch sử bản riêng', 'Personal history', '个人历史', '個人履歴', '개인 기록')}>
                    <History className="h-3.5 w-3.5" />
                    {tr('Lịch sử', 'History', '历史', '履歴', '기록')}
                  </button>
                )}
              </div>
            )}
            {slideMode === 'shared' && curriculumId && (
              <button type="button" onClick={() => setSharedHistoryOpen(true)} className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-600/40 text-slate-200 border border-slate-500/50 hover:bg-slate-600/60 flex items-center gap-1.5 transition-colors" title={tr('Lịch sử chỉnh sửa bản chung', 'Shared version edit history', '共享版本编辑历史', '共有版の編集履歴', '공유 버전 편집 기록')}>
                <History className="h-3.5 w-3.5" />
                {tr('Lịch sử', 'History', '历史', '履歴', '기록')}
              </button>
            )}
            {topic && <span className="text-slate-400 text-sm truncate max-w-[180px]" title={topic}>{topic}</span>}
          </div>
        </div>
      </header>

      {!content ? (
        <div className="flex-1 flex items-center justify-center p-8 bg-slate-900/30">
          <div className="text-center space-y-6 max-w-sm">
            <p className="text-slate-400 text-sm leading-relaxed">{tr('Mở giáo trình từ trang Tạo giáo trình (bấm "Xem slide" hoặc "Xem giáo trình").', 'Open curriculum from Create curriculum page (click "View slides" or "View curriculum").', '从创建课程页面打开课程（点击"查看幻灯片"或"查看课程"）。', '作成ページからカリキュラムを開く（「スライド表示」または「カリキュラムを見る」をクリック）。', '교육과정 생성 페이지에서 열기 ("슬라이드 보기" 또는 "교육과정 보기" 클릭).')}</p>
            <button type="button" onClick={requestCurriculum} className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium text-sm transition-colors shadow-lg shadow-amber-500/20">
              {tr('Tải giáo trình', 'Load curriculum', '加载课程', 'カリキュラムを読み込む', '교육과정 로드')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row landscape:flex-row min-h-0 overflow-hidden isolate shrink-0 w-full">
          <div className={cn('shrink-0 flex flex-col overflow-hidden isolate bg-slate-900/20 border-r border-slate-700/60 w-full md:w-1/2 landscape:w-1/2', leftPanelMode === 'visual' && 'md:w-[45%] landscape:w-[45%]')}>
            {leftPanelMode !== 'visual' && (
              <div className="px-3 md:px-4 py-2 md:py-2.5 text-slate-400 text-xs font-medium uppercase tracking-wider border-b border-slate-700/60 shrink-0 flex items-center justify-between gap-2 flex-wrap md:flex-nowrap landscape:flex-nowrap">
                <span>{leftPanelMode === 'curriculum' ? tr('Giáo trình', 'Curriculum', '课程', 'カリキュラム', '교육과정') : tr('Slide hiện tại', 'Current slide', '当前幻灯片', '表示中のスライド', '표시 중 슬라이드')}</span>
                <div className="flex items-center gap-2">
                  {(leftPanelMode === 'slide') && extractQuizFromSlide(slides[currentIndex] ?? {}).length > 0 && (
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
                    <button type="button" onClick={() => setLeftPanelMode('curriculum')} className={['px-3 py-2 md:px-2.5 md:py-1 text-[11px] font-medium transition-colors min-h-[44px] md:min-h-0 flex items-center', leftPanelMode === 'curriculum' ? 'bg-amber-500/30 text-amber-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'].join(' ')}>
                      {tr('Giáo trình', 'Curriculum', '课程', 'カリキュラム', '교육과정')}
                    </button>
                    <button type="button" onClick={() => setLeftPanelMode('slide')} className={['px-3 py-2 md:px-2.5 md:py-1 text-[11px] font-medium transition-colors min-h-[44px] md:min-h-0 flex items-center', leftPanelMode === 'slide' ? 'bg-amber-500/30 text-amber-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'].join(' ')}>
                      {tr('Slide', 'Slide', '幻灯片', 'スライド', '슬라이드')}
                    </button>
                    <button type="button" onClick={() => setLeftPanelMode('visual')} className={['px-3 py-2 md:px-2.5 md:py-1 text-[11px] font-medium transition-colors min-h-[44px] md:min-h-0 flex items-center', (leftPanelMode as string) === 'visual' ? 'bg-amber-500/30 text-amber-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'].join(' ')}>
                      {tr('Visual', 'Visual', '视觉', 'ビジュアル', '비주얼')}
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className={cn('flex-1 overflow-y-scroll overflow-x-hidden overscroll-y-contain p-4 space-y-3 pr-2 scroll-smooth min-h-0 text-left', (leftPanelMode as string) === 'visual' && 'p-0 pr-0 space-y-0 overflow-hidden')}>
              {leftPanelMode === 'visual' ? (
                (() => {
                  const s = slides[currentIndex]
                  if (!s) return <p className="text-slate-500 text-sm">{tr('Không có slide', 'No slide', '无幻灯片', 'スライドなし', '슬라이드 없음')}</p>
                  const { layout, cells } = getVisualCells(s)
                  const hasAny = cells.some((c) => c.visualEmbed || c.imageUrl)
                  const slideNum = currentIndex + 1
                  const gradient = DARK_GRADIENTS[currentIndex % DARK_GRADIENTS.length]
                  const gridClass = layout === 2 ? 'grid grid-rows-2 gap-1' : layout === 4 ? 'grid grid-cols-2 grid-rows-2 gap-1' : ''
                  return (
                    <div className="h-full w-full relative overflow-hidden" style={{ background: gradient }}>
                      <div className="absolute top-3 right-3 z-20 flex items-center rounded-lg border border-slate-600/80 overflow-hidden bg-slate-900/70">
                        <button type="button" onClick={() => setLeftPanelMode('curriculum')} className="px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-700/50">{tr('Giáo trình', 'Curriculum', '课程', 'カリキュラム', '교육과정')}</button>
                        <button type="button" onClick={() => setLeftPanelMode('slide')} className="px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-700/50">{tr('Slide', 'Slide', '幻灯片', 'スライド', '슬라이드')}</button>
                        <button type="button" onClick={() => setLeftPanelMode('visual')} className="px-2 py-1 text-[10px] bg-amber-500/30 text-amber-300">{tr('Visual', 'Visual', '视觉', 'ビジュアル', '비주얼')}</button>
                        {hasAny && (
                          <button
                            type="button"
                            onClick={() => openTeacherVisualFullscreen()}
                            className="px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-700/50 border-l border-slate-600/70"
                            title={tr('Mở rộng tất cả', 'Expand all', '展开全部', 'すべて展開', '모두 확장')}
                          >
                            <Maximize2 className="h-3 w-3" />
                          </button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" className="px-2 py-1 text-slate-300 hover:bg-slate-700/50 border-l border-slate-600/70" title={tr('Tùy chọn', 'Options', '选项', 'オプション', '옵션')}>
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="z-[120]">
                            <DropdownMenuItem onClick={() => { setEmbedDialogInitialMode('replaceImage'); setEmbedReplaceContext(null); setEmbedDialogOpen(true) }} className="cursor-pointer gap-3">
                              <RefreshCw className="h-4 w-4 shrink-0" />
                              {tr('Thay', 'Replace', '替换', '差し替え', '교체')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteVisual()} disabled={!hasAny} className="text-rose-600 focus:text-rose-600 dark:text-rose-400 cursor-pointer gap-3">
                              <Trash2 className="h-4 w-4 shrink-0" />
                              {tr('Xóa visual', 'Delete visual', '删除视觉', 'ビジュアル削除', '비주얼 삭제')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="absolute top-4 left-4 w-9 h-9 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-sm shadow-lg z-10">
                        {slideNum}
                      </div>
                      <div className={cn('absolute inset-0 pt-14 pb-4 px-4', layout === 1 ? 'flex flex-col' : gridClass)}>
                        {layout === 1 ? (
                          <div className="flex-1 min-h-0 relative rounded-lg overflow-hidden bg-black/30 border border-white/10">
                            <span className="absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs font-mono">
                              {slideNum}-1
                            </span>
                            {cells[0]?.visualEmbed ? (
                              (() => {
                                const embeds = parseContentEmbeds(cells[0].visualEmbed)
                                const first = embeds[0]
                                if (!first) return <div className="w-full h-full" />
                                return <div className="w-full h-full"><ContentEmbed type={first.type} urlOrId={first.urlOrId} tr={tr} hideQuiz fill className="!my-0 !rounded-lg !border-0" /></div>
                              })()
                            ) : cells[0]?.imageUrl ? (
                              <img src={cells[0].imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><div className="w-8 h-8 rounded bg-white/5" /></div>
                            )}
                          </div>
                        ) : (
                          <>
                            {cells.map((cell, idx) => (
                              <div key={idx} className="relative rounded-lg overflow-hidden bg-black/30 border border-white/10 min-h-0 group">
                                <span className="absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs font-mono">
                                  {slideNum}-{idx + 1}
                                </span>
                                {(cell.visualEmbed || cell.imageUrl) && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); openTeacherVisualFullscreen(idx) }}
                                    className="absolute top-1 right-1 z-10 opacity-50 group-hover:opacity-100 p-1 rounded bg-black/60 text-white hover:bg-black/80 transition-opacity"
                                    title={tr('Mở rộng ô này', 'Expand this cell', '展开此格', 'このセルを展開', '이 셀 확장')}
                                  >
                                    <Maximize2 className="h-3 w-3" />
                                  </button>
                                )}
                                {cell.visualEmbed ? (
                                  (() => {
                                    const embeds = parseContentEmbeds(cell.visualEmbed)
                                    const first = embeds[0]
                                    if (!first) return <div className="w-full h-full" />
                                    return <div className="w-full h-full"><ContentEmbed type={first.type} urlOrId={first.urlOrId} tr={tr} hideQuiz fill className="!my-0 !rounded-lg !border-0" /></div>
                                  })()
                                ) : cell.imageUrl ? (
                                  <img src={cell.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center"><div className="w-8 h-8 rounded bg-white/5" /></div>
                                )}
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })()
              ) : leftPanelMode === 'slide' ? (
                (() => {
                  const s = slides[currentIndex]
                  const blks = !s ? [] : (Array.isArray(s.blocks) && s.blocks.length ? s.blocks : s.content ? parseContentToBlocks(s.content ?? '') : [])
                  const isQuizHeader = (h: string) => /câu hỏi|quiz|trắc nghiệm|测验|クイズ|퀴즈/i.test(h ?? '')
                  return (
                    <div className="space-y-4">
                      {/* Tiêu đề slide – ý chính nổi bật */}
                      <div className="pb-3 border-b border-slate-600/60 flex items-start justify-between gap-2">
                        <div>
                          <span className="inline-block px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs font-medium mb-1.5">{currentIndex + 1}/{slides.length}</span>
                          <h2 className="text-base font-semibold text-white leading-snug">{s?.title ?? ''}</h2>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 shrink-0" title={tr('Tùy chọn', 'Options', '选项', 'オプション', '옵션')}>
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="z-[120]">
                            <DropdownMenuItem onClick={() => { setEmbedDialogInitialMode('replaceImage'); setEmbedReplaceContext(null); setEmbedDialogOpen(true) }} className="cursor-pointer gap-3">
                              <RefreshCw className="h-4 w-4 shrink-0" />
                              {tr('Thay', 'Replace', '替换', '差し替え', '교체')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteSlide()} disabled={slides.length <= 1} className="text-rose-600 focus:text-rose-600 dark:text-rose-400 cursor-pointer gap-3">
                              <Trash2 className="h-4 w-4 shrink-0" />
                              {tr('Xóa slide', 'Delete slide', '删除幻灯片', 'スライド削除', '슬라이드 삭제')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {blks.length > 0 ? (
                        <div className="space-y-4">
                          {blks.map((b, i) => {
                            const parts = splitContentWithEmbeds(b.content ?? '')
                            const accent = isQuizHeader(b.header ?? '') ? 'violet' : 'amber'
                            return (
                              <div key={i} className={`rounded-lg overflow-hidden border border-slate-600/60 bg-slate-800/50 flex min-w-0`}>
                                <div className={`w-1 shrink-0 ${accent === 'violet' ? 'bg-violet-500/60' : 'bg-amber-500/60'}`} />
                                <div className="flex-1 min-w-0 p-3 pl-4">
                                  {b.header && (
                                    <span className={`inline-block text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded mb-2 ${accent === 'violet' ? 'bg-violet-500/20 text-violet-300/90' : 'bg-amber-500/20 text-amber-300/90'}`}>
                                      {b.header}
                                    </span>
                                  )}
                                  <div className="text-slate-100 text-[13px] leading-relaxed whitespace-pre-wrap break-words min-w-0 text-left space-y-2">
                                    {parts.map((p, j) => {
                                      if (p.type === 'text') return p.value ? <span key={j} className="block">{p.value}</span> : null
                                      if (p.type === 'embed' && p.embedType === 'quiz') {
                                        const q = parseQuizData(p.urlOrId)
                                        if (!q) return null
                                        return (
                                          <div key={j} className="rounded-lg bg-violet-500/10 border border-violet-400/20 p-3 mt-2">
                                            <p className="text-slate-100 text-[13px] font-medium mb-2">{q.question}</p>
                                            <div className="space-y-1.5">
                                              {q.options.map((opt, k) => (
                                                <div key={k} className={['text-[13px] pl-2.5 py-1 rounded border-l-2', k === q.correctIndex ? 'border-emerald-400 text-emerald-300 bg-emerald-500/10' : 'border-slate-600 text-slate-300'].join(' ')}>
                                                  {String.fromCharCode(65 + k)}. {opt}
                                                  {k === q.correctIndex && <span className="ml-1.5 text-emerald-400/90 text-[11px]">({tr('Đáp án đúng', 'Correct', '正确', '正解', '정답')})</span>}
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
                              </div>
                            )
                          })}
                        </div>
                      ) : s?.content ? (
                        (() => {
                          const parts = splitContentWithEmbeds(s.content)
                          return (
                            <div className="rounded-lg bg-slate-800/50 border border-slate-600/60 p-4">
                              <div className="text-slate-100 text-[13px] leading-relaxed whitespace-pre-wrap break-words min-w-0 text-left space-y-2">
                                {parts.map((p, j) => {
                                  if (p.type === 'text') return p.value ? <span key={j} className="block">{p.value}</span> : null
                                  if (p.type === 'embed' && p.embedType === 'quiz') {
                                    const q = parseQuizData(p.urlOrId)
                                    if (!q) return null
                                    return (
                                      <div key={j} className="rounded-lg bg-violet-500/10 border border-violet-400/20 p-3 mt-2">
                                        <p className="text-slate-100 text-[13px] font-medium mb-2">{q.question}</p>
                                        <div className="space-y-1.5">
                                          {q.options.map((opt, k) => (
                                            <div key={k} className={['text-[13px] pl-2.5 py-1 rounded border-l-2', k === q.correctIndex ? 'border-emerald-400 text-emerald-300 bg-emerald-500/10' : 'border-slate-600 text-slate-300'].join(' ')}>
                                              {String.fromCharCode(65 + k)}. {opt}
                                              {k === q.correctIndex && <span className="ml-1.5 text-emerald-400/90 text-[11px]">({tr('Đáp án đúng', 'Correct', '正确', '正解', '정답')})</span>}
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
                        })()
                      ) : (
                        <p className="text-slate-500 text-sm">{tr('Không có nội dung', 'No content', '无内容', 'コンテンツなし', '내용 없음')}</p>
                      )}
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
          <div className={cn('shrink-0 flex flex-col overflow-hidden isolate w-full md:w-1/2 landscape:w-1/2', leftPanelMode === 'visual' && 'md:w-[55%] landscape:w-[55%]')}>
            <div className="px-4 py-2.5 text-slate-400 text-xs font-medium uppercase tracking-wider border-b border-slate-700/60 shrink-0 bg-slate-900/30">
              {slideViewMode === 'single' ? tr('Slide đang hiển thị', 'Current slide', '当前幻灯片', '表示中のスライド', '표시 중 슬라이드') : tr('3 slide: trước · hiện tại · sau', '3 slides: prev · current · next', '3张: 前·当前·后', '3枚: 前·現在·次', '3장: 이전·현재·다음')}
            </div>
            {slideViewMode === 'single' ? (
              <div className="flex-1 flex items-start justify-start min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain p-3">
                {(() => {
                  const s = slides[currentIndex]
                  const blks = !s ? [] : (Array.isArray(s.blocks) && s.blocks.length ? s.blocks : s.content ? parseContentToBlocks(s.content ?? '') : [])
                  const showDirectEdit = curriculumId && slideMode === 'personal' && personalViewSubMode === 'current'
                  return (
                    <div className="w-full flex flex-col gap-2 items-stretch text-left">
                      {slideMode === 'personal' && personalViewSubMode === 'current' && !curriculumId && (
                        <div className="rounded-lg bg-violet-500/15 border border-violet-400/30 px-4 py-2 text-sm text-violet-200">
                          {tr('Lưu giáo trình vào kho để sửa bản riêng.', 'Save curriculum to library to edit personal version.', '保存课程到库以编辑个人版。', 'カリキュラムを保存して個人版を編集。', '교육과정 저장 후 개인 버전 편집.')}
                        </div>
                      )}
                      <div className="w-full rounded-xl bg-amber-500/10 ring-2 ring-amber-400/40 border border-amber-400/30 p-2.5 shadow-lg flex flex-col">
                        <div className="flex items-center justify-between gap-1.5 mb-2 flex-wrap shrink-0">
                          {editingTitle === currentIndex ? (
                            <div className="flex-1 flex gap-2 items-center flex-wrap min-w-0">
                              <input value={editingTitleValue} onChange={(e) => setEditingTitleValue(e.target.value)} className="flex-1 min-w-[140px] rounded-lg bg-slate-700/80 px-3 py-2 text-amber-300 text-sm font-medium border border-slate-600 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30" placeholder={tr('Tiêu đề slide', 'Slide title', '幻灯片标题', 'スライドタイトル', '슬라이드 제목')} />
                              <button type="button" onClick={() => { setSlides((prev) => { const next = prev.map((sl, j) => j === currentIndex ? { ...sl, title: editingTitleValue } : sl); if (curriculumId) void persistSlidesRef.current(next); return next }); sendUpdateSlideTitle(currentIndex, editingTitleValue); setEditingTitle(null) }} className="text-xs font-medium text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/30">{tr('Lưu', 'Save', '保存', '保存', '저장')}</button>
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
                                {editingTitle !== currentIndex && (
                                  getQuizCount(blks) < 1 ? (
                                    <Popover open={quizDifficultyPopoverSlide === currentIndex} onOpenChange={(o) => setQuizDifficultyPopoverSlide(o ? currentIndex : null)}>
                                      <PopoverTrigger asChild>
                                        <button
                                          type="button"
                                          disabled={quizGenLoading !== null}
                                          className="text-xs text-violet-400 hover:text-violet-300 px-2.5 py-1 rounded-lg bg-violet-500/15 border border-violet-400/30 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                          title={tr('Tạo câu hỏi trắc nghiệm', 'Generate quiz', '生成测验', 'クイズ作成', '퀴즈 생성')}
                                        >
                                          <Sparkles className="h-3.5 w-3.5" />
                                          {quizGenLoading === currentIndex ? tr('Đang tạo...', 'Creating...', '创建中...', '作成中...', '생성 중...') : tr('Tạo câu hỏi', 'Add quiz', '添加测验', 'クイズ追加', '퀴즈 추가')}
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-48 p-2" align="start">
                                        <p className="text-xs font-medium text-foreground mb-2">{tr('Chọn độ khó', 'Select difficulty', '选择难度', '難易度を選択', '난이도 선택')}</p>
                                        <div className="flex flex-col gap-1">
                                          {QUIZ_DIFFICULTIES.map((d) => (
                                            <button
                                              key={d}
                                              type="button"
                                              onClick={() => void handleGenerateQuiz(currentIndex, d)}
                                              className={`text-left text-sm font-medium px-2.5 py-2 rounded-md transition-colors ${
                                                d === 'easy'
                                                  ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                                                  : d === 'medium'
                                                    ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                                                    : 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
                                              }`}
                                            >
                                              {d === 'easy' ? tr('Dễ', 'Easy', '简单', '易しい', '쉬움') : d === 'medium' ? tr('Trung bình', 'Medium', '中等', '普通', '보통') : tr('Khó', 'Hard', '困难', '難しい', '어려움')}
                                            </button>
                                          ))}
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setQuizPopupOpen(true)}
                                      className="text-xs text-violet-400 hover:text-violet-300 px-2.5 py-1 rounded-lg bg-violet-500/15 border border-violet-400/30 flex items-center gap-1.5 transition-colors"
                                      title={tr('Xem câu hỏi trắc nghiệm', 'View quiz', '查看测验', 'クイズを見る', '퀴즈 보기')}
                                    >
                                      <ClipboardList className="h-3.5 w-3.5" />
                                      {tr('Xem câu hỏi', 'View quiz', '查看测验', 'クイズを見る', '퀴즈 보기')}
                                    </button>
                                  )
                                )}
                                {curriculumId && (
                                  <button
                                    type="button"
                                    onClick={() => { setEmbedDialogInitialMode('insert'); setEmbedReplaceContext(null); setEmbedDialogOpen(true) }}
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
                                        updateSlideBlocksAndPersist(currentIndex, newBlocks)
                                        setEditingHeader(null)
                                      }} className="text-xs font-medium text-emerald-400 px-3 py-1.5 rounded-lg bg-emerald-500/20">{tr('Lưu', 'Save', '保存', '保存', '저장')}</button>
                                      <button type="button" onClick={() => setEditingHeader(null)} className="text-xs text-slate-400 hover:text-slate-300 px-2 py-1.5">{tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}</button>
                                    </div>
                                  ) : (
                                    b.header && (
                                      <div className="flex items-center gap-1.5 mb-2">
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
                                          updateSlideBlocksAndPersist(currentIndex, newBlocks)
                                          setEditingBlock(null)
                                        }} className="text-xs font-medium text-emerald-400 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30">{tr('Lưu', 'Save', '保存', '保存', '저장')}</button>
                                        <button type="button" onClick={() => setEditingBlock(null)} className="text-xs text-slate-400 hover:text-slate-300 px-2 py-1.5">{tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="text-slate-200/95 text-sm whitespace-pre-wrap break-words leading-relaxed min-w-0 text-left space-y-2">
                                        {asArray(splitContentWithEmbeds(b.content ?? '')).map((p, j) => {
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
                                            const ep = p as { type: 'embed'; embedType: EmbedType; urlOrId: string; rawMarker: string }
                                            return (
                                              <div key={j} className="rounded-lg overflow-hidden border border-slate-600/60 relative group">
                                                <ContentEmbed type={ep.embedType} urlOrId={ep.urlOrId} width={280} height={160} tr={tr} />
                                                {curriculumId && (showDirectEdit || showProposalUi) && (
                                                  <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                      <button type="button" className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-slate-800/95 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600/60 z-[100] shadow-lg">
                                                        <MoreVertical className="h-3.5 w-3.5" />
                                                      </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" sideOffset={10} className="z-[120]">
                                                      <DropdownMenuItem onSelect={() => { setEmbedReplaceContext({ slideIndex: currentIndex, blockIndex: i, rawMarker: ep.rawMarker, urlOrId: ep.urlOrId, embedType: ep.embedType }); setEmbedDialogInitialMode('insert'); setEmbedDialogOpen(true) }} className="cursor-pointer gap-3">
                                                        <RefreshCw className="h-4 w-4 shrink-0" />
                                                        {tr('Thay', 'Replace', '替换', '差し替え', '교체')}
                                                      </DropdownMenuItem>
                                                      <DropdownMenuItem onSelect={() => handleRemoveEmbed(currentIndex, i, ep.rawMarker)} className="text-rose-600 focus:text-rose-600 dark:text-rose-400 cursor-pointer gap-3">
                                                        <Trash2 className="h-4 w-4 shrink-0" />
                                                        {tr('Xóa', 'Delete', '删除', '削除', '삭제')}
                                                      </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                  </DropdownMenu>
                                                )}
                                              </div>
                                            )
                                          }
                                          return null
                                        })}
                                      </div>
                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        {curriculumId && asArray(splitContentWithEmbeds(b.content ?? '')).some((p) => p.type === 'embed' && p.embedType === 'quiz') && (
                                          asArray(splitContentWithEmbeds(b.content ?? '')).filter((p): p is { type: 'embed'; embedType: 'quiz'; urlOrId: string; rawMarker: string } => p.type === 'embed' && p.embedType === 'quiz').map((p, qIdx) => (
                                            <button
                                              key={qIdx}
                                              type="button"
                                              disabled={!!quizReportLoading}
                                              onClick={() => reportQuizWrong({
                                                curriculumId,
                                                slideIndex: currentIndex,
                                                blockIndex: i,
                                                quizMarker: p.rawMarker,
                                                slideTitle: s?.title ?? '',
                                                slideContent: (blks ?? []).map((bl) => (bl.header ? `### ${bl.header}\n\n` : '') + (bl.content ?? '')).join('\n\n'),
                                              })}
                                              className="text-xs font-medium text-rose-300 hover:text-rose-200 px-2 py-1 rounded-lg bg-rose-500/20 border border-rose-400/30 flex items-center gap-1 transition-colors disabled:opacity-50"
                                            >
                                              <Flag className="h-3.5 w-3.5" />
                                              {tr('Báo câu hỏi sai', 'Report wrong question', '报告题目错误', '問題が間違っていると報告', '문제 오류 신고')}
                                            </button>
                                          ))
                                        )}
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
                                updateSlideBlocksAndPersist(currentIndex, newBlocks)
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
                                      updateSlideBlocksAndPersist(currentIndex, newBlocks, '')
                                      setEditingBlock(null)
                                    }} className="text-xs text-emerald-400 px-2 py-1">{tr('Lưu', 'Save', '保存', '保存', '저장')}</button>
                                    <button type="button" onClick={() => setEditingBlock(null)} className="text-xs text-slate-400">{tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="text-slate-200 text-sm whitespace-pre-wrap break-words leading-relaxed min-w-0 text-left space-y-2">
                                    {asArray(splitContentWithEmbeds(s.content ?? '')).map((p, j) => {
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
                                        const ep = p as { type: 'embed'; embedType: EmbedType; urlOrId: string; rawMarker: string }
                                        return (
                                          <div key={j} className="rounded-lg overflow-hidden border border-slate-600/60 relative group">
                                            <ContentEmbed type={ep.embedType} urlOrId={ep.urlOrId} width={280} height={160} tr={tr} />
                                            {curriculumId && (slideMode === 'personal' && personalViewSubMode === 'current' || slideMode === 'shared' || slideMode === 'original' || slideMode === null) && (
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <button type="button" className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-slate-800/95 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600/60 z-[100] shadow-lg">
                                                    <MoreVertical className="h-3.5 w-3.5" />
                                                  </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" sideOffset={10} className="z-[120]">
                                                  <DropdownMenuItem onSelect={() => { setEmbedReplaceContext({ slideIndex: currentIndex, blockIndex: 0, rawMarker: ep.rawMarker, urlOrId: ep.urlOrId, embedType: ep.embedType }); setEmbedDialogInitialMode('insert'); setEmbedDialogOpen(true) }} className="cursor-pointer gap-3">
                                                    <RefreshCw className="h-4 w-4 shrink-0" />
                                                    {tr('Thay', 'Replace', '替换', '差し替え', '교체')}
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem onSelect={() => handleRemoveEmbed(currentIndex, 0, ep.rawMarker)} className="text-rose-600 focus:text-rose-600 dark:text-rose-400 cursor-pointer gap-3">
                                                    <Trash2 className="h-4 w-4 shrink-0" />
                                                    {tr('Xóa', 'Delete', '删除', '削除', '삭제')}
                                                  </DropdownMenuItem>
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                            )}
                                          </div>
                                        )
                                      }
                                      return null
                                    })}
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {curriculumId && asArray(splitContentWithEmbeds(s.content ?? '')).filter((p): p is { type: 'embed'; embedType: 'quiz'; urlOrId: string; rawMarker: string } => p.type === 'embed' && p.embedType === 'quiz').map((p, qIdx) => (
                                      <button
                                        key={qIdx}
                                        type="button"
                                        disabled={!!quizReportLoading}
                                        onClick={() => reportQuizWrong({
                                          curriculumId,
                                          slideIndex: currentIndex,
                                          blockIndex: 0,
                                          quizMarker: p.rawMarker,
                                          slideTitle: s?.title ?? '',
                                          slideContent: s.content ?? '',
                                        })}
                                        className="text-xs font-medium text-rose-300 hover:text-rose-200 px-2 py-1 rounded-lg bg-rose-500/20 border border-rose-400/30 flex items-center gap-1 transition-colors disabled:opacity-50"
                                      >
                                        <Flag className="h-3.5 w-3.5" />
                                        {tr('Báo câu hỏi sai', 'Report wrong question', '报告题目错误', '問題が間違っていると報告', '문제 오류 신고')}
                                      </button>
                                    ))}
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
                                updateSlideBlocksAndPersist(currentIndex, newBlocks, '')
                              }} className="w-full py-2 rounded-lg border-2 border-dashed border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/15 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors">
                                <Plus className="h-3.5 w-3.5" />{tr('Thêm ý', 'Add point', '添加要点', '追加', '의견 추가')}
                              </button>
                            )}
                          </div>
                        ) : (
                          <p className="text-slate-500 text-sm py-2">{tr('Không có nội dung', 'No content', '无内容', 'コンテンツなし', '내용 없음')}</p>
                        )}
                      </div>
                      <div className="w-full rounded-lg bg-slate-800/50 p-3 border border-slate-600/60 shrink-0">
                        <label className="block text-amber-300/95 font-medium mb-1.5 text-sm">{tr('Ghi chú', 'Notes', '备注', 'メモ', '메모')}</label>
                        <textarea value={notesValue} onChange={(e) => setNotesValue(e.target.value)} onBlur={handleBlur} placeholder={tr('Gợi ý câu hỏi, ví dụ...', 'Question hints, examples...', '问题提示、示例...', '質問のヒント、例...', '질문 힌트, 예시...')} className="w-full rounded-lg bg-slate-700/60 p-3 min-h-[64px] max-h-[120px] text-slate-200 placeholder-slate-500 border border-slate-600 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 text-sm resize-y transition-colors" />
                      </div>
                    </div>
                  )
                })()}
              </div>
            ) : (
            <div className="flex-1 min-h-0 flex flex-col gap-1.5 p-3 overflow-hidden">
              {([tripleIdxPrev, tripleIdxCur, tripleIdxNext] as const).map((idx, step) => {
                const isCurrent = step === 1
                const label = `Slide ${idx + 1}`
                const s = slides[idx]
                const blks = !s ? [] : (Array.isArray(s.blocks) && s.blocks.length ? s.blocks : s.content ? parseContentToBlocks(s.content ?? '') : [])
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
                        {isCurrent && (
                          getQuizCount(blks) < 1 ? (
                            <Popover open={quizDifficultyPopoverSlide === idx} onOpenChange={(o) => setQuizDifficultyPopoverSlide(o ? idx : null)}>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  disabled={quizGenLoading !== null}
                                  className="text-xs text-violet-400 hover:text-violet-300 px-1.5 py-0.5 rounded bg-slate-700/50 flex items-center gap-1"
                                  title={tr('Tạo câu hỏi trắc nghiệm', 'Generate quiz', '生成测验', 'クイズ作成', '퀴즈 생성')}
                                >
                                  <Sparkles className="h-3 w-3" />
                                  {quizGenLoading === idx ? tr('Đang tạo...', 'Creating...', '创建中...', '作成中...', '생성 중...') : tr('Tạo câu hỏi', 'Add quiz', '添加测验', 'クイズ追加', '퀴즈 추가')}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-2" align="start">
                                <p className="text-xs font-medium text-foreground mb-2">{tr('Chọn độ khó', 'Select difficulty', '选择难度', '難易度を選択', '난이도 선택')}</p>
                                <div className="flex flex-col gap-1">
                                  {QUIZ_DIFFICULTIES.map((d) => (
                                    <button
                                      key={d}
                                      type="button"
                                      onClick={() => void handleGenerateQuiz(idx, d)}
                                      className={`text-left text-sm font-medium px-2.5 py-2 rounded-md transition-colors ${
                                        d === 'easy'
                                          ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                                          : d === 'medium'
                                            ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                                            : 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
                                      }`}
                                    >
                                      {d === 'easy' ? tr('Dễ', 'Easy', '简单', '易しい', '쉬움') : d === 'medium' ? tr('Trung bình', 'Medium', '中等', '普通', '보통') : tr('Khó', 'Hard', '困难', '難しい', '어려움')}
                                    </button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setQuizPopupOpen(true)}
                              className="text-xs text-violet-400 hover:text-violet-300 px-1.5 py-0.5 rounded bg-slate-700/50 flex items-center gap-1"
                              title={tr('Xem câu hỏi trắc nghiệm', 'View quiz', '查看测验', 'クイズを見る', '퀴즈 보기')}
                            >
                              <ClipboardList className="h-3 w-3" />
                              {tr('Xem câu hỏi', 'View quiz', '查看测验', 'クイズを見る', '퀴즈 보기')}
                            </button>
                          )
                        )}
                        {isCurrent && curriculumId && (
                          <button
                            type="button"
                            onClick={() => { setEmbedDialogInitialMode('insert'); setEmbedReplaceContext(null); setEmbedDialogOpen(true) }}
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
                                      updateSlideBlocksAndPersist(idx, newBlocks)
                                      setEditingBlock(null)
                                    }} className="text-[10px] text-emerald-400">{tr('Lưu', 'Save', '保存', '保存', '저장')}</button>
                                    <button type="button" onClick={() => setEditingBlock(null)} className="text-[10px] text-slate-400">{tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="text-slate-200 text-xs whitespace-pre-wrap break-words leading-relaxed min-w-0 text-left space-y-1">
                                    {asArray(splitContentWithEmbeds(b.content ?? '')).map((p, j) => {
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
                                    {curriculumId && asArray(splitContentWithEmbeds(b.content ?? '')).filter((p): p is { type: 'embed'; embedType: 'quiz'; urlOrId: string; rawMarker: string } => p.type === 'embed' && p.embedType === 'quiz').map((p, qIdx) => (
                                      <button key={qIdx} type="button" disabled={!!quizReportLoading} onClick={() => reportQuizWrong({ curriculumId, slideIndex: idx, blockIndex: i, quizMarker: p.rawMarker, slideTitle: s?.title ?? '', slideContent: (blks ?? []).map((bl) => (bl.header ? `### ${bl.header}\n\n` : '') + (bl.content ?? '')).join('\n\n') })} className="text-[10px] font-medium text-rose-300 hover:text-rose-200 px-1.5 py-0.5 rounded bg-rose-500/20 flex items-center gap-0.5 disabled:opacity-50">
                                        <Flag className="h-2.5 w-2.5" />{tr('Báo sai', 'Report wrong', '报告错误', '誤り報告', '오류 신고')}
                                      </button>
                                    ))}
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
                          updateSlideBlocksAndPersist(idx, newBlocks)
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
                                  updateSlideBlocksAndPersist(idx, newBlocks, '')
                                  setEditingBlock(null)
                                }} className="text-[10px] text-emerald-400">{tr('Lưu', 'Save', '保存', '保存', '저장')}</button>
                                <button type="button" onClick={() => setEditingBlock(null)} className="text-[10px] text-slate-400">{tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="text-slate-200 text-xs whitespace-pre-wrap break-words leading-relaxed min-w-0 text-left space-y-1">
                                {asArray(splitContentWithEmbeds(s.content ?? '')).map((p, j) => {
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
                              {isCurrent && curriculumId && asArray(splitContentWithEmbeds(s.content ?? '')).filter((p): p is { type: 'embed'; embedType: 'quiz'; urlOrId: string; rawMarker: string } => p.type === 'embed' && p.embedType === 'quiz').map((p, qIdx) => (
                                <button key={qIdx} type="button" disabled={!!quizReportLoading} onClick={() => reportQuizWrong({ curriculumId, slideIndex: idx, blockIndex: 0, quizMarker: p.rawMarker, slideTitle: s?.title ?? '', slideContent: s.content ?? '' })} className="text-[10px] text-rose-400 hover:text-rose-300 px-1.5 py-0.5 rounded bg-slate-700/50 flex items-center gap-0.5 border border-rose-500/50 mt-1 disabled:opacity-50">
                                  <Flag className="h-2.5 w-2.5" />{tr('Báo sai', 'Report wrong', '报告错误', '誤り報告', '오류 신고')}
                                </button>
                              ))}
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
                          updateSlideBlocksAndPersist(idx, newBlocks, '')
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
      </div>
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
        onRestored={async () => {
          if (!curriculumId) return
          const r = await getSlidesByCurriculumId(curriculumId)
          if (r?.success && r.slides) setSlides(r.slides)
          requestCurriculum()
        }}
      />
      {curriculumId && slides.length > 0 && (
        <EmbedInsertDialog
          open={embedDialogOpen}
          onOpenChange={(open) => { setEmbedDialogOpen(open); if (!open) setEmbedReplaceContext(null) }}
          onInsert={(marker, placement, alsoTo) => {
            handleInsertEmbed(marker, placement ?? 'end', alsoTo)
            setEmbedDialogOpen(false)
          }}
          onReplaceSlideImage={(markerOrUrl, alsoTo, layout, cellIndex) => {
            handleReplaceSlideImage(markerOrUrl, alsoTo, layout ?? 1, cellIndex)
            setEmbedDialogOpen(false)
          }}
          onReplaceBlockEmbed={(slideIndex, blockIndex, oldRawMarker, newMarker) => {
            handleReplaceEmbed(slideIndex, blockIndex, oldRawMarker, newMarker)
            setEmbedReplaceContext(null)
            setEmbedDialogOpen(false)
          }}
          tr={tr}
          highZIndex
          initialMode={embedDialogInitialMode}
          replaceEmbedContext={embedReplaceContext}
          blocks={(() => {
            const s = slides[currentIndex]
            const blks = Array.isArray(s?.blocks) && s.blocks.length ? s.blocks : s?.content ? parseContentToBlocks(s.content) : []
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
        const showSingleCell = teacherExpandedCellIndex != null && layout > 1
        const displayCells = showSingleCell && cells[teacherExpandedCellIndex] ? [cells[teacherExpandedCellIndex]] : cells
        const displayIndices = showSingleCell && teacherExpandedCellIndex != null ? [teacherExpandedCellIndex] : cells.map((_, i) => i)
        const gridClass = !showSingleCell && layout === 2 ? 'grid grid-rows-2 gap-2' : !showSingleCell && layout === 4 ? 'grid grid-cols-2 grid-rows-2 gap-2' : ''
        return (
          <div
            className="fixed inset-0 z-[105] bg-black flex flex-col"
            onClick={(e) => { if (e.target === e.currentTarget) closeTeacherVisualFullscreen() }}
          >
            <div className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-4 bg-black/70 z-20 shrink-0">
              <span className="text-white/80 text-sm">{currentIndex + 1}/{slides.length} {s.title}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeTeacherVisualFullscreen}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white font-medium transition-colors"
                  title={tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}
                >
                  <X className="h-5 w-5" />
                  {tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}
                </button>
              </div>
            </div>
            <div className={cn('flex-1 min-h-0 relative px-4 pb-4 pt-14 flex flex-col', showSingleCell || layout === 1 ? 'gap-4' : '')}>
              <div className="flex-1 min-h-0 relative flex flex-col">
                <div ref={teacherVisualFrameRef} className={cn('flex-1 min-h-0 overflow-hidden min-w-0', showSingleCell || layout === 1 ? 'flex flex-col gap-4' : gridClass)}>
                {displayCells.map((cell, i) => (
                  <div key={displayIndices[i] ?? i} className="flex-1 min-h-0 relative rounded-xl overflow-hidden bg-black/30 border border-white/10">
                    {cell.visualEmbed ? (
                      (() => {
                        const embeds = parseContentEmbeds(cell.visualEmbed)
                        const first = embeds[0]
                        if (!first) return <div className="w-full h-full" />
                        return (
                          <div className="w-full h-full">
                            <ContentEmbed type={first.type} urlOrId={first.urlOrId} tr={tr} hideQuiz fill className="!my-0 !rounded-xl !border-0" />
                          </div>
                        )
                      })()
                    ) : cell.imageUrl ? (
                      <img src={cell.imageUrl} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full bg-white/5" />
                    )}
                  </div>
                ))}
                </div>
              </div>
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
      {typeof document !== 'undefined' &&
        studentMousePos &&
        createPortal(
          <div
            className="fixed z-[115] pointer-events-none transition-all duration-75"
            style={{ left: studentMousePos.x, top: studentMousePos.y, transform: 'translate(-2px, -2px)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="drop-shadow-lg">
              <path d="M4 4l7 16 2.5-6 5.5-2.5L4 4z" fill="rgba(34,197,94,0.9)" stroke="rgba(0,0,0,0.5)" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
          </div>,
          document.body
        )}
      <Toaster />
    </div>
  )
}
