'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import { RotateCcw, LayoutGrid, Square, Sparkles, Edit3, Plus, Save, FileText, FileEdit, History, Maximize2, X, ClipboardList, Flag, Presentation, MoreVertical, Trash2, Eye, EyeOff, Keyboard, KeyboardOff, Pause, Play, Target, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { canSplitBlockAtQuiz, splitContentWithEmbeds, splitBlockContentAtQuizBoundary, parseQuizData, parseContentEmbeds, ContentEmbed, type EmbedType } from '../components/content-embed'
import { parseContentToBlocks } from '../lib/curriculum-to-slides'
import { parseWorksheetToSlides, questionsToSlides } from '@/lib/worksheet-to-slides'
import { latexToReadable } from '../lib/latex-to-readable'
import { SlideProposalDialog } from '../components/slide-proposal-dialog'
import { SlideProposalVote } from '../components/slide-proposal-vote'
import { PersonalHistorySheet } from '../components/personal-history-sheet'
import { SlideEditHistorySheet } from '../components/slide-edit-history-sheet'
import { PresentationControlBar } from '../components/presentation-control-bar'
import { AnimatedCharReveal } from '../components/animated-char-reveal'
import { WorksheetAnswerTypedBody } from '../components/worksheet-answer-typed-body'
import { POINTER_PROSE_ROOT_ATTR, SLIDE_SYNC_MARKDOWN_CLASS } from '../components/slide-sync-markdown-classes'
import { AnswerTypingPositionPopover } from '../components/answer-typing-position-popover'
import {
  curriculumSlideTitleRevealKey,
  distributeGlobalRevealAcrossSlide,
  findFirstSequentialSolutionBlockIndex,
  globalRevealedSegmentsOnSlide,
  slideSolutionSegmentsGlobalTotal,
  typableSolutionBlockIndices,
  worksheetAnswerSegmentCount,
} from '@/app/tao-giao-trinh/lib/worksheet-answer-segments'
import { getOrCreatePresentationSyncId, getPresentationBroadcastChannelName } from '../lib/presentation-broadcast'
import { getStudentSlideWindowConfig, isPathMatchingStudentSlideKind, studentSlideUrlWithSync } from '../lib/student-slide-window'
import { TEACHER_SLIDE_WINDOW_TARGET_NAME } from '@/lib/tao-giao-trinh/teacher-slide-window'
import { QuizPopupDialog } from '../components/quiz-popup-dialog'
import { getSlideProposalsForCurriculum, resetPersonalToOriginal, saveSlidesToCurriculum, saveUserCustomizedSlides, saveWorksheetContent } from '../actions'
import { parseWorksheetIntoBlocks, replaceBlockInMarkdown } from '../lib/worksheet-parse-questions'
import { resolveWorksheetEditBlockGlobalIndex } from '../lib/worksheet-slide-to-block-index'
import { toEditableBlockContent } from '../lib/worksheet-editable-block-content'
import { WorksheetEditSectionPopup } from '../components/worksheet-edit-section-popup'
import { CURRICULUM_UI_CREDITS, formatCurriculumCredits } from '../lib/curriculum-credit-costs'
import { getInfographicStrokeBucketKey, type SlideInfographic } from '../lib/slide-infographic'
import {
  applyInfographicToDefaultVisualCells,
  skipInfographicDefaultSwapCurriculumPage,
  visualImageIsCurriculumInfographic,
} from '../lib/default-visual-image'
import { getEssayProblem, getEssaySolution, normalizeSolutionToStr } from '../lib/worksheet-content-json'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { getCurriculumSlidesByLessonCachedAction, saveCurriculumLessonInfographicAction } from '../lesson-actions'

const TEACHER_CURRICULUM_RUNTIME_CACHE_KEY = 'tao-giao-trinh:teacher-curriculum-runtime:v1'

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
  visualInput1?: string
  visualInput2?: string
  visualInput3?: string
  visualInput4?: string
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

const INFOGRAPHIC_DRAW_COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#ffffff'] as const
const INFOGRAPHIC_MAX_STROKES = 240
const INFOGRAPHIC_MAX_POINTS_PER_STROKE = 2500
const INFOGRAPHIC_MAX_TOTAL_POINTS = 90000
const INFOGRAPHIC_MAX_CANVAS_PIXELS = 2_400_000
const STUDENT_WIRE_SLIDE_CHUNK_SIZE = 2
const STUDENT_WIRE_SLIDE_CHUNK_RADIUS = 0

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

function clamp01(n: number): number {
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

function densifyStrokePoints(last: InfographicDrawPoint, next: InfographicDrawPoint): InfographicDrawPoint[] {
  const dx = next.u - last.u
  const dy = next.v - last.v
  const dist = Math.hypot(dx, dy)
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
  // Với dữ liệu nhập tay ở 4 ô, chỉ lấy miền xác định từ chính các ô này
  // để tránh nội dung mô tả trong slide làm "lọc miền" sai khi vẽ realtime.
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
  const source = `${slide.title}\n${slide.content ?? ''}\n${(slide.blocks ?? []).map((b) => `${b.header ?? ''}\n${b.content ?? ''}`).join('\n')}\n${getSlideVisualInputs(slide).join('\n')}`
  const candidates: string[] = []
  const pushMatches = (re: RegExp) => {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(source)) !== null) {
      const part = String(m?.[1] ?? '').trim()
      if (part) candidates.push(part)
      if (!re.global) break
    }
  }

  // Ưu tiên dạng hàm đầy đủ như s(t)=..., f(x)=...
  pushMatches(/\b[a-zA-Z]\s*\(\s*[xt]\s*\)\s*=\s*([^\n]{2,180})/gi)
  pushMatches(/y\s*=\s*f\s*\(\s*[xt]\s*\)\s*=\s*([^\n]{2,180})/gi)
  pushMatches(/y\s*=\s*([^\n]{2,180})/gi)

  const scored = candidates
    .map((raw) => normalizePlotExprCandidate(raw))
    .filter((v): v is string => !!v)
    .map((expr) => {
      let score = Math.min(expr.length, 80)
      if (/[+\-*/]/.test(expr)) score += 20
      if (/\^/.test(expr)) score += 14
      if (/\d/.test(expr)) score += 8
      if (/\(/.test(expr)) score += 4
      return { expr, score }
    })
    .sort((a, b) => b.score - a.score)

  return scored[0]?.expr ?? null
}

function normalizePlotExprCandidate(raw: string): string | null {
  const rawTrim = String(raw || '').trim()
  // Chỉ cho phép parse khi input có dạng công thức rõ ràng:
  // - y=..., f(x)=..., s(t)=...
  // - hoặc bắt đầu trực tiếp bằng ký hiệu toán (x, t, số, (, |, +, -)
  if (!/^(?:y\s*=|[a-zA-Z]\s*\(\s*[xt]\s*\)\s*=|[xXtT0-9(|+\-])/i.test(rawTrim)) return null

  let s = String(raw || '')
    .replace(/^\s*y\s*=\s*f\s*\(\s*[xt]\s*\)\s*=\s*/i, '')
    .replace(/^\s*(?:y|[a-zA-Z]\s*\(\s*[xt]\s*\))\s*=\s*/i, '')
    // Bỏ miền xác định gắn cuối biểu thức, ví dụ: (t >= 0), (x ≤ 2)
    .replace(/\(\s*[xXtT]\s*(?:>=|<=|>|<|≥|≤)\s*[-+]?\d+(?:[.,]\d+)?\s*\)\s*$/u, '')
    .replace(/\(\s*(hình|hinh|figure|fig)\b[^)]*\)/gi, '')
    .replace(/\.\s*[A-Za-z\u00C0-\u024F].*$/u, '')
    // Cắt phần mô tả tiếng Việt/Anh ở cuối (tránh "trên" -> t bị nhận thành biến),
    // nhưng KHÔNG cắt các biểu thức ngắn kiểu "- x".
    .replace(/\s+[a-zA-Z\u00C0-\u024F]{2,}[a-zA-Z0-9\u00C0-\u024F\s,;:.\-()]*$/u, '')
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
  const leadingMath = s.match(/^[0-9xXtT+\-*/^().|√π]+/)?.[0] ?? ''
  s = leadingMath.replace(/(?<![A-Za-z])[tT](?![A-Za-z])/g, 'x')
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

  // Ví dụ: "(-∞; 0)" -> x<0, "(1; +∞)" -> x>1
  const intervalLeftInfinite = source.match(/\(\s*-\s*∞\s*[;,]\s*([+-]?\d+(?:[.,]\d+)?)\s*\)/i)
  if (intervalLeftInfinite?.[1]) return `x<${intervalLeftInfinite[1].replace(',', '.')}`
  const intervalRightInfinite = source.match(/\(\s*([+-]?\d+(?:[.,]\d+)?)\s*[;,]\s*\+?\s*∞\s*\)/i)
  if (intervalRightInfinite?.[1]) return `x>${intervalRightInfinite[1].replace(',', '.')}`

  return null
}

function toUnicodeMathExpression(expr: string): string {
  const superscriptMap: Record<string, string> = {
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
    '-': '⁻',
  }
  let out = String(expr || '').replace(/\^(-?\d+)/g, (_, p1: string) => {
    const sup = p1.split('').map((ch) => superscriptMap[ch] ?? ch).join('')
    return sup
  })
  out = out
    .replace(/\*/g, '·')
    .replace(/\+/g, ' + ')
    .replace(/-/g, ' - ')
    .replace(/=/g, ' = ')
    .replace(/\s+/g, ' ')
    .trim()
  return out
}

function detectDomainConstraintFromSlide(slide: SlideItem): string | null {
  const source = `${slide.title}\n${slide.content ?? ''}\n${(slide.blocks ?? []).map((b) => `${b.header ?? ''}\n${b.content ?? ''}`).join('\n')}\n${getSlideVisualInputs(slide).join('\n')}`
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

function getAutoGeoGebraSuggestion(slide: SlideItem): { marker: string } | null {
  const inputCells = getVisualCellsFromInputs(slide)
  if (inputCells?.cells[0]?.visualEmbed) return { marker: inputCells.cells[0].visualEmbed }
  const expr = extractPlotExpressionFromSlide(slide)
  if (!expr) return null
  const domain = detectDomainConstraintFromSlide(slide)
  const url = buildGeoGebraUrl(expr, domain)
  return { marker: `[geogebra:${url}]` }
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

function isVisualInputTemplateText(value: string): boolean {
  const v = String(value || '').trim().toLowerCase()
  if (!v) return true
  if (/^(?:(?:ô|o|0|field)\s*)?[1-4]\s*:/.test(v)) {
    return true
  }
  if (/^y\s*=\s*x(?:\^?2|²)?$/.test(v)) return true
  if (/^y\s*=\s*f\(\s*x\s*\)$/.test(v)) return true
  if (/^y\s*=\s*g\(\s*x\s*\)$/.test(v)) return true
  if (/^x\s*(>=|>|<=|<)\s*0$/.test(v)) return true
  return false
}

function hasMeaningfulVisualInputs(slide: SlideItem | undefined | null): boolean {
  if (!slide) return false
  return [slide.visualInput1, slide.visualInput2, slide.visualInput3, slide.visualInput4]
    .some((v) => !isVisualInputTemplateText(String(v ?? '')))
}

function normalizeSlideVisualInputs(slide: SlideItem): SlideItem {
  const sanitize = (v: unknown): string => {
    const text = String(v ?? '').trim()
    if (isVisualInputTemplateText(text)) return ''
    return text
  }
  return {
    ...slide,
    visualInput1: sanitize(slide.visualInput1),
    visualInput2: sanitize(slide.visualInput2),
    visualInput3: sanitize(slide.visualInput3),
    visualInput4: sanitize(slide.visualInput4),
  }
}

function getVisualCells(slide: SlideItem): { layout: 1 | 2 | 4; cells: VisualCell[] } {
  const fromInputs = getVisualCellsFromInputs(slide)
  if (fromInputs) return fromInputs
  const layout = slide.visualLayout ?? 1
  const numCells = layout === 1 ? 1 : layout === 2 ? 2 : 4
  const autoGeo = getAutoGeoGebraSuggestion(slide)
  if (slide.visualCells && slide.visualCells.length >= numCells) {
    const cells = slide.visualCells.slice(0, numCells)
    if (cells.some((c) => c.visualEmbed || c.imageUrl)) {
      return { layout, cells }
    }
  }
  if (slide.visualEmbed || slide.imageUrl) {
    const cell: VisualCell = slide.visualEmbed ? { visualEmbed: slide.visualEmbed } : { imageUrl: slide.imageUrl! }
    return { layout: 1, cells: [cell] }
  }
  const fromContent = getVisualCellsFromSlideContent(slide)
  if (fromContent) return fromContent
  if (autoGeo) {
    return { layout: 1, cells: [{ visualEmbed: autoGeo.marker }] }
  }
  return { layout, cells: Array.from({ length: numCells }, () => ({})) }
}

/** Tab Visual / fullscreen: thay ảnh stock mặc định bằng infographic — giữ embed & ô nhập GV. */
function getVisualCellsForPresentation(
  slide: SlideItem,
  curriculumInfographic: SlideInfographic | undefined | null,
  knownInfographicUrls?: ReadonlyArray<string | undefined | null>,
  preferInfographicImage = false,
): { layout: 1 | 2 | 4; cells: VisualCell[] } {
  const normalizeUrlForCompare = (raw: string): string => {
    const v = String(raw ?? '').trim()
    if (!v) return ''
    try {
      const u = new URL(v)
      return `${u.origin}${u.pathname}`.replace(/\/+$/, '').toLowerCase()
    } catch {
      return v.replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase()
    }
  }
  const urlMatchesAny = (candidate: string, list: string[]): boolean => {
    const c = String(candidate ?? '').trim()
    if (!c) return false
    if (list.includes(c)) return true
    const cNorm = normalizeUrlForCompare(c)
    if (!cNorm) return false
    return list.some((x) => normalizeUrlForCompare(x) === cNorm)
  }
  const raw = getVisualCells(slide)
  const infUrl = curriculumInfographic?.imageUrl
  if (preferInfographicImage && infUrl?.trim()) {
    return { layout: 1, cells: [{ imageUrl: infUrl.trim() }] }
  }
  const rawHasAnyVisual = raw.cells.some((c) => String(c.visualEmbed ?? '').trim() || String(c.imageUrl ?? '').trim())
  if (rawHasAnyVisual) {
    // Rule: slide has chart/visual -> always prefer its own visual content.
    return raw
  }
  if (!infUrl?.trim()) return raw
  const known = Array.from(new Set((knownInfographicUrls ?? []).map((u) => String(u ?? '').trim()).filter(Boolean)))
  const skip = known.length > 0 ? false : skipInfographicDefaultSwapCurriculumPage(slide)
  const swapped = applyInfographicToDefaultVisualCells(raw, infUrl, skip) as { layout: 1 | 2 | 4; cells: VisualCell[] }
  const normalized =
    known.length > 0
      ? swapped.cells.map((c) => {
          const imageUrl = String(c.imageUrl ?? '').trim()
          const embedRaw = String(c.visualEmbed ?? '').trim()
          const m = embedRaw.match(/^\[image:\s*(.+)\]$/i)
          const embedUrl = String(m?.[1] ?? '').trim()
          const shouldRemapImageUrl = !!imageUrl && urlMatchesAny(imageUrl, known)
          const shouldRemapEmbedImage = !!embedUrl && urlMatchesAny(embedUrl, known)
          if (!shouldRemapImageUrl && !shouldRemapEmbedImage) return c
          return {
            ...c,
            ...(shouldRemapImageUrl ? { imageUrl: infUrl.trim() } : {}),
            ...(shouldRemapEmbedImage ? { visualEmbed: `[image:${infUrl.trim()}]` } : {}),
          }
        })
      : swapped.cells
  const hasAnyVisual = normalized.some((c) => String(c.visualEmbed ?? '').trim() || String(c.imageUrl ?? '').trim())
  if (hasAnyVisual) return { layout: swapped.layout, cells: normalized }
  return { layout: 1, cells: [{ imageUrl: infUrl.trim() }] }
}

type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'
function getWebLocaleFromCookie(): UiLocale {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = readWebLocaleFromDocumentCookie()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

function slidePlainTextForInfographic(s: SlideItem): string {
  const parts: string[] = []
  if (s.title?.trim()) parts.push(s.title.trim())
  for (const b of s.blocks ?? []) {
    const h = (b.header ?? '').trim()
    const c = (b.content ?? '').trim()
    if (h || c) parts.push([h, c].filter(Boolean).join('\n'))
  }
  if (s.content?.trim()) parts.push(s.content.trim())
  return parts.join('\n\n')
}

/** Nội dung cả giáo trình — dùng tạo một infographic cho cả bài học */
function curriculumPlainTextForInfographic(slides: SlideItem[], lessonMarkdown: string, lessonTopic: string): string {
  const fromSlides = slides
    .map((s, i) => {
      const body = slidePlainTextForInfographic(s)
      if (!body.trim()) return ''
      return `--- Slide ${i + 1}: ${s.title || 'Slide'} ---\n${body}`
    })
    .filter(Boolean)
    .join('\n\n')
  const topicLine = lessonTopic.trim() ? `Chủ đề / bài: ${lessonTopic.trim()}\n\n` : ''
  const md = lessonMarkdown.trim()
  if (fromSlides.trim()) return `${topicLine}${fromSlides}`
  if (md) return `${topicLine}${md}`
  return topicLine.trim()
}

function getQuizCount(blocks: SlideItem['blocks']): number {
  return (Array.isArray(blocks) ? blocks : []).reduce((acc, b) => acc + (b.content?.match(/\[quiz:/g)?.length ?? 0), 0)
}

function LazyHeavyMount({
  children,
  minHeight = 140,
}: {
  children: React.ReactNode
  minHeight?: number
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [isVisible, setIsVisible] = useState(false)

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
      },
      {
        root: null,
        rootMargin: '220px 0px',
        threshold: 0.01,
      }
    )
    observer.observe(node)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [])

  return (
    <div ref={hostRef} className="w-full h-full">
      {isVisible ? (
        children
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

/** Giáo trình — mở từ Tạo giáo trình (`?t=`). Phiếu bài tập: `giao-vien-worksheet-page.tsx`. */
export default function CurriculumViewPage() {
  const searchParams = useSearchParams()
  const worksheetId = searchParams?.get('worksheetId')
  /** Một tab GV = một kênh BroadcastChannel riêng — tránh hai cửa sổ HS nhận lẫn dữ liệu. */
  const [presentationSyncId] = useState(() => getOrCreatePresentationSyncId('teacher-curriculum'))
  const [content, setContent] = useState('')
  const [fullCurriculumMarkdown, setFullCurriculumMarkdown] = useState('')
  const [topic, setTopic] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [slideTitles, setSlideTitles] = useState<string[]>([])
  const [slides, setSlides] = useState<SlideItem[]>([])
  /** Một ảnh infographic cho cả giáo trình (không gắn từng slide) */
  const [curriculumInfographic, setCurriculumInfographic] = useState<SlideInfographic | undefined>(undefined)
  const [lessonInfographic, setLessonInfographic] = useState<SlideInfographic | undefined>(undefined)
  const curriculumInfographicRef = useRef<SlideInfographic | undefined>(undefined)
  curriculumInfographicRef.current = curriculumInfographic
  const [teacherTimerSeconds, setTeacherTimerSeconds] = useState(0)
  const [teacherTimerRunning, setTeacherTimerRunning] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [notesDirty, setNotesDirty] = useState(false)
  const [visualInputsDirty, setVisualInputsDirty] = useState(false)
  const [slideViewMode, setSlideViewMode] = useState<'single' | 'triple'>('single')
  /** Điều khiển từ xa chế độ cột phải học sinh (một slide / cả khóa) — đồng bộ postMessage + curriculum-data */
  const [studentCurriculumRemoteMode, setStudentCurriculumRemoteMode] = useState<'single-slide' | 'markdown-all'>('single-slide')
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
  const [activeLessonNo, setActiveLessonNo] = useState<number | null>(null)
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
  const [saveAsPersonalLoading, setSaveAsPersonalLoading] = useState(false)
  const [personalHistoryOpen, setPersonalHistoryOpen] = useState(false)
  const [sharedHistoryOpen, setSharedHistoryOpen] = useState(false)
  const [worksheetLoading, setWorksheetLoading] = useState(false)
  /** Markdown phiếu (khớp API / lưu DB) — dùng map slide → block và popup sửa câu */
  const [worksheetMarkdownSource, setWorksheetMarkdownSource] = useState('')
  const [worksheetQuestionTypes, setWorksheetQuestionTypes] = useState<string[]>([])
  const [gvWorksheetEditFilter, setGvWorksheetEditFilter] = useState<'quiz' | 'essay' | null>(null)
  const [gvWorksheetEditBlockIndex, setGvWorksheetEditBlockIndex] = useState<number | null>(null)
  const [gvWorksheetEditBlockContent, setGvWorksheetEditBlockContent] = useState('')
  const [gvWorksheetEditImages, setGvWorksheetEditImages] = useState<File[]>([])
  const [gvWorksheetEditSaving, setGvWorksheetEditSaving] = useState(false)
  const [gvWorksheetEditCheckLoading, setGvWorksheetEditCheckLoading] = useState(false)
  const [gvWorksheetEditCheckResult, setGvWorksheetEditCheckResult] = useState<{
    issues: Array<{ field: string; location: string; issue: string; suggested: string }>
    correctedContent: string | null
  } | null>(null)
  const [leftPanelMode, setLeftPanelMode] = useState<'curriculum' | 'slide' | 'visual' | 'infographic'>('curriculum')
  const [infographicGenerating, setInfographicGenerating] = useState(false)
  const [lessonInfographicGenerating, setLessonInfographicGenerating] = useState(false)
  const runtimeHydratedRef = useRef(false)
  useEffect(() => {
    if (leftPanelMode === 'slide') setLeftPanelMode('curriculum')
  }, [leftPanelMode])
  const [visualFullscreenOpen, setVisualFullscreenOpen] = useState(false)
  const [infographicFullscreenOpen, setInfographicFullscreenOpen] = useState(false)
  const [teacherExpandedCellIndex, setTeacherExpandedCellIndex] = useState<number | null>(null)
  const [quizPopupOpen, setQuizPopupOpen] = useState(false)
  const [quizSessionData, setQuizSessionData] = useState<Record<string, { sessionCode: string; quizDurationSeconds: number }>>({})
  const [quizSessionSettings, setQuizSessionSettings] = useState<Record<string, { quizDurationSeconds: number; autoRevealOnTimerEnd: boolean }>>({})
  const [studentMousePos, setStudentMousePos] = useState<{ x: number; y: number } | null>(null)
  /** Phiếu bài tập: ẩn/hiện đáp án từng câu trên giao diện học sinh. Key: "slideIndex-blockIndex", default true */
  const [answerVisibility, setAnswerVisibility] = useState<Record<string, boolean>>({})
  /** Phiếu bài tập: tạm dừng / tiếp tục gõ (độc lập ẩn/hiện trên màn HS). Key: "slideIndex-blockIndex" */
  const [answerTypingPaused, setAnswerTypingPaused] = useState<Record<string, boolean>>({})
  /**
   * Bật/tắt hiệu ứng gõ segment (lời giải / nội dung block) — một lựa chọn cho cả phiên,
   * giữ khi chuyển slide.
   */
  const [answerTypingSegmentsGloballyEnabled, setAnswerTypingSegmentsGloballyEnabled] = useState(true)
  const answerTypingEnabled = useMemo(() => {
    if (!worksheetId && !curriculumId) return {} as Record<string, boolean>
    const m: Record<string, boolean> = {}
    slides.forEach((s, si) => {
      if (!worksheetId && curriculumId && worksheetAnswerSegmentCount(s.title ?? '') > 0) {
        m[curriculumSlideTitleRevealKey(si)] = answerTypingSegmentsGloballyEnabled
      }
      const blks = s.blocks ?? []
      blks.forEach((b, bi) => {
        const isAnswerBlock = Boolean((b as { isAnswer?: boolean }).isAnswer)
        const includeKey = worksheetId ? isAnswerBlock : !!curriculumId
        if (!includeKey) return
        m[`${si}-${bi}`] = answerTypingSegmentsGloballyEnabled
      })
    })
    return m
  }, [slides, worksheetId, curriculumId, answerTypingSegmentsGloballyEnabled])

  /** Tốc độ gõ segment nội dung (ms) — khác tốc độ "Viết" tiêu đề trên thanh */
  const [answerTypingSpeedMs, setAnswerTypingSpeedMs] = useState(55)
  /** Phiếu bài tập: số segment đã hiển thị cho học sinh (đồng bộ slide HS + màu trên GV). Key: "slideIndex-blockIndex" */
  const [answerRevealProgress, setAnswerRevealProgress] = useState<Record<string, number>>({})
  /** Giá trị pause mới nhất — effect đổi slide đọc qua ref (không deps `answerTypingPaused` để tránh reset tiến độ khi bấm Tạm dừng). */
  const answerTypingPausedRef = useRef<Record<string, boolean>>({})
  answerTypingPausedRef.current = answerTypingPaused

  /** Block lời giải đang tới lượt gõ (cùng logic interval) — chỉ block này hiện bút khi `reveal === 0`. */
  const sequentialSolutionLeaderBlockIndex = useMemo(() => {
    if (!(worksheetId || curriculumId)) return null
    const slide = slides[currentIndex]
    const blks = slide?.blocks
    if (!blks?.length) return null
    return findFirstSequentialSolutionBlockIndex(blks, currentIndex, {
      worksheetPresentation: !!worksheetId,
      hasCurriculumSegmentTyping: !!curriculumId,
      reveal: answerRevealProgress,
      typingEnabled: answerTypingEnabled,
      typingPaused: answerTypingPaused,
      answerVisibility,
      slideTitle: slide?.title ?? '',
    })
  }, [
    worksheetId,
    curriculumId,
    slides,
    currentIndex,
    answerRevealProgress,
    answerTypingEnabled,
    answerTypingPaused,
    answerVisibility,
  ])
  /** Slide đang mở dialog chỉnh tiến độ gõ (áp dụng cả slide, nhiều block). */
  const [answerRevealJumpPopoverSlideIndex, setAnswerRevealJumpPopoverSlideIndex] = useState<number | null>(null)
  const [answerRevealJumpDraft, setAnswerRevealJumpDraft] = useState(0)
  const pauseBeforeAnswerRevealPopoverRef = useRef<{ keys: string[]; snapshot: Record<string, boolean> } | null>(null)
  const answerRevealJumpAnchorRef = useRef<HTMLElement | null>(null)

  const answerRevealJumpOpts = useMemo(
    () => ({
      worksheetPresentation: !!worksheetId,
      hasCurriculumSegmentTyping: !!curriculumId,
    }),
    [worksheetId, curriculumId]
  )

  const answerRevealJumpSlideSegmentTotal = useMemo(() => {
    const si = answerRevealJumpPopoverSlideIndex
    if (si == null) return 0
    const blks = slides[si]?.blocks ?? []
    const slideRow = slides[si]
    return slideSolutionSegmentsGlobalTotal(blks, answerRevealJumpOpts, slideRow?.title ?? '')
  }, [answerRevealJumpPopoverSlideIndex, slides, answerRevealJumpOpts])

  const answerRevealJumpPreviewByBlock = useMemo(() => {
    if (answerRevealJumpPopoverSlideIndex == null) return null
    const blks = slides[answerRevealJumpPopoverSlideIndex]?.blocks ?? []
    if (!blks.length) return null
    const slideRow = slides[answerRevealJumpPopoverSlideIndex]
    return distributeGlobalRevealAcrossSlide(
      answerRevealJumpDraft,
      blks,
      answerRevealJumpPopoverSlideIndex,
      answerRevealJumpOpts,
      slideRow?.title ?? ''
    )
  }, [answerRevealJumpPopoverSlideIndex, answerRevealJumpDraft, slides, answerRevealJumpOpts])

  const closeAnswerRevealJumpDialog = useCallback(() => {
    const saved = pauseBeforeAnswerRevealPopoverRef.current
    if (saved) {
      setAnswerTypingPaused((prev) => {
        const next = { ...prev }
        for (const k of saved.keys) {
          if (saved.snapshot[k]) next[k] = true
          else delete next[k]
        }
        return next
      })
      pauseBeforeAnswerRevealPopoverRef.current = null
    }
    answerRevealJumpAnchorRef.current = null
    setAnswerRevealJumpPopoverSlideIndex(null)
  }, [])

  const openAnswerRevealJumpForSlide = useCallback(
    (slideIdx: number, anchorEl: HTMLElement | null) => {
      answerRevealJumpAnchorRef.current = anchorEl
      const slide = slides[slideIdx]
      const blks = slide?.blocks ?? []
      const keys: string[] = []
      if (!worksheetId && curriculumId && worksheetAnswerSegmentCount(slide?.title ?? '') > 0) {
        keys.push(curriculumSlideTitleRevealKey(slideIdx))
      }
      keys.push(...typableSolutionBlockIndices(blks, answerRevealJumpOpts).map((bi) => `${slideIdx}-${bi}`))
      if (keys.length === 0) return
      setAnswerTypingPaused((prev) => {
        const snapshot: Record<string, boolean> = {}
        for (const k of keys) {
          snapshot[k] = prev[k] === true
        }
        pauseBeforeAnswerRevealPopoverRef.current = { keys, snapshot }
        const next = { ...prev }
        for (const k of keys) {
          next[k] = true
        }
        return next
      })
      setAnswerRevealJumpDraft(
        globalRevealedSegmentsOnSlide(blks, slideIdx, answerRevealProgress, answerRevealJumpOpts, slide?.title ?? '')
      )
      setAnswerRevealJumpPopoverSlideIndex(slideIdx)
    },
    [slides, answerRevealProgress, answerRevealJumpOpts, worksheetId, curriculumId]
  )

  /** Một thanh điều khiển gõ cho cả slide (không lặp theo từng block). Ẩn/Hiện đáp án vẫn từng block (phiếu). */
  function renderSlideLevelTypingToolbar(
    slideIndex: number,
    blks: Array<{ header?: string; content?: string; isAnswer?: boolean }>,
    density: 'comfortable' | 'compact'
  ): React.ReactNode {
    if (!(worksheetId || curriculumId)) return null
    if (slideIndex < 0 || slideIndex >= slides.length) return null
    const slideHasTypingControls = blks.some(
      (bb) => (!!worksheetId && !!(bb as { isAnswer?: boolean }).isAnswer) || (!worksheetId && !!curriculumId)
    )
    if (!slideHasTypingControls) return null

    const typableIdx = typableSolutionBlockIndices(blks, answerRevealJumpOpts)
    const typableKeys: string[] = []
    if (!worksheetId && curriculumId && worksheetAnswerSegmentCount(slides[slideIndex]?.title ?? '') > 0) {
      typableKeys.push(curriculumSlideTitleRevealKey(slideIndex))
    }
    typableKeys.push(...typableIdx.map((bi) => `${slideIndex}-${bi}`))
    if (typableKeys.length === 0) return null

    const typingOn = answerTypingEnabled[typableKeys[0]] !== false
    const slidePaused = typableKeys.every((k) => answerTypingPaused[k] === true)
    const allAnswersHidden =
      !!worksheetId && typableKeys.length > 0 && typableKeys.every((k) => answerVisibility[k] === false)
    const progressDisabled = allAnswersHidden

    const compact = density === 'compact'
    const btn = compact
      ? 'text-[10px] px-1.5 py-0.5 rounded bg-slate-600/50 hover:bg-slate-600/70 text-slate-300 flex items-center gap-0.5 disabled:opacity-40 disabled:pointer-events-none'
      : 'text-[11px] px-2 py-1 rounded-md bg-slate-600/50 hover:bg-slate-600/70 text-slate-300 hover:text-white transition-colors flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none'
    const iconSz = compact ? 'h-3 w-3' : 'h-3.5 w-3.5'
    const wrapCls = compact
      ? 'mb-1 flex flex-wrap items-center gap-1 rounded-md border border-amber-500/25 bg-slate-900/40 px-1.5 py-1'
      : 'mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-amber-500/30 bg-slate-900/50 px-2 py-1.5'

    return (
      <div className={wrapCls}>
        <span
          className={
            compact
              ? 'w-full text-[9px] font-medium uppercase tracking-wide text-amber-200/80'
              : 'w-full text-[10px] font-medium text-amber-200/85 sm:w-auto'
          }
        >
          {tr(
            'Điều chỉnh gõ (tiêu đề + nội dung)',
            'Typing: title + slide body',
            '打字：标题与正文',
            '入力：タイトル＋本文',
            '타이핑: 제목+본문'
          )}
        </span>
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={() => {
              setAnswerTypingSegmentsGloballyEnabled((g) => !g)
              setAnswerTypingPaused({})
            }}
            className={btn}
            title={
              typingOn
                ? tr('Tắt chế độ gõ lời giải', 'Turn off typing effect', '关闭打字效果', 'タイピング効果をオフ', '타이핑 효과 끄기')
                : tr('Bật chế độ gõ lời giải', 'Turn on typing effect', '开启打字效果', 'タイピング効果をオン', '타이핑 효과 켜기')
            }
          >
            {typingOn ? <KeyboardOff className={iconSz} /> : <Keyboard className={iconSz} />}
            {typingOn
              ? compact
                ? tr('Tắt gõ', 'Typing off', '关打字', 'OFF', '끔')
                : tr('Tắt chế độ gõ', 'Typing off', '关闭打字', 'タイピングOFF', '타이핑 끔')
              : compact
                ? tr('Bật gõ', 'Typing on', '开打字', 'ON', '켬')
                : tr('Bật chế độ gõ', 'Typing on', '开启打字', 'タイピングON', '타이핑 켬')}
          </button>
          <button
            type="button"
            disabled={!typingOn || allAnswersHidden}
            onClick={() => {
              const nextPaused = !slidePaused
              setAnswerTypingPaused((prev) => {
                const n = { ...prev }
                for (const k of typableKeys) {
                  if (nextPaused) n[k] = true
                  else delete n[k]
                }
                return n
              })
            }}
            className={btn}
            title={
              slidePaused
                ? tr('Gõ tiếp (đồng bộ học sinh)', 'Resume typing (sync to students)', '继续打字（同步学生）', '入力再開（生徒に同期）', '입력 재개 (학생 동기화)')
                : tr('Tạm dừng gõ (đồng bộ học sinh)', 'Pause typing (sync to students)', '暂停打字（同步学生）', '一時停止（生徒に同期）', '입력 일시정지 (학생 동기화)')
            }
          >
            {slidePaused ? <Play className={iconSz} /> : <Pause className={iconSz} />}
            {slidePaused
              ? compact
                ? tr('Tiếp', 'Resume', '继续', '再開', '재개')
                : tr('Gõ tiếp', 'Resume', '继续', '再開', '재개')
              : compact
                ? tr('Dừng', 'Pause', '暂停', '停止', '정지')
                : tr('Tạm dừng', 'Pause', '暂停', '停止', '일시정지')}
          </button>
          <button
            type="button"
            disabled={progressDisabled}
            onClick={(e) => openAnswerRevealJumpForSlide(slideIndex, e.currentTarget)}
            className={btn}
            title={tr(
              'Tạm dừng gõ và chỉnh tiến độ cả slide (segment); kéo thanh xem màu trên lời giải; Áp dụng để đồng bộ học sinh',
              'Pause typing and adjust progress for the whole slide; drag slider to preview; Apply syncs to students',
              '暂停打字并调整整页进度；拖动滑块预览；应用后同步学生',
              '入力を止めてスライド全体の進捗を調整。スライダーでプレビュー。適用で生徒に同期',
              '입력을 멈추고 슬라이드 전체 진행 조정. 슬라이더로 미리보기. 적용 시 학생 동기화'
            )}
          >
            <Target className={iconSz} />
            {compact ? tr('Tiến độ', 'Pos.', '进度', '位置', '진행') : tr('Tiến độ gõ', 'Position', '打字位置', '位置', '위치')}
          </button>
          <label
            className={['flex cursor-pointer items-center gap-1 text-slate-400', compact ? 'text-[9px]' : 'text-[10px]'].join(' ')}
            title={tr('Tốc độ gõ lời giải (ms mỗi ký tự)', 'Typing speed (ms per character)', '打字速度（毫秒/字符）', '入力速度（文字あたりms）', '타이핑 속도(ms/글자)')}
          >
            <span className="shrink-0">{tr('Tốc độ', 'Speed', '速度', '速度', '속도')}</span>
            <input
              type="range"
              min={15}
              max={180}
              step={5}
              value={Math.min(180, Math.max(15, answerTypingSpeedMs))}
              onChange={(e) => setAnswerTypingSpeedMs(Number(e.target.value))}
              className={compact ? 'h-1 w-14 accent-amber-400 cursor-pointer' : 'h-1.5 w-[72px] accent-amber-400 cursor-pointer'}
            />
            <span className={['tabular-nums text-slate-300 shrink-0', compact ? 'w-7 text-[9px]' : 'w-8'].join(' ')}>{answerTypingSpeedMs}ms</span>
          </label>
        </div>
      </div>
    )
  }

  const prevSlideModeRef = useRef<string | null>(null)
  const studentViewWindowRef = useRef<Window | null>(null)
  const [studentViewOpened, setStudentViewOpened] = useState(false)
  /** Slide index trước lần đổi `currentIndex` — kế thừa trạng thái tạm dừng gõ sang slide sau. */
  const prevSlideIndexForTypingPauseRef = useRef<number | null>(null)
  /** Đổi phiếu/giáo trình → không kế thừa pause từ tài liệu cũ. */
  const lastTypingDocKeyRef = useRef<string>('')
  const [remoteAutoPlay, setRemoteAutoPlay] = useState(false)
  const [remoteAutoPlayIntervalMs, setRemoteAutoPlayIntervalMs] = useState(5000)
  const pointerThrottleRef = useRef(0)
  const syncSeqRef = useRef(1)
  const syncChannelRef = useRef<BroadcastChannel | null>(null)
  const hasHydratedFromCurriculumRef = useRef(false)
  const slidesRef = useRef<SlideItem[]>([])
  const visualAutoFillBlockedRef = useRef<Record<number, { visualInput1?: boolean; visualInput2?: boolean; visualInput3?: boolean; visualInput4?: boolean }>>({})
  const visualAutoFillInitializedRef = useRef<Record<number, boolean>>({})
  const visualManualEditedRef = useRef<Record<number, boolean>>({})
  const visualInputPersistTimeoutRef = useRef<number | null>(null)
  const lastStudentWirePayloadRef = useRef<string>('')
  const lastIncomingCurriculumPayloadRef = useRef<string>('')
  const quizPopupScrollApplyingRef = useRef(false)
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([])
  const firstMatchRef = useRef<HTMLElement | null>(null)
  const teacherVisualFrameRef = useRef<HTMLDivElement | null>(null)
  const teacherVisualOverlayRef = useRef<HTMLDivElement | null>(null)
  /** Cột trái tab Visual (chưa fullscreen): cùng cấu trúc ô con như fullscreen để map chuột ảo theo ảnh */
  const teacherEmbeddedVisualFrameRef = useRef<HTMLDivElement | null>(null)
  /** Ảnh infographic trong tab Infographic (chưa fullscreen) */
  const teacherEmbeddedInfographicImgRef = useRef<HTMLImageElement | null>(null)
  const teacherEmbeddedInfographicStageRef = useRef<HTMLDivElement | null>(null)
  const teacherEmbeddedInfographicCanvasRef = useRef<HTMLCanvasElement | null>(null)
  /** Cột phải — vùng cuộn nội dung slide (chế độ 1 slide); map chuột ảo HS theo tỷ lệ khung */
  const teacherSlideContentPaneRef = useRef<HTMLDivElement | null>(null)
  /** Khối nội dung slide (con trực tiếp trong vùng cuộn) — rel chuột theo bbox toàn khối để khớp xuống dòng với HS */
  const teacherSlideContentLayoutRef = useRef<HTMLDivElement | null>(null)
  /** Chỉ phần thân slide (sau tiêu đề / toolbar) — map chuột ảo khớp chữ, không gồm toolbar & hàng tiêu đề */
  const teacherSlidePointerSyncRef = useRef<HTMLDivElement | null>(null)
  const teacherInfographicOverlayRef = useRef<HTMLDivElement | null>(null)
  const teacherInfographicOverlayImgRef = useRef<HTMLImageElement | null>(null)
  const teacherInfographicOverlayStageRef = useRef<HTMLDivElement | null>(null)
  const teacherInfographicOverlayCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [infographicDrawStrokesBySlide, setInfographicDrawStrokesBySlide] = useState<Record<number, InfographicDrawStroke[]>>({})
  const [infographicDrawTool, setInfographicDrawTool] = useState<InfographicDrawTool>('pen')
  const [infographicDrawBrushPx, setInfographicDrawBrushPx] = useState(4)
  const [infographicDrawColor, setInfographicDrawColor] = useState<string>(INFOGRAPHIC_DRAW_COLORS[0])
  const [infographicSourceView, setInfographicSourceView] = useState<'visual' | 'lesson' | 'curriculum'>('lesson')
  const hasLessonInfographic = Boolean(String(lessonInfographic?.imageUrl ?? '').trim())
  const hasCurriculumInfographic = Boolean(String(curriculumInfographic?.imageUrl ?? '').trim())
  const priorityVisualInfographic = useMemo(
    () => (hasLessonInfographic ? lessonInfographic : hasCurriculumInfographic ? curriculumInfographic : undefined),
    [hasLessonInfographic, lessonInfographic, hasCurriculumInfographic, curriculumInfographic]
  )
  const activeVisualInfographic = useMemo(() => {
    if (infographicSourceView === 'visual') return priorityVisualInfographic
    if (infographicSourceView === 'curriculum') return curriculumInfographic
    return lessonInfographic
  }, [infographicSourceView, priorityVisualInfographic, lessonInfographic, curriculumInfographic])
  const activeVisualInfographicRenderKey = useMemo(
    () => `${infographicSourceView}:${String(activeVisualInfographic?.imageUrl ?? '')}`,
    [infographicSourceView, activeVisualInfographic?.imageUrl]
  )
  const activeInfographicStrokeKey = useMemo(
    () => getInfographicStrokeBucketKey(activeVisualInfographic?.imageUrl),
    [activeVisualInfographic?.imageUrl]
  )
  const lessonInfographicCostLabel = useMemo(
    () => formatCurriculumCredits(CURRICULUM_UI_CREDITS.slideInfographic2K),
    []
  )
  useEffect(() => {
    setInfographicSourceView((prev) => {
      if (prev === 'visual') return prev
      if (prev === 'lesson' && !hasLessonInfographic && hasCurriculumInfographic) return 'curriculum'
      if (prev === 'curriculum' && !hasCurriculumInfographic && hasLessonInfographic) return 'lesson'
      return prev
    })
  }, [hasLessonInfographic, hasCurriculumInfographic])
  const autoInfographicSourceSlideRef = useRef<number | null>(null)
  const infographicDrawingRef = useRef<{
    target: 'pane' | 'fullscreen'
    strokeId: string
    slideIndex: number
    pointerId: number
    removeListeners?: () => void
  } | null>(null)
  useEffect(() => {
    if (!curriculumInfographic) return
    setInfographicDrawStrokesBySlide((prev) => foldInfographicStrokesToCurriculumKey(prev))
  }, [curriculumInfographic?.imageUrl])
  const [viewportW, setViewportW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280))
  const [stableLayoutWidth, setStableLayoutWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280))
  useEffect(() => {
    const sync = () => {
      setViewportW(window.innerWidth)
    }
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])
  useEffect(() => {
    // Keep the widest seen width so shrinking only clips the left side.
    setStableLayoutWidth((prev) => (viewportW > prev ? viewportW : prev))
  }, [viewportW])
  /** Dưới 768px: hai cột xếp dọc full width; từ md: giữ layout neo phải + minWidth như cũ */
  const narrowTeacherLayout = viewportW < 768
  // Giao diện giáo viên neo về bên phải: khi thu nhỏ chỉ ẩn dần phần bên trái.
  const currentVisualPresentation = useMemo(() => {
    const s = slides[currentIndex]
    if (!s) return { layout: 1 as 1 | 2 | 4, cells: [] as VisualCell[] }
    return getVisualCellsForPresentation(
      s,
      activeVisualInfographic,
      [lessonInfographic?.imageUrl, curriculumInfographic?.imageUrl],
      infographicSourceView !== 'visual'
    )
  }, [
    slides,
    currentIndex,
    activeVisualInfographic,
    infographicSourceView,
    lessonInfographic?.imageUrl,
    curriculumInfographic?.imageUrl,
  ])
  const currentVisualHasAny = useMemo(
    () => currentVisualPresentation.cells.some((c) => c.visualEmbed || c.imageUrl),
    [currentVisualPresentation]
  )
  const currentVisualShowsInfographic = useMemo(() => {
    if (!activeVisualInfographic?.imageUrl) return false
    return currentVisualPresentation.cells.some(
      (c) => c.imageUrl && visualImageIsCurriculumInfographic(c.imageUrl, activeVisualInfographic)
    )
  }, [currentVisualPresentation, activeVisualInfographic])

  useEffect(() => {
    if (autoInfographicSourceSlideRef.current === currentIndex) return
    autoInfographicSourceSlideRef.current = currentIndex
    const s = slides[currentIndex]
    if (!s) {
      setInfographicSourceView('visual')
      return
    }
    const raw = getVisualCells(s)
    const hasSlideVisual = raw.cells.some((c) => c.visualEmbed || c.imageUrl)
    if (hasSlideVisual) setInfographicSourceView('visual')
    else if (hasLessonInfographic) setInfographicSourceView('lesson')
    else if (hasCurriculumInfographic) setInfographicSourceView('curriculum')
    else setInfographicSourceView('visual')
  }, [currentIndex, slides, hasLessonInfographic, hasCurriculumInfographic])

  const tr = useCallback((vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }, [uiLocale])

  const worksheetEditCheckCreditSuffix = useMemo(
    () => ` (${formatCurriculumCredits(CURRICULUM_UI_CREDITS.worksheetEditCheck)} ${tr('credits', 'credits', '积分', 'クレジット', '크레딧')})`,
    [tr]
  )
  const worksheetEditSaveCreditSuffix = useMemo(
    () => ` (${formatCurriculumCredits(CURRICULUM_UI_CREDITS.worksheetEditSave)} ${tr('credits', 'credits', '积分', 'クレジット', '크레딧')})`,
    [tr]
  )
  const slideQuizGenCreditSuffix = useMemo(
    () => ` (${formatCurriculumCredits(CURRICULUM_UI_CREDITS.slideGenerateQuiz)} ${tr('credits', 'credits', '积分', 'クレジット', '크레딧')})`,
    [tr]
  )

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.name = TEACHER_SLIDE_WINDOW_TARGET_NAME
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (worksheetId && topic) {
      document.title = `${topic} – ${tr('Phiếu bài tập', 'Worksheet', '练习', 'ワークシート', '워크시트')}`
    } else if (topic) {
      document.title = `${topic} – ${tr('Giáo trình', 'Curriculum', '课程', 'カリキュラム', '교육과정')}`
    }
  }, [worksheetId, topic, tr])

  /** Phiếu bài tập: khi có worksheetId trong URL, fetch và load slides */
  useEffect(() => {
    if (!worksheetId?.trim()) {
      setWorksheetMarkdownSource('')
      setWorksheetQuestionTypes([])
      return
    }
    setWorksheetLoading(true)
    let cancelled = false
    fetch(`/api/worksheet/${encodeURIComponent(worksheetId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setWorksheetLoading(false)
        if (data.error) return
        const markdown = data.content_markdown ?? ''
        const t = data.topic ?? 'Phiếu bài tập'
        const questions = Array.isArray(data.questions) ? data.questions : null
        const qTypes = Array.isArray(data.questions)
          ? (data.questions as Array<{ type?: string }>).map((q) => q.type ?? '')
          : []
        setWorksheetMarkdownSource(markdown)
        setWorksheetQuestionTypes(qTypes)
        const aiSlides = questions?.length
          ? questionsToSlides(questions)
          : parseWorksheetToSlides(markdown)
        const readable = latexToReadable(markdown)
        const sl = aiSlides.map((s) => ({
          title: s.title,
          blocks: s.blocks ?? [],
          teacherNotes: '',
          content: s.blocks?.map((b) => `${b.header ? `### ${b.header}\n` : ''}${b.content}`).join('\n\n') ?? '',
        }))
        setContent(readable)
        setTopic(t)
        setSlideTitles(sl.map((s) => s.title))
        setSlides(sl)
        slidesRef.current = sl
        setCurrentIndex(0)
        const initVis: Record<string, boolean> = {}
        sl.forEach((s, si) => {
          (s.blocks ?? []).forEach((b, bi) => {
            if ((b as { isAnswer?: boolean }).isAnswer) initVis[`${si}-${bi}`] = true
          })
        })
        setAnswerVisibility(initVis)
        setAnswerRevealProgress({})
        setAnswerTypingPaused({})
        setCurriculumId(null)
        setSlideMode('original')
        setHasOriginalSlides(true)
        setCurriculumInfographic(undefined)
        setLessonInfographic(undefined)
        hasHydratedFromCurriculumRef.current = true
      })
      .catch(() => { setWorksheetLoading(false) })
    return () => { cancelled = true }
  }, [worksheetId])

  useEffect(() => {
    const syncStudentWindowState = () => {
      const w = studentViewWindowRef.current
      const alive = !!(w && !w.closed)
      if (!alive) studentViewWindowRef.current = null
      setStudentViewOpened(alive)
    }
    syncStudentWindowState()
    const id = window.setInterval(syncStudentWindowState, 800)
    return () => window.clearInterval(id)
  }, [])

  const requestCurriculum = useCallback(() => {
    if (window.opener) window.opener.postMessage({ type: 'request-curriculum' }, window.location.origin)
  }, [])

  useEffect(() => {
    if (worksheetId) return
    if (content.trim().length > 0 || slides.length > 0) return
    if (typeof window === 'undefined') return
    if (runtimeHydratedRef.current) return
    runtimeHydratedRef.current = true
    try {
      const raw = window.sessionStorage.getItem(TEACHER_CURRICULUM_RUNTIME_CACHE_KEY)
      if (!raw) return
      const cached = JSON.parse(raw) as {
        content?: string
        fullCurriculumMarkdown?: string
        topic?: string
        currentIndex?: number
        curriculumId?: string | null
        slideMode?: 'original' | 'shared' | 'personal' | null
        personalViewSubMode?: 'current' | 'original'
        hasOriginalSlides?: boolean
        slides?: SlideItem[]
        teacherTimerSeconds?: number
        teacherTimerRunning?: boolean
        lessonNo?: number | null
        curriculumInfographic?: SlideInfographic | null
        lessonInfographic?: SlideInfographic | null
      }
      const cachedSlides = Array.isArray(cached?.slides) ? cached.slides.map((s) => normalizeSlideVisualInputs(s)) : []
      const cachedContent = typeof cached?.content === 'string' ? cached.content : ''
      if (cachedContent.trim().length <= 0 && cachedSlides.length <= 0) return
      const safeIndexRaw = Number.isFinite(Number(cached?.currentIndex)) ? Number(cached.currentIndex) : 0
      const safeIndex = Math.max(0, Math.min(safeIndexRaw, Math.max(0, cachedSlides.length - 1)))
      setContent(cachedContent)
      setFullCurriculumMarkdown(typeof cached?.fullCurriculumMarkdown === 'string' ? cached.fullCurriculumMarkdown : '')
      setTopic(typeof cached?.topic === 'string' ? cached.topic : '')
      setCurrentIndex(safeIndex)
      setCurriculumId(typeof cached?.curriculumId === 'string' ? cached.curriculumId : null)
      setSlideMode(
        cached?.slideMode === 'original' || cached?.slideMode === 'shared' || cached?.slideMode === 'personal'
          ? cached.slideMode
          : null
      )
      setPersonalViewSubMode(cached?.personalViewSubMode === 'original' ? 'original' : 'current')
      setHasOriginalSlides(Boolean(cached?.hasOriginalSlides))
      setSlides(cachedSlides)
      slidesRef.current = cachedSlides
      setSlideTitles(cachedSlides.map((s) => s?.title ?? ''))
      setTeacherTimerSeconds(typeof cached?.teacherTimerSeconds === 'number' ? cached.teacherTimerSeconds : 0)
      setTeacherTimerRunning(Boolean(cached?.teacherTimerRunning))
      setActiveLessonNo(Number.isFinite(Number(cached?.lessonNo)) ? Math.max(1, Math.floor(Number(cached?.lessonNo))) : null)
      setCurriculumInfographic(
        cached?.curriculumInfographic && typeof cached.curriculumInfographic.imageUrl === 'string'
          ? cached.curriculumInfographic
          : undefined
      )
      setLessonInfographic(
        cached?.lessonInfographic && typeof cached.lessonInfographic.imageUrl === 'string'
          ? cached.lessonInfographic
          : undefined
      )
      hasHydratedFromCurriculumRef.current = true
    } catch {
      /* ignore */
    }
  }, [worksheetId, content, slides])

  useEffect(() => {
    if (worksheetId) return
    if (typeof window === 'undefined') return
    if (content.trim().length <= 0 && slides.length <= 0) return
    const id = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(
          TEACHER_CURRICULUM_RUNTIME_CACHE_KEY,
          JSON.stringify({
            content,
            fullCurriculumMarkdown,
            topic,
            currentIndex,
            curriculumId,
            slideMode,
            personalViewSubMode,
            hasOriginalSlides,
            slides,
            teacherTimerSeconds,
            teacherTimerRunning,
            lessonNo: activeLessonNo,
            curriculumInfographic: curriculumInfographic ?? null,
            lessonInfographic: lessonInfographic ?? null,
          })
        )
      } catch {
        /* ignore */
      }
    }, 350)
    return () => window.clearTimeout(id)
  }, [
    worksheetId,
    content,
    fullCurriculumMarkdown,
    topic,
    currentIndex,
    curriculumId,
    slideMode,
    personalViewSubMode,
    hasOriginalSlides,
    slides,
    teacherTimerSeconds,
    teacherTimerRunning,
    activeLessonNo,
    curriculumInfographic,
    lessonInfographic,
  ])

  useEffect(() => {
    if (worksheetId) return
    if (content.trim().length > 0 || slides.length > 0) return
    if (typeof window === 'undefined') return
    if (!window.opener) return
    requestCurriculum()
    const id = window.setInterval(() => requestCurriculum(), 2500)
    return () => window.clearInterval(id)
  }, [worksheetId, content, slides, requestCurriculum])

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

  const sendToStudentView = useCallback((msg: Record<string, unknown>) => {
    const payload = { ...msg, __syncSeq: syncSeqRef.current++ }
    try {
      const w = studentViewWindowRef.current
      if (w && !w.closed) {
        w.postMessage(payload, window.location.origin)
      } else {
        syncChannelRef.current?.postMessage(payload)
      }
    } catch {
      /* ignore */
    }
  }, [])

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

  const getInfographicDrawStage = useCallback((target: 'pane' | 'fullscreen') => {
    let stage = target === 'pane' ? teacherEmbeddedInfographicStageRef.current : teacherInfographicOverlayStageRef.current
    let img = target === 'pane' ? teacherEmbeddedInfographicImgRef.current : teacherInfographicOverlayImgRef.current
    let canvas = target === 'pane' ? teacherEmbeddedInfographicCanvasRef.current : teacherInfographicOverlayCanvasRef.current
    const pickBestStage = (selector: string) => {
      const candidates = Array.from(document.querySelectorAll(selector)) as HTMLDivElement[]
      let best: HTMLDivElement | null = null
      let bestArea = 0
      for (const st of candidates) {
        const rect = st.getBoundingClientRect()
        if (rect.width <= 40 || rect.height <= 40) continue
        const style = window.getComputedStyle(st)
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue
        const area = rect.width * rect.height
        if (area > bestArea) {
          best = st
          bestArea = area
        }
      }
      return best
    }
    if (target === 'pane' && (!stage || !img || !canvas)) {
      const fallbackStage = pickBestStage('[data-teacher-infographic-draw-pane-stage]')
      const fallbackImg = fallbackStage?.querySelector('img') as HTMLImageElement | null
      const fallbackCanvas = fallbackStage?.querySelector('[data-teacher-infographic-draw-pane-canvas]') as HTMLCanvasElement | null
      if (fallbackStage && fallbackImg && fallbackCanvas) {
        stage = fallbackStage
        img = fallbackImg
        canvas = fallbackCanvas
        teacherEmbeddedInfographicStageRef.current = fallbackStage
        teacherEmbeddedInfographicImgRef.current = fallbackImg
        teacherEmbeddedInfographicCanvasRef.current = fallbackCanvas
      }
    }
    if (target === 'fullscreen' && (!stage || !img || !canvas)) {
      const fallbackStage = pickBestStage('[data-teacher-infographic-draw-fullscreen-stage]')
      const fallbackImg = fallbackStage?.querySelector('img') as HTMLImageElement | null
      const fallbackCanvas = fallbackStage?.querySelector('canvas') as HTMLCanvasElement | null
      if (fallbackStage && fallbackImg && fallbackCanvas) {
        stage = fallbackStage
        img = fallbackImg
        canvas = fallbackCanvas
        teacherInfographicOverlayStageRef.current = fallbackStage
        teacherInfographicOverlayImgRef.current = fallbackImg
        teacherInfographicOverlayCanvasRef.current = fallbackCanvas
      }
    }
    if (target === 'pane' && stage) {
      const rect = stage.getBoundingClientRect()
      const style = window.getComputedStyle(stage)
      const stageLikelyHidden = rect.width <= 40 || rect.height <= 40 || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0
      if (stageLikelyHidden) {
        const fallbackStage = pickBestStage('[data-teacher-infographic-draw-pane-stage]')
        const fallbackImg = fallbackStage?.querySelector('img') as HTMLImageElement | null
        const fallbackCanvas = fallbackStage?.querySelector('[data-teacher-infographic-draw-pane-canvas]') as HTMLCanvasElement | null
        if (fallbackStage && fallbackImg && fallbackCanvas) {
          stage = fallbackStage
          img = fallbackImg
          canvas = fallbackCanvas
          teacherEmbeddedInfographicStageRef.current = fallbackStage
          teacherEmbeddedInfographicImgRef.current = fallbackImg
          teacherEmbeddedInfographicCanvasRef.current = fallbackCanvas
        }
      }
    }
    if (!stage || !img || !canvas || !img.complete || img.naturalWidth <= 0) return null
    const vis = getVisibleImageBounds(img)
    if (vis.width <= 0 || vis.height <= 0) return null
    return { stage, img, canvas, vis }
  }, [])

  const resolveInfographicDrawPoint = useCallback((target: 'pane' | 'fullscreen', clientX: number, clientY: number) => {
    const st = getInfographicDrawStage(target)
    if (!st) return null
    if (
      clientX < st.vis.left ||
      clientX > st.vis.left + st.vis.width ||
      clientY < st.vis.top ||
      clientY > st.vis.top + st.vis.height
    ) {
      return null
    }
    return {
      u: clamp01((clientX - st.vis.left) / st.vis.width),
      v: clamp01((clientY - st.vis.top) / st.vis.height),
      st,
    }
  }, [getInfographicDrawStage])

  const renderInfographicDrawCanvas = useCallback((target: 'pane' | 'fullscreen') => {
    const strokes = infographicDrawStrokesBySlide[activeInfographicStrokeKey] ?? []
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const clearCanvas = (canvas: HTMLCanvasElement) => {
      if (canvas.width !== 1) canvas.width = 1
      if (canvas.height !== 1) canvas.height = 1
      canvas.style.width = '0px'
      canvas.style.height = '0px'
    }
    const paintOnStage = (stage: HTMLDivElement, img: HTMLImageElement, canvas: HTMLCanvasElement) => {
      if (!img.complete || img.naturalWidth <= 0) return false
      const vis = getVisibleImageBounds(img)
      if (vis.width <= 0 || vis.height <= 0) return false
      const sr = stage.getBoundingClientRect()
      if (sr.width < 2 || sr.height < 2) return false
      const left = vis.left - sr.left
      const top = vis.top - sr.top
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
        ctx.lineWidth = Math.max(1.5, s.sizeNorm * vis.width)
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

    if (target === 'pane') {
      const stages = Array.from(document.querySelectorAll('[data-teacher-infographic-draw-pane-stage]')) as HTMLDivElement[]
      let paintedAny = false
      for (const stage of stages) {
        const img = stage.querySelector('img') as HTMLImageElement | null
        const canvas = stage.querySelector('[data-teacher-infographic-draw-pane-canvas]') as HTMLCanvasElement | null
        if (!img || !canvas) continue
        const rect = stage.getBoundingClientRect()
        const style = window.getComputedStyle(stage)
        const isVisible =
          rect.width > 40 &&
          rect.height > 40 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          Number(style.opacity || '1') > 0
        if (!isVisible) {
          clearCanvas(canvas)
          continue
        }
        if (paintOnStage(stage, img, canvas)) paintedAny = true
      }
      return paintedAny
    }

    const st = getInfographicDrawStage(target)
    if (!st) return false
    return paintOnStage(st.stage, st.img, st.canvas)
  }, [getInfographicDrawStage, infographicDrawStrokesBySlide, activeInfographicStrokeKey])

  const startInfographicDrawing = useCallback((target: 'pane' | 'fullscreen', e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeVisualInfographic) return
    e.preventDefault()
    infographicDrawingRef.current?.removeListeners?.()
    const point = resolveInfographicDrawPoint(target, e.clientX, e.clientY)
    if (!point) return
    const strokeId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const sizeNorm = Math.max(0.0015, infographicDrawBrushPx / Math.max(point.st.vis.width, 1))
    const stroke: InfographicDrawStroke = {
      id: strokeId,
      tool: infographicDrawTool,
      color: infographicDrawColor,
      sizeNorm,
      points: [{ u: point.u, v: point.v }],
    }
    upsertInfographicStroke(activeInfographicStrokeKey, stroke)
    sendToStudentView({
      type: 'infographic-draw-start',
      slideIndex: activeInfographicStrokeKey,
      stroke,
    })
    const toPoints = (ev: PointerEvent, d: { target: 'pane' | 'fullscreen' }): InfographicDrawPoint[] => {
      const samples = typeof ev.getCoalescedEvents === 'function' ? ev.getCoalescedEvents() : [ev]
      const points: InfographicDrawPoint[] = []
      for (const sample of samples) {
        const r = resolveInfographicDrawPoint(d.target, sample.clientX, sample.clientY)
        if (!r) continue
        points.push({ u: r.u, v: r.v })
      }
      if (points.length === 0) {
        const r = resolveInfographicDrawPoint(d.target, ev.clientX, ev.clientY)
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
      sendToStudentView({
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
      const points = toPoints(ev, d)
      enqueuePoints(points)
    }
    const onEnd = (ev: PointerEvent) => {
      const d = infographicDrawingRef.current
      if (!d || d.pointerId !== ev.pointerId) return
      const points = toPoints(ev, d)
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
      target,
      strokeId,
      slideIndex: activeInfographicStrokeKey,
      pointerId: e.pointerId,
      removeListeners,
    }
  }, [activeVisualInfographic, resolveInfographicDrawPoint, infographicDrawBrushPx, infographicDrawTool, infographicDrawColor, activeInfographicStrokeKey, upsertInfographicStroke, sendToStudentView, appendInfographicStrokePoints])

  useEffect(() => {
    const clearInactive = () => {
      if (infographicFullscreenOpen) {
        const paneCanvases = Array.from(document.querySelectorAll('[data-teacher-infographic-draw-pane-canvas]')) as HTMLCanvasElement[]
        for (const c of paneCanvases) {
          if (c.width !== 1) c.width = 1
          if (c.height !== 1) c.height = 1
          c.style.width = '0px'
          c.style.height = '0px'
        }
      } else {
        const c = teacherInfographicOverlayCanvasRef.current
        if (c) {
          if (c.width !== 1) c.width = 1
          if (c.height !== 1) c.height = 1
          c.style.width = '0px'
          c.style.height = '0px'
        }
      }
    }
    if (infographicFullscreenOpen) renderInfographicDrawCanvas('fullscreen')
    else renderInfographicDrawCanvas('pane')
    clearInactive()
    const raf = typeof window !== 'undefined' ? window.requestAnimationFrame(() => {
      if (infographicFullscreenOpen) renderInfographicDrawCanvas('fullscreen')
      else renderInfographicDrawCanvas('pane')
      clearInactive()
    }) : 0
    return () => {
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [renderInfographicDrawCanvas, currentIndex, leftPanelMode, infographicFullscreenOpen, infographicSourceView, activeVisualInfographic?.imageUrl])

  useEffect(() => {
    // Repaint nhẹ sau đổi slide/tab: đủ để bắt ảnh load chậm nhưng tránh tốn RAM/CPU.
    const timers: Array<ReturnType<typeof setTimeout>> = []
    const run = () => {
      if (infographicFullscreenOpen) renderInfographicDrawCanvas('fullscreen')
      else renderInfographicDrawCanvas('pane')
    }
    timers.push(setTimeout(run, 450))
    timers.push(setTimeout(run, 900))
    timers.push(setTimeout(run, 1500))
    return () => {
      for (const id of timers) clearTimeout(id)
    }
  }, [renderInfographicDrawCanvas, currentIndex, leftPanelMode, infographicFullscreenOpen, infographicSourceView, activeVisualInfographic?.imageUrl, infographicDrawStrokesBySlide])

  useEffect(() => {
    const binds: Array<() => void> = []
    const ros: ResizeObserver[] = []
    const bind = (target: 'pane' | 'fullscreen', stage: HTMLDivElement | null, img: HTMLImageElement | null) => {
      if (!stage || !img) return
      const redraw = () => renderInfographicDrawCanvas(target)
      const onLoad = () => redraw()
      img.addEventListener('load', onLoad)
      binds.push(() => img.removeEventListener('load', onLoad))
      const ro = new ResizeObserver(redraw)
      ro.observe(stage)
      ro.observe(img)
      ros.push(ro)
    }
    const paneStages = Array.from(document.querySelectorAll('[data-teacher-infographic-draw-pane-stage]')) as HTMLDivElement[]
    for (const stage of paneStages) {
      const img = stage.querySelector('img') as HTMLImageElement | null
      bind('pane', stage, img)
    }
    bind('fullscreen', teacherInfographicOverlayStageRef.current, teacherInfographicOverlayImgRef.current)
    const onResize = () => {
      if (infographicFullscreenOpen) renderInfographicDrawCanvas('fullscreen')
      else renderInfographicDrawCanvas('pane')
    }
    window.addEventListener('resize', onResize)
    onResize()
    const raf = typeof window !== 'undefined' ? window.requestAnimationFrame(onResize) : 0
    return () => {
      for (const off of binds) off()
      for (const ro of ros) ro.disconnect()
      window.removeEventListener('resize', onResize)
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [renderInfographicDrawCanvas, currentIndex, leftPanelMode, infographicFullscreenOpen, infographicSourceView, activeVisualInfographic?.imageUrl])

  useEffect(() => {
    if (!studentViewOpened) return
    lastStudentWirePayloadRef.current = ''
    const send = () => {
      sendToStudentView({ type: 'infographic-draw-sync', strokesBySlide: infographicDrawStrokesBySlide })
    }
    send()
    const t = window.setTimeout(send, 250)
    return () => window.clearTimeout(t)
  }, [studentViewOpened, sendToStudentView, infographicDrawStrokesBySlide])

  const toStudentSlidePayload = useCallback((s: SlideItem, slideIndex: number) => {
    const normalized = getVisualCells(s)
    const hasVisualFromInputs = normalized.cells.some((c) => c.visualEmbed || c.imageUrl)
    const blocks = s.blocks ?? []
    const filterSolutionForStudent = (b: (typeof blocks)[number], bi: number) => {
      const isAnswer = (b as { isAnswer?: boolean }).isAnswer
      if (!isAnswer) return b
      const key = `${slideIndex}-${bi}`
      const visible = answerVisibility[key] !== false
      if (!visible) {
        return { ...b, content: '', studentAnswerHidden: true as const }
      }
      return { ...b, studentAnswerHidden: false as const }
    }
    const filteredBlocks = worksheetId
      ? blocks.map((b, bi) => {
          return filterSolutionForStudent(b, bi)
        })
      : blocks
    return {
      title: s.title,
      blocks: filteredBlocks,
      teacherNotes: s.teacherNotes ?? '',
      imageUrl: hasVisualFromInputs ? undefined : s.imageUrl,
      visualEmbed: s.visualEmbed,
      visualLayout: normalized.layout,
      visualCells: normalized.cells,
      visualInput1: s.visualInput1,
      visualInput2: s.visualInput2,
      visualInput3: s.visualInput3,
      visualInput4: s.visualInput4,
    }
  }, [worksheetId, answerVisibility])

  const compactSlidesForStudentWire = useCallback((slidesToSend: SlideItem[], currentIdx: number) => {
    const keepFullTextForAllSlides = studentCurriculumRemoteMode === 'markdown-all'
    if (!Array.isArray(slidesToSend) || slidesToSend.length <= 0) return []
    const chunkSize = STUDENT_WIRE_SLIDE_CHUNK_SIZE
    const radius = STUDENT_WIRE_SLIDE_CHUNK_RADIUS
    const currentChunk = Math.floor(Math.max(0, currentIdx) / chunkSize)
    const keepStart = Math.max(0, (currentChunk - radius) * chunkSize)
    const keepEnd = Math.min(slidesToSend.length - 1, ((currentChunk + radius + 1) * chunkSize) - 1)
    return slidesToSend.map((s, i) => {
      if (i >= keepStart && i <= keepEnd) return s
      return {
        ...s,
        blocks: keepFullTextForAllSlides ? s.blocks : undefined,
        content: keepFullTextForAllSlides ? s.content : '',
        imageUrl: undefined,
        visualEmbed: undefined,
        visualLayout: undefined,
        visualCells: undefined,
        visualInput1: undefined,
        visualInput2: undefined,
        visualInput3: undefined,
        visualInput4: undefined,
      }
    })
  }, [studentCurriculumRemoteMode])

  const sendCurriculumDataToStudent = useCallback((
    slidesToSend: SlideItem[],
    currentIndexOverride?: number,
    /** Dùng ngay sau tạo infographic (state/ref chưa kịp cập nhật trong microtask) */
    curriculumInfographicWire?: SlideInfographic
  ) => {
    const idx = typeof currentIndexOverride === 'number' ? currentIndexOverride : currentIndex
    const wireInfographic = curriculumInfographicWire ?? activeVisualInfographic
    const keepFullTextForAllSlides = studentCurriculumRemoteMode === 'markdown-all'
    const compactedSlides = compactSlidesForStudentWire(slidesToSend, idx)
    const payload = {
      type: 'curriculum-data',
      content: keepFullTextForAllSlides ? content : '',
      topic,
      currentIndex: Math.max(0, Math.min(idx, compactedSlides.length - 1)),
      curriculumId: curriculumId ?? null,
      slideMode: slideMode ?? null,
      personalViewSubMode,
      hasOriginalSlides,
      slides: compactedSlides.map((s, i) => toStudentSlidePayload(s, i)),
      teacherTimerSeconds,
      teacherTimerRunning,
      worksheetId: !!worksheetId,
      worksheetAnswerReveal: worksheetId || curriculumId ? answerRevealProgress : undefined,
      worksheetAnswerTypingEnabled: worksheetId || curriculumId ? answerTypingEnabled : undefined,
      ...(!worksheetId
        ? {
            studentCurriculumRightMode: studentCurriculumRemoteMode,
            teacherSlideLeftPane:
              leftPanelMode === 'infographic' || (leftPanelMode === 'visual' && currentVisualShowsInfographic)
                ? ('infographic' as const)
                : ('visual' as const),
            curriculumInfographic: wireInfographic ?? null,
          }
        : {}),
      ...(!worksheetId && lessonInfographic ? { lessonInfographic } : {}),
    }
    let payloadKey = ''
    try {
      payloadKey = JSON.stringify(payload)
    } catch {
      payloadKey = ''
    }
    if (payloadKey && lastStudentWirePayloadRef.current === payloadKey) return
    if (payloadKey) lastStudentWirePayloadRef.current = payloadKey
    try {
      const w = studentViewWindowRef.current
      if (w && !w.closed) {
        w.postMessage(payload, window.location.origin)
      } else {
        syncChannelRef.current?.postMessage(payload)
      }
    } catch {
      /* ignore */
    }
  }, [content, topic, currentIndex, curriculumId, slideMode, personalViewSubMode, hasOriginalSlides, teacherTimerSeconds, teacherTimerRunning, toStudentSlidePayload, worksheetId, answerRevealProgress, answerTypingEnabled, studentCurriculumRemoteMode, activeVisualInfographic, leftPanelMode, currentVisualShowsInfographic, compactSlidesForStudentWire])

  useEffect(() => {
    if (!studentViewOpened || worksheetId) return
    sendCurriculumDataToStudent(slides, currentIndex)
  }, [
    studentViewOpened,
    worksheetId,
    slides,
    currentIndex,
    infographicSourceView,
    activeVisualInfographic?.imageUrl,
    sendCurriculumDataToStudent,
  ])

  /** Phiếu / giáo trình (đã lưu): khi ẩn/hiện đáp án hoặc bật/tắt chế độ gõ, gửi lại dữ liệu sang học sinh */
  useEffect(() => {
    if (!(worksheetId || curriculumId) || !studentViewOpened) return
    sendCurriculumDataToStudent(slides, currentIndex)
  }, [answerVisibility, answerTypingEnabled, worksheetId, curriculumId, studentViewOpened, slides, currentIndex, sendCurriculumDataToStudent])

  /** Đổi slide → reset tiến độ gõ; giữ tạm dừng nếu slide vừa rời đang tạm dừng cả slide (đồng bộ nút Pause). */
  useEffect(() => {
    if (!worksheetId && !curriculumId) return

    const docKey = `${worksheetId ?? ''}:${curriculumId ?? ''}`
    if (lastTypingDocKeyRef.current !== docKey) {
      lastTypingDocKeyRef.current = docKey
      prevSlideIndexForTypingPauseRef.current = null
    }

    const prevIdx = prevSlideIndexForTypingPauseRef.current
    if (prevIdx !== null && prevIdx === currentIndex) {
      return
    }

    const sl = slides
    const paused = answerTypingPausedRef.current
    let carryPause = false
    if (prevIdx != null && prevIdx >= 0 && prevIdx < sl.length) {
      const prevSlide = sl[prevIdx]
      const prevBlks = prevSlide?.blocks ?? []
      const prevKeys: string[] = []
      if (!worksheetId && curriculumId && worksheetAnswerSegmentCount(prevSlide?.title ?? '') > 0) {
        prevKeys.push(curriculumSlideTitleRevealKey(prevIdx))
      }
      prevKeys.push(...typableSolutionBlockIndices(prevBlks, answerRevealJumpOpts).map((bi) => `${prevIdx}-${bi}`))
      if (prevKeys.length > 0) {
        carryPause = prevKeys.every((k) => paused[k] === true)
      }
    }

    setAnswerRevealProgress({})
    if (carryPause) {
      const s = sl[currentIndex]
      const blks = s?.blocks ?? []
      const keys: string[] = []
      if (!worksheetId && curriculumId && worksheetAnswerSegmentCount(s?.title ?? '') > 0) {
        keys.push(curriculumSlideTitleRevealKey(currentIndex))
      }
      keys.push(...typableSolutionBlockIndices(blks, answerRevealJumpOpts).map((bi) => `${currentIndex}-${bi}`))
      const seed: Record<string, boolean> = {}
      for (const k of keys) seed[k] = true
      setAnswerTypingPaused(keys.length > 0 ? seed : {})
    } else {
      setAnswerTypingPaused({})
    }
    setAnswerRevealJumpPopoverSlideIndex(null)
    answerRevealJumpAnchorRef.current = null
    pauseBeforeAnswerRevealPopoverRef.current = null

    prevSlideIndexForTypingPauseRef.current = currentIndex
    // Chỉ chạy khi đổi slide / đổi phiên: `slides` lấy từ closure render này (không liệt kê trong deps để tránh reset khi chỉ sửa nội dung).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- slides chỉ cần đúng khi currentIndex/worksheetId/curriculumId đổi
  }, [currentIndex, worksheetId, curriculumId])


  /** Tăng segment hiển thị cho HS (GV màn hình đồng bộ tiến độ gõ) */
  useEffect(() => {
    if (!worksheetId && !curriculumId) return
    const ms = Math.max(15, answerTypingSpeedMs)
    const id = window.setInterval(() => {
      setAnswerRevealProgress((prev) => {
        const slide = slides[currentIndex]
        if (!slide) return prev

        const next = { ...prev }

        if (!worksheetId && curriculumId) {
          const titleText = slide.title ?? ''
          const titleTotal = worksheetAnswerSegmentCount(titleText)
          if (titleTotal > 0) {
            const titleKey = curriculumSlideTitleRevealKey(currentIndex)
            if (answerTypingPaused[titleKey] === true) return prev
            if (answerVisibility[titleKey] !== false && answerTypingEnabled[titleKey] !== false) {
              const tCur = next[titleKey] ?? 0
              if (tCur < titleTotal) {
                next[titleKey] = tCur + 1
                return next
              }
            }
          }
        }

        if (!slide.blocks?.length) return prev

        // Một tick chỉ +1 segment cho **một** block: block đầu tiên (trên xuống) chưa gõ xong.
        // Tránh slide ghép nhiều block gõ song song hàng loạt.
        let targetBi = -1
        for (let bi = 0; bi < slide.blocks.length; bi++) {
          const b = slide.blocks[bi]
          const shouldTypeBySegments = worksheetId ? Boolean((b as { isAnswer?: boolean }).isAnswer) : !!curriculumId
          if (!shouldTypeBySegments) continue
          const key = `${currentIndex}-${bi}`
          if (answerVisibility[key] === false) continue
          if (answerTypingPaused[key] === true) break
          const typingOn = answerTypingEnabled[key] !== false
          if (!typingOn) continue
          const total = worksheetAnswerSegmentCount(b.content ?? '')
          const cur = next[key] ?? 0
          if (cur < total) {
            targetBi = bi
            break
          }
        }
        if (targetBi < 0) return prev
        const tKey = `${currentIndex}-${targetBi}`
        const tCur = next[tKey] ?? 0
        next[tKey] = tCur + 1
        return next
      })
    }, ms)
    return () => window.clearInterval(id)
  }, [worksheetId, curriculumId, answerTypingSpeedMs, currentIndex, slides, answerVisibility, answerTypingEnabled, answerTypingPaused])

  /** Đẩy tiến độ gõ segment sang cửa sổ học sinh */
  useEffect(() => {
    if (!(worksheetId || curriculumId) || !studentViewOpened) return
    sendToStudentView({ type: 'worksheet-answer-reveal', worksheetAnswerReveal: answerRevealProgress })
  }, [answerRevealProgress, worksheetId, curriculumId, studentViewOpened, sendToStudentView])

  /** Đồng bộ theo thay đổi (debounce nhẹ), tránh interval full-payload gây tăng RAM/CPU. */
  useEffect(() => {
    if (!studentViewOpened || slides.length === 0) return
    const id = window.setTimeout(() => sendCurriculumDataToStudent(slides, currentIndex), 220)
    return () => window.clearTimeout(id)
  }, [studentViewOpened, slides, currentIndex, sendCurriculumDataToStudent])

  const commitCurrentSlideDraft = useCallback(() => {
    if (!slides.length) return { nextSlides: slides, changed: false }
    const slideIndex = currentIndex
    const currentSlide = slides[slideIndex]
    if (!currentSlide) return { nextSlides: slides, changed: false }
    const hasInlineDraft =
      editingTitle === slideIndex ||
      editingHeader?.slideIndex === slideIndex ||
      editingBlock?.slideIndex === slideIndex ||
      notesDirty ||
      visualInputsDirty
    if (!hasInlineDraft) return { nextSlides: slides, changed: false }

    let changed = false
    let titleChanged = false
    let blocksChanged = false
    let notesChanged = false
    let nextSlide = currentSlide

    if (editingTitle === slideIndex && editingTitleValue !== (currentSlide.title ?? '')) {
      nextSlide = { ...nextSlide, title: editingTitleValue }
      changed = true
      titleChanged = true
    }

    const baseBlocks = Array.isArray(nextSlide.blocks) ? nextSlide.blocks : (nextSlide.content ? parseContentToBlocks(nextSlide.content) : [])
    let updatedBlocks = baseBlocks
    const ensureBlocksCopy = () => {
      if (updatedBlocks === baseBlocks) updatedBlocks = baseBlocks.map((b) => ({ ...b }))
    }

    if (editingHeader?.slideIndex === slideIndex) {
      const bi = editingHeader.blockIndex
      if (bi >= 0 && bi < updatedBlocks.length && (updatedBlocks[bi]?.header ?? '') !== editingHeaderValue) {
        ensureBlocksCopy()
        updatedBlocks[bi] = { ...updatedBlocks[bi], header: editingHeaderValue }
        changed = true
        blocksChanged = true
      }
    }

    if (editingBlock?.slideIndex === slideIndex) {
      const bi = editingBlock.blockIndex
      if (bi >= 0 && bi < updatedBlocks.length && (updatedBlocks[bi]?.content ?? '') !== editingValue) {
        ensureBlocksCopy()
        updatedBlocks[bi] = { ...updatedBlocks[bi], content: editingValue }
        changed = true
        blocksChanged = true
      }
    }

    if (blocksChanged) {
      nextSlide = { ...nextSlide, blocks: updatedBlocks, content: '' }
    }

    if (notesDirty && (nextSlide.teacherNotes ?? '') !== notesValue) {
      nextSlide = { ...nextSlide, teacherNotes: notesValue }
      changed = true
      notesChanged = true
    }

    if (!changed) {
      if (visualInputsDirty && curriculumId) void persistSlidesRef.current(slides)
      if (visualInputsDirty) setVisualInputsDirty(false)
      return { nextSlides: slides, changed: false }
    }

    const nextSlides = slides.map((s, i) => (i === slideIndex ? nextSlide : s))
    setSlides(nextSlides)
    if (curriculumId) void persistSlidesRef.current(nextSlides)

    if (titleChanged && window.opener) {
      window.opener.postMessage({ type: 'update-slide-title', slideIndex, title: nextSlide.title ?? '' }, window.location.origin)
    }
    if (blocksChanged && window.opener) {
      window.opener.postMessage({ type: 'update-slide-blocks', slideIndex, blocks: updatedBlocks }, window.location.origin)
    }
    if (notesChanged && window.opener) {
      window.opener.postMessage({ type: 'update-notes', slideIndex, teacherNotes: notesValue }, window.location.origin)
    }
    sendCurriculumDataToStudent(nextSlides, slideIndex)

    if (editingTitle === slideIndex) setEditingTitle(null)
    if (editingHeader?.slideIndex === slideIndex) setEditingHeader(null)
    if (editingBlock?.slideIndex === slideIndex) setEditingBlock(null)
    if (notesChanged) setNotesDirty(false)
    if (visualInputsDirty) setVisualInputsDirty(false)

    return { nextSlides, changed: true }
  }, [
    slides,
    currentIndex,
    editingTitle,
    editingTitleValue,
    editingHeader,
    editingHeaderValue,
    editingBlock,
    editingValue,
    notesValue,
    notesDirty,
    visualInputsDirty,
    curriculumId,
    sendCurriculumDataToStudent,
  ])

  const sendSlideControl = useCallback((action: 'slide-prev' | 'slide-next') => {
    commitCurrentSlideDraft()
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
  }, [commitCurrentSlideDraft, currentIndex, slides.length])

  const persistSlidesRef = useRef<(s: SlideItem[], curriculumInfographicOverride?: SlideInfographic) => Promise<void>>(async () => {})
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const lastRequestedSaveIdRef = useRef(0)
  useEffect(() => {
    persistSlidesRef.current = async (updatedSlides: SlideItem[], curriculumInfographicOverride?: SlideInfographic) => {
      if (!curriculumId || updatedSlides.length === 0) return
      const requestId = ++lastRequestedSaveIdRef.current
      const payload = updatedSlides.map((s) => ({
        title: s.title,
        blocks: (s.blocks || []).map((b) => ({ header: b.header ?? 'Nội dung', content: b.content ?? '' })),
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
      const inf = curriculumInfographicOverride !== undefined ? curriculumInfographicOverride : curriculumInfographicRef.current
      saveQueueRef.current = saveQueueRef.current
        .catch(() => {})
        .then(async () => {
          // Bỏ qua request cũ; luôn ưu tiên snapshot mới nhất.
          if (requestId !== lastRequestedSaveIdRef.current) return
          if (slideMode === 'personal' || slideMode === 'original') {
            const r = await saveUserCustomizedSlides({
              curriculumId,
              slides: payload,
              curriculumInfographic: inf,
              lessonNo: activeLessonNo ?? undefined,
              lessonMode: slideMode === 'original' ? 'original' : 'personal',
            })
            if (r?.error) toast({ title: tr('Lỗi lưu', 'Save error', '保存错误', '保存エラー', '저장 오류'), description: r.error, variant: 'destructive' })
            else { toast({ title: tr('Đã lưu', 'Saved', '已保存', '保存しました', '저장됨'), duration: 1500 }) }
          } else if (slideMode === 'shared' || !slideMode) {
            const r = await saveSlidesToCurriculum({
              curriculumId,
              topic: topic || 'Bài giảng',
              subjectId: 'toan',
              gradeLevelId: 'lop-6',
              slides: payload,
              curriculumInfographic: inf,
              lessonNo: activeLessonNo ?? undefined,
            })
            if (r?.error) toast({ title: tr('Lỗi lưu', 'Save error', '保存错误', '保存エラー', '저장 오류'), description: r.error, variant: 'destructive' })
            else { toast({ title: tr('Đã lưu', 'Saved', '已保存', '保存しました', '저장됨'), duration: 1500 }) }
          }
        })
      await saveQueueRef.current
    }
  }, [curriculumId, slideMode, topic, toast, tr, activeLessonNo])

  const leftWidePanel = leftPanelMode === 'visual' || leftPanelMode === 'infographic'

  const generateCurriculumInfographic = useCallback(async () => {
    if (!curriculumId || worksheetId) return
    if (slides.length === 0) return
    const fullMarkdown = String(fullCurriculumMarkdown || '').trim()
    const lessonText = fullMarkdown || curriculumPlainTextForInfographic(slides, content, topic)
    if (lessonText.trim().length < 40) {
      toast({
        title: tr('Nội dung giáo trình quá ngắn', 'Curriculum content too short', '课程内容太短', 'カリキュラムが短すぎます', '교육과정 내용이 너무 짧음'),
        description: tr('Cần đủ nội dung trên các slide hoặc markdown giáo trình.', 'Add more content on slides or in curriculum markdown.', '请在幻灯片或课程 Markdown 中补充内容。', 'スライドまたはMarkdownに十分な内容を追加してください。', '슬라이드나 교육과정 마크다운에 내용을 더 추가하세요.'),
        variant: 'destructive',
      })
      return
    }
    setInfographicGenerating(true)
    try {
      const res = await fetch('/api/curriculum-slide-infographic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          curriculumId,
          topic,
          lessonText,
          outputLocale: getWebLocaleFromCookie(),
        }),
      })
      let data: { success?: boolean; infographic?: SlideInfographic; error?: string }
      try {
        data = (await res.json()) as typeof data
      } catch {
        throw new Error(
          tr('Phản hồi server không hợp lệ.', 'Invalid server response.', '服务器响应无效。', 'サーバーの応答が無効です。', '서버 응답이 올바르지 않습니다.')
        )
      }
      if (!res.ok || !data.success || !data.infographic) {
        throw new Error(
          data.error ||
            tr('Không tạo được infographic', 'Could not create infographic', '无法创建信息图', 'インフォグラフィックを作成できません', '인포그래픽을 만들 수 없음')
        )
      }
      const inf = data.infographic
      setCurriculumInfographic(inf)
      curriculumInfographicRef.current = inf
      queueMicrotask(() => {
        // Truyền inf vào persist vì ref/state có thể chưa khớp trước lần render sau setState
        void persistSlidesRef.current(slidesRef.current, inf)
        sendCurriculumDataToStudent(slidesRef.current, currentIndex, inf)
      })
      toast({
        title: tr('Đã tạo infographic', 'Infographic created', '已创建信息图', 'インフォグラフィックを作成しました', '인포그래픽 생성됨'),
        duration: 2000,
      })
    } catch (e) {
      toast({
        title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      })
    } finally {
      setInfographicGenerating(false)
    }
  }, [curriculumId, worksheetId, slides, fullCurriculumMarkdown, content, topic, currentIndex, toast, tr, sendCurriculumDataToStudent])

  const generateLessonInfographic = useCallback(async () => {
    if (!curriculumId || worksheetId) return
    if (!activeLessonNo || activeLessonNo <= 0) {
      toast({
        title: tr('Chưa chọn tiết', 'No lesson selected', '尚未选择课时', '授業が未選択です', '차시가 선택되지 않았습니다'),
        description: tr(
          'Vui lòng mở theo từng tiết trước khi tạo infographic theo tiết.',
          'Please open a specific lesson before generating lesson infographic.',
          '请先打开具体课时，再生成该课时信息图。',
          '授業単位で開いてから、その授業のインフォグラフィックを作成してください。',
          '차시를 먼저 연 뒤 해당 차시 인포그래픽을 생성해 주세요.'
        ),
        variant: 'destructive',
      })
      return
    }
    const lessonText = String(content || curriculumPlainTextForInfographic(slides, content, topic)).trim()
    if (lessonText.length < 40) {
      toast({
        title: tr('Nội dung tiết quá ngắn', 'Lesson content too short', '课时内容太短', '授業内容が短すぎます', '차시 내용이 너무 짧음'),
        description: tr(
          'Cần đủ nội dung ở tiết hiện tại để tạo infographic.',
          'Add more lesson content before generating infographic.',
          '请先补充当前课时内容再生成信息图。',
          '先に現在の授業内容を補足してから作成してください。',
          '현재 차시 내용을 보강한 뒤 생성해 주세요.'
        ),
        variant: 'destructive',
      })
      return
    }
    toast({
      title: tr('Chuẩn bị tạo infographic tiết', 'Preparing lesson infographic', '准备创建课时信息图', '授業インフォグラフィック作成準備', '차시 인포그래픽 생성 준비'),
      description: tr(
        `Thao tác này sẽ tốn ${lessonInfographicCostLabel} credit.`,
        `This action will cost ${lessonInfographicCostLabel} credits.`,
        `此操作将消耗 ${lessonInfographicCostLabel} 积分。`,
        `この操作では ${lessonInfographicCostLabel} クレジットを消費します。`,
        `이 작업은 ${lessonInfographicCostLabel} 크레딧이 필요합니다.`
      ),
      duration: 1800,
    })
    setLessonInfographicGenerating(true)
    try {
      const res = await fetch('/api/curriculum-slide-infographic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          curriculumId,
          topic: `${topic || tr('Giáo trình', 'Curriculum', '课程', 'カリキュラム', '커리큘럼')} - ${tr('Tiết', 'Lesson', '课时', '授業', '차시')} ${activeLessonNo}`,
          lessonText,
          outputLocale: getWebLocaleFromCookie(),
        }),
      })
      let data: { success?: boolean; infographic?: SlideInfographic; error?: string }
      try {
        data = (await res.json()) as typeof data
      } catch {
        throw new Error(
          tr('Phản hồi server không hợp lệ.', 'Invalid server response.', '服务器响应无效。', 'サーバーの応答が無効です。', '서버 응답이 올바르지 않습니다.')
        )
      }
      if (!res.ok || !data.success || !data.infographic) {
        throw new Error(
          data.error ||
            tr('Không tạo được infographic theo tiết', 'Could not create lesson infographic', '无法创建课时信息图', '授業インフォグラフィックを作成できません', '차시 인포그래픽을 만들 수 없음')
        )
      }
      const inf = data.infographic
      const lessonMode: 'shared' | 'original' | 'personal' =
        slideMode === 'original'
          ? 'original'
          : slideMode === 'personal'
            ? (personalViewSubMode === 'original' ? 'original' : 'personal')
            : 'shared'
      const saved = await saveCurriculumLessonInfographicAction(curriculumId, lessonMode, activeLessonNo, inf)
      if (!saved?.success) {
        throw new Error(
          saved?.error ||
            tr('Không lưu được infographic theo tiết', 'Could not save lesson infographic', '无法保存课时信息图', '授業インフォグラフィックを保存できません', '차시 인포그래픽 저장 실패')
        )
      }
      setLessonInfographic(inf)
      sendCurriculumDataToStudent(slidesRef.current, currentIndex, inf)
      toast({
        title: tr('Đã tạo infographic theo tiết', 'Lesson infographic created', '已创建课时信息图', '授業インフォグラフィックを作成しました', '차시 인포그래픽 생성됨'),
        duration: 2000,
      })
    } catch (e) {
      toast({
        title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      })
    } finally {
      setLessonInfographicGenerating(false)
    }
  }, [curriculumId, worksheetId, activeLessonNo, content, slides, topic, tr, toast, lessonInfographicCostLabel, slideMode, personalViewSubMode, sendCurriculumDataToStudent, currentIndex])

  const infographicActionText = useCallback((kind: 'lesson' | 'curriculum', hasImage: boolean, cost: string) => {
    if (kind === 'lesson') {
      return tr(
        `${hasImage ? 'Tạo lại' : 'Tạo'} infographic tiết này (${cost} credit)`,
        `${hasImage ? 'Regenerate' : 'Create'} lesson infographic (${cost} credits)`,
        `${hasImage ? '重新生成' : '创建'}本课时信息图（${cost} 积分）`,
        `この授業の情報図を${hasImage ? '再生成' : '作成'}（${cost}クレジット）`,
        `이 차시 인포그래픽 ${hasImage ? '다시 만들기' : '만들기'} (${cost} 크레딧)`
      )
    }
    return tr(
      `${hasImage ? 'Tạo lại' : 'Tạo'} infographic cả bài (${cost} credit)`,
      `${hasImage ? 'Regenerate' : 'Create'} curriculum infographic (${cost} credits)`,
      `${hasImage ? '重新生成' : '创建'}全课信息图（${cost} 积分）`,
      `全体情報図を${hasImage ? '再生成' : '作成'}（${cost}クレジット）`,
      `전체 인포그래픽 ${hasImage ? '다시 만들기' : '만들기'} (${cost} 크레딧)`
    )
  }, [tr])
  const confirmInfographicAction = useCallback((kind: 'lesson' | 'curriculum', isRegenerate: boolean): boolean => {
    const msg = kind === 'lesson'
      ? isRegenerate
        ? tr(
            'Ảnh infographic theo tiết đã tồn tại. Bạn có chắc muốn tạo lại không?',
            'Lesson infographic already exists. Are you sure you want to regenerate it?',
            '该课时信息图已存在。确定要重新生成吗？',
            'この授業のインフォグラフィックは既に存在します。再生成しますか？',
            '이 차시 인포그래픽이 이미 있습니다. 다시 생성하시겠습니까?'
          )
        : tr(
            'Bạn có chắc muốn tạo infographic cho tiết này không?',
            'Are you sure you want to create infographic for this lesson?',
            '确定要为本课时创建信息图吗？',
            'この授業のインフォグラフィックを作成しますか？',
            '이 차시 인포그래픽을 생성하시겠습니까?'
          )
      : isRegenerate
        ? tr(
            'Ảnh infographic cả bài đã tồn tại. Bạn có chắc muốn tạo lại không?',
            'Curriculum infographic already exists. Are you sure you want to regenerate it?',
            '整课信息图已存在。确定要重新生成吗？',
            '全体インフォグラフィックは既に存在します。再生成しますか？',
            '전체 인포그래픽이 이미 있습니다. 다시 생성하시겠습니까?'
          )
        : tr(
            'Bạn có chắc muốn tạo infographic cả bài không?',
            'Are you sure you want to create curriculum infographic?',
            '确定要创建整课信息图吗？',
            '全体インフォグラフィックを作成しますか？',
            '전체 인포그래픽을 생성하시겠습니까?'
          )
    if (typeof window === 'undefined') return true
    return window.confirm(msg)
  }, [tr])
  const handleGenerateLessonInfographic = useCallback(() => {
    if (!confirmInfographicAction('lesson', hasLessonInfographic)) return
    void generateLessonInfographic()
  }, [hasLessonInfographic, confirmInfographicAction, generateLessonInfographic])
  const handleGenerateCurriculumInfographic = useCallback(() => {
    if (!confirmInfographicAction('curriculum', hasCurriculumInfographic)) return
    void generateCurriculumInfographic()
  }, [hasCurriculumInfographic, confirmInfographicAction, generateCurriculumInfographic])
  const handleSwitchInfographicSource = useCallback((target: 'visual' | 'lesson' | 'curriculum') => {
    setInfographicSourceView(target)
    const targetInfographic =
      target === 'visual'
        ? priorityVisualInfographic
        : target === 'curriculum'
          ? curriculumInfographic
          : lessonInfographic
    if (studentViewOpened && !worksheetId) {
      sendToStudentView({
        type: 'student-curriculum-left-pane',
        pane: target === 'visual' ? 'visual' : 'infographic',
      })
      sendCurriculumDataToStudent(
        slides,
        currentIndex,
        targetInfographic
      )
    }
    if (target === 'visual') return
    if (!curriculumId || !activeLessonNo || activeLessonNo <= 0) return
    if (slideMode !== 'personal') return
    void (async () => {
      // Bản riêng: infographic "cả bài" nằm ở user_customized_slides (mode personal), không phải worksheet_slides (shared).
      const cached = await getCurriculumSlidesByLessonCachedAction(curriculumId, 'personal', activeLessonNo)
      if (!cached?.success) return
      if (target === 'curriculum') {
        const ci =
          typeof (cached as { curriculumInfographic?: unknown }).curriculumInfographic === 'object'
            ? ((cached as { curriculumInfographic?: SlideInfographic }).curriculumInfographic ?? undefined)
            : undefined
        if (ci?.imageUrl) setCurriculumInfographic(ci)
      } else {
        const lessonInf =
          typeof (cached as { lessonInfographic?: unknown }).lessonInfographic === 'object'
            ? ((cached as { lessonInfographic?: SlideInfographic }).lessonInfographic ?? undefined)
            : undefined
        if (lessonInf?.imageUrl) setLessonInfographic(lessonInf)
      }
    })()
  }, [
    studentViewOpened,
    worksheetId,
    sendToStudentView,
    sendCurriculumDataToStudent,
    slides,
    currentIndex,
    priorityVisualInfographic,
    curriculumInfographic,
    lessonInfographic,
    curriculumId,
    activeLessonNo,
    slideMode,
  ])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(getPresentationBroadcastChannelName(presentationSyncId))
    syncChannelRef.current = channel
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'request-curriculum' || !content) return
      const keepFullTextForAllSlides = studentCurriculumRemoteMode === 'markdown-all'
      const compactedSlides = compactSlidesForStudentWire(slides, currentIndex)
      channel.postMessage({
        type: 'curriculum-data',
        content: keepFullTextForAllSlides ? content : '',
        topic,
        currentIndex,
        curriculumId: curriculumId ?? null,
        slideMode: slideMode ?? null,
        personalViewSubMode,
        hasOriginalSlides,
        slides: compactedSlides.map((s, i) => toStudentSlidePayload(s, i)),
        teacherTimerSeconds,
        teacherTimerRunning,
        worksheetId: !!worksheetId,
        worksheetAnswerReveal: worksheetId || curriculumId ? answerRevealProgress : undefined,
        worksheetAnswerTypingEnabled: worksheetId || curriculumId ? answerTypingEnabled : undefined,
        ...(!worksheetId
          ? {
              studentCurriculumRightMode: studentCurriculumRemoteMode,
              teacherSlideLeftPane:
                leftPanelMode === 'infographic' || (leftPanelMode === 'visual' && currentVisualShowsInfographic)
                  ? ('infographic' as const)
                  : ('visual' as const),
            }
          : {}),
        ...(!worksheetId && activeVisualInfographic ? { curriculumInfographic: activeVisualInfographic } : {}),
        ...(!worksheetId && lessonInfographic ? { lessonInfographic } : {}),
      })
      channel.postMessage({ type: 'presentation-mode', mode: 'slide-interaction' })
      channel.postMessage({ type: 'set-auto-play', value: remoteAutoPlay })
      channel.postMessage({ type: 'set-auto-play-interval', ms: remoteAutoPlayIntervalMs })
      if (visualFullscreenOpen)
        channel.postMessage({
          type: 'visual-fullscreen-open',
          cellIndex: typeof teacherExpandedCellIndex === 'number' ? teacherExpandedCellIndex : undefined,
        })
      else channel.postMessage({ type: 'visual-fullscreen-close' })
      if (infographicFullscreenOpen) channel.postMessage({ type: 'infographic-fullscreen-open' })
      else channel.postMessage({ type: 'infographic-fullscreen-close' })
      channel.postMessage({ type: 'quiz-popup-open', value: quizPopupOpen })
      if (quizPopupOpen) {
        const scrollEl = document.querySelector('[data-quiz-popup-scroll]') as HTMLElement | null
        if (scrollEl) channel.postMessage({ type: 'quiz-popup-scroll', scrollTop: scrollEl.scrollTop })
      }
      Object.entries(quizSessionData).forEach(([key, data]) => {
        const [si, bi] = key.split('-').map(Number)
        if (!isNaN(si) && !isNaN(bi)) channel.postMessage({ type: 'quiz-session-code', slideIndex: si, blockIndex: bi, sessionCode: data.sessionCode, quizDurationSeconds: data.quizDurationSeconds })
      })
      Object.entries(quizSessionSettings).forEach(([key, settings]) => {
        const [si, bi] = key.split('-').map(Number)
        if (!isNaN(si) && !isNaN(bi)) channel.postMessage({ type: 'quiz-session-settings', slideIndex: si, blockIndex: bi, quizDurationSeconds: settings.quizDurationSeconds, autoRevealOnTimerEnd: settings.autoRevealOnTimerEnd })
      })
    }
    channel.addEventListener('message', onMessage)
    return () => {
      channel.removeEventListener('message', onMessage)
      channel.close()
      if (syncChannelRef.current === channel) syncChannelRef.current = null
    }
  }, [presentationSyncId, content, topic, currentIndex, curriculumId, slideMode, personalViewSubMode, hasOriginalSlides, slides, teacherTimerSeconds, teacherTimerRunning, remoteAutoPlay, remoteAutoPlayIntervalMs, visualFullscreenOpen, teacherExpandedCellIndex, infographicFullscreenOpen, quizPopupOpen, quizSessionData, quizSessionSettings, toStudentSlidePayload, worksheetId, answerRevealProgress, answerTypingEnabled, studentCurriculumRemoteMode, activeVisualInfographic, lessonInfographic, leftPanelMode, infographicDrawStrokesBySlide, compactSlidesForStudentWire])

  const openTeacherVisualFullscreen = useCallback((cellIndex?: number) => {
    setInfographicFullscreenOpen(false)
    sendToStudentView({ type: 'infographic-fullscreen-close' })
    setTeacherExpandedCellIndex(typeof cellIndex === 'number' ? cellIndex : null)
    setVisualFullscreenOpen(true)
    const { url: baseSlideUrl, windowName } = getStudentSlideWindowConfig(!!worksheetId)
    const urlWithSync = studentSlideUrlWithSync(baseSlideUrl, presentationSyncId)
    const kind = worksheetId ? 'worksheet' : 'curriculum'
    const sw = typeof screen !== 'undefined' ? screen.availWidth || 1920 : 1920
    const sh = typeof screen !== 'undefined' ? screen.availHeight || 1080 : 1080
    const features = `width=${sw},height=${sh},left=0,top=0,scrollbars=no,resizable=yes`
    let targetWin: Window | null = studentViewWindowRef.current
    if (!targetWin || targetWin.closed) targetWin = window.open('', windowName)
    if (targetWin && !targetWin.closed) {
      try {
        const path = targetWin.location.pathname || ''
        const syncOk = new URLSearchParams(targetWin.location.search || '').get('sync') === presentationSyncId
        if (isPathMatchingStudentSlideKind(path, kind) && syncOk) targetWin.focus()
        else targetWin.location.href = urlWithSync
      } catch {
        targetWin = window.open(urlWithSync, windowName, features)
      }
    } else {
      targetWin = window.open(urlWithSync, windowName, features)
    }
    if (targetWin) {
      studentViewWindowRef.current = targetWin
      try { targetWin.focus() } catch { /* ignore */ }
      const focusRetry = () => { try { targetWin?.focus() } catch { /* ignore */ } }
      setTimeout(focusRetry, 50)
      setTimeout(focusRetry, 150)
    }
    const pushVisualOpen = () => {
      if (!targetWin || targetWin.closed) return
      try {
        const keepFullTextForAllSlides = studentCurriculumRemoteMode === 'markdown-all'
        const compactedSlides = compactSlidesForStudentWire(slides, currentIndex)
        targetWin.postMessage(
          {
            type: 'curriculum-data',
            content: keepFullTextForAllSlides ? content : '',
            topic,
            currentIndex,
            curriculumId: curriculumId ?? null,
            slideMode: slideMode ?? null,
            personalViewSubMode,
            hasOriginalSlides,
            slides: compactedSlides.map((s, i) => toStudentSlidePayload(s, i)),
            teacherTimerSeconds,
            teacherTimerRunning,
            worksheetId: !!worksheetId,
            worksheetAnswerReveal: worksheetId || curriculumId ? answerRevealProgress : undefined,
            worksheetAnswerTypingEnabled: worksheetId || curriculumId ? answerTypingEnabled : undefined,
            ...(!worksheetId
              ? {
                  studentCurriculumRightMode: studentCurriculumRemoteMode,
                  teacherSlideLeftPane:
                    leftPanelMode === 'infographic' || (leftPanelMode === 'visual' && currentVisualShowsInfographic)
                      ? ('infographic' as const)
                      : ('visual' as const),
                }
              : {}),
            ...(!worksheetId && activeVisualInfographic ? { curriculumInfographic: activeVisualInfographic } : {}),
            ...(!worksheetId && lessonInfographic ? { lessonInfographic } : {}),
          },
          window.location.origin
        )
        targetWin.postMessage({ type: 'presentation-mode', mode: 'slide-interaction' }, window.location.origin)
        targetWin.postMessage({ type: 'visual-fullscreen-open', cellIndex: typeof cellIndex === 'number' ? cellIndex : undefined }, window.location.origin)
      } catch {
        /* ignore */
      }
    }
    pushVisualOpen()
    setTimeout(pushVisualOpen, 150)
    setTimeout(pushVisualOpen, 700)
    const openMsg = { type: 'visual-fullscreen-open', cellIndex: typeof cellIndex === 'number' ? cellIndex : undefined } as const
    sendToStudentView({ type: 'presentation-mode', mode: 'slide-interaction' })
    sendToStudentView(openMsg)
    setTimeout(() => {
      sendToStudentView({ type: 'presentation-mode', mode: 'slide-interaction' })
      sendToStudentView(openMsg)
    }, 120)
    setTimeout(() => {
      sendToStudentView({ type: 'presentation-mode', mode: 'slide-interaction' })
      sendToStudentView(openMsg)
    }, 650)
  }, [sendToStudentView, content, topic, currentIndex, curriculumId, slideMode, personalViewSubMode, hasOriginalSlides, slides, teacherTimerSeconds, teacherTimerRunning, worksheetId, answerRevealProgress, answerTypingEnabled, toStudentSlidePayload, presentationSyncId, studentCurriculumRemoteMode, activeVisualInfographic, lessonInfographic, leftPanelMode, infographicDrawStrokesBySlide, compactSlidesForStudentWire])

  const closeTeacherVisualFullscreen = useCallback(() => {
    setVisualFullscreenOpen(false)
    setTeacherExpandedCellIndex(null)
    sendToStudentView({ type: 'visual-fullscreen-close' })
  }, [sendToStudentView])

  const openTeacherInfographicFullscreen = useCallback(() => {
    if (worksheetId) return
    if (!activeVisualInfographic) return
    setVisualFullscreenOpen(false)
    setTeacherExpandedCellIndex(null)
    sendToStudentView({ type: 'visual-fullscreen-close' })
    setInfographicFullscreenOpen(true)
    const { url: baseSlideUrl, windowName } = getStudentSlideWindowConfig(false)
    const urlWithSync = studentSlideUrlWithSync(baseSlideUrl, presentationSyncId)
    const sw = typeof screen !== 'undefined' ? screen.availWidth || 1920 : 1920
    const sh = typeof screen !== 'undefined' ? screen.availHeight || 1080 : 1080
    const features = `width=${sw},height=${sh},left=0,top=0,scrollbars=no,resizable=yes`
    let targetWin: Window | null = studentViewWindowRef.current
    if (!targetWin || targetWin.closed) targetWin = window.open('', windowName)
    if (targetWin && !targetWin.closed) {
      try {
        const path = targetWin.location.pathname || ''
        const syncOk = new URLSearchParams(targetWin.location.search || '').get('sync') === presentationSyncId
        if (isPathMatchingStudentSlideKind(path, 'curriculum') && syncOk) targetWin.focus()
        else targetWin.location.href = urlWithSync
      } catch {
        targetWin = window.open(urlWithSync, windowName, features)
      }
    } else {
      targetWin = window.open(urlWithSync, windowName, features)
    }
    if (targetWin) {
      studentViewWindowRef.current = targetWin
      try { targetWin.focus() } catch { /* ignore */ }
      const focusRetry = () => { try { targetWin?.focus() } catch { /* ignore */ } }
      setTimeout(focusRetry, 50)
      setTimeout(focusRetry, 150)
    }
    const pushInfographicOpen = () => {
      if (!targetWin || targetWin.closed) return
      try {
        const keepFullTextForAllSlides = studentCurriculumRemoteMode === 'markdown-all'
        const compactedSlides = compactSlidesForStudentWire(slides, currentIndex)
        targetWin.postMessage(
          {
            type: 'curriculum-data',
            content: keepFullTextForAllSlides ? content : '',
            topic,
            currentIndex,
            curriculumId: curriculumId ?? null,
            slideMode: slideMode ?? null,
            personalViewSubMode,
            hasOriginalSlides,
            slides: compactedSlides.map((s, i) => toStudentSlidePayload(s, i)),
            teacherTimerSeconds,
            teacherTimerRunning,
            worksheetId: false,
            worksheetAnswerReveal: curriculumId ? answerRevealProgress : undefined,
            worksheetAnswerTypingEnabled: curriculumId ? answerTypingEnabled : undefined,
            studentCurriculumRightMode: studentCurriculumRemoteMode,
            teacherSlideLeftPane:
              leftPanelMode === 'infographic' || (leftPanelMode === 'visual' && currentVisualShowsInfographic)
                ? ('infographic' as const)
                : ('visual' as const),
            ...(activeVisualInfographic ? { curriculumInfographic: activeVisualInfographic } : {}),
            ...(lessonInfographic ? { lessonInfographic } : {}),
          },
          window.location.origin
        )
        targetWin.postMessage({ type: 'presentation-mode', mode: 'slide-interaction' }, window.location.origin)
        targetWin.postMessage({ type: 'infographic-fullscreen-open' }, window.location.origin)
      } catch {
        /* ignore */
      }
    }
    pushInfographicOpen()
    setTimeout(pushInfographicOpen, 150)
    setTimeout(pushInfographicOpen, 700)
    const openMsg = { type: 'infographic-fullscreen-open' } as const
    sendToStudentView({ type: 'presentation-mode', mode: 'slide-interaction' })
    sendToStudentView(openMsg)
    setTimeout(() => {
      sendToStudentView({ type: 'presentation-mode', mode: 'slide-interaction' })
      sendToStudentView(openMsg)
    }, 120)
    setTimeout(() => {
      sendToStudentView({ type: 'presentation-mode', mode: 'slide-interaction' })
      sendToStudentView(openMsg)
    }, 650)
  }, [sendToStudentView, content, topic, currentIndex, curriculumId, slideMode, personalViewSubMode, hasOriginalSlides, slides, teacherTimerSeconds, teacherTimerRunning, answerRevealProgress, answerTypingEnabled, toStudentSlidePayload, presentationSyncId, studentCurriculumRemoteMode, worksheetId, activeVisualInfographic, lessonInfographic, leftPanelMode, infographicDrawStrokesBySlide, compactSlidesForStudentWire])

  const closeTeacherInfographicFullscreen = useCallback(() => {
    setInfographicFullscreenOpen(false)
    sendToStudentView({ type: 'infographic-fullscreen-close' })
  }, [sendToStudentView])

  /** Không tự mở fullscreen khi vào tab Infographic — GV bấm nút mở rộng khi cần. Chỉ đóng khi rời tab Infographic (tránh fullscreen bật lại khi chuyển sang Visual). */
  useEffect(() => {
    if (worksheetId) return
    if (leftPanelMode !== 'infographic' && infographicFullscreenOpen) {
      closeTeacherInfographicFullscreen()
    }
  }, [worksheetId, leftPanelMode, infographicFullscreenOpen, closeTeacherInfographicFullscreen])

  useEffect(() => {
    sendToStudentView({ type: 'quiz-popup-open', value: quizPopupOpen })
  }, [quizPopupOpen, sendToStudentView])

  useEffect(() => {
    if (!quizPopupOpen) setStudentMousePos(null)
  }, [quizPopupOpen])

  const openQuizPopupFresh = useCallback(() => {
    setQuizSessionData((prev) => {
      const next = { ...prev }
      for (const k of Object.keys(next)) {
        if (k.startsWith(`${currentIndex}-`)) delete next[k]
      }
      return next
    })
    setQuizSessionSettings((prev) => {
      const next = { ...prev }
      for (const k of Object.keys(next)) {
        if (k.startsWith(`${currentIndex}-`)) delete next[k]
      }
      return next
    })
    sendToStudentView({ type: 'quiz-session-reset-slide', slideIndex: currentIndex })
    setQuizPopupOpen(true)
  }, [currentIndex, sendToStudentView])

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
      if (now - pointerThrottleRef.current < 8) return
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
      if (!worksheetId && (leftPanelMode === 'visual' || leftPanelMode === 'infographic')) {
        const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY) as HTMLElement[]
        const toolbar = elementsAtPoint
          .map((el) => el.closest('[data-infographic-toolbar="teacher-pane"]') as HTMLElement | null)
          .find((el): el is HTMLElement => !!el)
        if (toolbar) {
          const tr = toolbar.getBoundingClientRect()
          const relX = tr.width > 0 ? Math.max(0, Math.min(1, (e.clientX - tr.left) / tr.width)) : 0.5
          const relY = tr.height > 0 ? Math.max(0, Math.min(1, (e.clientY - tr.top) / tr.height)) : 0.5
          const toolbarButtons = Array.from(toolbar.querySelectorAll('button')) as HTMLElement[]
          const hoveredButton = elementsAtPoint
            .map((el) => el.closest('button') as HTMLElement | null)
            .find((el): el is HTMLElement => !!el && toolbar.contains(el))
          const toolbarButtonIndex = hoveredButton ? toolbarButtons.indexOf(hoveredButton) : -1
          const visibleToolbars = (Array.from(document.querySelectorAll('[data-infographic-toolbar="teacher-pane"]')) as HTMLElement[])
            .filter((el) => {
              const r = el.getBoundingClientRect()
              return r.width > 8 && r.height > 8
            })
            .sort((a, b) => {
              const ar = a.getBoundingClientRect()
              const br = b.getBoundingClientRect()
              return ar.top === br.top ? ar.left - br.left : ar.top - br.top
            })
          const toolbarIndex = Math.max(0, visibleToolbars.indexOf(toolbar))
          sendToStudentView({ type: 'mouse-pos', infographicToolbar: true, relX, relY, toolbarIndex, toolbarButtonIndex })
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
                cellIndex: !worksheetId && currentVisualShowsInfographic ? -1 : i,
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
                cellIndex: !worksheetId && currentVisualShowsInfographic ? -1 : i,
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
          const overlay = teacherVisualOverlayRef.current
          const rect = overlay ? overlay.getBoundingClientRect() : frame.getBoundingClientRect()
          const relXRaw = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5
          const relYRaw = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0.5
          const relX = Math.max(0, Math.min(1, relXRaw))
          const relY = Math.max(0, Math.min(1, relYRaw))
          sendToStudentView({ type: 'mouse-pos', visualFrame: true, overlayRel: !!overlay, relX, relY })
        }
        return
      }
      if (infographicFullscreenOpen && teacherInfographicOverlayRef.current) {
        const img = teacherInfographicOverlayRef.current.querySelector('img')
        if (img?.complete && img.naturalWidth > 0) {
          const overlayRect = teacherInfographicOverlayRef.current.getBoundingClientRect()
          if (e.clientX >= overlayRect.left && e.clientX <= overlayRect.right && e.clientY >= overlayRect.top && e.clientY <= overlayRect.bottom) {
            const vis = getVisibleImageBounds(img)
            const cx = vis.left + vis.width / 2
            const cy = vis.top + vis.height / 2
            const clampedX = Math.max(vis.left, Math.min(vis.left + vis.width, e.clientX))
            const clampedY = Math.max(vis.top, Math.min(vis.top + vis.height, e.clientY))
            sendToStudentView({
              type: 'mouse-pos',
              visualFrame: true,
              imageCenter: true,
              cellIndex: -1,
              dxFromCenter: clampedX - cx,
              dyFromCenter: clampedY - cy,
              visW: vis.width,
              visH: vis.height,
            })
            return
          }
        }
      }
      if (!worksheetId && leftPanelMode === 'visual' && teacherEmbeddedVisualFrameRef.current) {
        const frame = teacherEmbeddedVisualFrameRef.current
        const fr = frame.getBoundingClientRect()
        if (e.clientX >= fr.left && e.clientX <= fr.right && e.clientY >= fr.top && e.clientY <= fr.bottom) {
          const children = Array.from(frame.children) as HTMLElement[]
          let sent = false
          for (let i = 0; i < children.length; i++) {
            const cell = children[i]
            const rect = cell.getBoundingClientRect()
            if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
              const cellImg = cell.querySelector('img')
              if (cellImg?.complete && cellImg.naturalWidth > 0) {
                const vis = getVisibleImageBounds(cellImg)
                const cx = vis.left + vis.width / 2
                const cy = vis.top + vis.height / 2
                sendToStudentView({
                  type: 'mouse-pos',
                  visualFrame: true,
                  imageCenter: true,
                  cellIndex: !worksheetId && currentVisualShowsInfographic ? -1 : i,
                  dxFromCenter: e.clientX - cx,
                  dyFromCenter: e.clientY - cy,
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
                  cellIndex: !worksheetId && currentVisualShowsInfographic ? -1 : i,
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
            const relXRaw = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5
            const relYRaw = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0.5
            const relX = Math.max(0, Math.min(1, relXRaw))
            const relY = Math.max(0, Math.min(1, relYRaw))
            sendToStudentView({ type: 'mouse-pos', visualFrame: true, overlayRel: false, relX, relY })
          }
          return
        }
      }
      if (!worksheetId && leftPanelMode === 'infographic') {
        const toolbar = Array.from(document.querySelectorAll('[data-infographic-toolbar="teacher-pane"]'))
          .find((el) => {
            const r = (el as HTMLElement).getBoundingClientRect()
            return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
          }) as HTMLElement | undefined
        if (toolbar) {
          const tr = toolbar.getBoundingClientRect()
          const relX = tr.width > 0 ? Math.max(0, Math.min(1, (e.clientX - tr.left) / tr.width)) : 0.5
          const relY = tr.height > 0 ? Math.max(0, Math.min(1, (e.clientY - tr.top) / tr.height)) : 0.5
          const visibleToolbars = (Array.from(document.querySelectorAll('[data-infographic-toolbar="teacher-pane"]')) as HTMLElement[])
            .filter((el) => {
              const r = el.getBoundingClientRect()
              return r.width > 8 && r.height > 8
            })
            .sort((a, b) => {
              const ar = a.getBoundingClientRect()
              const br = b.getBoundingClientRect()
              return ar.top === br.top ? ar.left - br.left : ar.top - br.top
            })
          const toolbarIndex = Math.max(0, visibleToolbars.indexOf(toolbar))
          sendToStudentView({ type: 'mouse-pos', infographicToolbar: true, relX, relY, toolbarIndex })
          return
        }
      }
      if (!worksheetId && leftPanelMode === 'infographic' && teacherEmbeddedInfographicImgRef.current) {
        const img = teacherEmbeddedInfographicImgRef.current
        if (img.complete && img.naturalWidth > 0) {
          const stageRect = teacherEmbeddedInfographicStageRef.current?.getBoundingClientRect() ?? img.getBoundingClientRect()
          if (e.clientX >= stageRect.left && e.clientX <= stageRect.right && e.clientY >= stageRect.top && e.clientY <= stageRect.bottom) {
            const vis = getVisibleImageBounds(img)
            const cx = vis.left + vis.width / 2
            const cy = vis.top + vis.height / 2
            const clampedX = Math.max(vis.left, Math.min(vis.left + vis.width, e.clientX))
            const clampedY = Math.max(vis.top, Math.min(vis.top + vis.height, e.clientY))
            sendToStudentView({
              type: 'mouse-pos',
              visualFrame: true,
              imageCenter: true,
              cellIndex: -1,
              dxFromCenter: clampedX - cx,
              dyFromCenter: clampedY - cy,
              visW: vis.width,
              visH: vis.height,
            })
            return
          }
        }
      }
      if (teacherSlideContentPaneRef.current && slideViewMode === 'single') {
        const scrollEl = teacherSlideContentPaneRef.current
        const sr = scrollEl.getBoundingClientRect()
        if (e.clientX >= sr.left && e.clientX <= sr.right && e.clientY >= sr.top && e.clientY <= sr.bottom) {
          const syncEl = teacherSlidePointerSyncRef.current
          if (syncEl) {
            const pr = syncEl.getBoundingClientRect()
            if (pr.width > 0 && pr.height > 0) {
              const inside =
                e.clientX >= pr.left &&
                e.clientX <= pr.right &&
                e.clientY >= pr.top &&
                e.clientY <= pr.bottom
              if (inside) {
                let targetRect = pr
                let pointerSlideIndex: number | undefined
                let pointerBlockIndex: number | undefined
                const proseRoot = (document.elementsFromPoint(e.clientX, e.clientY) as HTMLElement[])
                  .map((el) => el.closest('[data-pointer-prose-root]') as HTMLElement | null)
                  .find((el): el is HTMLElement => !!el && syncEl.contains(el))
                if (proseRoot) {
                  const rr = proseRoot.getBoundingClientRect()
                  if (rr.width > 0 && rr.height > 0) {
                    targetRect = rr
                    const slideRaw = proseRoot.getAttribute('data-slide-index')
                    const blockRaw = proseRoot.getAttribute('data-block-index')
                    const parsedSlide = slideRaw != null ? Number(slideRaw) : Number.NaN
                    const parsedBlock = blockRaw != null ? Number(blockRaw) : Number.NaN
                    if (Number.isFinite(parsedSlide)) pointerSlideIndex = parsedSlide
                    if (Number.isFinite(parsedBlock)) pointerBlockIndex = parsedBlock
                  }
                }
                const relX = (e.clientX - targetRect.left) / targetRect.width
                const relY = (e.clientY - targetRect.top) / targetRect.height
                sendToStudentView({
                  type: 'mouse-pos',
                  slideContentPane: true,
                  slidePointerBody: true,
                  pointerProseBlock: pointerSlideIndex != null && pointerBlockIndex != null,
                  pointerSlideIndex,
                  pointerBlockIndex,
                  relX: Math.max(0, Math.min(1, relX)),
                  relY: Math.max(0, Math.min(1, relY)),
                })
                return
              }
            }
          }
          const layoutEl = teacherSlideContentLayoutRef.current
          if (layoutEl) {
            const lr = layoutEl.getBoundingClientRect()
            if (lr.width > 0 && lr.height > 0) {
              const relX = (e.clientX - lr.left) / lr.width
              const relY = (e.clientY - lr.top) / lr.height
              sendToStudentView({
                type: 'mouse-pos',
                slideContentPane: true,
                slidePointerBody: false,
                relX: Math.max(0, Math.min(1, relX)),
                relY: Math.max(0, Math.min(1, relY)),
              })
              return
            }
          }
        }
      }
      sendToStudentView({
        type: 'mouse-pos',
        normX: Math.max(0, Math.min(1, e.clientX / w)),
        normY: Math.max(0, Math.min(1, e.clientY / h)),
        xrPx: Math.max(0, w - e.clientX),
        yPx: Math.max(0, Math.min(h, e.clientY)),
      })
    }
    const sendPointerClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest('[data-control="xem-học-sinh"]')) return
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
      if (!worksheetId && (leftPanelMode === 'visual' || leftPanelMode === 'infographic')) {
        const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY) as HTMLElement[]
        const toolbar = elementsAtPoint
          .map((el) => el.closest('[data-infographic-toolbar="teacher-pane"]') as HTMLElement | null)
          .find((el): el is HTMLElement => !!el)
        if (toolbar) {
          const tr = toolbar.getBoundingClientRect()
          const relX = tr.width > 0 ? Math.max(0, Math.min(1, (e.clientX - tr.left) / tr.width)) : 0.5
          const relY = tr.height > 0 ? Math.max(0, Math.min(1, (e.clientY - tr.top) / tr.height)) : 0.5
          const toolbarButtons = Array.from(toolbar.querySelectorAll('button')) as HTMLElement[]
          const hoveredButton = elementsAtPoint
            .map((el) => el.closest('button') as HTMLElement | null)
            .find((el): el is HTMLElement => !!el && toolbar.contains(el))
          const toolbarButtonIndex = hoveredButton ? toolbarButtons.indexOf(hoveredButton) : -1
          const visibleToolbars = (Array.from(document.querySelectorAll('[data-infographic-toolbar="teacher-pane"]')) as HTMLElement[])
            .filter((el) => {
              const r = el.getBoundingClientRect()
              return r.width > 8 && r.height > 8
            })
            .sort((a, b) => {
              const ar = a.getBoundingClientRect()
              const br = b.getBoundingClientRect()
              return ar.top === br.top ? ar.left - br.left : ar.top - br.top
            })
          const toolbarIndex = Math.max(0, visibleToolbars.indexOf(toolbar))
          sendToStudentView({ type: 'mouse-click', infographicToolbar: true, relX, relY, toolbarIndex, toolbarButtonIndex })
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
                cellIndex: !worksheetId && currentVisualShowsInfographic ? -1 : i,
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
                cellIndex: !worksheetId && currentVisualShowsInfographic ? -1 : i,
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
          const overlay = teacherVisualOverlayRef.current
          const rect = overlay ? overlay.getBoundingClientRect() : frame.getBoundingClientRect()
          const relXRaw = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5
          const relYRaw = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0.5
          const relX = Math.max(0, Math.min(1, relXRaw))
          const relY = Math.max(0, Math.min(1, relYRaw))
          sendToStudentView({ type: 'mouse-click', visualFrame: true, overlayRel: !!overlay, relX, relY })
        }
        return
      }
      if (infographicFullscreenOpen && teacherInfographicOverlayRef.current) {
        const img = teacherInfographicOverlayRef.current.querySelector('img')
        if (img?.complete && img.naturalWidth > 0) {
          const overlayRect = teacherInfographicOverlayRef.current.getBoundingClientRect()
          if (e.clientX >= overlayRect.left && e.clientX <= overlayRect.right && e.clientY >= overlayRect.top && e.clientY <= overlayRect.bottom) {
            const vis = getVisibleImageBounds(img)
            const cx = vis.left + vis.width / 2
            const cy = vis.top + vis.height / 2
            const clampedX = Math.max(vis.left, Math.min(vis.left + vis.width, e.clientX))
            const clampedY = Math.max(vis.top, Math.min(vis.top + vis.height, e.clientY))
            sendToStudentView({
              type: 'mouse-click',
              visualFrame: true,
              imageCenter: true,
              cellIndex: -1,
              dxFromCenter: clampedX - cx,
              dyFromCenter: clampedY - cy,
              visW: vis.width,
              visH: vis.height,
            })
            return
          }
        }
      }
      if (!worksheetId && leftPanelMode === 'visual' && teacherEmbeddedVisualFrameRef.current) {
        const frame = teacherEmbeddedVisualFrameRef.current
        const fr = frame.getBoundingClientRect()
        if (e.clientX >= fr.left && e.clientX <= fr.right && e.clientY >= fr.top && e.clientY <= fr.bottom) {
          const children = Array.from(frame.children) as HTMLElement[]
          let sent = false
          for (let i = 0; i < children.length; i++) {
            const cell = children[i]
            const rect = cell.getBoundingClientRect()
            if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
              const cellImg = cell.querySelector('img')
              if (cellImg?.complete && cellImg.naturalWidth > 0) {
                const vis = getVisibleImageBounds(cellImg)
                const cx = vis.left + vis.width / 2
                const cy = vis.top + vis.height / 2
                sendToStudentView({
                  type: 'mouse-click',
                  visualFrame: true,
                  imageCenter: true,
                  cellIndex: !worksheetId && currentVisualShowsInfographic ? -1 : i,
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
                  cellIndex: !worksheetId && currentVisualShowsInfographic ? -1 : i,
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
            const relXRaw = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5
            const relYRaw = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0.5
            const relX = Math.max(0, Math.min(1, relXRaw))
            const relY = Math.max(0, Math.min(1, relYRaw))
            sendToStudentView({ type: 'mouse-click', visualFrame: true, overlayRel: false, relX, relY })
          }
          return
        }
      }
      if (!worksheetId && leftPanelMode === 'infographic') {
        const toolbar = Array.from(document.querySelectorAll('[data-infographic-toolbar="teacher-pane"]'))
          .find((el) => {
            const r = (el as HTMLElement).getBoundingClientRect()
            return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
          }) as HTMLElement | undefined
        if (toolbar) {
          const tr = toolbar.getBoundingClientRect()
          const relX = tr.width > 0 ? Math.max(0, Math.min(1, (e.clientX - tr.left) / tr.width)) : 0.5
          const relY = tr.height > 0 ? Math.max(0, Math.min(1, (e.clientY - tr.top) / tr.height)) : 0.5
          const visibleToolbars = (Array.from(document.querySelectorAll('[data-infographic-toolbar="teacher-pane"]')) as HTMLElement[])
            .filter((el) => {
              const r = el.getBoundingClientRect()
              return r.width > 8 && r.height > 8
            })
            .sort((a, b) => {
              const ar = a.getBoundingClientRect()
              const br = b.getBoundingClientRect()
              return ar.top === br.top ? ar.left - br.left : ar.top - br.top
            })
          const toolbarIndex = Math.max(0, visibleToolbars.indexOf(toolbar))
          sendToStudentView({ type: 'mouse-click', infographicToolbar: true, relX, relY, toolbarIndex })
          return
        }
      }
      if (!worksheetId && leftPanelMode === 'infographic' && teacherEmbeddedInfographicImgRef.current) {
        const img = teacherEmbeddedInfographicImgRef.current
        if (img.complete && img.naturalWidth > 0) {
          const stageRect = teacherEmbeddedInfographicStageRef.current?.getBoundingClientRect() ?? img.getBoundingClientRect()
          if (e.clientX >= stageRect.left && e.clientX <= stageRect.right && e.clientY >= stageRect.top && e.clientY <= stageRect.bottom) {
            const vis = getVisibleImageBounds(img)
            const cx = vis.left + vis.width / 2
            const cy = vis.top + vis.height / 2
            const clampedX = Math.max(vis.left, Math.min(vis.left + vis.width, e.clientX))
            const clampedY = Math.max(vis.top, Math.min(vis.top + vis.height, e.clientY))
            sendToStudentView({
              type: 'mouse-click',
              visualFrame: true,
              imageCenter: true,
              cellIndex: -1,
              dxFromCenter: clampedX - cx,
              dyFromCenter: clampedY - cy,
              visW: vis.width,
              visH: vis.height,
            })
            return
          }
        }
      }
      if (teacherSlideContentPaneRef.current && slideViewMode === 'single') {
        const scrollEl = teacherSlideContentPaneRef.current
        const sr = scrollEl.getBoundingClientRect()
        if (e.clientX >= sr.left && e.clientX <= sr.right && e.clientY >= sr.top && e.clientY <= sr.bottom) {
          const syncEl = teacherSlidePointerSyncRef.current
          if (syncEl) {
            const pr = syncEl.getBoundingClientRect()
            if (pr.width > 0 && pr.height > 0) {
              const inside =
                e.clientX >= pr.left &&
                e.clientX <= pr.right &&
                e.clientY >= pr.top &&
                e.clientY <= pr.bottom
              if (inside) {
                let targetRect = pr
                let pointerSlideIndex: number | undefined
                let pointerBlockIndex: number | undefined
                const proseRoot = (document.elementsFromPoint(e.clientX, e.clientY) as HTMLElement[])
                  .map((el) => el.closest('[data-pointer-prose-root]') as HTMLElement | null)
                  .find((el): el is HTMLElement => !!el && syncEl.contains(el))
                if (proseRoot) {
                  const rr = proseRoot.getBoundingClientRect()
                  if (rr.width > 0 && rr.height > 0) {
                    targetRect = rr
                    const slideRaw = proseRoot.getAttribute('data-slide-index')
                    const blockRaw = proseRoot.getAttribute('data-block-index')
                    const parsedSlide = slideRaw != null ? Number(slideRaw) : Number.NaN
                    const parsedBlock = blockRaw != null ? Number(blockRaw) : Number.NaN
                    if (Number.isFinite(parsedSlide)) pointerSlideIndex = parsedSlide
                    if (Number.isFinite(parsedBlock)) pointerBlockIndex = parsedBlock
                  }
                }
                const relX = (e.clientX - targetRect.left) / targetRect.width
                const relY = (e.clientY - targetRect.top) / targetRect.height
                sendToStudentView({
                  type: 'mouse-click',
                  slideContentPane: true,
                  slidePointerBody: true,
                  pointerProseBlock: pointerSlideIndex != null && pointerBlockIndex != null,
                  pointerSlideIndex,
                  pointerBlockIndex,
                  relX: Math.max(0, Math.min(1, relX)),
                  relY: Math.max(0, Math.min(1, relY)),
                })
                return
              }
            }
          }
          const layoutEl = teacherSlideContentLayoutRef.current
          if (layoutEl) {
            const lr = layoutEl.getBoundingClientRect()
            if (lr.width > 0 && lr.height > 0) {
              const relX = (e.clientX - lr.left) / lr.width
              const relY = (e.clientY - lr.top) / lr.height
              sendToStudentView({
                type: 'mouse-click',
                slideContentPane: true,
                slidePointerBody: false,
                relX: Math.max(0, Math.min(1, relX)),
                relY: Math.max(0, Math.min(1, relY)),
              })
              return
            }
          }
        }
      }
      sendToStudentView({
        type: 'mouse-click',
        normX: Math.max(0, Math.min(1, e.clientX / w)),
        normY: Math.max(0, Math.min(1, e.clientY / h)),
        xrPx: Math.max(0, w - e.clientX),
        yPx: Math.max(0, Math.min(h, e.clientY)),
      })
    }
    window.addEventListener('mousemove', sendPointerMove)
    window.addEventListener('mousedown', sendPointerClick)
    return () => {
      window.removeEventListener('mousemove', sendPointerMove)
      window.removeEventListener('mousedown', sendPointerClick)
    }
  }, [sendToStudentView, visualFullscreenOpen, infographicFullscreenOpen, quizPopupOpen, worksheetId, leftPanelMode, activeVisualInfographic, slideViewMode])

  useEffect(() => {
    if (!studentViewOpened) return
    if (slideViewMode !== 'single') return
    const el = teacherSlidePointerSyncRef.current ?? teacherSlideContentLayoutRef.current
    if (!el) return
    const emit = () => {
      const w = Math.round(el.getBoundingClientRect().width)
      if (w > 0) sendToStudentView({ type: 'slide-content-layout', layoutW: w })
    }
    emit()
    const ro = new ResizeObserver(() => emit())
    ro.observe(el)
    return () => ro.disconnect()
  }, [studentViewOpened, slideViewMode, sendToStudentView, currentIndex])

  const openStudentView = useCallback(() => {
    if (typeof window === 'undefined') return
    const sw = typeof screen !== 'undefined' ? screen.availWidth || 1920 : 1920
    const sh = typeof screen !== 'undefined' ? screen.availHeight || 1080 : 1080
    const features = `width=${sw},height=${sh},left=0,top=0,scrollbars=no,resizable=yes`
    const { url: baseSlideUrl, windowName } = getStudentSlideWindowConfig(!!worksheetId)
    const urlWithSync = studentSlideUrlWithSync(baseSlideUrl, presentationSyncId)
    const kind = worksheetId ? 'worksheet' : 'curriculum'
    let targetWin: Window | null = null
    try {
      targetWin = window.open('', windowName)
    } catch {
      targetWin = null
    }
    if (!targetWin || targetWin.closed) {
      targetWin = window.open(urlWithSync, windowName, features)
    }
    if (!targetWin) {
      setStudentViewOpened(false)
      toast({
        title: tr('Không mở được giao diện học sinh', 'Cannot open student view', '无法打开学生界面', '生徒画面を開けません', '학생 화면을 열 수 없습니다'),
        description: tr('Trình duyệt đã chặn popup hoặc quyền focus cửa sổ.', 'Popup or window-focus permission was blocked by browser.', '浏览器阻止了弹窗或窗口聚焦权限。', 'ブラウザがポップアップまたはフォーカス権限をブロックしました。', '브라우저가 팝업 또는 창 포커스 권한을 차단했습니다.'),
        variant: 'destructive',
      })
      return
    }
    studentViewWindowRef.current = targetWin
    setStudentViewOpened(true)

    // Cùng phương thức với chiều Học sinh -> Giáo viên:
    // dùng named window trước, nếu sai URL thì điều hướng một lần.
    try {
      const path = targetWin.location.pathname || ''
      const syncOk = new URLSearchParams(targetWin.location.search || '').get('sync') === presentationSyncId
      if (!isPathMatchingStudentSlideKind(path, kind) || !syncOk) targetWin.location.href = urlWithSync
    } catch {
      /* ignore access errors */
    }

    try {
      targetWin.focus()
    } catch {
      toast({
        title: tr('Đã mở nhưng chưa focus được', 'Opened but cannot focus yet', '已打开但暂时无法聚焦', '開けましたがフォーカスできません', '열었지만 아직 포커스할 수 없습니다'),
        description: tr('Bạn có thể chọn cửa sổ học sinh trên taskbar để chuyển ngay.', 'Use taskbar to bring student window to front immediately.', '请在任务栏选择学生窗口以立即切换。', 'タスクバーから生徒ウィンドウを選択してください。', '작업 표시줄에서 학생 창을 선택해 바로 전환하세요.'),
      })
    }

    const sendState = () => {
      try {
        if (targetWin.closed) return
        const keepFullTextForAllSlides = studentCurriculumRemoteMode === 'markdown-all'
        const compactedSlides = compactSlidesForStudentWire(slides, currentIndex)
        targetWin.postMessage(
          {
            type: 'curriculum-data',
            content: keepFullTextForAllSlides ? content : '',
            topic,
            currentIndex,
            curriculumId: curriculumId ?? null,
            slideMode: slideMode ?? null,
            personalViewSubMode,
            hasOriginalSlides,
            slides: compactedSlides.map((s, i) => toStudentSlidePayload(s, i)),
            teacherTimerSeconds,
            teacherTimerRunning,
            worksheetId: !!worksheetId,
            worksheetAnswerReveal: worksheetId || curriculumId ? answerRevealProgress : undefined,
            worksheetAnswerTypingEnabled: worksheetId || curriculumId ? answerTypingEnabled : undefined,
            ...(!worksheetId
              ? {
                  studentCurriculumRightMode: studentCurriculumRemoteMode,
                  teacherSlideLeftPane:
                    leftPanelMode === 'infographic' || (leftPanelMode === 'visual' && currentVisualShowsInfographic)
                      ? ('infographic' as const)
                      : ('visual' as const),
                }
              : {}),
            ...(!worksheetId && activeVisualInfographic ? { curriculumInfographic: activeVisualInfographic } : {}),
            ...(!worksheetId && lessonInfographic ? { lessonInfographic } : {}),
          },
          window.location.origin
        )
        targetWin.postMessage({ type: 'presentation-mode', mode: 'slide-interaction' }, window.location.origin)
        targetWin.postMessage({ type: 'slide-go', index: currentIndex }, window.location.origin)
        if (visualFullscreenOpen) {
          targetWin.postMessage(
            {
              type: 'visual-fullscreen-open',
              cellIndex: typeof teacherExpandedCellIndex === 'number' ? teacherExpandedCellIndex : undefined,
            },
            window.location.origin
          )
        } else {
          targetWin.postMessage({ type: 'visual-fullscreen-close' }, window.location.origin)
        }
        if (infographicFullscreenOpen) {
          targetWin.postMessage({ type: 'infographic-fullscreen-open' }, window.location.origin)
        } else {
          targetWin.postMessage({ type: 'infographic-fullscreen-close' }, window.location.origin)
        }
        targetWin.postMessage({ type: 'teacher-timer-sync', seconds: teacherTimerSeconds, running: teacherTimerRunning }, window.location.origin)
      } catch {
        /* ignore postMessage errors */
      }
    }
    sendState()
    setTimeout(sendState, 300)
  }, [content, topic, currentIndex, curriculumId, slideMode, personalViewSubMode, hasOriginalSlides, slides, teacherTimerSeconds, teacherTimerRunning, visualFullscreenOpen, teacherExpandedCellIndex, infographicFullscreenOpen, toast, tr, worksheetId, answerRevealProgress, answerTypingEnabled, toStudentSlidePayload, presentationSyncId, studentCurriculumRemoteMode, activeVisualInfographic, lessonInfographic, leftPanelMode, infographicDrawStrokesBySlide, compactSlidesForStudentWire])

  const viewOpenedStudentView = useCallback(() => {
    if (typeof window === 'undefined') return
    const { windowName } = getStudentSlideWindowConfig(!!worksheetId)
    let targetWin: Window | null = null
    try {
      targetWin = window.open('', windowName)
    } catch {
      targetWin = studentViewWindowRef.current
    }
    if (!targetWin || targetWin.closed) {
      studentViewWindowRef.current = null
      setStudentViewOpened(false)
      toast({
        title: tr('Chưa có giao diện học sinh đang mở', 'Student view is not open yet', '学生界面尚未打开', '生徒画面はまだ開いていません', '학생 화면이 아직 열려 있지 않습니다'),
        description: tr('Hãy bấm "Mở giao diện học sinh" để mở lần đầu.', 'Click "Open student interface" for the first launch.', '请点击“打开学生界面”进行首次打开。', '初回は「生徒画面を開く」を押してください。', '처음에는 "학생 인터페이스 열기"를 눌러 주세요.'),
      })
      return
    }
    studentViewWindowRef.current = targetWin
    setStudentViewOpened(true)
    try {
      targetWin.focus()
    } catch {
      toast({
        title: tr('Đã tìm thấy cửa sổ học sinh', 'Student window found', '已找到学生窗口', '生徒ウィンドウを検出しました', '학생 창을 찾았습니다'),
        description: tr('Trình duyệt chưa cho phép focus ngay. Bạn có thể chọn cửa sổ trên taskbar.', 'Browser did not allow immediate focus. You can select it from taskbar.', '浏览器暂未允许立即聚焦。可在任务栏选择该窗口。', 'ブラウザが即時フォーカスを許可しませんでした。タスクバーから選択できます。', '브라우저가 즉시 포커스를 허용하지 않았습니다. 작업 표시줄에서 선택하세요.'),
      })
    }
  }, [toast, tr, worksheetId])

  const updateCurrentSlideVisualInput = useCallback((key: 'visualInput1' | 'visualInput2' | 'visualInput3' | 'visualInput4', value: string) => {
    visualManualEditedRef.current[currentIndex] = true
    visualAutoFillInitializedRef.current[currentIndex] = true
    if (key !== 'visualInput4' && String(value ?? '').trim().length === 0) {
      const current = visualAutoFillBlockedRef.current[currentIndex] ?? {}
      visualAutoFillBlockedRef.current[currentIndex] = { ...current, [key]: true }
    }
    setVisualInputsDirty(true)
    setSlides((prev) => {
      const next = prev.map((s, i) => (i === currentIndex ? { ...s, [key]: value } : s))
      slidesRef.current = next
      sendCurriculumDataToStudent(next, currentIndex)
      return next
    })
    // Đang gõ thì không lưu ngay; nếu có lần lưu chờ trước đó thì hủy.
    if (visualInputPersistTimeoutRef.current != null) {
      window.clearTimeout(visualInputPersistTimeoutRef.current)
      visualInputPersistTimeoutRef.current = null
    }
  }, [currentIndex, sendCurriculumDataToStudent])

  const handlePasteImageToVisualInput = useCallback(
    (key: 'visualInput1' | 'visualInput2' | 'visualInput3' | 'visualInput4', e: React.ClipboardEvent<HTMLInputElement>) => {
      const items = Array.from(e.clipboardData?.items ?? [])
      const imageItem = items.find((it) => it.kind === 'file' && it.type.startsWith('image/'))
      if (!imageItem) return
      const file = imageItem.getAsFile()
      if (!file) return
      e.preventDefault()
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: tr('Ảnh quá lớn', 'Image too large', '图片过大', '画像が大きすぎます', '이미지가 너무 큽니다'),
          description: tr('Vui lòng dán ảnh dưới 5MB.', 'Please paste an image under 5MB.', '请粘贴小于 5MB 的图片。', '5MB 未満の画像を貼り付けてください。', '5MB 미만 이미지를 붙여넣어 주세요.'),
          variant: 'destructive',
        })
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = String(reader.result ?? '')
        if (!dataUrl.startsWith('data:image/')) return
        updateCurrentSlideVisualInput(key, dataUrl)
        toast({
          title: tr('Đã dán ảnh vào ô Visual', 'Image pasted to Visual field', '已粘贴图片到可视化字段', 'Visual欄に画像を貼り付けました', 'Visual 칸에 이미지 붙여넣기 완료'),
          duration: 1500,
        })
      }
      reader.readAsDataURL(file)
    },
    [toast, tr, updateCurrentSlideVisualInput]
  )

  const persistCurrentVisualInputs = useCallback(() => {
    if (!curriculumId) return
    if (visualInputPersistTimeoutRef.current != null) {
      window.clearTimeout(visualInputPersistTimeoutRef.current)
    }
    // Rời ô xong chờ một chút rồi mới lưu để tránh nháy khi đang thao tác liên tiếp.
    visualInputPersistTimeoutRef.current = window.setTimeout(() => {
      visualInputPersistTimeoutRef.current = null
      setVisualInputsDirty(false)
      void persistSlidesRef.current(slidesRef.current)
    }, 1800)
  }, [curriculumId])

  const sendNotesToParent = useCallback((value: string) => {
    if (window.opener) window.opener.postMessage({ type: 'update-notes', slideIndex: currentIndex, teacherNotes: value }, window.location.origin)
  }, [currentIndex])

  const sendMergeSlides = useCallback((index: number) => {
    if (index < 0 || index >= slides.length - 1) return
    const a = slides[index]
    const b = slides[index + 1]
    const merged: SlideItem = {
      ...a,
      blocks: [...(a.blocks || []), ...(b.blocks || [])],
      teacherNotes: (a.teacherNotes || '') + (b.teacherNotes ? '\n\n' + b.teacherNotes : ''),
    }
    const next = [...slides.slice(0, index), merged, ...slides.slice(index + 2)]
    const nextCurrentIndex = currentIndex === index + 1 ? index : currentIndex > index + 1 ? currentIndex - 1 : currentIndex

    setSlides(next)
    setCurrentIndex(nextCurrentIndex)
    if (curriculumId) void persistSlidesRef.current(next)
    if (window.opener) window.opener.postMessage({ type: 'merge-slides', index }, window.location.origin)
    try {
      const w = studentViewWindowRef.current
      if (w && !w.closed) w.postMessage({ type: 'merge-slides', index }, window.location.origin)
    } catch { /* ignore */ }
    // Đồng bộ full state sau khi gộp để giao diện học sinh không bị lệch slide.
    sendCurriculumDataToStudent(next, nextCurrentIndex)
    toast({ title: tr('Đã gộp 2 slide', 'Merged 2 slides', '已合并2张幻灯片', '2スライドを結合', '2개 슬라이드 병합'), duration: 1500 })
  }, [slides, currentIndex, curriculumId, sendCurriculumDataToStudent, toast, tr])

  const sendSplitSlide = useCallback((index: number, splitAtBlock: number) => {
    const s = slides[index]
    const blks = Array.isArray(s?.blocks) ? s.blocks : (s?.content ? parseContentToBlocks(s.content) : [])
    let firstBlocks: typeof blks
    let secondBlocks: typeof blks
    let secondHeader: string
    if (splitAtBlock === -1 && blks.length === 1) {
      const singleBlock = blks[0]
      const content = singleBlock?.content ?? ''
      const split = splitBlockContentAtQuizBoundary(content)
      if (!split) return
      firstBlocks = [{ header: singleBlock?.header ?? 'Nội dung', content: split.before }]
      secondBlocks = [{ header: singleBlock?.header ?? s.title, content: split.after }]
      secondHeader = singleBlock?.header ?? s.title
    } else if (splitAtBlock >= 0 && splitAtBlock < blks.length - 1) {
      firstBlocks = blks.slice(0, splitAtBlock + 1)
      secondBlocks = blks.slice(splitAtBlock + 1)
      secondHeader = secondBlocks[0]?.header ?? s.title
    } else {
      return
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
    const next = [...slides.slice(0, index), slide1, slide2, ...slides.slice(index + 1)]
    const nextCurrentIndex = currentIndex > index ? currentIndex + 1 : currentIndex

    setSlides(next)
    setCurrentIndex(nextCurrentIndex)
    if (curriculumId) void persistSlidesRef.current(next)
    if (window.opener) window.opener.postMessage({ type: 'split-slide', index, splitAtBlock }, window.location.origin)
    try {
      const w = studentViewWindowRef.current
      if (w && !w.closed) w.postMessage({ type: 'split-slide', index, splitAtBlock }, window.location.origin)
    } catch { /* ignore */ }
    // Đồng bộ full state sau khi tách để giao diện học sinh cập nhật đúng danh sách slide.
    sendCurriculumDataToStudent(next, nextCurrentIndex)
    setSplitAtBlock(null)
    toast({ title: tr('Đã tách slide', 'Split slide', '已拆分幻灯片', 'スライドを分割', '슬라이드 분할'), duration: 1500 })
  }, [slides, currentIndex, curriculumId, sendCurriculumDataToStudent, toast, tr])

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

  const gvWorksheetEditBlocks = useMemo(
    () => parseWorksheetIntoBlocks(worksheetMarkdownSource),
    [worksheetMarkdownSource]
  )

  const resetGvWorksheetEdit = useCallback(() => {
    setGvWorksheetEditFilter(null)
    setGvWorksheetEditBlockIndex(null)
    setGvWorksheetEditBlockContent('')
    setGvWorksheetEditImages([])
    setGvWorksheetEditCheckResult(null)
  }, [])

  const reloadWorksheetSlidesAfterSave = useCallback(async () => {
    const id = worksheetId?.trim()
    if (!id) return
    const r = await fetch(`/api/worksheet/${encodeURIComponent(id)}`)
    const data = await r.json().catch(() => ({}))
    if (data.error) return
    const markdown = data.content_markdown ?? ''
    const qTypes = Array.isArray(data.questions)
      ? (data.questions as Array<{ type?: string }>).map((q) => q.type ?? '')
      : []
    setWorksheetMarkdownSource(markdown)
    setWorksheetQuestionTypes(qTypes)
    const questions = Array.isArray(data.questions) ? data.questions : null
    const aiSlides = questions?.length ? questionsToSlides(questions) : parseWorksheetToSlides(markdown)
    const readable = latexToReadable(markdown)
    const sl = aiSlides.map((s) => ({
      title: s.title,
      blocks: s.blocks ?? [],
      teacherNotes: '',
      content: s.blocks?.map((b) => `${b.header ? `### ${b.header}\n` : ''}${b.content}`).join('\n\n') ?? '',
    }))
    setContent(readable)
    setSlides(sl)
    slidesRef.current = sl
    /* useEffect theo slides + sendCurriculumDataToStudent sẽ đẩy sang HS sau render (content đồng bộ) */
  }, [worksheetId])

  const loadGvWorksheetEditorAtGlobalIndex = useCallback(
    async (globalIdx: number) => {
      const id = worksheetId?.trim()
      if (!id || !worksheetMarkdownSource.trim()) return
      const blocks = parseWorksheetIntoBlocks(worksheetMarkdownSource)
      const block = blocks[globalIdx]
      if (!block) return
      setGvWorksheetEditFilter(block.type)
      setGvWorksheetEditBlockIndex(globalIdx)
      let nextContent = toEditableBlockContent(block.content, block.type === 'essay' ? 'essay' : 'quiz')
      try {
        const res = await fetch(`/api/worksheet/${encodeURIComponent(id)}`)
        const data = await res.json().catch(() => ({}))
        const list = Array.isArray(data?.questions) ? (data.questions as Array<{ type?: string; content_json?: unknown }>) : []
        const sameTypeIdx = blocks.slice(0, globalIdx + 1).filter((b2) => b2.type === block.type).length - 1
        const row = list.filter((q) => q?.type === block.type)[sameTypeIdx]
        if (row && block.type === 'essay') {
          const heading = (nextContent.match(/^([^\n]*Bài\s+\d+[^\n]*)/i)?.[1] ?? '').trim()
          const problem = latexToReadable(getEssayProblem(row.content_json) || '')
          const solution = normalizeSolutionToStr(getEssaySolution(row.content_json)) || '(Chưa có lời giải)'
          nextContent = [heading, problem, '**Lời giải:**', solution].filter(Boolean).join('\n\n')
        }
      } catch {
        /* giữ markdown */
      }
      setGvWorksheetEditBlockContent(nextContent)
      setGvWorksheetEditImages([])
      setGvWorksheetEditCheckResult(null)
    },
    [worksheetId, worksheetMarkdownSource]
  )

  const openWorksheetBlockEditorFromSlide = useCallback(
    async (slideIndex: number) => {
      const id = worksheetId?.trim()
      if (!id || !worksheetMarkdownSource.trim()) {
        toast({
          title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
          description: tr('Chưa có dữ liệu phiếu bài tập.', 'No worksheet data.', '无练习数据。', 'ワークシートがありません。', '워크시트 데이터 없음'),
          variant: 'destructive',
        })
        return
      }
      const slide = slides[slideIndex]
      const slideText = slide ? (slide.blocks ?? []).map((bl) => bl.content ?? '').join('\n\n') : ''
      const globalIdx = resolveWorksheetEditBlockGlobalIndex(worksheetMarkdownSource, slideIndex, worksheetQuestionTypes, slideText)
      if (globalIdx == null) {
        toast({
          title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
          description: tr(
            'Không xác định được câu tương ứng trong phiếu.',
            'Could not map this slide to a worksheet question.',
            '无法将此页对应到练习中的题目。',
            'このスライドをワークシートの問題に対応付けできません。',
            '슬라이드를 워크시트 문항과 매칭할 수 없습니다.',
          ),
          variant: 'destructive',
        })
        return
      }
      await loadGvWorksheetEditorAtGlobalIndex(globalIdx)
    },
    [worksheetId, worksheetMarkdownSource, worksheetQuestionTypes, slides, toast, tr, loadGvWorksheetEditorAtGlobalIndex]
  )

  const handleGvSaveWorksheetBlockEdit = useCallback(
    async (opts?: { skipAiCheck?: boolean; contentOverride?: string }) => {
      const id = worksheetId?.trim()
      const blockIdx = gvWorksheetEditBlockIndex
      if (!id || blockIdx == null || blockIdx < 0 || blockIdx >= gvWorksheetEditBlocks.length) return
      const block = gvWorksheetEditBlocks[blockIdx]
      const edited = opts?.contentOverride ?? gvWorksheetEditBlockContent
      if (!edited || edited.trim().length < 3) {
        toast({
          title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
          description: tr('Nội dung câu quá ngắn.', 'Question content is too short.', '题目内容太短。', '問題の内容が短すぎます。', '문제 내용이 너무 짧습니다.'),
          variant: 'destructive',
        })
        return
      }
      const originalContent = worksheetMarkdownSource.slice(block.startOffset, block.endOffset)
      if (originalContent === edited) {
        resetGvWorksheetEdit()
        return
      }
      const skipAiCheck = opts?.skipAiCheck === true
      const curriculumContext = ''
      setGvWorksheetEditSaving(true)
      try {
        if (!skipAiCheck) {
          if (gvWorksheetEditImages.length > 0) {
            const blockType = block?.type ?? 'quiz'
            const fdCheck = new FormData()
            fdCheck.append('content', edited)
            fdCheck.append('blockType', blockType)
            fdCheck.append('curriculum', curriculumContext)
            gvWorksheetEditImages.forEach((f) => fdCheck.append('images', f))
            const checkRes = await fetch('/api/worksheet-edit-check', { method: 'POST', body: fdCheck })
            const checkData = await checkRes.json().catch(() => ({}))
            if (checkData.error) {
              toast({ title: tr('Lỗi kiểm tra', 'Check failed', '检查失败', 'チェック失敗', '검사 실패'), description: checkData.error, variant: 'destructive' })
              return
            }
            setGvWorksheetEditCheckResult({ issues: checkData.issues ?? [], correctedContent: checkData.correctedContent ?? null })
            if (Array.isArray(checkData.issues) && checkData.issues.length > 0) {
              toast({
                title: tr('Chưa lưu', 'Not saved', '未保存', '未保存', '저장 안 됨'),
                description: tr(
                  'Có lỗi theo ảnh đính kèm. Vui lòng sửa rồi lưu lại.',
                  'There are issues based on attached images. Please fix and save again.',
                  '根据附图检测到问题，请修改后再保存。',
                  '添付画像ベースで問題が見つかりました。修正して再保存してください。',
                  '첨부 이미지 기준 오류가 있습니다. 수정 후 다시 저장하세요.',
                ),
                variant: 'destructive',
              })
              return
            }
          } else {
            const CONTEXT_CHARS = 250
            const contextStart = Math.max(0, block.startOffset - CONTEXT_CHARS)
            const originalRegion = worksheetMarkdownSource.slice(contextStart, block.endOffset)
            const editedRegion = worksheetMarkdownSource.slice(contextStart, block.startOffset) + edited
            const res = await fetch('/api/curriculum-edit-check', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ originalRegion, editedRegion }),
            })
            const data = await res.json().catch(() => ({}))
            const rc = data.regionCompare
            const canSave = !!(data.ok && data.bothAgree && rc?.correctVersion === 'edited')
            if (!canSave) {
              let restored = toEditableBlockContent(originalContent, block.type)
              try {
                const wres = await fetch(`/api/worksheet/${encodeURIComponent(id)}`)
                const wdata = await wres.json().catch(() => ({}))
                const list = Array.isArray(wdata?.questions) ? (wdata.questions as Array<{ type?: string; content_json?: unknown }>) : []
                const sameTypeIdx = gvWorksheetEditBlocks.slice(0, blockIdx + 1).filter((b2) => b2.type === block.type).length - 1
                const row = list.filter((q) => q?.type === block.type)[sameTypeIdx]
                if (row && block.type === 'essay') {
                  const heading = (restored.match(/^([^\n]*Bài\s+\d+[^\n]*)/i)?.[1] ?? '').trim()
                  const problem = latexToReadable(getEssayProblem(row.content_json) || '')
                  const solution = normalizeSolutionToStr(getEssaySolution(row.content_json)) || '(Chưa có lời giải)'
                  restored = [heading, problem, '**Lời giải:**', solution].filter(Boolean).join('\n\n')
                }
              } catch {
                /* fallback */
              }
              setGvWorksheetEditBlockContent(restored)
              setGvWorksheetEditCheckResult(null)
              toast({
                title: tr('Chưa lưu', 'Not saved', '未保存', '未保存', '저장 안 됨'),
                description:
                  (data.reasonNotSaved || rc?.explanation || tr('AI chưa đồng ý bản sửa.', 'AI did not approve this edit.', 'AI尚未同意该修改。', 'AIがこの編集を承認していません。', 'AI가 이 수정을 승인하지 않았습니다.')) +
                  ' ' +
                  tr('Đã hoàn nguyên nội dung gốc.', 'Reverted to original content.', '已恢复原内容。', '元の内容に戻しました。', '원본 내용으로 복원했습니다.'),
                variant: 'destructive',
              })
              return
            }
          }
        }
        const newMarkdown = replaceBlockInMarkdown(worksheetMarkdownSource, block, edited)
        const fd = new FormData()
        fd.append('worksheetId', id)
        fd.append('contentMarkdown', newMarkdown)
        const saveRes = await saveWorksheetContent(fd)
        if (saveRes?.error) {
          toast({
            title: tr('Lỗi lưu phiếu', 'Save worksheet failed', '保存练习失败', 'ワークシート保存失敗', '워크시트 저장 실패'),
            description: saveRes.error,
            variant: 'destructive',
          })
          return
        }
        resetGvWorksheetEdit()
        toast({
          title: tr('Đã lưu', 'Saved', '已保存', '保存しました', '저장됨'),
          description: skipAiCheck
            ? tr('Đã áp dụng sửa và lưu.', 'Applied fixes and saved.', '已应用修改并保存。', '修正を適用して保存しました。', '수정 적용 후 저장했습니다.')
            : tr('AI đã kiểm tra và lưu câu đã sửa.', 'AI checked and saved the edited question.', 'AI已检查并保存修改的题目。', 'AIが確認して修正した問題を保存しました。', 'AI가 확인 후 수정한 문제를 저장했습니다.'),
        })
        await reloadWorksheetSlidesAfterSave()
      } finally {
        setGvWorksheetEditSaving(false)
      }
    },
    [
      worksheetId,
      gvWorksheetEditBlockIndex,
      gvWorksheetEditBlockContent,
      gvWorksheetEditBlocks,
      gvWorksheetEditImages,
      worksheetMarkdownSource,
      toast,
      tr,
      resetGvWorksheetEdit,
      reloadWorksheetSlidesAfterSave,
    ]
  )

  const handleGvCheckWorksheetBlock = useCallback(async () => {
    const content = gvWorksheetEditBlockContent.trim()
    if (!content || content.length < 5) {
      toast({
        title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
        description: tr('Nội dung câu quá ngắn.', 'Content too short.', '内容太短。', '内容が短すぎます。', '내용이 너무 짧습니다.'),
        variant: 'destructive',
      })
      return
    }
    const blockIdx = gvWorksheetEditBlockIndex
    const block = blockIdx != null ? gvWorksheetEditBlocks[blockIdx] : null
    const blockType = block?.type ?? 'quiz'
    setGvWorksheetEditCheckLoading(true)
    setGvWorksheetEditCheckResult(null)
    try {
      let res: Response
      if (gvWorksheetEditImages.length > 0) {
        const fd = new FormData()
        fd.append('content', content)
        fd.append('blockType', blockType)
        fd.append('curriculum', '')
        gvWorksheetEditImages.forEach((f) => fd.append('images', f))
        res = await fetch('/api/worksheet-edit-check', { method: 'POST', body: fd })
      } else {
        res = await fetch('/api/worksheet-edit-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, blockType, curriculum: '' }),
        })
      }
      const data = await res.json().catch(() => ({}))
      if (data.error) {
        toast({ title: tr('Lỗi kiểm tra', 'Check failed', '检查失败', 'チェック失敗', '검사 실패'), description: data.error, variant: 'destructive' })
        return
      }
      setGvWorksheetEditCheckResult({ issues: data.issues ?? [], correctedContent: data.correctedContent ?? null })
      if (!data.issues?.length) {
        toast({
          title: tr('Không có lỗi', 'No issues', '无问题', '問題なし', '문제 없음'),
          description: tr('Câu đã đúng, có thể lưu.', 'Question is correct, you can save.', '题目正确，可以保存。', '問題は正しいです。保存できます。', '문제가 맞습니다. 저장하세요.'),
          duration: 2000,
        })
      }
    } finally {
      setGvWorksheetEditCheckLoading(false)
    }
  }, [gvWorksheetEditBlockIndex, gvWorksheetEditBlockContent, gvWorksheetEditBlocks, gvWorksheetEditImages, toast, tr])

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
    visualAutoFillBlockedRef.current = {}
    visualAutoFillInitializedRef.current = {}
    visualManualEditedRef.current = {}
  }, [curriculumId])

  useEffect(() => {
    return () => {
      if (visualInputPersistTimeoutRef.current != null) {
        window.clearTimeout(visualInputPersistTimeoutRef.current)
        visualInputPersistTimeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (leftPanelMode !== 'visual') return
    const currentSlide = slides[currentIndex]
    const hasMeaningful = hasMeaningfulVisualInputs(currentSlide)
    if (visualAutoFillInitializedRef.current[currentIndex] && hasMeaningful) return
    if (visualManualEditedRef.current[currentIndex] && hasMeaningful) return
    let didUpdate = false
    setSlides((prev) => {
      const s = prev[currentIndex]
      if (!s) return prev
      const hasAnyVisualInput = hasMeaningfulVisualInputs(s)
      if (hasAnyVisualInput) {
        visualAutoFillInitializedRef.current[currentIndex] = true
        return prev
      }

      const sourceNoInputs: SlideItem = {
        ...s,
        visualInput1: '',
        visualInput2: '',
        visualInput3: '',
        visualInput4: '',
      }
      const expr = extractPlotExpressionFromSlide(sourceNoInputs)
      const domain = detectDomainConstraintFromSlide(sourceNoInputs)
      const preferredInputs: string[] = []
      if (expr) preferredInputs.push(toUnicodeMathExpression(`y=${expr}`))
      if (domain) preferredInputs.push(domain)

      const blocked = visualAutoFillBlockedRef.current[currentIndex] ?? {}

      let changed = false
      const nextSlide: SlideItem = {
        ...s,
        visualInput1: isVisualInputTemplateText(String(s.visualInput1 ?? '')) ? '' : s.visualInput1,
        visualInput2: isVisualInputTemplateText(String(s.visualInput2 ?? '')) ? '' : s.visualInput2,
        visualInput3: isVisualInputTemplateText(String(s.visualInput3 ?? '')) ? '' : s.visualInput3,
        visualInput4: isVisualInputTemplateText(String(s.visualInput4 ?? '')) ? '' : s.visualInput4,
      }
      if (preferredInputs.length > 0) {
        const currentVal = String(nextSlide.visualInput1 ?? '').trim()
        if ((!currentVal || isVisualInputTemplateText(currentVal)) && !blocked.visualInput1) {
          nextSlide.visualInput1 = preferredInputs.join(', ')
          changed = true
        }
      }
      if (!changed) return prev

      didUpdate = true
      visualAutoFillInitializedRef.current[currentIndex] = true
      const next = prev.map((item, idx) => (idx === currentIndex ? nextSlide : item))
      queueMicrotask(() => sendCurriculumDataToStudent(next, currentIndex))
      return next
    })
    if (!didUpdate) visualAutoFillInitializedRef.current[currentIndex] = true
    if (didUpdate) setVisualInputsDirty(true)
  }, [leftPanelMode, currentIndex, slides, sendCurriculumDataToStudent])

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
          const keepFullTextForAllSlides = studentCurriculumRemoteMode === 'markdown-all'
          const compactedSlides = compactSlidesForStudentWire(slides, currentIndex)
          src.postMessage(
            {
              type: 'curriculum-data',
              content: keepFullTextForAllSlides ? content : '',
              topic,
              currentIndex,
              curriculumId: curriculumId ?? null,
              slideMode: slideMode ?? null,
              personalViewSubMode,
              hasOriginalSlides,
              slides: compactedSlides.map((s, i) => toStudentSlidePayload(s, i)),
              teacherTimerSeconds,
              teacherTimerRunning,
              worksheetId: !!worksheetId,
              worksheetAnswerReveal: worksheetId || curriculumId ? answerRevealProgress : undefined,
              worksheetAnswerTypingEnabled: worksheetId || curriculumId ? answerTypingEnabled : undefined,
              ...(!worksheetId
                ? {
                    studentCurriculumRightMode: studentCurriculumRemoteMode,
                    teacherSlideLeftPane:
                      leftPanelMode === 'infographic' || (leftPanelMode === 'visual' && currentVisualShowsInfographic)
                        ? ('infographic' as const)
                        : ('visual' as const),
                  }
                : {}),
              ...(!worksheetId && activeVisualInfographic ? { curriculumInfographic: activeVisualInfographic } : {}),
              ...(!worksheetId && lessonInfographic ? { lessonInfographic } : {}),
            },
            window.location.origin
          )
          src.postMessage({ type: 'presentation-mode', mode: 'slide-interaction' }, window.location.origin)
        } catch {
          /* ignore */
        }
      }
      if (e.data?.type === 'teacher-focus-request') {
        try {
          window.focus()
        } catch {
          /* ignore */
        }
      }
      if (e.data?.type === 'visual-fullscreen-open' && e.data?.fromStudent && e.source === studentViewWindowRef.current) {
        setInfographicFullscreenOpen(false)
        setVisualFullscreenOpen(true)
        setTeacherExpandedCellIndex(typeof e.data?.cellIndex === 'number' ? e.data.cellIndex : null)
      }
      if (e.data?.type === 'visual-fullscreen-close') {
        setVisualFullscreenOpen(false)
        if (e.data?.returnTeacher) {
          try {
            window.focus()
          } catch {
            /* ignore */
          }
        }
      }
      if (e.data?.type === 'infographic-fullscreen-open' && e.data?.fromStudent && e.source === studentViewWindowRef.current) {
        setVisualFullscreenOpen(false)
        setTeacherExpandedCellIndex(null)
        setInfographicFullscreenOpen(true)
      }
      if (e.data?.type === 'infographic-fullscreen-close') {
        setInfographicFullscreenOpen(false)
        if (e.data?.returnTeacher) {
          try {
            window.focus()
          } catch {
            /* ignore */
          }
        }
      }
      if (e.data?.type === 'infographic-draw-start' && typeof e.data?.slideIndex === 'number' && e.data?.stroke && e.source === studentViewWindowRef.current) {
        const stroke = e.data.stroke as InfographicDrawStroke
        if (stroke && typeof stroke.id === 'string' && Array.isArray(stroke.points)) {
          upsertInfographicStroke(e.data.slideIndex, {
            id: stroke.id,
            tool: stroke.tool === 'eraser' ? 'eraser' : 'pen',
            color: typeof stroke.color === 'string' ? stroke.color : '#ef4444',
            sizeNorm: typeof stroke.sizeNorm === 'number' ? Math.max(0.001, stroke.sizeNorm) : 0.004,
            points: stroke.points.map((p) => ({ u: clamp01(Number(p.u) || 0), v: clamp01(Number(p.v) || 0) })),
          })
        }
      }
      if (
        e.data?.type === 'infographic-draw-point' &&
        typeof e.data?.slideIndex === 'number' &&
        typeof e.data?.strokeId === 'string' &&
        e.data?.point &&
        e.source === studentViewWindowRef.current
      ) {
        appendInfographicStrokePoint(e.data.slideIndex, e.data.strokeId, {
          u: clamp01(Number(e.data.point.u) || 0),
          v: clamp01(Number(e.data.point.v) || 0),
        })
      }
      if (
        e.data?.type === 'infographic-draw-points' &&
        typeof e.data?.slideIndex === 'number' &&
        typeof e.data?.strokeId === 'string' &&
        Array.isArray(e.data?.points) &&
        e.source === studentViewWindowRef.current
      ) {
        const points = (e.data.points as Array<{ u?: number; v?: number }>).map((p) => ({
          u: clamp01(Number(p?.u) || 0),
          v: clamp01(Number(p?.v) || 0),
        }))
        appendInfographicStrokePoints(e.data.slideIndex, e.data.strokeId, points)
      }
      if (e.data?.type === 'infographic-draw-clear' && typeof e.data?.slideIndex === 'number' && e.source === studentViewWindowRef.current) {
        clearInfographicStrokes(e.data.slideIndex)
      }
      if (e.data?.type === 'infographic-draw-undo' && typeof e.data?.slideIndex === 'number' && e.source === studentViewWindowRef.current) {
        undoInfographicStroke(e.data.slideIndex)
      }
      if (e.data?.type === 'infographic-draw-sync' && e.data?.strokesBySlide && e.source === studentViewWindowRef.current) {
        const incoming = e.data.strokesBySlide as Record<string, InfographicDrawStroke[]>
        const normalized: Record<number, InfographicDrawStroke[]> = {}
        for (const [k, list] of Object.entries(incoming ?? {})) {
          const idx = Number(k)
          if (!Number.isFinite(idx) || !Array.isArray(list)) continue
          normalized[idx] = list
            .filter((s) => s && typeof s.id === 'string' && Array.isArray(s.points))
            .map((s) => ({
              id: s.id,
              tool: s.tool === 'eraser' ? 'eraser' : 'pen',
              color: typeof s.color === 'string' ? s.color : '#ef4444',
              sizeNorm: typeof s.sizeNorm === 'number' ? Math.max(0.001, s.sizeNorm) : 0.004,
              points: s.points.map((p) => ({ u: clamp01(Number(p.u) || 0), v: clamp01(Number(p.v) || 0) })),
            }))
        }
        setInfographicDrawStrokesBySlide((prev) => foldInfographicStrokesToCurriculumKey({ ...prev, ...normalized }))
      }
      if (e.data?.type === 'slide-go' && typeof e.data?.index === 'number' && e.source === studentViewWindowRef.current) {
        const idx = Math.max(0, Math.min(e.data.index, slides.length - 1))
        commitCurrentSlideDraft()
        setCurrentIndex(idx)
      }
      if (
        e.data?.type === 'student-curriculum-right-mode-changed' &&
        (e.data?.mode === 'markdown-all' || e.data?.mode === 'single-slide') &&
        e.source === studentViewWindowRef.current
      ) {
        setStudentCurriculumRemoteMode(e.data.mode)
      }
      if (
        !worksheetId &&
        e.data?.type === 'student-curriculum-left-pane-changed' &&
        (e.data?.pane === 'infographic' || e.data?.pane === 'visual') &&
        e.source === studentViewWindowRef.current
      ) {
        setLeftPanelMode(e.data.pane)
      }
      if (e.data?.type === 'quiz-popup-open' && typeof e.data?.value === 'boolean' && e.source === studentViewWindowRef.current) {
        if (e.data.value) {
          openQuizPopupFresh()
        } else {
          setQuizPopupOpen(false)
        }
        if (e.data.value && typeof e.data?.scrollTop === 'number') {
          const el = document.querySelector('[data-quiz-popup-scroll]') as HTMLElement | null
          if (el) {
            quizPopupScrollApplyingRef.current = true
            el.scrollTop = e.data.scrollTop
            setTimeout(() => { quizPopupScrollApplyingRef.current = false }, 80)
          }
        }
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
        const fromKnownWindow =
          e.source === window.opener || (studentViewWindowRef.current != null && e.source === studentViewWindowRef.current)
        if (!fromKnownWindow) return
        let incomingKey = ''
        try {
          incomingKey = JSON.stringify({
            type: 'curriculum-data',
            content: e.data.content ?? '',
            topic: e.data.topic ?? '',
            currentIndex: e.data.currentIndex ?? 0,
            curriculumId: e.data.curriculumId ?? null,
            lessonNo: e.data.lessonNo ?? null,
            slideMode: e.data.slideMode ?? null,
            personalViewSubMode: e.data.personalViewSubMode ?? null,
            hasOriginalSlides: Boolean(e.data.hasOriginalSlides),
            worksheetId: Boolean(e.data.worksheetId),
            studentCurriculumRightMode: e.data.studentCurriculumRightMode ?? null,
            teacherSlideLeftPane: e.data.teacherSlideLeftPane ?? null,
            slides: Array.isArray(e.data.slides) ? e.data.slides : [],
            curriculumInfographicUrl:
              typeof e.data.curriculumInfographic?.imageUrl === 'string' ? e.data.curriculumInfographic.imageUrl : '',
            lessonInfographicUrl:
              typeof e.data.lessonInfographic?.imageUrl === 'string' ? e.data.lessonInfographic.imageUrl : '',
          })
        } catch {
          incomingKey = ''
        }
        if (incomingKey && incomingKey === lastIncomingCurriculumPayloadRef.current) return
        if (incomingKey) lastIncomingCurriculumPayloadRef.current = incomingKey

        const incomingCurriculumId = typeof e.data.curriculumId === 'string' ? e.data.curriculumId : null
        const incomingLessonNo = Number.isFinite(Number(e.data.lessonNo))
          ? Math.max(1, Math.floor(Number(e.data.lessonNo)))
          : null
        const sl = Array.isArray(e.data.slides) ? e.data.slides : []
        const incomingContent = typeof e.data.content === 'string' ? e.data.content : ''
        const incomingHasMaterial = incomingContent.trim().length > 0 || sl.length > 0
        const currentHasMaterial = content.trim().length > 0 || slidesRef.current.length > 0
        // Tránh payload rỗng từ tab trung gian làm "rơi" trang GV về màn Tải giáo trình.
        if (!incomingHasMaterial && currentHasMaterial) return

        setContent(incomingContent)
        setFullCurriculumMarkdown(
          typeof e.data.fullCurriculumMarkdown === 'string'
            ? e.data.fullCurriculumMarkdown
            : ''
        )
        setTopic(e.data.topic ?? '')
        setCurrentIndex(e.data.currentIndex ?? 0)
        setCurriculumId(incomingCurriculumId)
        setActiveLessonNo(incomingLessonNo)
        const mode = e.data.slideMode === 'personal' || e.data.slideMode === 'shared' || e.data.slideMode === 'original' ? e.data.slideMode : null
        setSlideMode(mode)
        if (mode === null) {
          setSlideTitles([])
          setSlides([])
          slidesRef.current = []
          setLessonInfographic(undefined)
          hasHydratedFromCurriculumRef.current = false
          return
        }
        if ((mode === 'personal' || mode === 'shared') && prevSlideModeRef.current !== mode) setSlideViewMode('single')
        prevSlideModeRef.current = mode
        setPersonalViewSubMode(e.data.personalViewSubMode === 'original' || e.data.personalViewSubMode === 'current' ? e.data.personalViewSubMode : 'current')
        setHasOriginalSlides(Boolean(e.data.hasOriginalSlides))
        if (Object.prototype.hasOwnProperty.call(e.data, 'curriculumInfographic')) {
          const ci = e.data.curriculumInfographic as SlideInfographic | null | undefined
          if (ci && typeof ci === 'object' && typeof ci.imageUrl === 'string') setCurriculumInfographic(ci)
          else setCurriculumInfographic(undefined)
        }
        if (Object.prototype.hasOwnProperty.call(e.data, 'lessonInfographic')) {
          const li = e.data.lessonInfographic as SlideInfographic | null | undefined
          if (li && typeof li === 'object' && typeof li.imageUrl === 'string') setLessonInfographic(li)
          else setLessonInfographic(undefined)
        }
        if (Object.prototype.hasOwnProperty.call(e.data ?? {}, 'infographicDrawStrokesBySlide')) {
          const incoming = e.data.infographicDrawStrokesBySlide as Record<string, InfographicDrawStroke[]> | undefined
          const normalized: Record<number, InfographicDrawStroke[]> = {}
          for (const [k, list] of Object.entries(incoming ?? {})) {
            const idx = Number(k)
            if (!Number.isFinite(idx) || !Array.isArray(list)) continue
            normalized[idx] = list
              .filter((s) => s && typeof s.id === 'string' && Array.isArray(s.points))
              .map((s) => ({
                id: s.id,
                tool: s.tool === 'eraser' ? 'eraser' : 'pen',
                color: typeof s.color === 'string' ? s.color : '#ef4444',
                sizeNorm: typeof s.sizeNorm === 'number' ? Math.max(0.001, s.sizeNorm) : 0.004,
                points: s.points.map((p) => ({ u: clamp01(Number(p.u) || 0), v: clamp01(Number(p.v) || 0) })),
              }))
          }
          setInfographicDrawStrokesBySlide((prev) => foldInfographicStrokesToCurriculumKey({ ...prev, ...normalized }))
        }
        const sanitizedSlides = sl.map((s: SlideItem) => normalizeSlideVisualInputs(s))
        setSlideTitles(sanitizedSlides.map((s: SlideItem) => s?.title ?? ''))
        setSlides(sanitizedSlides)
        slidesRef.current = sanitizedSlides
        hasHydratedFromCurriculumRef.current = true
        sanitizedSlides.forEach((s: SlideItem, i: number) => {
          const hasAny = [s?.visualInput1, s?.visualInput2, s?.visualInput3, s?.visualInput4]
            .some((v) => !isVisualInputTemplateText(String(v ?? '')))
          if (hasAny) visualAutoFillInitializedRef.current[i] = true
        })
        setTeacherTimerSeconds(typeof e.data.teacherTimerSeconds === 'number' ? e.data.teacherTimerSeconds : 0)
        setTeacherTimerRunning(Boolean(e.data.teacherTimerRunning))
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [content, topic, currentIndex, curriculumId, slideMode, personalViewSubMode, hasOriginalSlides, slides, teacherTimerSeconds, teacherTimerRunning, quizPopupOpen, openQuizPopupFresh, worksheetId, answerRevealProgress, answerTypingEnabled, toStudentSlidePayload, studentCurriculumRemoteMode, commitCurrentSlideDraft, activeVisualInfographic, lessonInfographic, leftPanelMode, infographicDrawStrokesBySlide, upsertInfographicStroke, appendInfographicStrokePoint, appendInfographicStrokePoints, clearInfographicStrokes, undoInfographicStroke, compactSlidesForStudentWire])

  useEffect(() => {
    if (worksheetId) return
    if (!studentViewOpened) return
    sendToStudentView({
      type: 'student-curriculum-left-pane',
      pane: currentVisualShowsInfographic ? 'infographic' : 'visual',
    })
  }, [worksheetId, studentViewOpened, currentVisualShowsInfographic, sendToStudentView])

  useEffect(() => {
    slidesRef.current = slides
  }, [slides])

  useEffect(() => {
    // Chuyển slide thì lưu ngay phần visual đang chỉnh (không chờ blur timeout).
    if (curriculumId && visualInputsDirty) {
      if (visualInputPersistTimeoutRef.current != null) {
        window.clearTimeout(visualInputPersistTimeoutRef.current)
        visualInputPersistTimeoutRef.current = null
      }
      void persistSlidesRef.current(slidesRef.current)
    }
    setNotesValue(slides[currentIndex]?.teacherNotes ?? '')
    setNotesDirty(false)
    setVisualInputsDirty(false)
    setSplitAtBlock(null)
  }, [currentIndex, slides, curriculumId, visualInputsDirty])

  const handleBlur = useCallback(() => {
    setNotesDirty(false)
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

  const handleSaveAsPersonal = useCallback(async () => {
    if (!curriculumId || slides.length === 0) return
    setSaveAsPersonalLoading(true)
    try {
      const payload = slides.map((s) => ({
        title: s.title ?? '',
        blocks: (s.blocks ?? []).map((b) => ({ header: b?.header ?? '', content: b?.content ?? '' })),
        teacherNotes: s.teacherNotes ?? '',
        imageUrl: s.imageUrl,
        visualEmbed: s.visualEmbed,
        visualLayout: s.visualLayout,
        visualCells: s.visualCells,
      }))
      const r = await saveUserCustomizedSlides({
        curriculumId,
        slides: payload,
        curriculumInfographic: curriculumInfographicRef.current,
        lessonNo: activeLessonNo ?? undefined,
        lessonMode: slideMode === 'original' ? 'original' : 'personal',
      })
      if (r?.error) {
        toast({ title: tr('Lỗi lưu', 'Save error', '保存错误', '保存エラー', '저장 오류'), description: r.error, variant: 'destructive' })
      } else {
        toast({ title: tr('Đã lưu làm bản dùng riêng', 'Saved as personal version', '已保存为个人版', '個人版として保存しました', '개인 버전으로 저장됨'), duration: 1500 })
        sendRefreshPersonalAfterReset()
      }
    } finally {
      setSaveAsPersonalLoading(false)
    }
  }, [curriculumId, slides, toast, tr, sendRefreshPersonalAfterReset, activeLessonNo, slideMode])

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
    if (!visualFullscreenOpen && !infographicFullscreenOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (visualFullscreenOpen) closeTeacherVisualFullscreen()
      if (infographicFullscreenOpen) closeTeacherInfographicFullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visualFullscreenOpen, infographicFullscreenOpen, closeTeacherVisualFullscreen, closeTeacherInfographicFullscreen])

  return (
    <div className="fixed inset-0 z-50 h-screen w-screen overflow-x-hidden overflow-y-auto bg-slate-950 text-white flex flex-col items-stretch">
      {/* Layout neo phải: thu nhỏ tới đâu chỉ bị cắt phần bên trái tới đó */}
      <div
        className="flex-1 flex flex-col min-h-0 shrink-0 w-full"
      >
      {/* Thanh điều khiển đặt trên cùng */}
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
          hideTeacherLeftButtons
        />
      </div>

      <header className="shrink-0 border-b border-slate-700/80 bg-slate-900/80 backdrop-blur-sm flex flex-col">
        {/* Hàng thông tin – mobile: wrap, desktop: flex-nowrap */}
        <div className="px-3 md:px-5 py-2 flex items-center justify-end gap-2 md:gap-3 flex-wrap md:flex-nowrap landscape:flex-nowrap min-w-0 overflow-x-auto">
          <div className="flex items-center gap-2 md:gap-3 flex-wrap md:flex-nowrap landscape:flex-nowrap shrink-0 min-w-max">
            <span className="text-xs md:text-sm font-medium tabular-nums shrink-0 text-slate-300">{currentIndex + 1}/{slideTitles.length || slides.length}</span>
            <h1 className="text-sm md:text-base font-semibold text-amber-400/95 tracking-tight">
              {worksheetId ? tr('Phiếu bài tập + Ghi chú', 'Worksheet + Notes', '练习+备注', 'ワークシート+メモ', '워크시트+메모') : tr('Giáo trình + Ghi chú', 'Curriculum + Notes', '课程+备注', 'カリキュラム+メモ', '교육과정+메모')}
            </h1>
            {(slideMode || slideMode === null) && slides.length > 0 && (
              <span className={['text-xs font-medium px-2.5 py-1 rounded-md', slideMode === 'personal' ? 'bg-violet-500/25 text-violet-200 border border-violet-400/40' : 'bg-amber-500/25 text-amber-200 border border-amber-400/40'].join(' ')}>
                {slideMode === 'personal' ? tr('Bản riêng', 'Personal', '个人版', '個人版', '개인') : tr('Bản chung', 'Shared', '共享版', '共有版', '공유')}
              </span>
            )}
            {!curriculumId && !worksheetId && slides.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded bg-slate-600/40 text-amber-200/90" title={tr('Lưu giáo trình vào kho để sửa và đề xuất', 'Save curriculum to edit and propose', '保存课程以编辑和建议', '保存して編集・提案', '저장 후 편집·제안')}>
                {tr('Lưu giáo trình vào kho', 'Save to library', '保存到库', '保存して利用', '저장 후 사용')}
              </span>
            )}
            {worksheetId && slides.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded bg-slate-600/40 text-amber-200/90" title={tr('Phiếu bài tập', 'Worksheet', '练习', 'ワークシート', '워크시트')}>
                {tr('Phiếu bài tập', 'Worksheet', '练习', 'ワークシート', '워크시트')}
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
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => void handleSaveAsPersonal()} disabled={saveAsPersonalLoading} className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-violet-500/25 text-violet-200 border border-violet-400/40 hover:bg-violet-500/35 flex items-center gap-1.5 transition-colors disabled:opacity-50" title={tr('Lưu bản chung làm bản dùng riêng', 'Save shared as personal version', '将共享版保存为个人版', '共有版を個人版として保存', '공유 버전을 개인 버전으로 저장')}>
                  <Save className="h-3.5 w-3.5" />
                  {saveAsPersonalLoading ? tr('Đang lưu...', 'Saving...', '保存中...', '保存中...', '저장 중...') : tr('Lưu làm bản dùng riêng', 'Save as personal', '保存为个人版', '個人版として保存', '개인 버전으로 저장')}
                </button>
                <button type="button" onClick={() => setSharedHistoryOpen(true)} className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-600/40 text-slate-200 border border-slate-500/50 hover:bg-slate-600/60 flex items-center gap-1.5 transition-colors" title={tr('Lịch sử chỉnh sửa bản chung', 'Shared version edit history', '共享版本编辑历史', '共有版の編集履歴', '공유 버전 편집 기록')}>
                  <History className="h-3.5 w-3.5" />
                  {tr('Lịch sử', 'History', '历史', '履歴', '기록')}
                </button>
              </div>
            )}
            {topic && <span className="text-slate-400 text-sm truncate max-w-[min(100vw-6rem,240px)] md:max-w-[180px]" title={topic}>{topic}</span>}
          </div>
        </div>
      </header>

      {!content ? (
        <div className="flex-1 flex items-center justify-center p-4 md:p-8 bg-slate-900/30">
          <div className="text-center space-y-4 md:space-y-6 max-w-sm px-2">
            {worksheetLoading ? (
              <p className="text-slate-400 text-sm">{tr('Đang tải phiếu bài tập...', 'Loading worksheet...', '正在加载练习...', 'ワークシートを読み込み中...', '워크시트 로딩 중...')}</p>
            ) : worksheetId ? (
              <p className="text-slate-400 text-sm">{tr('Không tải được phiếu bài tập.', 'Could not load worksheet.', '无法加载练习。', 'ワークシートを読み込めません。', '워크시트를 불러올 수 없습니다.')}</p>
            ) : (
              <>
                <p className="text-slate-400 text-sm leading-relaxed">{tr('Mở giáo trình từ trang Tạo giáo trình (bấm "Xem slide" hoặc "Xem giáo trình").', 'Open curriculum from Create curriculum page (click "View slides" or "View curriculum").', '从创建课程页面打开课程（点击"查看幻灯片"或"查看课程"）。', '作成ページからカリキュラムを開く（「スライド表示」または「カリキュラムを見る」をクリック）。', '교육과정 생성 페이지에서 열기 ("슬라이드 보기" 또는 "교육과정 보기" 클릭).')}</p>
                <button type="button" onClick={requestCurriculum} className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium text-sm transition-colors shadow-lg shadow-amber-500/20">
                  {tr('Tải giáo trình', 'Load curriculum', '加载课程', 'カリキュラムを読み込む', '교육과정 로드')}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            'flex-1 flex min-h-0 isolate shrink-0 w-full',
            narrowTeacherLayout ? 'flex-col justify-start overflow-y-auto overflow-x-hidden' : 'flex-row justify-end overflow-hidden'
          )}
        >
          <div
            className={cn('shrink-0 flex min-h-0 min-w-0', narrowTeacherLayout ? 'w-full flex-1 min-h-0 flex flex-col' : 'h-full')}
            style={
              narrowTeacherLayout
                ? undefined
                : {
                    width: stableLayoutWidth,
                    /* Cố định minWidth theo tab — tránh đổi khi leftWidePanel để cột không giật */
                    minWidth: Math.max(stableLayoutWidth, 1280),
                  }
            }
          >
          <div
            className={cn(
              'min-w-0 shrink-0 flex flex-col overflow-hidden isolate bg-slate-900/20 border-slate-700/60',
              narrowTeacherLayout ? 'w-full max-h-[min(48vh,380px)] border-b border-r-0 flex-shrink-0' : 'border-r',
              /* Luôn 50% — không đổi 45%/50% theo tab (nguyên nhân cụm Giáo trình|Infographic|Visual bị nhảy) */
              !narrowTeacherLayout && 'w-1/2'
            )}
          >
            {/* Cùng chiều cao với header cột phải (md:h-14). w-full + min-w-0: nội dung markdown không làm giãn cột và đẩy cụm tab. */}
            <div className="flex h-12 w-full min-w-0 shrink-0 items-center justify-between gap-2 overflow-hidden border-b border-slate-700/60 bg-slate-900/30 px-3 text-xs font-medium uppercase tracking-wider text-slate-400 md:h-14 md:px-4">
              <span className="shrink-0 truncate">{worksheetId ? tr('Phiếu bài tập', 'Worksheet', '练习', 'ワークシート', '워크시트') : tr('Giáo trình', 'Curriculum', '课程', 'カリキュラム', '교육과정')}</span>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="ml-auto flex shrink-0 rounded-lg border border-slate-600/80 overflow-hidden bg-slate-800/50">
                  <button type="button" onClick={() => setLeftPanelMode('curriculum')} className={['px-3 py-1.5 text-[11px] font-medium transition-colors h-8 flex items-center', leftPanelMode === 'curriculum' ? 'bg-amber-500/30 text-amber-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'].join(' ')}>
                    {worksheetId ? tr('Phiếu bài tập', 'Worksheet', '练习', 'ワークシート', '워크시트') : tr('Giáo trình', 'Curriculum', '课程', 'カリキュラム', '교육과정')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeftPanelMode('visual')}
                    className={[
                      'px-3 py-1.5 text-[11px] font-medium transition-colors h-8 flex items-center border-l border-slate-600/70',
                      (leftPanelMode as string) === 'visual' ? 'bg-amber-500/30 text-amber-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50',
                    ].join(' ')}
                  >
                    {tr('Visual', 'Visual', '视觉', 'ビジュアル', '비주얼')}
                  </button>
                  {(() => {
                    const canExpandCurriculumLeft =
                      worksheetId
                        ? currentVisualHasAny
                        : leftPanelMode === 'curriculum'
                            ? currentVisualHasAny || !!activeVisualInfographic
                            : currentVisualHasAny
                    const runExpand = () => {
                      if (worksheetId) {
                        if (currentVisualHasAny) openTeacherVisualFullscreen()
                        return
                      }
                      if (leftPanelMode === 'curriculum') {
                        if (currentVisualHasAny) openTeacherVisualFullscreen()
                        else if (activeVisualInfographic) openTeacherInfographicFullscreen()
                        return
                      }
                      if (currentVisualHasAny) openTeacherVisualFullscreen()
                    }
                    const expandTitle =
                      worksheetId || leftPanelMode === 'visual'
                        ? currentVisualHasAny
                          ? tr('Mở rộng Visual toàn màn hình', 'Visual fullscreen', '视觉全屏', 'ビジュアル全画面', '비주얼 전체 화면')
                          : tr('Chưa có nội dung Visual trên slide này', 'No visual content on this slide', '此幻灯片尚无视觉内容', 'このスライドにビジュアルがありません', '이 슬라이드에 비주얼 없음')
                        : currentVisualHasAny
                          ? tr('Mở rộng Visual toàn màn hình', 'Visual fullscreen', '视觉全屏', 'ビジュアル全画面', '비주얼 전체 화면')
                          : activeVisualInfographic
                            ? tr('Infographic toàn màn hình', 'Infographic fullscreen', '信息图全屏', 'インフォグラフィック全画面', '인포그래픽 전체 화면')
                            : tr('Chưa có Visual hoặc infographic trên slide này', 'No visual or infographic for this slide', '此幻灯片尚无视觉或信息图', 'このスライドにビジュアル/インフォがありません', '이 슬라이드에 비주얼/인포 없음')
                    return (
                      <button
                        type="button"
                        disabled={!canExpandCurriculumLeft}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (canExpandCurriculumLeft) runExpand()
                        }}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (canExpandCurriculumLeft) runExpand()
                        }}
                        className={cn(
                          'py-1.5 px-3 text-[11px] border-l border-slate-600/70 h-8 flex items-center shrink-0',
                          canExpandCurriculumLeft
                            ? 'text-slate-200 hover:bg-slate-700/50'
                            : 'text-slate-500 cursor-not-allowed opacity-60'
                        )}
                        title={expandTitle}
                      >
                        <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )
                  })()}
                  <button type="button" className="px-3 py-1.5 text-slate-300/60 border-l border-slate-600/40 h-8 flex items-center cursor-default" title={tr('Luồng chèn đã tắt', 'Insert flow disabled', '插入流程已禁用', '挿入フローは無効', '삽입 흐름 비활성화')}>
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
            <div className={cn('min-w-0 flex-1 overflow-y-scroll overflow-x-hidden overscroll-y-contain p-4 space-y-3 pr-2 scroll-smooth min-h-0 text-left', leftWidePanel && 'p-0 pr-0 space-y-0 overflow-hidden')}>
              {leftPanelMode === 'visual' ? (
                (() => {
                  const s = slides[currentIndex]
                  if (!s) return <p className="text-slate-500 text-sm">{tr('Không có slide', 'No slide', '无幻灯片', 'スライドなし', '슬라이드 없음')}</p>
                  const { layout, cells } = getVisualCellsForPresentation(
                    s,
                    activeVisualInfographic,
                    [lessonInfographic?.imageUrl, curriculumInfographic?.imageUrl],
                    infographicSourceView !== 'visual'
                  )
                  const canGenerateVisualInfographic = !worksheetId && !curriculumInfographic && !!curriculumId
                  const visualInfographicCostLabel = formatCurriculumCredits(CURRICULUM_UI_CREDITS.slideInfographic2K)
                  const slideNum = currentIndex + 1
                  const gradient = DARK_GRADIENTS[currentIndex % DARK_GRADIENTS.length]
                  const infographicStableBackground = 'linear-gradient(180deg, #0b1220 0%, #0f172a 100%)'
                  const visualUsesCurriculumInfographic = cells.some((c) =>
                    c.imageUrl && visualImageIsCurriculumInfographic(c.imageUrl, activeVisualInfographic)
                  )
                  const visualUsesFourCellData = layout === 4 && cells.some((c) => c.visualEmbed || c.imageUrl)
                  const gridClass =
                    layout === 2 ? 'grid min-h-0 grid-rows-2 gap-1' : layout === 4 ? 'grid min-h-0 grid-cols-2 grid-rows-2 gap-1' : ''
                  return (
                    <div
                      key={activeVisualInfographicRenderKey}
                      className="h-full w-full relative overflow-hidden"
                      style={{
                        background: visualUsesCurriculumInfographic || visualUsesFourCellData ? infographicStableBackground : gradient,
                      }}
                    >
                      <div className="absolute top-4 left-4 w-9 h-9 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-sm shadow-lg z-10">
                        {slideNum}
                      </div>
                      {!worksheetId && (
                        <div className="absolute right-4 top-2 z-10 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleGenerateLessonInfographic}
                            disabled={lessonInfographicGenerating || !activeLessonNo || !curriculumId}
                            className="shrink-0 rounded-lg border border-cyan-300/60 bg-cyan-500/20 px-3 py-1.5 text-[11px] font-semibold tracking-normal text-cyan-100 hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {lessonInfographicGenerating
                              ? tr('Đang tạo...', 'Generating...', '生成中...', '生成中...', '생성 중...')
                              : infographicActionText('lesson', hasLessonInfographic, lessonInfographicCostLabel)}
                          </button>
                          <button
                            type="button"
                            onClick={handleGenerateCurriculumInfographic}
                            disabled={infographicGenerating || !curriculumId}
                            className="shrink-0 rounded-lg border border-amber-300/60 bg-amber-500/20 px-3 py-1.5 text-[11px] font-semibold tracking-normal text-amber-100 hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {infographicGenerating
                              ? tr('Đang tạo...', 'Generating...', '生成中...', '生成中...', '생성 중...')
                              : infographicActionText('curriculum', hasCurriculumInfographic, lessonInfographicCostLabel)}
                          </button>
                          <div className="flex shrink-0 overflow-hidden rounded-lg border border-slate-500/70 bg-slate-800/50">
                            <button
                              type="button"
                                onClick={() => handleSwitchInfographicSource('visual')}
                              className={cn(
                                'h-8 px-2.5 text-[11px] font-medium transition-colors',
                                infographicSourceView === 'visual'
                                  ? 'bg-violet-500/30 text-violet-200'
                                  : 'text-slate-300 hover:bg-slate-700/50'
                              )}
                              title={tr('Hiển thị visual của slide', 'Show slide visual', '显示幻灯片可视化', 'スライドのビジュアルを表示', '슬라이드 비주얼 표시')}
                            >
                              {tr('Xem visual', 'View visual', '看可视化', 'ビジュアル表示', '비주얼 보기')}
                            </button>
                            <button
                              type="button"
                                onClick={() => handleSwitchInfographicSource('lesson')}
                              disabled={!hasLessonInfographic}
                              className={cn(
                                'h-8 border-l border-slate-600/70 px-2.5 text-[11px] font-medium transition-colors',
                                infographicSourceView === 'lesson'
                                  ? 'bg-amber-500/30 text-amber-200'
                                  : 'text-slate-300 hover:bg-slate-700/50',
                                !hasLessonInfographic && 'cursor-not-allowed opacity-50 hover:bg-transparent'
                              )}
                              title={tr('Hiển thị ảnh infographic theo tiết', 'Show lesson infographic image', '显示课时信息图', '授業インフォグラフィックを表示', '차시 인포그래픽 표시')}
                            >
                              {tr('Ảnh tiết', 'Lesson image', '课时图', '授業画像', '차시 이미지')}
                            </button>
                            <button
                              type="button"
                                onClick={() => handleSwitchInfographicSource('curriculum')}
                              disabled={!hasCurriculumInfographic}
                              className={cn(
                                'h-8 border-l border-slate-600/70 px-2.5 text-[11px] font-medium transition-colors',
                                infographicSourceView === 'curriculum'
                                  ? 'bg-amber-500/30 text-amber-200'
                                  : 'text-slate-300 hover:bg-slate-700/50',
                                !hasCurriculumInfographic && 'cursor-not-allowed opacity-50 hover:bg-transparent'
                              )}
                              title={tr('Hiển thị ảnh infographic cả bài', 'Show curriculum infographic image', '显示全课信息图', '全体インフォグラフィックを表示', '전체 인포그래픽 표시')}
                            >
                              {tr('Ảnh cả bài', 'Curriculum image', '整课图', '全体画像', '전체 이미지')}
                            </button>
                          </div>
                        </div>
                      )}
                      <div ref={teacherEmbeddedVisualFrameRef} className={cn('absolute inset-0 min-h-0 pt-14 pb-4 px-4', layout === 1 ? 'flex flex-col' : gridClass)}>
                        {layout === 1 ? (
                          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-black/30">
                            <span className="absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs font-mono">
                              {slideNum}-1
                            </span>
                            {cells[0]?.visualEmbed ? (
                              (() => {
                                const embeds = parseContentEmbeds(cells[0].visualEmbed)
                                const first = embeds[0]
                                if (!first) return <div className="min-h-0 flex-1" />
                                return (
                                  <div className="flex min-h-0 flex-1 flex-col">
                                    <LazyHeavyMount minHeight={180}>
                                      <ContentEmbed type={first.type} urlOrId={first.urlOrId} tr={tr} hideQuiz fill className="!my-0 !rounded-lg !border-0" />
                                    </LazyHeavyMount>
                                  </div>
                                )
                              })()
                            ) : cells[0]?.imageUrl ? (
                              visualImageIsCurriculumInfographic(cells[0].imageUrl, activeVisualInfographic) ? (
                                <div
                                  data-teacher-infographic-draw-pane-stage
                                  className="relative flex min-h-0 w-full flex-1 touch-none items-center justify-center p-1"
                                  onPointerDown={(e) => {
                                    const stage = e.currentTarget as HTMLDivElement
                                    const img = stage.querySelector('img') as HTMLImageElement | null
                                    const canvas = stage.querySelector('canvas') as HTMLCanvasElement | null
                                    if (img && canvas) {
                                      teacherEmbeddedInfographicStageRef.current = stage
                                      teacherEmbeddedInfographicImgRef.current = img
                                      teacherEmbeddedInfographicCanvasRef.current = canvas
                                    }
                                    startInfographicDrawing('pane', e)
                                  }}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element -- curriculum infographic in Visual pane */}
                                  <img
                                    src={cells[0].imageUrl}
                                    alt=""
                                    draggable={false}
                                    onDragStart={(ev) => ev.preventDefault()}
                                    className="max-h-full max-w-full select-none rounded-md border border-white/10 bg-black/20 object-contain"
                                    referrerPolicy="no-referrer"
                                  />
                                  <canvas data-teacher-infographic-draw-pane-canvas className="pointer-events-none absolute" aria-hidden />
                                  <div
                                    data-infographic-toolbar="teacher-pane"
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
                                      <button key={`gv-v1-${color}`} type="button" onClick={() => setInfographicDrawColor(color)} className={cn('h-3.5 w-3.5 rounded-full border', infographicDrawColor === color ? 'border-white' : 'border-white/40')} style={{ backgroundColor: color }} />
                                    ))}
                                    <button type="button" onClick={() => { undoInfographicStroke(activeInfographicStrokeKey); sendToStudentView({ type: 'infographic-draw-undo', slideIndex: activeInfographicStrokeKey }) }} className="rounded px-2 py-1 text-[11px] hover:bg-white/15">{tr('Undo', 'Undo', '撤销', '元に戻す', '실행 취소')}</button>
                                    <button type="button" onClick={() => { clearInfographicStrokes(activeInfographicStrokeKey); sendToStudentView({ type: 'infographic-draw-clear', slideIndex: activeInfographicStrokeKey }) }} className="rounded px-2 py-1 text-[11px] hover:bg-white/15">{tr('Clear', 'Clear', '清除', 'クリア', '지우기')}</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex h-full min-h-0 w-full items-center justify-center">
                                  {/* eslint-disable-next-line @next/next/no-img-element -- slide visual imageUrl is dynamic/remote */}
                                  <img src={cells[0].imageUrl} alt="" className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
                                </div>
                              )
                            ) : (
                              <div className="h-full w-full flex items-center justify-center p-3">
                                {canGenerateVisualInfographic ? (
                                  <div className="flex flex-col gap-2">
                                    <button
                                      type="button"
                                      disabled={lessonInfographicGenerating || !activeLessonNo}
                                      onClick={handleGenerateLessonInfographic}
                                      className="rounded-lg bg-cyan-500/90 px-3 py-2 text-xs font-medium text-slate-900 hover:bg-cyan-400 disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                      {lessonInfographicGenerating
                                        ? tr('Đang tạo...', 'Generating...', '生成中...', '生成中...', '생성 중...')
                                        : tr(
                                            `Tạo infographic tiết này (${visualInfographicCostLabel} credits)`,
                                            `Create this lesson infographic (${visualInfographicCostLabel} credits)`,
                                            `创建本课时信息图（${visualInfographicCostLabel} 积分）`,
                                            `この授業のインフォグラフィック作成（${visualInfographicCostLabel}クレジット）`,
                                            `이 차시 인포그래픽 만들기 (${visualInfographicCostLabel} 크레딧)`
                                          )}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={infographicGenerating}
                                      onClick={handleGenerateCurriculumInfographic}
                                      className="rounded-lg bg-amber-500/90 px-3 py-2 text-xs font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                      {infographicGenerating
                                        ? tr('Đang tạo...', 'Generating...', '生成中...', '生成中...', '생성 중...')
                                        : tr(
                                            `Tạo ảnh visual dùng chung (${visualInfographicCostLabel} credits)`,
                                            `Create shared visual image (${visualInfographicCostLabel} credits)`,
                                            `创建全课共用可视化图片（${visualInfographicCostLabel} 积分）`,
                                            `全体共通のビジュアル画像を作成（${visualInfographicCostLabel}クレジット）`,
                                            `공용 비주얼 이미지 만들기 (${visualInfographicCostLabel} 크레딧)`
                                          )}
                                    </button>
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 rounded bg-white/5" />
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            {cells.map((cell, idx) => (
                              <div key={idx} className="group relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-black/30">
                                <span className="absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs font-mono">
                                  {slideNum}-{idx + 1}
                                </span>
                                {(cell.visualEmbed || cell.imageUrl) && (
                                  <button
                                    type="button"
                                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); openTeacherVisualFullscreen(idx) }}
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); openTeacherVisualFullscreen(idx) }}
                                    className="absolute top-2 right-2 z-20 flex h-9 w-9 items-center justify-center rounded-md border border-white/40 bg-black/85 text-white shadow-md ring-1 ring-black/30 transition-colors hover:border-white/55 hover:bg-black"
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
                                      <div className="flex min-h-0 flex-1 flex-col">
                                        <LazyHeavyMount minHeight={180}>
                                          <ContentEmbed type={first.type} urlOrId={first.urlOrId} tr={tr} hideQuiz fill className="!my-0 !rounded-lg !border-0" />
                                        </LazyHeavyMount>
                                      </div>
                                    )
                                  })()
                                ) : cell.imageUrl ? (
                                  visualImageIsCurriculumInfographic(cell.imageUrl, activeVisualInfographic) ? (
                                    <div
                                      data-teacher-infographic-draw-pane-stage
                                      className="relative flex min-h-0 w-full flex-1 touch-none items-center justify-center p-0.5"
                                      onPointerDown={(e) => {
                                        const stage = e.currentTarget as HTMLDivElement
                                        const img = stage.querySelector('img') as HTMLImageElement | null
                                        const canvas = stage.querySelector('canvas') as HTMLCanvasElement | null
                                        if (img && canvas) {
                                          teacherEmbeddedInfographicStageRef.current = stage
                                          teacherEmbeddedInfographicImgRef.current = img
                                          teacherEmbeddedInfographicCanvasRef.current = canvas
                                        }
                                        startInfographicDrawing('pane', e)
                                      }}
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element -- curriculum infographic in Visual pane */}
                                      <img
                                        src={cell.imageUrl}
                                        alt=""
                                        draggable={false}
                                        onDragStart={(ev) => ev.preventDefault()}
                                        className="max-h-full max-w-full select-none rounded-md border border-white/10 bg-black/20 object-contain"
                                        referrerPolicy="no-referrer"
                                      />
                                      <canvas data-teacher-infographic-draw-pane-canvas className="pointer-events-none absolute" aria-hidden />
                                      <div
                                        data-infographic-toolbar="teacher-pane"
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
                                          <button key={`gv-vm-${idx}-${color}`} type="button" onClick={() => setInfographicDrawColor(color)} className={cn('h-3.5 w-3.5 rounded-full border', infographicDrawColor === color ? 'border-white' : 'border-white/40')} style={{ backgroundColor: color }} />
                                        ))}
                                        <button type="button" onClick={() => { undoInfographicStroke(activeInfographicStrokeKey); sendToStudentView({ type: 'infographic-draw-undo', slideIndex: activeInfographicStrokeKey }) }} className="rounded px-2 py-1 text-[11px] hover:bg-white/15">{tr('Undo', 'Undo', '撤销', '元に戻す', '실행 취소')}</button>
                                        <button type="button" onClick={() => { clearInfographicStrokes(activeInfographicStrokeKey); sendToStudentView({ type: 'infographic-draw-clear', slideIndex: activeInfographicStrokeKey }) }} className="rounded px-2 py-1 text-[11px] hover:bg-white/15">{tr('Clear', 'Clear', '清除', 'クリア', '지우기')}</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex min-h-0 flex-1 items-center justify-center">
                                      {/* eslint-disable-next-line @next/next/no-img-element -- slide visual imageUrl is dynamic/remote */}
                                      <img src={cell.imageUrl} alt="" className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
                                    </div>
                                  )
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center p-2">
                                    {canGenerateVisualInfographic ? (
                                      <div className="flex flex-col gap-1.5">
                                        <button
                                          type="button"
                                          disabled={lessonInfographicGenerating || !activeLessonNo}
                                          onClick={handleGenerateLessonInfographic}
                                          className="rounded-md bg-cyan-500/90 px-2 py-1.5 text-[11px] font-medium text-slate-900 hover:bg-cyan-400 disabled:opacity-50 disabled:pointer-events-none"
                                        >
                                          {lessonInfographicGenerating
                                            ? tr('Đang tạo...', 'Generating...', '生成中...', '生成中...', '생성 중...')
                                            : tr('Tạo ảnh tiết này', 'Create lesson image', '创建本课时图片', 'この授業の画像を作成', '이 차시 이미지 만들기')}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={infographicGenerating}
                                          onClick={handleGenerateCurriculumInfographic}
                                          className="rounded-md bg-amber-500/90 px-2 py-1.5 text-[11px] font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-50 disabled:pointer-events-none"
                                        >
                                          {infographicGenerating
                                            ? tr('Đang tạo...', 'Generating...', '生成中...', '生成中...', '생성 중...')
                                            : tr('Tạo ảnh dùng chung', 'Create shared image', '创建共用图片', '共通画像を作成', '공용 이미지 만들기')}
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="w-8 h-8 rounded bg-white/5" />
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })()
              ) : leftPanelMode === 'infographic' ? (
                (() => {
                  if (slides.length === 0) return <p className="p-4 text-slate-500 text-sm">{tr('Không có slide', 'No slide', '无幻灯片', 'スライドなし', '슬라이드 없음')}</p>
                  const infographicStableBackground = 'linear-gradient(180deg, #0b1220 0%, #0f172a 100%)'
                  const inf = activeVisualInfographic
                  const costLabel = formatCurriculumCredits(CURRICULUM_UI_CREDITS.slideInfographic2K)
                  return (
                    <div className="h-full w-full overflow-y-auto overflow-x-hidden" style={{ background: infographicStableBackground }}>
                      <div className="p-4 space-y-3 text-left">
                        {!inf ? (
                          <div className="rounded-xl border border-white/10 bg-black/25 p-4 space-y-3">
                            <p className="text-sm text-slate-200/90">
                              {tr(
                                'Ảnh infographic chưa được tạo. Bạn có thể tạo ảnh theo tiết hiện tại hoặc ảnh dùng chung toàn bài.',
                                'Infographic is not created yet. You can create one for this lesson or a shared one for the whole curriculum.',
                                '信息图尚未创建。您可以创建当前课时信息图，或创建全课共用信息图。',
                                'インフォグラフィックは未作成です。現在の授業用または全体共通の画像を作成できます。',
                                '인포그래픽이 아직 없습니다. 현재 차시용 또는 전체 공용 이미지를 만들 수 있습니다.'
                              )}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={!curriculumId || lessonInfographicGenerating || !activeLessonNo}
                                onClick={handleGenerateLessonInfographic}
                                className="w-full sm:w-auto rounded-lg bg-cyan-500/90 px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-cyan-400 disabled:opacity-50 disabled:pointer-events-none"
                              >
                                {lessonInfographicGenerating
                                  ? tr('Đang tạo...', 'Generating...', '生成中...', '生成中...', '생성 중...')
                                  : tr(
                                      `Tạo infographic tiết này (${costLabel} credits)`,
                                      `Create lesson infographic (${costLabel} credits)`,
                                      `创建本课时信息图（${costLabel} 积分）`,
                                      `この授業のインフォグラフィック作成（${costLabel}クレジット）`,
                                      `이 차시 인포그래픽 만들기 (${costLabel} 크레딧)`
                                    )}
                              </button>
                              <button
                                type="button"
                                disabled={!curriculumId || infographicGenerating}
                                onClick={handleGenerateCurriculumInfographic}
                                className="w-full sm:w-auto rounded-lg bg-amber-500/90 px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-50 disabled:pointer-events-none"
                              >
                                {infographicGenerating
                                  ? tr('Đang tạo...', 'Generating...', '生成中...', '生成中...', '생성 중...')
                                  : tr(
                                      `Tạo infographic dùng chung (${costLabel} credits)`,
                                      `Create shared infographic (${costLabel} credits)`,
                                      `创建共用信息图（${costLabel} 积分）`,
                                      `共通インフォグラフィック作成（${costLabel}クレジット）`,
                                      `공용 인포그래픽 만들기 (${costLabel} 크레딧)`
                                    )}
                              </button>
                            </div>
                            {!curriculumId && (
                              <p className="text-xs text-amber-200/80">
                                {tr('Lưu giáo trình trước để tạo infographic.', 'Save the curriculum first to generate an infographic.', '请先保存课程再生成信息图。', 'インフォグラフィックを作る前にカリキュラムを保存してください。', '인포그래픽을 만들려면 먼저 교육과정을 저장하세요.')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <>
                            <div
                              key={activeVisualInfographicRenderKey}
                              ref={teacherEmbeddedInfographicStageRef}
                              data-teacher-infographic-draw-pane-stage
                              className="relative touch-none"
                              onPointerDown={(e) => startInfographicDrawing('pane', e)}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element -- remote infographic URL */}
                              <img
                                ref={teacherEmbeddedInfographicImgRef}
                                src={inf.imageUrl}
                                alt=""
                                draggable={false}
                                onDragStart={(ev) => ev.preventDefault()}
                                className="w-full select-none rounded-xl border border-white/10 object-contain bg-black/20 max-h-[min(52vh,480px)] touch-none"
                                referrerPolicy="no-referrer"
                              />
                              <canvas ref={teacherEmbeddedInfographicCanvasRef} data-teacher-infographic-draw-pane-canvas className="pointer-events-none absolute" aria-hidden />
                            </div>
                            <div
                              data-infographic-toolbar="teacher-pane"
                              className="z-20 mt-2 flex max-w-full flex-wrap items-center justify-center gap-1 self-center rounded-xl border border-white/25 bg-black/70 px-2 py-1 text-white shadow-lg"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button type="button" onClick={() => setInfographicDrawTool('pen')} className={cn('rounded px-2 py-1 text-[11px] transition-colors', infographicDrawTool === 'pen' ? 'bg-white/30' : 'hover:bg-white/15')}>{tr('Vẽ', 'Draw', '画笔', '描画', '그리기')}</button>
                              <button type="button" onClick={() => setInfographicDrawTool('eraser')} className={cn('rounded px-2 py-1 text-[11px] transition-colors', infographicDrawTool === 'eraser' ? 'bg-white/30' : 'hover:bg-white/15')}>{tr('Tẩy', 'Erase', '橡皮', '消しゴム', '지우기')}</button>
                              <button type="button" onClick={() => setInfographicDrawBrushPx(3)} className={cn('rounded px-2 py-1 text-[11px] transition-colors', infographicDrawBrushPx === 3 ? 'bg-white/30' : 'hover:bg-white/15')}>{tr('S', 'S', '细', '細', '얇게')}</button>
                              <button type="button" onClick={() => setInfographicDrawBrushPx(5)} className={cn('rounded px-2 py-1 text-[11px] transition-colors', infographicDrawBrushPx === 5 ? 'bg-white/30' : 'hover:bg-white/15')}>{tr('M', 'M', '中', '中', '중간')}</button>
                              <button type="button" onClick={() => setInfographicDrawBrushPx(7)} className={cn('rounded px-2 py-1 text-[11px] transition-colors', infographicDrawBrushPx === 7 ? 'bg-white/30' : 'hover:bg-white/15')}>{tr('L', 'L', '粗', '太', '굵게')}</button>
                              <div className="flex items-center gap-1 px-1">
                                {INFOGRAPHIC_DRAW_COLORS.map((color) => (
                                  <button
                                    key={`t-pane-${color}`}
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
                                  sendToStudentView({ type: 'infographic-draw-undo', slideIndex: activeInfographicStrokeKey })
                                }}
                                className="rounded px-2 py-1 text-[11px] transition-colors hover:bg-white/15"
                              >
                                {tr('Undo', 'Undo', '撤销', '元に戻す', '실행 취소')}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  clearInfographicStrokes(activeInfographicStrokeKey)
                                  sendToStudentView({ type: 'infographic-draw-clear', slideIndex: activeInfographicStrokeKey })
                                }}
                                className="rounded px-2 py-1 text-[11px] transition-colors hover:bg-white/15"
                              >
                                {tr('Clear', 'Clear', '清除', 'クリア', '지우기')}
                              </button>
                            </div>
                            <div className="flex flex-wrap justify-center gap-2">
                              <button
                                type="button"
                                disabled={lessonInfographicGenerating || !activeLessonNo || !curriculumId}
                                onClick={handleGenerateLessonInfographic}
                                className="rounded-lg border border-cyan-300/60 bg-cyan-500/20 px-3 py-2 text-xs font-medium text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-50"
                              >
                                {lessonInfographicGenerating
                                  ? tr('Đang tạo...', 'Generating...', '生成中...', '生成中...', '생성 중...')
                                  : infographicActionText('lesson', hasLessonInfographic, costLabel)}
                              </button>
                              <button
                                type="button"
                                disabled={infographicGenerating || !curriculumId}
                                onClick={handleGenerateCurriculumInfographic}
                                className="rounded-lg border border-amber-300/60 bg-amber-500/20 px-3 py-2 text-xs font-medium text-amber-100 hover:bg-amber-500/30 disabled:opacity-50"
                              >
                                {infographicGenerating
                                  ? tr('Đang tạo...', 'Generating...', '生成中...', '生成中...', '생성 중...')
                                  : infographicActionText('curriculum', hasCurriculumInfographic, costLabel)}
                              </button>
                            </div>
                          </>
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
                          'max-w-full min-w-0 overflow-x-auto rounded-xl p-4 whitespace-pre-wrap break-words text-sm font-sans leading-relaxed transition-all duration-200 text-left',
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
                <pre className="max-w-full min-w-0 overflow-x-auto whitespace-pre-wrap break-words text-left text-slate-200/95 text-sm font-sans leading-relaxed bg-slate-800/50 rounded-xl p-4">{content}</pre>
              )}
            </div>
          </div>

          {/* Phải: Slide – desktop giữ tỷ lệ; mobile: full width phía dưới */}
          <div
            className={cn(
              'min-w-0 shrink-0 flex flex-col overflow-hidden isolate',
              narrowTeacherLayout ? 'w-full flex-1 min-h-[min(52vh,480px)]' : 'w-1/2'
            )}
          >
            <div className="flex h-12 shrink-0 items-center justify-between gap-2 overflow-hidden border-b border-slate-700/60 bg-slate-900/30 px-3 text-xs font-medium uppercase tracking-wider text-slate-400 md:h-14 md:px-4">
              <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
                {!worksheetId && slides.length > 0 ? (
                  <div className="flex shrink-0 items-center gap-1 md:gap-1.5" data-control="gv-remote-student-curriculum-mode">
                    <button
                      type="button"
                      onClick={() => {
                        setStudentCurriculumRemoteMode('markdown-all')
                        sendToStudentView({ type: 'student-curriculum-right-mode', mode: 'markdown-all' })
                      }}
                      className={cn(
                        'flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium normal-case tracking-normal transition-colors md:h-9 md:px-3',
                        studentCurriculumRemoteMode === 'markdown-all'
                          ? 'border-emerald-400/80 bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/45'
                          : 'border-slate-600/80 bg-slate-800/50 text-slate-300 hover:bg-slate-700/55'
                      )}
                      title={tr(
                        'HS: chế độ chuỗi slide — giống nút «Chuỗi slide» trên cửa sổ học sinh',
                        'Student: slide-sequence mode — same as “Slide sequence” on student window',
                        '学生：连续幻灯片模式 — 与学生端「连续幻灯片」相同',
                        '生徒：スライド連続モード — 生徒画面の「スライド連続」と同じ',
                        '학생: 슬라이드 연속 모드 — 학생 창의 «슬라이드 연속»과 동일'
                      )}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" />
                      {tr('Chuỗi slide', 'Slide sequence', '连续幻灯片', 'スライド連続', '슬라이드 연속')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStudentCurriculumRemoteMode('single-slide')
                        sendToStudentView({ type: 'student-curriculum-right-mode', mode: 'single-slide' })
                      }}
                      className={cn(
                        'flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium normal-case tracking-normal transition-colors md:h-9 md:px-3',
                        studentCurriculumRemoteMode === 'single-slide'
                          ? 'border-amber-400/80 bg-amber-500/30 text-amber-200 ring-1 ring-amber-400/45'
                          : 'border-slate-600/80 bg-slate-800/50 text-slate-300 hover:bg-slate-700/55'
                      )}
                      title={tr(
                        'HS: một slide — giống nút «Slide đơn» trên cửa sổ học sinh',
                        'Student: single-slide mode — same as “Single slide” on student window',
                        '学生：单张模式 — 与学生端「单张幻灯片」相同',
                        '生徒：1枚モード — 生徒画面の「1枚のスライド」と同じ',
                        '학생: 한 장 모드 — 학생 창의 «슬라이드 한 장»과 동일'
                      )}
                    >
                      <Square className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" />
                      {tr('Slide đơn', 'Single slide', '单张幻灯片', '1枚のスライド', '슬라이드 한 장')}
                    </button>
                  </div>
                ) : null}
                <span className="min-w-0 truncate">
                  {slideViewMode === 'single'
                    ? tr('Slide đang hiển thị', 'Current slide', '当前幻灯片', '表示中のスライド', '표시 중 슬라이드')
                    : tr('3 slide: trước · hiện tại · sau', '3 slides: prev · current · next', '3张: 前·当前·后', '3枚: 前·現在·次', '3장: 이전·현재·다음')}
                </span>
              </div>
              <div data-control="slide-mode-xem-hoc-sinh" className="flex rounded-lg border border-slate-600/80 overflow-hidden bg-slate-800/50 shrink-0">
                <button type="button" onClick={() => setSlideViewMode('single')} className={cn('px-2.5 py-1.5 text-xs font-medium transition-colors', slideViewMode === 'single' ? 'bg-amber-500/30 text-amber-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50')} title="1 slide"><Square className="h-3.5 w-3.5 inline mr-1" />1</button>
                <button type="button" onClick={() => setSlideViewMode('triple')} className={cn('px-2.5 py-1.5 text-xs font-medium transition-colors', slideViewMode === 'triple' ? 'bg-amber-500/30 text-amber-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50')} title="3 slide"><LayoutGrid className="h-3.5 w-3.5 inline mr-1" />3</button>
                <button
                  data-control="xem-học-sinh"
                  type="button"
                  onMouseDown={(e) => {
                    if (slides.length <= 0) return
                    e.preventDefault()
                    if (studentViewOpened) viewOpenedStudentView()
                    else openStudentView()
                  }}
                  onClick={(e) => e.preventDefault()}
                  disabled={slides.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/25 border-l border-slate-600/70 text-emerald-300 hover:bg-emerald-500/35 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium shrink-0 h-9"
                  title={studentViewOpened
                    ? tr('Xem lại cửa sổ học sinh đã mở', 'View opened student window', '查看已打开的学生窗口', '開いている生徒ウィンドウを表示', '열려 있는 학생 창 보기')
                    : tr('Mở giao diện học sinh', 'Open student interface', '打开学生界面', '生徒画面を開く', '학생 인터페이스 열기')}
                >
                  <Presentation className="h-4 w-4" />
                  {studentViewOpened
                    ? tr('Xem giao diện học sinh', 'View student interface', '查看学生界面', '生徒画面を見る', '학생 인터페이스 보기')
                    : tr('Mở giao diện học sinh', 'Open student interface', '打开学生界面', '生徒画面を開く', '학생 인터페이스 열기')}
                </button>
              </div>
            </div>
            {slideViewMode === 'single' ? (
              <div ref={teacherSlideContentPaneRef} className="flex-1 flex items-start justify-start min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain p-2 md:p-3">
                {(() => {
                  const s = slides[currentIndex]
                  const blks = !s ? [] : (Array.isArray(s.blocks) && s.blocks.length ? s.blocks : s.content ? parseContentToBlocks(s.content ?? '') : [])
                  const showDirectEdit = Boolean(curriculumId && slideMode === 'personal' && personalViewSubMode === 'current')
                  return (
                    <div className="w-full flex flex-col gap-2 items-stretch text-left">
                      {slideMode === 'personal' && personalViewSubMode === 'current' && !curriculumId && (
                        <div className="rounded-lg bg-violet-500/15 border border-violet-400/30 px-4 py-2 text-sm text-violet-200">
                          {tr('Lưu giáo trình vào kho để sửa bản riêng.', 'Save curriculum to library to edit personal version.', '保存课程到库以编辑个人版。', 'カリキュラムを保存して個人版を編集。', '교육과정 저장 후 개인 버전 편집.')}
                        </div>
                      )}
                      <div className="w-full rounded-xl bg-amber-500/10 ring-2 ring-amber-400/40 border border-amber-400/30 p-2.5 shadow-lg flex flex-col">
                        <div ref={teacherSlideContentLayoutRef} className="w-full min-w-0 flex flex-col">
                        {blks.length > 0 ? renderSlideLevelTypingToolbar(currentIndex, blks, 'comfortable') : null}
                        <div className="flex items-center justify-between gap-1.5 mb-2 flex-wrap shrink-0">
                          {editingTitle === currentIndex ? (
                            <div className="flex-1 flex gap-2 items-center flex-wrap min-w-0">
                              <input value={editingTitleValue} onChange={(e) => setEditingTitleValue(e.target.value)} className="min-w-[140px] flex-1 rounded-lg border border-slate-600 bg-slate-700/80 px-3 py-2 font-bold text-amber-300 text-xl focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 md:text-2xl lg:text-3xl landscape:text-2xl" placeholder={tr('Tiêu đề slide', 'Slide title', '幻灯片标题', 'スライドタイトル', '슬라이드 제목')} />
                              <button type="button" onClick={() => { setSlides((prev) => { const next = prev.map((sl, j) => j === currentIndex ? { ...sl, title: editingTitleValue } : sl); if (curriculumId) void persistSlidesRef.current(next); return next }); sendUpdateSlideTitle(currentIndex, editingTitleValue); setEditingTitle(null) }} className="text-xs font-medium text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/30">{tr('Lưu', 'Save', '保存', '保存', '저장')}</button>
                              <button type="button" onClick={() => setEditingTitle(null)} className="text-xs text-slate-400 hover:text-slate-300 px-2 py-1.5">{tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}</button>
                            </div>
                          ) : (
                            <>
                              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1 pr-2">
                                <span className="shrink-0 text-sm font-medium tabular-nums text-slate-400">
                                  {currentIndex + 1}/{slides.length}
                                </span>
                                <h2 className="m-0 min-w-0 max-w-full flex-1 break-words text-xl font-bold leading-tight text-amber-300 md:text-2xl lg:text-3xl landscape:text-2xl">
                                  {(() => {
                                    const titleK = curriculumSlideTitleRevealKey(currentIndex)
                                    const titleTypingOn =
                                      !!curriculumId &&
                                      blks.length > 0 &&
                                      answerTypingEnabled[titleK] !== false &&
                                      worksheetAnswerSegmentCount(s?.title ?? '') > 0
                                    if (!titleTypingOn) return s?.title ?? ''
                                    const preview =
                                      answerRevealJumpPopoverSlideIndex === currentIndex && answerRevealJumpPreviewByBlock
                                        ? answerRevealJumpPreviewByBlock[titleK]
                                        : undefined
                                    const revealed = answerRevealProgress[titleK] ?? 0
                                    return (
                                      <AnimatedCharReveal
                                        text={s?.title ?? ''}
                                        visibleCount={preview ?? revealed}
                                        showCursor={sequentialSolutionLeaderBlockIndex === -1}
                                        penWhenEmpty={sequentialSolutionLeaderBlockIndex === -1}
                                      />
                                    )
                                  })()}
                                </h2>
                              </div>
                              <div className="flex shrink-0 flex-wrap items-center gap-2">
                                {(curriculumId || worksheetId) && ((slideMode === 'personal' && personalViewSubMode === 'current') || slideMode === 'shared' || slideMode === 'original') && (currentIndex > 0 || currentIndex < slides.length - 1) && (
                                  <button
                                    type="button"
                                    onClick={() => setSlideViewMode('triple')}
                                    className="text-[11px] text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25"
                                    title={tr(
                                      'Mở xem 3 slide cạnh nhau để tách hoặc gộp',
                                      'Open 3-slide view to split or merge',
                                      '打开三联幻灯片视图以拆分或合并',
                                      '分割・結合用に3枚表示を開く',
                                      '분할·병합을 위해 3장 보기'
                                    )}
                                  >
                                    {tr('Tách/Gộp slide', 'Split / merge slide', '拆分/合并幻灯片', '分割・結合', '분할/병합 슬라이드')}
                                  </button>
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
                                          {quizGenLoading === currentIndex ? (
                                            tr('Đang tạo...', 'Creating...', '创建中...', '作成中...', '생성 중...')
                                          ) : (
                                            <>
                                              {tr('Tạo câu hỏi', 'Add quiz', '添加测验', 'クイズ追加', '퀴즈 추가')}
                                              {slideQuizGenCreditSuffix}
                                            </>
                                          )}
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
                                      onClick={openQuizPopupFresh}
                                      className="text-xs text-violet-400 hover:text-violet-300 px-2.5 py-1 rounded-lg bg-violet-500/15 border border-violet-400/30 flex items-center gap-1.5 transition-colors"
                                      title={tr('Xem câu hỏi trắc nghiệm', 'View quiz', '查看测验', 'クイズを見る', '퀴즈 보기')}
                                    >
                                      <ClipboardList className="h-3.5 w-3.5" />
                                      {tr('Xem câu hỏi', 'View quiz', '查看测验', 'クイズを見る', '퀴즈 보기')}
                                    </button>
                                  )
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        <div ref={teacherSlidePointerSyncRef} className="w-full min-w-0">
                        {blks.length > 0 ? (
                          <div className="space-y-2 min-h-0 overflow-y-auto">
                            {blks.map((b, i) => {
                              const blockProposals = proposals.filter((p) => p.slide_index === currentIndex && p.block_index === i)
                              const isEditing = editingBlock?.slideIndex === currentIndex && editingBlock?.blockIndex === i
                              const isEditingHeader = editingHeader?.slideIndex === currentIndex && editingHeader?.blockIndex === i
                              const isBảnChung = slideMode === 'shared' || slideMode === 'original' || slideMode === null
                              const showProposalUi = Boolean((curriculumId || worksheetId) && isBảnChung)
                              const showDirectEdit = Boolean(curriculumId && slideMode === 'personal' && personalViewSubMode === 'current')
                              const showSolutionTypingToolbar =
                                (!!worksheetId && !!(b as { isAnswer?: boolean }).isAnswer) ||
                                (!worksheetId && !!curriculumId)
                              return (
                                <div key={i} className="rounded-lg bg-slate-800/60 p-2.5 border border-slate-600/60 hover:border-slate-500/50 transition-colors">
                                    {isEditingHeader ? (
                                    <div className="mb-2 flex gap-1.5 flex-wrap">
                                      <input value={editingHeaderValue} onChange={(e) => setEditingHeaderValue(e.target.value)} className="flex-1 min-w-[120px] rounded-lg bg-slate-700/80 px-3 py-2 text-amber-300 text-xs font-bold border border-slate-600 focus:border-amber-500/50" placeholder={tr('Tiêu đề block', 'Block header', '块标题', 'ブロックタイトル', '블록 제목')} />
                                      <button type="button" onClick={() => {
                                        const newBlocks = blks.map((bl, j) => j === i ? { ...bl, header: editingHeaderValue } : bl)
                                        updateSlideBlocksAndPersist(currentIndex, newBlocks)
                                        setEditingHeader(null)
                                      }} className="text-xs font-medium text-emerald-400 px-3 py-1.5 rounded-lg bg-emerald-500/20">{tr('Lưu', 'Save', '保存', '保存', '저장')}</button>
                                      <button type="button" onClick={() => setEditingHeader(null)} className="text-xs text-slate-400 hover:text-slate-300 px-2 py-1.5">{tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}</button>
                                    </div>
                                  ) : (
                                    (b.header || (b as { isAnswer?: boolean }).isAnswer || (!!curriculumId && !worksheetId)) && (
                                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                        <div className="text-amber-300/95 font-bold text-xs">{b.header || tr('Đáp án', 'Answer', '答案', '解答', '정답')}</div>
                                        {worksheetId && showSolutionTypingToolbar && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const key = `${currentIndex}-${i}`
                                              setAnswerVisibility((prev) => ({ ...prev, [key]: !(prev[key] !== false) }))
                                            }}
                                            className="text-[11px] px-2 py-1 rounded-md bg-slate-600/50 hover:bg-slate-600/70 text-slate-300 hover:text-white transition-colors flex items-center gap-1"
                                            title={answerVisibility[`${currentIndex}-${i}`] !== false ? tr('Ẩn đáp án trên màn hình học sinh và tạm dừng hiệu ứng gõ lời giải', 'Hide answer on student view and pause typing', '在学生界面隐藏答案并暂停打字', '生徒画面で解答を非表示・タイピング一時停止', '학생 화면에서 정답 숨기기 및 타이핑 일시정지') : tr('Hiện đáp án trên màn hình học sinh và tiếp tục gõ lời giải', 'Show answer on student view and resume typing', '在学生界面显示答案并继续打字', '生徒画面で解答を表示・タイピング再開', '학생 화면에서 정답 표시 및 타이핑 재개')}
                                          >
                                            {answerVisibility[`${currentIndex}-${i}`] !== false ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                            {answerVisibility[`${currentIndex}-${i}`] !== false ? tr('Ẩn', 'Hide', '隐藏', '非表示', '숨김') : tr('Hiện', 'Show', '显示', '表示', '표시')}
                                          </button>
                                        )}
                                        {showDirectEdit && (
                                          <button type="button" onClick={() => { setEditingHeader({ slideIndex: currentIndex, blockIndex: i }); setEditingHeaderValue(b.header ?? '') }} className="text-[11px] text-slate-400 hover:text-amber-400 px-1.5 py-0.5 rounded hover:bg-slate-700/50 transition-colors">{tr('Sửa', 'Edit', '编辑', '編集', '편집')}</button>
                                        )}
                                      </div>
                                    )
                                  )}
                                  {isEditing ? (
                                    <div className="space-y-2">
                                      <textarea value={editingValue} onChange={(e) => setEditingValue(e.target.value)} className="w-full rounded-lg bg-slate-700/80 p-2.5 text-slate-200 text-base md:text-lg min-h-[80px] border border-slate-600 focus:border-amber-500/40 resize-y" placeholder={tr('Nội dung block...', 'Block content...', '块内容...', 'ブロック内容...', '블록 내용...')} />
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
                                      {showSolutionTypingToolbar ? (
                                        <WorksheetAnswerTypedBody
                                          content={b.content ?? ''}
                                          typingEnabled={answerTypingEnabled[`${currentIndex}-${i}`] !== false}
                                          typingPaused={answerVisibility[`${currentIndex}-${i}`] === false || answerTypingPaused[`${currentIndex}-${i}`] === true}
                                          revealedSegments={answerRevealProgress[`${currentIndex}-${i}`] ?? 0}
                                          isSequentialTypingLeader={sequentialSolutionLeaderBlockIndex === i}
                                          revealPreviewSegments={
                                            answerRevealJumpPopoverSlideIndex === currentIndex && answerRevealJumpPreviewByBlock
                                              ? answerRevealJumpPreviewByBlock[`${currentIndex}-${i}`]
                                              : undefined
                                          }
                                          tr={tr}
                                          worksheetId={!!worksheetId}
                                          curriculumId={curriculumId}
                                          slideIndex={currentIndex}
                                          blockIndex={i}
                                          slideTitle={s?.title ?? ''}
                                          slideContentForReport={(blks ?? []).map((bl) => (bl.header ? `### ${bl.header}\n\n` : '') + (bl.content ?? '')).join('\n\n')}
                                          showDirectEdit={showDirectEdit}
                                          showProposalUi={showProposalUi}
                                          quizReportLoading={!!quizReportLoading}
                                          onRemoveEmbed={handleRemoveEmbed}
                                          onEditBlock={() => {
                                            setEditingBlock({ slideIndex: currentIndex, blockIndex: i })
                                            setEditingValue(b.content ?? '')
                                          }}
                                          onProposeEdit={() => {
                                            if (!worksheetId) {
                                              setProposalDialog({ open: true, slideIndex: currentIndex, blockIndex: i, type: 'edit', originalContent: b.content, blockHeader: b.header })
                                            }
                                          }}
                                          onProposeAdd={() => {
                                            if (!worksheetId) {
                                              setProposalDialog({ open: true, slideIndex: currentIndex, blockIndex: i, type: 'add', blockHeader: b.header })
                                            }
                                          }}
                                          reportQuizWrong={reportQuizWrong}
                                          worksheetBlocksProposalDisabled={!!worksheetId}
                                          showWorksheetMarkdownEdit={!!worksheetId}
                                          onEditWorksheetMarkdown={() => void openWorksheetBlockEditorFromSlide(currentIndex)}
                                        />
                                      ) : (
                                        <>
                                          <div
                                            {...{ [POINTER_PROSE_ROOT_ATTR]: '' }}
                                            data-slide-index={currentIndex}
                                            data-block-index={i}
                                            className={cn(SLIDE_SYNC_MARKDOWN_CLASS, 'text-slate-200/95')}
                                          >
                                            {asArray(splitContentWithEmbeds(b.content ?? '')).map((p, j) => {
                                              if (p.type === 'text') return p.value ? <span key={j}>{p.value}</span> : null
                                              if (p.type === 'embed' && p.embedType === 'quiz') {
                                                const q = parseQuizData(p.urlOrId)
                                                if (!q) return null
                                                const hideAns = !!worksheetId
                                                return (
                                                  <div key={j} className="rounded-lg bg-violet-500/15 border border-violet-400/30 p-2.5">
                                                    <div className="text-violet-200 font-medium text-xs mb-1.5">{tr('Câu hỏi trắc nghiệm', 'Quiz question', '测验题', 'クイズ', '퀴즈')}</div>
                                                    <p className="text-slate-200/95 text-base md:text-lg mb-2">{q.question}</p>
                                                    <div className="space-y-1">
                                                      {q.options.map((opt, k) => (
                                                        <div key={k} className={['text-sm md:text-base pl-2 border-l-2', !hideAns && k === q.correctIndex ? 'border-emerald-400 text-emerald-300' : 'border-slate-600 text-slate-300'].join(' ')}>
                                                          {String.fromCharCode(65 + k)}. {hideAns ? String(opt).replace(/\s*\(Đáp án đúng\)\s*/gi, '').trim() || opt : opt}
                                                          {!hideAns && k === q.correctIndex && <span className="ml-1.5 text-emerald-400/80 text-[10px]">({tr('Đáp án đúng', 'Correct', '正确', '正解', '정답')})</span>}
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
                                                    <LazyHeavyMount minHeight={160}>
                                                      <ContentEmbed type={ep.embedType} urlOrId={ep.urlOrId} width={280} height={160} tr={tr} />
                                                    </LazyHeavyMount>
                                                    {curriculumId && (showDirectEdit || showProposalUi) && (
                                                      <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                          <button type="button" className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-slate-800/95 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600/60 z-[100] shadow-lg">
                                                            <MoreVertical className="h-3.5 w-3.5" />
                                                          </button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" sideOffset={10} className="z-[120]">
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
                                            {(curriculumId || worksheetId) && asArray(splitContentWithEmbeds(b.content ?? '')).some((p) => p.type === 'embed' && p.embedType === 'quiz') && (
                                              asArray(splitContentWithEmbeds(b.content ?? '')).filter((p): p is { type: 'embed'; embedType: 'quiz'; urlOrId: string; rawMarker: string } => p.type === 'embed' && p.embedType === 'quiz').map((p, qIdx) => (
                                                <button
                                                  key={qIdx}
                                                  type="button"
                                                  disabled={!!quizReportLoading || !!worksheetId}
                                                  title={worksheetId ? tr('Chỉ cho giáo trình đã lưu', 'Only for saved curriculum', '仅限已保存课程', '保存済みカリキュラムのみ', '저장된 교육과정만') : undefined}
                                                  onClick={() => curriculumId && reportQuizWrong({
                                                    curriculumId,
                                                    slideIndex: currentIndex,
                                                    blockIndex: i,
                                                    quizMarker: p.rawMarker,
                                                    slideTitle: s?.title ?? '',
                                                    slideContent: (blks ?? []).map((bl) => (bl.header ? `### ${bl.header}\n\n` : '') + (bl.content ?? '')).join('\n\n'),
                                                  })}
                                                  className={cn('text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-1 transition-colors', curriculumId ? 'text-rose-300 hover:text-rose-200 bg-rose-500/20 border border-rose-400/30 disabled:opacity-50' : 'text-rose-400/60 bg-rose-500/10 border border-rose-400/20 cursor-not-allowed opacity-60')}
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
                                            {showProposalUi && worksheetId && (
                                              <button
                                                type="button"
                                                onClick={() => void openWorksheetBlockEditorFromSlide(currentIndex)}
                                                className="text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-1 text-amber-300 hover:text-amber-200 bg-amber-500/20 border border-amber-400/30 transition-colors"
                                              >
                                                <Edit3 className="h-3.5 w-3.5" />
                                                {tr('Sửa', 'Edit', '编辑', '編集', '편집')}
                                              </button>
                                            )}
                                            {showProposalUi && !worksheetId && (
                                              <>
                                                <button type="button" disabled={false} onClick={() => setProposalDialog({ open: true, slideIndex: currentIndex, blockIndex: i, type: 'edit', originalContent: b.content, blockHeader: b.header })} className={cn('text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-1', curriculumId ? 'text-amber-300 hover:text-amber-200 bg-amber-500/20 border border-amber-400/30' : 'text-amber-400/60 bg-amber-500/10 border border-amber-400/20 cursor-not-allowed opacity-60')}>
                                                  <Edit3 className="h-3.5 w-3.5" />{tr('Đề xuất sửa', 'Propose edit', '建议编辑', '編集提案', '편집 제안')}
                                                </button>
                                                <button type="button" disabled={false} onClick={() => setProposalDialog({ open: true, slideIndex: currentIndex, blockIndex: i, type: 'add', blockHeader: b.header })} className={cn('text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-1', curriculumId ? 'text-emerald-300 hover:text-emerald-200 bg-emerald-500/20 border border-emerald-400/30' : 'text-emerald-400/60 bg-emerald-500/10 border border-emerald-400/20 cursor-not-allowed opacity-60')}>
                                                  <Plus className="h-3.5 w-3.5" />{tr('Đề xuất bổ sung', 'Propose addition', '建议补充', '追加提案', '추가 제안')}
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </>
                                      )}
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
                                  <textarea value={editingValue} onChange={(e) => setEditingValue(e.target.value)} className="w-full rounded bg-slate-700 p-2 text-slate-200 text-base md:text-lg min-h-[80px]" />
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
                                  <div
                                    {...{ [POINTER_PROSE_ROOT_ATTR]: '' }}
                                    data-slide-index={currentIndex}
                                    data-block-index={0}
                                    className={cn(SLIDE_SYNC_MARKDOWN_CLASS, 'text-slate-200')}
                                  >
                                    {asArray(splitContentWithEmbeds(s.content ?? '')).map((p, j) => {
                                      if (p.type === 'text') return p.value ? <span key={j}>{p.value}</span> : null
                                      if (p.type === 'embed' && p.embedType === 'quiz') {
                                        const q = parseQuizData(p.urlOrId)
                                        if (!q) return null
                                        const hideAns = !!worksheetId
                                        return (
                                          <div key={j} className="rounded-lg bg-violet-500/15 border border-violet-400/30 p-2.5">
                                            <div className="text-violet-200 font-medium text-xs mb-1.5">{tr('Câu hỏi trắc nghiệm', 'Quiz question', '测验题', 'クイズ', '퀴즈')}</div>
                                            <p className="text-slate-200/95 text-base md:text-lg mb-2">{q.question}</p>
                                            <div className="space-y-1">
                                              {q.options.map((opt, k) => (
                                                <div key={k} className={['text-sm md:text-base pl-2 border-l-2', !hideAns && k === q.correctIndex ? 'border-emerald-400 text-emerald-300' : 'border-slate-600 text-slate-300'].join(' ')}>
                                                  {String.fromCharCode(65 + k)}. {hideAns ? String(opt).replace(/\s*\(Đáp án đúng\)\s*/gi, '').trim() || opt : opt}
                                                  {!hideAns && k === q.correctIndex && <span className="ml-1.5 text-emerald-400/80 text-[10px]">({tr('Đáp án đúng', 'Correct', '正确', '正解', '정답')})</span>}
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
                                            <LazyHeavyMount minHeight={160}>
                                              <ContentEmbed type={ep.embedType} urlOrId={ep.urlOrId} width={280} height={160} tr={tr} />
                                            </LazyHeavyMount>
                                            {curriculumId && (slideMode === 'personal' && personalViewSubMode === 'current' || slideMode === 'shared' || slideMode === 'original' || slideMode === null) && (
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <button type="button" className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-slate-800/95 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600/60 z-[100] shadow-lg">
                                                    <MoreVertical className="h-3.5 w-3.5" />
                                                  </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" sideOffset={10} className="z-[120]">
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
                                    {(curriculumId || worksheetId) && asArray(splitContentWithEmbeds(s.content ?? '')).filter((p): p is { type: 'embed'; embedType: 'quiz'; urlOrId: string; rawMarker: string } => p.type === 'embed' && p.embedType === 'quiz').map((p, qIdx) => (
                                      <button
                                        key={qIdx}
                                        type="button"
                                        disabled={!!quizReportLoading || !!worksheetId}
                                        title={worksheetId ? tr('Chỉ cho giáo trình đã lưu', 'Only for saved curriculum', '仅限已保存课程', '保存済みカリキュラムのみ', '저장된 교육과정만') : undefined}
                                        onClick={() => curriculumId && reportQuizWrong({
                                          curriculumId,
                                          slideIndex: currentIndex,
                                          blockIndex: 0,
                                          quizMarker: p.rawMarker,
                                          slideTitle: s?.title ?? '',
                                          slideContent: s.content ?? '',
                                        })}
                                        className={cn('text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-1 transition-colors', curriculumId ? 'text-rose-300 hover:text-rose-200 bg-rose-500/20 border border-rose-400/30 disabled:opacity-50' : 'text-rose-400/60 bg-rose-500/10 border border-rose-400/20 cursor-not-allowed opacity-60')}
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
                                    {(slideMode === 'shared' || slideMode === 'original' || slideMode === null) && (curriculumId || worksheetId) && worksheetId && (
                                      <button
                                        type="button"
                                        onClick={() => void openWorksheetBlockEditorFromSlide(currentIndex)}
                                        className="text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-1 text-amber-300 hover:text-amber-200 bg-amber-500/20 border border-amber-400/30 transition-colors"
                                      >
                                        <Edit3 className="h-3.5 w-3.5" />
                                        {tr('Sửa', 'Edit', '编辑', '編集', '편집')}
                                      </button>
                                    )}
                                    {(slideMode === 'shared' || slideMode === 'original' || slideMode === null) && curriculumId && !worksheetId && (
                                      <>
                                        <button type="button" onClick={() => setProposalDialog({ open: true, slideIndex: currentIndex, blockIndex: 0, type: 'edit', originalContent: s.content })} className={cn('text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-1', 'text-amber-300 hover:text-amber-200 bg-amber-500/20 border border-amber-400/30')}>
                                          <Edit3 className="h-3.5 w-3.5" />{tr('Đề xuất sửa', 'Propose edit', '建议编辑', '編集提案', '편집 제안')}
                                        </button>
                                        <button type="button" onClick={() => setProposalDialog({ open: true, slideIndex: currentIndex, blockIndex: 0, type: 'add' })} className={cn('text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-1', 'text-emerald-300 hover:text-emerald-200 bg-emerald-500/20 border border-emerald-400/30')}>
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
                        </div>
                        {(curriculumId || worksheetId) && leftPanelMode === 'visual' && (
                          <div className="mt-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-2.5 space-y-2">
                            <div className="text-[11px] text-cyan-200/90">
                              {tr(
                                'Dữ liệu Visual theo slide (4 ô): dán công thức (y=x^2 hoặc y=f(x), y=g(x) nhiều đồ thị), link GeoGebra/YouTube/Desmos/PhET/Maps, link ảnh/audio, markdown ảnh ![](url), marker [geogebra:], [youtube:], [image:]... hoặc dán trực tiếp ảnh chụp màn hình bằng Ctrl+V.',
                                'Per-slide visual data (4 fields): paste formula (y=x^2 or y=f(x), y=g(x) for multiple graphs), GeoGebra/YouTube/Desmos/PhET/Maps links, image/audio links, markdown image ![](url), markers like [geogebra:], [youtube:], [image:]... or paste screenshots directly with Ctrl+V.',
                                '每张幻灯片可视化数据（4项）：可粘贴公式 (y=x^2)、GeoGebra/YouTube/Desmos/PhET/Maps 链接、图片/音频链接、Markdown 图片 ![](url)、[geogebra:]、[youtube:]、[image:] 等标记，或使用 Ctrl+V 直接粘贴截图。',
                                'スライド別Visualデータ（4項目）：式 (y=x^2)、GeoGebra/YouTube/Desmos/PhET/Maps のURL、画像/音声URL、Markdown画像 ![](url)、[geogebra:] [youtube:] [image:] などのマーカーに加え、Ctrl+V でスクリーンショットを直接貼り付けできます。',
                                '슬라이드별 비주얼 데이터(4칸): 수식(y=x^2), GeoGebra/YouTube/Desmos/PhET/Maps 링크, 이미지/오디오 링크, 마크다운 이미지 ![](url), [geogebra:] [youtube:] [image:] 마커 또는 Ctrl+V로 스크린샷을 직접 붙여넣을 수 있습니다.'
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                value={s?.visualInput1 ?? ''}
                                onChange={(e) => updateCurrentSlideVisualInput('visualInput1', e.target.value)}
                                onPaste={(e) => handlePasteImageToVisualInput('visualInput1', e)}
                                onBlur={persistCurrentVisualInputs}
                                placeholder={tr('Ô 1: link/dữ liệu cần chèn', 'Field 1: embed link/data', '字段1：要插入的链接/数据', '項目1: 埋め込みリンク/データ', '칸1: 삽입할 링크/데이터')}
                                className="w-full rounded-md bg-slate-700/70 px-2.5 py-2 text-xs text-slate-100 border border-slate-600 focus:border-cyan-400/60"
                              />
                              <input
                                value={s?.visualInput2 ?? ''}
                                onChange={(e) => updateCurrentSlideVisualInput('visualInput2', e.target.value)}
                                onPaste={(e) => handlePasteImageToVisualInput('visualInput2', e)}
                                onBlur={persistCurrentVisualInputs}
                                placeholder={tr('Ô 2: link/dữ liệu cần chèn', 'Field 2: embed link/data', '字段2：要插入的链接/数据', '項目2: 埋め込みリンク/データ', '칸2: 삽입할 링크/데이터')}
                                className="w-full rounded-md bg-slate-700/70 px-2.5 py-2 text-xs text-slate-100 border border-slate-600 focus:border-cyan-400/60"
                              />
                              <input
                                value={s?.visualInput3 ?? ''}
                                onChange={(e) => updateCurrentSlideVisualInput('visualInput3', e.target.value)}
                                onPaste={(e) => handlePasteImageToVisualInput('visualInput3', e)}
                                onBlur={persistCurrentVisualInputs}
                                placeholder={tr('Ô 3: link/dữ liệu cần chèn', 'Field 3: embed link/data', '字段3：要插入的链接/数据', '項目3: 埋め込みリンク/データ', '칸3: 삽입할 링크/데이터')}
                                className="w-full rounded-md bg-slate-700/70 px-2.5 py-2 text-xs text-slate-100 border border-slate-600 focus:border-cyan-400/60"
                              />
                              <input
                                value={s?.visualInput4 ?? ''}
                                onChange={(e) => updateCurrentSlideVisualInput('visualInput4', e.target.value)}
                                onPaste={(e) => handlePasteImageToVisualInput('visualInput4', e)}
                                onBlur={persistCurrentVisualInputs}
                                placeholder={tr('Ô 4: link/dữ liệu cần chèn', 'Field 4: embed link/data', '字段4：要插入的链接/数据', '項目4: 埋め込みリンク/データ', '칸4: 삽입할 링크/데이터')}
                                className="w-full rounded-md bg-slate-700/70 px-2.5 py-2 text-xs text-slate-100 border border-slate-600 focus:border-cyan-400/60"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="w-full rounded-lg bg-slate-800/50 p-3 border border-slate-600/60 shrink-0">
                        <label className="block text-amber-300/95 font-medium mb-1.5 text-sm">{tr('Ghi chú', 'Notes', '备注', 'メモ', '메모')}</label>
                        <textarea value={notesValue} onChange={(e) => { setNotesValue(e.target.value); setNotesDirty(true) }} onBlur={handleBlur} placeholder={tr('Gợi ý câu hỏi, ví dụ...', 'Question hints, examples...', '问题提示、示例...', '質問のヒント、例...', '질문 힌트, 예시...')} className="w-full rounded-lg bg-slate-700/60 p-3 min-h-[64px] max-h-[120px] text-slate-200 placeholder-slate-500 border border-slate-600 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 text-sm resize-y transition-colors" />
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
                    {blks.length > 0 ? renderSlideLevelTypingToolbar(idx, blks, 'compact') : null}
                    <div className="flex items-center justify-between gap-1 mb-1 shrink-0 flex-wrap">
                      <span className={['truncate', isCurrent ? 'text-amber-300 font-bold text-base md:text-lg' : 'text-slate-500 text-xs font-medium'].join(' ')}>
                        {idx >= 0 && idx < slides.length ? (
                          <>
                            {`${idx + 1}/${slides.length} `}
                            {isCurrent && curriculumId && blks.length > 0 && answerTypingEnabled[curriculumSlideTitleRevealKey(idx)] !== false && worksheetAnswerSegmentCount(s?.title ?? '') > 0 ? (
                              <AnimatedCharReveal
                                text={s?.title ?? ''}
                                visibleCount={
                                  answerRevealJumpPopoverSlideIndex === idx && answerRevealJumpPreviewByBlock
                                    ? answerRevealJumpPreviewByBlock[curriculumSlideTitleRevealKey(idx)] ?? answerRevealProgress[curriculumSlideTitleRevealKey(idx)] ?? 0
                                    : answerRevealProgress[curriculumSlideTitleRevealKey(idx)] ?? 0
                                }
                                showCursor={sequentialSolutionLeaderBlockIndex === -1 && currentIndex === idx}
                                penWhenEmpty={sequentialSolutionLeaderBlockIndex === -1 && currentIndex === idx}
                              />
                            ) : (
                              s?.title ?? ''
                            )}
                          </>
                        ) : (
                          label
                        )}{' '}
                        {isCurrent && `· ${label}`}
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
                                  {quizGenLoading === idx ? (
                                    tr('Đang tạo...', 'Creating...', '创建中...', '作成中...', '생성 중...')
                                  ) : (
                                    <>
                                      {tr('Tạo câu hỏi', 'Add quiz', '添加测验', 'クイズ追加', '퀴즈 추가')}
                                      {slideQuizGenCreditSuffix}
                                    </>
                                  )}
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
                              onClick={openQuizPopupFresh}
                              className="text-xs text-violet-400 hover:text-violet-300 px-1.5 py-0.5 rounded bg-slate-700/50 flex items-center gap-1"
                              title={tr('Xem câu hỏi trắc nghiệm', 'View quiz', '查看测验', 'クイズを見る', '퀴즈 보기')}
                            >
                              <ClipboardList className="h-3 w-3" />
                              {tr('Xem câu hỏi', 'View quiz', '查看测验', 'クイズを見る', '퀴즈 보기')}
                            </button>
                          )
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
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-1 text-base md:text-lg">
                      {blks.length > 0 ? (
                        <>
                          {blks.map((b, i) => {
                          const blockProposals = isCurrent && curriculumId ? proposals.filter((p) => p.slide_index === idx && p.block_index === i) : []
                          const isEditing = isCurrent && editingBlock?.slideIndex === idx && editingBlock?.blockIndex === i
                        const isBảnChung = slideMode === 'shared' || slideMode === 'original' || slideMode === null
                        const showProposalUi = Boolean(isCurrent && (curriculumId || worksheetId) && isBảnChung)
                        const showDirectEdit = Boolean(isCurrent && curriculumId && slideMode === 'personal' && personalViewSubMode === 'current')
                        const showSolutionTypingToolbar =
                          (!!worksheetId && !!(b as { isAnswer?: boolean }).isAnswer) ||
                          (!worksheetId && !!curriculumId)
                          return (
                            <div key={i} className="rounded-lg bg-slate-800/50 p-2 border border-slate-600/50">
                              {(b.header || (b as { isAnswer?: boolean }).isAnswer || (!!curriculumId && !worksheetId)) && (
                                <div className="flex flex-wrap items-center gap-1 mb-0.5">
                                  <span className="text-amber-300/90 font-bold text-xs">{b.header || tr('Đáp án', 'Answer', '答案', '解答', '정답')}</span>
                                  {worksheetId && showSolutionTypingToolbar && (
                                    <button type="button" onClick={() => setAnswerVisibility((prev) => ({ ...prev, [`${idx}-${i}`]: !(prev[`${idx}-${i}`] !== false) }))} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-600/50 hover:bg-slate-600/70 text-slate-300 flex items-center gap-0.5" title={answerVisibility[`${idx}-${i}`] !== false ? tr('Ẩn đáp án trên màn hình học sinh và tạm dừng hiệu ứng gõ lời giải', 'Hide answer on student view and pause typing', '在学生界面隐藏答案并暂停打字', '生徒画面で解答を非表示・タイピング一時停止', '학생 화면에서 정답 숨기기 및 타이핑 일시정지') : tr('Hiện đáp án trên màn hình học sinh và tiếp tục gõ lời giải', 'Show answer on student view and resume typing', '在学生界面显示答案并继续打字', '生徒画面で解答を表示・タイピング再開', '학생 화면에서 정답 표시 및 타이핑 재개')}>
                                      {answerVisibility[`${idx}-${i}`] !== false ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                      {answerVisibility[`${idx}-${i}`] !== false ? tr('Ẩn', 'Hide', '隐藏', '非表示', '숨김') : tr('Hiện', 'Show', '显示', '表示', '표시')}
                                    </button>
                                  )}
                                </div>
                              )}
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
                                  <div className="text-slate-200 text-sm md:text-base whitespace-pre-wrap break-words leading-relaxed min-w-0 text-left space-y-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-1">
                                    {asArray(splitContentWithEmbeds(b.content ?? '')).map((p, j) => {
                                      if (p.type === 'text') return p.value ? <span key={j} className="line-clamp-4">{p.value}</span> : null
                                      if (p.type === 'embed' && p.embedType === 'quiz') {
                                        const q = parseQuizData(p.urlOrId)
                                        if (!q) return null
                                        return (
                                          <div key={j} className="rounded bg-violet-500/15 border border-violet-400/30 p-1.5">
                                            <div className="text-violet-200 font-medium text-xs mb-0.5">{tr('Câu hỏi trắc nghiệm', 'Quiz', '测验', 'クイズ', '퀴즈')}</div>
                                            <p className="text-slate-200/95 text-sm md:text-base line-clamp-2">{q.question}</p>
                                          </div>
                                        )
                                      }
                                      if (p.type === 'embed') {
                                        if (!isCurrent) {
                                          return (
                                            <div key={j} className="rounded border border-slate-600/50 bg-slate-700/20 px-2 py-1 text-[10px] text-slate-300">
                                              {tr('Nội dung nhúng', 'Embedded content', '嵌入内容', '埋め込みコンテンツ', '임베드 콘텐츠')}
                                            </div>
                                          )
                                        }
                                        return (
                                          <div key={j} className="rounded overflow-hidden border border-slate-600/60">
                                                    <LazyHeavyMount minHeight={120}>
                                                      <ContentEmbed type={p.embedType} urlOrId={p.urlOrId} width={200} height={120} tr={tr} />
                                                    </LazyHeavyMount>
                                          </div>
                                        )
                                      }
                                      return null
                                    })}
                                  </div>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {(curriculumId || worksheetId) && asArray(splitContentWithEmbeds(b.content ?? '')).filter((p): p is { type: 'embed'; embedType: 'quiz'; urlOrId: string; rawMarker: string } => p.type === 'embed' && p.embedType === 'quiz').map((p, qIdx) => (
                                      <button key={qIdx} type="button" disabled={!!quizReportLoading || !!worksheetId} title={worksheetId ? tr('Chỉ cho giáo trình đã lưu', 'Only for saved curriculum', '仅限已保存课程', '保存済みカリキュラムのみ', '저장된 교육과정만') : undefined} onClick={() => curriculumId && reportQuizWrong({ curriculumId, slideIndex: idx, blockIndex: i, quizMarker: p.rawMarker, slideTitle: s?.title ?? '', slideContent: (blks ?? []).map((bl) => (bl.header ? `### ${bl.header}\n\n` : '') + (bl.content ?? '')).join('\n\n') })} className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5', curriculumId ? 'text-rose-300 hover:text-rose-200 bg-rose-500/20 disabled:opacity-50' : 'text-rose-400/60 bg-rose-500/10 cursor-not-allowed opacity-60')}>
                                        <Flag className="h-2.5 w-2.5" />{tr('Báo sai', 'Report wrong', '报告错误', '誤り報告', '오류 신고')}
                                      </button>
                                    ))}
                                    {showDirectEdit && (
                                      <button type="button" onClick={() => { setEditingBlock({ slideIndex: idx, blockIndex: i }); setEditingValue(b.content ?? '') }} className="text-[10px] font-medium text-violet-300 hover:text-violet-200 px-1.5 py-0.5 rounded bg-violet-500/20 flex items-center gap-0.5">
                                        <Edit3 className="h-2.5 w-2.5" />{tr('Sửa', 'Edit', '编辑', '編集', '편집')}
                                      </button>
                                    )}
                                    {showProposalUi && worksheetId && (
                                      <button
                                        type="button"
                                        onClick={() => void openWorksheetBlockEditorFromSlide(idx)}
                                        className="text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5 text-amber-300 hover:text-amber-200 bg-amber-500/20"
                                      >
                                        <Edit3 className="h-2.5 w-2.5" />
                                        {tr('Sửa', 'Edit', '编辑', '編集', '편집')}
                                      </button>
                                    )}
                                    {showProposalUi && !worksheetId && (
                                      <>
                                        <button type="button" onClick={() => setProposalDialog({ open: true, slideIndex: idx, blockIndex: i, type: 'edit', originalContent: b.content, blockHeader: b.header })} className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5', curriculumId ? 'text-amber-300 hover:text-amber-200 bg-amber-500/20' : 'text-amber-400/60 bg-amber-500/10 cursor-not-allowed opacity-60')}>
                                          <Edit3 className="h-2.5 w-2.5" />{tr('Đề xuất sửa', 'Propose', '建议', '提案', '제안')}
                                        </button>
                                        <button type="button" onClick={() => setProposalDialog({ open: true, slideIndex: idx, blockIndex: i, type: 'add', blockHeader: b.header })} className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5', curriculumId ? 'text-emerald-300 hover:text-emerald-200 bg-emerald-500/20' : 'text-emerald-400/60 bg-emerald-500/10 cursor-not-allowed opacity-60')}>
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
                        })}
                        </>
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
                              <div className="text-slate-200 text-sm md:text-base whitespace-pre-wrap break-words leading-relaxed min-w-0 text-left space-y-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-1">
                                {asArray(splitContentWithEmbeds(s.content ?? '')).map((p, j) => {
                                  if (p.type === 'text') return p.value ? <span key={j} className="line-clamp-4">{p.value}</span> : null
                                  if (p.type === 'embed' && p.embedType === 'quiz') {
                                    const q = parseQuizData(p.urlOrId)
                                    if (!q) return null
                                    return (
                                      <div key={j} className="rounded bg-violet-500/15 border border-violet-400/30 p-1.5">
                                        <div className="text-violet-200 font-medium text-xs mb-0.5">{tr('Câu hỏi trắc nghiệm', 'Quiz', '测验', 'クイズ', '퀴즈')}</div>
                                        <p className="text-slate-200/95 text-sm md:text-base line-clamp-2">{q.question}</p>
                                      </div>
                                    )
                                  }
                                  if (p.type === 'embed') {
                                    if (!isCurrent) {
                                      return (
                                        <div key={j} className="rounded border border-slate-600/50 bg-slate-700/20 px-2 py-1 text-[10px] text-slate-300">
                                          {tr('Nội dung nhúng', 'Embedded content', '嵌入内容', '埋め込みコンテンツ', '임베드 콘텐츠')}
                                        </div>
                                      )
                                    }
                                    return (
                                      <div key={j} className="rounded overflow-hidden border border-slate-600/60">
                                        <LazyHeavyMount minHeight={120}>
                                          <ContentEmbed type={p.embedType} urlOrId={p.urlOrId} width={200} height={120} tr={tr} />
                                        </LazyHeavyMount>
                                      </div>
                                    )
                                  }
                                  return null
                                })}
                              </div>
                              {isCurrent && (curriculumId || worksheetId) && asArray(splitContentWithEmbeds(s.content ?? '')).filter((p): p is { type: 'embed'; embedType: 'quiz'; urlOrId: string; rawMarker: string } => p.type === 'embed' && p.embedType === 'quiz').map((p, qIdx) => (
                                <button key={qIdx} type="button" disabled={!!quizReportLoading || !!worksheetId} title={worksheetId ? tr('Chỉ cho giáo trình đã lưu', 'Only for saved curriculum', '仅限已保存课程', '保存済みカリキュラムのみ', '저장된 교육과정만') : undefined} onClick={() => curriculumId && reportQuizWrong({ curriculumId, slideIndex: idx, blockIndex: 0, quizMarker: p.rawMarker, slideTitle: s?.title ?? '', slideContent: s.content ?? '' })} className={cn('text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-rose-500/50 mt-1', curriculumId ? 'text-rose-400 hover:text-rose-300 bg-slate-700/50 disabled:opacity-50' : 'text-rose-400/60 bg-slate-700/30 cursor-not-allowed opacity-60')}>
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
                              {isCurrent && (slideMode === 'shared' || slideMode === 'original' || slideMode === null) && worksheetId && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  <button
                                    type="button"
                                    onClick={() => void openWorksheetBlockEditorFromSlide(idx)}
                                    className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 text-amber-400 hover:text-amber-300 bg-slate-700/50 border border-amber-500/50"
                                  >
                                    <Edit3 className="h-2.5 w-2.5" />
                                    {tr('Sửa', 'Edit', '编辑', '編集', '편집')}
                                  </button>
                                </div>
                              )}
                              {isCurrent && (slideMode === 'shared' || slideMode === 'original' || slideMode === null) && curriculumId && !worksheetId && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  <button type="button" onClick={() => setProposalDialog({ open: true, slideIndex: idx, blockIndex: 0, type: 'edit', originalContent: s.content })} className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 text-amber-400 hover:text-amber-300 bg-slate-700/50 border border-amber-500/50">
                                    <Edit3 className="h-2.5 w-2.5" />{tr('Đề xuất sửa', 'Propose edit', '建议编辑', '編集提案', '편집 제안')}
                                  </button>
                                  <button type="button" onClick={() => setProposalDialog({ open: true, slideIndex: idx, blockIndex: 0, type: 'add' })} className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 text-emerald-400 hover:text-emerald-300 bg-slate-700/50 border border-emerald-500/50">
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
                          onChange={(e) => { setNotesValue(e.target.value); setNotesDirty(true) }}
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
          onSuccess={async () => {
            await refreshProposals()
            requestCurriculum()
          }}
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
      {visualFullscreenOpen && leftPanelMode === 'visual' && slides[currentIndex] && (() => {
        const s = slides[currentIndex]
        const { layout, cells } = getVisualCellsForPresentation(
          s,
          activeVisualInfographic,
          [lessonInfographic?.imageUrl, curriculumInfographic?.imageUrl],
          infographicSourceView !== 'visual'
        )
        const showSingleCell = teacherExpandedCellIndex != null && layout > 1
        const displayCells = showSingleCell && cells[teacherExpandedCellIndex] ? [cells[teacherExpandedCellIndex]] : cells
        const displayIndices = showSingleCell && teacherExpandedCellIndex != null ? [teacherExpandedCellIndex] : cells.map((_, i) => i)
        const gridClass =
          !showSingleCell && layout === 2
            ? 'grid min-h-0 grid-rows-2 gap-2'
            : !showSingleCell && layout === 4
              ? 'grid min-h-0 grid-cols-2 grid-rows-2 gap-2'
              : ''
        return (
          <div ref={teacherVisualOverlayRef} className="fixed inset-0 z-[105] flex min-h-0 flex-col bg-black">
            <div className="z-20 flex h-14 w-full shrink-0 items-center justify-between bg-black/70 px-4">
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
            <div
              className="flex min-h-0 flex-1 flex-col px-4 pb-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeTeacherVisualFullscreen()
              }}
            >
                <div
                  ref={teacherVisualFrameRef}
                  className={cn(
                    'flex min-h-0 w-full flex-1 overflow-hidden min-w-0',
                    showSingleCell || layout === 1 ? 'flex-col gap-4' : gridClass
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                {displayCells.map((cell, i) => {
                  const cellFillClass =
                    showSingleCell || layout === 1 ? 'min-h-0 w-full flex-1 basis-0' : 'h-full min-h-0 min-w-0'
                  return (
                  <div
                    key={displayIndices[i] ?? i}
                    className={cn('relative flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/30', cellFillClass)}
                  >
                    {cell.visualEmbed ? (
                      (() => {
                        const embeds = parseContentEmbeds(cell.visualEmbed)
                        const first = embeds[0]
                        if (!first) return <div className="min-h-0 flex-1 basis-0" />
                        return (
                          <div className="flex min-h-0 flex-1 basis-0 flex-col">
                            <LazyHeavyMount minHeight={220}>
                              <ContentEmbed type={first.type} urlOrId={first.urlOrId} tr={tr} hideQuiz fill className="!my-0 !rounded-xl !border-0" />
                            </LazyHeavyMount>
                          </div>
                        )
                      })()
                    ) : cell.imageUrl ? (
                      <div className="flex min-h-0 flex-1 basis-0 items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element -- slide visual imageUrl is dynamic/remote */}
                        <img src={cell.imageUrl} alt="" className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
                      </div>
                    ) : (
                      <div className="min-h-0 flex-1 basis-0 bg-white/5" />
                    )}
                  </div>
                  )
                })}
                </div>
            </div>
          </div>
        )
      })()}
      {infographicFullscreenOpen && activeVisualInfographic && (() => {
        const inf = activeVisualInfographic
        return (
          <div ref={teacherInfographicOverlayRef} className="fixed inset-0 z-[105] flex min-h-0 flex-col bg-black">
            <div className="z-20 flex h-14 w-full shrink-0 items-center justify-between bg-black/70 px-4">
              <span className="text-white/80 text-sm">
                {tr('Infographic giáo trình', 'Curriculum infographic', '课程信息图', 'カリキュラムインフォ', '교육과정 인포그래픽')}
              </span>
              <button
                type="button"
                onClick={closeTeacherInfographicFullscreen}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white font-medium transition-colors"
                title={tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}
              >
                <X className="h-5 w-5" />
                {tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}
              </button>
            </div>
            <div
              className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeTeacherInfographicFullscreen()
              }}
            >
              <div
                key={activeVisualInfographicRenderKey}
                ref={teacherInfographicOverlayStageRef}
                data-teacher-infographic-draw-fullscreen-stage
                className="relative flex min-h-0 w-full flex-1 touch-none items-center justify-center"
                onPointerDown={(e) => startInfographicDrawing('fullscreen', e)}
                onClick={(e) => e.stopPropagation()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- remote infographic URL */}
                <img ref={teacherInfographicOverlayImgRef} src={inf.imageUrl} alt="" draggable={false} onDragStart={(ev) => ev.preventDefault()} className="max-h-full max-w-full select-none object-contain touch-none" referrerPolicy="no-referrer" />
                <canvas ref={teacherInfographicOverlayCanvasRef} className="pointer-events-none absolute" aria-hidden />
                <div
                  className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-lg border border-white/25 bg-black/70 p-1.5 text-white shadow-xl"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button type="button" onClick={() => setInfographicDrawTool('pen')} className={cn('rounded px-2 py-1 text-xs transition-colors', infographicDrawTool === 'pen' ? 'bg-white/30' : 'hover:bg-white/15')}>{tr('Vẽ', 'Draw', '画笔', '描画', '그리기')}</button>
                  <button type="button" onClick={() => setInfographicDrawTool('eraser')} className={cn('rounded px-2 py-1 text-xs transition-colors', infographicDrawTool === 'eraser' ? 'bg-white/30' : 'hover:bg-white/15')}>{tr('Tẩy', 'Erase', '橡皮', '消しゴム', '지우기')}</button>
                  <button type="button" onClick={() => setInfographicDrawBrushPx(3)} className={cn('rounded px-2 py-1 text-xs transition-colors', infographicDrawBrushPx === 3 ? 'bg-white/30' : 'hover:bg-white/15')}>{tr('Nhỏ', 'S', '细', '細', '얇게')}</button>
                  <button type="button" onClick={() => setInfographicDrawBrushPx(5)} className={cn('rounded px-2 py-1 text-xs transition-colors', infographicDrawBrushPx === 5 ? 'bg-white/30' : 'hover:bg-white/15')}>{tr('Vừa', 'M', '中', '中', '중간')}</button>
                  <button type="button" onClick={() => setInfographicDrawBrushPx(7)} className={cn('rounded px-2 py-1 text-xs transition-colors', infographicDrawBrushPx === 7 ? 'bg-white/30' : 'hover:bg-white/15')}>{tr('To', 'L', '粗', '太', '굵게')}</button>
                  <div className="flex items-center gap-1 px-1">
                    {INFOGRAPHIC_DRAW_COLORS.map((color) => (
                      <button
                        key={`t-fsb-${color}`}
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
                      sendToStudentView({ type: 'infographic-draw-undo', slideIndex: activeInfographicStrokeKey })
                    }}
                    className="rounded px-2 py-1 text-xs transition-colors hover:bg-white/15"
                  >
                    {tr('Undo', 'Undo', '撤销', '元に戻す', '실행 취소')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearInfographicStrokes(activeInfographicStrokeKey)
                      sendToStudentView({ type: 'infographic-draw-clear', slideIndex: activeInfographicStrokeKey })
                    }}
                    className="rounded px-2 py-1 text-xs transition-colors hover:bg-white/15"
                  >
                    {tr('Xóa nét', 'Clear', '清除', 'クリア', '지우기')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
      {slides[currentIndex] && (
        <QuizPopupDialog
          open={quizPopupOpen}
          onOpenChange={(open) => {
            setQuizPopupOpen(open)
            setQuizSessionData((prev) => {
              const next = { ...prev }
              for (const k of Object.keys(next)) {
                if (k.startsWith(`${currentIndex}-`)) delete next[k]
              }
              return next
            })
            setQuizSessionSettings((prev) => {
              const next = { ...prev }
              for (const k of Object.keys(next)) {
                if (k.startsWith(`${currentIndex}-`)) delete next[k]
              }
              return next
            })
            sendToStudentView({ type: 'quiz-session-reset-slide', slideIndex: currentIndex })
          }}
          slide={slides[currentIndex]}
          slideIndex={currentIndex}
          curriculumId={curriculumId ?? undefined}
          tr={tr}
          teacherMode
          quizSessionCodes={Object.fromEntries(Object.entries(quizSessionData).map(([k, v]) => [k, v.sessionCode]))}
          quizSessionTimers={{
            ...Object.fromEntries(Object.entries(quizSessionSettings).map(([k, v]) => [k, v.quizDurationSeconds])),
            ...Object.fromEntries(Object.entries(quizSessionData).map(([k, v]) => [k, v.quizDurationSeconds])),
          }}
          quizSessionAutoReveal={Object.fromEntries(Object.entries(quizSessionSettings).map(([k, v]) => [k, v.autoRevealOnTimerEnd]))}
          onQuizSettingsChange={(si, bi, settings) => {
            const key = `${si}-${bi}`
            let changed = false
            setQuizSessionSettings((prev) => {
              const cur = prev[key]
              if (cur && cur.quizDurationSeconds === settings.quizDurationSeconds && cur.autoRevealOnTimerEnd === settings.autoRevealOnTimerEnd) {
                return prev
              }
              changed = true
              return { ...prev, [key]: settings }
            })
            if (!changed) return
            sendToStudentView({ type: 'quiz-session-settings', slideIndex: si, blockIndex: bi, quizDurationSeconds: settings.quizDurationSeconds, autoRevealOnTimerEnd: settings.autoRevealOnTimerEnd })
          }}
          onQuizSessionCreated={(si, bi, code, quizDurationSeconds) => {
            const key = `${si}-${bi}`
            const data = { sessionCode: code, quizDurationSeconds: quizDurationSeconds ?? 60 }
            setQuizSessionData((prev) => ({ ...prev, [key]: data }))
            sendToStudentView({ type: 'quiz-session-code', slideIndex: si, blockIndex: bi, sessionCode: code, quizDurationSeconds: data.quizDurationSeconds })
          }}
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
      {gvWorksheetEditFilter && worksheetId && (
        <WorksheetEditSectionPopup
          open={true}
          onClose={resetGvWorksheetEdit}
          filter={gvWorksheetEditFilter}
          blocks={gvWorksheetEditBlocks}
          blockIndex={gvWorksheetEditBlockIndex}
          blockContent={gvWorksheetEditBlockContent}
          onBlockContentChange={setGvWorksheetEditBlockContent}
          onSelectBlock={(idx) => void loadGvWorksheetEditorAtGlobalIndex(idx)}
          onCancelEdit={resetGvWorksheetEdit}
          checkResult={gvWorksheetEditCheckResult}
          onApplyFix={() => {
            const corrected = gvWorksheetEditCheckResult?.correctedContent
            if (corrected) {
              setGvWorksheetEditBlockContent(corrected)
              setGvWorksheetEditCheckResult(null)
              void handleGvSaveWorksheetBlockEdit({ skipAiCheck: true, contentOverride: corrected })
            }
          }}
          onCheck={() => void handleGvCheckWorksheetBlock()}
          onSave={() => void handleGvSaveWorksheetBlockEdit()}
          editImages={gvWorksheetEditImages}
          onPickImages={(files) => {
            const list = Array.from(files ?? []).filter((f) => f && f.size > 0)
            if (list.length === 0) return
            setGvWorksheetEditImages((prev) => [...prev, ...list].slice(0, 6))
          }}
          onRemoveImage={(idx) => setGvWorksheetEditImages((prev) => prev.filter((_, i) => i !== idx))}
          onClearImages={() => setGvWorksheetEditImages([])}
          checkLoading={gvWorksheetEditCheckLoading}
          saving={gvWorksheetEditSaving}
          checkCreditSuffix={worksheetEditCheckCreditSuffix}
          saveCreditSuffix={worksheetEditSaveCreditSuffix}
          saveDisabled={
            !worksheetId?.trim() ||
            gvWorksheetEditBlockContent.trim() ===
              (gvWorksheetEditBlockIndex != null && gvWorksheetEditBlocks[gvWorksheetEditBlockIndex]
                ? toEditableBlockContent(
                    gvWorksheetEditBlocks[gvWorksheetEditBlockIndex].content,
                    gvWorksheetEditBlocks[gvWorksheetEditBlockIndex].type === 'essay' ? 'essay' : 'quiz',
                  )
                : ''
              ).trim()
          }
          tr={tr}
        />
      )}
      <AnswerTypingPositionPopover
        open={answerRevealJumpPopoverSlideIndex !== null}
        onOpenChange={(o) => {
          if (!o) closeAnswerRevealJumpDialog()
        }}
        anchorRef={answerRevealJumpAnchorRef}
        totalSegments={answerRevealJumpSlideSegmentTotal}
        draft={answerRevealJumpDraft}
        onDraftChange={setAnswerRevealJumpDraft}
        disabled={false}
        onApply={(n) => {
          const si = answerRevealJumpPopoverSlideIndex
          if (si == null) return
          const blks = slides[si]?.blocks ?? []
          const slideRow = slides[si]
          const distributed = distributeGlobalRevealAcrossSlide(n, blks, si, answerRevealJumpOpts, slideRow?.title ?? '')
          setAnswerRevealProgress((prev) => ({ ...prev, ...distributed }))
        }}
        tr={tr}
      />
      <Toaster />
    </div>
  )
}

