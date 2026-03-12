'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ChevronLeft, ChevronRight, X, Printer, ArrowRight, TrendingUp, CalendarCheck, Lightbulb, BookOpen, Target, BarChart2, Trash2, Play, Pause, Settings2, ClipboardList, Maximize2, PenLine, Timer, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { ContentEmbed, splitContentWithEmbeds, parseContentEmbeds, splitBlockContentAtQuizBoundary, type EmbedType } from './content-embed'
import { EmbedInsertDialog } from './embed-insert-dialog'
import { PresentationControlBar } from './presentation-control-bar'
import { QuizPopupDialog, extractQuizFromSlide } from './quiz-popup-dialog'
import { useToast } from '@/hooks/use-toast'
import { saveSlidesToCurriculum, saveUserCustomizedSlides } from '../actions'

/** Phát tiếng chuông khi hết giờ (đồng hồ cát học sinh) */
function playTimerEndBell() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const play = () => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15)
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3)
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.5)
    }
    if (ctx.state === 'suspended') ctx.resume().then(play).catch(() => {})
    else play()
  } catch {
    /* ignore */
  }
}

const DARK_GRADIENTS = [
  'linear-gradient(160deg, #1e3a5f 0%, #0f172a 50%)',
  'linear-gradient(160deg, #312e81 0%, #1e1b4b 50%)',
  'linear-gradient(160deg, #1e3a5f 0%, #0f172a 50%)',
  'linear-gradient(160deg, #1e3a5f 0%, #0c4a6e 50%)',
]

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

function getTextSegmentCount(text: string): number {
  return text.length
}

/** Đếm số segment (char + newline) trong content, embed = 1 segment */
function getContentSegmentCount(content: string): number {
  const parts = splitContentWithEmbeds(content)
  let n = 0
  for (const p of parts) {
    if (p.type === 'text') n += getTextSegmentCount(p.value)
    else n += 1
  }
  return n
}

/** Hiệu ứng gõ từng chữ – chế độ tự chạy (trigger) hoặc điều khiển (visibleCount). showCursor: hiện bút chạy theo vị trí đang gõ */
function AnimatedCharReveal({
  text,
  trigger,
  delayMs = 40,
  visibleCount: controlledVisibleCount,
  showCursor,
}: {
  text: string
  trigger?: string | number
  delayMs?: number
  visibleCount?: number
  showCursor?: boolean
}) {
  const segments = useMemo(() => {
    const out: Array<{ type: 'char'; value: string } | { type: 'br' }> = []
    for (const c of text) {
      if (c === '\n') out.push({ type: 'br' })
      else out.push({ type: 'char', value: c })
    }
    return out
  }, [text])
  const [internalCount, setInternalCount] = useState(0)

  useEffect(() => {
    if (controlledVisibleCount != null) return
    setInternalCount(0)
    if (segments.length === 0) return
    let start = performance.now()
    let rafId: number
    const tick = (now: number) => {
      const elapsed = now - start
      const next = Math.min(Math.floor(elapsed / delayMs) + 1, segments.length)
      setInternalCount(next)
      if (next < segments.length) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [trigger, delayMs, segments.length, controlledVisibleCount])

  const visibleCount = controlledVisibleCount ?? internalCount
  const isTyping = visibleCount > 0 && visibleCount < segments.length

  return (
    <span>
      {segments.slice(0, visibleCount).map((seg, i) =>
        seg.type === 'br' ? (
          <br key={i} />
        ) : (
          <span
            key={i}
            className="inline align-baseline animate-in fade-in duration-75"
            style={{ animationTimingFunction: 'ease-out', animationFillMode: 'forwards' }}
          >
            {seg.value}
          </span>
        )
      )}
      {showCursor && isTyping && (
        <span className="inline-flex align-baseline ml-1 animate-write" aria-hidden>
          <PenLine className="h-4 w-4 text-violet-600 drop-shadow-sm" strokeWidth={2.5} />
        </span>
      )}
    </span>
  )
}

function BlockContentWithEmbeds({
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
}: {
  content: string
  onRemoveEmbed?: (rawMarker: string) => void
  removeTitle?: string
  liveQuizContext?: { curriculumId: string; slideIndex: number; blockIndex: number }
  tr?: (vi: string, en: string, zh: string, ja: string, ko: string) => string
  hideQuiz?: boolean
  animateReveal?: boolean
  animateTrigger?: string | number
  wordDelayMs?: number
  /** Số segment đã hiện trong block (chế độ tuần tự từ trên xuống) */
  visibleCountInBlock?: number
}) {
  const parts = splitContentWithEmbeds(content)
  let consumed = 0
  return (
    <div className="[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_p]:my-2 text-base md:text-lg leading-relaxed">
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
          return <div key={i} dangerouslySetInnerHTML={{ __html: markdownToHtml(p.value) }} />
        }
        const ep = p as { type: 'embed'; embedType: string; urlOrId: string; rawMarker: string }
        if (hideQuiz && ep.embedType === 'quiz') return null
        const showEmbed = visibleCountInBlock == null || visibleCountInBlock > consumed
        consumed += 1
        if (!showEmbed) return null
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

export type VisualCell = { visualEmbed?: string; imageUrl?: string }

type SlideItem = {
  title: string
  content: string
  blocks?: AISlideData['blocks']
  imageUrl?: string
  visualEmbed?: string
  /** 1=toàn bộ, 2=chia 2 (trên/dưới), 4=chia 4 ô */
  visualLayout?: 1 | 2 | 4
  /** Nội dung từng ô – layout 2: [trên, dưới], layout 4: [tl, tr, bl, br] */
  visualCells?: VisualCell[]
  /** Ghi chú giáo viên – chỉ hiện trong cửa sổ Presenter, học sinh không thấy */
  teacherNotes?: string
}

export type SlideMode = 'original' | 'shared' | 'personal'

interface NanoAISlideViewerProps {
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
  /** Slide hiện tại từ giáo viên (đồng bộ khi mở/refresh) */
  initialSlideIndex?: number
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

function getBaseSlides(curriculumMarkdown: string, topic: string, aiSlides: AISlideData[] | null | undefined): SlideItem[] {
  const hasEmbeds = /\[(geogebra|desmos|youtube|phet|maps|image|audio|quiz|code|latex):/.test(curriculumMarkdown)
  if (aiSlides && aiSlides.length > 0 && !hasEmbeds) {
    return aiSlides.map((s) => {
      const base = s as SlideItem
      return { title: s.title, content: '', blocks: s.blocks, imageUrl: s.imageUrl, visualEmbed: s.visualEmbed, visualLayout: base.visualLayout, visualCells: base.visualCells, teacherNotes: (base as SlideItem).teacherNotes }
    })
  }
  const readable = latexToReadable(curriculumMarkdown)
  const parsed = parseCurriculumToSlides(readable)
  return topic ? [{ title: topic, content: '' }, ...parsed] : parsed
}

export function NanoAISlideViewer({ curriculumMarkdown, topic, onClose, aiSlides, curriculumId, subjectId, gradeLevelId, tr, onSlidesSaved, slideMode, originalSlides, personalSlides, sharedSlides, initialSlideIndex }: NanoAISlideViewerProps) {
  const { toast } = useToast()
  const [slides, setSlides] = useState<SlideItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false)
  const [autoPlay, setAutoPlay] = useState(false)
  const [autoPlayIntervalMs, setAutoPlayIntervalMs] = useState(5000)
  const [teacherWritingMode, setTeacherWritingMode] = useState(false)
  const [teacherWritingSpeedMs, setTeacherWritingSpeedMs] = useState(80)
  const [transitionDirection, setTransitionDirection] = useState<'next' | 'prev'>('next')
  const [personalViewSubMode, setPersonalViewSubMode] = useState<'current' | 'original'>('current')
  const [quizPopupOpen, setQuizPopupOpen] = useState(false)
  const [visualFullscreenOpen, setVisualFullscreenOpen] = useState(false)
  const [expandedCellIndex, setExpandedCellIndex] = useState<number | null>(null)
  const fullscreenOverlayRef = useRef<HTMLDivElement>(null)
  const studentVisualFrameRef = useRef<HTMLDivElement | null>(null)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [teacherTimerSeconds, setTeacherTimerSeconds] = useState(0)
  const [teacherTimerRunning, setTeacherTimerRunning] = useState(false)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [slideVisibleCount, setSlideVisibleCount] = useState(0)
  const [presentationMode, setPresentationMode] = useState<'independent' | 'slide-interaction'>('independent')
  const [virtualMousePos, setVirtualMousePos] = useState<{ x: number; y: number } | null>(null)
  const [mouseTrail, setMouseTrail] = useState<Array<{ x: number; y: number }>>([])
  const [mouseClicks, setMouseClicks] = useState<Array<{ id: number; x: number; y: number }>>([])
  const mouseThrottleRef = useRef(0)

  const openVisualFullscreen = useCallback((cellIndex?: number) => {
    setExpandedCellIndex(cellIndex ?? null)
    setVisualFullscreenOpen(true)
    setTimeout(() => {
      const el = fullscreenOverlayRef.current
      if (el) {
        const reqFs = el.requestFullscreen ?? (el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen
        reqFs?.()?.catch(() => {})
      }
    }, 0)
  }, [])

  const closeVisualFullscreen = useCallback(() => {
    try {
      const isFs = document.fullscreenElement ?? (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement
      if (isFs) {
        const exitFs = document.exitFullscreen ?? (document as Document & { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen
        exitFs?.()?.catch(() => {})
      }
    } catch {
      /* ignore */
    }
    setVisualFullscreenOpen(false)
    setExpandedCellIndex(null)
    if (presentationMode === 'slide-interaction' && typeof window !== 'undefined' && window.opener) {
      window.opener.postMessage({ type: 'visual-fullscreen-close' }, window.location.origin)
    }
  }, [presentationMode])

  useEffect(() => {
    if (timerSeconds <= 0) setTimerRunning(false)
  }, [timerSeconds])

  useEffect(() => {
    if (!timerRunning || timerSeconds <= 0) return
    const id = setInterval(() => {
      setTimerSeconds((s) => {
        if (s <= 1) {
          playTimerEndBell()
          toast({ title: tr('Hết giờ!', 'Time\'s up!', '时间到！', '時間です！', '시간 종료!'), duration: 3000 })
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [timerRunning, timerSeconds, toast, tr])

  useEffect(() => {
    if (!teacherTimerRunning) return
    const id = setInterval(() => setTeacherTimerSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [teacherTimerRunning])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      const t = e.data?.type
      if (t === 'teacher-timer-start') setTeacherTimerRunning(true)
      else if (t === 'teacher-timer-stop') setTeacherTimerRunning(false)
      else if (t === 'teacher-timer-reset') { setTeacherTimerRunning(false); setTeacherTimerSeconds(0) }
      else if (t === 'teacher-timer-sync' && typeof e.data?.seconds === 'number') {
        setTeacherTimerSeconds(e.data.seconds)
        setTeacherTimerRunning(Boolean(e.data?.running))
      }
      else if (t === 'set-personal-view-submode' && (e.data?.value === 'current' || e.data?.value === 'original')) {
        setPersonalViewSubMode(e.data.value)
      }
      else if (t === 'refresh-personal-after-reset') {
        onSlidesSaved?.()
      }
      else if (t === 'set-teacher-writing-mode' && typeof e.data?.value === 'boolean') setTeacherWritingMode(e.data.value)
      else if (t === 'set-teacher-writing-speed' && typeof e.data?.ms === 'number') setTeacherWritingSpeedMs(e.data.ms)
      else if (t === 'set-auto-play' && typeof e.data?.value === 'boolean') setAutoPlay(e.data.value)
      else if (t === 'set-auto-play-interval' && typeof e.data?.ms === 'number') setAutoPlayIntervalMs(e.data.ms)
      else if (t === 'sand-timer-start' && typeof e.data?.seconds === 'number') {
        setTimerSeconds(e.data.seconds)
        setTimerRunning(true)
      }
      else if (t === 'presentation-mode' && (e.data?.mode === 'independent' || e.data?.mode === 'slide-interaction')) {
        setPresentationMode(e.data.mode)
        if (e.data.mode === 'independent') {
          setVirtualMousePos(null)
          setMouseTrail([])
          setMouseClicks([])
        }
      }
      else if (t === 'visual-fullscreen-open') {
        const cellIndex = typeof e.data?.cellIndex === 'number' ? e.data.cellIndex : undefined
        openVisualFullscreen(cellIndex)
      }
      else if (t === 'visual-fullscreen-close') {
        closeVisualFullscreen()
      }
      else if (t === 'mouse-pos' && presentationMode === 'slide-interaction') {
        let px: number
        let py: number
        if (e.data?.visualFrame && e.data?.imageCenter && typeof e.data?.cellIndex === 'number' && typeof e.data?.dxFromCenter === 'number' && typeof e.data?.dyFromCenter === 'number' && typeof e.data?.visW === 'number' && typeof e.data?.visH === 'number' && studentVisualFrameRef.current && visualFullscreenOpen) {
          const frame = studentVisualFrameRef.current
          const children = Array.from(frame.children) as HTMLElement[]
          const cell = children[e.data.cellIndex]
          if (cell) {
            const img = cell.querySelector('img')
            if (img?.complete && img.naturalWidth > 0) {
              const vis = getVisibleImageBounds(img)
              const cx = vis.left + vis.width / 2
              const cy = vis.top + vis.height / 2
              const scaleX = vis.width / (e.data.visW || 1)
              const scaleY = vis.height / (e.data.visH || 1)
              px = cx + e.data.dxFromCenter * scaleX
              py = cy + e.data.dyFromCenter * scaleY
            } else {
              const rect = cell.getBoundingClientRect()
              const cx = rect.left + rect.width / 2
              const cy = rect.top + rect.height / 2
              const scaleX = rect.width / (e.data.visW || 1)
              const scaleY = rect.height / (e.data.visH || 1)
              px = cx + e.data.dxFromCenter * scaleX
              py = cy + e.data.dyFromCenter * scaleY
            }
          } else {
            const rect = frame.getBoundingClientRect()
            const cx = rect.left + rect.width / 2
            const cy = rect.top + rect.height / 2
            const scaleX = rect.width / (e.data.visW || 1)
            const scaleY = rect.height / (e.data.visH || 1)
            px = cx + e.data.dxFromCenter * scaleX
            py = cy + e.data.dyFromCenter * scaleY
          }
        } else if (e.data?.visualFrame && typeof e.data?.relX === 'number' && typeof e.data?.relY === 'number' && studentVisualFrameRef.current && visualFullscreenOpen) {
          const rect = studentVisualFrameRef.current.getBoundingClientRect()
          px = rect.left + e.data.relX * rect.width
          py = rect.top + e.data.relY * rect.height
        } else if (e.data?.visualFrame && typeof e.data?.dxFromCenter === 'number' && typeof e.data?.dyFromCenter === 'number' && typeof e.data?.frameW === 'number' && typeof e.data?.frameH === 'number' && studentVisualFrameRef.current && visualFullscreenOpen) {
          const rect = studentVisualFrameRef.current.getBoundingClientRect()
          const cx = rect.left + rect.width / 2
          const cy = rect.top + rect.height / 2
          const scaleX = rect.width / (e.data.frameW || 1)
          const scaleY = rect.height / (e.data.frameH || 1)
          px = cx + e.data.dxFromCenter * scaleX
          py = cy + e.data.dyFromCenter * scaleY
        } else if (typeof e.data?.xrPx === 'number' && typeof e.data?.yPx === 'number') {
          const w = typeof window !== 'undefined' ? window.innerWidth : 1920
          const h = typeof window !== 'undefined' ? window.innerHeight : 1080
          px = Math.max(0, Math.min(w, w - e.data.xrPx))
          py = Math.max(0, Math.min(h, e.data.yPx))
        } else return
        setVirtualMousePos({ x: px, y: py })
        setMouseTrail((prev) => {
          const next = [...prev, { x: px, y: py }]
          return next.slice(-80)
        })
      }
      else if (t === 'mouse-click' && presentationMode === 'slide-interaction') {
        let px: number
        let py: number
        if (e.data?.visualFrame && e.data?.imageCenter && typeof e.data?.cellIndex === 'number' && typeof e.data?.dxFromCenter === 'number' && typeof e.data?.dyFromCenter === 'number' && typeof e.data?.visW === 'number' && typeof e.data?.visH === 'number' && studentVisualFrameRef.current && visualFullscreenOpen) {
          const frame = studentVisualFrameRef.current
          const children = Array.from(frame.children) as HTMLElement[]
          const cell = children[e.data.cellIndex]
          if (cell) {
            const img = cell.querySelector('img')
            if (img?.complete && img.naturalWidth > 0) {
              const vis = getVisibleImageBounds(img)
              const cx = vis.left + vis.width / 2
              const cy = vis.top + vis.height / 2
              const scaleX = vis.width / (e.data.visW || 1)
              const scaleY = vis.height / (e.data.visH || 1)
              px = cx + e.data.dxFromCenter * scaleX
              py = cy + e.data.dyFromCenter * scaleY
            } else {
              const rect = cell.getBoundingClientRect()
              const cx = rect.left + rect.width / 2
              const cy = rect.top + rect.height / 2
              const scaleX = rect.width / (e.data.visW || 1)
              const scaleY = rect.height / (e.data.visH || 1)
              px = cx + e.data.dxFromCenter * scaleX
              py = cy + e.data.dyFromCenter * scaleY
            }
          } else {
            const rect = frame.getBoundingClientRect()
            const cx = rect.left + rect.width / 2
            const cy = rect.top + rect.height / 2
            const scaleX = rect.width / (e.data.visW || 1)
            const scaleY = rect.height / (e.data.visH || 1)
            px = cx + e.data.dxFromCenter * scaleX
            py = cy + e.data.dyFromCenter * scaleY
          }
        } else if (e.data?.visualFrame && typeof e.data?.relX === 'number' && typeof e.data?.relY === 'number' && studentVisualFrameRef.current && visualFullscreenOpen) {
          const rect = studentVisualFrameRef.current.getBoundingClientRect()
          px = rect.left + e.data.relX * rect.width
          py = rect.top + e.data.relY * rect.height
        } else if (e.data?.visualFrame && typeof e.data?.dxFromCenter === 'number' && typeof e.data?.dyFromCenter === 'number' && typeof e.data?.frameW === 'number' && typeof e.data?.frameH === 'number' && studentVisualFrameRef.current && visualFullscreenOpen) {
          const rect = studentVisualFrameRef.current.getBoundingClientRect()
          const cx = rect.left + rect.width / 2
          const cy = rect.top + rect.height / 2
          const scaleX = rect.width / (e.data.frameW || 1)
          const scaleY = rect.height / (e.data.frameH || 1)
          px = cx + e.data.dxFromCenter * scaleX
          py = cy + e.data.dyFromCenter * scaleY
        } else if (typeof e.data?.xrPx === 'number' && typeof e.data?.yPx === 'number') {
          const w = typeof window !== 'undefined' ? window.innerWidth : 1920
          const h = typeof window !== 'undefined' ? window.innerHeight : 1080
          px = Math.max(0, Math.min(w, w - e.data.xrPx))
          py = Math.max(0, Math.min(h, e.data.yPx))
        } else return
        setMouseClicks((prev) => [...prev, { id: Date.now() + Math.floor(Math.random() * 1000), x: px, y: py }].slice(-8))
      }
    }
    window.addEventListener('message', handler)
    let channel: BroadcastChannel | null = null
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('tao-giao-trinh-sync')
      channel.addEventListener('message', (event) => {
        handler({ origin: window.location.origin, data: event.data } as MessageEvent)
      })
      channel.postMessage({ type: 'request-curriculum' })
    }
    return () => window.removeEventListener('message', handler)
  }, [onSlidesSaved, openVisualFullscreen, closeVisualFullscreen, presentationMode, visualFullscreenOpen])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel('tao-giao-trinh-sync')
    channel.postMessage({ type: 'request-curriculum' })
    return () => channel.close()
  }, [onSlidesSaved, openVisualFullscreen, closeVisualFullscreen, presentationMode, visualFullscreenOpen])

  useEffect(() => {
    if (mouseClicks.length === 0) return
    const id = window.setTimeout(() => {
      setMouseClicks((prev) => prev.slice(1))
    }, 450)
    return () => window.clearTimeout(id)
  }, [mouseClicks])

  const target = typeof window !== 'undefined' ? (window.opener || (window !== window.top ? window.parent : null)) : null
  useEffect(() => {
    if (presentationMode !== 'slide-interaction' || !target) return
    const onMove = (e: MouseEvent) => {
      const now = Date.now()
      if (now - mouseThrottleRef.current < 40) return
      mouseThrottleRef.current = now
      const x = e.clientX / (window.innerWidth || 1)
      const y = e.clientY / (window.innerHeight || 1)
      try {
        ;(target as Window).postMessage({ type: 'mouse-pos', x, y }, window.location.origin)
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [presentationMode, target])

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const startTimer = useCallback((seconds: number) => {
    setTimerSeconds(seconds)
    setTimerRunning(true)
  }, [])

  const toggleTimer = useCallback(() => {
    setTimerRunning((r) => !r)
  }, [])

  const resetTimer = useCallback(() => {
    setTimerRunning(false)
    setTimerSeconds(0)
  }, [])

  const baseSlidesForDisplay =
    slideMode === 'personal' && personalViewSubMode === 'original' && originalSlides && originalSlides.length > 0
      ? getBaseSlides(curriculumMarkdown, topic, originalSlides)
      : getBaseSlides(curriculumMarkdown, topic, aiSlides)

  useEffect(() => {
    const nextSlides = baseSlidesForDisplay
    setSlides(nextSlides)
    const idx = typeof initialSlideIndex === 'number' ? Math.max(0, Math.min(initialSlideIndex, nextSlides.length - 1)) : 0
    setCurrentIndex(idx)
  }, [curriculumMarkdown, topic, aiSlides, slideMode, personalViewSubMode, originalSlides, initialSlideIndex])

  const goNext = useCallback(() => {
    setAutoPlay(false)
    setTransitionDirection('next')
    setCurrentIndex((i) => {
      const next = Math.min(i + 1, slides.length - 1)
      if (presentationMode === 'slide-interaction' && typeof window !== 'undefined' && window.opener) {
        window.opener.postMessage({ type: 'slide-go', index: next }, window.location.origin)
      }
      return next
    })
  }, [slides.length, presentationMode])

  const goPrev = useCallback(() => {
    setAutoPlay(false)
    setTransitionDirection('prev')
    setCurrentIndex((i) => {
      const next = Math.max(i - 1, 0)
      if (presentationMode === 'slide-interaction' && typeof window !== 'undefined' && window.opener) {
        window.opener.postMessage({ type: 'slide-go', index: next }, window.location.origin)
      }
      return next
    })
  }, [presentationMode])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'slide-prev') {
        setAutoPlay(false)
        setTransitionDirection('prev')
        setCurrentIndex((i) => Math.max(i - 1, 0))
      } else if (e.data?.type === 'slide-next') {
        setAutoPlay(false)
        setTransitionDirection('next')
        setCurrentIndex((i) => Math.min(i + 1, slides.length - 1))
      } else if (e.data?.type === 'slide-go' && typeof e.data?.index === 'number') {
        const idx = Math.max(0, Math.min(e.data.index, slides.length - 1))
        setCurrentIndex((prev) => {
          setTransitionDirection(idx > prev ? 'next' : 'prev')
          return idx
        })
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [slides.length])

  type EmbedPlacement = 'end' | 'newBlock' | number
  const persistSlidesRef = useRef<(s: SlideItem[]) => Promise<void>>(async () => {})
  useEffect(() => {
    persistSlidesRef.current = async (updatedSlides: SlideItem[]) => {
      if (!curriculumId || updatedSlides.length === 0) return
      const payload = updatedSlides.map((s) => ({ title: s.title, blocks: s.blocks ?? [], imageUrl: s.imageUrl, visualEmbed: s.visualEmbed, visualLayout: s.visualLayout, visualCells: s.visualCells, teacherNotes: s.teacherNotes }))
      if (slideMode === 'personal' || slideMode === 'original') {
        const r = await saveUserCustomizedSlides({ curriculumId, slides: payload })
        if (r?.error) toast({ title: tr('Lỗi lưu', 'Save error'), description: r.error, variant: 'destructive' })
        else { toast({ title: tr('Đã lưu', 'Saved', '已保存', '保存しました', '저장됨'), duration: 1500 }); onSlidesSaved?.() }
      } else if (slideMode === 'shared' || !slideMode) {
        const r = await saveSlidesToCurriculum({ curriculumId, topic: topic || 'Bài giảng', subjectId: subjectId ?? 'toan', gradeLevelId: gradeLevelId ?? 'lop-6', slides: payload })
        if (r?.error) toast({ title: tr('Lỗi lưu', 'Save error'), description: r.error, variant: 'destructive' })
        else { toast({ title: tr('Đã lưu', 'Saved', '已保存', '保存しました', '저장됨'), duration: 1500 }); onSlidesSaved?.() }
      }
    }
  }, [curriculumId, slideMode, topic, subjectId, gradeLevelId, toast, tr, onSlidesSaved])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'merge-slides' && typeof e.data?.index === 'number') {
        const idx = e.data.index
        setSlides((prev) => {
          if (idx < 0 || idx >= prev.length - 1) return prev
          const a = prev[idx]
          const b = prev[idx + 1]
          const merged: SlideItem = {
            ...a,
            blocks: [...(a.blocks ?? []), ...(b.blocks ?? [])],
            teacherNotes: a.teacherNotes || b.teacherNotes || '',
          }
          const next = [...prev.slice(0, idx), merged, ...prev.slice(idx + 2)]
          queueMicrotask(() => { if (curriculumId) void persistSlidesRef.current(next) })
          return next
        })
        setCurrentIndex((i) => (i === idx + 1 ? idx : i > idx + 1 ? i - 1 : i))
        toast({ title: tr('Đã gộp 2 slide', 'Merged 2 slides', '已合并2张幻灯片', '2スライドを結合', '2개 슬라이드 병합'), duration: 1500 })
      }
      else if (e.data?.type === 'split-slide' && typeof e.data?.index === 'number' && typeof e.data?.splitAtBlock === 'number') {
        const idx = e.data.index
        const splitAt = e.data.splitAtBlock
        setSlides((prev) => {
          const s = prev[idx]
          const blks = s?.blocks ?? []
          let firstBlocks: typeof blks
          let secondBlocks: typeof blks
          let secondHeader: string
          if (splitAt === -1 && blks.length === 1) {
            const singleBlock = blks[0]
            const content = singleBlock?.content ?? ''
            const split = splitBlockContentAtQuizBoundary(content)
            if (!split) return prev
            firstBlocks = [{ header: singleBlock?.header ?? 'Nội dung', content: split.before }]
            secondBlocks = [{ header: singleBlock?.header ?? s.title, content: split.after }]
            secondHeader = singleBlock?.header ?? s.title
          } else if (splitAt >= 0 && splitAt < blks.length - 1) {
            firstBlocks = blks.slice(0, splitAt + 1)
            secondBlocks = blks.slice(splitAt + 1)
            secondHeader = secondBlocks[0]?.header ?? s.title
          } else {
            return prev
          }
          const slide1: SlideItem = { ...s, blocks: firstBlocks }
          const slide2: SlideItem = { ...s, title: secondHeader, blocks: secondBlocks, teacherNotes: '', imageUrl: undefined, visualEmbed: undefined, visualLayout: undefined, visualCells: undefined }
          const next = [...prev.slice(0, idx), slide1, slide2, ...prev.slice(idx + 1)]
          return next
        })
        setCurrentIndex((i) => (i > idx ? i + 1 : i))
        toast({ title: tr('Đã tách slide', 'Split slide', '已拆分幻灯片', 'スライドを分割', '슬라이드 분할'), duration: 1500 })
      }
      else if (e.data?.type === 'update-slide-blocks' && typeof e.data?.slideIndex === 'number' && Array.isArray(e.data?.blocks)) {
        const idx = e.data.slideIndex
        const blocks = e.data.blocks
        setSlides((prev) => {
          if (idx < 0 || idx >= prev.length) return prev
          const next = prev.map((s, i) => i === idx ? { ...s, blocks, content: '' } : s)
          queueMicrotask(() => { if (curriculumId) void persistSlidesRef.current(next) })
          return next
        })
      }
      else if (e.data?.type === 'update-slide-title' && typeof e.data?.slideIndex === 'number' && typeof e.data?.title === 'string') {
        const idx = e.data.slideIndex
        const title = e.data.title
        setSlides((prev) => {
          if (idx < 0 || idx >= prev.length) return prev
          const next = prev.map((s, i) => i === idx ? { ...s, title } : s)
          queueMicrotask(() => { if (curriculumId) void persistSlidesRef.current(next) })
          return next
        })
      }
      else if (e.data?.type === 'save-slides-now') {
        setSlides((prev) => {
          if (curriculumId && prev.length > 0) queueMicrotask(() => void persistSlidesRef.current(prev))
          return prev
        })
      }
      else if (e.data?.type === 'delete-slide' && typeof e.data?.index === 'number') {
        const idx = e.data.index
        setSlides((prev) => {
          if (prev.length <= 1 || idx < 0 || idx >= prev.length) return prev
          const next = prev.filter((_, i) => i !== idx)
          queueMicrotask(() => { if (curriculumId) void persistSlidesRef.current(next) })
          return next
        })
        setCurrentIndex((i) => (i === idx && i > 0 ? i - 1 : i > idx ? i - 1 : i))
        toast({ title: tr('Đã xóa slide', 'Slide deleted', '已删除幻灯片', 'スライドを削除', '슬라이드 삭제됨'), duration: 1500 })
      }
    }
    window.addEventListener('message', handler)
    let channel: BroadcastChannel | null = null
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('tao-giao-trinh-sync')
      channel.addEventListener('message', (event) => {
        handler({ origin: window.location.origin, data: event.data } as MessageEvent)
      })
    }
    return () => {
      window.removeEventListener('message', handler)
      channel?.close()
    }
  }, [curriculumId, toast, tr])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'update-notes' && typeof e.data.slideIndex === 'number') {
        const idx = e.data.slideIndex
        const notes = typeof e.data.teacherNotes === 'string' ? e.data.teacherNotes : ''
        setSlides((prev) => {
          if (idx < 0 || idx >= prev.length) return prev
          const next = prev.map((s, i) => i === idx ? { ...s, teacherNotes: notes } : s)
          queueMicrotask(() => { if (curriculumId) void persistSlidesRef.current(next) })
          return next
        })
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [curriculumId])

  const applyEmbedToSlide = useCallback((sl: SlideItem, marker: string, placement: EmbedPlacement) => {
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
    setEmbedDialogOpen(false)
    const count = indicesToUpdate.size
    if (count > 1) {
      toast({ title: tr(`Đã chèn vào ${count} slide`, `Inserted into ${count} slides`, `已插入到${count}张幻灯片`, `${count}スライドに挿入`, `${count}개 슬라이드에 삽입`), duration: 1500 })
    }
    if (curriculumId) void persistSlidesRef.current(updatedSlides)
  }, [currentIndex, slides, curriculumId, applyEmbedToSlide, tr, toast])

  const handleDeleteVisual = useCallback((alsoApplyToSlideIndices?: number[]) => {
    const indicesToUpdate = new Set([currentIndex, ...(alsoApplyToSlideIndices ?? [])])
    const updatedSlides: SlideItem[] = slides.map((sl, i) => {
      if (!indicesToUpdate.has(i)) return sl
      return {
        ...sl,
        visualEmbed: undefined,
        imageUrl: undefined,
        visualLayout: 1 as 1 | 2 | 4,
        visualCells: undefined,
      }
    })
    setSlides(updatedSlides)
    setEmbedDialogOpen(false)
    toast({ title: tr('Đã xóa visual', 'Visual deleted', '已删除视觉', 'ビジュアルを削除', '비주얼 삭제됨'), duration: 1500 })
    if (curriculumId) void persistSlidesRef.current(updatedSlides)
  }, [currentIndex, slides, curriculumId, toast, tr])

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
    const count = indicesToUpdate.size
    toast({
      title: count > 1
        ? tr(`Đã thay visual ${count} slide`, `Visual replaced on ${count} slides`, `已替换${count}张幻灯片视觉`, `${count}スライドのビジュアルを差し替え`, `${count}개 슬라이드 비주얼 교체됨`)
        : tr('Đã thay visual slide', 'Slide visual replaced', '已替换幻灯片视觉', 'スライドのビジュアルを差し替えました', '슬라이드 비주얼 교체됨'),
      duration: 1500,
    })
    if (curriculumId) void persistSlidesRef.current(updatedSlides)
  }, [currentIndex, slides, curriculumId, toast, tr])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'insert-embed' && typeof e.data?.marker === 'string') {
        handleInsertEmbed(e.data.marker, e.data.placement ?? 'end', e.data.alsoApplyToSlideIndices)
      } else if (e.data?.type === 'replace-slide-image' && typeof e.data?.markerOrUrl === 'string') {
        handleReplaceSlideImage(e.data.markerOrUrl, e.data.alsoApplyToSlideIndices, e.data.layout ?? 1, e.data.cellIndex)
      } else if (e.data?.type === 'delete-visual') {
        handleDeleteVisual(e.data.alsoApplyToSlideIndices)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [handleInsertEmbed, handleReplaceSlideImage, handleDeleteVisual])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        goNext()
      }
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goNext, goPrev])

  useEffect(() => {
    if (!visualFullscreenOpen) return
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && !(document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement) {
        setVisualFullscreenOpen(false)
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('webkitfullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
      try {
        const isFs = document.fullscreenElement ?? (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement
        if (isFs) {
          const exitFs = document.exitFullscreen ?? (document as Document & { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen
          exitFs?.()?.catch(() => {})
        }
      } catch {
        /* ignore */
      }
    }
  }, [visualFullscreenOpen])

  useEffect(() => {
    setVisualFullscreenOpen(false)
  }, [currentIndex])

  useEffect(() => {
    if (!autoPlay || slides.length <= 1) return
    const id = window.setInterval(() => {
      setTransitionDirection('next')
      setCurrentIndex((i) => {
        const next = i >= slides.length - 1 ? 0 : i + 1
        if (presentationMode === 'slide-interaction' && typeof window !== 'undefined' && window.opener) {
          window.opener.postMessage({ type: 'slide-go', index: next }, window.location.origin)
        }
        return next
      })
    }, autoPlayIntervalMs)
    return () => window.clearInterval(id)
  }, [autoPlay, slides.length, autoPlayIntervalMs, presentationMode])

  const slide = slides[currentIndex]
  const blocks = (Array.isArray(slide?.blocks) && slide.blocks.length > 0) ? slide.blocks : (slide ? parseContentToBlocks(slide.content) : [])
  const hasBlocks = blocks.length > 0

  const { totalSegments, blockOffsets, blockLengths } = useMemo(() => {
    if (!slide) return { totalSegments: 0, blockOffsets: [] as number[], blockLengths: [] as number[] }
    const titleLen = slide.title.length
    if (hasBlocks) {
      const lens = blocks.map((b) => getContentSegmentCount(b.content))
      const offsets: number[] = []
      let acc = titleLen
      for (const l of lens) {
        offsets.push(acc)
        acc += l
      }
      return { totalSegments: acc, blockOffsets: offsets, blockLengths: lens }
    }
    const contentLen = getContentSegmentCount(slide.content ?? '')
    return { totalSegments: titleLen + contentLen, blockOffsets: [titleLen], blockLengths: [contentLen] }
  }, [slide, hasBlocks, blocks])

  useEffect(() => {
    if (!teacherWritingMode || totalSegments === 0) {
      setSlideVisibleCount(totalSegments)
      return
    }
    setSlideVisibleCount(0)
    let start = performance.now()
    let rafId: number
    const tick = (now: number) => {
      const elapsed = now - start
      const next = Math.min(Math.floor(elapsed / teacherWritingSpeedMs) + 1, totalSegments)
      setSlideVisibleCount(next)
      if (next < totalSegments) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [currentIndex, teacherWritingMode, teacherWritingSpeedMs, totalSegments])

  if (slides.length === 0) return null

  const gradient = DARK_GRADIENTS[currentIndex % DARK_GRADIENTS.length]

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div
        className={cn(
          'print:hidden',
          presentationMode === 'slide-interaction' && 'pointer-events-none border-b border-slate-700/80 bg-slate-900/80 backdrop-blur-sm'
        )}
      >
        <PresentationControlBar
          variant={presentationMode === 'slide-interaction' ? 'teacher' : 'student'}
          tr={tr}
          currentIndex={currentIndex}
          totalSlides={slides.length}
          teacherTimerSeconds={teacherTimerSeconds}
          teacherTimerRunning={teacherTimerRunning}
          teacherTimerInteractive={presentationMode === 'slide-interaction'}
          onTeacherTimerStart={presentationMode === 'slide-interaction' ? (() => {}) : undefined}
          onTeacherTimerStop={presentationMode === 'slide-interaction' ? (() => {}) : undefined}
          onTeacherTimerReset={presentationMode === 'slide-interaction' ? (() => {}) : undefined}
          curriculumId={curriculumId}
          onInsertClick={() => setEmbedDialogOpen(true)}
          writingMode={teacherWritingMode}
          onWritingModeToggle={() => setTeacherWritingMode((v) => !v)}
          writingSpeedMs={teacherWritingSpeedMs}
          onWritingSpeedChange={setTeacherWritingSpeedMs}
          autoPlay={autoPlay}
          onAutoPlayToggle={() => setAutoPlay((v) => !v)}
          autoPlayIntervalMs={autoPlayIntervalMs}
          onAutoPlayIntervalChange={setAutoPlayIntervalMs}
          sandTimerSeconds={timerSeconds}
          sandTimerRunning={timerRunning}
          onSandTimerStart={startTimer}
          onSandTimerToggle={toggleTimer}
          onSandTimerReset={resetTimer}
          onPrev={goPrev}
          onNext={goNext}
          onPrint={presentationMode === 'slide-interaction' ? undefined : () => window.print()}
          onClose={presentationMode === 'slide-interaction' ? undefined : onClose}
          slideViewMode={undefined}
          onSlideViewModeChange={undefined}
          onOpenStudentView={undefined}
          highlightedControl={null}
          hideTeacherTimer
          hideInsert
          printHidden={false}
        />
        {presentationMode === 'slide-interaction' && (
          // Hàng đệm để trùng trục Y với hàng thông tin riêng của giao diện giáo viên.
          <div className="h-[42px] border-t border-slate-700/60 bg-slate-900/50" />
        )}
      </div>

      {/* Chuột ảo + đường di chuột – chế độ tương tác slide */}
      {presentationMode === 'slide-interaction' && (
        <>
          {mouseTrail.length > 1 && (
            <svg className="fixed inset-0 z-[118] pointer-events-none" style={{ width: '100%', height: '100%' }}>
              <polyline
                points={mouseTrail.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="rgba(255,200,100,0.5)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {virtualMousePos && (
            <div
              className="fixed z-[120] pointer-events-none transition-all duration-75"
              style={{ left: virtualMousePos.x, top: virtualMousePos.y, transform: 'translate(-2px, -2px)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="drop-shadow-lg">
                <path d="M4 4l7 16 2.5-6 5.5-2.5L4 4z" fill="white" stroke="rgba(0,0,0,0.6)" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
            </div>
          )}
          {mouseClicks.map((p) => (
            <div
              key={p.id}
              className="fixed z-[119] pointer-events-none"
              style={{ left: p.x, top: p.y, transform: 'translate(-50%, -50%)' }}
            >
              <span className="block h-12 w-12 rounded-full border-2 border-amber-300/90 animate-ping" />
            </div>
          ))}
        </>
      )}

      <EmbedInsertDialog
        open={embedDialogOpen}
        onOpenChange={setEmbedDialogOpen}
        onInsert={(marker, placement, alsoTo) => handleInsertEmbed(marker, placement, alsoTo)}
        onReplaceSlideImage={handleReplaceSlideImage}
        onDeleteVisual={handleDeleteVisual}
        tr={tr}
        highZIndex
        blocks={slide.blocks ?? parseContentToBlocks(slide.content)}
        slides={slides.map((s) => ({ title: s.title }))}
        currentSlideIndex={currentIndex}
        currentVisual={getVisualCells(slide)}
      />
      <QuizPopupDialog
        open={quizPopupOpen}
        onOpenChange={setQuizPopupOpen}
        slide={slide}
        slideIndex={currentIndex}
        curriculumId={curriculumId}
        tr={tr}
        teacherMode={false}
        onGenerateQuiz={undefined}
        onReplaceBrokenQuiz={undefined}
        quizGenLoading={false}
      />
      {/* Fullscreen overlay cho visual slide – phần làm việc to hết khung hình */}
      {visualFullscreenOpen && (() => {
        const { layout, cells } = getVisualCells(slide)
        const hasAny = cells.some((c) => c.visualEmbed || c.imageUrl)
        if (!hasAny) return null
        const showSingleCell = expandedCellIndex != null && layout > 1
        const displayCells = showSingleCell && cells[expandedCellIndex] ? [cells[expandedCellIndex]] : cells
        const displayIndices = showSingleCell && expandedCellIndex != null ? [expandedCellIndex] : cells.map((_, i) => i)
        const gridClass = !showSingleCell && layout === 2 ? 'grid grid-rows-2 gap-2' : !showSingleCell && layout === 4 ? 'grid grid-cols-2 grid-rows-2 gap-2' : ''
        const renderCell = (cell: { visualEmbed?: string; imageUrl?: string }, idx: number, label: string) => (
          <div key={idx} className="flex-1 min-h-0 relative rounded-xl overflow-hidden bg-black/30 border border-white/10" onClick={(e) => e.stopPropagation()}>
            <span className="absolute top-2 left-2 z-10 px-2 py-1 rounded bg-black/60 text-white text-sm font-mono">{label}</span>
            {cell.visualEmbed ? (
              (() => {
                const embeds = parseContentEmbeds(cell.visualEmbed)
                const first = embeds[0]
                if (!first) return <div className="w-full h-full" />
                return <div className="w-full h-full"><ContentEmbed type={first.type} urlOrId={first.urlOrId} tr={tr} hideQuiz fill className="!my-0 !rounded-xl !border-0" /></div>
              })()
            ) : cell.imageUrl ? (
              <img src={cell.imageUrl} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-white/5" />
            )}
          </div>
        )
        return (
          <div
            ref={fullscreenOverlayRef}
            className="fixed inset-0 z-[105] bg-black flex flex-col outline-none"
            onClick={closeVisualFullscreen}
            aria-label={tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}
          >
            <div className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-4 bg-black/70 z-20 shrink-0">
              <span className="text-white/80 text-sm">
                {tr('Nhấn Esc hoặc click vùng tối để thoát', 'Press Esc or click dark area to exit', '按Esc或点击暗区退出', 'Escまたは暗い部分をクリックで終了', 'Esc 또는 어두운 영역 클릭으로 종료')}
              </span>
              {timerSeconds > 0 && (
                <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/50', timerRunning && timerSeconds <= 30 && 'animate-pulse')}>
                  <Timer className="h-4 w-4 text-amber-400" />
                  <span className={cn('font-mono font-bold', timerSeconds <= 30 && 'text-amber-300')}>{formatTimer(timerSeconds)}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                {showSingleCell && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setExpandedCellIndex(null) }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white font-medium transition-colors"
                    title={tr('Mở rộng tất cả', 'Expand all', '展开全部', 'すべて展開', '모두 확장')}
                  >
                    <Maximize2 className="h-4 w-4" />
                    {tr('Mở rộng tất cả', 'Expand all', '展开全部', 'すべて展開', '모두 확장')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); closeVisualFullscreen() }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white font-medium transition-colors"
                  title={tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}
                >
                  <X className="h-5 w-5" />
                  {tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 relative cursor-pointer px-4 pb-4 pt-14 flex flex-col">
              <div ref={studentVisualFrameRef} className={cn('flex-1 min-h-0 overflow-hidden', showSingleCell || layout === 1 ? 'flex flex-col' : gridClass)}>
              {displayCells.map((cell, i) => renderCell(cell, i, `${currentIndex + 1}-${displayIndices[i] + 1}`))}
              </div>
            </div>
          </div>
        )
      })()}
      {/* Đồng hồ cát nổi – học sinh thấy khi giáo viên chia sẻ màn hình */}
      {timerSeconds > 0 && (
        <div className={cn('fixed bottom-6 right-6 z-[102] flex items-center gap-2 px-4 py-2 rounded-xl bg-black/80 text-white shadow-xl border border-amber-400/50', timerRunning && timerSeconds <= 30 && 'animate-pulse')}>
          <Timer className="h-5 w-5 text-amber-400 shrink-0" />
          <span className={cn('font-mono text-xl font-bold tabular-nums', timerSeconds <= 30 && 'text-amber-300')}>{formatTimer(timerSeconds)}</span>
        </div>
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
        {/* Trái: Ảnh/embed minh họa – có thể chia 1, 2 hoặc 4 ô */}
        <div className="w-[45%] min-w-[300px] relative overflow-hidden" style={{ background: gradient }}>
          <div className="absolute top-4 left-4 w-9 h-9 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-sm shadow-lg z-10">
            {currentIndex + 1}
          </div>
          {(() => {
            const { layout, cells } = getVisualCells(slide)
            const slideNum = currentIndex + 1
            const hasAnyContent = cells.some((c) => c.visualEmbed || c.imageUrl)
            const gridClass = layout === 2 ? 'grid grid-rows-2 gap-1' : layout === 4 ? 'grid grid-cols-2 grid-rows-2 gap-1' : ''
            return (
              <>
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
                              onClick={(e) => { e.stopPropagation(); openVisualFullscreen(idx) }}
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
                {hasAnyContent && (
                  <>
                    <button
                      type="button"
                      onClick={() => openVisualFullscreen()}
                      className="absolute top-4 right-4 opacity-60 hover:opacity-100 p-1.5 rounded-md bg-black/60 text-white hover:bg-black/80 shadow-lg print:hidden z-10"
                      title={tr('Mở rộng tất cả', 'Expand all', '展开全部', 'すべて展開', '모두 확장')}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </>
            )
          })()}
        </div>

        {/* Phải: Nội dung chính – chữ to hơn */}
        <div className="flex-1 flex flex-col justify-start p-8 md:p-12 overflow-y-auto bg-white">
          <div className="mb-6 flex items-start gap-2 flex-wrap">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 flex-1">
              {teacherWritingMode ? (
                <AnimatedCharReveal
                  text={slide.title}
                  visibleCount={Math.min(slideVisibleCount, slide.title.length)}
                  showCursor={slideVisibleCount > 0 && slideVisibleCount < slide.title.length}
                />
              ) : (
                slide.title
              )}
            </h2>
            {extractQuizFromSlide(slide).length > 0 ? (
              <Button variant="outline" size="sm" onClick={() => setQuizPopupOpen(true)} className="shrink-0 border-violet-400 text-violet-700 hover:bg-violet-50 print:hidden mt-2">
                <ClipboardList className="h-4 w-4 mr-1.5" />
                {tr('Xem câu hỏi trắc nghiệm', 'View quiz', '查看测验', 'クイズを見る', '퀴즈 보기')}
              </Button>
            ) : null}
          </div>
          {hasBlocks ? (
            <div className="space-y-4">
              {blocks.map((b, i) => (
                <div key={i} className="flex rounded-lg overflow-hidden bg-white shadow-sm border border-slate-100">
                  <div className="w-24 min-w-[96px] bg-violet-100 flex flex-col items-center justify-center p-3">
                    <div className="text-violet-600">
                      {getIconForHeader(b.header)}
                    </div>
                    <div className="mt-2 w-full flex flex-col items-center gap-0.5">
                      <span className="text-xs font-bold text-violet-700 text-center leading-tight">
                        {b.header}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 p-5 text-slate-800">
                    <BlockContentWithEmbeds
                      content={b.content}
                      liveQuizContext={curriculumId ? { curriculumId, slideIndex: currentIndex, blockIndex: i } : undefined}
                      tr={tr}
                      hideQuiz
                      animateReveal={teacherWritingMode}
                      visibleCountInBlock={teacherWritingMode ? Math.max(0, Math.min(blockLengths[i] ?? 0, slideVisibleCount - (blockOffsets[i] ?? 0))) : undefined}
                      wordDelayMs={teacherWritingSpeedMs}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : slide.content ? (
            <div className="text-slate-700 text-base md:text-lg leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2">
              <BlockContentWithEmbeds
                content={slide.content}
                liveQuizContext={curriculumId ? { curriculumId, slideIndex: currentIndex, blockIndex: 0 } : undefined}
                tr={tr}
                hideQuiz
                animateReveal={teacherWritingMode}
                visibleCountInBlock={teacherWritingMode ? Math.max(0, Math.min(blockLengths[0] ?? 0, slideVisibleCount - (blockOffsets[0] ?? 0))) : undefined}
                wordDelayMs={teacherWritingSpeedMs}
              />
            </div>
          ) : null}
          {/* Ghi chú chỉ sửa trong cửa sổ Giáo trình – không hiển thị trên slide cho học sinh */}
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
                {(() => {
                  const { layout, cells } = getVisualCells(s)
                  const gridClass = layout === 2 ? 'grid grid-rows-2 gap-1' : layout === 4 ? 'grid grid-cols-2 grid-rows-2 gap-1' : ''
                  const hasAny = cells.some((c) => c.visualEmbed || c.imageUrl)
                  if (!hasAny) {
                    return (
                      <div className="w-48 h-48 rounded-2xl bg-white/5 flex items-center justify-center">
                        <div className="w-3/4 h-3/4 border-2 border-white/30 rounded-full" />
                      </div>
                    )
                  }
                  return (
                    <div className={cn('w-full h-48 grid gap-1', gridClass)}>
                      {cells.map((cell, idx) => (
                        <div key={idx} className="relative rounded-lg overflow-hidden border border-white/10">
                          <span className="absolute top-0.5 left-0.5 text-[10px] font-mono text-white/90 bg-black/50 px-1 rounded">
                            {i + 1}-{idx + 1}
                          </span>
                          {cell.visualEmbed ? (
                            (() => {
                              const embeds = parseContentEmbeds(cell.visualEmbed)
                              const first = embeds[0]
                              if (!first) return <div className="w-full h-full min-h-[40px] bg-white/5" />
                              return (
                                <div className="w-full h-full min-h-[40px]">
                                  <ContentEmbed type={first.type} urlOrId={first.urlOrId} width={120} height={90} tr={tr} hideQuiz />
                                </div>
                              )
                            })()
                          ) : cell.imageUrl ? (
                            <img src={cell.imageUrl} alt="" className="w-full h-full min-h-[40px] object-cover" />
                          ) : (
                            <div className="w-full h-full min-h-[40px] bg-white/5" />
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })()}
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
                            <BlockContentWithEmbeds content={b.content} tr={tr} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : s.content ? (
                  <div className="text-slate-700 text-base [&_ul]:list-disc [&_ul]:pl-5">
                    <BlockContentWithEmbeds content={s.content} tr={tr} />
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
