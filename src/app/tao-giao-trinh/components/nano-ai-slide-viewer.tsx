'use client'
/* eslint-disable @next/next/no-img-element -- slide/editor previews rely on dynamic/blob URLs */

import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X, ArrowRight, TrendingUp, CalendarCheck, Lightbulb, BookOpen, Target, ClipboardList, Maximize2, MonitorPlay, Timer, Link2, Copy, ExternalLink, FileText, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import QRCode from 'qrcode'
import { cn } from '@/lib/utils'
import { parseCurriculumToSlides, parseContentToBlocks, type AISlideData } from '../lib/curriculum-to-slides'
import { latexToReadable } from '../lib/latex-to-readable'
import { ContentEmbed, parseContentEmbeds, splitBlockContentAtQuizBoundary } from './content-embed'
import { AnimatedCharReveal } from './animated-char-reveal'
import { CurriculumBlockContentWithEmbeds } from './curriculum-block-content-with-embeds'
import { WorksheetBlockContentWithEmbeds } from './worksheet-block-content-with-embeds'
import { EmbedInsertDialog } from './embed-insert-dialog'
import { PresentationControlBar } from './presentation-control-bar'
import { QuizPopupDialog, extractQuizFromSlide } from './quiz-popup-dialog'
import { useToast } from '@/hooks/use-toast'
import { saveSlidesToCurriculum, saveUserCustomizedSlides } from '../actions'
import { useScreenShare } from '../hooks/use-screen-share'
import { curriculumSlideTitleRevealKey, findFirstSequentialSolutionBlockIndex, worksheetAnswerSegmentCount } from '../lib/worksheet-answer-segments'
import { getInfographicStrokeBucketKey, type SlideInfographic } from '../lib/slide-infographic'
import {
  applyInfographicToDefaultVisualCells,
  skipInfographicDefaultSwapNano,
  visualImageIsCurriculumInfographic,
} from '../lib/default-visual-image'
import { getOrCreatePresentationSyncId, getPresentationBroadcastChannelName, LEGACY_PRESENTATION_BROADCAST_CHANNEL } from '../lib/presentation-broadcast'
import { getStudentSlideWindowConfig, isPathMatchingStudentSlideKind, moveWindowToExternalScreen, studentSlideUrlWithSync, STUDENT_WINDOW_NAME_CURRICULUM, STUDENT_WINDOW_NAME_WORKSHEET } from '../lib/student-slide-window'
import { TEACHER_SLIDE_WINDOW_TARGET_NAME } from '@/lib/tao-giao-trinh/teacher-slide-window'

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

type MemoryProbeSnapshot = {
  heapUsedMb: number | null
  heapTotalMb: number | null
  heapLimitMb: number | null
  heapGrowthMbPerMin: number | null
  domNodes: number
  iframeCount: number
  imageCount: number
  canvasCount: number
}

type MemoryProbeDetails = {
  slidesApproxMb: number
  largestSlideMb: number
  largestSlideIndex: number | null
  curriculumPayloadLastMb: number | null
  curriculumPayloadAvgMb: number | null
  curriculumPayloadSendsPerMin: number
  curriculumPayloadPeakMb: number | null
  curriculumPayloadPeakType: string | null
  heapPeakMb: number | null
}

const BYTES_PER_MB = 1024 * 1024

function bytesToMb(value: number): number {
  return Math.round((value / BYTES_PER_MB) * 10) / 10
}

function formatMb(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'n/a'
  return `${value.toFixed(1)} MB`
}

function useMemoryProbe(enabled: boolean): MemoryProbeSnapshot | null {
  const [snapshot, setSnapshot] = useState<MemoryProbeSnapshot | null>(null)
  const historyRef = useRef<Array<{ at: number; usedBytes: number | null }>>([])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const collect = () => {
      if (cancelled) return
      const perfLike = performance as Performance & {
        memory?: {
          usedJSHeapSize?: number
          totalJSHeapSize?: number
          jsHeapSizeLimit?: number
        }
      }
      const usedBytesRaw = Number(perfLike.memory?.usedJSHeapSize ?? NaN)
      const totalBytesRaw = Number(perfLike.memory?.totalJSHeapSize ?? NaN)
      const limitBytesRaw = Number(perfLike.memory?.jsHeapSizeLimit ?? NaN)
      const usedBytes = Number.isFinite(usedBytesRaw) ? usedBytesRaw : null
      const totalBytes = Number.isFinite(totalBytesRaw) ? totalBytesRaw : null
      const limitBytes = Number.isFinite(limitBytesRaw) ? limitBytesRaw : null
      const now = Date.now()

      historyRef.current.push({ at: now, usedBytes })
      // Keep ~2 minutes if polling every 2s.
      if (historyRef.current.length > 60) {
        historyRef.current = historyRef.current.slice(historyRef.current.length - 60)
      }
      const validHistory = historyRef.current.filter((x) => x.usedBytes != null) as Array<{
        at: number
        usedBytes: number
      }>
      let growthMbPerMin: number | null = null
      if (validHistory.length >= 2) {
        const first = validHistory[0]
        const last = validHistory[validHistory.length - 1]
        const dtMs = Math.max(1, last.at - first.at)
        const dBytes = last.usedBytes - first.usedBytes
        growthMbPerMin = bytesToMb((dBytes / dtMs) * 60000)
      }

      setSnapshot({
        heapUsedMb: usedBytes == null ? null : bytesToMb(usedBytes),
        heapTotalMb: totalBytes == null ? null : bytesToMb(totalBytes),
        heapLimitMb: limitBytes == null ? null : bytesToMb(limitBytes),
        heapGrowthMbPerMin: growthMbPerMin,
        domNodes: document.getElementsByTagName('*').length,
        iframeCount: document.getElementsByTagName('iframe').length,
        imageCount: document.getElementsByTagName('img').length,
        canvasCount: document.getElementsByTagName('canvas').length,
      })
      const usedMb = usedBytes == null ? null : bytesToMb(usedBytes)
      const pressureFromGrowth =
        usedMb != null &&
        growthMbPerMin != null &&
        usedMb > 1200 &&
        growthMbPerMin > 80
      const pressureFromLimit =
        usedMb != null &&
        limitBytes != null &&
        usedBytes != null &&
        usedBytes / limitBytes > 0.7
      if (pressureFromGrowth || pressureFromLimit) {
        window.dispatchEvent(
          new CustomEvent('nano-slide-memory-pressure', {
            detail: {
              heapUsedMb: usedMb,
              heapGrowthMbPerMin: growthMbPerMin,
            },
          })
        )
      }
    }

    collect()
    const id = window.setInterval(collect, 2000)
    return () => {
      cancelled = true
      window.clearInterval(id)
      historyRef.current = []
    }
  }, [enabled])

  return snapshot
}

function MemoryDebugHud({
  enabled,
  snapshot,
  details,
  slideCount,
  currentIndex,
}: {
  enabled: boolean
  snapshot: MemoryProbeSnapshot | null
  details: MemoryProbeDetails
  slideCount: number
  currentIndex: number
}) {
  if (!enabled || !snapshot) return null
  const growth = snapshot.heapGrowthMbPerMin
  const growthLabel = growth == null ? 'n/a' : `${growth >= 0 ? '+' : ''}${growth.toFixed(2)} MB/min`
  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-[80] rounded-md border border-white/20 bg-black/80 px-3 py-2 text-[11px] text-white shadow-xl print:hidden">
      <div className="font-semibold">Memory Probe</div>
      <div>Heap: {formatMb(snapshot.heapUsedMb)} / {formatMb(snapshot.heapTotalMb)} (limit {formatMb(snapshot.heapLimitMb)})</div>
      <div>Heap growth: {growthLabel}</div>
      <div>DOM: {snapshot.domNodes} | iframe: {snapshot.iframeCount} | img: {snapshot.imageCount} | canvas: {snapshot.canvasCount}</div>
      <div>Slides mem: {details.slidesApproxMb.toFixed(1)} MB | largest: {details.largestSlideMb.toFixed(1)} MB ({details.largestSlideIndex != null ? `#${details.largestSlideIndex + 1}` : 'n/a'})</div>
      <div>Payload: last {formatMb(details.curriculumPayloadLastMb)} | avg {formatMb(details.curriculumPayloadAvgMb)} | sends/min {details.curriculumPayloadSendsPerMin}</div>
      <div>Peak: heap {formatMb(details.heapPeakMb)} | payload {formatMb(details.curriculumPayloadPeakMb)} {details.curriculumPayloadPeakType ? `(${details.curriculumPayloadPeakType})` : ''}</div>
      <div>Slides: {slideCount} | index: {currentIndex + 1}</div>
    </div>
  )
}

/** Nút "Trình chiếu HS" trên cửa sổ GV: focus + gửi tín hiệu yêu cầu fullscreen sang cửa sổ HS. */
function ProjectorRemoteButton({
  getStudentWindow,
  tr,
}: {
  getStudentWindow: () => Window | null
  tr?: (vi: string, en: string, zh: string, ja: string, ko: string) => string
}) {
  const t = (vi: string, en: string, zh: string, ja: string, ko: string) =>
    typeof tr === 'function' ? tr(vi, en, zh, ja, ko) : vi
  const handleClick = useCallback(async () => {
    if (typeof window === 'undefined') return
    const w = getStudentWindow()
    if (!w || w.closed) {
      try {
        // Eslint cho phép alert ở đây (UX fallback hiếm gặp).
        // eslint-disable-next-line no-alert
        window.alert(t(
          'Hãy mở giao diện học sinh trước (nút "Mở giao diện học sinh").',
          'Open the student window first ("Open student view" button).',
          '请先打开学生界面（"打开学生界面"按钮）。',
          '先に生徒画面を開いてください（「生徒画面を開く」ボタン）。',
          '먼저 학생 화면을 여세요 ("학생 화면 열기" 버튼).'
        ))
      } catch {
        /* ignore */
      }
      return
    }
    try { await moveWindowToExternalScreen(w) } catch { /* ignore */ }
    try { w.focus() } catch { /* ignore */ }
    try {
      w.postMessage({ type: 'request-projector-mode' }, window.location.origin)
    } catch { /* ignore */ }
  }, [getStudentWindow, t])
  return (
    <button
      type="button"
      onClick={handleClick}
      title={t(
        'Bật trình chiếu cho cửa sổ học sinh (toàn màn hình cho máy chiếu)',
        'Enable projector mode on student window (fullscreen for projector)',
        '在学生窗口开启投影（全屏适配投影仪）',
        '生徒画面で投影モード（フルスクリーン）',
        '학생 화면 투영 모드 (전체 화면)'
      )}
      className="fixed bottom-3 right-3 z-[120] inline-flex items-center gap-2 rounded-lg border border-white/20 bg-violet-700/90 px-3 py-2 text-xs font-semibold text-white shadow-xl hover:bg-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-300 print:hidden"
    >
      <MonitorPlay className="h-4 w-4" />
      <span className="hidden sm:inline">{t('Trình chiếu HS', 'Project to student', '投影至学生', '生徒画面投影', '학생 화면 투영')}</span>
    </button>
  )
}

function MemoryDebugHudRuntime({
  enabled,
  slides,
  payloadStatsRef,
  slideCount,
  currentIndex,
  logPeaks,
}: {
  enabled: boolean
  slides: SlideItem[]
  payloadStatsRef: React.MutableRefObject<{
    events: Array<{ at: number; bytes: number; type: string }>
    lastBytes: number | null
    lastType: string | null
    peakBytes: number | null
    peakType: string | null
    peakHeapMb: number | null
  }>
  slideCount: number
  currentIndex: number
  logPeaks: boolean
}) {
  const snapshot = useMemoryProbe(enabled)
  const slideMemoryStats = useMemo(() => estimateSlidesMemory(slides), [slides])

  useEffect(() => {
    const heapNow = snapshot?.heapUsedMb
    if (heapNow == null || !Number.isFinite(heapNow)) return
    const prevPeak = payloadStatsRef.current.peakHeapMb
    if (prevPeak == null || heapNow > prevPeak) {
      payloadStatsRef.current.peakHeapMb = heapNow
      if (logPeaks) {
        try {
          console.info('[MemoryProbe] heap peak', { heapMb: Number(heapNow.toFixed(1)) })
        } catch {
          /* ignore */
        }
      }
    }
  }, [snapshot?.heapUsedMb, payloadStatsRef, logPeaks])

  const details = useMemo<MemoryProbeDetails>(() => {
    const now = Date.now()
    const freshEvents = payloadStatsRef.current.events.filter((e) => now - e.at <= 60_000)
    payloadStatsRef.current.events = freshEvents
    const avgBytes = freshEvents.length > 0
      ? freshEvents.reduce((sum, e) => sum + e.bytes, 0) / freshEvents.length
      : null
    return {
      slidesApproxMb: bytesToMb(slideMemoryStats.totalBytes),
      largestSlideMb: bytesToMb(slideMemoryStats.largestBytes),
      largestSlideIndex: slideMemoryStats.largestIndex,
      curriculumPayloadLastMb:
        payloadStatsRef.current.lastBytes == null
          ? null
          : bytesToMb(payloadStatsRef.current.lastBytes),
      curriculumPayloadAvgMb: avgBytes == null ? null : bytesToMb(avgBytes),
      curriculumPayloadSendsPerMin: freshEvents.length,
      curriculumPayloadPeakMb:
        payloadStatsRef.current.peakBytes == null
          ? null
          : bytesToMb(payloadStatsRef.current.peakBytes),
      curriculumPayloadPeakType: payloadStatsRef.current.peakType,
      heapPeakMb: payloadStatsRef.current.peakHeapMb,
    }
  }, [payloadStatsRef, slideMemoryStats])

  return (
    <MemoryDebugHud
      enabled={enabled}
      snapshot={snapshot}
      details={details}
      slideCount={slideCount}
      currentIndex={currentIndex}
    />
  )
}

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

function LazyHeavyMount({
  children,
  render,
  minHeight = 140,
  rootMargin = '220px 0px',
  keepMountedOnceVisible = false,
}: {
  children?: ReactNode
  render?: () => ReactNode
  minHeight?: number
  rootMargin?: string
  keepMountedOnceVisible?: boolean
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [hasEverBeenVisible, setHasEverBeenVisible] = useState(false)

  useEffect(() => {
    const node = hostRef.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true)
      return
    }
    let cancelled = false
    const observer = new IntersectionObserver(
      (entries) => {
        if (cancelled) return
        const nextVisible = entries.some((entry) => entry.isIntersecting)
        setIsVisible(nextVisible)
        if (nextVisible) setHasEverBeenVisible(true)
      },
      { root: null, rootMargin, threshold: 0.01 }
    )
    observer.observe(node)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [rootMargin])

  return (
    <div ref={hostRef} className="w-full h-full">
      {isVisible || (keepMountedOnceVisible && hasEverBeenVisible) ? (
        render ? render() : children
      ) : (
        <div
          className="h-full w-full rounded-md border border-white/10 bg-slate-800/25"
          style={{ minHeight }}
          aria-hidden
        />
      )}
    </div>
  )
}

/** Dựng SVG path mượt cho trail chuột ảo - quadraticCurveTo qua midpoint như luồng infographic. */
function buildSmoothMouseTrailPath(points: Array<{ x: number; y: number }>): string {
  if (!points || points.length < 2) return ''
  if (points.length === 2) {
    const [a, b] = points
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`
  }
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i += 1) {
    const p = points[i]
    const pn = points[i + 1]
    const xc = (p.x + pn.x) / 2
    const yc = (p.y + pn.y) / 2
    d += ` Q ${p.x} ${p.y} ${xc} ${yc}`
  }
  const last = points[points.length - 1]
  const prev = points[points.length - 2]
  d += ` Q ${prev.x} ${prev.y} ${last.x} ${last.y}`
  return d
}

function clamp01(n: number): number {
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

function densifyStrokePoints(last: InfographicDrawPoint, next: InfographicDrawPoint): InfographicDrawPoint[] {
  const dx = next.u - last.u
  const dy = next.v - last.v
  const dist = Math.hypot(dx, dy)
  // normalized 0..1 space; smaller step reduces visible broken segments
  const step = 0.003
  const segments = Math.max(1, Math.ceil(dist / step))
  if (segments <= 1) return [{ u: clamp01(next.u), v: clamp01(next.v) }]
  const pts: InfographicDrawPoint[] = []
  for (let i = 1; i <= segments; i += 1) {
    const t = i / segments
    pts.push({
      u: clamp01(last.u + dx * t),
      v: clamp01(last.v + dy * t),
    })
  }
  return pts
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

function getIconForHeader(header: string): React.ReactNode {
  const key = header.toLowerCase().trim()
  for (const [k, icon] of Object.entries(ICON_MAP)) {
    if (key.includes(k) || k.includes(key)) return icon
  }
  return <BookOpen className="h-5 w-5" />
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
  visualInput1?: string
  visualInput2?: string
  visualInput3?: string
  visualInput4?: string
}

function estimateTextBytes(value: unknown): number {
  return typeof value === 'string' ? value.length * 2 : 0
}

function estimateSlideBytes(slide: {
  title?: unknown
  content?: unknown
  teacherNotes?: unknown
  imageUrl?: unknown
  visualEmbed?: unknown
  visualInput1?: unknown
  visualInput2?: unknown
  visualInput3?: unknown
  visualInput4?: unknown
  blocks?: Array<{ header?: unknown; content?: unknown }>
  visualCells?: Array<{ visualEmbed?: unknown; imageUrl?: unknown }>
}): number {
  let bytes = 0
  bytes += estimateTextBytes(slide.title)
  bytes += estimateTextBytes(slide.content)
  bytes += estimateTextBytes(slide.teacherNotes)
  bytes += estimateTextBytes(slide.imageUrl)
  bytes += estimateTextBytes(slide.visualEmbed)
  bytes += estimateTextBytes(slide.visualInput1)
  bytes += estimateTextBytes(slide.visualInput2)
  bytes += estimateTextBytes(slide.visualInput3)
  bytes += estimateTextBytes(slide.visualInput4)
  const blocks = Array.isArray(slide.blocks) ? slide.blocks : []
  for (const b of blocks) {
    bytes += estimateTextBytes(b?.header)
    bytes += estimateTextBytes(b?.content)
  }
  const cells = Array.isArray(slide.visualCells) ? slide.visualCells : []
  for (const c of cells) {
    bytes += estimateTextBytes(c?.visualEmbed)
    bytes += estimateTextBytes(c?.imageUrl)
  }
  // Structural overhead per slide.
  return bytes + 512
}

function estimateSlidesMemory(slides: SlideItem[]): {
  totalBytes: number
  largestBytes: number
  largestIndex: number | null
} {
  let totalBytes = 0
  let largestBytes = 0
  let largestIndex: number | null = null
  for (let i = 0; i < slides.length; i += 1) {
    const current = estimateSlideBytes(slides[i] ?? {})
    totalBytes += current
    if (current > largestBytes) {
      largestBytes = current
      largestIndex = i
    }
  }
  return { totalBytes, largestBytes, largestIndex }
}

function slideWireDigestKey(slide: {
  title?: unknown
  blocks?: Array<{ header?: unknown; content?: unknown }>
  imageUrl?: unknown
  visualEmbed?: unknown
  visualCells?: Array<{ visualEmbed?: unknown; imageUrl?: unknown }>
}): string {
  const blocks = Array.isArray(slide.blocks) ? slide.blocks.length : 0
  const cells = Array.isArray(slide.visualCells) ? slide.visualCells.length : 0
  return [
    String(slide.title ?? '').length,
    blocks,
    cells,
    String(slide.imageUrl ?? '').length,
    String(slide.visualEmbed ?? '').length,
  ].join(':')
}

type InfographicDrawTool = 'pen' | 'eraser'
type InfographicDrawPoint = { u: number; v: number }
type InfographicDrawStroke = {
  id: string
  tool: InfographicDrawTool
  color: string
  sizeNorm: number
  points: InfographicDrawPoint[]
}

const STUDENT_SLIDE_CHUNK_SIZE = 2
const STUDENT_CHUNK_RADIUS = 0

function pruneStudentSlidesByChunk(
  slides: SlideItem[],
  currentIndex: number,
  options?: { keepFullTextForAllSlides?: boolean },
): SlideItem[] {
  if (!Array.isArray(slides) || slides.length <= 0) return slides
  const chunkSize = STUDENT_SLIDE_CHUNK_SIZE
  const radius = STUDENT_CHUNK_RADIUS
  const currentChunk = Math.floor(Math.max(0, currentIndex) / chunkSize)
  const keepStart = Math.max(0, (currentChunk - radius) * chunkSize)
  const keepEnd = Math.min(slides.length - 1, ((currentChunk + radius + 1) * chunkSize) - 1)
  const keepFullTextForAllSlides = options?.keepFullTextForAllSlides === true

  return slides.map((s, idx) => {
    if (idx >= keepStart && idx <= keepEnd) return s
    // Giữ text/title để UI không đổi, bỏ payload visual nặng ở slide xa.
    const light: SlideItem = {
      ...s,
      imageUrl: undefined,
      visualEmbed: undefined,
      visualCells: undefined,
      visualInput1: undefined,
      visualInput2: undefined,
      visualInput3: undefined,
      visualInput4: undefined,
    }
    // Ở chế độ "một slide", có thể bỏ thêm text/blocks của slide xa để giảm heap rõ rệt.
    if (!keepFullTextForAllSlides) {
      light.blocks = undefined
      light.content = ''
    }
    return light
  })
}

/** Chuẩn hóa điểm vẽ theo vùng ảnh object-contain trong một stage (mọi chỗ hiển thị infographic). */
function resolveInfographicPointerPointForStage(
  stage: HTMLElement,
  clientX: number,
  clientY: number,
): { u: number; v: number; vis: { left: number; top: number; width: number; height: number } } | null {
  const img = stage.querySelector('img') as HTMLImageElement | null
  if (!img || !img.complete || img.naturalWidth <= 0) return null
  const vis = getVisibleImageBounds(img)
  if (vis.width <= 0 || vis.height <= 0) return null
  if (
    clientX < vis.left ||
    clientX > vis.left + vis.width ||
    clientY < vis.top ||
    clientY > vis.top + vis.height
  ) {
    return null
  }
  const u = clamp01((clientX - vis.left) / vis.width)
  const v = clamp01((clientY - vis.top) / vis.height)
  return { u, v, vis }
}

/** Vẽ toàn bộ nét slide hiện tại lên một canvas trong stage — gọi cho mọi `[data-infographic-draw-pane-stage]`. */
function paintInfographicStrokesOnStage(stage: HTMLElement, strokes: InfographicDrawStroke[]): boolean {
  const img = stage.querySelector('img') as HTMLImageElement | null
  const canvas = stage.querySelector('[data-infographic-draw-pane-canvas]') as HTMLCanvasElement | null
  if (!img || !canvas) return false
  if (!img.complete || img.naturalWidth <= 0) return false
  const vis = getVisibleImageBounds(img)
  if (vis.width <= 0 || vis.height <= 0) return false
  const cr = stage.getBoundingClientRect()
  if (cr.width < 2 || cr.height < 2) return false
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const left = vis.left - cr.left
  const top = vis.top - cr.top
  canvas.style.left = `${left}px`
  canvas.style.top = `${top}px`
  canvas.style.width = `${vis.width}px`
  canvas.style.height = `${vis.height}px`
  const rawPixels = Math.max(1, vis.width * vis.height * dpr * dpr)
  const pixelScale = rawPixels > INFOGRAPHIC_MAX_CANVAS_PIXELS
    ? Math.sqrt(INFOGRAPHIC_MAX_CANVAS_PIXELS / rawPixels)
    : 1
  const renderScale = dpr * pixelScale
  const pxW = Math.max(1, Math.round(vis.width * renderScale))
  const pxH = Math.max(1, Math.round(vis.height * renderScale))
  if (canvas.width !== pxW) canvas.width = pxW
  if (canvas.height !== pxH) canvas.height = pxH
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  ctx.scale(renderScale, renderScale)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const s of strokes) {
    if (!s.points || s.points.length < 1) continue
    ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over'
    ctx.strokeStyle = s.color
    const resolvedLineWidth = Math.max(0.001, s.sizeNorm || INFOGRAPHIC_UNIFIED_STROKE_NORM) * vis.width
    ctx.lineWidth = Math.max(1.5, resolvedLineWidth)
    ctx.beginPath()
    const p0 = s.points[0]
    const x0 = p0.u * vis.width
    const y0 = p0.v * vis.height
    ctx.moveTo(x0, y0)
    if (s.points.length === 1) {
      ctx.arc(x0, y0, Math.max(0.8, ctx.lineWidth * 0.5), 0, Math.PI * 2)
      ctx.fillStyle = s.tool === 'eraser' ? '#000' : s.color
      ctx.fill()
    } else if (s.points.length === 2) {
      const p1 = s.points[1]
      ctx.lineTo(p1.u * vis.width, p1.v * vis.height)
    } else {
      for (let i = 1; i < s.points.length - 1; i += 1) {
        const p = s.points[i]
        const pn = s.points[i + 1]
        const xc = ((p.u + pn.u) * vis.width) / 2
        const yc = ((p.v + pn.v) * vis.height) / 2
        ctx.quadraticCurveTo(p.u * vis.width, p.v * vis.height, xc, yc)
      }
      const last = s.points[s.points.length - 1]
      const prev = s.points[s.points.length - 2]
      ctx.quadraticCurveTo(prev.u * vis.width, prev.v * vis.height, last.u * vis.width, last.v * vis.height)
    }
    ctx.stroke()
  }
  ctx.restore()
  return true
}

function clearInfographicCanvasOnStage(stage: HTMLElement) {
  const canvas = stage.querySelector('[data-infographic-draw-pane-canvas]') as HTMLCanvasElement | null
  if (!canvas) return
  if (canvas.width !== 1) canvas.width = 1
  if (canvas.height !== 1) canvas.height = 1
  canvas.style.width = '0px'
  canvas.style.height = '0px'
}

const INFOGRAPHIC_DRAW_COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#ffffff'] as const
const INFOGRAPHIC_UNIFIED_STROKE_NORM = 0.004
const INFOGRAPHIC_MAX_STROKES = 240
const INFOGRAPHIC_MAX_POINTS_PER_STROKE = 2500
const INFOGRAPHIC_MAX_TOTAL_POINTS = 90000
const INFOGRAPHIC_MAX_CANVAS_PIXELS = 2_400_000
const STUDENT_MD_CHAIN_AUTO_FOLLOW = true
const CURRICULUM_PAYLOAD_DEDUPE_WINDOW_MS = 1200

function dedupeInfographicStrokesById(strokes: InfographicDrawStroke[]): InfographicDrawStroke[] {
  const byId = new Map<string, InfographicDrawStroke>()
  for (const s of strokes) {
    if (s?.id) byId.set(s.id, s)
  }
  return Array.from(byId.values())
}

function trimInfographicStrokePoints(points: InfographicDrawPoint[]): InfographicDrawPoint[] {
  if (points.length <= INFOGRAPHIC_MAX_POINTS_PER_STROKE) return points
  return points.slice(points.length - INFOGRAPHIC_MAX_POINTS_PER_STROKE)
}

function clampInfographicStroke(stroke: InfographicDrawStroke): InfographicDrawStroke {
  return { ...stroke, points: trimInfographicStrokePoints(stroke.points ?? []) }
}

function limitInfographicStrokeMemory(strokes: InfographicDrawStroke[]): InfographicDrawStroke[] {
  if (!Array.isArray(strokes) || strokes.length <= 0) return []
  const base = strokes.map(clampInfographicStroke)
  let list = base.length > INFOGRAPHIC_MAX_STROKES ? base.slice(base.length - INFOGRAPHIC_MAX_STROKES) : base
  let totalPoints = list.reduce((acc, s) => acc + (s.points?.length ?? 0), 0)
  while (totalPoints > INFOGRAPHIC_MAX_TOTAL_POINTS && list.length > 1) {
    const dropped = list[0]
    totalPoints -= dropped.points?.length ?? 0
    list = list.slice(1)
  }
  return list
}

/** Gộp mọi bucket nét (legacy theo slide) thành một lớp dùng chung infographic giáo trình. */
function foldInfographicStrokesToCurriculumKey(
  map: Record<number, InfographicDrawStroke[]>,
): Record<number, InfographicDrawStroke[]> {
  const normalized: Record<number, InfographicDrawStroke[]> = {}
  for (const [k, list] of Object.entries(map)) {
    const key = Number(k)
    if (!Number.isFinite(key) || !Array.isArray(list)) continue
    normalized[key] = limitInfographicStrokeMemory(dedupeInfographicStrokesById(list))
  }
  return normalized
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
  /** Chỉ giáo viên mới thấy các nút thao tác lưu/chỉnh visual */
  isTeacherView?: boolean
  /** Nút "Mở giao diện học sinh" – khi không truyền và curriculumId=null (phiếu bài tập), tự implement */
  onOpenStudentView?: () => void
  /** Phiếu bài tập (xem-slide): hiển thị đáp án theo segment đồng bộ từ giáo viên */
  worksheetPresentation?: boolean
  worksheetAnswerReveal?: Record<string, number>
  worksheetAnswerTypingEnabled?: Record<string, boolean>
  /** Phiếu bài tập: bật/tắt gõ từng ký tự phần đề — câu hỏi (không phải lời giải). Mặc định true. */
  worksheetStemTypingEnabled?: boolean
  /** `?sync=` từ URL xem-slide — kênh BroadcastChannel khớp tab GV (học sinh). */
  presentationBroadcastSyncId?: string | null
  /** Đồng bộ từ `curriculum-data` (GV) — cột phải một slide / cả khóa */
  syncedStudentCurriculumRightMode?: 'single-slide' | 'markdown-all' | null
  /** Đồng bộ từ `curriculum-data` (GV) — tab cột trái: Visual / Infographic (trong khung, không fullscreen) */
  syncedStudentCurriculumLeftPane?: 'visual' | 'infographic' | null
  /** Một infographic cho cả giáo trình (không gắn từng slide) */
  curriculumInfographic?: SlideInfographic | null
}

function ScreenShareVideo({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = videoRef.current
    if (!el || !stream) return
    const tracks = stream.getVideoTracks()
    if (tracks.length === 0) return
    el.srcObject = stream
    const play = () => el.play().catch(() => {})
    el.onloadedmetadata = play
    play()
    return () => {
      el.srcObject = null
    }
  }, [stream])
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="absolute inset-0 w-full h-full"
      style={{ objectFit: 'contain' }}
    />
  )
}

/** Trích visual cells từ nội dung slide (blocks, title, content) – dùng cho phiếu bài tập khi không có visualInputs/visualCells. */
function getVisualCellsFromSlideContent(slide: SlideItem): { layout: 1 | 2 | 4; cells: VisualCell[] } | null {
  const content = `${slide.title ?? ''}\n${slide.content ?? ''}\n${(slide.blocks ?? []).map((b) => `${b.header ?? ''}\n${b.content ?? ''}`).join('\n')}`
  const embeds = parseContentEmbeds(content)
  const mdImageRe = /!\[[^\]]*\]\((https?:\/\/[^\s)]+|data:image\/[^\s)]+)\)/gi
  const mdImages: Array<{ url: string; index: number }> = []
  let m: RegExpExecArray | null
  mdImageRe.lastIndex = 0
  while ((m = mdImageRe.exec(content)) !== null) {
    mdImages.push({ url: m[1].trim(), index: m.index })
  }
  const items: Array<{ cell: VisualCell; index: number }> = []
  for (const e of embeds) {
    if (e.type === 'quiz' || e.type === 'code') continue
    items.push({ cell: { visualEmbed: e.rawMarker }, index: e.index })
  }
  for (const { url, index } of mdImages) {
    items.push({ cell: { visualEmbed: `[image:${url}]` }, index })
  }
  if (items.length === 0) return null
  items.sort((a, b) => a.index - b.index)
  const cells = items.map((x) => x.cell)
  const layout: 1 | 2 | 4 = cells.length >= 3 ? 4 : cells.length === 2 ? 2 : 1
  const numCells = layout === 1 ? 1 : layout === 2 ? 2 : 4
  const result: VisualCell[] = [...cells.slice(0, numCells)]
  while (result.length < numCells) result.push({})
  return { layout, cells: result }
}

function getVisualCells(slide: SlideItem): { layout: 1 | 2 | 4; cells: VisualCell[] } {
  const layout = slide.visualLayout ?? 1
  const numCells = layout === 1 ? 1 : layout === 2 ? 2 : 4
  // Ưu tiên visualCells từ payload (giáo viên gửi sang) – giao diện học sinh đồng bộ với giáo viên (tự động hoặc nhập thủ công)
  if (slide.visualCells && slide.visualCells.length > 0) {
    const cells = slide.visualCells.slice(0, numCells)
    if (cells.some((c) => c.visualEmbed || c.imageUrl)) return { layout, cells }
  }
  const fromInputs = getVisualCellsFromInputs(slide)
  if (fromInputs) return fromInputs
  const autoGeo = getAutoGeoGebraSuggestion(slide)
  if (slide.visualEmbed) return { layout: 1, cells: [{ visualEmbed: slide.visualEmbed }] }
  const fromContent = getVisualCellsFromSlideContent(slide)
  if (fromContent) return fromContent
  if (autoGeo) {
    return { layout: 1, cells: [{ visualEmbed: autoGeo.marker }] }
  }
  if (slide.imageUrl) return { layout: 1, cells: [{ imageUrl: slide.imageUrl }] }
  return { layout, cells: Array.from({ length: numCells }, () => ({})) }
}

/** Hiển thị Visual: thay ảnh stock mặc định bằng infographic khi có — không đụng embed GV / biểu đồ. */
function getVisualCellsForPresentation(
  slide: SlideItem,
  curriculumInfographic: SlideInfographic | null | undefined,
): { layout: 1 | 2 | 4; cells: VisualCell[] } {
  const raw = getVisualCells(slide)
  const infUrl = curriculumInfographic?.imageUrl
  if (!infUrl?.trim()) return raw
  const skip = skipInfographicDefaultSwapNano(slide)
  const swapped = applyInfographicToDefaultVisualCells(raw, infUrl, skip) as { layout: 1 | 2 | 4; cells: VisualCell[] }
  const hasAnyVisual = swapped.cells.some((c) => String(c.visualEmbed ?? '').trim() || String(c.imageUrl ?? '').trim())
  if (hasAnyVisual) return swapped
  return { layout: 1, cells: [{ imageUrl: infUrl.trim() }] }
}

function getSlideVisualInputs(slide: SlideItem): string[] {
  return [slide.visualInput1, slide.visualInput2, slide.visualInput3, slide.visualInput4]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
}

function buildVisualMarkerFromRawInput(rawInput: string, domainConstraint?: string | null): string | null {
  const raw = String(rawInput || '').trim()
  if (!raw) return null
  const markerMatch = raw.match(/^\[(geogebra|desmos|youtube|phet|maps|image|audio|quiz|code|latex|plot):\s*([^\]]+)\]$/i)
  if (markerMatch?.[1] && markerMatch?.[2]) return `[${markerMatch[1].toLowerCase()}:${markerMatch[2].trim()}]`
  const mdImage = raw.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+|data:image\/[^\s)]+)\)/i)?.[1]
  const url = mdImage || raw.match(/(https?:\/\/[^\s]+|data:image\/[^\s]+)/i)?.[1]
  if (url) {
    const u = url.trim()
    if (/geogebra\.org/i.test(u)) return `[geogebra:${u}]`
    if (/desmos\.com/i.test(u)) return `[desmos:${u}]`
    if (/(youtube\.com|youtu\.be)/i.test(u)) return `[youtube:${u}]`
    if (/phet\.colorado\.edu/i.test(u)) return `[phet:${u}]`
    if (/\.(mp3|wav|ogg|m4a)(\?.*)?$/i.test(u)) return `[audio:${u}]`
    if (/^data:image\//i.test(u) || /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?.*)?$/i.test(u)) return `[image:${u}]`
    if (/(google\.[^/]+\/maps|goo\.gl\/maps)/i.test(u)) return `[maps:${u}]`
    return `[maps:${u}]`
  }
  const items = extractMultiplePlotExpressions(raw)
  if (items.length === 0) return null
  if (items.length === 1) return `[geogebra:${buildGeoGebraUrl(items[0].expr, items[0].domain ?? domainConstraint)}]`
  return `[geogebra:${buildGeoGebraUrlMultiple(items, domainConstraint)}]`
}

/** Tách nhiều hàm + điều kiện. Sau dấu phẩy, nếu không phải hàm số thì là điều kiện của hàm đứng trước. VD: "y=x^2, x>=0, y=2x, x>0" */
function extractMultiplePlotExpressions(raw: string): Array<{ expr: string; domain: string | null }> {
  const parts = String(raw || '').split(',').map((p) => p.trim()).filter(Boolean)
  const result: Array<{ expr: string; domain: string | null }> = []
  const domainRe = /^[xXtT]\s*(>=|<=|>|<|≥|≤)\s*-?\d+(?:[.,]\d+)?$/i
  for (const part of parts) {
    const compact = part.replace(/\s+/g, '').replace(/≥/g, '>=').replace(/≤/g, '<=')
    if (domainRe.test(compact)) {
      if (result.length > 0) result[result.length - 1].domain = compact
      continue
    }
    const expr = normalizePlotExprCandidate(part)
    if (expr) result.push({ expr, domain: null })
  }
  return result
}

function buildGeoGebraUrlMultiple(items: Array<{ expr: string; domain: string | null }>, fallbackDomain?: string | null): string {
  const names = ['f', 'g', 'h', 'i', 'j', 'k']
  const cmds = items.slice(0, names.length).map((item, i) => {
    const normalized = item.expr.replace(/\s+/g, '').replace(/\|([^|]+)\|/g, 'abs($1)')
    const domain = item.domain ?? (i === 0 ? fallbackDomain : null)
    const rhs = domain ? `If(${domain},${normalized})` : normalized
    return `${names[i]}(x)=${rhs}`
  })
  const command = cmds.join(';')
  return `https://www.geogebra.org/calculator?command=${encodeURIComponent(command)}`
}

function getVisualCellsFromInputs(slide: SlideItem): { layout: 1 | 2 | 4; cells: VisualCell[] } | null {
  const inputs = getSlideVisualInputs(slide)
  if (inputs.length === 0) return null
  // Ưu tiên miền xác định do giáo viên nhập trong 4 ô visual,
  // không suy diễn từ nội dung mô tả để tránh lệch khi render.
  const domainConstraint = parseDomainConstraintFromSource(inputs.join('\n'))
  const parsedCells = inputs.map((raw) => {
    const marker = buildVisualMarkerFromRawInput(raw, domainConstraint)
    return marker ? ({ visualEmbed: marker } as VisualCell) : ({} as VisualCell)
  })
  const layout: 1 | 2 | 4 = inputs.length >= 3 ? 4 : inputs.length === 2 ? 2 : 1
  const numCells = layout === 1 ? 1 : layout === 2 ? 2 : 4
  const cells = [...parsedCells.slice(0, numCells)]
  while (cells.length < numCells) cells.push({})
  return { layout, cells }
}

function extractPlotExpressionFromSlide(slide: SlideItem): string | null {
  const source = `${slide.title}\n${slide.content ?? ''}\n${(slide.blocks ?? []).map((b) => `${b.header}\n${b.content}`).join('\n')}\n${getSlideVisualInputs(slide).join('\n')}`
  const patterns: RegExp[] = [
    /y\s*=\s*f\s*\(\s*[xt]\s*\)\s*=\s*([^\n]{2,120})/i,
    /y\s*=\s*([^\n]{2,120})/i,
    /\b[a-zA-Z]\s*\(\s*[xt]\s*\)\s*=\s*([^\n]{2,120})/i,
  ]
  for (const re of patterns) {
    const m = source.match(re)
    if (!m?.[1]) continue
    const normalized = normalizePlotExprCandidate(m[1])
    if (normalized) return normalized
  }
  return null
}

function normalizePlotExprCandidate(raw: string): string | null {
  const rawTrim = String(raw || '').trim()
  // Chỉ parse khi input có dạng công thức/toán rõ ràng,
  // tránh nhận nhầm cả câu mô tả tiếng Việt.
  if (!/^(?:y\s*=|[a-zA-Z]\s*\(\s*[xt]\s*\)\s*=|[xXtT0-9(|+\-])/i.test(rawTrim)) return null

  let s = String(raw || '')
    .replace(/^\s*y\s*=\s*f\s*\(\s*[xt]\s*\)\s*=\s*/i, '')
    .replace(/^\s*(?:y|[a-zA-Z]\s*\(\s*[xt]\s*\))\s*=\s*/i, '')
    // Bỏ miền xác định gắn cuối biểu thức, ví dụ: (t >= 0), (x ≤ 2)
    .replace(/\(\s*[xXtT]\s*(?:>=|<=|>|<|≥|≤)\s*[-+]?\d+(?:[.,]\d+)?\s*\)\s*$/u, '')
    .replace(/\(\s*(hình|hinh|figure|fig)\b[^)]*\)/gi, '')
    .replace(/\.\s*[A-Za-z\u00C0-\u024F].*$/u, '')
    // Cắt phần mô tả tiếng Việt/Anh ở cuối (tránh "trên" -> t bị nhận thành biến)
    .replace(/\s+[a-zA-Z\u00C0-\u024F][a-zA-Z0-9\u00C0-\u024F\s,;:.\-()]*$/u, '')
    // Giữ số thập phân dạng Việt: 24,5 -> 24.5
    .replace(/(\d)\s*,\s*(\d)/g, '$1.$2')
    // Chỉ cắt mô tả theo dấu câu không ảnh hưởng số thập phân
    .replace(/[;!?].*$/, '')
    .replace(/[∣｜❘│┃¦]/g, '|')
    .replace(/−/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/\s+/g, '')
    .replace(/х/gi, 'x')
  const superscriptMap: Record<string, string> = {
    '⁰': '0',
    '¹': '1',
    '²': '2',
    '³': '3',
    '⁴': '4',
    '⁵': '5',
    '⁶': '6',
    '⁷': '7',
    '⁸': '8',
    '⁹': '9',
  }
  for (const [k, v] of Object.entries(superscriptMap)) {
    s = s.replace(new RegExp(k, 'g'), `^${v}`)
  }
  // Chỉ giữ đoạn biểu thức toán ở đầu câu; bỏ phần chú thích kiểu "(Hình 1.2) ..."
  const leadingMath = s.match(/^[0-9xXtT+\-*/^().|√π]+/)?.[0] ?? ''
  s = leadingMath
  s = s.replace(/(?<![A-Za-z])[tT](?![A-Za-z])/g, 'x')
  while (/[+\-*/^.(]$/.test(s)) s = s.slice(0, -1)
  if (!/[xX]/.test(s)) return null
  if (!/^[0-9xX+\-*/^().|√πa-zA-Z]+$/.test(s)) return null
  return s
}

function parseDomainConstraintFromSource(rawSource: string): string | null {
  const source = String(rawSource || '')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/[−–—]/g, '-')
    .replace(/\s+/g, ' ')
  const explicit = source.match(/(?:^|[\s,(])([xXtT])\s*(>=|<=|>|<)\s*(-?\d+(?:[.,]\d+)?)/)
  if (explicit?.[1] && explicit[2] && explicit[3]) {
    const v = explicit[1].toLowerCase() === 't' ? 'x' : explicit[1].toLowerCase()
    const n = explicit[3].replace(',', '.')
    return `${v}${explicit[2]}${n}`
  }
  const intervalLeftInfinite = source.match(/\(\s*-\s*∞\s*[;,]\s*([+-]?\d+(?:[.,]\d+)?)\s*\)/i)
  if (intervalLeftInfinite?.[1]) return `x<${intervalLeftInfinite[1].replace(',', '.')}`
  const intervalRightInfinite = source.match(/\(\s*([+-]?\d+(?:[.,]\d+)?)\s*[;,]\s*\+?\s*∞\s*\)/i)
  if (intervalRightInfinite?.[1]) return `x>${intervalRightInfinite[1].replace(',', '.')}`
  return null
}

function detectDomainConstraintFromSlide(slide: SlideItem): string | null {
  const source = `${slide.title}\n${slide.content ?? ''}\n${(slide.blocks ?? []).map((b) => `${b.header}\n${b.content}`).join('\n')}\n${getSlideVisualInputs(slide).join('\n')}`
  return parseDomainConstraintFromSource(source)
}

function buildGeoGebraUrl(expr: string, domainConstraint?: string | null): string {
  const normalized = expr
    .replace(/\s+/g, '')
    // GeoGebra ổn định hơn với abs(x) so với ký pháp |x| từ SGK
    .replace(/\|([^|]+)\|/g, 'abs($1)')
  const rhs = domainConstraint ? `If(${domainConstraint},${normalized})` : normalized
  return `https://www.geogebra.org/calculator?command=${encodeURIComponent(`f(x)=${rhs}`)}`
}

function getAutoGeoGebraSuggestion(slide: SlideItem): { expr: string; url: string; marker: string } | null {
  const inputCells = getVisualCellsFromInputs(slide)
  if (inputCells?.cells[0]?.visualEmbed) {
    const marker = inputCells.cells[0].visualEmbed
    const manualUrl = marker.match(/^\[geogebra:\s*([^\]]+)\]$/i)?.[1]?.trim() ?? ''
    return { expr: '', url: manualUrl, marker }
  }
  const expr = extractPlotExpressionFromSlide(slide)
  if (!expr) return null
  const domain = detectDomainConstraintFromSlide(slide)
  const url = buildGeoGebraUrl(expr, domain)
  return { expr, url, marker: `[geogebra:${url}]` }
}

function getBaseSlides(
  curriculumMarkdown: string,
  topic: string,
  aiSlides: AISlideData[] | null | undefined,
  opts?: { allowMarkdownFallback?: boolean }
): SlideItem[] {
  /** Luôn dùng aiSlides khi có – đảm bảo visualEmbed/visualCells (bản đồ, GeoGebra...) hiển thị đúng ở giao diện học sinh */
  if (aiSlides && aiSlides.length > 0) {
    return aiSlides.map((s) => {
      const base = s as SlideItem
      const hasVisualFromCells = base.visualCells?.some((c) => c.visualEmbed || c.imageUrl)
      const safeBlocks = Array.isArray(s.blocks) ? s.blocks : []
      return {
        title: s.title,
        content: '',
        blocks: safeBlocks,
        imageUrl: hasVisualFromCells ? undefined : s.imageUrl,
        visualEmbed: s.visualEmbed,
        visualLayout: base.visualLayout,
        visualCells: base.visualCells,
        teacherNotes: (base as SlideItem).teacherNotes,
        visualInput1: base.visualInput1,
        visualInput2: base.visualInput2,
        visualInput3: base.visualInput3,
        visualInput4: base.visualInput4,
      }
    })
  }
  if (opts?.allowMarkdownFallback === false) return []
  const readable = latexToReadable(curriculumMarkdown)
  const parsed = parseCurriculumToSlides(readable)
  return topic ? [{ title: topic, content: '' }, ...parsed] : parsed
}

export function NanoAISlideViewer({ curriculumMarkdown, topic, onClose, aiSlides, curriculumId, subjectId, gradeLevelId, tr, onSlidesSaved, slideMode, originalSlides, initialSlideIndex, isTeacherView = true, onOpenStudentView: onOpenStudentViewProp, worksheetPresentation = false, worksheetAnswerReveal, worksheetAnswerTypingEnabled, presentationBroadcastSyncId = null, syncedStudentCurriculumRightMode = null, syncedStudentCurriculumLeftPane = null, curriculumInfographic: curriculumInfographicProp }: NanoAISlideViewerProps) {
  const { toast } = useToast()
  const [memoryDebugEnabled, setMemoryDebugEnabled] = useState(false)
  const curriculumPayloadStatsRef = useRef<{
    events: Array<{ at: number; bytes: number; type: string }>
    lastBytes: number | null
    lastType: string | null
    peakBytes: number | null
    peakType: string | null
    peakHeapMb: number | null
  }>({
    events: [],
    lastBytes: null,
    lastType: null,
    peakBytes: null,
    peakType: null,
    peakHeapMb: null,
  })
  const lastCurriculumPayloadDigestRef = useRef<string>('')
  const lastCurriculumPayloadSentAtRef = useRef(0)
  /** Hiện overlay xác nhận trên cửa sổ HS khi GV bấm "Trình chiếu HS" mà fullscreen API bị chặn vì thiếu user gesture. */
  const [projectorPromptVisible, setProjectorPromptVisible] = useState(false)
  /** Snapshot trạng thái HS để khôi phục đúng slide/mode/cột sau khi auto-reload do RAM. */
  const memoryReloadStateRef = useRef<{
    currentIndex: number
    presentationMode: 'independent' | 'slide-interaction'
    studentCurriculumRightMode: 'single-slide' | 'markdown-all'
    studentCurriculumLeftPaneTab: 'visual' | 'infographic'
  }>({
    currentIndex: 0,
    presentationMode: 'independent',
    studentCurriculumRightMode: 'single-slide',
    studentCurriculumLeftPaneTab: 'visual',
  })
  const [slides, setSlides] = useState<SlideItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false)
  const [autoPlay, setAutoPlay] = useState(false)
  const [autoPlayIntervalMs, setAutoPlayIntervalMs] = useState(5000)
  const [, setTransitionDirection] = useState<'next' | 'prev'>('next')
  const initialSlideSyncedRef = useRef(false)
  const pendingSlideGoIndexRef = useRef<number | null>(null)
  const [personalViewSubMode, setPersonalViewSubMode] = useState<'current' | 'original'>('current')
  const [quizPopupOpen, setQuizPopupOpen] = useState(false)
  const [quizSessionData, setQuizSessionData] = useState<Record<string, { sessionCode: string; quizDurationSeconds: number }>>({})
  const [quizSessionSettings, setQuizSessionSettings] = useState<Record<string, { quizDurationSeconds: number; autoRevealOnTimerEnd: boolean }>>({})
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  /** Tab tạo phiếu bài tập: kênh đồng bộ HS tách biệt với tab GV khác. */
  const [worksheetTabSyncId] = useState(() => getOrCreatePresentationSyncId('student-worksheet-tab'))
  const presentationBroadcastChannelName = useMemo(
    () => getPresentationBroadcastChannelName(!isTeacherView ? presentationBroadcastSyncId ?? undefined : undefined),
    [isTeacherView, presentationBroadcastSyncId]
  )
  const [shareQrDataUrl, setShareQrDataUrl] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [screenShareOverlayVisible, setScreenShareOverlayVisible] = useState(true)
  const shareInProgressRef = useRef(false)
  const [visualFullscreenOpen, setVisualFullscreenOpen] = useState(false)
  const [expandedCellIndex, setExpandedCellIndex] = useState<number | null>(null)
  const [curriculumInfographic, setCurriculumInfographic] = useState<SlideInfographic | undefined>(undefined)
  const curriculumInfographicRef = useRef<SlideInfographic | undefined>(undefined)
  curriculumInfographicRef.current = curriculumInfographic
  const activeInfographicStrokeKey = useMemo(
    () => getInfographicStrokeBucketKey(curriculumInfographic?.imageUrl),
    [curriculumInfographic?.imageUrl]
  )
  useEffect(() => {
    if (curriculumInfographicProp === undefined) return
    setCurriculumInfographic(curriculumInfographicProp ?? undefined)
  }, [curriculumInfographicProp])
  /** Giáo trình (không phiếu): tab cột trái chỉ còn Visual. */
  const [presenterLeftTab, setPresenterLeftTab] = useState<'visual' | 'infographic'>('visual')
  const [studentCurriculumLeftPaneTab, setStudentCurriculumLeftPaneTab] = useState<'visual' | 'infographic'>('visual')
  const isStudentCurriculumSlide = !isTeacherView && !worksheetPresentation
  const [infographicFullscreenOpen, setInfographicFullscreenOpen] = useState(false)
  const shouldRenderInlineInfographicCanvas = !visualFullscreenOpen && !infographicFullscreenOpen
  /** Học sinh + giáo trình (không phiếu): cột phải — một slide hoặc toàn bộ slide nối liền (markdown). */
  const [studentCurriculumRightMode, setStudentCurriculumRightMode] = useState<'single-slide' | 'markdown-all'>('single-slide')
  const notifyTeacherStudentCurriculumMode = useCallback((mode: 'single-slide' | 'markdown-all') => {
    try {
      window.opener?.postMessage({ type: 'student-curriculum-right-mode-changed', mode }, window.location.origin)
    } catch {
      /* ignore */
    }
  }, [])
  const notifyTeacherStudentCurriculumLeftPane = useCallback((pane: 'visual' | 'infographic') => {
    try {
      window.opener?.postMessage({ type: 'student-curriculum-left-pane-changed', pane }, window.location.origin)
    } catch {
      /* ignore */
    }
  }, [])
  useEffect(() => {
    if (syncedStudentCurriculumRightMode !== 'markdown-all' && syncedStudentCurriculumRightMode !== 'single-slide') return
    setStudentCurriculumRightMode(syncedStudentCurriculumRightMode)
  }, [syncedStudentCurriculumRightMode])
  useEffect(() => {
    if (syncedStudentCurriculumLeftPane !== 'infographic' && syncedStudentCurriculumLeftPane !== 'visual') return
    setStudentCurriculumLeftPaneTab(syncedStudentCurriculumLeftPane)
  }, [syncedStudentCurriculumLeftPane])
  const fullscreenOverlayRef = useRef<HTMLDivElement>(null)
  const infographicFullscreenOverlayRef = useRef<HTMLDivElement | null>(null)
  const studentVisualFrameRef = useRef<HTMLDivElement | null>(null)
  /** Cột Visual trong slide (chưa fullscreen): các ô con đồng bộ cellIndex với GV */
  const studentEmbeddedVisualFrameRef = useRef<HTMLDivElement | null>(null)
  /** Khung bao Visual (có kích thước thật) để map chuột khi không rơi vào ô con. */
  const studentEmbeddedVisualViewportRef = useRef<HTMLDivElement | null>(null)
  const studentMarkdownAllScrollRef = useRef<HTMLDivElement | null>(null)
  /** Cột phải HS: khung thật sự có overflow-y-auto (cha của danh sách chuỗi slide). */
  const studentMdRightColumnScrollRef = useRef<HTMLDivElement | null>(null)
  const lastMdAutoScrollIndexRef = useRef<number | null>(null)
  const lastMdAutoScrollAtRef = useRef(0)
  /** Con của scroll: cùng chiều rộng nội dung với GV → xuống dòng khớp; map chuột theo toàn khối nội dung. */
  const studentSlideContentLayoutRef = useRef<HTMLDivElement | null>(null)
  /** Phần thân slide sau tiêu đề — map chuột ảo theo `slidePointerBody` từ GV. */
  const studentSlidePointerSyncRef = useRef<HTMLDivElement | null>(null)
  /** Chiều rộng cột nội dung GV (px) — ép khối HS để wrap giống GV. */
  const [syncedTeacherSlideLayoutW, setSyncedTeacherSlideLayoutW] = useState<number | null>(null)
  /** clientWidth của vùng cuộn cột phải HS (để min(width, khả dụng)). */
  const [studentMdScrollClientW, setStudentMdScrollClientW] = useState(0)
  /** Khoảng trống cuộn thêm dưới cùng chuỗi slide ≈ ½ chiều cao slide đang chọn. */
  const [studentMdChainBottomSpacerPx, setStudentMdChainBottomSpacerPx] = useState(160)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [teacherTimerSeconds, setTeacherTimerSeconds] = useState(0)
  const [teacherTimerRunning, setTeacherTimerRunning] = useState(false)
  const [presentationMode, setPresentationMode] = useState<'independent' | 'slide-interaction'>('independent')
  const [viewportW, setViewportW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280))
  const [stableLayoutWidth, setStableLayoutWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280))

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search || '')
    const byQuery = params.get('memdebug') === '1'
    const byStorage = window.localStorage.getItem('nano_memdebug') === '1'
    setMemoryDebugEnabled(byQuery || byStorage)
  }, [])

  /**
   * Memory rescue: khi heap lên cao sẽ dọn state nội bộ,
   * còn nếu chạm ngưỡng nguy hiểm sẽ reload tab học sinh (tab GV thì chỉ cảnh báo).
   * Mục tiêu: tránh crash tab khi chạy liên tục hàng giờ.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false
    const perfLike = performance as Performance & {
      memory?: {
        usedJSHeapSize?: number
        totalJSHeapSize?: number
        jsHeapSizeLimit?: number
      }
    }
    const reloadedKey = 'nano_slide_memory_reloaded_at'
    const lastReloadRaw = Number(window.sessionStorage.getItem(reloadedKey) ?? '0')
    const withinCooldown = Number.isFinite(lastReloadRaw) && Date.now() - lastReloadRaw < 30_000
    let softCleanupAt = 0
    let lastSampledUsed: number | null = null
    let lastSampledAt: number | null = null
    const tick = () => {
      if (cancelled) return
      const used = Number(perfLike.memory?.usedJSHeapSize ?? NaN)
      const limit = Number(perfLike.memory?.jsHeapSizeLimit ?? NaN)
      if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return
      const ratio = used / limit
      const now = Date.now()

      // Panic detection: heap nhảy nhanh trong 1 nhịp.
      let panicGrowth = false
      if (lastSampledUsed != null && lastSampledAt != null) {
        const dtMs = Math.max(1, now - lastSampledAt)
        const deltaBytes = used - lastSampledUsed
        const growthMbPerSec = (deltaBytes / dtMs) * 1000 / (1024 * 1024)
        if (growthMbPerSec > 30) panicGrowth = true
      }
      lastSampledUsed = used
      lastSampledAt = now

      if (ratio > 0.5 && now - softCleanupAt > 15_000) {
        softCleanupAt = now
        try {
          processedSyncSeqRef.current = new Set()
          if (mouseTrail.length > 0) setMouseTrail([])
          if (mouseClicks.length > 0) setMouseClicks([])
          lastIncomingCurriculumPayloadRef.current = ''
          curriculumPayloadStatsRef.current.events = []
        } catch {
          /* ignore */
        }
      }

      if (ratio > 0.65 || panicGrowth) {
        try {
          window.dispatchEvent(
            new CustomEvent('nano-slide-memory-pressure', { detail: { heapUsed: used, ratio, panicGrowth } })
          )
        } catch {
          /* ignore */
        }
      }

      // Đang trình chiếu (F11 / fullscreen API / overlay slide) thì nâng ngưỡng nhẹ; nhưng panic vẫn reload.
      let isActivePresentation = false
      try {
        if (typeof document !== 'undefined' && document.fullscreenElement) isActivePresentation = true
        if (
          !isActivePresentation &&
          typeof window !== 'undefined' &&
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(display-mode: fullscreen)').matches
        ) {
          isActivePresentation = true
        }
      } catch {
        /* ignore */
      }
      const reloadThreshold = isActivePresentation ? 0.85 : 0.78
      const emergencyThreshold = 0.9
      const shouldReload =
        !isTeacherView &&
        (
          (panicGrowth && ratio > 0.7) ||
          (ratio > emergencyThreshold) ||
          (ratio > reloadThreshold && !withinCooldown)
        )
      if (shouldReload) {
        cancelled = true
        try {
          window.sessionStorage.setItem(reloadedKey, String(now))
          window.sessionStorage.setItem(
            'nano_slide_pre_reload_state',
            JSON.stringify({ at: now, ...memoryReloadStateRef.current })
          )
        } catch {
          /* ignore */
        }
        try {
          window.location.reload()
        } catch {
          /* ignore */
        }
      }
    }
    const id = window.setInterval(tick, 2000)
    tick()
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
    // Dep rỗng: cleanup/reload theo trạng thái runtime, không phụ thuộc render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacherView])

  /** Cập nhật snapshot để rescue có dữ liệu mới nhất trước khi auto-reload. */
  useEffect(() => {
    memoryReloadStateRef.current = {
      currentIndex,
      presentationMode,
      studentCurriculumRightMode,
      studentCurriculumLeftPaneTab,
    }
  }, [currentIndex, presentationMode, studentCurriculumRightMode, studentCurriculumLeftPaneTab])

  /** Khôi phục slide/mode đúng vị trí cũ sau khi auto-reload (chỉ áp cho HS). */
  useEffect(() => {
    if (typeof window === 'undefined' || isTeacherView) return
    try {
      const raw = window.sessionStorage.getItem('nano_slide_pre_reload_state')
      if (!raw) return
      window.sessionStorage.removeItem('nano_slide_pre_reload_state')
      const data = JSON.parse(raw) as {
        at?: number
        currentIndex?: number
        presentationMode?: 'independent' | 'slide-interaction'
        studentCurriculumRightMode?: 'single-slide' | 'markdown-all'
        studentCurriculumLeftPaneTab?: 'visual' | 'infographic'
      } | null
      if (!data || typeof data !== 'object') return
      if (typeof data.at !== 'number' || Date.now() - data.at > 60_000) return
      if (typeof data.currentIndex === 'number' && data.currentIndex >= 0) {
        pendingSlideGoIndexRef.current = data.currentIndex
      }
      if (data.presentationMode === 'slide-interaction' || data.presentationMode === 'independent') {
        setPresentationMode(data.presentationMode)
      }
      if (data.studentCurriculumRightMode === 'markdown-all' || data.studentCurriculumRightMode === 'single-slide') {
        setStudentCurriculumRightMode(data.studentCurriculumRightMode)
      }
      if (data.studentCurriculumLeftPaneTab === 'visual' || data.studentCurriculumLeftPaneTab === 'infographic') {
        setStudentCurriculumLeftPaneTab(data.studentCurriculumLeftPaneTab)
      }
    } catch {
      /* ignore */
    }
  }, [isTeacherView])

  useEffect(() => {
    const onResize = () => setViewportW(typeof window !== 'undefined' ? window.innerWidth : 1280)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  useEffect(() => {
    setStableLayoutWidth((prev) => (viewportW > prev ? viewportW : prev))
  }, [viewportW])
  /** Dưới 768px: visual + nội dung xếp dọc full width; từ md: giữ neo phải + minWidth như desktop */
  const narrowSlideLayout = viewportW < 768

  useEffect(() => {
    if (isTeacherView) return
    const el = studentMdRightColumnScrollRef.current
    if (!el) return
    const upd = () => setStudentMdScrollClientW(el.clientWidth)
    upd()
    const ro = new ResizeObserver(upd)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isTeacherView, narrowSlideLayout, presentationMode, slides.length, currentIndex])

  const [virtualMousePos, setVirtualMousePos] = useState<{ x: number; y: number } | null>(null)
  const [mouseTrail, setMouseTrail] = useState<Array<{ x: number; y: number }>>([])
  /** Buffer batch các mẫu chuột ảo theo rAF để giảm áp lực state-update khi GV gửi cao tần. */
  const pendingMouseSamplesRef = useRef<Array<{ x: number; y: number; snap: boolean }>>([])
  const mousePosRafScheduledRef = useRef(false)
  const [mouseClicks, setMouseClicks] = useState<Array<{ id: number; x: number; y: number }>>([])
  /** Nét vẽ infographic theo phiên mở (không lưu DB), key theo slideIndex */
  const [infographicDrawStrokesBySlide, setInfographicDrawStrokesBySlide] = useState<Record<number, InfographicDrawStroke[]>>({})
  const [infographicDrawTool, setInfographicDrawTool] = useState<InfographicDrawTool>('pen')
  const [infographicDrawBrushPx, setInfographicDrawBrushPx] = useState(4)
  const [infographicDrawColor, setInfographicDrawColor] = useState<string>(INFOGRAPHIC_DRAW_COLORS[0])
  const infographicPaneStageRef = useRef<HTMLDivElement | null>(null)
  const infographicPaneImageRef = useRef<HTMLImageElement | null>(null)
  const infographicPaneCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const infographicFullscreenStageRef = useRef<HTMLDivElement | null>(null)
  const infographicFullscreenImageRef = useRef<HTMLImageElement | null>(null)
  const infographicFullscreenCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const infographicDrawingRef = useRef<{
    stageEl: HTMLElement
    strokeId: string
    slideIndex: number
    pointerId: number
    removeListeners?: () => void
  } | null>(null)
  const mouseThrottleRef = useRef(0)
  const lastMouseScopeRef = useRef<'quiz' | 'slide-content' | 'visual' | 'global' | null>(null)
  const lastRenderedVirtualMouseRef = useRef<{ x: number; y: number } | null>(null)
  const lastVisualScopeMoveAtRef = useRef<number>(0)
  const processedSyncSeqRef = useRef<Set<number>>(new Set())
  const quizPopupScrollApplyingRef = useRef(false)
  const closeVisualFullscreenRef = useRef<(opts?: { fromMessage?: boolean }) => void>(() => {})
  const lastLocalVisualOpenRef = useRef<number>(0)
  const visualFullscreenOpenedFromTeacherRef = useRef(false)
  const closeInfographicFullscreenRef = useRef<(opts?: { fromMessage?: boolean }) => void>(() => {})
  const lastLocalInfographicOpenRef = useRef<number>(0)
  const infographicFullscreenOpenedFromTeacherRef = useRef(false)

  const { receivedStream: screenShareStream, isReceiving: isScreenShareActive } = useScreenShare({
    role: 'student',
    openerWindow: typeof window !== 'undefined' ? window.opener : null,
  })

  useEffect(() => {
    if (isScreenShareActive) setScreenShareOverlayVisible(true)
  }, [isScreenShareActive])

  const openVisualFullscreen = useCallback((cellIndex?: number, fromMessage?: boolean) => {
    setInfographicFullscreenOpen(false)
    infographicFullscreenOpenedFromTeacherRef.current = false
    if (!fromMessage) {
      if (typeof window !== 'undefined' && window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({ type: 'infographic-fullscreen-close', fromStudent: true }, window.location.origin)
        } catch { /* ignore */ }
      }
    }
    setExpandedCellIndex(cellIndex ?? null)
    setVisualFullscreenOpen(true)
    visualFullscreenOpenedFromTeacherRef.current = !!fromMessage
    if (!fromMessage) {
      lastLocalVisualOpenRef.current = Date.now()
      if (typeof window !== 'undefined' && window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({ type: 'visual-fullscreen-open', fromStudent: true, cellIndex: typeof cellIndex === 'number' ? cellIndex : undefined }, window.location.origin)
        } catch { /* ignore */ }
      }
    }
  }, [])

  const openInfographicFullscreen = useCallback((fromMessage?: boolean) => {
    if (!curriculumInfographic) {
      if (isStudentCurriculumSlide) {
        toast({
          title: tr(
            'Chưa có infographic',
            'No infographic yet',
            '尚无信息图',
            'インフォグラフィックがありません',
            '인포그래픽 없음'
          ),
          variant: 'destructive',
        })
      }
      return
    }
    setVisualFullscreenOpen(false)
    setExpandedCellIndex(null)
    visualFullscreenOpenedFromTeacherRef.current = false
    if (!fromMessage) {
      if (typeof window !== 'undefined' && window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({ type: 'visual-fullscreen-close', fromStudent: true }, window.location.origin)
        } catch { /* ignore */ }
      }
    }
    setInfographicFullscreenOpen(true)
    infographicFullscreenOpenedFromTeacherRef.current = !!fromMessage
    if (!fromMessage) {
      lastLocalInfographicOpenRef.current = Date.now()
      if (typeof window !== 'undefined' && window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({ type: 'infographic-fullscreen-open', fromStudent: true }, window.location.origin)
        } catch { /* ignore */ }
      }
    }
  }, [curriculumInfographic, isStudentCurriculumSlide, toast, tr])

  const closeInfographicFullscreen = useCallback((opts?: { fromMessage?: boolean }) => {
    const fromMessage = !!opts?.fromMessage
    const shouldReturnTeacher = infographicFullscreenOpenedFromTeacherRef.current && !fromMessage
    try {
      const isFs = document.fullscreenElement ?? (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement
      if (isFs) {
        const exitFs = document.exitFullscreen ?? (document as Document & { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen
        exitFs?.()?.catch(() => {})
      }
    } catch {
      /* ignore */
    }
    setInfographicFullscreenOpen(false)
    infographicFullscreenOpenedFromTeacherRef.current = false
    if (typeof window !== 'undefined' && window.opener && !window.opener.closed) {
      const opener = window.opener as Window
      const focusTeacherWindow = () => {
        try { opener.postMessage({ type: 'teacher-focus-request' }, window.location.origin) } catch { /* ignore */ }
        try { opener.focus() } catch { /* ignore */ }
        try {
          const openerName = (opener as Window & { name?: string }).name
          if (openerName) {
            const winRef = window.open('', openerName)
            if (winRef) {
              try { winRef.focus() } catch { /* ignore */ }
            }
          }
        } catch {
          /* ignore opener name errors */
        }
      }
      try {
        opener.postMessage(
          { type: 'infographic-fullscreen-close', fromStudent: true, returnTeacher: shouldReturnTeacher },
          window.location.origin
        )
      } catch { /* ignore */ }
      if (shouldReturnTeacher) {
        focusTeacherWindow()
        setTimeout(focusTeacherWindow, 90)
        setTimeout(focusTeacherWindow, 280)
      }
    }
  }, [])
  closeInfographicFullscreenRef.current = closeInfographicFullscreen

  const tryRequestFullscreen = useCallback(() => {
    const el = fullscreenOverlayRef.current
    if (el) {
      const reqFs = el.requestFullscreen ?? (el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen
      reqFs?.()?.catch(() => {})
      return true
    }
    return false
  }, [])

  useLayoutEffect(() => {
    if (!visualFullscreenOpen) return
    if (tryRequestFullscreen()) return
    const t1 = setTimeout(() => tryRequestFullscreen(), 50)
    const t2 = setTimeout(() => tryRequestFullscreen(), 150)
    const t3 = setTimeout(() => tryRequestFullscreen(), 300)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [visualFullscreenOpen, tryRequestFullscreen])

  const tryRequestInfographicFullscreen = useCallback(() => {
    const el = infographicFullscreenOverlayRef.current
    if (el) {
      const reqFs = el.requestFullscreen ?? (el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen
      reqFs?.()?.catch(() => {})
      return true
    }
    return false
  }, [])

  useLayoutEffect(() => {
    if (!infographicFullscreenOpen) return
    if (tryRequestInfographicFullscreen()) return
    const t1 = setTimeout(() => tryRequestInfographicFullscreen(), 50)
    const t2 = setTimeout(() => tryRequestInfographicFullscreen(), 150)
    const t3 = setTimeout(() => tryRequestInfographicFullscreen(), 300)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [infographicFullscreenOpen, tryRequestInfographicFullscreen])

  const closeVisualFullscreen = useCallback((opts?: { fromMessage?: boolean }) => {
    const fromMessage = !!opts?.fromMessage
    const shouldReturnTeacher = visualFullscreenOpenedFromTeacherRef.current && !fromMessage
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
    visualFullscreenOpenedFromTeacherRef.current = false
    if (typeof window !== 'undefined' && window.opener && !window.opener.closed) {
      const opener = window.opener as Window
      const focusTeacherWindow = () => {
        try { opener.postMessage({ type: 'teacher-focus-request' }, window.location.origin) } catch { /* ignore */ }
        try { opener.focus() } catch { /* ignore */ }
        try {
          const openerName = (opener as Window & { name?: string }).name
          if (openerName) {
            const winRef = window.open('', openerName)
            if (winRef) {
              try { winRef.focus() } catch { /* ignore */ }
            }
          }
        } catch {
          /* ignore opener name errors */
        }
      }
      try {
        opener.postMessage(
          { type: 'visual-fullscreen-close', fromStudent: true, returnTeacher: shouldReturnTeacher },
          window.location.origin
        )
      } catch { /* ignore */ }
      if (shouldReturnTeacher) {
        focusTeacherWindow()
        setTimeout(focusTeacherWindow, 90)
        setTimeout(focusTeacherWindow, 280)
      }
    }
  }, [])
  closeVisualFullscreenRef.current = closeVisualFullscreen

  /** Phiếu bài tập: mở giao diện học sinh, sync qua postMessage + BroadcastChannel */
  const studentViewWindowRef = useRef<Window | null>(null)
  const syncChannelRef = useRef<BroadcastChannel | null>(null)
  const syncSeqRef = useRef(0)
  const isWorksheetTeacher = !curriculumId && isTeacherView

  useEffect(() => {
    if (!isTeacherView) return
    syncChannelRef.current = typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(presentationBroadcastChannelName)
      : null
    return () => { syncChannelRef.current?.close(); syncChannelRef.current = null }
  }, [isTeacherView, presentationBroadcastChannelName])

  const toStudentSlidePayload = useCallback((s: SlideItem) => {
    const normalized = getVisualCells(s)
    return {
      title: s.title,
      blocks: s.blocks ?? [],
      teacherNotes: s.teacherNotes ?? '',
      imageUrl: s.imageUrl,
      visualEmbed: s.visualEmbed,
      visualLayout: normalized.layout,
      visualCells: normalized.cells,
      visualInput1: s.visualInput1,
      visualInput2: s.visualInput2,
      visualInput3: s.visualInput3,
      visualInput4: s.visualInput4,
    }
  }, [])

  const sendToStudentView = useCallback((msg: Record<string, unknown>) => {
    const payload = { ...msg, __syncSeq: syncSeqRef.current++ }
    try {
      const w = studentViewWindowRef.current
      if (w && !w.closed) {
        w.postMessage(payload, window.location.origin)
      } else {
        syncChannelRef.current?.postMessage(payload)
      }
    } catch { /* ignore */ }
  }, [])

  const sendInfographicDrawMessage = useCallback((msg: Record<string, unknown>) => {
    if (isTeacherView) {
      sendToStudentView(msg)
      return
    }
    // Học sinh vẽ fullscreen: gửi ngược về cửa sổ giáo viên để đồng bộ hai chiều.
    try {
      const opener = window.opener as Window | null
      if (opener && !opener.closed) {
        opener.postMessage({ ...msg, fromStudent: true }, window.location.origin)
      }
    } catch {
      /* ignore */
    }
  }, [isTeacherView, sendToStudentView])

  useEffect(() => {
    if (!curriculumInfographic) return
    setInfographicDrawStrokesBySlide((prev) => foldInfographicStrokesToCurriculumKey(prev))
  }, [curriculumInfographic?.imageUrl])

  const upsertInfographicStroke = useCallback((slideIndex: number, stroke: InfographicDrawStroke) => {
    setInfographicDrawStrokesBySlide((prev) => {
      const list = prev[slideIndex] ?? []
      const idx = list.findIndex((s) => s.id === stroke.id)
      const nextList = idx >= 0 ? list.map((s, i) => (i === idx ? stroke : s)) : [...list, stroke]
      const limited = limitInfographicStrokeMemory(nextList)
      return { ...prev, [slideIndex]: limited }
    })
  }, [])

  const appendInfographicStrokePoint = useCallback((slideIndex: number, strokeId: string, point: InfographicDrawPoint) => {
    setInfographicDrawStrokesBySlide((prev) => {
      const list = prev[slideIndex] ?? []
      const idx = list.findIndex((s) => s.id === strokeId)
      if (idx < 0) return prev
      const target = list[idx]
      const last = target.points[target.points.length - 1]
      const appended = last ? densifyStrokePoints(last, point) : [{ u: clamp01(point.u), v: clamp01(point.v) }]
      const nextStroke: InfographicDrawStroke = { ...target, points: [...target.points, ...appended] }
      const nextList = list.map((s, i) => (i === idx ? nextStroke : s))
      const limited = limitInfographicStrokeMemory(nextList)
      return { ...prev, [slideIndex]: limited }
    })
  }, [])

  const appendInfographicStrokePoints = useCallback((slideIndex: number, strokeId: string, points: InfographicDrawPoint[]) => {
    if (!points || points.length === 0) return
    setInfographicDrawStrokesBySlide((prev) => {
      const list = prev[slideIndex] ?? []
      const idx = list.findIndex((s) => s.id === strokeId)
      if (idx < 0) return prev
      const target = list[idx]
      const appended: InfographicDrawPoint[] = []
      let last = target.points[target.points.length - 1]
      for (const pt of points) {
        const normalized = { u: clamp01(pt.u), v: clamp01(pt.v) }
        const dense = last ? densifyStrokePoints(last, normalized) : [normalized]
        appended.push(...dense)
        last = dense[dense.length - 1] ?? normalized
      }
      if (appended.length === 0) return prev
      const nextStroke: InfographicDrawStroke = { ...target, points: [...target.points, ...appended] }
      const nextList = list.map((s, i) => (i === idx ? nextStroke : s))
      const limited = limitInfographicStrokeMemory(nextList)
      return { ...prev, [slideIndex]: limited }
    })
  }, [])

  const clearInfographicStrokes = useCallback((slideIndex: number) => {
    setInfographicDrawStrokesBySlide((prev) => {
      return { ...prev, [slideIndex]: [] }
    })
  }, [])

  const undoInfographicStroke = useCallback((slideIndex: number) => {
    setInfographicDrawStrokesBySlide((prev) => {
      const list = prev[slideIndex] ?? []
      if (list.length <= 0) return prev
      return { ...prev, [slideIndex]: list.slice(0, -1) }
    })
  }, [])

  const mergeIncomingInfographicStrokes = useCallback((
    prev: Record<number, InfographicDrawStroke[]>,
    incoming: Record<number, InfographicDrawStroke[]>
  ) => {
    const next: Record<number, InfographicDrawStroke[]> = { ...prev }
    for (const [slideKey, incomingList] of Object.entries(incoming)) {
      const slideIndex = Number(slideKey)
      if (!Number.isFinite(slideIndex)) continue
      const prevList = prev[slideIndex] ?? []
      const mergedById = new Map<string, InfographicDrawStroke>()
      // Giữ nét local đã có để không bị mất khi gói sync teacher đến.
      for (const s of prevList) mergedById.set(s.id, s)
      for (const s of incomingList) mergedById.set(s.id, s)
      next[slideIndex] = Array.from(mergedById.values())
    }
    return foldInfographicStrokesToCurriculumKey(next)
  }, [])

  const renderAllInfographicDrawCanvases = useCallback(() => {
    if (typeof document === 'undefined') return
    const strokes = infographicDrawStrokesBySlide[activeInfographicStrokeKey] ?? []
    let paintedCount = 0
    document.querySelectorAll('[data-infographic-draw-pane-stage]').forEach((node) => {
      const stage = node as HTMLElement
      const rect = stage.getBoundingClientRect()
      const style = window.getComputedStyle(stage)
      const isVisible =
        rect.width > 40 &&
        rect.height > 40 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity || '1') > 0
      if (!isVisible) {
        clearInfographicCanvasOnStage(stage)
        return
      }
      if (paintInfographicStrokesOnStage(stage, strokes)) paintedCount += 1
    })
    return paintedCount
  }, [infographicDrawStrokesBySlide, activeInfographicStrokeKey])

  const startInfographicDrawing = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    // Học sinh được vẽ bằng chuột thật ở mọi chế độ hiển thị (thu nhỏ/phóng to).
    if (!curriculumInfographic?.imageUrl) return
    e.preventDefault()
    infographicDrawingRef.current?.removeListeners?.()
    const stage = e.currentTarget
    const resolved = resolveInfographicPointerPointForStage(stage, e.clientX, e.clientY)
    if (!resolved) return
    const { u, v } = resolved
    const strokeId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const sizeNorm = INFOGRAPHIC_UNIFIED_STROKE_NORM
    const stroke: InfographicDrawStroke = {
      id: strokeId,
      tool: infographicDrawTool,
      color: infographicDrawColor,
      sizeNorm,
      points: [{ u, v }],
    }
    upsertInfographicStroke(activeInfographicStrokeKey, stroke)
    sendInfographicDrawMessage({
      type: 'infographic-draw-start',
      slideIndex: activeInfographicStrokeKey,
      stroke,
    })
    const toPoints = (ev: PointerEvent, stageEl: HTMLElement): InfographicDrawPoint[] => {
      const samples = typeof ev.getCoalescedEvents === 'function' ? ev.getCoalescedEvents() : [ev]
      const points: InfographicDrawPoint[] = []
      for (const sample of samples) {
        const r = resolveInfographicPointerPointForStage(stageEl, sample.clientX, sample.clientY)
        if (!r) continue
        points.push({ u: r.u, v: r.v })
      }
      if (points.length === 0) {
        const r = resolveInfographicPointerPointForStage(stageEl, ev.clientX, ev.clientY)
        if (r) points.push({ u: r.u, v: r.v })
      }
      return points
    }
    const queuedPoints: InfographicDrawPoint[] = []
    let rafId: number | null = null
    const flushQueuedPoints = () => {
      if (queuedPoints.length === 0) return
      const batch = queuedPoints.splice(0, queuedPoints.length)
      appendInfographicStrokePoints(activeInfographicStrokeKey, strokeId, batch)
      sendInfographicDrawMessage({
        type: 'infographic-draw-points',
        slideIndex: activeInfographicStrokeKey,
        strokeId,
        points: batch,
      })
    }
    const enqueuePoints = (points: InfographicDrawPoint[]) => {
      if (points.length === 0) return
      queuedPoints.push(...points)
      if (rafId != null) return
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        flushQueuedPoints()
      })
    }
    const onMove = (ev: PointerEvent) => {
      const d = infographicDrawingRef.current
      if (!d || d.pointerId !== ev.pointerId) return
      const points = toPoints(ev, d.stageEl)
      enqueuePoints(points)
    }
    const onEnd = (ev: PointerEvent) => {
      const d = infographicDrawingRef.current
      if (!d || d.pointerId !== ev.pointerId) return
      const points = toPoints(ev, d.stageEl)
      enqueuePoints(points)
      if (rafId != null) {
        window.cancelAnimationFrame(rafId)
        rafId = null
      }
      flushQueuedPoints()
      d.removeListeners?.()
      infographicDrawingRef.current = null
    }
    const removeListeners = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerrawupdate' as unknown as keyof WindowEventMap, onMove as unknown as EventListener)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
      if (rafId != null) {
        window.cancelAnimationFrame(rafId)
        rafId = null
      }
    }
    const hasPointerRawUpdate = typeof (window as unknown as { onpointerrawupdate?: unknown }).onpointerrawupdate !== 'undefined'
    if (hasPointerRawUpdate) {
      window.addEventListener('pointerrawupdate' as unknown as keyof WindowEventMap, onMove as unknown as EventListener, { passive: true })
    } else {
      window.addEventListener('pointermove', onMove, { passive: true })
    }
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
    infographicDrawingRef.current = {
      stageEl: stage,
      strokeId,
      slideIndex: activeInfographicStrokeKey,
      pointerId: e.pointerId,
      removeListeners,
    }
  }, [curriculumInfographic?.imageUrl, activeInfographicStrokeKey, infographicDrawBrushPx, infographicDrawTool, infographicDrawColor, upsertInfographicStroke, sendInfographicDrawMessage, appendInfographicStrokePoints])


  useLayoutEffect(() => {
    renderAllInfographicDrawCanvases()
    const raf = typeof window !== 'undefined' ? window.requestAnimationFrame(() => renderAllInfographicDrawCanvases()) : 0
    return () => {
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [
    renderAllInfographicDrawCanvases,
    currentIndex,
    infographicFullscreenOpen,
    visualFullscreenOpen,
    presenterLeftTab,
    studentCurriculumLeftPaneTab,
    isTeacherView,
  ])

  useEffect(() => {
    const redraw = () => renderAllInfographicDrawCanvases()
    const stages = typeof document !== 'undefined' ? (Array.from(document.querySelectorAll('[data-infographic-draw-pane-stage]')) as HTMLElement[]) : []
    const listeners: Array<() => void> = []
    const ro = new ResizeObserver(redraw)
    for (const stage of stages) {
      ro.observe(stage)
      const img = stage.querySelector('img')
      if (img) {
        const im = img as HTMLImageElement
        im.addEventListener('load', redraw)
        listeners.push(() => im.removeEventListener('load', redraw))
        ro.observe(im)
      }
    }
    const onWindowResize = redraw
    window.addEventListener('resize', onWindowResize)
    redraw()
    const raf = typeof window !== 'undefined' ? window.requestAnimationFrame(redraw) : 0
    return () => {
      for (const off of listeners) off()
      ro.disconnect()
      window.removeEventListener('resize', onWindowResize)
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [
    renderAllInfographicDrawCanvases,
    currentIndex,
    infographicFullscreenOpen,
    visualFullscreenOpen,
    presenterLeftTab,
    studentCurriculumLeftPaneTab,
    isTeacherView,
    curriculumInfographic?.imageUrl,
  ])


  useEffect(() => {
    // Khi đổi slide (đặc biệt từ biểu đồ -> infographic), DOM/ảnh có thể ổn định muộn hơn 1 frame.
    // Redraw nhiều nhịp ngắn để nét vẽ hiện ngay, không cần click vào ảnh.
    const timers: Array<ReturnType<typeof setTimeout>> = []
    const run = () => renderAllInfographicDrawCanvases()
    run()
    timers.push(setTimeout(run, 40))
    timers.push(setTimeout(run, 120))
    timers.push(setTimeout(run, 260))
    return () => {
      for (const id of timers) clearTimeout(id)
    }
  }, [
    renderAllInfographicDrawCanvases,
    currentIndex,
    infographicFullscreenOpen,
    visualFullscreenOpen,
    presenterLeftTab,
    studentCurriculumLeftPaneTab,
    curriculumInfographic?.imageUrl,
  ])

  useEffect(() => {
    // Repaint nhẹ sau đổi slide/tab để tránh phải click mới hiện nét nhưng không tạo tải cao.
    const timers: Array<ReturnType<typeof setTimeout>> = []
    const run = () => renderAllInfographicDrawCanvases()
    timers.push(setTimeout(run, 450))
    timers.push(setTimeout(run, 900))
    timers.push(setTimeout(run, 1500))
    return () => {
      for (const id of timers) clearTimeout(id)
    }
  }, [
    renderAllInfographicDrawCanvases,
    currentIndex,
    infographicFullscreenOpen,
    visualFullscreenOpen,
    presenterLeftTab,
    studentCurriculumLeftPaneTab,
    curriculumInfographic?.imageUrl,
  ])

  const recordCurriculumPayloadSample = useCallback((
    wireContent: string,
    wireSlides: Array<{
      title?: unknown
      blocks?: Array<{ header?: unknown; content?: unknown }>
      teacherNotes?: unknown
      imageUrl?: unknown
      visualEmbed?: unknown
      visualCells?: Array<{ visualEmbed?: unknown; imageUrl?: unknown }>
      visualInput1?: unknown
      visualInput2?: unknown
      visualInput3?: unknown
      visualInput4?: unknown
    }>,
    messageType = 'curriculum-data'
  ) => {
    const contentBytes = estimateTextBytes(wireContent)
    let slidesBytes = 0
    for (const s of wireSlides) slidesBytes += estimateSlideBytes(s)
    const approxPayloadBytes = contentBytes + slidesBytes + 2048
    const now = Date.now()
    const nextEvents = [
      ...curriculumPayloadStatsRef.current.events.filter((e) => now - e.at <= 120_000),
      { at: now, bytes: approxPayloadBytes, type: messageType },
    ]
    curriculumPayloadStatsRef.current.events = nextEvents
    curriculumPayloadStatsRef.current.lastBytes = approxPayloadBytes
    curriculumPayloadStatsRef.current.lastType = messageType
    if (
      curriculumPayloadStatsRef.current.peakBytes == null ||
      approxPayloadBytes > curriculumPayloadStatsRef.current.peakBytes
    ) {
      curriculumPayloadStatsRef.current.peakBytes = approxPayloadBytes
      curriculumPayloadStatsRef.current.peakType = messageType
      if (memoryDebugEnabled) {
        try {
          console.info('[MemoryProbe] payload peak', {
            type: messageType,
            payloadMb: Number(bytesToMb(approxPayloadBytes).toFixed(1)),
          })
        } catch {
          /* ignore */
        }
      }
    }
  }, [memoryDebugEnabled])

  const sendCurriculumDataToStudent = useCallback((slidesToSend: SlideItem[], currentIndexOverride?: number) => {
    const idx = typeof currentIndexOverride === 'number' ? currentIndexOverride : currentIndex
    // Chỉ gửi payload nặng cho chunk đang dùng; slide xa gửi bản nhẹ để giảm RAM/copy-cost.
    const keepFullTextForAllSlides = !worksheetPresentation && studentCurriculumRightMode === 'markdown-all'
    const lightweightSlides = pruneStudentSlidesByChunk(slidesToSend, idx, { keepFullTextForAllSlides })
    const wireSlides = lightweightSlides.map(toStudentSlidePayload)
    const wireContent = lightweightSlides.length > 0 ? '' : curriculumMarkdown
    const payloadDigest = [
      idx,
      keepFullTextForAllSlides ? 1 : 0,
      String(topic ?? '').length,
      String(curriculumMarkdown ?? '').length,
      String(curriculumInfographic?.imageUrl ?? '').length,
      wireSlides.map((s) => slideWireDigestKey(s)).join(','),
    ].join('|')
    const now = Date.now()
    if (
      payloadDigest === lastCurriculumPayloadDigestRef.current &&
      now - lastCurriculumPayloadSentAtRef.current < CURRICULUM_PAYLOAD_DEDUPE_WINDOW_MS
    ) {
      return
    }
    lastCurriculumPayloadDigestRef.current = payloadDigest
    lastCurriculumPayloadSentAtRef.current = now
    const payload = {
      type: 'curriculum-data',
      content: wireContent,
      topic,
      currentIndex: Math.max(0, Math.min(idx, lightweightSlides.length - 1)),
      curriculumId: null,
      slideMode: null,
      personalViewSubMode: 'current',
      hasOriginalSlides: false,
      slides: wireSlides,
      teacherTimerSeconds,
      teacherTimerRunning,
      ...(curriculumId && curriculumInfographic ? { curriculumInfographic } : {}),
    }
    recordCurriculumPayloadSample(wireContent, wireSlides, 'curriculum-data')
    try {
      const w = studentViewWindowRef.current
      if (w && !w.closed) {
        w.postMessage(payload, window.location.origin)
      } else {
        syncChannelRef.current?.postMessage(payload)
      }
    } catch { /* ignore */ }
  }, [
    curriculumMarkdown,
    topic,
    currentIndex,
    teacherTimerSeconds,
    teacherTimerRunning,
    toStudentSlidePayload,
    curriculumId,
    curriculumInfographic,
    worksheetPresentation,
    studentCurriculumRightMode,
    recordCurriculumPayloadSample,
  ])

  const openStudentView = useCallback(() => {
    if (typeof window === 'undefined' || !isWorksheetTeacher || slides.length === 0) return
    const sw = typeof screen !== 'undefined' ? screen.availWidth || 1920 : 1920
    const sh = typeof screen !== 'undefined' ? screen.availHeight || 1080 : 1080
    const features = `width=${sw},height=${sh},left=0,top=0,scrollbars=no,resizable=yes`
    const { url: baseSlideUrl, windowName } = getStudentSlideWindowConfig(true)
    const urlWithSync = studentSlideUrlWithSync(baseSlideUrl, worksheetTabSyncId)
    let targetWin: Window | null = null
    try { targetWin = window.open('', windowName) } catch { targetWin = null }
    if (!targetWin || targetWin.closed) targetWin = window.open(urlWithSync, windowName, features)
    if (!targetWin) {
      toast({ title: tr('Không mở được giao diện học sinh', 'Cannot open student view', '无法打开学生界面', '生徒画面を開けません', '학생 화면을 열 수 없습니다'), description: tr('Trình duyệt đã chặn popup.', 'Popup was blocked.', '浏览器阻止了弹窗。', 'ポップアップがブロックされました。', '팝업이 차단되었습니다.'), variant: 'destructive' })
      return
    }
    studentViewWindowRef.current = targetWin
    // New/recovered student window should receive a fresh full payload immediately.
    lastCurriculumPayloadDigestRef.current = ''
    lastCurriculumPayloadSentAtRef.current = 0
    try {
      const path = targetWin.location?.pathname || ''
      const syncOk = new URLSearchParams(targetWin.location.search || '').get('sync') === worksheetTabSyncId
      if (!isPathMatchingStudentSlideKind(path, 'worksheet') || !syncOk) targetWin.location.href = urlWithSync
    } catch { /* ignore */ }
    try { targetWin.focus() } catch { /* ignore */ }
    const sendState = () => {
      try {
        if (targetWin!.closed) return
        sendCurriculumDataToStudent(slides)
        targetWin!.postMessage({ type: 'presentation-mode', mode: 'slide-interaction' }, window.location.origin)
        targetWin!.postMessage({ type: 'slide-go', index: currentIndex }, window.location.origin)
        targetWin!.postMessage({ type: 'teacher-timer-sync', seconds: teacherTimerSeconds, running: teacherTimerRunning }, window.location.origin)
      } catch { /* ignore */ }
    }
    sendState()
    setTimeout(sendState, 300)
  }, [isWorksheetTeacher, slides, currentIndex, teacherTimerSeconds, teacherTimerRunning, sendCurriculumDataToStudent, toast, tr, worksheetTabSyncId])

  useEffect(() => {
    if (!isWorksheetTeacher) return
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'request-curriculum' && e.source && slides.length > 0) {
        try {
          const src = e.source as Window
          const keepFullTextForAllSlides = !worksheetPresentation && studentCurriculumRightMode === 'markdown-all'
          const lightweightSlides = pruneStudentSlidesByChunk(slides, currentIndex, { keepFullTextForAllSlides })
          const wireSlides = lightweightSlides.map(toStudentSlidePayload)
          const wireContent = lightweightSlides.length > 0 ? '' : curriculumMarkdown
          recordCurriculumPayloadSample(wireContent, wireSlides, 'curriculum-data:request')
          src.postMessage({
            type: 'curriculum-data',
            content: wireContent,
            topic,
            currentIndex,
            curriculumId: null,
            slideMode: null,
            personalViewSubMode: 'current',
            hasOriginalSlides: false,
            slides: wireSlides,
            teacherTimerSeconds,
            teacherTimerRunning,
          }, window.location.origin)
          src.postMessage({ type: 'presentation-mode', mode: 'slide-interaction' }, window.location.origin)
        } catch { /* ignore */ }
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [
    isWorksheetTeacher,
    curriculumMarkdown,
    topic,
    currentIndex,
    slides,
    teacherTimerSeconds,
    teacherTimerRunning,
    toStudentSlidePayload,
    worksheetPresentation,
    studentCurriculumRightMode,
    recordCurriculumPayloadSample,
  ])

  useEffect(() => {
    if (!isWorksheetTeacher) return
    const w = studentViewWindowRef.current
    if (!w || w.closed) return
    sendCurriculumDataToStudent(slides)
    sendToStudentView({ type: 'slide-go', index: currentIndex })
  }, [isWorksheetTeacher, currentIndex, slides, sendCurriculumDataToStudent, sendToStudentView])

  const effectiveOnOpenStudentView = onOpenStudentViewProp ?? (isWorksheetTeacher && slides.length > 0 ? openStudentView : undefined)

  const handleShareClick = useCallback(async () => {
    if (shareInProgressRef.current || shareDialogOpen || shareLoading) return
    if (slides.length === 0) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Chưa có slide để chia sẻ.', 'No slides to share.', '暂无幻灯片可分享。', '共有するスライドがありません。', '공유할 슬라이드가 없습니다.'), variant: 'destructive' })
      return
    }
    shareInProgressRef.current = true
    setShareLoading(true)
    setShareUrl(null)
    setShareQrDataUrl(null)
    setShareDialogOpen(true)
    try {
      const payload = {
        content: curriculumMarkdown,
        topic: topic || 'Bài giảng',
        slides: slides.map((s) => ({
          title: s.title,
          blocks: s.blocks,
          teacherNotes: s.teacherNotes,
          imageUrl: s.imageUrl,
          visualEmbed: s.visualEmbed,
          visualLayout: s.visualLayout,
          visualCells: s.visualCells,
          visualInput1: s.visualInput1,
          visualInput2: s.visualInput2,
          visualInput3: s.visualInput3,
          visualInput4: s.visualInput4,
        })),
        slideMode: slideMode ?? null,
        curriculumId: curriculumId ?? null,
      }
      const res = await fetch('/api/giao-trinh/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: data?.error ?? tr('Không tạo được link chia sẻ.', 'Could not create share link.', '无法创建分享链接。', '共有リンクを作成できません。', '공유 링크를 만들 수 없습니다.'), variant: 'destructive' })
        setShareDialogOpen(false)
        return
      }
      const url = data.shareUrl
      if (url) {
        setShareUrl(url)
        try {
          const qr = await QRCode.toDataURL(url, { width: 200, margin: 2 })
          setShareQrDataUrl(qr)
        } catch {
          /* ignore */
        }
        toast({ title: tr('Đã tạo link chia sẻ', 'Share link created', '已创建分享链接', '共有リンクを作成しました', '공유 링크 생성됨'), description: tr('Chia sẻ link hoặc quét QR để học sinh xem slide.', 'Share link or scan QR for students to view slides.', '分享链接或扫码让学生查看幻灯片。', 'リンク共有またはQRスキャンで生徒がスライドを表示。', '링크 공유 또는 QR 스캔으로 학생이 슬라이드 보기.'), duration: 3000 })
      }
    } catch (e) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: e instanceof Error ? e.message : String(e), variant: 'destructive' })
      setShareDialogOpen(false)
    } finally {
      setShareLoading(false)
      shareInProgressRef.current = false
    }
  }, [slides, curriculumMarkdown, topic, slideMode, curriculumId, toast, tr])

  const copyShareLink = useCallback(() => {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl)
    toast({ title: tr('Đã copy', 'Copied', '已复制', 'コピーしました', '복사됨'), description: tr('Link đã được sao chép.', 'Link copied.', '链接已复制。', 'リンクをコピーしました。', '링크가 복사되었습니다.'), duration: 2000 })
  }, [shareUrl, toast, tr])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.name) {
      window.name =
        !isTeacherView && worksheetPresentation ? STUDENT_WINDOW_NAME_WORKSHEET : STUDENT_WINDOW_NAME_CURRICULUM
    }
  }, [isTeacherView, worksheetPresentation])

  const openTeacherView = useCallback(() => {
    if (typeof window === 'undefined') return
    // Ưu tiên window name cố định để browser xử lý focus ổn định hơn.
    try {
      const namedRef = window.open('', TEACHER_SLIDE_WINDOW_TARGET_NAME)
      if (namedRef) {
        try {
          namedRef.postMessage({ type: 'request-curriculum' }, window.location.origin)
          namedRef.postMessage({ type: 'teacher-focus-request' }, window.location.origin)
        } catch {
          /* ignore postMessage errors */
        }
        try { namedRef.focus() } catch { /* ignore */ }
        return
      }
    } catch {
      /* ignore named window errors */
    }
    try {
      const opener = window.opener as Window | null
      if (opener && !opener.closed) {
        try {
          opener.postMessage({ type: 'request-curriculum' }, window.location.origin)
          opener.postMessage({ type: 'teacher-focus-request' }, window.location.origin)
        } catch {
          /* ignore postMessage errors */
        }
        try { opener.focus() } catch { /* ignore focus errors */ }
        return
      }
    } catch {
      /* ignore opener access errors */
    }
    toast({
      title: tr('Không tìm thấy cửa sổ giáo viên', 'Teacher window not found', '未找到教师窗口', '教師ウィンドウが見つかりません', '교사 창을 찾을 수 없습니다'),
      description: tr('Vui lòng quay lại cửa sổ giáo viên đã mở giao diện học sinh này.', 'Please return to the teacher window that opened this student view.', '请返回最初打开此学生视图的教师窗口。', 'この生徒画面を開いた教師ウィンドウに戻ってください。', '이 학생 화면을 연 교사 창으로 돌아가 주세요.'),
      variant: 'destructive',
    })
  }, [toast, tr])

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
      // Deduplicate: sendToStudentView gửi cả postMessage + BroadcastChannel → student nhận 2 lần
      const seq = e.data?.__syncSeq
      if (typeof seq === 'number') {
        if (processedSyncSeqRef.current.has(seq)) return
        processedSyncSeqRef.current.add(seq)
        if (processedSyncSeqRef.current.size > 100) {
          const arr = Array.from(processedSyncSeqRef.current).sort((a, b) => a - b)
          processedSyncSeqRef.current = new Set(arr.slice(-50))
        }
      }
      const t = e.data?.type
      const syncVirtualCursorFromInfographicUv = (point: { u?: number; v?: number } | null | undefined) => {
        if (isTeacherView || !point) return
        const u = clamp01(Number(point.u) || 0)
        const v = clamp01(Number(point.v) || 0)
        const candidates: HTMLImageElement[] = []
        if (infographicFullscreenImageRef.current) candidates.push(infographicFullscreenImageRef.current)
        if (infographicPaneImageRef.current) candidates.push(infographicPaneImageRef.current)
        const queried = Array.from(document.querySelectorAll('[data-student-curriculum-infographic-pane-img]')) as HTMLImageElement[]
        candidates.push(...queried)
        let chosen: HTMLImageElement | null = null
        let chosenArea = 0
        for (const img of candidates) {
          if (!img) continue
          const vis = getVisibleImageBounds(img)
          if (vis.width <= 40 || vis.height <= 40) continue
          const area = vis.width * vis.height
          if (area > chosenArea) {
            chosen = img
            chosenArea = area
          }
        }
        if (!chosen) return
        const vis = getVisibleImageBounds(chosen)
        const px = vis.left + u * vis.width
        const py = vis.top + v * vis.height
        const nextPos = { x: px, y: py }
        lastMouseScopeRef.current = 'visual'
        lastRenderedVirtualMouseRef.current = nextPos
        setVirtualMousePos(nextPos)
        setMouseTrail((prev) => {
          const last = prev[prev.length - 1]
          if (!last) return [nextPos]
          const jumpPx = Math.hypot(nextPos.x - last.x, nextPos.y - last.y)
          if (jumpPx > 120) return [nextPos]
          return [...prev, nextPos].slice(-48)
        })
      }
      if (
        t === 'curriculum-data' &&
        !isTeacherView &&
        Object.prototype.hasOwnProperty.call(e.data ?? {}, 'infographicDrawStrokesBySlide')
      ) {
        const incoming = e.data.infographicDrawStrokesBySlide as Record<string, InfographicDrawStroke[]> | undefined
        const normalized: Record<number, InfographicDrawStroke[]> = {}
        for (const [k, list] of Object.entries(incoming ?? {})) {
          const idx = Number(k)
          if (!Number.isFinite(idx) || !Array.isArray(list)) continue
          normalized[idx] = list
            .filter((s) => s && typeof s.id === 'string' && Array.isArray(s.points))
            .map((s) => clampInfographicStroke({
              id: s.id,
              tool: s.tool === 'eraser' ? 'eraser' : 'pen',
              color: typeof s.color === 'string' ? s.color : '#ef4444',
              sizeNorm: INFOGRAPHIC_UNIFIED_STROKE_NORM,
              points: s.points.map((p) => ({ u: clamp01(Number(p.u) || 0), v: clamp01(Number(p.v) || 0) })),
            }))
        }
        // Gộp theo stroke id để không làm mất nét local của học sinh khi sync từ giáo viên.
        setInfographicDrawStrokesBySlide((prev) => mergeIncomingInfographicStrokes(prev, normalized))
      }
      else if (t === 'infographic-draw-sync' && e.data?.strokesBySlide && !isTeacherView) {
        const incoming = e.data.strokesBySlide as Record<string, InfographicDrawStroke[]>
        const normalized: Record<number, InfographicDrawStroke[]> = {}
        for (const [k, list] of Object.entries(incoming ?? {})) {
          const idx = Number(k)
          if (!Number.isFinite(idx) || !Array.isArray(list)) continue
          normalized[idx] = list
            .filter((s) => s && typeof s.id === 'string' && Array.isArray(s.points))
            .map((s) => clampInfographicStroke({
              id: s.id,
              tool: s.tool === 'eraser' ? 'eraser' : 'pen',
              color: typeof s.color === 'string' ? s.color : '#ef4444',
              sizeNorm: INFOGRAPHIC_UNIFIED_STROKE_NORM,
              points: s.points.map((p) => ({ u: clamp01(Number(p.u) || 0), v: clamp01(Number(p.v) || 0) })),
            }))
        }
        setInfographicDrawStrokesBySlide((prev) => mergeIncomingInfographicStrokes(prev, normalized))
      }
      else if (t === 'teacher-timer-start') setTeacherTimerRunning(true)
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
      else if (t === 'request-projector-mode' && !isTeacherView) {
        try {
          const fsEl =
            document.fullscreenElement ??
            (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement ??
            null
          if (fsEl) {
            const exitFs = (document.exitFullscreen ?? (document as Document & { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen)?.bind(document)
            try { void exitFs?.()?.catch(() => {}) } catch { /* ignore */ }
            setProjectorPromptVisible(false)
          } else {
            const root = document.documentElement
            const reqFs =
              root.requestFullscreen ??
              (root as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen
            try {
              const p = reqFs?.call(root) as Promise<void> | undefined
              if (p) {
                p.then(() => setProjectorPromptVisible(false)).catch(() => setProjectorPromptVisible(true))
              } else {
                setProjectorPromptVisible(true)
              }
            } catch {
              setProjectorPromptVisible(true)
            }
            window.setTimeout(() => {
              const cur = document.fullscreenElement ??
                (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement
              if (!cur) setProjectorPromptVisible(true)
            }, 250)
          }
        } catch { /* ignore */ }
      }
      else if (t === 'set-auto-play' && typeof e.data?.value === 'boolean') setAutoPlay(e.data.value)
      else if (t === 'set-auto-play-interval' && typeof e.data?.ms === 'number') setAutoPlayIntervalMs(e.data.ms)
      else if (
        t === 'student-curriculum-right-mode' &&
        (e.data?.mode === 'markdown-all' || e.data?.mode === 'single-slide')
      ) {
        if (!isTeacherView && !worksheetPresentation) setStudentCurriculumRightMode(e.data.mode)
      }
      else if (t === 'student-curriculum-left-pane' && (e.data?.pane === 'infographic' || e.data?.pane === 'visual')) {
        if (!isTeacherView && !worksheetPresentation) {
          setStudentCurriculumLeftPaneTab(e.data.pane)
          closeInfographicFullscreenRef.current({ fromMessage: true })
        }
      }
      else if (t === 'quiz-popup-open' && typeof e.data?.value === 'boolean') setQuizPopupOpen(e.data.value)
      else if (t === 'quiz-session-code' && typeof e.data?.slideIndex === 'number' && typeof e.data?.blockIndex === 'number' && typeof e.data?.sessionCode === 'string') {
        const key = `${e.data.slideIndex}-${e.data.blockIndex}`
        const quizDurationSeconds = typeof e.data?.quizDurationSeconds === 'number' ? e.data.quizDurationSeconds : 60
        setQuizSessionData((prev) => ({ ...prev, [key]: { sessionCode: e.data.sessionCode, quizDurationSeconds } }))
      }
      else if (t === 'quiz-session-settings' && typeof e.data?.slideIndex === 'number' && typeof e.data?.blockIndex === 'number') {
        const key = `${e.data.slideIndex}-${e.data.blockIndex}`
        const quizDurationSeconds = typeof e.data?.quizDurationSeconds === 'number' ? e.data.quizDurationSeconds : 60
        const autoRevealOnTimerEnd = typeof e.data?.autoRevealOnTimerEnd === 'boolean' ? e.data.autoRevealOnTimerEnd : true
        setQuizSessionSettings((prev) => ({ ...prev, [key]: { quizDurationSeconds, autoRevealOnTimerEnd } }))
      }
      else if (t === 'quiz-session-reset-slide' && typeof e.data?.slideIndex === 'number') {
        const prefix = `${e.data.slideIndex}-`
        setQuizSessionData((prev) => {
          const next = { ...prev }
          for (const k of Object.keys(next)) {
            if (k.startsWith(prefix)) delete next[k]
          }
          return next
        })
        setQuizSessionSettings((prev) => {
          const next = { ...prev }
          for (const k of Object.keys(next)) {
            if (k.startsWith(prefix)) delete next[k]
          }
          return next
        })
      }
      else if (t === 'quiz-popup-scroll' && typeof e.data?.scrollTop === 'number') {
        const scrollTop = e.data.scrollTop
        const el = document.querySelector('[data-quiz-popup-scroll]') as HTMLElement | null
        if (el && Math.abs(el.scrollTop - scrollTop) > 2) {
          quizPopupScrollApplyingRef.current = true
          el.scrollTop = scrollTop
          setTimeout(() => { quizPopupScrollApplyingRef.current = false }, 80)
        }
      }
      else if (t === 'slide-content-layout' && typeof e.data?.layoutW === 'number' && e.data.layoutW > 0) {
        if (!isTeacherView) {
          const lw = Math.round(e.data.layoutW)
          setSyncedTeacherSlideLayoutW((prev) => (prev != null && Math.abs(prev - lw) < 2 ? prev : lw))
        }
      }
      else if (t === 'infographic-draw-start' && typeof e.data?.slideIndex === 'number' && e.data?.stroke) {
        const stroke = e.data.stroke as InfographicDrawStroke
        if (stroke && typeof stroke.id === 'string' && Array.isArray(stroke.points)) {
          upsertInfographicStroke(e.data.slideIndex, {
            id: stroke.id,
            tool: stroke.tool === 'eraser' ? 'eraser' : 'pen',
            color: typeof stroke.color === 'string' ? stroke.color : '#ef4444',
            sizeNorm: INFOGRAPHIC_UNIFIED_STROKE_NORM,
            points: stroke.points.map((p) => ({ u: clamp01(Number(p.u) || 0), v: clamp01(Number(p.v) || 0) })),
          })
          syncVirtualCursorFromInfographicUv(stroke.points[stroke.points.length - 1])
        }
      }
      else if (
        t === 'infographic-draw-point' &&
        typeof e.data?.slideIndex === 'number' &&
        typeof e.data?.strokeId === 'string' &&
        e.data?.point
      ) {
        appendInfographicStrokePoint(e.data.slideIndex, e.data.strokeId, {
          u: clamp01(Number(e.data.point.u) || 0),
          v: clamp01(Number(e.data.point.v) || 0),
        })
        syncVirtualCursorFromInfographicUv(e.data.point as { u?: number; v?: number })
      }
      else if (
        t === 'infographic-draw-points' &&
        typeof e.data?.slideIndex === 'number' &&
        typeof e.data?.strokeId === 'string' &&
        Array.isArray(e.data?.points)
      ) {
        const points = (e.data.points as Array<{ u?: number; v?: number }>).map((p) => ({
          u: clamp01(Number(p?.u) || 0),
          v: clamp01(Number(p?.v) || 0),
        }))
        appendInfographicStrokePoints(e.data.slideIndex, e.data.strokeId, points)
        syncVirtualCursorFromInfographicUv(points[points.length - 1])
      }
      else if (t === 'infographic-draw-clear' && typeof e.data?.slideIndex === 'number') {
        clearInfographicStrokes(e.data.slideIndex)
      }
      else if (t === 'infographic-draw-undo' && typeof e.data?.slideIndex === 'number') {
        undoInfographicStroke(e.data.slideIndex)
      }
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
          setSyncedTeacherSlideLayoutW(null)
        }
        lastMouseScopeRef.current = null
        lastRenderedVirtualMouseRef.current = null
        lastVisualScopeMoveAtRef.current = 0
      }
      else if (t === 'visual-fullscreen-open') {
        const cellIndex = typeof e.data?.cellIndex === 'number' ? e.data.cellIndex : undefined
        openVisualFullscreen(cellIndex, true)
      }
      else if (t === 'visual-fullscreen-close') {
        const sinceLocalOpen = Date.now() - lastLocalVisualOpenRef.current
        if (sinceLocalOpen < 800) return
        closeVisualFullscreenRef.current({ fromMessage: true })
      }
      else if (t === 'infographic-fullscreen-open') {
        openInfographicFullscreen(true)
      }
      else if (t === 'infographic-fullscreen-close') {
        const sinceLocalOpen = Date.now() - lastLocalInfographicOpenRef.current
        if (sinceLocalOpen < 800) return
        closeInfographicFullscreenRef.current({ fromMessage: true })
      }
      else if (t === 'mouse-pos') {
        const mouseScope: 'quiz' | 'slide-content' | 'visual' | 'global' =
          e.data?.quizPopup
            ? 'quiz'
            : e.data?.slideContentPane
              ? 'slide-content'
              : (e.data?.visualFrame || e.data?.infographicToolbar)
                ? 'visual'
                : 'global'
        const nowTs = Date.now()
        // Không chặn gói global để đảm bảo chuột ảo luôn theo kịp chuột thật.
        let px: number
        let py: number
        const isUsableRect = (r: DOMRect | null | undefined): r is DOMRect => !!r && r.width > 40 && r.height > 40
        if (typeof e.data?.syncAnchor === 'string' && typeof e.data?.relX === 'number' && typeof e.data?.relY === 'number') {
          const anchorId = String(e.data.syncAnchor)
          const relX = Math.max(0, Math.min(1, Number(e.data.relX)))
          const relY = Math.max(0, Math.min(1, Number(e.data.relY)))
          const el = document.querySelector(`[data-pointer-sync-id="${CSS.escape(anchorId)}"]`) as HTMLElement | null
          const r = el?.getBoundingClientRect()
          if (r && r.width > 0 && r.height > 0) {
            px = r.left + relX * r.width
            py = r.top + relY * r.height
          } else return
        } else if (e.data?.quizPopup && typeof e.data?.relX === 'number' && typeof e.data?.relY === 'number') {
          const el = document.querySelector('[data-quiz-popup]')
          const rect = el ? (el as HTMLElement).getBoundingClientRect() : null
          if (rect) {
            px = rect.right - e.data.relX
            py = rect.top + e.data.relY
          } else {
            const w = typeof window !== 'undefined' ? window.innerWidth : 1920
            const h = typeof window !== 'undefined' ? window.innerHeight : 1080
            const pw = w * 0.8
            const ph = h * 0.85
            const pr = (w + pw) / 2
            const pt = (h - ph) / 2
            px = pr - e.data.relX
            py = pt + e.data.relY
          }
        } else if (e.data?.infographicToolbar && typeof e.data?.relX === 'number' && typeof e.data?.relY === 'number') {
          const relX = Math.max(0, Math.min(1, e.data.relX))
          const relY = Math.max(0, Math.min(1, e.data.relY))
          const toolbarIndex = typeof e.data?.toolbarIndex === 'number' ? Math.max(0, Math.floor(e.data.toolbarIndex)) : 0
          const visibleToolbars = (Array.from(document.querySelectorAll('[data-infographic-toolbar="student-pane"]')) as HTMLElement[])
            .filter((el) => {
              const r = el.getBoundingClientRect()
              return r.width > 8 && r.height > 8
            })
            .sort((a, b) => {
              const ar = a.getBoundingClientRect()
              const br = b.getBoundingClientRect()
              return ar.top === br.top ? ar.left - br.left : ar.top - br.top
            })
          const toolbar = visibleToolbars[toolbarIndex] ?? visibleToolbars[0] ?? null
          const toolbarButtonIndex = typeof e.data?.toolbarButtonIndex === 'number' ? Math.floor(e.data.toolbarButtonIndex) : -1
          if (toolbar && toolbarButtonIndex >= 0) {
            const toolbarButtons = Array.from(toolbar.querySelectorAll('button')) as HTMLElement[]
            const btn = toolbarButtons[toolbarButtonIndex]
            const br = btn?.getBoundingClientRect() ?? null
            if (br && br.width > 4 && br.height > 4) {
              px = br.left + br.width / 2
              py = br.top + br.height / 2
            } else {
              const rect = toolbar.getBoundingClientRect()
              if (isUsableRect(rect)) {
                px = rect.left + relX * rect.width
                py = rect.top + relY * rect.height
              } else return
            }
          } else {
            const rect = toolbar?.getBoundingClientRect() ?? null
            if (isUsableRect(rect)) {
              px = rect.left + relX * rect.width
              py = rect.top + relY * rect.height
            } else return
          }
        } else if (
          e.data?.slideContentPane &&
          typeof e.data?.relX === 'number' &&
          typeof e.data?.relY === 'number'
        ) {
          const preferProseBlock =
            e.data.pointerProseBlock === true &&
            typeof e.data.pointerSlideIndex === 'number' &&
            typeof e.data.pointerBlockIndex === 'number'
          const preferBody = e.data.slidePointerBody === true
          const inMarkdownAll = !isTeacherView && !worksheetPresentation && studentCurriculumRightMode === 'markdown-all'
          const slideIdxFromMsg = typeof e.data.pointerSlideIndex === 'number' ? Math.floor(e.data.pointerSlideIndex) : null
          let lr: DOMRect | undefined
          if (preferProseBlock) {
            const proseEl = document.querySelector(
              `[data-pointer-prose-root][data-slide-index="${e.data.pointerSlideIndex}"][data-block-index="${e.data.pointerBlockIndex}"]`
            ) as HTMLElement | null
            const rr = proseEl?.getBoundingClientRect()
            if (rr && rr.width > 0 && rr.height > 0) lr = rr
          }
          if (!lr && inMarkdownAll && slideIdxFromMsg != null) {
            const slideEl = document.getElementById(`nano-student-md-slide-${slideIdxFromMsg}`)
            const rr = slideEl?.getBoundingClientRect()
            if (rr && rr.width > 0 && rr.height > 0) lr = rr
          }
          if (!lr && !inMarkdownAll && preferBody) {
            const bodyEl = studentSlidePointerSyncRef.current
            const br = bodyEl?.getBoundingClientRect()
            if (br && br.width > 0 && br.height > 0) lr = br
          }
          if (!lr && !inMarkdownAll) {
            const layoutEl = studentSlideContentLayoutRef.current
            const gr = layoutEl?.getBoundingClientRect()
            if (gr && gr.width > 0 && gr.height > 0) lr = gr
          }
          if (lr) {
            px = lr.left + e.data.relX * lr.width
            py = lr.top + e.data.relY * lr.height
          } else {
            const pane = studentMdRightColumnScrollRef.current
            const rect = pane ? pane.getBoundingClientRect() : null
            if (rect && rect.width > 0 && rect.height > 0) {
              px = rect.left + e.data.relX * rect.width
              py = rect.top + e.data.relY * rect.height
            } else return
          }
        } else if (
          e.data?.visualFrame &&
          e.data?.imageCenter &&
          e.data?.cellIndex === -1 &&
          typeof e.data?.dxFromCenter === 'number' &&
          typeof e.data?.dyFromCenter === 'number' &&
          typeof e.data?.visW === 'number' &&
          typeof e.data?.visH === 'number'
        ) {
          let img: HTMLImageElement | null = null
          if (infographicFullscreenOpen && infographicFullscreenOverlayRef.current) {
            img = infographicFullscreenOverlayRef.current.querySelector('img')
          }
          if (!img) {
            img = document.querySelector('[data-student-curriculum-infographic-pane-img]') as HTMLImageElement | null
          }
          if (img?.complete && img.naturalWidth > 0) {
            const vis = getVisibleImageBounds(img)
            const cx = vis.left + vis.width / 2
            const cy = vis.top + vis.height / 2
            const scaleX = vis.width / (e.data.visW || 1)
            const scaleY = vis.height / (e.data.visH || 1)
            px = cx + e.data.dxFromCenter * scaleX
            py = cy + e.data.dyFromCenter * scaleY
          } else return
        } else if (
          e.data?.visualFrame &&
          e.data?.imageCenter &&
          typeof e.data?.cellIndex === 'number' &&
          e.data.cellIndex >= 0 &&
          typeof e.data?.dxFromCenter === 'number' &&
          typeof e.data?.dyFromCenter === 'number' &&
          typeof e.data?.visW === 'number' &&
          typeof e.data?.visH === 'number'
        ) {
          const frame = visualFullscreenOpen ? studentVisualFrameRef.current : studentEmbeddedVisualFrameRef.current
          if (!frame) return
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
        } else if (e.data?.visualFrame && typeof e.data?.relX === 'number' && typeof e.data?.relY === 'number') {
          const relX = Math.max(0, Math.min(1, e.data.relX))
          const relY = Math.max(0, Math.min(1, e.data.relY))
          // Chỉ lọc dải rất mỏng ở mép trên embedded visual để tránh điểm lỗi cũ, giảm mất tọa độ hợp lệ.
          if (!visualFullscreenOpen && e.data?.overlayRel === false && relY < 0.06) return
          const rect = (() => {
            if (visualFullscreenOpen) {
              const overlayOrFrame = e.data?.overlayRel && fullscreenOverlayRef.current
                ? fullscreenOverlayRef.current
                : studentVisualFrameRef.current
              const rr = overlayOrFrame?.getBoundingClientRect() ?? null
              if (isUsableRect(rr)) return rr
              return null
            }
            const frameRect = studentEmbeddedVisualFrameRef.current?.getBoundingClientRect() ?? null
            if (isUsableRect(frameRect)) return frameRect
            const viewportRect = studentEmbeddedVisualViewportRef.current?.getBoundingClientRect() ?? null
            if (isUsableRect(viewportRect)) return viewportRect
            return null
          })()
          if (isUsableRect(rect)) {
            px = rect.left + relX * rect.width
            py = rect.top + relY * rect.height
          } else return
        } else if (
          e.data?.visualFrame &&
          typeof e.data?.dxFromCenter === 'number' &&
          typeof e.data?.dyFromCenter === 'number' &&
          typeof e.data?.frameW === 'number' &&
          typeof e.data?.frameH === 'number'
        ) {
          const rect = (() => {
            if (visualFullscreenOpen) {
              const rr = studentVisualFrameRef.current?.getBoundingClientRect() ?? null
              if (isUsableRect(rr)) return rr
              return null
            }
            const frameRect = studentEmbeddedVisualFrameRef.current?.getBoundingClientRect() ?? null
            if (isUsableRect(frameRect)) return frameRect
            const viewportRect = studentEmbeddedVisualViewportRef.current?.getBoundingClientRect() ?? null
            if (isUsableRect(viewportRect)) return viewportRect
            return null
          })()
          if (!rect) return
          const cx = rect.left + rect.width / 2
          const cy = rect.top + rect.height / 2
          const scaleX = rect.width / (e.data.frameW || 1)
          const scaleY = rect.height / (e.data.frameH || 1)
          px = cx + e.data.dxFromCenter * scaleX
          py = cy + e.data.dyFromCenter * scaleY
        } else if (typeof e.data?.normX === 'number' && typeof e.data?.normY === 'number') {
          const w = typeof window !== 'undefined' ? window.innerWidth : 1920
          const h = typeof window !== 'undefined' ? window.innerHeight : 1080
          px = Math.max(0, Math.min(w, e.data.normX * w))
          py = Math.max(0, Math.min(h, e.data.normY * h))
        } else if (typeof e.data?.xrPx === 'number' && typeof e.data?.yPx === 'number') {
          const w = typeof window !== 'undefined' ? window.innerWidth : 1920
          const h = typeof window !== 'undefined' ? window.innerHeight : 1080
          px = Math.max(0, Math.min(w, w - e.data.xrPx))
          py = Math.max(0, Math.min(h, e.data.yPx))
        } else return
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1920
        const vh = typeof window !== 'undefined' ? window.innerHeight : 1080
        const clampedX = Math.max(0, Math.min(vw, px))
        const clampedY = Math.max(0, Math.min(vh, py))
        // Không chặn cứng điểm gần mép viewport để tránh mất gói khi rê nhanh.
        const previousScope = lastMouseScopeRef.current
        lastMouseScopeRef.current = mouseScope
        if (mouseScope === 'visual') lastVisualScopeMoveAtRef.current = nowTs
        const rendered = lastRenderedVirtualMouseRef.current
        const dx = rendered ? clampedX - rendered.x : 0
        const dy = rendered ? clampedY - rendered.y : 0
        const jumpPx = rendered ? Math.hypot(dx, dy) : 0
        const abruptJump = Math.abs(dx) > 150 || Math.abs(dy) > 150 || jumpPx > 180
        const shouldSnap = previousScope !== mouseScope || abruptJump || !rendered
        const nextPos = { x: clampedX, y: clampedY }
        lastRenderedVirtualMouseRef.current = nextPos
        // Batch các sample mouse-pos cao tần qua rAF: chỉ 1 setState mỗi frame ⇒ giảm RAM/CPU đáng kể.
        pendingMouseSamplesRef.current.push({ x: clampedX, y: clampedY, snap: shouldSnap })
        if (!mousePosRafScheduledRef.current && typeof window !== 'undefined') {
          mousePosRafScheduledRef.current = true
          window.requestAnimationFrame(() => {
            mousePosRafScheduledRef.current = false
            const samples = pendingMouseSamplesRef.current
            pendingMouseSamplesRef.current = []
            if (samples.length === 0) return
            const last = samples[samples.length - 1]
            setVirtualMousePos({ x: last.x, y: last.y })
            setMouseTrail((prev) => {
              let acc: Array<{ x: number; y: number }> = prev
              for (const s of samples) {
                if (s.snap) acc = [{ x: s.x, y: s.y }]
                else acc = [...acc, { x: s.x, y: s.y }]
              }
              return acc.slice(-160)
            })
          })
        }
      }
      else if (t === 'mouse-click' && presentationMode === 'slide-interaction') {
        let px: number
        let py: number
        const isUsableRect = (r: DOMRect | null | undefined): r is DOMRect => !!r && r.width > 40 && r.height > 40
        if (e.data?.quizPopup && typeof e.data?.relX === 'number' && typeof e.data?.relY === 'number') {
          const el = document.querySelector('[data-quiz-popup]')
          const rect = el ? (el as HTMLElement).getBoundingClientRect() : null
          if (rect) {
            px = rect.right - e.data.relX
            py = rect.top + e.data.relY
          } else {
            const w = typeof window !== 'undefined' ? window.innerWidth : 1920
            const h = typeof window !== 'undefined' ? window.innerHeight : 1080
            const pw = w * 0.8
            const ph = h * 0.85
            const pr = (w + pw) / 2
            const pt = (h - ph) / 2
            px = pr - e.data.relX
            py = pt + e.data.relY
          }
        } else if (e.data?.infographicToolbar && typeof e.data?.relX === 'number' && typeof e.data?.relY === 'number') {
          const relX = Math.max(0, Math.min(1, e.data.relX))
          const relY = Math.max(0, Math.min(1, e.data.relY))
          const toolbarIndex = typeof e.data?.toolbarIndex === 'number' ? Math.max(0, Math.floor(e.data.toolbarIndex)) : 0
          const visibleToolbars = (Array.from(document.querySelectorAll('[data-infographic-toolbar="student-pane"]')) as HTMLElement[])
            .filter((el) => {
              const r = el.getBoundingClientRect()
              return r.width > 8 && r.height > 8
            })
            .sort((a, b) => {
              const ar = a.getBoundingClientRect()
              const br = b.getBoundingClientRect()
              return ar.top === br.top ? ar.left - br.left : ar.top - br.top
            })
          const toolbar = visibleToolbars[toolbarIndex] ?? visibleToolbars[0] ?? null
          const toolbarButtonIndex = typeof e.data?.toolbarButtonIndex === 'number' ? Math.floor(e.data.toolbarButtonIndex) : -1
          if (toolbar && toolbarButtonIndex >= 0) {
            const toolbarButtons = Array.from(toolbar.querySelectorAll('button')) as HTMLElement[]
            const btn = toolbarButtons[toolbarButtonIndex]
            const br = btn?.getBoundingClientRect() ?? null
            if (br && br.width > 4 && br.height > 4) {
              px = br.left + br.width / 2
              py = br.top + br.height / 2
            } else {
              const rect = toolbar.getBoundingClientRect()
              if (isUsableRect(rect)) {
                px = rect.left + relX * rect.width
                py = rect.top + relY * rect.height
              } else return
            }
          } else {
            const rect = toolbar?.getBoundingClientRect() ?? null
            if (isUsableRect(rect)) {
              px = rect.left + relX * rect.width
              py = rect.top + relY * rect.height
            } else return
          }
        } else if (
          e.data?.slideContentPane &&
          typeof e.data?.relX === 'number' &&
          typeof e.data?.relY === 'number'
        ) {
          const preferProseBlock =
            e.data.pointerProseBlock === true &&
            typeof e.data.pointerSlideIndex === 'number' &&
            typeof e.data.pointerBlockIndex === 'number'
          const preferBody = e.data.slidePointerBody === true
          const inMarkdownAll = !isTeacherView && !worksheetPresentation && studentCurriculumRightMode === 'markdown-all'
          const slideIdxFromMsg = typeof e.data.pointerSlideIndex === 'number' ? Math.floor(e.data.pointerSlideIndex) : null
          let lr: DOMRect | undefined
          if (preferProseBlock) {
            const proseEl = document.querySelector(
              `[data-pointer-prose-root][data-slide-index="${e.data.pointerSlideIndex}"][data-block-index="${e.data.pointerBlockIndex}"]`
            ) as HTMLElement | null
            const rr = proseEl?.getBoundingClientRect()
            if (rr && rr.width > 0 && rr.height > 0) lr = rr
          }
          if (!lr && inMarkdownAll && slideIdxFromMsg != null) {
            const slideEl = document.getElementById(`nano-student-md-slide-${slideIdxFromMsg}`)
            const rr = slideEl?.getBoundingClientRect()
            if (rr && rr.width > 0 && rr.height > 0) lr = rr
          }
          if (!lr && !inMarkdownAll && preferBody) {
            const bodyEl = studentSlidePointerSyncRef.current
            const br = bodyEl?.getBoundingClientRect()
            if (br && br.width > 0 && br.height > 0) lr = br
          }
          if (!lr && !inMarkdownAll) {
            const layoutEl = studentSlideContentLayoutRef.current
            const gr = layoutEl?.getBoundingClientRect()
            if (gr && gr.width > 0 && gr.height > 0) lr = gr
          }
          if (lr) {
            px = lr.left + e.data.relX * lr.width
            py = lr.top + e.data.relY * lr.height
          } else {
            const pane = studentMdRightColumnScrollRef.current
            const rect = pane ? pane.getBoundingClientRect() : null
            if (rect && rect.width > 0 && rect.height > 0) {
              px = rect.left + e.data.relX * rect.width
              py = rect.top + e.data.relY * rect.height
            } else return
          }
        } else if (
          e.data?.visualFrame &&
          e.data?.imageCenter &&
          e.data?.cellIndex === -1 &&
          typeof e.data?.dxFromCenter === 'number' &&
          typeof e.data?.dyFromCenter === 'number' &&
          typeof e.data?.visW === 'number' &&
          typeof e.data?.visH === 'number'
        ) {
          let img: HTMLImageElement | null = null
          if (infographicFullscreenOpen && infographicFullscreenOverlayRef.current) {
            img = infographicFullscreenOverlayRef.current.querySelector('img')
          }
          if (!img) {
            img = document.querySelector('[data-student-curriculum-infographic-pane-img]') as HTMLImageElement | null
          }
          if (img?.complete && img.naturalWidth > 0) {
            const vis = getVisibleImageBounds(img)
            const cx = vis.left + vis.width / 2
            const cy = vis.top + vis.height / 2
            const scaleX = vis.width / (e.data.visW || 1)
            const scaleY = vis.height / (e.data.visH || 1)
            px = cx + e.data.dxFromCenter * scaleX
            py = cy + e.data.dyFromCenter * scaleY
          } else return
        } else if (
          e.data?.visualFrame &&
          e.data?.imageCenter &&
          typeof e.data?.cellIndex === 'number' &&
          e.data.cellIndex >= 0 &&
          typeof e.data?.dxFromCenter === 'number' &&
          typeof e.data?.dyFromCenter === 'number' &&
          typeof e.data?.visW === 'number' &&
          typeof e.data?.visH === 'number'
        ) {
          const frame = visualFullscreenOpen ? studentVisualFrameRef.current : studentEmbeddedVisualFrameRef.current
          if (!frame) return
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
        } else if (e.data?.visualFrame && typeof e.data?.relX === 'number' && typeof e.data?.relY === 'number') {
          const relX = Math.max(0, Math.min(1, e.data.relX))
          const relY = Math.max(0, Math.min(1, e.data.relY))
          // Bỏ click sync ở strip header visual embedded để tránh nhảy/điểm click lệch.
          if (!visualFullscreenOpen && e.data?.overlayRel === false && relY < 0.12) return
          const rect = (() => {
            if (visualFullscreenOpen) {
              const overlayOrFrame = e.data?.overlayRel && fullscreenOverlayRef.current
                ? fullscreenOverlayRef.current
                : studentVisualFrameRef.current
              const rr = overlayOrFrame?.getBoundingClientRect() ?? null
              if (isUsableRect(rr)) return rr
              return null
            }
            const frameRect = studentEmbeddedVisualFrameRef.current?.getBoundingClientRect() ?? null
            if (isUsableRect(frameRect)) return frameRect
            const viewportRect = studentEmbeddedVisualViewportRef.current?.getBoundingClientRect() ?? null
            if (isUsableRect(viewportRect)) return viewportRect
            return null
          })()
          if (isUsableRect(rect)) {
            px = rect.left + relX * rect.width
            py = rect.top + relY * rect.height
          } else return
        } else if (
          e.data?.visualFrame &&
          typeof e.data?.dxFromCenter === 'number' &&
          typeof e.data?.dyFromCenter === 'number' &&
          typeof e.data?.frameW === 'number' &&
          typeof e.data?.frameH === 'number'
        ) {
          const rect = (() => {
            if (visualFullscreenOpen) {
              const rr = studentVisualFrameRef.current?.getBoundingClientRect() ?? null
              if (isUsableRect(rr)) return rr
              return null
            }
            const frameRect = studentEmbeddedVisualFrameRef.current?.getBoundingClientRect() ?? null
            if (isUsableRect(frameRect)) return frameRect
            const viewportRect = studentEmbeddedVisualViewportRef.current?.getBoundingClientRect() ?? null
            if (isUsableRect(viewportRect)) return viewportRect
            return null
          })()
          if (!rect) return
          const cx = rect.left + rect.width / 2
          const cy = rect.top + rect.height / 2
          const scaleX = rect.width / (e.data.frameW || 1)
          const scaleY = rect.height / (e.data.frameH || 1)
          px = cx + e.data.dxFromCenter * scaleX
          py = cy + e.data.dyFromCenter * scaleY
        } else if (typeof e.data?.normX === 'number' && typeof e.data?.normY === 'number') {
          const w = typeof window !== 'undefined' ? window.innerWidth : 1920
          const h = typeof window !== 'undefined' ? window.innerHeight : 1080
          px = Math.max(0, Math.min(w, e.data.normX * w))
          py = Math.max(0, Math.min(h, e.data.normY * h))
        } else if (typeof e.data?.xrPx === 'number' && typeof e.data?.yPx === 'number') {
          const w = typeof window !== 'undefined' ? window.innerWidth : 1920
          const h = typeof window !== 'undefined' ? window.innerHeight : 1080
          px = Math.max(0, Math.min(w, w - e.data.xrPx))
          py = Math.max(0, Math.min(h, e.data.yPx))
        } else return
        setMouseClicks((prev) => [...prev, { id: Date.now() + Math.floor(Math.random() * 1000), x: px, y: py }].slice(-5))
        // Mô phỏng click DOM để chuột ảo (từ giáo viên) có thể điều khiển nút, popup, radio, label...
        requestAnimationFrame(() => {
          const el = document.elementFromPoint(px, py)
          if (!el || el === document.body || el === document.documentElement) return
          const clickable =
            el.closest('button') ||
            el.closest('a[href]') ||
            el.closest('input[type="radio"], input[type="checkbox"]') ||
            el.closest('label') ||
            el.closest('[role="button"]') ||
            (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'INPUT' || el.tagName === 'LABEL' ? el : null)
          if (clickable && typeof (clickable as HTMLElement).click === 'function') {
            const ctrl = (clickable as HTMLElement).closest('[data-control]')?.getAttribute('data-control')
            if (ctrl === 'prev' || ctrl === 'next') return
            ;(clickable as HTMLElement).click()
          }
        })
      }
    }
    window.addEventListener('message', handler)
    let channel: BroadcastChannel | null = null
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(presentationBroadcastChannelName)
      const channelHandler = (event: MessageEvent) => {
        handler({ origin: window.location.origin, data: event.data } as MessageEvent)
      }
      channel.addEventListener('message', channelHandler)
      channel.postMessage({ type: 'request-curriculum' })
      return () => {
        window.removeEventListener('message', handler)
        channel?.removeEventListener('message', channelHandler)
        channel?.close()
      }
    }
    return () => window.removeEventListener('message', handler)
  }, [onSlidesSaved, openVisualFullscreen, closeVisualFullscreen, openInfographicFullscreen, closeInfographicFullscreen, presentationMode, visualFullscreenOpen, infographicFullscreenOpen, presentationBroadcastChannelName, isTeacherView, worksheetPresentation, mergeIncomingInfographicStrokes, upsertInfographicStroke, appendInfographicStrokePoint, appendInfographicStrokePoints, clearInfographicStrokes, undoInfographicStroke])

  useEffect(() => {
    if (isTeacherView || typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(presentationBroadcastChannelName)
    channel.postMessage({ type: 'request-curriculum' })
    return () => channel.close()
  }, [isTeacherView, presentationBroadcastChannelName])

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
    const getQuizPopupRect = () => {
      const el = document.querySelector('[data-quiz-popup]')
      return el ? (el as HTMLElement).getBoundingClientRect() : null
    }
    const postOne = (clientX: number, clientY: number) => {
      const rect = getQuizPopupRect()
      if (rect && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        const relX = rect.right - clientX
        const relY = clientY - rect.top
        try {
          ;(target as Window).postMessage({ type: 'mouse-pos', quizPopup: true, relX, relY, fromStudent: true }, window.location.origin)
        } catch {
          /* ignore */
        }
        return
      }
      const x = clientX / (window.innerWidth || 1)
      const y = clientY / (window.innerHeight || 1)
      try {
        ;(target as Window).postMessage({ type: 'mouse-pos', x, y }, window.location.origin)
      } catch {
        /* ignore */
      }
    }
    // Dùng pointermove + getCoalescedEvents (như luồng infographic) để truyền đầy đủ mẫu chuột thật.
    const handleMove = (e: PointerEvent) => {
      const now = Date.now()
      if (now - mouseThrottleRef.current < 16) return
      mouseThrottleRef.current = now
      const coalesced = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null
      if (coalesced && coalesced.length > 0) {
        for (const ev of coalesced) postOne(ev.clientX, ev.clientY)
      } else {
        postOne(e.clientX, e.clientY)
      }
    }
    const onClick = (e: MouseEvent) => {
      const rect = getQuizPopupRect()
      if (rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        const relX = rect.right - e.clientX
        const relY = e.clientY - rect.top
        try {
          ;(target as Window).postMessage({ type: 'mouse-click', quizPopup: true, relX, relY, fromStudent: true }, window.location.origin)
        } catch {
          /* ignore */
        }
      }
    }
    window.addEventListener('pointermove', handleMove, { passive: true })
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('mousedown', onClick)
    }
  }, [presentationMode, target])

  useEffect(() => {
    if (presentationMode !== 'slide-interaction' || !target || !quizPopupOpen) return
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
            try {
              ;(target as Window).postMessage({ type: 'quiz-popup-scroll', scrollTop: scrollEl!.scrollTop, fromStudent: true }, window.location.origin)
            } catch {
              /* ignore */
            }
          }, THROTTLE_MS - (now - lastSent))
        }
        return
      }
      lastSent = now
      try {
        ;(target as Window).postMessage({ type: 'quiz-popup-scroll', scrollTop: scrollEl!.scrollTop, fromStudent: true }, window.location.origin)
      } catch {
        /* ignore */
      }
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
  }, [presentationMode, target, quizPopupOpen])

  useEffect(() => {
    if (presentationMode !== 'slide-interaction' || !target) return
    try {
      ;(target as Window).postMessage({ type: 'quiz-popup-open', value: quizPopupOpen }, window.location.origin)
      if (quizPopupOpen) {
        const sendScroll = () => {
          const el = document.querySelector('[data-quiz-popup-scroll]') as HTMLElement | null
          if (el) (target as Window).postMessage({ type: 'quiz-popup-open', value: true, scrollTop: el.scrollTop }, window.location.origin)
        }
        sendScroll()
        const t1 = setTimeout(sendScroll, 50)
        const t2 = setTimeout(sendScroll, 150)
        return () => { clearTimeout(t1); clearTimeout(t2) }
      }
    } catch {
      /* ignore */
    }
  }, [presentationMode, target, quizPopupOpen])

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

  const baseSlidesForDisplay = useMemo(
    () => (
      // Với giáo trình đã lưu, bắt buộc hiển thị theo aiSlides (theo tiết/phiên bản).
      // Không fallback parse full markdown để tránh mở nhầm "toàn bài".
      ((slideMode === null && curriculumId) || ((slideMode === 'personal' || slideMode === 'shared' || slideMode === 'original') && curriculumId))
        ? (
          slideMode === 'personal' && personalViewSubMode === 'original' && originalSlides && originalSlides.length > 0
            ? getBaseSlides(curriculumMarkdown, topic, originalSlides, { allowMarkdownFallback: false })
            : getBaseSlides(curriculumMarkdown, topic, aiSlides, { allowMarkdownFallback: false })
        )
        : (
      slideMode === 'personal' && personalViewSubMode === 'original' && originalSlides && originalSlides.length > 0
        ? getBaseSlides(curriculumMarkdown, topic, originalSlides, { allowMarkdownFallback: true })
        : getBaseSlides(curriculumMarkdown, topic, aiSlides, { allowMarkdownFallback: true })
        )
    ),
    [slideMode, personalViewSubMode, originalSlides, curriculumId, curriculumMarkdown, topic, aiSlides],
  )

  useEffect(() => {
    const nextSlides = baseSlidesForDisplay
    const idx = typeof initialSlideIndex === 'number' ? Math.max(0, Math.min(initialSlideIndex, nextSlides.length - 1)) : 0
    setCurrentIndex((prev) => {
      // Student window must always follow teacher's current slide.
      if (!isTeacherView && nextSlides.length > 0) {
        return idx
      }
      if (!initialSlideSyncedRef.current && nextSlides.length > 0) {
        initialSlideSyncedRef.current = true
        return idx
      }
      if (nextSlides.length <= 0) return 0
      return Math.min(prev, nextSlides.length - 1)
    })
  }, [baseSlidesForDisplay, initialSlideIndex, isTeacherView])

  useEffect(() => {
    const nextSlides = baseSlidesForDisplay
    if (isTeacherView) {
      setSlides(nextSlides)
      return
    }
    const idx = Math.max(0, Math.min(currentIndex, Math.max(0, nextSlides.length - 1)))
    setSlides(pruneStudentSlidesByChunk(nextSlides, idx, {
      keepFullTextForAllSlides: studentCurriculumRightMode === 'markdown-all',
    }))
  }, [baseSlidesForDisplay, isTeacherView, currentIndex, studentCurriculumRightMode])

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
        if (slides.length <= 0) {
          pendingSlideGoIndexRef.current = e.data.index
          return
        }
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

  useEffect(() => {
    const pending = pendingSlideGoIndexRef.current
    if (pending == null || slides.length <= 0) return
    const idx = Math.max(0, Math.min(pending, slides.length - 1))
    setCurrentIndex((prev) => {
      setTransitionDirection(idx > prev ? 'next' : 'prev')
      return idx
    })
    pendingSlideGoIndexRef.current = null
  }, [slides.length])

  useEffect(() => {
    setPresenterLeftTab('visual')
  }, [currentIndex])

  type EmbedPlacement = 'end' | 'newBlock' | number
  const persistSlidesRef = useRef<(s: SlideItem[]) => Promise<void>>(async () => {})
  useEffect(() => {
    persistSlidesRef.current = async (updatedSlides: SlideItem[]) => {
      if (!curriculumId || updatedSlides.length === 0) return
      const payload = updatedSlides.map((s) => ({
        title: s.title,
        blocks: s.blocks ?? [],
        imageUrl: s.imageUrl,
        visualEmbed: s.visualEmbed,
        visualLayout: s.visualLayout,
        visualCells: s.visualCells,
        visualInput1: s.visualInput1,
        visualInput2: s.visualInput2,
        visualInput3: s.visualInput3,
        visualInput4: s.visualInput4,
        teacherNotes: s.teacherNotes,
      }))
      const inf = curriculumInfographicRef.current
      if (slideMode === 'personal' || slideMode === 'original') {
        const r = await saveUserCustomizedSlides({ curriculumId, slides: payload, curriculumInfographic: inf })
        if (r?.error) toast({ title: tr('Lỗi lưu', 'Save error', '保存错误', '保存エラー', '저장 오류'), description: r.error, variant: 'destructive' })
        else { toast({ title: tr('Đã lưu', 'Saved', '已保存', '保存しました', '저장됨'), duration: 1500 }); onSlidesSaved?.() }
      } else if (slideMode === 'shared' || !slideMode) {
        const r = await saveSlidesToCurriculum({ curriculumId, topic: topic || 'Bài giảng', subjectId: subjectId ?? 'toan', gradeLevelId: gradeLevelId ?? 'lop-6', slides: payload, curriculumInfographic: inf })
        if (r?.error) toast({ title: tr('Lỗi lưu', 'Save error', '保存错误', '保存エラー', '저장 오류'), description: r.error, variant: 'destructive' })
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
            blocks: [...(a.blocks || []), ...(b.blocks || [])],
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
          const slide1: SlideItem = {
            ...s,
            blocks: firstBlocks,
          }
          const slide2: SlideItem = {
            ...s,
            title: secondHeader,
            blocks: secondBlocks,
            teacherNotes: '',
            imageUrl: undefined,
            visualEmbed: undefined,
            visualLayout: undefined,
            visualCells: undefined,
          }
          const next = [...prev.slice(0, idx), slide1, slide2, ...prev.slice(idx + 1)]
          queueMicrotask(() => { if (curriculumId) void persistSlidesRef.current(next) })
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
      channel = new BroadcastChannel(LEGACY_PRESENTATION_BROADCAST_CHANNEL)
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
    if (!infographicFullscreenOpen) return
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && !(document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement) {
        setInfographicFullscreenOpen(false)
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
  }, [infographicFullscreenOpen])

  useEffect(() => {
    setVisualFullscreenOpen(false)
    setInfographicFullscreenOpen(false)
  }, [currentIndex])

  /** Không tự mở fullscreen khi chuyển tab Infographic (tránh mở lại sau khi đã đóng rồi bấm Visual). Chỉ đóng overlay khi rời tab Infographic. */
  useEffect(() => {
    if (!isTeacherView || worksheetPresentation) return
    if (presenterLeftTab !== 'infographic' && infographicFullscreenOpen) {
      closeInfographicFullscreen()
    }
  }, [isTeacherView, worksheetPresentation, presenterLeftTab, infographicFullscreenOpen, closeInfographicFullscreen])

  const slide = slides[currentIndex]
  const rawBlocks = (Array.isArray(slide?.blocks) && slide.blocks.length > 0) ? slide.blocks : (slide ? parseContentToBlocks(slide.content ?? '') : [])
  const blocks =
    rawBlocks.length > 0 && rawBlocks.every((b) => !(b.content ?? '').trim()) && (slide?.content ?? '').trim()
      ? parseContentToBlocks(slide!.content ?? '')
      : rawBlocks
  const hasBlocks = blocks.length > 0
  const visualPaneMeta = slide ? getVisualCellsForPresentation(slide, curriculumInfographic) : { layout: 1 as 1 | 2 | 4, cells: [] as VisualCell[] }
  const visualLayout = visualPaneMeta.layout
  const visualCells = visualPaneMeta.cells
  const visualHasAnyContent = visualCells.some((c) => c.visualEmbed || c.imageUrl)
  const visualUsesFourCellData = visualLayout === 4 && visualHasAnyContent
  const visualShowsCurriculumInfographic = useMemo(() => {
    if (!curriculumInfographic?.imageUrl) return false
    return visualCells.some((c) => c.imageUrl && visualImageIsCurriculumInfographic(c.imageUrl, curriculumInfographic))
  }, [visualCells, curriculumInfographic])
  const visualGridClass =
    visualLayout === 2 ? 'grid min-h-0 grid-rows-2 gap-1' : visualLayout === 4 ? 'grid min-h-0 grid-cols-2 grid-rows-2 gap-1' : ''

  useEffect(() => {
    const infographicKeyboardActive =
      isTeacherView &&
      !worksheetPresentation &&
      !!curriculumInfographic &&
      (infographicFullscreenOpen ||
        visualFullscreenOpen ||
        presenterLeftTab === 'infographic' ||
        (presenterLeftTab === 'visual' && visualShowsCurriculumInfographic))
    if (!infographicKeyboardActive) return
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el) {
        const tag = (el.tagName || '').toLowerCase()
        if (tag === 'input' || tag === 'textarea' || el.isContentEditable) return
      }
      const key = (e.key || '').toLowerCase()
      if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault()
        undoInfographicStroke(activeInfographicStrokeKey)
        sendInfographicDrawMessage({ type: 'infographic-draw-undo', slideIndex: activeInfographicStrokeKey })
        return
      }
      if (key === 'b') {
        e.preventDefault()
        setInfographicDrawTool('pen')
        return
      }
      if (key === 'e') {
        e.preventDefault()
        setInfographicDrawTool('eraser')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    isTeacherView,
    worksheetPresentation,
    curriculumInfographic,
    infographicFullscreenOpen,
    visualFullscreenOpen,
    presenterLeftTab,
    visualShowsCurriculumInfographic,
    activeInfographicStrokeKey,
    undoInfographicStroke,
    sendInfographicDrawMessage,
  ])

  /** Ô trái: infographic trong khung (không fullscreen) — GV theo tab; HS theo tab đồng bộ / bấm Infographic|Visual */
  const showInfographicInMainPane =
    !worksheetPresentation &&
    ((isTeacherView && presenterLeftTab === 'infographic') ||
      (isStudentCurriculumSlide && studentCurriculumLeftPaneTab === 'infographic'))
  const autoGeoSuggestion = useMemo(() => {
    if (!slide) return null
    return getAutoGeoGebraSuggestion(slide)
  }, [slide])

  const openAutoGeoGebra = useCallback(() => {
    if (!autoGeoSuggestion) return
    if (typeof window === 'undefined') return
    window.open(autoGeoSuggestion.url, '_blank', 'noopener,noreferrer')
  }, [autoGeoSuggestion])

  const { hasSegmentTypingWork, segmentTypingCompleted } = useMemo(() => {
    if (isTeacherView) return { hasSegmentTypingWork: false, segmentTypingCompleted: true }
    const useSegmentTyping = worksheetPresentation || !!curriculumId
    if (!useSegmentTyping || !slide) return { hasSegmentTypingWork: false, segmentTypingCompleted: true }
    let hasWork = false
    let allDone = true
    if (!worksheetPresentation && curriculumId) {
      const tk = curriculumSlideTitleRevealKey(currentIndex)
      const tTotal = worksheetAnswerSegmentCount(slide.title ?? '')
      if (tTotal > 0) {
        const typingOn = worksheetAnswerTypingEnabled?.[tk] !== false
        if (typingOn) {
          hasWork = true
          const rev = worksheetAnswerReveal?.[tk] ?? 0
          if (rev < tTotal) allDone = false
        }
      }
    }
    if (!hasBlocks) return { hasSegmentTypingWork: hasWork, segmentTypingCompleted: !hasWork || allDone }
    blocks.forEach((b, i) => {
      const shouldTypeThisBlock = worksheetPresentation
        ? worksheetAnswerSegmentCount(b.content ?? '') > 0
        : true
      if (!shouldTypeThisBlock) return
      const key = `${currentIndex}-${i}`
      const typingOn = worksheetAnswerTypingEnabled?.[key] !== false
      if (!typingOn) return
      hasWork = true
      const total = worksheetAnswerSegmentCount(b.content ?? '')
      const revealed = worksheetAnswerReveal?.[key] ?? 0
      if (revealed < total) allDone = false
    })
    return { hasSegmentTypingWork: hasWork, segmentTypingCompleted: !hasWork || allDone }
  }, [isTeacherView, worksheetPresentation, curriculumId, hasBlocks, blocks, currentIndex, worksheetAnswerTypingEnabled, worksheetAnswerReveal, slide])

  /** Chỉ block đang tới lượt gõ segment mới hiện bút ở reveal === 0 (tránh nhiều bút trên slide ghép). */
  const sequentialSolutionPenBlockIndex = useMemo(() => {
    if (isTeacherView) return null
    if (!slide) return null
    if (!(worksheetPresentation || curriculumId)) return null
    const titleSegs =
      !worksheetPresentation && curriculumId ? worksheetAnswerSegmentCount(slide.title ?? '') : 0
    if (!hasBlocks && titleSegs === 0) return null
    return findFirstSequentialSolutionBlockIndex(
      blocks as Array<{ content?: string; isAnswer?: boolean }>,
      currentIndex,
      {
        worksheetPresentation,
        hasCurriculumSegmentTyping: !!curriculumId,
        reveal: worksheetAnswerReveal,
        typingEnabled: worksheetAnswerTypingEnabled,
        slideTitle: slide.title ?? '',
      }
    )
  }, [
    isTeacherView,
    hasBlocks,
    slide,
    worksheetPresentation,
    curriculumId,
    blocks,
    currentIndex,
    worksheetAnswerReveal,
    worksheetAnswerTypingEnabled,
  ])

  /** Chế độ “Chuỗi slide” trên cột phải: cuộn để đỉnh slide đang chọn nằm phía trên khung (dễ nhìn từ xa). */
  useEffect(() => {
    if (isTeacherView || worksheetPresentation) return
    if (studentCurriculumRightMode !== 'markdown-all') return
    if (!STUDENT_MD_CHAIN_AUTO_FOLLOW) return
    if (slides.length === 0) return
    const id = `nano-student-md-slide-${currentIndex}`
    const t = window.setTimeout(() => {
      const now = Date.now()
      const sameSlideRepeat =
        lastMdAutoScrollIndexRef.current === currentIndex && now - lastMdAutoScrollAtRef.current < 500
      if (sameSlideRepeat) return
      const el = document.getElementById(id) as HTMLElement | null
      const container = studentMdRightColumnScrollRef.current
      if (el && container) {
        const cRect = container.getBoundingClientRect()
        const eRect = el.getBoundingClientRect()
        const elTopInContent = eRect.top - cRect.top + container.scrollTop
        // Đặt mép trên thẻ slide ~18% chiều cao vùng cuộn dưới mép trên (cao hơn block:center)
        const bias = Math.max(56, Math.round(container.clientHeight * 0.18))
        // Cuộn dư theo chiều cao slide sắp mở (~10%): ví dụ cao 10 thì cuộn đến khoảng 11.
        const extraFollowPx = Math.max(16, Math.min(180, Math.round(eRect.height * 0.1)))
        const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight)
        const nextTop = Math.min(
          maxScroll,
          Math.max(0, elTopInContent - bias + extraFollowPx),
        )
        const behavior: ScrollBehavior = now - lastMdAutoScrollAtRef.current < 700 ? 'auto' : 'smooth'
        container.scrollTo({ top: nextTop, behavior })
      } else {
        const behavior: ScrollBehavior = now - lastMdAutoScrollAtRef.current < 700 ? 'auto' : 'smooth'
        el?.scrollIntoView({ behavior, block: 'start', inline: 'nearest' })
      }
      lastMdAutoScrollIndexRef.current = currentIndex
      lastMdAutoScrollAtRef.current = now
    }, 100)
    return () => window.clearTimeout(t)
  }, [currentIndex, studentCurriculumRightMode, slides.length, isTeacherView, worksheetPresentation])

  /** Chuỗi slide (HS): thêm vùng cuộn dưới cùng ~½ chiều cao slide hiện tại để slide không dính sát đáy khung. */
  useLayoutEffect(() => {
    if (isTeacherView || worksheetPresentation) return
    if (studentCurriculumRightMode !== 'markdown-all') return
    if (slides.length === 0) return

    let ro: ResizeObserver | null = null
    let cancelled = false

    const bind = (el: HTMLElement) => {
      ro?.disconnect()
      ro = null
      const update = () => {
        if (cancelled || !el.isConnected) return
        const h = el.getBoundingClientRect().height
        setStudentMdChainBottomSpacerPx(Math.max(48, Math.round(h / 2)))
      }
      update()
      ro = new ResizeObserver(update)
      ro.observe(el)
    }

    const tryBind = () => {
      const el = document.getElementById(`nano-student-md-slide-${currentIndex}`) as HTMLElement | null
      if (el && !cancelled) bind(el)
    }

    tryBind()
    const raf = requestAnimationFrame(tryBind)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      ro?.disconnect()
    }
  }, [currentIndex, studentCurriculumRightMode, slides.length, isTeacherView, worksheetPresentation])

  useEffect(() => {
    if (!autoPlay || slides.length <= 1) return
    let advanced = false
    const startedAt = Date.now()
    const advance = () => {
      if (advanced) return
      advanced = true
      setTransitionDirection('next')
      setCurrentIndex((i) => {
        const next = i >= slides.length - 1 ? 0 : i + 1
        if (presentationMode === 'slide-interaction' && typeof window !== 'undefined' && window.opener) {
          window.opener.postMessage({ type: 'slide-go', index: next }, window.location.origin)
        }
        return next
      })
    }
    const id = window.setInterval(() => {
      const timeReady = Date.now() - startedAt >= autoPlayIntervalMs
      const segmentTypingReady = !hasSegmentTypingWork || segmentTypingCompleted
      if (timeReady && segmentTypingReady) advance()
    }, 120)
    return () => window.clearInterval(id)
  }, [autoPlay, slides.length, autoPlayIntervalMs, presentationMode, hasSegmentTypingWork, segmentTypingCompleted])

  if (slides.length === 0) return null

  const gradient = DARK_GRADIENTS[currentIndex % DARK_GRADIENTS.length]
  const infographicStableBackground = 'linear-gradient(180deg, #0b1220 0%, #0f172a 100%)'
  const visualPaneBackground = showInfographicInMainPane || visualShowsCurriculumInfographic || visualUsesFourCellData
    ? infographicStableBackground
    : gradient

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden">
      <div
        className={cn(
          'print:hidden overflow-hidden [direction:rtl] box-border pr-3 md:pr-0',
          presentationMode === 'slide-interaction' && 'border-b border-slate-700/80 bg-slate-900/80 backdrop-blur-sm',
          presentationMode === 'slide-interaction' && 'pointer-events-auto'
        )}
      >
        <div className="[direction:ltr] w-full md:w-max">
          <PresentationControlBar
            variant={isWorksheetTeacher || presentationMode === 'slide-interaction' ? 'teacher' : 'student'}
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
            onShareClick={handleShareClick}
            onOpenTeacherView={openTeacherView}
            shareButtonClickableWhenParentDisabled={presentationMode === 'slide-interaction'}
            slideViewMode={undefined}
            onSlideViewModeChange={undefined}
            onOpenStudentView={effectiveOnOpenStudentView}
            highlightedControl={null}
            hideTeacherTimer
            hideInsert
            hideIndex={presentationMode === 'slide-interaction'}
            printHidden={false}
          />
        </div>
        {presentationMode === 'slide-interaction' && (
          // Hàng đệm để trùng trục Y với hàng thông tin riêng của giao diện giáo viên.
          <div className="h-[42px] border-t border-slate-700/60 bg-slate-900/50" />
        )}
      </div>

      {/* Screen share – học sinh xem màn hình giáo viên trực tiếp (livestream) */}
      {isScreenShareActive && screenShareStream && screenShareOverlayVisible && (
        <div className="fixed inset-0 z-[125] bg-black flex flex-col">
          <div className="h-12 shrink-0 flex items-center justify-between gap-4 px-4 bg-black/80 border-b border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-white/90 text-sm font-medium shrink-0">
                {tr('Đang xem màn hình giáo viên trực tiếp', 'Viewing teacher screen live', '正在实时查看教师屏幕', '教師の画面をリアルタイム表示中', '교사 화면 실시간 보는 중')}
              </span>
              <span className="text-white/50 text-xs hidden sm:inline truncate">
                {tr('Tab giáo viên phải đang hiển thị', 'Teacher tab must be visible', '教师标签页须可见', '教師タブを表示中に', '교사 탭 표시 필요')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setScreenShareOverlayVisible(false)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium"
              title={tr('Thu nhỏ – xem slide', 'Minimize – view slides', '最小化 – 查看幻灯片', '最小化 – スライド表示', '최소화 – 슬라이드 보기')}
            >
              <X className="h-4 w-4" />
              {tr('Thu nhỏ', 'Minimize', '最小化', '最小化', '최소화')}
            </button>
          </div>
          <div className="flex-1 min-h-0 relative">
            <ScreenShareVideo key={screenShareStream.id} stream={screenShareStream} />
          </div>
        </div>
      )}
      {/* Chuột ảo + đường di chuột – render qua portal để hiện trên popup (z-[200] > popup z-[110]) */}
      {typeof document !== 'undefined' && (virtualMousePos || mouseTrail.length > 1 || mouseClicks.length > 0) && createPortal(
        <>
          {mouseTrail.length > 1 && (
            <svg className="fixed inset-0 z-[198] pointer-events-none" style={{ width: '100%', height: '100%' }}>
              <path
                d={buildSmoothMouseTrailPath(mouseTrail)}
                fill="none"
                stroke="rgba(255,200,100,0.55)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {virtualMousePos && (
            <div
              className="fixed z-[200] pointer-events-none"
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
              className="fixed z-[199] pointer-events-none"
              style={{ left: p.x, top: p.y, transform: 'translate(-50%, -50%)' }}
            >
              <span className="block h-12 w-12 rounded-full border-2 border-amber-300/90 animate-ping" />
            </div>
          ))}
        </>,
        document.body
      )}

      <EmbedInsertDialog
        open={embedDialogOpen}
        onOpenChange={setEmbedDialogOpen}
        onInsert={(marker, placement, alsoTo) => handleInsertEmbed(marker, placement, alsoTo)}
        onReplaceSlideImage={handleReplaceSlideImage}
        tr={tr}
        highZIndex
        blocks={slide.blocks ?? parseContentToBlocks(slide.content)}
        slides={slides.map((s) => ({ title: s.title }))}
        currentSlideIndex={currentIndex}
        currentVisual={getVisualCells(slide)}
      />
      <Dialog open={shareDialogOpen} onOpenChange={(open) => { setShareDialogOpen(open); if (!open) { setShareUrl(null); setShareQrDataUrl(null); shareInProgressRef.current = false } }}>
        <DialogContent className="sm:max-w-md z-[200]">
          <DialogHeader>
            <DialogTitle>{tr('Chia sẻ link slide', 'Share slide link', '分享幻灯片链接', 'スライドリンクを共有', '슬라이드 링크 공유')}</DialogTitle>
            <DialogDescription>
              {shareLoading
                ? tr('Đang tạo link...', 'Creating link...', '正在创建链接...', 'リンク作成中...', '링크 생성 중...')
                : shareUrl
                  ? tr('Chia sẻ link hoặc quét QR để học sinh xem slide như trên máy tính.', 'Share link or scan QR for students to view slides on their device.', '分享链接或扫码让学生查看幻灯片。', 'リンク共有またはQRスキャンで生徒がスライドを表示。', '링크 공유 또는 QR 스캔으로 학생이 슬라이드 보기.')
                  : tr('Nhấn Chia sẻ để tạo link và mã QR.', 'Click Share to create link and QR code.', '点击分享创建链接和二维码。', '共有をクリックしてリンクとQRを作成。', '공유 클릭으로 링크와 QR 생성.')}
            </DialogDescription>
          </DialogHeader>
          {shareLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          )}
          {!shareLoading && shareUrl && (
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {shareQrDataUrl && (
                <div className="flex-shrink-0 p-2 bg-white rounded-lg">
                  <img src={shareQrDataUrl} alt="QR" className="w-40 h-40" />
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{tr('Link xem slide', 'View slides link', '查看幻灯片链接', 'スライド表示リンク', '슬라이드 보기 링크')}</span>
                </div>
                <div className="flex gap-2">
                  <Input readOnly value={shareUrl} className="text-sm font-mono" />
                  <Button variant="outline" size="icon" onClick={copyShareLink} title={tr('Copy link', 'Copy link', '复制链接', 'リンクをコピー', '링크 복사')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
        quizSessionCodes={Object.fromEntries(Object.entries(quizSessionData).map(([k, v]) => [k, v.sessionCode]))}
        quizSessionTimers={{
          ...Object.fromEntries(Object.entries(quizSessionSettings).map(([k, v]) => [k, v.quizDurationSeconds])),
          ...Object.fromEntries(Object.entries(quizSessionData).map(([k, v]) => [k, v.quizDurationSeconds])),
        }}
        quizSessionAutoReveal={Object.fromEntries(Object.entries(quizSessionSettings).map(([k, v]) => [k, v.autoRevealOnTimerEnd]))}
      />
      {/* Fullscreen overlay cho visual slide – phần làm việc to hết khung hình */}
      {visualFullscreenOpen && (() => {
        const { layout, cells } = getVisualCellsForPresentation(slide, curriculumInfographic)
        const hasAny = cells.some((c) => c.visualEmbed || c.imageUrl)
        if (!hasAny) return null
        const showSingleCell = expandedCellIndex != null && layout > 1
        const displayCells = showSingleCell && cells[expandedCellIndex] ? [cells[expandedCellIndex]] : cells
        const displayIndices = showSingleCell && expandedCellIndex != null ? [expandedCellIndex] : cells.map((_, i) => i)
        const gridClass =
          !showSingleCell && layout === 2
            ? 'grid min-h-0 grid-rows-2 gap-2'
            : !showSingleCell && layout === 4
              ? 'grid min-h-0 grid-cols-2 grid-rows-2 gap-2'
              : ''
        const renderCell = (cell: { visualEmbed?: string; imageUrl?: string }, idx: number, label: string) => {
          const cellKey = `${currentIndex}-${displayIndices[idx] ?? idx}`
          const cellFillClass =
            showSingleCell || layout === 1
              ? 'min-h-0 w-full flex-1 basis-0'
              : 'h-full min-h-0 min-w-0'
          return (
          <div
            key={cellKey}
            className={cn('relative flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/30', cellFillClass)}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="absolute top-2 left-2 z-10 px-2 py-1 rounded bg-black/60 text-white text-sm font-mono pointer-events-none">{label}</span>
            {cell.visualEmbed ? (
              (() => {
                const embeds = parseContentEmbeds(cell.visualEmbed)
                const first = embeds[0]
                if (!first) return <div className="min-h-0 flex-1 basis-0" />
                return (
                  <div className="flex min-h-0 flex-1 basis-0 flex-col" key={`nano-fs-vis-${cellKey}-${first.type}-${first.urlOrId.slice(0, 80)}`}>
                    <LazyHeavyMount minHeight={220}>
                      <ContentEmbed type={first.type} urlOrId={first.urlOrId} tr={tr} hideQuiz fill className="!my-0 !rounded-xl !border-0" />
                    </LazyHeavyMount>
                  </div>
                )
              })()
            ) : cell.imageUrl ? (
              curriculumInfographic && visualImageIsCurriculumInfographic(cell.imageUrl, curriculumInfographic) ? (
                <div
                  data-infographic-draw-pane-stage
                  className="relative flex min-h-0 w-full min-w-0 flex-1 basis-0 touch-none items-center justify-center"
                  onPointerDown={(e) => startInfographicDrawing(e)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- curriculum infographic in visual fullscreen */}
                  <img
                    key={`nano-fs-img-${cellKey}`}
                    src={cell.imageUrl}
                    alt=""
                    draggable={false}
                    onDragStart={(ev) => ev.preventDefault()}
                    className="max-h-full max-w-full select-none object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <canvas
                    data-infographic-draw-pane-canvas
                    className="pointer-events-none absolute"
                    aria-hidden
                  />
                  <div
                    className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-lg border border-white/25 bg-black/70 p-1.5 text-white shadow-xl"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setInfographicDrawTool('pen')}
                      className={cn('rounded px-2 py-1 text-xs transition-colors', infographicDrawTool === 'pen' ? 'bg-white/30' : 'hover:bg-white/15')}
                    >
                      {tr('Vẽ', 'Draw', '画笔', '描画', '그리기')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setInfographicDrawTool('eraser')}
                      className={cn('rounded px-2 py-1 text-xs transition-colors', infographicDrawTool === 'eraser' ? 'bg-white/30' : 'hover:bg-white/15')}
                    >
                      {tr('Tẩy', 'Erase', '橡皮', '消しゴム', '지우기')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setInfographicDrawBrushPx(3)}
                      className={cn('rounded px-2 py-1 text-xs transition-colors', infographicDrawBrushPx === 3 ? 'bg-white/30' : 'hover:bg-white/15')}
                    >
                      {tr('Nhỏ', 'S', '细', '細', '얇게')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setInfographicDrawBrushPx(5)}
                      className={cn('rounded px-2 py-1 text-xs transition-colors', infographicDrawBrushPx === 5 ? 'bg-white/30' : 'hover:bg-white/15')}
                    >
                      {tr('Vừa', 'M', '中', '中', '중간')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setInfographicDrawBrushPx(7)}
                      className={cn('rounded px-2 py-1 text-xs transition-colors', infographicDrawBrushPx === 7 ? 'bg-white/30' : 'hover:bg-white/15')}
                    >
                      {tr('To', 'L', '粗', '太', '굵게')}
                    </button>
                    <div className="flex items-center gap-1 px-1">
                      {INFOGRAPHIC_DRAW_COLORS.map((color) => (
                        <button
                          key={`vfs-${cellKey}-${color}`}
                          type="button"
                          onClick={() => setInfographicDrawColor(color)}
                          className={cn(
                            'h-4 w-4 rounded-full border transition-transform',
                            infographicDrawColor === color ? 'scale-110 border-white' : 'border-white/40 hover:scale-105'
                          )}
                          style={{ backgroundColor: color }}
                          title={tr('Màu nét vẽ', 'Stroke color', '画笔颜色', '描画色', '펜 색상')}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        undoInfographicStroke(activeInfographicStrokeKey)
                        sendInfographicDrawMessage({ type: 'infographic-draw-undo', slideIndex: activeInfographicStrokeKey })
                      }}
                      className="rounded px-2 py-1 text-xs transition-colors hover:bg-white/15"
                    >
                      {tr('Undo', 'Undo', '撤销', '元に戻す', '실행 취소')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        clearInfographicStrokes(activeInfographicStrokeKey)
                        sendInfographicDrawMessage({ type: 'infographic-draw-clear', slideIndex: activeInfographicStrokeKey })
                      }}
                      className="rounded px-2 py-1 text-xs transition-colors hover:bg-white/15"
                    >
                      {tr('Xóa nét', 'Clear', '清除', 'クリア', '지우기')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 basis-0 items-center justify-center">
                  <img key={`nano-fs-img-${cellKey}`} src={cell.imageUrl} alt="" className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
                </div>
              )
            ) : (
              <div className="min-h-0 flex-1 basis-0 bg-white/5" />
            )}
          </div>
          )
        }
        return (
          <div
            ref={fullscreenOverlayRef}
            className="fixed inset-0 z-[105] flex min-h-0 flex-col bg-black outline-none"
            aria-label={tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}
          >
            {/* Header trong luồng flex (không absolute): flex-1 phía dưới luôn có chiều cao còn lại — ổn với F11/requestFullscreen */}
            <div className="z-20 flex h-14 w-full shrink-0 items-center justify-between bg-black/70 px-4">
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
            <div
              className="flex min-h-0 flex-1 flex-col px-4 pb-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeVisualFullscreen()
              }}
            >
              <div
                ref={studentVisualFrameRef}
                className={cn(
                  'flex min-h-0 w-full flex-1 overflow-hidden',
                  showSingleCell || layout === 1 ? 'flex-col' : gridClass
                )}
                onClick={(e) => e.stopPropagation()}
              >
              {displayCells.map((cell, i) => renderCell(cell, i, `${currentIndex + 1}-${displayIndices[i] + 1}`))}
              </div>
            </div>
          </div>
        )
      })()}
      {infographicFullscreenOpen && curriculumInfographic && (
        <div
          ref={infographicFullscreenOverlayRef}
          className="fixed inset-0 z-[106] flex min-h-0 flex-col bg-black outline-none"
          aria-label={tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}
        >
          <div className="z-20 flex h-14 w-full shrink-0 items-center justify-between bg-black/70 px-4">
            <span className="text-white/80 text-sm">
              {tr('Infographic — nhấn Esc hoặc click vùng tối để thoát', 'Infographic — press Esc or click dark area to exit', '信息图 — 按Esc或点击暗区退出', 'インフォグラフィック — Escまたは暗い部分をクリックで終了', '인포그래픽 — Esc 또는 어두운 영역 클릭으로 종료')}
            </span>
            {timerSeconds > 0 && (
              <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/50', timerRunning && timerSeconds <= 30 && 'animate-pulse')}>
                <Timer className="h-4 w-4 text-amber-400" />
                <span className={cn('font-mono font-bold', timerSeconds <= 30 && 'text-amber-300')}>{formatTimer(timerSeconds)}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); closeInfographicFullscreen() }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white font-medium transition-colors"
                title={tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}
              >
                <X className="h-5 w-5" />
                {tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}
              </button>
            </div>
          </div>
          <div
            className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeInfographicFullscreen()
            }}
          >
            <div
              ref={infographicFullscreenStageRef}
              data-infographic-draw-pane-stage
              className="relative flex min-h-0 w-full flex-1 touch-none items-center justify-center"
              onPointerDown={(e) => startInfographicDrawing(e)}
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- remote curriculum infographic */}
              <img
                ref={infographicFullscreenImageRef}
                src={curriculumInfographic.imageUrl}
                alt=""
                draggable={false}
                onDragStart={(ev) => ev.preventDefault()}
                className="max-h-full max-w-full select-none object-contain"
                referrerPolicy="no-referrer"
              />
              <canvas
                ref={infographicFullscreenCanvasRef}
                data-infographic-draw-pane-canvas
                className="absolute pointer-events-none"
                aria-hidden
              />
              <div
                className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-lg border border-white/25 bg-black/70 p-1.5 text-white shadow-xl"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                  <button
                    type="button"
                    onClick={() => setInfographicDrawTool('pen')}
                    className={cn('rounded px-2 py-1 text-xs transition-colors', infographicDrawTool === 'pen' ? 'bg-white/30' : 'hover:bg-white/15')}
                  >
                    {tr('Vẽ', 'Draw', '画笔', '描画', '그리기')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfographicDrawTool('eraser')}
                    className={cn('rounded px-2 py-1 text-xs transition-colors', infographicDrawTool === 'eraser' ? 'bg-white/30' : 'hover:bg-white/15')}
                  >
                    {tr('Tẩy', 'Erase', '橡皮', '消しゴム', '지우기')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfographicDrawBrushPx(3)}
                    className={cn('rounded px-2 py-1 text-xs transition-colors', infographicDrawBrushPx === 3 ? 'bg-white/30' : 'hover:bg-white/15')}
                  >
                    {tr('Nhỏ', 'S', '细', '細', '얇게')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfographicDrawBrushPx(5)}
                    className={cn('rounded px-2 py-1 text-xs transition-colors', infographicDrawBrushPx === 5 ? 'bg-white/30' : 'hover:bg-white/15')}
                  >
                    {tr('Vừa', 'M', '中', '中', '중간')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfographicDrawBrushPx(7)}
                    className={cn('rounded px-2 py-1 text-xs transition-colors', infographicDrawBrushPx === 7 ? 'bg-white/30' : 'hover:bg-white/15')}
                  >
                    {tr('To', 'L', '粗', '太', '굵게')}
                  </button>
                  <div className="flex items-center gap-1 px-1">
                    {INFOGRAPHIC_DRAW_COLORS.map((color) => (
                      <button
                        key={`fs-b-${color}`}
                        type="button"
                        onClick={() => setInfographicDrawColor(color)}
                        className={cn(
                          'h-4 w-4 rounded-full border transition-transform',
                          infographicDrawColor === color ? 'scale-110 border-white' : 'border-white/40 hover:scale-105'
                        )}
                        style={{ backgroundColor: color }}
                        title={tr('Màu nét vẽ', 'Stroke color', '画笔颜色', '描画色', '펜 색상')}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      undoInfographicStroke(activeInfographicStrokeKey)
                      sendInfographicDrawMessage({ type: 'infographic-draw-undo', slideIndex: activeInfographicStrokeKey })
                    }}
                    className="rounded px-2 py-1 text-xs transition-colors hover:bg-white/15"
                  >
                    {tr('Undo', 'Undo', '撤销', '元に戻す', '실행 취소')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearInfographicStrokes(activeInfographicStrokeKey)
                      sendInfographicDrawMessage({ type: 'infographic-draw-clear', slideIndex: activeInfographicStrokeKey })
                    }}
                    className="rounded px-2 py-1 text-xs transition-colors hover:bg-white/15"
                  >
                    {tr('Xóa nét', 'Clear', '清除', 'クリア', '지우기')}
                  </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Đồng hồ cát nổi – học sinh thấy khi giáo viên chia sẻ màn hình */}
      {timerSeconds > 0 && (
        <div className={cn('fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[102] flex items-center gap-2 px-4 py-2 rounded-xl bg-black/80 text-white shadow-xl border border-amber-400/50 pb-[max(0.5rem,env(safe-area-inset-bottom))]', timerRunning && timerSeconds <= 30 && 'animate-pulse')}>
          <Timer className="h-5 w-5 text-amber-400 shrink-0" />
          <span className={cn('font-mono text-xl font-bold tabular-nums', timerSeconds <= 30 && 'text-amber-300')}>{formatTimer(timerSeconds)}</span>
        </div>
      )}

      {/* Slide - Neo phải: thu nhỏ chỉ cắt bên trái, không co layout */}
      <div className={cn('flex-1 flex overflow-hidden print:hidden relative justify-end', presentationMode === 'slide-interaction' && 'pointer-events-auto')}>
        <div
          key={
            !isTeacherView && !worksheetPresentation && studentCurriculumRightMode === 'markdown-all'
              ? 'student-curriculum-md-all'
              : currentIndex
          }
          className="absolute inset-0 flex opacity-100 transition-opacity duration-200 ease-out justify-end"
        >
        <div
          className={cn(
            'shrink-0 flex min-h-0 h-full flex-nowrap',
            narrowSlideLayout ? 'w-full flex-col' : 'flex-row',
          )}
          style={
            narrowSlideLayout
              ? undefined
              : { width: stableLayoutWidth, minWidth: Math.max(stableLayoutWidth, 1200) }
          }
        >
        {/* Visual: GV desktop 45%; HS desktop 50% (chia đôi cân với cột nội dung); mobile full width + max-height */}
        <div
          className={cn(
            'min-h-0 relative overflow-hidden shrink-0',
            narrowSlideLayout
              ? 'w-full max-h-[min(40vh,360px)] flex-shrink-0 border-b border-slate-200'
              : isTeacherView
                ? 'w-[45%]'
                : 'w-1/2',
          )}
          style={{ background: visualPaneBackground }}
        >
          <div className="absolute top-2 left-2 md:top-4 md:left-4 landscape:top-4 landscape:left-4 w-8 h-8 md:w-9 md:h-9 landscape:w-9 landscape:h-9 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-xs md:text-sm landscape:text-sm shadow-lg z-10">
            {currentIndex + 1}
          </div>
          <div
            className={cn(
              'absolute top-2 right-2 z-20 flex max-w-[calc(100%-3.5rem)] flex-wrap items-center justify-end gap-1 md:top-4 md:right-4 md:max-w-[calc(100%-4.5rem)] landscape:top-4 landscape:right-4 print:hidden',
              /** HS giáo trình: lệch cụm nút so với mép phải (tương đương -40px so với căn phải gốc) */
              isStudentCurriculumSlide && '-translate-x-[40px]'
            )}
          >
            {isTeacherView && autoGeoSuggestion && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); openAutoGeoGebra() }}
                onClick={(e) => { e.stopPropagation(); openAutoGeoGebra() }}
                className="flex shrink-0 items-center gap-1 rounded-md bg-black/60 px-2 py-1.5 text-[10px] text-white hover:bg-black/80 md:py-1 md:text-xs"
                title={tr('Chỉnh trong GeoGebra', 'Edit in GeoGebra', '在GeoGebra中编辑', 'GeoGebraで編集', 'GeoGebra에서 편집')}
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                {tr('GeoGebra', 'GeoGebra', 'GeoGebra', 'GeoGebra', 'GeoGebra')}
              </button>
            )}
            {!worksheetPresentation && (
              <div className="flex shrink-0 overflow-hidden rounded-md border border-white/25 bg-black/55 text-[10px] font-medium text-white shadow-md md:text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    if (isStudentCurriculumSlide) {
                      setStudentCurriculumLeftPaneTab('visual')
                      closeInfographicFullscreen()
                      notifyTeacherStudentCurriculumLeftPane('visual')
                    } else {
                      setPresenterLeftTab('visual')
                    }
                  }}
                  className="bg-white/25 px-2 py-1.5 text-white md:px-2.5"
                  title={tr('Ô Visual (mặc định)', 'Visual panel (default)', '视觉区（默认）', 'ビジュアル領域（既定）', '비주얼 패널(기본)')}
                >
                  {tr('Visual', 'Visual', '视觉', 'ビジュアル', '비주얼')}
                </button>
              </div>
            )}
            {isTeacherView && !worksheetPresentation && presenterLeftTab === 'infographic' && curriculumInfographic && (
              <>
                <div className="flex shrink-0 overflow-hidden rounded-md border border-white/25 bg-black/55 text-[10px] font-medium text-white shadow-md md:text-[11px]">
                  <button
                    type="button"
                    onClick={() => setInfographicDrawTool('pen')}
                    className={cn(
                      'px-2 py-1.5 transition-colors md:px-2.5',
                      infographicDrawTool === 'pen' ? 'bg-white/25 text-white' : 'text-white/75 hover:bg-white/10'
                    )}
                  >
                    {tr('Vẽ', 'Draw', '画笔', '描画', '그리기')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfographicDrawTool('eraser')}
                    className={cn(
                      'border-l border-white/20 px-2 py-1.5 transition-colors md:px-2.5',
                      infographicDrawTool === 'eraser' ? 'bg-white/25 text-white' : 'text-white/75 hover:bg-white/10'
                    )}
                  >
                    {tr('Tẩy', 'Erase', '橡皮', '消しゴム', '지우기')}
                  </button>
                </div>
                <div className="flex shrink-0 overflow-hidden rounded-md border border-white/25 bg-black/55 text-[10px] font-medium text-white shadow-md md:text-[11px]">
                  <button
                    type="button"
                    onClick={() => setInfographicDrawBrushPx(3)}
                    className={cn(
                      'px-2 py-1.5 transition-colors md:px-2.5',
                      infographicDrawBrushPx === 3 ? 'bg-white/25 text-white' : 'text-white/75 hover:bg-white/10'
                    )}
                    title={tr('Bút nhỏ', 'Small brush', '细笔', '細いブラシ', '얇은 브러시')}
                  >
                    {tr('Nhỏ', 'S', '细', '細', '얇게')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfographicDrawBrushPx(5)}
                    className={cn(
                      'border-l border-white/20 px-2 py-1.5 transition-colors md:px-2.5',
                      infographicDrawBrushPx === 5 ? 'bg-white/25 text-white' : 'text-white/75 hover:bg-white/10'
                    )}
                    title={tr('Bút vừa', 'Medium brush', '中笔', '中ブラシ', '중간 브러시')}
                  >
                    {tr('Vừa', 'M', '中', '中', '중간')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInfographicDrawBrushPx(7)}
                    className={cn(
                      'border-l border-white/20 px-2 py-1.5 transition-colors md:px-2.5',
                      infographicDrawBrushPx === 7 ? 'bg-white/25 text-white' : 'text-white/75 hover:bg-white/10'
                    )}
                    title={tr('Bút to', 'Large brush', '粗笔', '太いブラシ', '굵은 브러시')}
                  >
                    {tr('To', 'L', '粗', '太', '굵게')}
                  </button>
                </div>
                <div className="flex shrink-0 items-center gap-1 rounded-md border border-white/25 bg-black/55 px-1.5 py-1 text-white shadow-md">
                  {INFOGRAPHIC_DRAW_COLORS.map((color) => (
                    <button
                      key={`top-${color}`}
                      type="button"
                      onClick={() => setInfographicDrawColor(color)}
                      className={cn(
                        'h-4 w-4 rounded-full border transition-transform',
                        infographicDrawColor === color ? 'scale-110 border-white' : 'border-white/40 hover:scale-105'
                      )}
                      style={{ backgroundColor: color }}
                      title={tr('Màu nét vẽ', 'Stroke color', '画笔颜色', '描画色', '펜 색상')}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    undoInfographicStroke(activeInfographicStrokeKey)
                    sendInfographicDrawMessage({ type: 'infographic-draw-undo', slideIndex: activeInfographicStrokeKey })
                  }}
                  className="flex min-h-[40px] shrink-0 items-center justify-center rounded-md bg-black/60 px-3 py-1.5 text-[10px] font-medium text-white opacity-80 shadow-lg hover:bg-black/80 hover:opacity-100 md:min-h-0 md:text-[11px]"
                >
                  {tr('Undo', 'Undo', '撤销', '元に戻す', '실행 취소')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearInfographicStrokes(activeInfographicStrokeKey)
                    sendInfographicDrawMessage({ type: 'infographic-draw-clear', slideIndex: activeInfographicStrokeKey })
                  }}
                  className="flex min-h-[40px] shrink-0 items-center justify-center rounded-md bg-black/60 px-3 py-1.5 text-[10px] font-medium text-white opacity-80 shadow-lg hover:bg-black/80 hover:opacity-100 md:min-h-0 md:text-[11px]"
                >
                  {tr('Xóa nét', 'Clear', '清除', 'クリア', '지우기')}
                </button>
              </>
            )}
            {visualHasAnyContent &&
              ((isStudentCurriculumSlide && studentCurriculumLeftPaneTab === 'visual') || (!isStudentCurriculumSlide && presenterLeftTab === 'visual')) && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); openVisualFullscreen() }}
                onClick={() => openVisualFullscreen()}
                className="flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-md bg-black/60 p-2 text-white opacity-80 shadow-lg hover:bg-black/80 hover:opacity-100 md:min-h-0 md:min-w-0 md:p-1.5 landscape:min-h-0 landscape:min-w-0 landscape:p-1.5"
                title={tr('Mở rộng tất cả', 'Expand all', '展开全部', 'すべて展開', '모두 확장')}
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            )}
            {isStudentCurriculumSlide && studentCurriculumLeftPaneTab === 'infographic' && curriculumInfographic && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); openInfographicFullscreen() }}
                onClick={() => openInfographicFullscreen()}
                className="flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-md bg-black/60 p-2 text-white opacity-80 shadow-lg hover:bg-black/80 hover:opacity-100 md:min-h-0 md:min-w-0 md:p-1.5 landscape:min-h-0 landscape:min-w-0 landscape:p-1.5"
                title={tr('Infographic toàn màn hình', 'Infographic fullscreen', '信息图全屏', 'インフォグラフィック全画面', '인포그래픽 전체 화면')}
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            )}
            {isTeacherView && !worksheetPresentation && presenterLeftTab === 'infographic' && curriculumInfographic && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); openInfographicFullscreen() }}
                onClick={() => openInfographicFullscreen()}
                className="flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-md bg-black/60 p-2 text-white opacity-80 shadow-lg hover:bg-black/80 hover:opacity-100 md:min-h-0 md:min-w-0 md:p-1.5 landscape:min-h-0 landscape:min-w-0 landscape:p-1.5"
                title={tr('Infographic toàn màn hình', 'Infographic fullscreen', '信息图全屏', 'インフォグラフィック全画面', '인포그래픽 전체 화면')}
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <div
            ref={studentEmbeddedVisualViewportRef}
            className={cn(
              'absolute inset-0 px-2 pb-2 md:px-4 md:pb-4 landscape:px-4 landscape:pb-4',
              'pt-12 md:pt-14 landscape:pt-14',
              showInfographicInMainPane ? 'flex flex-col' : visualLayout === 1 ? 'flex flex-col' : visualGridClass
            )}
          >
            {showInfographicInMainPane ? (
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden rounded-lg border border-white/10 bg-black/25 p-2 text-left">
                {curriculumInfographic ? (
                  <>
                    <div
                      ref={infographicPaneStageRef}
                      data-infographic-draw-pane-stage
                      className={cn('relative flex min-h-0 flex-1 items-center justify-center touch-none')}
                      onPointerDown={(e) => startInfographicDrawing(e)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- remote curriculum infographic */}
                      <img
                        ref={infographicPaneImageRef}
                        data-student-curriculum-infographic-pane-img
                        src={curriculumInfographic.imageUrl}
                        alt=""
                        draggable={false}
                        onDragStart={(ev) => ev.preventDefault()}
                        className="max-h-full min-h-0 w-full select-none rounded-md border border-white/10 bg-black/20 object-contain"
                        referrerPolicy="no-referrer"
                      />
                      {shouldRenderInlineInfographicCanvas && (
                        <canvas
                          ref={infographicPaneCanvasRef}
                          data-infographic-draw-pane-canvas
                          className="absolute pointer-events-none"
                          aria-hidden
                        />
                      )}
                    </div>
                    {((isTeacherView && presenterLeftTab === 'infographic') || (isStudentCurriculumSlide && studentCurriculumLeftPaneTab === 'infographic')) && (
                      <div
                        data-infographic-toolbar="student-pane"
                        className="z-20 flex max-w-full flex-wrap items-center justify-center gap-1 self-center rounded-xl border border-white/25 bg-black/70 px-2 py-1 text-white shadow-lg"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                      <button
                        type="button"
                        onClick={() => setInfographicDrawTool('pen')}
                        className={cn('rounded px-2 py-1 text-[11px] transition-colors', infographicDrawTool === 'pen' ? 'bg-white/30' : 'hover:bg-white/15')}
                      >
                        {tr('Vẽ', 'Draw', '画笔', '描画', '그리기')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setInfographicDrawTool('eraser')}
                        className={cn('rounded px-2 py-1 text-[11px] transition-colors', infographicDrawTool === 'eraser' ? 'bg-white/30' : 'hover:bg-white/15')}
                      >
                        {tr('Tẩy', 'Erase', '橡皮', '消しゴム', '지우기')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setInfographicDrawBrushPx(3)}
                        className={cn('rounded px-2 py-1 text-[11px] transition-colors', infographicDrawBrushPx === 3 ? 'bg-white/30' : 'hover:bg-white/15')}
                      >
                        {tr('S', 'S', '细', '細', '얇게')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setInfographicDrawBrushPx(5)}
                        className={cn('rounded px-2 py-1 text-[11px] transition-colors', infographicDrawBrushPx === 5 ? 'bg-white/30' : 'hover:bg-white/15')}
                      >
                        {tr('M', 'M', '中', '中', '중간')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setInfographicDrawBrushPx(7)}
                        className={cn('rounded px-2 py-1 text-[11px] transition-colors', infographicDrawBrushPx === 7 ? 'bg-white/30' : 'hover:bg-white/15')}
                      >
                        {tr('L', 'L', '粗', '太', '굵게')}
                      </button>
                      <div className="flex items-center gap-1 px-1">
                        {INFOGRAPHIC_DRAW_COLORS.map((color) => (
                          <button
                            key={`pane-${color}`}
                            type="button"
                            onClick={() => setInfographicDrawColor(color)}
                            className={cn(
                              'h-3.5 w-3.5 rounded-full border transition-transform',
                              infographicDrawColor === color ? 'scale-110 border-white' : 'border-white/40 hover:scale-105'
                            )}
                            style={{ backgroundColor: color }}
                            title={tr('Màu nét vẽ', 'Stroke color', '画笔颜色', '描画色', '펜 색상')}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          undoInfographicStroke(activeInfographicStrokeKey)
                          sendInfographicDrawMessage({ type: 'infographic-draw-undo', slideIndex: activeInfographicStrokeKey })
                        }}
                        className="rounded px-2 py-1 text-[11px] transition-colors hover:bg-white/15"
                      >
                        {tr('Undo', 'Undo', '撤销', '元に戻す', '실행 취소')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          clearInfographicStrokes(activeInfographicStrokeKey)
                          sendInfographicDrawMessage({ type: 'infographic-draw-clear', slideIndex: activeInfographicStrokeKey })
                        }}
                        className="rounded px-2 py-1 text-[11px] transition-colors hover:bg-white/15"
                      >
                        {tr('Clear', 'Clear', '清除', 'クリア', '지우기')}
                      </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-white/60">
                    {tr(
                      'Chưa có infographic cho giáo trình này.',
                      'No curriculum infographic yet.',
                      '本课程尚无信息图。',
                      'このカリキュラムにはまだインフォグラフィックがありません。',
                      '이 교육과정에는 아직 인포그래픽이 없습니다.'
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div ref={studentEmbeddedVisualFrameRef} className="contents">
              {visualLayout === 1 ? (
                <div key={`nano-vis-pane-${currentIndex}`} className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-black/30">
                  <span className="absolute left-1 top-1 z-10 rounded bg-black/60 px-1.5 py-0.5 font-mono text-xs text-white">
                    {currentIndex + 1}-1
                  </span>
                  {visualCells[0]?.visualEmbed ? (
                    (() => {
                      const embeds = parseContentEmbeds(visualCells[0].visualEmbed)
                      const first = embeds[0]
                      if (!first) return <div className="min-h-0 flex-1" />
                      return (
                        <div className="flex min-h-0 flex-1 flex-col" key={`nano-vis-${currentIndex}-0-${first.type}-${first.urlOrId.slice(0, 80)}`}>
                          <LazyHeavyMount minHeight={180}>
                            <ContentEmbed type={first.type} urlOrId={first.urlOrId} tr={tr} hideQuiz fill className="!my-0 !rounded-lg !border-0" />
                          </LazyHeavyMount>
                        </div>
                      )
                    })()
                  ) : visualCells[0]?.imageUrl ? (
                    visualImageIsCurriculumInfographic(visualCells[0].imageUrl, curriculumInfographic) ? (
                      <div
                        data-infographic-draw-pane-stage
                        className="relative flex min-h-0 w-full flex-1 touch-none items-center justify-center p-1"
                        onPointerDown={(e) => startInfographicDrawing(e)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- curriculum infographic in Visual pane */}
                        <img
                          key={`nano-vis-img-${currentIndex}-0`}
                          data-student-curriculum-infographic-pane-img
                          src={visualCells[0].imageUrl}
                          alt=""
                          draggable={false}
                          onDragStart={(ev) => ev.preventDefault()}
                          className="max-h-full max-w-full select-none rounded-md border border-white/10 bg-black/20 object-contain"
                          referrerPolicy="no-referrer"
                        />
                        {shouldRenderInlineInfographicCanvas && (
                          <canvas data-infographic-draw-pane-canvas className="pointer-events-none absolute" aria-hidden />
                        )}
                        <div
                          data-infographic-toolbar="student-pane"
                          className="absolute bottom-2 left-1/2 z-20 flex w-[min(96%,680px)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-xl border border-white/25 bg-black/70 px-2 py-1 text-white shadow-lg backdrop-blur-sm"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button type="button" onClick={() => setInfographicDrawTool('pen')} className={cn('rounded px-2 py-1 text-[11px]', infographicDrawTool === 'pen' ? 'bg-white/30' : 'hover:bg-white/15')}>{tr('Vẽ', 'Draw', '画笔', '描画', '그리기')}</button>
                          <button type="button" onClick={() => setInfographicDrawTool('eraser')} className={cn('rounded px-2 py-1 text-[11px]', infographicDrawTool === 'eraser' ? 'bg-white/30' : 'hover:bg-white/15')}>{tr('Tẩy', 'Erase', '橡皮', '消しゴム', '지우기')}</button>
                          <button type="button" onClick={() => setInfographicDrawBrushPx(3)} className={cn('rounded px-2 py-1 text-[11px]', infographicDrawBrushPx === 3 ? 'bg-white/30' : 'hover:bg-white/15')}>{tr('S', 'S', '细', '細', '얇게')}</button>
                          <button type="button" onClick={() => setInfographicDrawBrushPx(5)} className={cn('rounded px-2 py-1 text-[11px]', infographicDrawBrushPx === 5 ? 'bg-white/30' : 'hover:bg-white/15')}>{tr('M', 'M', '中', '中', '중간')}</button>
                          <button type="button" onClick={() => setInfographicDrawBrushPx(7)} className={cn('rounded px-2 py-1 text-[11px]', infographicDrawBrushPx === 7 ? 'bg-white/30' : 'hover:bg-white/15')}>{tr('L', 'L', '粗', '太', '굵게')}</button>
                          {INFOGRAPHIC_DRAW_COLORS.map((color) => (
                            <button key={`vis1-${color}`} type="button" onClick={() => setInfographicDrawColor(color)} className={cn('h-3.5 w-3.5 rounded-full border', infographicDrawColor === color ? 'border-white' : 'border-white/40')} style={{ backgroundColor: color }} />
                          ))}
                          <button type="button" onClick={() => { undoInfographicStroke(activeInfographicStrokeKey); sendInfographicDrawMessage({ type: 'infographic-draw-undo', slideIndex: activeInfographicStrokeKey }) }} className="rounded px-2 py-1 text-[11px] hover:bg-white/15">{tr('Undo', 'Undo', '撤销', '元に戻す', '실행 취소')}</button>
                          <button type="button" onClick={() => { clearInfographicStrokes(activeInfographicStrokeKey); sendInfographicDrawMessage({ type: 'infographic-draw-clear', slideIndex: activeInfographicStrokeKey }) }} className="rounded px-2 py-1 text-[11px] hover:bg-white/15">{tr('Clear', 'Clear', '清除', 'クリア', '지우기')}</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full min-h-0 w-full items-center justify-center">
                        <img
                          key={`nano-vis-img-${currentIndex}-0`}
                          src={visualCells[0].imageUrl}
                          alt=""
                          className="max-h-full max-w-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <div className="h-8 w-8 rounded bg-white/5" />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {visualCells.map((cell, idx) => (
                    <div key={`${currentIndex}-${idx}`} className="group relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-black/30">
                      <span className="absolute left-1 top-1 z-10 rounded bg-black/60 px-1.5 py-0.5 font-mono text-xs text-white">
                        {currentIndex + 1}-{idx + 1}
                      </span>
                      {(cell.visualEmbed || cell.imageUrl) && (
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            openVisualFullscreen(idx)
                          }}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            openVisualFullscreen(idx)
                          }}
                          className="absolute right-2 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-md border border-white/40 bg-black/85 text-white shadow-md ring-1 ring-black/30 transition-colors hover:border-white/55 hover:bg-black"
                          title={tr('Mở rộng ô này', 'Expand this cell', '展开此格', 'このセルを展開', '이 셀 확장')}
                          aria-label={tr('Mở rộng ô này', 'Expand this cell', '展开此格', 'このセルを展開', '이 셀 확장')}
                        >
                          <Maximize2 className="h-4 w-4 shrink-0" aria-hidden />
                        </button>
                      )}
                      {cell.visualEmbed ? (
                        (() => {
                          const embeds = parseContentEmbeds(cell.visualEmbed)
                          const first = embeds[0]
                          if (!first) return <div className="min-h-0 flex-1" />
                          return (
                            <div className="flex min-h-0 flex-1 flex-col" key={`nano-vis-${currentIndex}-${idx}-${first.type}-${first.urlOrId.slice(0, 80)}`}>
                              <LazyHeavyMount minHeight={180}>
                                <ContentEmbed type={first.type} urlOrId={first.urlOrId} tr={tr} hideQuiz fill className="!my-0 !rounded-lg !border-0" />
                              </LazyHeavyMount>
                            </div>
                          )
                        })()
                      ) : cell.imageUrl ? (
                        visualImageIsCurriculumInfographic(cell.imageUrl, curriculumInfographic) ? (
                          <div
                            data-infographic-draw-pane-stage
                            className="relative flex min-h-0 w-full flex-1 touch-none items-center justify-center p-0.5"
                            onPointerDown={(e) => startInfographicDrawing(e)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- curriculum infographic in Visual pane */}
                            <img
                              key={`nano-vis-img-${currentIndex}-${idx}`}
                              data-student-curriculum-infographic-pane-img
                              src={cell.imageUrl}
                              alt=""
                              draggable={false}
                              onDragStart={(ev) => ev.preventDefault()}
                              className="max-h-full max-w-full select-none rounded-md border border-white/10 bg-black/20 object-contain"
                              referrerPolicy="no-referrer"
                            />
                            {shouldRenderInlineInfographicCanvas && (
                              <canvas data-infographic-draw-pane-canvas className="pointer-events-none absolute" aria-hidden />
                            )}
                            <div
                              data-infographic-toolbar="student-pane"
                              className="absolute bottom-2 left-1/2 z-20 flex w-[min(96%,680px)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-xl border border-white/25 bg-black/70 px-2 py-1 text-white shadow-lg backdrop-blur-sm"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button type="button" onClick={() => setInfographicDrawTool('pen')} className={cn('rounded px-2 py-1 text-[11px]', infographicDrawTool === 'pen' ? 'bg-white/30' : 'hover:bg-white/15')}>{tr('Vẽ', 'Draw', '画笔', '描画', '그리기')}</button>
                              <button type="button" onClick={() => setInfographicDrawTool('eraser')} className={cn('rounded px-2 py-1 text-[11px]', infographicDrawTool === 'eraser' ? 'bg-white/30' : 'hover:bg-white/15')}>{tr('Tẩy', 'Erase', '橡皮', '消しゴム', '지우기')}</button>
                              <button type="button" onClick={() => setInfographicDrawBrushPx(3)} className={cn('rounded px-2 py-1 text-[11px]', infographicDrawBrushPx === 3 ? 'bg-white/30' : 'hover:bg-white/15')}>{tr('S', 'S', '细', '細', '얇게')}</button>
                              <button type="button" onClick={() => setInfographicDrawBrushPx(5)} className={cn('rounded px-2 py-1 text-[11px]', infographicDrawBrushPx === 5 ? 'bg-white/30' : 'hover:bg-white/15')}>{tr('M', 'M', '中', '中', '중간')}</button>
                              <button type="button" onClick={() => setInfographicDrawBrushPx(7)} className={cn('rounded px-2 py-1 text-[11px]', infographicDrawBrushPx === 7 ? 'bg-white/30' : 'hover:bg-white/15')}>{tr('L', 'L', '粗', '太', '굵게')}</button>
                              {INFOGRAPHIC_DRAW_COLORS.map((color) => (
                                <button key={`vism-${idx}-${color}`} type="button" onClick={() => setInfographicDrawColor(color)} className={cn('h-3.5 w-3.5 rounded-full border', infographicDrawColor === color ? 'border-white' : 'border-white/40')} style={{ backgroundColor: color }} />
                              ))}
                              <button type="button" onClick={() => { undoInfographicStroke(activeInfographicStrokeKey); sendInfographicDrawMessage({ type: 'infographic-draw-undo', slideIndex: activeInfographicStrokeKey }) }} className="rounded px-2 py-1 text-[11px] hover:bg-white/15">{tr('Undo', 'Undo', '撤销', '元に戻す', '실행 취소')}</button>
                              <button type="button" onClick={() => { clearInfographicStrokes(activeInfographicStrokeKey); sendInfographicDrawMessage({ type: 'infographic-draw-clear', slideIndex: activeInfographicStrokeKey }) }} className="rounded px-2 py-1 text-[11px] hover:bg-white/15">{tr('Clear', 'Clear', '清除', 'クリア', '지우기')}</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex min-h-0 flex-1 items-center justify-center">
                            <img
                              key={`nano-vis-img-${currentIndex}-${idx}`}
                              src={cell.imageUrl}
                              alt=""
                              className="max-h-full max-w-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <div className="h-8 w-8 rounded bg-white/5" />
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
              </div>
            )}
            </div>
        </div>

        {/* Content: GV desktop 55%; HS desktop 50%; mobile full width bên dưới visual */}
        <div
          className={cn(
            'flex min-h-0 shrink-0 flex-col bg-white',
            narrowSlideLayout
              ? 'w-full flex-1 min-h-[min(60vh,520px)]'
              : isTeacherView
                ? 'w-[55%]'
                : 'w-1/2',
          )}
        >
          {!isTeacherView && !worksheetPresentation && slides.length > 0 && (
            <div
              className="flex h-12 shrink-0 items-center overflow-x-auto border-b border-slate-200 bg-white px-3 shadow-sm print:hidden md:h-14 md:px-6 lg:px-8 landscape:px-6"
              data-control="student-curriculum-mode"
            >
              <div className="-ml-[12px] flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap md:flex-none md:gap-2.5 md:whitespace-normal">
              <button
                type="button"
                data-control="student-curriculum-all"
                data-pointer-sync-id="student-mode-markdown-all"
                onClick={() => {
                  setStudentCurriculumRightMode('markdown-all')
                  notifyTeacherStudentCurriculumMode('markdown-all')
                }}
                className={cn(
                  'flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition-colors md:h-9 md:px-3 md:text-sm',
                  studentCurriculumRightMode === 'markdown-all'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-400/50'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                )}
                title={tr(
                  'Nhiều slide nối liền (markdown), cuộn theo slide đang chiếu',
                  'Connected slides (markdown), scrolls with the active slide',
                  '多张幻灯片连贯显示（Markdown），随当前页滚动',
                  'スライドを連続表示（Markdown）、表示中のスライドに追従',
                  '슬라이드 연속 보기(Markdown), 현재 슬라이드에 맞춰 스크롤'
                )}
              >
                <FileText className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" />
                {tr('Chuỗi slide', 'Slide sequence', '连续幻灯片', 'スライド連続', '슬라이드 연속')}
              </button>
              <button
                type="button"
                data-control="student-curriculum-single"
                data-pointer-sync-id="student-mode-single-slide"
                onClick={() => {
                  setStudentCurriculumRightMode('single-slide')
                  notifyTeacherStudentCurriculumMode('single-slide')
                }}
                className={cn(
                  'flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition-colors md:h-9 md:px-3 md:text-sm',
                  studentCurriculumRightMode === 'single-slide'
                    ? 'border-amber-400 bg-amber-50 text-amber-900 ring-1 ring-amber-400/50'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                )}
                title={tr(
                  'Chỉ xem một slide tại một thời điểm',
                  'Show one slide at a time',
                  '一次只查看一张幻灯片',
                  '一度に1枚のスライドのみ表示',
                  '한 번에 슬라이드 한 장만 표시'
                )}
              >
                <Square className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" />
                {tr('Slide đơn', 'Single slide', '单张幻灯片', '1枚のスライド', '슬라이드 한 장')}
              </button>
              </div>
            </div>
          )}
          <div
            ref={studentMdRightColumnScrollRef}
            className="min-h-0 flex-1 overflow-y-auto p-3 pb-6 md:p-8 lg:p-12 landscape:p-8"
          >
          <div
            ref={studentSlideContentLayoutRef}
            className={cn(
              'min-w-0',
              presentationMode === 'slide-interaction' && !isTeacherView && syncedTeacherSlideLayoutW != null && 'mx-auto',
            )}
            style={
              presentationMode === 'slide-interaction' &&
              !isTeacherView &&
              syncedTeacherSlideLayoutW != null &&
              studentMdScrollClientW > 0
                ? {
                    width: Math.min(syncedTeacherSlideLayoutW, studentMdScrollClientW),
                    maxWidth: '100%',
                  }
                : undefined
            }
          >
          {!isTeacherView && !worksheetPresentation && studentCurriculumRightMode === 'markdown-all' && slides.length > 0 ? (
            <div ref={studentMarkdownAllScrollRef} className="space-y-6 pb-6 text-left">
              {(() => {
                const mdAllStudentCurriculum =
                  !isTeacherView && !worksheetPresentation && studentCurriculumRightMode === 'markdown-all'
                /** Chuỗi slide (HS): chỉ hiện các slide đã tới — không render slide phía sau (danh sách theo tiến độ). */
                const mdAllSlidesToShow = mdAllStudentCurriculum ? slides.slice(0, currentIndex + 1) : slides
                return mdAllSlidesToShow.map((s, si) => {
                const rawBlks =
                  Array.isArray(s.blocks) && s.blocks.length > 0 ? s.blocks : s.content ? parseContentToBlocks(s.content ?? '') : []
                const blksForSlide =
                  rawBlks.length > 0 && rawBlks.every((b) => !(b.content ?? '').trim()) && (s.content ?? '').trim()
                    ? parseContentToBlocks(s.content ?? '')
                    : rawBlks
                const isCurrent = si === currentIndex
                /** Slide hiện tại: chỉ khi còn gõ segment đáp án (đồng bộ GV). */
                const mdChainLiveTyping =
                  mdAllStudentCurriculum && isCurrent && hasSegmentTypingWork && !segmentTypingCompleted
                const estimatedSlideBodyMinHeight = Math.min(1400, Math.max(220, blksForSlide.length * 170))
                const shouldLazyMountMarkdownBody = mdAllStudentCurriculum && !isCurrent && !mdChainLiveTyping

                const renderFullSlideBody = () =>
                  blksForSlide.length > 0 ? (
                    <div className="space-y-4">
                      {blksForSlide.map((b, bi) => {
                        const bExt = b as { studentAnswerHidden?: boolean }
                        if (!isTeacherView && bExt.studentAnswerHidden) return null
                        const blockContentNode = (
                          <CurriculumBlockContentWithEmbeds
                            content={b.content ?? ''}
                            liveQuizContext={curriculumId ? { curriculumId, slideIndex: si, blockIndex: bi } : undefined}
                            tr={tr}
                            hideQuiz
                          />
                        )
                        const approximateBlockMinHeight = Math.min(
                          520,
                          Math.max(140, Math.ceil((b.content ?? '').trim().length / 5))
                        )
                        return (
                          <div key={bi} className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
                            {b.header ? (
                              <div className="mb-2 text-xs font-bold text-violet-800">{b.header}</div>
                            ) : null}
                            <div className="text-slate-800">
                              {shouldLazyMountMarkdownBody ? (
                                <LazyHeavyMount
                                  minHeight={approximateBlockMinHeight}
                                  rootMargin="80px 0px"
                                  keepMountedOnceVisible
                                  render={() => blockContentNode}
                                />
                              ) : (
                                blockContentNode
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (s.content ?? '').trim() ? (
                    shouldLazyMountMarkdownBody ? (
                      <LazyHeavyMount
                        minHeight={Math.min(780, Math.max(180, Math.ceil((s.content ?? '').trim().length / 5)))}
                        rootMargin="80px 0px"
                        keepMountedOnceVisible
                        render={() => (
                          <CurriculumBlockContentWithEmbeds
                            content={s.content ?? ''}
                            liveQuizContext={curriculumId ? { curriculumId, slideIndex: si, blockIndex: 0 } : undefined}
                            tr={tr}
                            hideQuiz
                          />
                        )}
                      />
                    ) : (
                      <CurriculumBlockContentWithEmbeds
                        content={s.content ?? ''}
                        liveQuizContext={curriculumId ? { curriculumId, slideIndex: si, blockIndex: 0 } : undefined}
                        tr={tr}
                        hideQuiz
                      />
                    )
                  ) : null

                const renderCurrentSlideTypingBody = () => {
                  if (!slide) return null
                  if (hasBlocks) {
                    return (
                      <div className="space-y-4">
                        {blocks.map((b, i) => {
                          const bExt = b as { isAnswer?: boolean; studentAnswerHidden?: boolean }
                          if (!isTeacherView && bExt.studentAnswerHidden) return null
                          const wsKey = `${currentIndex}-${i}`
                          const solutionSegmentBlock =
                            !isTeacherView &&
                            (worksheetPresentation
                              ? worksheetAnswerSegmentCount(b.content ?? '') > 0
                              : !!curriculumId)
                          let visibleForBlock: number | undefined
                          if (solutionSegmentBlock) {
                            const typingOn = worksheetAnswerTypingEnabled?.[wsKey] !== false
                            visibleForBlock = typingOn ? (worksheetAnswerReveal?.[wsKey] ?? 0) : undefined
                          } else {
                            visibleForBlock = undefined
                          }
                          return (
                            <div key={i} className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
                              {b.header ? (
                                <div className="mb-2 text-xs font-bold text-violet-800">{b.header}</div>
                              ) : null}
                              <div className="text-slate-800">
                                {solutionSegmentBlock ? (
                                  <WorksheetBlockContentWithEmbeds
                                    content={b.content}
                                    liveQuizContext={curriculumId ? { curriculumId, slideIndex: currentIndex, blockIndex: i } : undefined}
                                    tr={tr}
                                    hideQuiz
                                    visibleSegmentCount={visibleForBlock}
                                    suppressTypingPenAtZero={false}
                                    allowTypingPenAtRevealStart={
                                      sequentialSolutionPenBlockIndex != null && sequentialSolutionPenBlockIndex === i
                                    }
                                  />
                                ) : (
                                  <CurriculumBlockContentWithEmbeds
                                    content={b.content}
                                    liveQuizContext={curriculumId ? { curriculumId, slideIndex: currentIndex, blockIndex: i } : undefined}
                                    tr={tr}
                                    hideQuiz
                                  />
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  }
                  if ((slide.content ?? '').trim()) {
                    return (
                      <div className="text-slate-800">
                        <CurriculumBlockContentWithEmbeds
                          content={slide.content ?? ''}
                          liveQuizContext={curriculumId ? { curriculumId, slideIndex: currentIndex, blockIndex: 0 } : undefined}
                          tr={tr}
                          hideQuiz
                        />
                      </div>
                    )
                  }
                  return null
                }

                return (
                  <section
                    key={si}
                    id={`nano-student-md-slide-${si}`}
                    className={cn(
                      'scroll-mt-6 scroll-mb-8 rounded-xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm md:p-5 md:scroll-mt-10 md:scroll-mb-12',
                      si === currentIndex && 'ring-2 ring-amber-400'
                    )}
                  >
                    <h3 className="mb-3 text-lg font-bold text-slate-900 md:text-xl">
                      {si + 1}.{' '}
                      {mdChainLiveTyping &&
                      isCurrent &&
                      curriculumId &&
                      worksheetAnswerSegmentCount(s.title ?? '') > 0 &&
                      worksheetAnswerTypingEnabled?.[curriculumSlideTitleRevealKey(si)] !== false ? (
                        <AnimatedCharReveal
                          text={s.title}
                          visibleCount={worksheetAnswerReveal?.[curriculumSlideTitleRevealKey(si)] ?? 0}
                          showCursor={sequentialSolutionPenBlockIndex === -1}
                          penWhenEmpty={sequentialSolutionPenBlockIndex === -1}
                        />
                      ) : (
                        s.title
                      )}
                    </h3>
                    {mdChainLiveTyping && isCurrent ? (
                      renderCurrentSlideTypingBody()
                    ) : shouldLazyMountMarkdownBody ? (
                      <LazyHeavyMount
                        minHeight={estimatedSlideBodyMinHeight}
                        rootMargin="120px 0px"
                        keepMountedOnceVisible
                        render={() => renderFullSlideBody()}
                      />
                    ) : (
                      renderFullSlideBody()
                    )}
                  </section>
                )
              })
              })()}
              <div
                aria-hidden
                className="pointer-events-none shrink-0"
                style={{ height: studentMdChainBottomSpacerPx }}
              />
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-start gap-2 md:mb-6 landscape:mb-6">
                <h2 className="flex-1 text-xl font-bold text-slate-900 md:text-2xl lg:text-3xl landscape:text-2xl">
                  {!isTeacherView &&
                  !worksheetPresentation &&
                  curriculumId &&
                  hasBlocks &&
                  worksheetAnswerSegmentCount(slide.title ?? '') > 0 &&
                  worksheetAnswerTypingEnabled?.[curriculumSlideTitleRevealKey(currentIndex)] !== false ? (
                    <AnimatedCharReveal
                      text={slide.title}
                      visibleCount={worksheetAnswerReveal?.[curriculumSlideTitleRevealKey(currentIndex)] ?? 0}
                      showCursor={sequentialSolutionPenBlockIndex === -1}
                      penWhenEmpty={sequentialSolutionPenBlockIndex === -1}
                    />
                  ) : (
                    slide.title
                  )}
                </h2>
                {extractQuizFromSlide(slide).length > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuizPopupOpen(true)}
                    className={cn(
                      'shrink-0 border-violet-400 text-violet-700 hover:bg-violet-50 print:hidden',
                      !isTeacherView && !worksheetPresentation && !!curriculumId ? 'mt-[19.5px]' : 'mt-[9.5px]'
                    )}
                  >
                    <ClipboardList className="mr-1.5 h-4 w-4" />
                    {tr('Xem câu hỏi trắc nghiệm', 'View quiz', '查看测验', 'クイズを見る', '퀴즈 보기')}
                  </Button>
                ) : null}
              </div>
              <div ref={studentSlidePointerSyncRef} className="w-full min-w-0">
              {hasBlocks ? (
                <div className="space-y-4">
                  {blocks.map((b, i) => {
                    const bExt = b as { isAnswer?: boolean; studentAnswerHidden?: boolean }
                    if (!isTeacherView && bExt.studentAnswerHidden) return null
                    const wsKey = `${currentIndex}-${i}`
                    const worksheetOrCurriculumSegmentBlock =
                      !isTeacherView &&
                      (worksheetPresentation
                        ? worksheetAnswerSegmentCount(b.content ?? '') > 0
                        : !!curriculumId)
                    let visibleForBlock: number | undefined
                    if (worksheetOrCurriculumSegmentBlock) {
                      const typingOn = worksheetAnswerTypingEnabled?.[wsKey] !== false
                      visibleForBlock = typingOn ? (worksheetAnswerReveal?.[wsKey] ?? 0) : undefined
                    } else {
                      visibleForBlock = undefined
                    }
                    /** HS giáo trình (không phiếu): header + icon trên cùng — text full width, khớp thụt lề với GV */
                    const stackCurriculumBlockChrome =
                      !isTeacherView && !!curriculumId && !worksheetPresentation
                    const blockBody = worksheetOrCurriculumSegmentBlock ? (
                      <WorksheetBlockContentWithEmbeds
                        content={b.content}
                        liveQuizContext={curriculumId ? { curriculumId, slideIndex: currentIndex, blockIndex: i } : undefined}
                        pointerSyncSlideIndex={currentIndex}
                        pointerSyncBlockIndex={i}
                        tr={tr}
                        hideQuiz
                        visibleSegmentCount={visibleForBlock}
                        suppressTypingPenAtZero={false}
                        allowTypingPenAtRevealStart={
                          sequentialSolutionPenBlockIndex != null && sequentialSolutionPenBlockIndex === i
                        }
                      />
                    ) : (
                      <CurriculumBlockContentWithEmbeds
                        content={b.content}
                        liveQuizContext={curriculumId ? { curriculumId, slideIndex: currentIndex, blockIndex: i } : undefined}
                        pointerSyncSlideIndex={currentIndex}
                        pointerSyncBlockIndex={i}
                        tr={tr}
                        hideQuiz
                      />
                    )
                    return stackCurriculumBlockChrome ? (
                      <div key={i} className="rounded-lg overflow-hidden bg-white shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 border-b border-violet-100 bg-violet-50/90 px-4 py-2.5">
                          <div className="text-violet-600 shrink-0">{getIconForHeader(b.header ?? '')}</div>
                          <span className="text-xs font-bold text-violet-700">
                            {(b.header ?? '').trim()
                              ? b.header
                              : tr('Nội dung', 'Content', '内容', '内容', '내용')}
                          </span>
                        </div>
                        <div className="p-2.5 text-slate-800">{blockBody}</div>
                      </div>
                    ) : (
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
                        <div className="flex-1 p-2.5 text-slate-800">{blockBody}</div>
                      </div>
                    )
                  })}
                </div>
              ) : slide.content ? (
                <div className="text-slate-700">
                  <CurriculumBlockContentWithEmbeds
                    content={slide.content}
                    liveQuizContext={curriculumId ? { curriculumId, slideIndex: currentIndex, blockIndex: 0 } : undefined}
                    pointerSyncSlideIndex={currentIndex}
                    pointerSyncBlockIndex={0}
                    tr={tr}
                    hideQuiz
                  />
                </div>
              ) : null}
              </div>
            </>
          )}
          {/* Ghi chú chỉ sửa trong cửa sổ Giáo trình – không hiển thị trên slide cho học sinh */}
          </div>
          </div>
        </div>
        </div>
        </div>
      </div>

      <MemoryDebugHudRuntime
        enabled={memoryDebugEnabled}
        slides={slides}
        payloadStatsRef={curriculumPayloadStatsRef}
        slideCount={slides.length}
        currentIndex={currentIndex}
        logPeaks={memoryDebugEnabled}
      />

      {isTeacherView && (
        <ProjectorRemoteButton
          tr={tr}
          getStudentWindow={() => studentViewWindowRef.current}
        />
      )}

      {!isTeacherView && projectorPromptVisible && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/85 backdrop-blur-sm print:hidden">
          <button
            type="button"
            onClick={() => {
              try {
                const root = document.documentElement
                const reqFs =
                  root.requestFullscreen ??
                  (root as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen
                const p = reqFs?.call(root) as Promise<void> | undefined
                if (p) p.catch(() => {})
              } catch {
                /* ignore */
              }
              setProjectorPromptVisible(false)
            }}
            className="flex flex-col items-center gap-3 rounded-2xl border border-white/20 bg-violet-700/95 px-8 py-6 text-white shadow-2xl hover:bg-violet-600"
          >
            <MonitorPlay className="h-12 w-12" />
            <span className="text-lg font-semibold">
              {tr('Bấm để bắt đầu trình chiếu', 'Click to start projector mode', '点击开始投影', '投影モードを開始', '프레젠테이션 시작')}
            </span>
            <span className="text-xs opacity-80">
              {tr('Trình duyệt yêu cầu xác nhận trước khi bật toàn màn hình', 'Browser requires confirmation before fullscreen', '浏览器需要确认后才能全屏', 'ブラウザはフルスクリーン前に確認が必要', '브라우저는 전체 화면 전 확인이 필요합니다')}
            </span>
          </button>
        </div>,
        document.body,
      )}

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
                  const { layout, cells } = getVisualCellsForPresentation(s, curriculumInfographic)
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
                                  <LazyHeavyMount minHeight={90}>
                                    <ContentEmbed type={first.type} urlOrId={first.urlOrId} width={120} height={90} tr={tr} hideQuiz />
                                  </LazyHeavyMount>
                                </div>
                              )
                            })()
                          ) : cell.imageUrl ? (
                            visualImageIsCurriculumInfographic(cell.imageUrl, curriculumInfographic) ? (
                              <div className="flex h-full w-full min-h-[40px] items-center justify-center bg-black/20 p-0.5">
                                <img
                                  src={cell.imageUrl}
                                  alt=""
                                  className="max-h-full min-h-0 w-full rounded border border-white/10 object-contain"
                                />
                              </div>
                            ) : (
                              <img src={cell.imageUrl} alt="" className="w-full h-full min-h-[40px] object-cover" />
                            )
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
                            <CurriculumBlockContentWithEmbeds content={b.content} tr={tr} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : s.content ? (
                  <div className="text-slate-700 text-base [&_ul]:list-disc [&_ul]:pl-5">
                    <CurriculumBlockContentWithEmbeds content={s.content} tr={tr} />
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
