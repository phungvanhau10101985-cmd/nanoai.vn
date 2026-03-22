'use client'

import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X, Printer, ArrowRight, TrendingUp, CalendarCheck, Lightbulb, BookOpen, Target, BarChart2, Trash2, Play, Pause, Settings2, ClipboardList, Maximize2, Timer, RotateCcw, Link2, Copy, ExternalLink, FileText, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import QRCode from 'qrcode'
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
import { ContentEmbed, splitContentWithEmbeds, parseContentEmbeds, splitBlockContentAtQuizBoundary } from './content-embed'
import { AnimatedCharReveal } from './animated-char-reveal'
import { CurriculumBlockContentWithEmbeds } from './curriculum-block-content-with-embeds'
import { WorksheetBlockContentWithEmbeds } from './worksheet-block-content-with-embeds'
import { EmbedInsertDialog } from './embed-insert-dialog'
import { PresentationControlBar } from './presentation-control-bar'
import { QuizPopupDialog, extractQuizFromSlide } from './quiz-popup-dialog'
import { useToast } from '@/hooks/use-toast'
import { saveSlidesToCurriculum, saveUserCustomizedSlides } from '../actions'
import { useScreenShare } from '../hooks/use-screen-share'
import { useScreenShareLive } from '../hooks/use-screen-share-live'
import { curriculumSlideTitleRevealKey, findFirstSequentialSolutionBlockIndex, worksheetAnswerSegmentCount } from '../lib/worksheet-answer-segments'
import { createPresentationSyncId, getPresentationBroadcastChannelName, LEGACY_PRESENTATION_BROADCAST_CHANNEL } from '../lib/presentation-broadcast'
import { getStudentSlideWindowConfig, isPathMatchingStudentSlideKind, studentSlideUrlWithSync, STUDENT_WINDOW_NAME_CURRICULUM, STUDENT_WINDOW_NAME_WORKSHEET } from '../lib/student-slide-window'

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

function getBaseSlides(curriculumMarkdown: string, topic: string, aiSlides: AISlideData[] | null | undefined): SlideItem[] {
  /** Luôn dùng aiSlides khi có – đảm bảo visualEmbed/visualCells (bản đồ, GeoGebra...) hiển thị đúng ở giao diện học sinh */
  if (aiSlides && aiSlides.length > 0) {
    return aiSlides.map((s) => {
      const base = s as SlideItem
      const hasVisualFromCells = base.visualCells?.some((c) => c.visualEmbed || c.imageUrl)
      return {
        title: s.title,
        content: '',
        blocks: s.blocks,
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
  const readable = latexToReadable(curriculumMarkdown)
  const parsed = parseCurriculumToSlides(readable)
  return topic ? [{ title: topic, content: '' }, ...parsed] : parsed
}

export function NanoAISlideViewer({ curriculumMarkdown, topic, onClose, aiSlides, curriculumId, subjectId, gradeLevelId, tr, onSlidesSaved, slideMode, originalSlides, personalSlides, sharedSlides, initialSlideIndex, isTeacherView = true, onOpenStudentView: onOpenStudentViewProp, worksheetPresentation = false, worksheetAnswerReveal, worksheetAnswerTypingEnabled, worksheetStemTypingEnabled: _worksheetStemTypingEnabled, presentationBroadcastSyncId = null, syncedStudentCurriculumRightMode = null }: NanoAISlideViewerProps) {
  const { toast } = useToast()
  const [slides, setSlides] = useState<SlideItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false)
  const [autoPlay, setAutoPlay] = useState(false)
  const [autoPlayIntervalMs, setAutoPlayIntervalMs] = useState(5000)
  const [transitionDirection, setTransitionDirection] = useState<'next' | 'prev'>('next')
  const initialSlideSyncedRef = useRef(false)
  const pendingSlideGoIndexRef = useRef<number | null>(null)
  const [personalViewSubMode, setPersonalViewSubMode] = useState<'current' | 'original'>('current')
  const [quizPopupOpen, setQuizPopupOpen] = useState(false)
  const [quizSessionData, setQuizSessionData] = useState<Record<string, { sessionCode: string; quizDurationSeconds: number }>>({})
  const [quizSessionSettings, setQuizSessionSettings] = useState<Record<string, { quizDurationSeconds: number; autoRevealOnTimerEnd: boolean }>>({})
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  /** Tab tạo phiếu bài tập: kênh đồng bộ HS tách biệt với tab GV khác. */
  const [worksheetTabSyncId] = useState(() => createPresentationSyncId())
  const presentationBroadcastChannelName = useMemo(
    () => getPresentationBroadcastChannelName(!isTeacherView ? presentationBroadcastSyncId ?? undefined : undefined),
    [isTeacherView, presentationBroadcastSyncId]
  )
  const [shareQrDataUrl, setShareQrDataUrl] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [screenShareOverlayVisible, setScreenShareOverlayVisible] = useState(true)
  const [screenShareLiveDialogOpen, setScreenShareLiveDialogOpen] = useState(false)
  /** Chuột ảo không tạo user gesture — mở dialog để HS bấm thật một lần rồi mới gọi getDisplayMedia. */
  const [screenShareLiveGestureGateOpen, setScreenShareLiveGestureGateOpen] = useState(false)
  const shareInProgressRef = useRef(false)
  const screenShareLiveInProgressRef = useRef(false)

  const {
    isSharing: isScreenShareLiveActive,
    shareUrl: screenShareLiveUrl,
    shareCode: screenShareLiveCode,
    error: screenShareLiveError,
    startShare: startScreenShareLive,
    stopShare: stopScreenShareLive,
  } = useScreenShareLive()
  const isScreenShareLiveActiveRef = useRef(isScreenShareLiveActive)
  isScreenShareLiveActiveRef.current = isScreenShareLiveActive
  const stopScreenShareLiveRef = useRef(stopScreenShareLive)
  stopScreenShareLiveRef.current = stopScreenShareLive
  const [visualFullscreenOpen, setVisualFullscreenOpen] = useState(false)
  const [expandedCellIndex, setExpandedCellIndex] = useState<number | null>(null)
  /** Học sinh + giáo trình (không phiếu): cột phải — một slide hoặc toàn bộ slide nối liền (markdown). */
  const [studentCurriculumRightMode, setStudentCurriculumRightMode] = useState<'single-slide' | 'markdown-all'>('single-slide')
  const notifyTeacherStudentCurriculumMode = useCallback((mode: 'single-slide' | 'markdown-all') => {
    try {
      window.opener?.postMessage({ type: 'student-curriculum-right-mode-changed', mode }, window.location.origin)
    } catch {
      /* ignore */
    }
  }, [])
  useEffect(() => {
    if (syncedStudentCurriculumRightMode !== 'markdown-all' && syncedStudentCurriculumRightMode !== 'single-slide') return
    setStudentCurriculumRightMode(syncedStudentCurriculumRightMode)
  }, [syncedStudentCurriculumRightMode])
  const fullscreenOverlayRef = useRef<HTMLDivElement>(null)
  const studentVisualFrameRef = useRef<HTMLDivElement | null>(null)
  const studentMarkdownAllScrollRef = useRef<HTMLDivElement | null>(null)
  /** Cột phải HS: khung thật sự có overflow-y-auto (cha của danh sách chuỗi slide). */
  const studentMdRightColumnScrollRef = useRef<HTMLDivElement | null>(null)
  /** Khoảng trống cuộn thêm dưới cùng chuỗi slide ≈ ½ chiều cao slide đang chọn. */
  const [studentMdChainBottomSpacerPx, setStudentMdChainBottomSpacerPx] = useState(160)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [teacherTimerSeconds, setTeacherTimerSeconds] = useState(0)
  const [teacherTimerRunning, setTeacherTimerRunning] = useState(false)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [presentationMode, setPresentationMode] = useState<'independent' | 'slide-interaction'>('independent')
  const [viewportW, setViewportW] = useState(1280)
  const [stableLayoutWidth, setStableLayoutWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280))
  useEffect(() => {
    const onResize = () => setViewportW(typeof window !== 'undefined' ? window.innerWidth : 1280)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  useEffect(() => {
    setStableLayoutWidth((prev) => (viewportW > prev ? viewportW : prev))
  }, [viewportW])
  const [virtualMousePos, setVirtualMousePos] = useState<{ x: number; y: number } | null>(null)
  const [mouseTrail, setMouseTrail] = useState<Array<{ x: number; y: number }>>([])
  const [mouseClicks, setMouseClicks] = useState<Array<{ id: number; x: number; y: number }>>([])
  const mouseThrottleRef = useRef(0)
  const processedSyncSeqRef = useRef<Set<number>>(new Set())
  const quizPopupScrollApplyingRef = useRef(false)
  const closeVisualFullscreenRef = useRef<(opts?: { fromMessage?: boolean }) => void>(() => {})
  const lastLocalVisualOpenRef = useRef<number>(0)
  const visualFullscreenOpenedFromTeacherRef = useRef(false)

  const { receivedStream: screenShareStream, isReceiving: isScreenShareActive } = useScreenShare({
    role: 'student',
    openerWindow: typeof window !== 'undefined' ? window.opener : null,
  })

  useEffect(() => {
    if (isScreenShareActive) setScreenShareOverlayVisible(true)
  }, [isScreenShareActive])

  useEffect(() => {
    if (screenShareLiveError) {
      toast({ title: tr('Lỗi chia sẻ màn hình', 'Screen share error', '错误', 'エラー', '오류'), description: screenShareLiveError, variant: 'destructive' })
      setScreenShareLiveDialogOpen(false)
    }
  }, [screenShareLiveError, toast, tr])

  const handleScreenShareLiveClick = useCallback(async () => {
    if (screenShareLiveInProgressRef.current || screenShareLiveDialogOpen) return
    screenShareLiveInProgressRef.current = true
    try {
      await startScreenShareLive()
    } finally {
      screenShareLiveInProgressRef.current = false
    }
  }, [startScreenShareLive, screenShareLiveDialogOpen])

  const confirmScreenShareLiveAfterGestureGate = useCallback(() => {
    setScreenShareLiveGestureGateOpen(false)
    void handleScreenShareLiveClick()
  }, [handleScreenShareLiveClick])

  useEffect(() => {
    if (isScreenShareLiveActive && screenShareLiveUrl) setScreenShareLiveDialogOpen(true)
  }, [isScreenShareLiveActive, screenShareLiveUrl])

  const openVisualFullscreen = useCallback((cellIndex?: number, fromMessage?: boolean) => {
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
    if (!isWorksheetTeacher) return
    syncChannelRef.current = typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(getPresentationBroadcastChannelName(worksheetTabSyncId))
      : null
    return () => { syncChannelRef.current?.close(); syncChannelRef.current = null }
  }, [isWorksheetTeacher, worksheetTabSyncId])

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
      if (w && !w.closed) w.postMessage(payload, window.location.origin)
    } catch { /* ignore */ }
    try { syncChannelRef.current?.postMessage(payload) } catch { /* ignore */ }
  }, [])

  const sendCurriculumDataToStudent = useCallback((slidesToSend: SlideItem[], currentIndexOverride?: number) => {
    const idx = typeof currentIndexOverride === 'number' ? currentIndexOverride : currentIndex
    const payload = {
      type: 'curriculum-data',
      content: curriculumMarkdown,
      topic,
      currentIndex: Math.max(0, Math.min(idx, slidesToSend.length - 1)),
      curriculumId: null,
      slideMode: null,
      personalViewSubMode: 'current',
      hasOriginalSlides: false,
      slides: slidesToSend.map(toStudentSlidePayload),
      teacherTimerSeconds,
      teacherTimerRunning,
    }
    try {
      const w = studentViewWindowRef.current
      if (w && !w.closed) w.postMessage(payload, window.location.origin)
    } catch { /* ignore */ }
    try { syncChannelRef.current?.postMessage(payload) } catch { /* ignore */ }
  }, [curriculumMarkdown, topic, currentIndex, teacherTimerSeconds, teacherTimerRunning, toStudentSlidePayload])

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
          src.postMessage({
            type: 'curriculum-data',
            content: curriculumMarkdown,
            topic,
            currentIndex,
            curriculumId: null,
            slideMode: null,
            personalViewSubMode: 'current',
            hasOriginalSlides: false,
            slides: slides.map(toStudentSlidePayload),
            teacherTimerSeconds,
            teacherTimerRunning,
          }, window.location.origin)
          src.postMessage({ type: 'presentation-mode', mode: 'slide-interaction' }, window.location.origin)
        } catch { /* ignore */ }
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [isWorksheetTeacher, curriculumMarkdown, topic, currentIndex, slides, teacherTimerSeconds, teacherTimerRunning, toStudentSlidePayload])

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
      const res = await fetch('/api/tao-giao-trinh/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
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

  const [screenShareLiveQrUrl, setScreenShareLiveQrUrl] = useState<string | null>(null)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.name) {
      window.name =
        !isTeacherView && worksheetPresentation ? STUDENT_WINDOW_NAME_WORKSHEET : STUDENT_WINDOW_NAME_CURRICULUM
    }
  }, [isTeacherView, worksheetPresentation])

  useEffect(() => {
    if (!screenShareLiveUrl) {
      setScreenShareLiveQrUrl(null)
      return
    }
    QRCode.toDataURL(screenShareLiveUrl, { width: 200, margin: 2 })
      .then(setScreenShareLiveQrUrl)
      .catch(() => setScreenShareLiveQrUrl(null))
  }, [screenShareLiveUrl])

  const copyScreenShareLiveLink = useCallback(() => {
    if (!screenShareLiveUrl) return
    navigator.clipboard.writeText(screenShareLiveUrl)
    toast({ title: tr('Đã copy', 'Copied', '已复制', 'コピーしました', '복사됨'), description: tr('Link đã được sao chép.', 'Link copied.', '链接已复制。', 'リンクをコピーしました。', '링크가 복사되었습니다.'), duration: 2000 })
  }, [screenShareLiveUrl, toast, tr])

  const openTeacherView = useCallback(() => {
    if (typeof window === 'undefined') return
    // Ưu tiên window name cố định để browser xử lý focus ổn định hơn.
    try {
      const namedRef = window.open('', 'nanoai-teacher-view')
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
      else if (t === 'set-auto-play' && typeof e.data?.value === 'boolean') setAutoPlay(e.data.value)
      else if (t === 'set-auto-play-interval' && typeof e.data?.ms === 'number') setAutoPlayIntervalMs(e.data.ms)
      else if (
        t === 'student-curriculum-right-mode' &&
        (e.data?.mode === 'markdown-all' || e.data?.mode === 'single-slide')
      ) {
        if (!isTeacherView && !worksheetPresentation) setStudentCurriculumRightMode(e.data.mode)
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
        openVisualFullscreen(cellIndex, true)
      }
      else if (t === 'visual-fullscreen-close') {
        const sinceLocalOpen = Date.now() - lastLocalVisualOpenRef.current
        if (sinceLocalOpen < 800) return
        closeVisualFullscreenRef.current({ fromMessage: true })
      }
      else if (t === 'mouse-pos' && presentationMode === 'slide-interaction') {
        let px: number
        let py: number
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
        } else if (e.data?.visualFrame && e.data?.imageCenter && typeof e.data?.cellIndex === 'number' && typeof e.data?.dxFromCenter === 'number' && typeof e.data?.dyFromCenter === 'number' && typeof e.data?.visW === 'number' && typeof e.data?.visH === 'number' && studentVisualFrameRef.current && visualFullscreenOpen) {
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
        } else if (e.data?.visualFrame && typeof e.data?.relX === 'number' && typeof e.data?.relY === 'number' && visualFullscreenOpen) {
          const overlayOrFrame = e.data?.overlayRel && fullscreenOverlayRef.current ? fullscreenOverlayRef.current : studentVisualFrameRef.current
          const rect = overlayOrFrame ? overlayOrFrame.getBoundingClientRect() : null
          if (rect) {
            px = rect.left + e.data.relX * rect.width
            py = rect.top + e.data.relY * rect.height
          } else return
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
        } else if (e.data?.visualFrame && e.data?.imageCenter && typeof e.data?.cellIndex === 'number' && typeof e.data?.dxFromCenter === 'number' && typeof e.data?.dyFromCenter === 'number' && typeof e.data?.visW === 'number' && typeof e.data?.visH === 'number' && studentVisualFrameRef.current && visualFullscreenOpen) {
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
        } else if (e.data?.visualFrame && typeof e.data?.relX === 'number' && typeof e.data?.relY === 'number' && visualFullscreenOpen) {
          const overlayOrFrame = e.data?.overlayRel && fullscreenOverlayRef.current ? fullscreenOverlayRef.current : studentVisualFrameRef.current
          const rect = overlayOrFrame ? overlayOrFrame.getBoundingClientRect() : null
          if (rect) {
            px = rect.left + e.data.relX * rect.width
            py = rect.top + e.data.relY * rect.height
          } else return
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
            // getDisplayMedia chỉ chạy sau thao tác người dùng thật — .click() tổng hợp không đủ.
            if (ctrl === 'chia-sẻ-màn-hình-live') {
              if (isScreenShareLiveActiveRef.current) {
                stopScreenShareLiveRef.current()
                setScreenShareLiveDialogOpen(false)
              } else {
                setScreenShareLiveGestureGateOpen(true)
              }
              return
            }
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
  }, [onSlidesSaved, openVisualFullscreen, closeVisualFullscreen, presentationMode, visualFullscreenOpen, presentationBroadcastChannelName, isTeacherView, worksheetPresentation])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(presentationBroadcastChannelName)
    channel.postMessage({ type: 'request-curriculum' })
    return () => channel.close()
  }, [onSlidesSaved, openVisualFullscreen, closeVisualFullscreen, presentationMode, visualFullscreenOpen, presentationBroadcastChannelName])

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
    const onMove = (e: MouseEvent) => {
      const now = Date.now()
      if (now - mouseThrottleRef.current < 40) return
      mouseThrottleRef.current = now
      const rect = getQuizPopupRect()
      if (rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        const relX = rect.right - e.clientX
        const relY = e.clientY - rect.top
        try {
          ;(target as Window).postMessage({ type: 'mouse-pos', quizPopup: true, relX, relY, fromStudent: true }, window.location.origin)
        } catch {
          /* ignore */
        }
        return
      }
      const x = e.clientX / (window.innerWidth || 1)
      const y = e.clientY / (window.innerHeight || 1)
      try {
        ;(target as Window).postMessage({ type: 'mouse-pos', x, y }, window.location.origin)
      } catch {
        /* ignore */
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
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('mousemove', onMove)
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

  const baseSlidesForDisplay =
    slideMode === 'personal' && personalViewSubMode === 'original' && originalSlides && originalSlides.length > 0
      ? getBaseSlides(curriculumMarkdown, topic, originalSlides)
      : getBaseSlides(curriculumMarkdown, topic, aiSlides)

  useEffect(() => {
    const nextSlides = baseSlidesForDisplay
    setSlides(nextSlides)
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
      return Math.min(prev, nextSlides.length - 1)
    })
  }, [curriculumMarkdown, topic, aiSlides, slideMode, personalViewSubMode, originalSlides, initialSlideIndex, isTeacherView])

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
      if (slideMode === 'personal' || slideMode === 'original') {
        const r = await saveUserCustomizedSlides({ curriculumId, slides: payload })
        if (r?.error) toast({ title: tr('Lỗi lưu', 'Save error', '保存错误', '保存エラー', '저장 오류'), description: r.error, variant: 'destructive' })
        else { toast({ title: tr('Đã lưu', 'Saved', '已保存', '保存しました', '저장됨'), duration: 1500 }); onSlidesSaved?.() }
      } else if (slideMode === 'shared' || !slideMode) {
        const r = await saveSlidesToCurriculum({ curriculumId, topic: topic || 'Bài giảng', subjectId: subjectId ?? 'toan', gradeLevelId: gradeLevelId ?? 'lop-6', slides: payload })
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
    setVisualFullscreenOpen(false)
  }, [currentIndex])

  const slide = slides[currentIndex]
  const rawBlocks = (Array.isArray(slide?.blocks) && slide.blocks.length > 0) ? slide.blocks : (slide ? parseContentToBlocks(slide.content ?? '') : [])
  const blocks =
    rawBlocks.length > 0 && rawBlocks.every((b) => !(b.content ?? '').trim()) && (slide?.content ?? '').trim()
      ? parseContentToBlocks(slide!.content ?? '')
      : rawBlocks
  const hasBlocks = blocks.length > 0
  const visualPaneMeta = slide ? getVisualCells(slide) : { layout: 1 as 1 | 2 | 4, cells: [] as VisualCell[] }
  const visualLayout = visualPaneMeta.layout
  const visualCells = visualPaneMeta.cells
  const visualHasAnyContent = visualCells.some((c) => c.visualEmbed || c.imageUrl)
  const visualGridClass = visualLayout === 2 ? 'grid grid-rows-2 gap-1' : visualLayout === 4 ? 'grid grid-cols-2 grid-rows-2 gap-1' : ''
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
    if (slides.length === 0) return
    const id = `nano-student-md-slide-${currentIndex}`
    const t = window.setTimeout(() => {
      const el = document.getElementById(id) as HTMLElement | null
      const container = studentMdRightColumnScrollRef.current
      if (el && container) {
        const cRect = container.getBoundingClientRect()
        const eRect = el.getBoundingClientRect()
        const elTopInContent = eRect.top - cRect.top + container.scrollTop
        // Đặt mép trên thẻ slide ~18% chiều cao vùng cuộn dưới mép trên (cao hơn block:center)
        const bias = Math.max(56, Math.round(container.clientHeight * 0.18))
        // Cuộn thêm để đưa slide lên ~100px (dễ nhìn từ xa)
        const extraScrollUpPx = 100
        const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight)
        const nextTop = Math.min(
          maxScroll,
          Math.max(0, elTopInContent - bias + extraScrollUpPx),
        )
        container.scrollTo({ top: nextTop, behavior: 'smooth' })
      } else {
        el?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' })
      }
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

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden">
      <div
        className={cn(
          'print:hidden overflow-hidden [direction:rtl] box-border pr-3 md:pr-0',
          presentationMode === 'slide-interaction' && 'border-b border-slate-700/80 bg-slate-900/80 backdrop-blur-sm',
          presentationMode === 'slide-interaction' && 'pointer-events-auto'
        )}
      >
        <div className="[direction:ltr] w-max">
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
            onScreenShareLiveClick={handleScreenShareLiveClick}
            onScreenShareLiveStop={() => { stopScreenShareLive(); setScreenShareLiveDialogOpen(false) }}
            isScreenShareLiveActive={isScreenShareLiveActive}
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
      {presentationMode === 'slide-interaction' && typeof document !== 'undefined' && createPortal(
        <>
          {mouseTrail.length > 1 && (
            <svg className="fixed inset-0 z-[198] pointer-events-none" style={{ width: '100%', height: '100%' }}>
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
              className="fixed z-[200] pointer-events-none transition-all duration-75"
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
      <Dialog open={screenShareLiveGestureGateOpen} onOpenChange={setScreenShareLiveGestureGateOpen}>
        <DialogContent className="sm:max-w-md z-[210]">
          <DialogHeader>
            <DialogTitle>
              {tr(
                'Xác nhận chia sẻ màn hình',
                'Confirm screen sharing',
                '确认共享屏幕',
                '画面共有の確認',
                '화면 공유 확인'
              )}
            </DialogTitle>
            <DialogDescription>
              {tr(
                'Giáo viên điều khiển từ xa đã bấm «Chia sẻ màn hình». Trình duyệt bắt buộc bạn bấm xác nhận một lần trên máy này để chọn cửa sổ/tab chia sẻ.',
                'Your teacher started screen share remotely. The browser requires you to confirm once on this device to pick what to share.',
                '教师已远程触发“共享屏幕”。浏览器要求您在本机点击一次以选择要共享的窗口/标签页。',
                '教師がリモートで画面共有を開始しました。ブラウザの仕様上、この端末で一度確認して共有する画面を選んでください。',
                '교사가 원격으로 화면 공유를 시작했습니다. 브라우저 정책상 이 기기에서 한 번 확인을 눌러 공유할 화면을 선택해야 합니다.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setScreenShareLiveGestureGateOpen(false)}>
              {tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}
            </Button>
            <Button type="button" data-control="chia-sẻ-màn-hình-live-confirm" onClick={confirmScreenShareLiveAfterGestureGate}>
              {tr('Chọn màn hình và chia sẻ', 'Choose screen and share', '选择屏幕并共享', '画面を選んで共有', '화면 선택 후 공유')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={screenShareLiveDialogOpen} onOpenChange={(open) => { setScreenShareLiveDialogOpen(open); if (!open) screenShareLiveInProgressRef.current = false }}>
        <DialogContent className="sm:max-w-md z-[200]">
          <DialogHeader>
            <DialogTitle>{tr('Chia sẻ màn hình livestream', 'Share screen livestream', '共享屏幕直播', '画面共有ライブ', '화면 공유 라이브')}</DialogTitle>
            <DialogDescription>
              {isScreenShareLiveActive
                ? tr('Chia sẻ link hoặc quét QR để người khác xem màn hình bạn trực tiếp.', 'Share link or scan QR for others to view your screen live.', '分享链接或扫码让他人实时观看您的屏幕。', 'リンク共有またはQRスキャンで他人があなたの画面をリアルタイム表示。', '링크 공유 또는 QR 스캔으로 다른 사람이 화면 실시간 보기.')
                : tr('Đang bắt đầu... Chọn màn hình/tab để chia sẻ.', 'Starting... Select screen/tab to share.', '正在启动... 选择要共享的屏幕/标签页。', '開始中... 共有する画面/タブを選択。', '시작 중... 공유할 화면/탭 선택.')}
            </DialogDescription>
          </DialogHeader>
          {!isScreenShareLiveActive && (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            </div>
          )}
          {isScreenShareLiveActive && screenShareLiveUrl && (
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {screenShareLiveQrUrl && (
                <div className="flex-shrink-0 p-2 bg-white rounded-lg">
                  <img src={screenShareLiveQrUrl} alt="QR" className="w-40 h-40" />
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{tr('Link xem màn hình trực tiếp', 'View screen live link', '实时观看屏幕链接', '画面ライブ表示リンク', '화면 실시간 보기 링크')}</span>
                </div>
                <div className="flex gap-2">
                  <Input readOnly value={screenShareLiveUrl} className="text-sm font-mono" />
                  <Button variant="outline" size="icon" onClick={copyScreenShareLiveLink} title={tr('Copy link', 'Copy link', '复制链接', 'リンクをコピー', '링크 복사')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {tr('Mã', 'Code', '码', 'コード', '코드')}: <strong>{screenShareLiveCode}</strong>
                </p>
                <Button variant="destructive" size="sm" onClick={() => { stopScreenShareLive(); setScreenShareLiveDialogOpen(false) }} className="mt-2">
                  {tr('Dừng chia sẻ', 'Stop sharing', '停止共享', '共有停止', '공유 중지')}
                </Button>
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
        const { layout, cells } = getVisualCells(slide)
        const hasAny = cells.some((c) => c.visualEmbed || c.imageUrl)
        if (!hasAny) return null
        const showSingleCell = expandedCellIndex != null && layout > 1
        const displayCells = showSingleCell && cells[expandedCellIndex] ? [cells[expandedCellIndex]] : cells
        const displayIndices = showSingleCell && expandedCellIndex != null ? [expandedCellIndex] : cells.map((_, i) => i)
        const gridClass = !showSingleCell && layout === 2 ? 'grid grid-rows-2 gap-2' : !showSingleCell && layout === 4 ? 'grid grid-cols-2 grid-rows-2 gap-2' : ''
        const renderCell = (cell: { visualEmbed?: string; imageUrl?: string }, idx: number, label: string) => {
          const cellKey = `${currentIndex}-${displayIndices[idx] ?? idx}`
          return (
          <div key={cellKey} className="flex-1 min-h-0 relative rounded-xl overflow-hidden bg-black/30 border border-white/10" onClick={(e) => e.stopPropagation()}>
            <span className="absolute top-2 left-2 z-10 px-2 py-1 rounded bg-black/60 text-white text-sm font-mono pointer-events-none">{label}</span>
            {cell.visualEmbed ? (
              (() => {
                const embeds = parseContentEmbeds(cell.visualEmbed)
                const first = embeds[0]
                if (!first) return <div className="w-full h-full" />
                return (
                  <div className="w-full h-full" key={`nano-fs-vis-${cellKey}-${first.type}-${first.urlOrId.slice(0, 80)}`}>
                    <ContentEmbed type={first.type} urlOrId={first.urlOrId} tr={tr} hideQuiz fill className="!my-0 !rounded-xl !border-0" />
                  </div>
                )
              })()
            ) : cell.imageUrl ? (
              <img key={`nano-fs-img-${cellKey}`} src={cell.imageUrl} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-white/5" />
            )}
          </div>
          )
        }
        return (
          <div
            ref={fullscreenOverlayRef}
            className="fixed inset-0 z-[105] bg-black flex flex-col outline-none"
            onClick={(e) => { if (e.target === e.currentTarget) closeVisualFullscreen() }}
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
            <div className="flex-1 min-h-0 relative px-4 pb-4 pt-14 flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div ref={studentVisualFrameRef} className={cn('flex-1 min-h-0 overflow-hidden', showSingleCell || layout === 1 ? 'flex flex-col' : gridClass)}>
              {displayCells.map((cell, i) => renderCell(cell, i, `${currentIndex + 1}-${displayIndices[i] + 1}`))}
              </div>
            </div>
          </div>
        )
      })()}
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
          className="shrink-0 flex min-h-0 h-full flex-row flex-nowrap"
          style={{ width: stableLayoutWidth, minWidth: Math.max(stableLayoutWidth, 1200) }}
        >
        {/* Visual: luôn giữ 45% chiều rộng, không co */}
        <div className="w-[45%] min-h-0 relative overflow-hidden shrink-0" style={{ background: gradient }}>
          <div className="absolute top-2 left-2 md:top-4 md:left-4 landscape:top-4 landscape:left-4 w-8 h-8 md:w-9 md:h-9 landscape:w-9 landscape:h-9 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-xs md:text-sm landscape:text-sm shadow-lg z-10">
            {currentIndex + 1}
          </div>
          {visualHasAnyContent && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); openVisualFullscreen() }}
              onClick={() => openVisualFullscreen()}
              className="absolute top-2 right-2 z-20 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-black/60 p-2 text-white opacity-60 shadow-lg hover:bg-black/80 hover:opacity-100 md:top-4 md:right-10 md:min-h-0 md:min-w-0 md:p-1.5 landscape:top-4 landscape:right-10 landscape:min-h-0 landscape:min-w-0 landscape:p-1.5 print:hidden"
              title={tr('Mở rộng tất cả', 'Expand all', '展开全部', 'すべて展開', '모두 확장')}
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
          {isTeacherView && autoGeoSuggestion && (
            <div className="absolute top-2 right-14 z-10 flex items-center gap-1.5 md:top-4 md:right-20 landscape:top-4 landscape:right-20">
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); openAutoGeoGebra() }}
                onClick={(e) => { e.stopPropagation(); openAutoGeoGebra() }}
                className="flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white hover:bg-black/80 md:text-xs"
                title={tr('Chỉnh trong GeoGebra', 'Edit in GeoGebra', '在GeoGebra中编辑', 'GeoGebraで編集', 'GeoGebra에서 편집')}
              >
                <ExternalLink className="h-3 w-3" />
                {tr('GeoGebra', 'GeoGebra', 'GeoGebra', 'GeoGebra', 'GeoGebra')}
              </button>
            </div>
          )}
          <div
            className={cn(
              'absolute inset-0 px-2 pb-2 pt-12 md:px-4 md:pb-4 md:pt-14 landscape:px-4 landscape:pb-4 landscape:pt-14',
              visualLayout === 1 ? 'flex flex-col' : visualGridClass
            )}
          >
              {visualLayout === 1 ? (
                <div key={`nano-vis-pane-${currentIndex}`} className="relative flex-1 min-h-0 overflow-hidden rounded-lg border border-white/10 bg-black/30">
                  <span className="absolute left-1 top-1 z-10 rounded bg-black/60 px-1.5 py-0.5 font-mono text-xs text-white">
                    {currentIndex + 1}-1
                  </span>
                  {visualCells[0]?.visualEmbed ? (
                    (() => {
                      const embeds = parseContentEmbeds(visualCells[0].visualEmbed)
                      const first = embeds[0]
                      if (!first) return <div className="h-full w-full" />
                      return (
                        <div className="h-full w-full" key={`nano-vis-${currentIndex}-0-${first.type}-${first.urlOrId.slice(0, 80)}`}>
                          <ContentEmbed type={first.type} urlOrId={first.urlOrId} tr={tr} hideQuiz fill className="!my-0 !rounded-lg !border-0" />
                        </div>
                      )
                    })()
                  ) : visualCells[0]?.imageUrl ? (
                    <img
                      key={`nano-vis-img-${currentIndex}-0`}
                      src={visualCells[0].imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <div className="h-8 w-8 rounded bg-white/5" />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {visualCells.map((cell, idx) => (
                    <div key={`${currentIndex}-${idx}`} className="group relative min-h-0 overflow-hidden rounded-lg border border-white/10 bg-black/30">
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
                            e.stopPropagation()
                            openVisualFullscreen(idx)
                          }}
                          className="absolute right-1 top-1 z-10 rounded bg-black/60 p-1 text-white opacity-50 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                          title={tr('Mở rộng ô này', 'Expand this cell', '展开此格', 'このセルを展開', '이 셀 확장')}
                        >
                          <Maximize2 className="h-3 w-3" />
                        </button>
                      )}
                      {cell.visualEmbed ? (
                        (() => {
                          const embeds = parseContentEmbeds(cell.visualEmbed)
                          const first = embeds[0]
                          if (!first) return <div className="h-full w-full" />
                          return (
                            <div className="h-full w-full" key={`nano-vis-${currentIndex}-${idx}-${first.type}-${first.urlOrId.slice(0, 80)}`}>
                              <ContentEmbed type={first.type} urlOrId={first.urlOrId} tr={tr} hideQuiz fill className="!my-0 !rounded-lg !border-0" />
                            </div>
                          )
                        })()
                      ) : cell.imageUrl ? (
                        <img
                          key={`nano-vis-img-${currentIndex}-${idx}`}
                          src={cell.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
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
        </div>

        {/* Content: luôn giữ 55% — thanh chế độ HS nằm sát dưới header (cùng băng với vùng pt-12/pt-14 bên visual) */}
        <div className="flex min-h-0 w-[55%] shrink-0 flex-col bg-white">
          {!isTeacherView && !worksheetPresentation && slides.length > 0 && (
            <div
              className="flex h-12 shrink-0 items-center border-b border-slate-200 bg-white px-3 shadow-sm print:hidden md:h-14 md:px-6 lg:px-8 landscape:px-6"
              data-control="student-curriculum-mode"
            >
              <div className="ml-[50px] flex shrink-0 items-center gap-2 md:gap-2.5">
              <button
                type="button"
                data-control="student-curriculum-all"
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
            className="min-h-0 flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 landscape:p-8"
          >
          {!isTeacherView && !worksheetPresentation && studentCurriculumRightMode === 'markdown-all' && slides.length > 0 ? (
            <div ref={studentMarkdownAllScrollRef} className="space-y-6 pb-6 text-left">
              {(() => {
                const mdAllStudentCurriculum =
                  !isTeacherView && !worksheetPresentation && studentCurriculumRightMode === 'markdown-all'
                /** Chuỗi slide (HS): chỉ hiện các slide đã tới — không render slide phía sau (danh sách theo tiến độ). */
                const mdAllSlidesToShow = mdAllStudentCurriculum ? slides.slice(0, currentIndex + 1) : slides
                /** Slide hiện tại: chỉ khi còn gõ segment đáp án (đồng bộ GV). */
                const mdChainLiveTyping =
                  mdAllStudentCurriculum && isCurrent && hasSegmentTypingWork && !segmentTypingCompleted
                return mdAllSlidesToShow.map((s, si) => {
                const rawBlks =
                  Array.isArray(s.blocks) && s.blocks.length > 0 ? s.blocks : s.content ? parseContentToBlocks(s.content ?? '') : []
                const blksForSlide =
                  rawBlks.length > 0 && rawBlks.every((b) => !(b.content ?? '').trim()) && (s.content ?? '').trim()
                    ? parseContentToBlocks(s.content ?? '')
                    : rawBlks
                const isCurrent = si === currentIndex

                const renderFullSlideBody = () =>
                  blksForSlide.length > 0 ? (
                    <div className="space-y-4">
                      {blksForSlide.map((b, bi) => {
                        const bExt = b as { studentAnswerHidden?: boolean }
                        if (!isTeacherView && bExt.studentAnswerHidden) return null
                        return (
                          <div key={bi} className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
                            {b.header ? (
                              <div className="mb-2 text-xs font-bold text-violet-800">{b.header}</div>
                            ) : null}
                            <div className="text-slate-800">
                              <CurriculumBlockContentWithEmbeds
                                content={b.content ?? ''}
                                liveQuizContext={curriculumId ? { curriculumId, slideIndex: si, blockIndex: bi } : undefined}
                                tr={tr}
                                hideQuiz
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (s.content ?? '').trim() ? (
                    <CurriculumBlockContentWithEmbeds
                      content={s.content ?? ''}
                      liveQuizContext={curriculumId ? { curriculumId, slideIndex: si, blockIndex: 0 } : undefined}
                      tr={tr}
                      hideQuiz
                    />
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
                    {mdChainLiveTyping && isCurrent ? renderCurrentSlideTypingBody() : renderFullSlideBody()}
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
                      !isTeacherView && !worksheetPresentation && !!curriculumId ? 'mt-[41px]' : 'mt-[31px]'
                    )}
                  >
                    <ClipboardList className="mr-1.5 h-4 w-4" />
                    {tr('Xem câu hỏi trắc nghiệm', 'View quiz', '查看测验', 'クイズを見る', '퀴즈 보기')}
                  </Button>
                ) : null}
              </div>
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
                    return (
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
                        {worksheetOrCurriculumSegmentBlock ? (
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
              ) : slide.content ? (
                <div className="text-slate-700 text-base md:text-lg leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2">
                  <CurriculumBlockContentWithEmbeds
                    content={slide.content}
                    liveQuizContext={curriculumId ? { curriculumId, slideIndex: currentIndex, blockIndex: 0 } : undefined}
                    tr={tr}
                    hideQuiz
                  />
                </div>
              ) : null}
            </>
          )}
          {/* Ghi chú chỉ sửa trong cửa sổ Giáo trình – không hiển thị trên slide cho học sinh */}
          </div>
        </div>
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
