'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Sparkles, Copy, FileDown, RefreshCw, FileSpreadsheet, FolderOpen, BookOpen, FileText, Presentation, Trash2, Upload, ImageIcon, FileQuestion, ListChecks, ChevronDown, Users, NotebookPen, Link2 } from 'lucide-react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { latexToReadable } from './lib/latex-to-readable'
import { SlideVersionDialog, type SlideVersionChoice } from './components/slide-version-dialog'
import { CurriculumExerciseListDialog } from './components/curriculum-exercise-list-dialog'
import type { AISlideData } from './lib/curriculum-to-slides'
import type { SlideInfographic } from './lib/slide-infographic'
import { SUBJECTS, GRADE_LEVELS, GRADE_LEVEL_GROUPS, TEXTBOOK_SETS } from './lib/curriculum-subjects'
import { createCurriculum, saveCurriculum, saveTextbookLessonFromImage, listCurricula, getCurriculumById, getWorksheetById, getWorksheetsByCurriculumId, deleteCurriculum, saveSlidesToCurriculum, checkCurriculumExists, recordCurriculumOpen, clearCurriculumDerivedData, saveWorksheetContent } from './actions'
import {
  ensureCurriculumLessonSlidesPreparedAction,
  getCurriculumLessonMetaAction,
  getCurriculumSlidesByLessonCachedAction,
} from './lesson-actions'
import { extractEditRegions } from './lib/curriculum-region-extract'
import { highlightMatchInCurriculum } from './components/curriculum-edit-sheet'
import { parseWorksheetIntoBlocks, replaceBlockInMarkdown } from './lib/worksheet-parse-questions'
import { mergeContentWithQuestions } from './lib/merge-worksheet-content'
import { toEditableBlockContent } from './lib/worksheet-editable-block-content'
import { WorksheetEditSectionPopup } from './components/worksheet-edit-section-popup'
import { getEssayProblem, getEssaySolution, normalizeSolutionToStr } from './lib/worksheet-content-json'
import { AIProgressLoader } from '@/components/ai-progress-loader'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSetCreationToolBackHandler } from '@/components/navigation/creation-tool-shell-back'
import { formatSessionIsoDateTime } from '@/lib/datetime/format-session-iso-local'
import { fillI18nTemplate } from '@/lib/i18n/fill-template'
import { DEFAULT_WEB_LOCALE, type WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { CURRICULUM_UI_CREDITS, formatCurriculumCredits } from './lib/curriculum-credit-costs'
import { AttachExamToClassDialog } from '@/components/exam/attach-exam-to-class-dialog'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { CurriculumLessonChunk } from './lib/curriculum-slides-json'

type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function matchesDestructiveConfirm(input: string, phrase: string): boolean {
  const norm = (s: string) =>
    s.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()
  return norm(input) === norm(phrase)
}

const WS_ACTIVE_JOB_KEY = 'worksheet_active_job'
const LAST_OPENED_CURRICULUM_KEY = 'tao_giao_trinh_last_opened_curriculum_id'
/** Ảnh trang sách gửi lên POST /api/curriculum-from-image — khớp MAX_IMAGES trong route. */
const MAX_CURRICULUM_LESSON_IMAGES = 20
const LESSON_FALLBACK_SLIDE_SIZE = 10

type CurriculumWorksheetListItem = {
  id: string
  topic: string
  subject_id: string
  grade_level_id: string
  content_markdown: string
  created_at: string
}

function compactWorksheetList(items: CurriculumWorksheetListItem[] | null | undefined): CurriculumWorksheetListItem[] {
  if (!Array.isArray(items)) return []
  // Danh sách chỉ dùng cho chọn phiếu; không giữ full markdown của từng phiếu để tránh phình bộ nhớ.
  return items.map((w) => ({
    id: w.id,
    topic: w.topic,
    subject_id: w.subject_id,
    grade_level_id: w.grade_level_id,
    content_markdown: '',
    created_at: w.created_at,
  }))
}

type LessonSlideGroup = {
  id: string
  lessonNo: number
  indices: number[]
}

function lessonChunksToGroups(chunks: CurriculumLessonChunk[] | undefined | null): LessonSlideGroup[] {
  if (!Array.isArray(chunks) || chunks.length === 0) return []
  return chunks
    .filter((c) => Number.isFinite(c.lessonNo) && Number.isFinite(c.startIndex) && Number.isFinite(c.endIndex))
    .map((c) => {
      const start = Math.max(0, Math.floor(c.startIndex))
      const end = Math.max(start, Math.floor(c.endIndex))
      const indices: number[] = []
      for (let i = start; i <= end; i += 1) indices.push(i)
      return { id: `lesson-${c.lessonNo}`, lessonNo: Math.floor(c.lessonNo), indices }
    })
}

function buildFallbackGroupsByTotalSlides(totalSlides: number): LessonSlideGroup[] {
  const safeTotal = Number.isFinite(totalSlides) ? Math.max(0, Math.floor(totalSlides)) : 0
  if (safeTotal <= 0) return []
  const out: LessonSlideGroup[] = []
  let lessonNo = 1
  for (let i = 0; i < safeTotal; i += LESSON_FALLBACK_SLIDE_SIZE) {
    const end = Math.min(safeTotal, i + LESSON_FALLBACK_SLIDE_SIZE)
    const indices: number[] = []
    for (let j = i; j < end; j += 1) indices.push(j)
    out.push({ id: `lesson-fallback-${lessonNo}`, lessonNo, indices })
    lessonNo += 1
  }
  return out
}

function normalizeGradeLevelId(id: string): string {
  const map: Record<string, string> = { 'tieu-hoc': 'lop-1', thcs: 'lop-6', thpt: 'lop-12' }
  return map[id] ?? id
}

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

function splitWorksheetSections(markdown: string): { quiz: string; essay: string } {
  const text = (markdown ?? '').trim()
  if (!text) return { quiz: '', essay: '' }

  const lines = text.split('\n')
  let mode: 'none' | 'quiz' | 'essay' = 'none'
  const quizLines: string[] = []
  const essayLines: string[] = []

  for (const line of lines) {
    const normalized = line.toLowerCase()
    const isHeading = /^#{2,4}\s+/.test(line)
    if (isHeading) {
      if (
        /(trắc nghiệm|quiz|multiple choice)/i.test(normalized) ||
        /^#{2,4}\s*1[\).:\-]/.test(normalized)
      ) {
        mode = 'quiz'
      } else if (
        /(tự luận|thông hiểu|vận dụng|đáp án|lời giải|essay|short answer|solution|answer)/i.test(normalized) ||
        /^#{2,4}\s*[2-9][\).:\-]/.test(normalized)
      ) {
        mode = 'essay'
      }
    }

    if (mode === 'quiz') quizLines.push(line)
    else if (mode === 'essay') essayLines.push(line)
    else {
      // Header/introduction before numbered sections: keep in essay to avoid losing content.
      essayLines.push(line)
    }
  }

  let quiz = quizLines.join('\n').trim()
  let essay = essayLines.join('\n').trim()

  // Fallback: nội dung cũ không có tiêu đề ## Phần trắc nghiệm – tách theo "### Bài"
  if (!quiz && essay && /###\s*Bài\s+\d/i.test(essay)) {
    const idx = essay.search(/###\s*Bài\s+\d/i)
    const before = essay.slice(0, idx).trim()
    const after = essay.slice(idx).trim()
    // Phần trước "### Bài" có dạng trắc nghiệm (1. 2. ... **Đáp án:** A/B/C/D)?
    if (/^\d+\.\s+/m.test(before) && /\*\*Đáp án\*\*:\s*[ABCD]/i.test(before)) {
      quiz = before
      essay = after
    }
  }

  if (!quiz && essay) return { quiz: '', essay }
  if (!essay && quiz) return { quiz, essay: '' }
  return { quiz, essay }
}

function stripWorksheetAnswerSections(markdown: string): string {
  const text = (markdown ?? '').trim()
  if (!text) return ''
  const lines = text.split('\n')
  const out: string[] = []
  let skippingAnswerSection = false
  for (const line of lines) {
    const normalized = line.toLowerCase()
    const isHeading = /^#{1,6}\s+/.test(line)
    if (isHeading) {
      const isAnswerHeading = /(đáp án|lời giải|answer|solution)/i.test(normalized)
      if (isAnswerHeading) {
        skippingAnswerSection = true
        continue
      }
      skippingAnswerSection = false
    }
    if (skippingAnswerSection) continue
    if (/^\s*\*{0,2}\s*đáp án trắc nghiệm\s*:/i.test(normalized)) continue
    out.push(line)
  }
  return out.join('\n').trim()
}

type Step = 'INPUT' | 'GENERATING' | 'RESULT'
export default function TaoGiaoTrinhClientPage({
  initialWebLocale = DEFAULT_WEB_LOCALE,
}: { initialWebLocale?: WebLocale } = {}) {
  const [uiLocale, setUiLocale] = useState<UiLocale>(initialWebLocale as UiLocale)
  const [step, setStep] = useState<Step>('INPUT')
  const [subjectId, setSubjectId] = useState('toan')
  const [gradeLevelId, setGradeLevelId] = useState('lop-12')
  const [textbookSetId, setTextbookSetId] = useState('ket-noi-tri-thuc')
  const [textbookVolume, setTextbookVolume] = useState<string>('')
  const [bookIsbn, setBookIsbn] = useState('')
  const [lessonNumber, setLessonNumber] = useState<string>('1')
  const [lessonTypeId, setLessonTypeId] = useState('hinh-thanh-kien-thuc')
  const [topic, setTopic] = useState('')
  const [numLessons, setNumLessons] = useState(3)
  const [lessonDurationMinutes, setLessonDurationMinutes] = useState(45)
  const [goals, setGoals] = useState('')
  const [curriculumMarkdown, setCurriculumMarkdown] = useState('')
  const [curriculumId, setCurriculumId] = useState<string | null>(null)
  const [worksheetMarkdown, setWorksheetMarkdown] = useState('')
  const worksheetStudentMarkdown = useMemo(
    () => latexToReadable(stripWorksheetAnswerSections(worksheetMarkdown)),
    [worksheetMarkdown]
  )
  const worksheetParts = useMemo(() => splitWorksheetSections(worksheetStudentMarkdown), [worksheetStudentMarkdown])
  const [worksheetId, setWorksheetId] = useState<string | null>(null)
  const [worksheetVerifyPollUntil, setWorksheetVerifyPollUntil] = useState(0)
  const [showBrowse, setShowBrowse] = useState(true)
  const [curriculaList, setCurriculaList] = useState<Array<{ id: string; topic: string; subject_id: string; grade_level_id: string; textbook_set_id?: string; textbook_volume?: string | null; lesson_number?: number | null; lesson_type_id?: string; num_lessons?: number; lesson_duration_minutes?: number; created_at: string }>>([])
  const [curriculumWorksheets, setCurriculumWorksheets] = useState<CurriculumWorksheetListItem[]>([])
  const [browseLoading, setBrowseLoading] = useState(false)
  const [browseSubjectFilter, setBrowseSubjectFilter] = useState<string>('')
  const [browseGradeFilter, setBrowseGradeFilter] = useState<string>('')
  const [aiSlides, setAiSlides] = useState<AISlideData[] | null>(null)
  const [curriculumSlides, setCurriculumSlides] = useState<AISlideData[] | null>(null)
  const [slideAnalysisLoading, setSlideAnalysisLoading] = useState(false)
  const [showSlideVersionDialog, setShowSlideVersionDialog] = useState(false)
  const [exerciseListOpen, setExerciseListOpen] = useState(false)
  const [slideVersionChoice, setSlideVersionChoice] = useState<SlideVersionChoice | null>(null)
  const [sharedSlides, setSharedSlides] = useState<AISlideData[] | null>(null)
  const [originalSlides, setOriginalSlides] = useState<AISlideData[] | null>(null)
  const [personalSlides, setPersonalSlides] = useState<AISlideData[] | null>(null)
  const [hasOriginalOrSharedVersion, setHasOriginalOrSharedVersion] = useState(false)
  const [hasPersonalVersion, setHasPersonalVersion] = useState(false)
  const [lessonMetaByMode, setLessonMetaByMode] = useState<Partial<Record<SlideVersionChoice, LessonSlideGroup[]>>>({})
  const [lessonTotalSlidesByMode, setLessonTotalSlidesByMode] = useState<Partial<Record<SlideVersionChoice, number>>>({})
  const [lessonSelectOpen, setLessonSelectOpen] = useState(false)
  const [lessonGroups, setLessonGroups] = useState<LessonSlideGroup[]>([])
  const [lessonPreparingGroupId, setLessonPreparingGroupId] = useState<string | null>(null)
  const [lessonPreparingLessonNo, setLessonPreparingLessonNo] = useState<number | null>(null)
  const pendingLessonOpenRef = useRef<{
    slides: AISlideData[] | null
    mode: SlideVersionChoice | null
    infographic?: SlideInfographic
    curriculumId?: string | null
  } | null>(null)
  const activeOpenedSlidesRef = useRef<AISlideData[] | null>(null)
  const activeOpenedLessonMarkdownRef = useRef<string | null>(null)
  const selectedLessonNoRef = useRef<number | null>(null)
  const openSlidesInFlightRef = useRef(false)
  const versionChooseArmedRef = useRef(false)
  /** Infographic (một ảnh / giáo trình) theo từng bản lưu — gửi kèm curriculum-data tới cửa sổ GV */
  const [infographicShared, setInfographicShared] = useState<SlideInfographic | undefined>(undefined)
  const [infographicOriginal, setInfographicOriginal] = useState<SlideInfographic | undefined>(undefined)
  const [infographicPersonal, setInfographicPersonal] = useState<SlideInfographic | undefined>(undefined)
  const [curriculumExists, setCurriculumExists] = useState<boolean | null>(null)
  const [existingCurriculumId, setExistingCurriculumId] = useState<string | null>(null)
  const [existingCurriculumTopic, setExistingCurriculumTopic] = useState<string | null>(null)
  const [similarTopicCurricula, setSimilarTopicCurricula] = useState<Array<{ id: string; topic: string; score: number }>>([])
  const [checkLoading, setCheckLoading] = useState(false)
  const [openExistingLoading, setOpenExistingLoading] = useState(false)
  const [overwriteFromExistingLoading, setOverwriteFromExistingLoading] = useState(false)
  const [lastOverwriteAt, setLastOverwriteAt] = useState<string | null>(null)
  const [lessonImages, setLessonImages] = useState<File[]>([])
  const lessonImageInputRef = useRef<HTMLInputElement>(null)
  const [createMode, setCreateMode] = useState<'textbook' | 'topic'>('textbook')
  const [featureSection, setFeatureSection] = useState<'create' | 'library' | 'exam' | 'homework'>('create')
  const [wsStepByStepQuizCount, setWsStepByStepQuizCount] = useState(5)
  const [wsStepByStepEssayCount, setWsStepByStepEssayCount] = useState(5)
  const [wsStepByStepQuizDiff, setWsStepByStepQuizDiff] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [wsStepByStepEssayBloom, setWsStepByStepEssayBloom] = useState<'nhan-biet' | 'thong-hieu' | 'van-dung-thap' | 'van-dung-cao' | 'thuc-te'>('thong-hieu')
  const [, setWsStepByStepQuestionIds] = useState<string[]>([])
  const [wsStepByStepLoading, setWsStepByStepLoading] = useState(false)
  const [wsStepByStepStatus, setWsStepByStepStatus] = useState<string>('')
  const [wsStepByStepExpanded, setWsStepByStepExpanded] = useState(false) // Đóng mặc định; mở khi bấm "Tạo từng câu"
  const [wsStepByStepCounts, setWsStepByStepCounts] = useState<{ quiz: Record<string, number>; essay: Record<string, number> } | null>(null)
  const [wsStepByStepSessionCounts, setWsStepByStepSessionCounts] = useState<{ quiz: Record<string, number>; essay: Record<string, number> }>({ quiz: {}, essay: {} })
  /** Mặc định mở khối tạo phiếu từ ảnh SGK khi đã có giáo trình (vẫn chỉ render khi có curriculumMarkdown). */
  const [sgkExpanded, setSgkExpanded] = useState(true)
  const [sgkLoading, setSgkLoading] = useState(false)
  const [sgkImages, setSgkImages] = useState<File[]>([])
  const [examListLoading, setExamListLoading] = useState(false)
  const [examDeletingCode, setExamDeletingCode] = useState<string | null>(null)
  const [homeworkListLoading, setHomeworkListLoading] = useState(false)
  const [homeworkDeletingCode, setHomeworkDeletingCode] = useState<string | null>(null)
  const [createdExamItems, setCreatedExamItems] = useState<Array<{
    id: string
    code: string
    title: string
    status: string
    durationMinutes: number
    totalQuestions: number
    createdAt: string
    examUrl: string
  }>>([])
  const [createdHomeworkItems, setCreatedHomeworkItems] = useState<Array<{
    id: string
    code: string
    title: string
    status: string
    durationMinutes: number
    totalQuestions: number
    createdAt: string
    examUrl: string
  }>>([])
  const [examPreview, setExamPreview] = useState<null | {
    code: string
    title: string
    examUrl: string
    qrDataUrl: string | null
    loadingQr: boolean
    forHomework?: boolean
  }>(null)
  /** Gắn bài thi đã tạo sang lớp khác — cùng dialog như /tao-bai-thi */
  const [examAttachTarget, setExamAttachTarget] = useState<null | { id: string; title: string }>(null)
  const [createdExamDeleteTarget, setCreatedExamDeleteTarget] = useState<null | { code: string; title: string }>(null)
  const [createdExamDeleteConfirmInput, setCreatedExamDeleteConfirmInput] = useState('')
  const sgkSubmitLockRef = useRef(false)
  const wsStepByStepSubmitLockRef = useRef(false)
  const sgkInputRef = useRef<HTMLInputElement>(null)
  const lessonTrimTimeoutRef = useRef<number | null>(null)
  const lessonTrimIdleRef = useRef<number | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const handleCreationToolShellBack = useCallback(() => {
    if (featureSection !== 'create') {
      setFeatureSection('create')
      return
    }
    router.back()
  }, [featureSection, router])
  useSetCreationToolBackHandler(handleCreationToolShellBack)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const host = window.location.hostname
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
    if (!isLocalHost) return
    if (!('serviceWorker' in navigator)) return
    void navigator.serviceWorker.getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .catch(() => {})
  }, [])
  const pageHeaderRef = useRef<HTMLDivElement>(null)
  const curriculumResultRef = useRef<HTMLDivElement>(null)
  const worksheetSectionRef = useRef<HTMLDivElement>(null)
  const curriculumWorksheetsSectionRef = useRef<HTMLDivElement>(null)
  const hasAutoRestoredCurriculumRef = useRef(false)
  const skipNextResultScrollRef = useRef(false)

  const formatCreatedAt = (iso: string) => {
    try {
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return ''
      const localeMap: Record<UiLocale, string> = { vi: 'vi-VN', en: 'en-GB', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR' }
      return d.toLocaleDateString(localeMap[uiLocale] ?? 'vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      })
    } catch {
      return ''
    }
  }

  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  const creditsWord = tr('credits', 'credits', '积分', 'クレジット', '크레딧')
  const creditLabel = (n: number) => ` (${formatCurriculumCredits(n)} ${creditsWord})`

  type CurriculumAnalyzeSlidesClientData = {
    slides?: unknown
    fromCache?: boolean
    creditsCharged?: boolean
    chargeError?: string
    error?: string
    balance?: number
    required?: number
  }

  const toastAnalyzeSlidesInsufficientCredits = (data: CurriculumAnalyzeSlidesClientData) => {
    const bal = typeof data.balance === 'number' ? data.balance : null
    const req = typeof data.required === 'number' ? data.required : null
    toast({
      title: tr('Không đủ credit', 'Insufficient credits', '积分不足', 'クレジット不足', '크레딧 부족'),
      description:
        bal !== null && req !== null
          ? tr(
              `Cần ${formatCurriculumCredits(req)} credit để tạo slide bằng AI; số dư hiện tại ${formatCurriculumCredits(bal)}.`,
              `You need ${formatCurriculumCredits(req)} credits to generate slides with AI; your balance is ${formatCurriculumCredits(bal)}.`,
              `使用 AI 生成幻灯片需要 ${formatCurriculumCredits(req)} 积分；当前余额 ${formatCurriculumCredits(bal)}。`,
              `AIでスライドを生成するには ${formatCurriculumCredits(req)} クレジットが必要です。現在の残高は ${formatCurriculumCredits(bal)} です。`,
              `AI로 슬라이드를 만들려면 ${formatCurriculumCredits(req)} 크레딧이 필요합니다. 현재 잔액은 ${formatCurriculumCredits(bal)}입니다.`
            )
          : tr(
              'Vui lòng nạp thêm credit để tạo slide bằng AI.',
              'Please top up credits to generate slides with AI.',
              '请充值积分以使用 AI 生成幻灯片。',
              'AIでスライドを作るにはクレジットを追加してください。',
              'AI로 슬라이드를 만들려면 크레딧을 충전해 주세요.'
            ),
      variant: 'destructive',
    })
  }

  const toastFromImageInsufficientCredits = (data: CurriculumAnalyzeSlidesClientData) => {
    const bal = typeof data.balance === 'number' ? data.balance : null
    const req = typeof data.required === 'number' ? data.required : null
    toast({
      title: tr('Không đủ credit', 'Insufficient credits', '积分不足', 'クレジット不足', '크레딧 부족'),
      description:
        bal !== null && req !== null
          ? tr(
              `Cần ${formatCurriculumCredits(req)} credit để tạo giáo trình từ ảnh (gồm slide khi có); số dư hiện tại ${formatCurriculumCredits(bal)}.`,
              `You need ${formatCurriculumCredits(req)} credits to create curriculum from images (slides included when available); your balance is ${formatCurriculumCredits(bal)}.`,
              `从图片创建课程（含幻灯片，如有）需要 ${formatCurriculumCredits(req)} 积分；当前余额 ${formatCurriculumCredits(bal)}。`,
              `画像からカリキュラム作成（スライド含む・ある場合）に ${formatCurriculumCredits(req)} クレジットが必要です。残高は ${formatCurriculumCredits(bal)} です。`,
              `이미지로 교육과정 생성(슬라이드 포함·있는 경우)에 ${formatCurriculumCredits(req)} 크레딧이 필요합니다. 잔액 ${formatCurriculumCredits(bal)}.`
            )
          : tr(
              'Vui lòng nạp thêm credit để tạo giáo trình từ ảnh.',
              'Please top up credits to create curriculum from images.',
              '请充值积分以从图片创建课程。',
              '画像からカリキュラムを作るにはクレジットを追加してください。',
              '이미지로 교육과정을 만들려면 크레딧을 충전해 주세요.'
            ),
      variant: 'destructive',
    })
  }

  const applyAnalyzeSlidesCreditSideEffects = (data: CurriculumAnalyzeSlidesClientData) => {
    if (data.creditsCharged && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('credits-updated'))
    }
    if (data.chargeError) {
      toast({
        title: tr('Slide đã tạo', 'Slides created', '幻灯片已生成', 'スライドを作成しました', '슬라이드 생성됨'),
        description: tr(
          'Hệ thống có thể chưa cập nhật số dư — vui lòng kiểm tra mục credit hoặc làm mới trang.',
          'Your balance may not have updated — refresh the page or check your credit balance.',
          '余额可能尚未更新——请刷新页面或查看积分。',
          '残高がまだ反映されていない場合があります。ページを更新するか残高を確認してください。',
          '잔액이 아직 반영되지 않았을 수 있습니다. 페이지를 새로 고치거나 잔액을 확인해 주세요.'
        ),
        variant: 'default',
        duration: 5000,
      })
    }
  }

  const examSessionCreatedAtTpl = useMemo(
    () => getDictionary(uiLocale as WebLocale).classes.examSessionCreatedAt,
    [uiLocale]
  )
  const tcClasses = useMemo(() => getDictionary(uiLocale as WebLocale).classes, [uiLocale])

  const displayTopic = topic.trim() || (lessonNumber ? `Bài ${lessonNumber}` : tr('Chủ đề', 'Topic', '主题', '主題', '주제'))

  const loadCreatedExamItems = async () => {
    setExamListLoading(true)
    try {
      const res = await fetch('/api/exam-session/mine?only=exam', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCreatedExamItems([])
        return
      }
      setCreatedExamItems(Array.isArray(data?.items) ? data.items : [])
    } catch {
      setCreatedExamItems([])
    } finally {
      setExamListLoading(false)
    }
  }

  const loadCreatedHomeworkItems = async () => {
    setHomeworkListLoading(true)
    try {
      const res = await fetch('/api/exam-session/mine?only=homework', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCreatedHomeworkItems([])
        return
      }
      setCreatedHomeworkItems(Array.isArray(data?.items) ? data.items : [])
    } catch {
      setCreatedHomeworkItems([])
    } finally {
      setHomeworkListLoading(false)
    }
  }

  const runDeleteCreatedExam = async (code: string) => {
    setExamDeletingCode(code)
    try {
      const res = await fetch('/api/exam-session/mine', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
          description: String(data?.error ?? res.statusText),
          variant: 'destructive',
        })
        return
      }
      toast({
        title: tr('Đã xóa', 'Deleted', '已删除', '削除完了', '삭제됨'),
        description: tr('Đã xóa bài thi.', 'Exam deleted.', '测验已删除。', 'テストを削除しました。', '시험을 삭제했습니다.'),
      })
      setCreatedExamDeleteTarget(null)
      setCreatedExamDeleteConfirmInput('')
      void loadCreatedExamItems()
    } catch (e) {
      toast({
        title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      })
    } finally {
      setExamDeletingCode(null)
    }
  }

  const handleOpenExamPreview = async (
    exam: { code: string; title: string; examUrl: string },
    forHomework?: boolean
  ) => {
    setExamPreview({
      code: exam.code,
      title: exam.title,
      examUrl: exam.examUrl,
      qrDataUrl: null,
      loadingQr: true,
      forHomework: Boolean(forHomework),
    })
    try {
      const qr = await QRCode.toDataURL(exam.examUrl, { width: 220, margin: 2 })
      setExamPreview({
        code: exam.code,
        title: exam.title,
        examUrl: exam.examUrl,
        qrDataUrl: qr,
        loadingQr: false,
        forHomework: Boolean(forHomework),
      })
    } catch {
      setExamPreview((prev) => (prev ? { ...prev, loadingQr: false } : prev))
    }
  }

  useEffect(() => {
    const syncLocale = () => setUiLocale(getWebLocaleFromCookie())
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (featureSection !== 'exam') return
    void loadCreatedExamItems()
  }, [featureSection])

  useEffect(() => {
    if (featureSection !== 'homework') return
    void loadCreatedHomeworkItems()
  }, [featureSection])

  const handleDeleteCreatedHomework = async (code: string) => {
    const ok = typeof window !== 'undefined'
      ? window.confirm(
          tr(
            'Xóa bài tập về nhà này? Hành động này không thể hoàn tác.',
            'Delete this homework? This action cannot be undone.',
            '确定删除该家庭作业吗？此操作不可撤销。',
            'この宿題を削除しますか？この操作は取り消せません。',
            '이 숙제를 삭제할까요? 이 작업은 되돌릴 수 없습니다.'
          )
        )
      : true
    if (!ok) return
    setHomeworkDeletingCode(code)
    try {
      const res = await fetch('/api/exam-session/mine', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
          description: String(data?.error ?? res.statusText),
          variant: 'destructive',
        })
        return
      }
      toast({
        title: tr('Đã xóa', 'Deleted', '已删除', '削除完了', '삭제됨'),
        description: tr('Đã xóa bài tập về nhà.', 'Homework deleted.', '已删除家庭作业。', '宿題を削除しました。', '숙제를 삭제했습니다.'),
      })
      void loadCreatedHomeworkItems()
    } catch (e) {
      toast({
        title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      })
    } finally {
      setHomeworkDeletingCode(null)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const previousRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    const timeoutId = window.setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }, 0)
    return () => {
      window.clearTimeout(timeoutId)
      window.history.scrollRestoration = previousRestoration
    }
  }, [])

  useEffect(() => {
    if (step === 'GENERATING' || step === 'RESULT') {
      if (skipNextResultScrollRef.current) {
        skipNextResultScrollRef.current = false
        return
      }
      pageHeaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [step])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (curriculumId) {
      localStorage.setItem(LAST_OPENED_CURRICULUM_KEY, curriculumId)
      return
    }
    localStorage.removeItem(LAST_OPENED_CURRICULUM_KEY)
  }, [curriculumId])

  // Poll refetch worksheet sau khi verify-background chạy – để hiện tag [Đã verify]
  useEffect(() => {
    if (!worksheetId || worksheetVerifyPollUntil <= Date.now()) return
    const deadline = worksheetVerifyPollUntil
    let intervalId: ReturnType<typeof setInterval> | null = null
    const doFetch = async () => {
      if (Date.now() >= deadline) {
        setWorksheetVerifyPollUntil(0)
        if (intervalId) clearInterval(intervalId)
        return
      }
      try {
        const res = await fetch(`/api/worksheet/${encodeURIComponent(worksheetId)}`)
        const data = await res.json().catch(() => ({}))
        if (data?.content_markdown) {
          setWorksheetMarkdown(data.content_markdown)
          setCurriculumWorksheets((prev) =>
            prev.some((w) => w.id === worksheetId)
              ? prev.map((w) => (w.id === worksheetId ? { ...w, content_markdown: '' } : w))
              : prev
          )
        }
      } catch {}
    }
    const timeoutId = setTimeout(() => {
      void doFetch()
      intervalId = setInterval(doFetch, 5000)
    }, 2000)
    return () => {
      clearTimeout(timeoutId)
      if (intervalId) clearInterval(intervalId)
    }
  }, [worksheetId, worksheetVerifyPollUntil])

  useEffect(() => {
    if (!wsStepByStepExpanded || !curriculumId) {
      setWsStepByStepCounts(null)
      return
    }
    fetch(`/api/worksheet-question-counts?curriculumId=${encodeURIComponent(curriculumId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.quiz && data.essay) setWsStepByStepCounts({ quiz: data.quiz, essay: data.essay })
        else setWsStepByStepCounts(null)
      })
      .catch(() => setWsStepByStepCounts(null))
  }, [wsStepByStepExpanded, curriculumId])

  useEffect(() => {
    const quizTotal: Record<string, number> = { easy: 0, medium: 0, hard: 0 }
    const essayTotal: Record<string, number> = { 'nhan-biet': 0, 'thong-hieu': 0, 'van-dung-thap': 0, 'van-dung-cao': 0, 'thuc-te': 0 }
    for (const d of ['easy', 'medium', 'hard']) quizTotal[d] = (wsStepByStepCounts?.quiz?.[d] ?? 0) + (wsStepByStepSessionCounts.quiz?.[d] ?? 0)
    for (const d of ['nhan-biet', 'thong-hieu', 'van-dung-thap', 'van-dung-cao', 'thuc-te']) essayTotal[d] = (wsStepByStepCounts?.essay?.[d] ?? 0) + (wsStepByStepSessionCounts.essay?.[d] ?? 0)
    const quizAvailable = (['easy', 'medium', 'hard'] as const).filter((d) => quizTotal[d] < 10)
    const essayAvailable = (['nhan-biet', 'thong-hieu', 'van-dung-thap', 'van-dung-cao', 'thuc-te'] as const).filter((d) => essayTotal[d] < 6)
    if (quizAvailable.length > 0 && !quizAvailable.includes(wsStepByStepQuizDiff)) setWsStepByStepQuizDiff(quizAvailable[0])
    if (essayAvailable.length > 0 && !essayAvailable.includes(wsStepByStepEssayBloom)) setWsStepByStepEssayBloom(essayAvailable[0])
    const quizMax = Math.min(20, 10 - (quizTotal[wsStepByStepQuizDiff] ?? 0))
    const essayMax = Math.min(10, 6 - (essayTotal[wsStepByStepEssayBloom] ?? 0))
    if (wsStepByStepQuizCount > quizMax && quizMax >= 0) setWsStepByStepQuizCount(quizMax)
    if (wsStepByStepEssayCount > essayMax && essayMax >= 0) setWsStepByStepEssayCount(essayMax)
  }, [wsStepByStepCounts, wsStepByStepSessionCounts, wsStepByStepQuizDiff, wsStepByStepEssayBloom])

  useEffect(() => {
    if (!showBrowse) return
    setBrowseLoading(true)
    listCurricula({
      subjectId: browseSubjectFilter || undefined,
      gradeLevelId: browseGradeFilter || undefined,
      limit: 200,
    })
      .then((curRes) => {
        if (curRes && 'items' in curRes) setCurriculaList(curRes.items ?? [])
        else setCurriculaList([])
      })
      .catch(() => setCurriculaList([]))
      .finally(() => setBrowseLoading(false))
  }, [showBrowse, browseSubjectFilter, browseGradeFilter])

  useEffect(() => {
    if (createMode === 'topic' && (!topic.trim() || topic.trim().length < 2)) {
      setCurriculumExists(null)
      setExistingCurriculumId(null)
      setExistingCurriculumTopic(null)
      setSimilarTopicCurricula([])
      setCheckLoading(false)
      return
    }
    const num = parseInt(lessonNumber, 10)
    if (createMode !== 'topic' && (!num || num < 1 || num > 999)) {
      setCurriculumExists(null)
      setExistingCurriculumId(null)
      setExistingCurriculumTopic(null)
      setSimilarTopicCurricula([])
      return
    }
    if (textbookSetId === 'khac' && !bookIsbn.trim()) {
      setCurriculumExists(false)
      setExistingCurriculumId(null)
      setExistingCurriculumTopic(null)
      setCheckLoading(false)
      return
    }
    let cancelled = false
    setCheckLoading(true)
    checkCurriculumExists({
      createMode,
      topic: createMode === 'topic' ? topic.trim() : undefined,
      subjectId,
      gradeLevelId,
      textbookSetId,
      textbookVolume: textbookVolume.trim() || undefined,
      bookIsbn: textbookSetId === 'khac' ? bookIsbn.trim() : undefined,
      lessonNumber: createMode === 'topic' ? undefined : num,
      numLessons,
      lessonDurationMinutes,
      lessonTypeId,
    })
      .then((res) => {
        if (cancelled) return
        if (res && 'exists' in res && res.exists) {
          setCurriculumExists(true)
          setExistingCurriculumId(res.curriculumId ?? null)
          setExistingCurriculumTopic(res.topic ?? null)
        } else {
          setCurriculumExists(false)
          setExistingCurriculumId(null)
          setExistingCurriculumTopic(null)
        }
        if (res && 'similarItems' in res && Array.isArray(res.similarItems)) {
          setSimilarTopicCurricula(res.similarItems as Array<{ id: string; topic: string; score: number }>)
        } else {
          setSimilarTopicCurricula([])
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Không khóa nút tạo nếu check tồn tại lỗi mạng/tạm thời.
          setCurriculumExists(false)
          setExistingCurriculumId(null)
          setExistingCurriculumTopic(null)
          setSimilarTopicCurricula([])
        }
      })
      .finally(() => {
        if (!cancelled) setCheckLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [createMode, topic, subjectId, gradeLevelId, textbookSetId, textbookVolume, bookIsbn, lessonNumber, numLessons, lessonDurationMinutes, lessonTypeId])

  const handleSubmitFromImage = async (opts?: { forceOverwrite?: boolean }) => {
    const forceOverwrite = !!opts?.forceOverwrite
    const num = parseInt(lessonNumber, 10)
    if (!num || num < 1 || num > 999 || lessonImages.length === 0) return
    setStep('GENERATING')
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    try {
      const fd = new FormData()
      for (const img of lessonImages) fd.append('images', img)
      fd.append('subjectId', subjectId)
      fd.append('gradeLevelId', gradeLevelId)
      fd.append('textbookSetId', textbookSetId)
      fd.append('lessonNumber', lessonNumber)
      fd.append('numLessons', String(numLessons))
      fd.append('lessonDurationMinutes', String(lessonDurationMinutes))
      const res = await fetch('/api/curriculum-from-image', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStep('INPUT')
        if (res.status === 402) {
          toastFromImageInsufficientCredits(data as CurriculumAnalyzeSlidesClientData)
          return
        }
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: data?.error || res.statusText, variant: 'destructive' })
        return
      }
      applyAnalyzeSlidesCreditSideEffects(data as CurriculumAnalyzeSlidesClientData)
      const {
        curriculumMarkdown: md,
        lessonOutline,
        topic: t,
        lessonNumber: extractedNum,
        lessonTitle: extractedTitle,
      } = data
      if (!md) {
        setStep('INPUT')
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('AI không trả về nội dung.', 'AI did not return content.', 'AI未返回内容。', 'AIがコンテンツを返しませんでした。', 'AI가 내용을 반환하지 않았습니다.'), variant: 'destructive' })
        return
      }
      const extractedNumParsed =
        typeof extractedNum === 'number'
          ? extractedNum
          : typeof extractedNum === 'string'
            ? parseInt(extractedNum, 10)
            : NaN
      const hasExtractedLessonNum = Number.isFinite(extractedNumParsed) && extractedNumParsed >= 1 && extractedNumParsed <= 999
      const extractedLessonNum = hasExtractedLessonNum ? String(extractedNumParsed) : null
      if (extractedLessonNum && extractedLessonNum !== lessonNumber.trim()) {
        setStep('INPUT')
        const mismatchMessage = tr(
          `Ảnh là Bài ${extractedLessonNum} nhưng bạn nhập Bài ${lessonNumber}. Vui lòng sửa lại số bài đã nhập hoặc upload ảnh đúng với số bài đã nhập.`,
          `Image shows lesson ${extractedLessonNum} but you entered lesson ${lessonNumber}. Please correct the entered lesson number or upload the correct image for your entered lesson number.`,
          `图片显示第 ${extractedLessonNum} 课，但您输入的是第 ${lessonNumber} 课。请修改输入课号或上传与输入课号一致的图片。`,
          `画像は${extractedLessonNum}課ですが、入力は${lessonNumber}課です。入力した課番号を修正するか、入力番号に合う画像をアップロードしてください。`,
          `이미지는 ${extractedLessonNum}차시인데 입력은 ${lessonNumber}차시입니다. 입력한 차시 번호를 수정하거나 입력 번호와 일치하는 이미지를 업로드해 주세요.`
        )
        setLessonImages([])
        if (lessonImageInputRef.current) lessonImageInputRef.current.value = ''
        window.alert(mismatchMessage)
        return
      }
      const finalLessonNum = extractedLessonNum ?? lessonNumber
      const finalTopic = t || extractedTitle || `Bài ${finalLessonNum}`

      let overwriteCurriculumId: string | null = null
      const checkByExtracted = await checkCurriculumExists({
        createMode: 'textbook',
        subjectId,
        gradeLevelId,
        textbookSetId,
        textbookVolume: textbookVolume.trim() || undefined,
        bookIsbn: textbookSetId === 'khac' ? bookIsbn.trim() : undefined,
        lessonNumber: parseInt(finalLessonNum, 10),
        numLessons,
        lessonDurationMinutes,
        lessonTypeId,
      })
      const existingIdByExtracted =
        checkByExtracted && 'exists' in checkByExtracted && checkByExtracted.exists
          ? (checkByExtracted.curriculumId ?? null)
          : null
      const existingTopicByExtracted =
        checkByExtracted && 'exists' in checkByExtracted && checkByExtracted.exists
          ? (checkByExtracted.topic ?? null)
          : null
      const existingMarkdownByExtracted =
        checkByExtracted && 'exists' in checkByExtracted && checkByExtracted.exists
          ? (checkByExtracted.curriculumMarkdown ?? '')
          : ''

      if (forceOverwrite && existingIdByExtracted) {
        const normalizeForCompare = (s: string) =>
          String(s || '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim()
        if (normalizeForCompare(existingMarkdownByExtracted) === normalizeForCompare(md)) {
          const sameOk = confirm(
            tr(
              'Nội dung mới gần như trùng bản hiện tại. Bạn vẫn muốn ghi đè không?',
              'New content is almost identical to current version. Do you still want to overwrite?',
              '新内容与当前版本几乎一致。仍要覆盖吗？',
              '新しい内容は現行版とほぼ同一です。上書きしますか？',
              '새 내용이 현재 버전과 거의 동일합니다. 그래도 덮어쓸까요?'
            )
          )
          if (!sameOk) {
            setStep('INPUT')
            return
          }
        }
        const ok = confirm(
          tr(
            'Tạo lại sẽ xóa worksheet/slide/lịch sử chỉnh sửa cũ của giáo trình này trước khi lưu bản mới. Tiếp tục?',
            'Recreate will delete old worksheets/slides/edit history of this curriculum before saving new content. Continue?',
            '重新创建会先删除该课程旧的练习/幻灯片/编辑历史，再保存新内容。继续吗？',
            '再作成すると、このカリキュラムの旧ワークシート/スライド/編集履歴を削除してから新規保存します。続行しますか？',
            '다시 만들기를 진행하면 기존 워크시트/슬라이드/편집 기록을 삭제한 뒤 새 내용으로 저장합니다. 계속할까요?'
          )
        )
        if (!ok) {
          setStep('INPUT')
          return
        }
        const clearRes = await clearCurriculumDerivedData(existingIdByExtracted)
        if (clearRes?.error) {
          setStep('INPUT')
          toast({ title: tr('Xóa dữ liệu cũ thất bại', 'Failed to clear old data', '清除旧数据失败', '旧データ削除に失敗', '기존 데이터 삭제 실패'), description: clearRes.error, variant: 'destructive' })
          return
        }
        overwriteCurriculumId = existingIdByExtracted
      }

      setCurriculumMarkdown(md)
      setTopic(finalTopic)
      const saveFd = new FormData()
      saveFd.append('curriculumMarkdown', md)
      saveFd.append('topic', finalTopic)
      if (overwriteCurriculumId) saveFd.append('curriculumId', overwriteCurriculumId)
      saveFd.append('subjectId', subjectId)
      saveFd.append('gradeLevelId', gradeLevelId)
      saveFd.append('textbookSetId', textbookSetId)
      saveFd.append('textbookVolume', textbookVolume.trim())
      saveFd.append('lessonNumber', finalLessonNum)
      saveFd.append('lessonTypeId', lessonTypeId)
      saveFd.append('numLessons', String(numLessons))
      saveFd.append('lessonDurationMinutes', String(lessonDurationMinutes))
      saveFd.append('goals', goals)
      saveFd.append('bookIsbn', textbookSetId === 'khac' ? bookIsbn.trim() : '')
      if (Array.isArray(lessonOutline) && lessonOutline.length > 0) {
        saveFd.append('lessonOutlineJson', JSON.stringify({ lessons: lessonOutline }))
      }
      const saveRes = await saveCurriculum(saveFd)
      if (saveRes?.success && saveRes.curriculumId) {
        setCurriculumId(saveRes.curriculumId)
        setStep('RESULT')
        if (overwriteCurriculumId) setLastOverwriteAt(new Date().toISOString())
        toast({
          title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'),
          description: overwriteCurriculumId
            ? tr('Đã tạo lại và ghi đè giáo trình cũ theo dữ liệu từ ảnh.', 'Recreated and overwritten existing curriculum using image data.', '已根据图片数据重建并覆盖旧课程。', '画像データに基づき既存カリキュラムを再作成・上書きしました。', '이미지 데이터를 기준으로 기존 교육과정을 다시 만들고 덮어썼습니다.')
            : existingIdByExtracted
              ? tr(`Đã tạo mới theo Bài ${finalLessonNum}. Nếu muốn dùng bản có sẵn "${existingTopicByExtracted ?? ''}" hãy bấm Mở giáo trình có sẵn.`, `Created a new curriculum for lesson ${finalLessonNum}. To use existing "${existingTopicByExtracted ?? ''}", open existing curriculum.`, `已按第 ${finalLessonNum} 课新建。若要使用已有课程“${existingTopicByExtracted ?? ''}”，请点击“打开已有课程”。`, `${finalLessonNum}課として新規作成しました。既存「${existingTopicByExtracted ?? ''}」を使う場合は既存を開いてください。`, `${finalLessonNum}차시 기준으로 새로 생성했습니다. 기존 "${existingTopicByExtracted ?? ''}"를 사용하려면 기존 교육과정을 여세요.`)
              : tr('Giáo trình và giáo án đã tạo từ ảnh.', 'Curriculum and slides created from image.', '已从图片创建课程和教案。', '画像からカリキュラムとスライドを作成しました。', '이미지에서 교육과정과 슬라이드 생성됨.'),
          duration: 3800,
        })
        await saveTextbookLessonFromImage({ subjectId, gradeLevelId, textbookSetId, lessonNumber: parseInt(finalLessonNum, 10), lessonTitle: finalTopic })
        // Không tạo slide ở bước tạo giáo trình.
        // Slide sẽ được tạo theo từng tiết khi giáo viên chọn tiết để mở.
        setCurriculumSlides(null)
      } else {
        setCurriculumId(null)
        setStep('RESULT')
        toast({ title: tr('Giáo trình đã tạo', 'Curriculum created', '课程已创建', 'カリキュラム作成', '교육과정 생성'), description: saveRes?.error || tr('Chưa lưu vào kho.', 'Not saved to library.', '未保存到库。', 'ライブラリに未保存。', '라이브러리에 미저장.'), variant: 'default' })
      }
    } catch (e) {
      setStep('INPUT')
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: e instanceof Error ? e.message : String(e), variant: 'destructive' })
    }
  }

  const handleSubmit = async () => {
    if (createMode === 'topic') {
      if (!topic.trim() || topic.trim().length < 2) {
        toast({
          title: tr('Thiếu thông tin', 'Missing information', '缺少信息', '情報不足', '정보 누락'),
          description: tr('Vui lòng nhập chủ đề (ít nhất 2 ký tự).', 'Please enter topic (at least 2 characters).', '请输入主题（至少2个字符）。', '主題を入力してください（2文字以上）。', '주제를 입력해 주세요 (최소 2자).'),
          variant: 'destructive',
        })
        return
      }
      setStep('GENERATING')
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const formData = new FormData()
      formData.append('createMode', 'topic')
      formData.append('subjectId', subjectId)
      formData.append('gradeLevelId', gradeLevelId)
      formData.append('textbookSetId', 'khac')
      formData.append('textbookVolume', '')
      formData.append('topic', topic.trim())
      formData.append('lessonTypeId', lessonTypeId)
      formData.append('numLessons', String(numLessons))
      formData.append('lessonDurationMinutes', String(lessonDurationMinutes))
      formData.append('goals', goals.trim())
      formData.append('bookIsbn', '')
      const result = await createCurriculum(formData)
      if (result.error) {
        setStep('INPUT')
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error, variant: 'destructive', duration: 5000 })
        return
      }
      if (result.success && result.curriculumMarkdown) {
        setCurriculumMarkdown(result.curriculumMarkdown)
        setCurriculumId(result.curriculumId ?? null)
        setCurriculumSlides(null)
        setStep('RESULT')
        toast({ title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'), description: tr('Giáo trình đã được tạo.', 'Curriculum created.', '课程已创建并保存。', 'カリキュラムを作成しました。', '교육과정 생성됨.'), duration: 3000 })
      }
      return
    }

    const num = parseInt(lessonNumber, 10)
    if (!num || num < 1 || num > 999) {
      toast({
        title: tr('Thiếu thông tin', 'Missing information', '缺少信息', '情報不足', '정보 누락'),
        description: tr('Vui lòng nhập bài số (1–999).', 'Please enter lesson number (1–999).', '请输入课号（1–999）。', '課番号（1–999）を入力してください。', '차시 번호(1–999)를 입력해 주세요.'),
        variant: 'destructive',
      })
      return
    }
    if (createMode === 'textbook') {
      if (textbookSetId === 'khac' && !bookIsbn.trim()) {
        toast({
          title: tr('Thiếu thông tin', 'Missing information', '缺少信息', '情報不足', '정보 누락'),
          description: tr('Vui lòng nhập ISBN cho sách Khác / Sách khác NXB.', 'Please enter ISBN for Other publisher textbook.', '请选择“其他出版社”时请输入ISBN。', '「その他出版社」の場合はISBNを入力してください。', '기타 출판사 선택 시 ISBN을 입력해 주세요.'),
          variant: 'destructive',
        })
        return
      }
      if (lessonImages.length === 0) {
        toast({
          title: tr('Cần gửi ảnh bài học', 'Upload lesson image required', '需要上传课程图片', '授業画像のアップロードが必要', '수업 이미지 업로드 필요'),
          description: tr('Vui lòng gửi ảnh trang sách để tạo giáo trình.', 'Please upload a textbook page image to create curriculum.', '请上传教材页面图片以创建课程。', '教科書のページ画像をアップロードしてください。', '교과서 페이지 이미지를 업로드해 주세요.'),
          variant: 'destructive',
        })
        return
      }
      await handleSubmitFromImage()
      return
    }
  }

  const handleOverwriteFromExisting = async () => {
    if (!existingCurriculumId) return
    if (lessonImages.length === 0) {
      toast({
        title: tr('Cần gửi ảnh bài học', 'Upload lesson image required', '需要上传课程图片', '授業画像のアップロードが必要', '수업 이미지 업로드 필요'),
        description: tr('Vui lòng gửi ảnh trang sách rồi bấm Tạo lại giáo trình.', 'Please upload textbook page image(s) before recreating curriculum.', '请先上传教材页面图片，再重建课程。', '教科書ページ画像をアップロードしてから再作成してください。', '교과서 페이지 이미지를 업로드한 뒤 다시 만들기를 진행해 주세요.'),
        variant: 'destructive',
      })
      return
    }
    setOverwriteFromExistingLoading(true)
    try {
      await handleSubmitFromImage({ forceOverwrite: true })
    } finally {
      setOverwriteFromExistingLoading(false)
    }
  }

  const handleOpenExistingCurriculum = async () => {
    setOpenExistingLoading(true)
    try {
      let targetId = existingCurriculumId
      if (!targetId) {
        const num = parseInt(lessonNumber, 10)
        if (!num || num < 1 || num > 999) {
          toast({
            title: tr('Thiếu thông tin', 'Missing information', '缺少信息', '情報不足', '정보 누락'),
            description: tr('Vui lòng nhập bài số hợp lệ để mở giáo trình có sẵn.', 'Please enter a valid lesson number to open existing curriculum.', '请输入有效课号后再打开已有课程。', '既存カリキュラムを開くには有効な課番号を入力してください。', '기존 교육과정을 열려면 올바른 차시 번호를 입력해 주세요.'),
            variant: 'destructive',
          })
          return
        }
        const found = await checkCurriculumExists({
          createMode: 'textbook',
          subjectId,
          gradeLevelId,
          textbookSetId,
          textbookVolume: textbookVolume.trim() || undefined,
          bookIsbn: textbookSetId === 'khac' ? bookIsbn.trim() : undefined,
          lessonNumber: num,
          numLessons,
          lessonDurationMinutes,
          lessonTypeId,
        })
        if (found && 'exists' in found && found.exists && found.curriculumId) {
          targetId = found.curriculumId
          setExistingCurriculumId(found.curriculumId)
          setExistingCurriculumTopic(found.topic ?? null)
        }
      }
      if (!targetId) {
        toast({
          title: tr('Không tìm thấy', 'Not found', '未找到', '見つかりません', '찾을 수 없음'),
          description: tr('Chưa tìm thấy giáo trình có sẵn phù hợp.', 'No matching existing curriculum found.', '未找到匹配的已有课程。', '一致する既存カリキュラムが見つかりません。', '일치하는 기존 교육과정을 찾지 못했습니다.'),
          variant: 'destructive',
        })
        return
      }
      await handleLoadCurriculum(targetId)
      requestAnimationFrame(() => {
        pageHeaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } finally {
      setOpenExistingLoading(false)
    }
  }

  const handleRemoveLessonImage = (index: number) => {
    setLessonImages((prev) => {
      const next = prev.filter((_, i) => i !== index)
      if (next.length <= 0 && lessonImageInputRef.current) lessonImageInputRef.current.value = ''
      return next
    })
  }

  const handleClearLessonImages = () => {
    setLessonImages([])
    if (lessonImageInputRef.current) lessonImageInputRef.current.value = ''
  }

  const resetWorksheetEditState = () => {
    setWorksheetEditBlockIndex(null)
    setWorksheetEditBlockContent('')
    setWorksheetEditSaving(false)
    setWorksheetEditCheckResult(null)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(curriculumMarkdown)
    toast({ title: tr('Đã sao chép', 'Copied', '已复制', 'コピーしました', '복사됨'), duration: 2000 })
  }

  const handleDownload = () => {
    const blob = new Blob([curriculumMarkdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `giao-trinh-${displayTopic.slice(0, 30).replace(/\s+/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: tr('Đã tải xuống', 'Downloaded', '已下载', 'ダウンロードしました', '다운로드됨'), duration: 2000 })
  }

  const openGiaoVienWindow = useCallback(
    (
      slidesToUse: AISlideData[] | null,
      mode: SlideVersionChoice | null = null,
      curriculumInfographicSend?: SlideInfographic | undefined,
      lessonMarkdownOverride?: string | null
    ) => {
      if (curriculumId && !versionChooseArmedRef.current) {
        console.warn('[lesson-open] blocked open before choosing version', { curriculumId, mode })
        setShowSlideVersionDialog(true)
        return
      }
      const slides =
        slidesToUse && slidesToUse.length > 0
          ? slidesToUse.map((s) => ({
              title: s.title,
              blocks: s.blocks ?? [],
              teacherNotes: (s as { teacherNotes?: string }).teacherNotes ?? '',
              imageUrl: s.imageUrl,
              visualEmbed: s.visualEmbed,
              visualLayout: s.visualLayout,
              visualCells: s.visualCells,
              visualInput1: (s as { visualInput1?: string }).visualInput1,
              visualInput2: (s as { visualInput2?: string }).visualInput2,
              visualInput3: (s as { visualInput3?: string }).visualInput3,
              visualInput4: (s as { visualInput4?: string }).visualInput4,
            }))
          : []
      if (!slides || slides.length <= 0) {
        toast({
          title: tr('Chưa có slide theo tiết', 'No lesson slides yet', '尚无课时幻灯片', '授業スライドがまだありません', '차시 슬라이드가 아직 없습니다'),
          description: tr(
            'Vui lòng chọn tiết để tạo/mở slide của riêng tiết đó.',
            'Please choose a lesson to create/open slides for that lesson only.',
            '请选择课时，仅生成/打开该课时幻灯片。',
            '授業を選択して、その授業のスライドのみ作成/表示してください。',
            '차시를 선택해 해당 차시 슬라이드만 생성/열어 주세요.'
          ),
          variant: 'destructive',
        })
        return
      }
      activeOpenedSlidesRef.current = slides
      activeOpenedLessonMarkdownRef.current = typeof lessonMarkdownOverride === 'string' && lessonMarkdownOverride.trim()
        ? lessonMarkdownOverride.trim()
        : curriculumMarkdown
      const resolvedInfographic =
        curriculumInfographicSend ??
        (mode === 'personal'
          ? infographicPersonal
          : mode === 'original'
            ? infographicOriginal
            : mode === 'shared'
              ? infographicShared
              : infographicShared ?? infographicOriginal ?? infographicPersonal)
      const sw = typeof screen !== 'undefined' ? screen.width : 1920
      const sh = typeof screen !== 'undefined' ? screen.height : 1080
      const w = window.open(
        '/giao-trinh/giao-vien?t=' + Date.now(),
        'giao-vien-' + Date.now(),
        `width=${sw},height=${sh},scrollbars=yes,left=0,top=0`
      )
      if (w) {
        const send = () => {
          try {
            if (!w.closed) {
              w.postMessage(
                {
                  type: 'curriculum-data',
                  content: activeOpenedLessonMarkdownRef.current ?? curriculumMarkdown,
                  fullCurriculumMarkdown: curriculumMarkdown,
                  topic: displayTopic,
                  currentIndex: 0,
                  curriculumId: curriculumId ?? null,
                  slideMode: mode === 'personal' ? 'personal' : mode === 'shared' ? 'shared' : mode === 'original' ? 'original' : null,
                  personalViewSubMode: 'current',
                  hasOriginalSlides: hasOriginalOrSharedVersion,
                  slides,
                  teacherTimerSeconds: 0,
                  teacherTimerRunning: false,
                  ...(resolvedInfographic ? { curriculumInfographic: resolvedInfographic } : {}),
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
      }
    },
    [curriculumMarkdown, displayTopic, curriculumId, hasOriginalOrSharedVersion, infographicShared, infographicOriginal, infographicPersonal, toast, tr]
  )

  const clearSlideVersionCaches = useCallback(() => {
    // Giải phóng các mảng version lớn khi không còn cần cho popup chọn phiên bản.
    setSharedSlides(null)
    setOriginalSlides(null)
    setPersonalSlides(null)
  }, [])

  const clearLessonTransientCaches = useCallback((dropLessonMeta = false) => {
    pendingLessonOpenRef.current = null
    setLessonGroups([])
    if (dropLessonMeta) {
      setLessonMetaByMode({})
      setLessonTotalSlidesByMode({})
    }
  }, [])

  const cancelScheduledLessonTrim = useCallback(() => {
    if (typeof window === 'undefined') return
    if (lessonTrimTimeoutRef.current != null) {
      window.clearTimeout(lessonTrimTimeoutRef.current)
      lessonTrimTimeoutRef.current = null
    }
    if (lessonTrimIdleRef.current != null) {
      const w = window as Window & { cancelIdleCallback?: (id: number) => void }
      if (typeof w.cancelIdleCallback === 'function') {
        w.cancelIdleCallback(lessonTrimIdleRef.current)
      }
      lessonTrimIdleRef.current = null
    }
  }, [])

  const scheduleLessonIdleTrim = useCallback(() => {
    if (typeof window === 'undefined') return
    cancelScheduledLessonTrim()
    lessonTrimTimeoutRef.current = window.setTimeout(() => {
      lessonTrimTimeoutRef.current = null
      const runTrim = () => {
        clearLessonTransientCaches(true)
        clearSlideVersionCaches()
      }
      const w = window as Window & { requestIdleCallback?: (cb: IdleRequestCallback) => number }
      if (typeof w.requestIdleCallback === 'function') {
        lessonTrimIdleRef.current = w.requestIdleCallback(() => {
          lessonTrimIdleRef.current = null
          runTrim()
        })
      } else {
        runTrim()
      }
    }, 1200)
  }, [cancelScheduledLessonTrim, clearLessonTransientCaches, clearSlideVersionCaches])

  useEffect(() => {
    return () => {
      cancelScheduledLessonTrim()
    }
  }, [cancelScheduledLessonTrim])

  const handleSlideVersionDialogOpenChange = useCallback((open: boolean) => {
    setShowSlideVersionDialog(open)
    if (!open) clearSlideVersionCaches()
  }, [clearSlideVersionCaches])

  const handleLessonSelectOpenChange = useCallback((open: boolean) => {
    setLessonSelectOpen(open)
    if (!open) {
      setLessonPreparingGroupId(null)
      setLessonPreparingLessonNo(null)
      clearLessonTransientCaches(false)
      clearSlideVersionCaches()
    }
  }, [clearLessonTransientCaches, clearSlideVersionCaches])

  const handleLessonChoose = useCallback(async (groupId: string) => {
    if (lessonPreparingGroupId) return
    const pending = pendingLessonOpenRef.current
    if (!pending) {
      handleLessonSelectOpenChange(false)
      return
    }
    const group = lessonGroups.find((g) => g.id === groupId)
    if (!group || group.indices.length === 0) {
      handleLessonSelectOpenChange(false)
      return
    }
    setLessonPreparingGroupId(groupId)
    setLessonPreparingLessonNo(group.lessonNo)
    if (pending.curriculumId) {
      setSlideAnalysisLoading(true)
      try {
        const ensurePrepared = await ensureCurriculumLessonSlidesPreparedAction(
          pending.curriculumId,
          group.lessonNo
        )
        if (!ensurePrepared || !('success' in ensurePrepared) || !ensurePrepared.success) {
          toast({
            title: tr('Không chuẩn bị được slide tiết đã chọn', 'Cannot prepare selected lesson slides', '无法准备所选课时幻灯片', '選択した授業スライドを準備できません', '선택한 차시 슬라이드를 준비할 수 없습니다'),
            description: 'error' in (ensurePrepared ?? {}) ? String((ensurePrepared as { error?: unknown }).error ?? '') : undefined,
            variant: 'destructive',
          })
          handleLessonSelectOpenChange(false)
          return
        }
        setHasOriginalOrSharedVersion(true)
        const sharedMeta = await getCurriculumLessonMetaAction(pending.curriculumId, 'shared')
        const personalMeta = await getCurriculumLessonMetaAction(pending.curriculumId, 'personal')
        if (sharedMeta?.success) setInfographicShared(sharedMeta.curriculumInfographic)
        if (personalMeta?.success) setInfographicPersonal(personalMeta.curriculumInfographic)
        selectedLessonNoRef.current = group.lessonNo
        setLessonSelectOpen(false)
        // Đóng popup chọn tiết trước, rồi mở popup chọn bản ở tick kế tiếp
        // để tránh trường hợp Radix Dialog nuốt lần mở kế tiếp.
        window.setTimeout(() => {
          setShowSlideVersionDialog(true)
        }, 0)
        scheduleLessonIdleTrim()
        return
      } finally {
        setSlideAnalysisLoading(false)
        setLessonPreparingGroupId(null)
        setLessonPreparingLessonNo(null)
      }
    }
    if (!pending.slides || pending.slides.length === 0) {
        handleLessonSelectOpenChange(false)
      return
    }
    try {
      const selectedSlides = group.indices
        .map((idx) => pending.slides?.[idx] ?? null)
        .filter((s): s is AISlideData => !!s)
      setAiSlides(selectedSlides.length > 0 ? selectedSlides : null)
      openGiaoVienWindow(selectedSlides, pending.mode, pending.infographic)
      setLessonSelectOpen(false)
      scheduleLessonIdleTrim()
    } finally {
      setLessonPreparingGroupId(null)
      setLessonPreparingLessonNo(null)
    }
  }, [lessonGroups, openGiaoVienWindow, handleLessonSelectOpenChange, lessonPreparingGroupId, scheduleLessonIdleTrim, toast, tr])

  const refreshPersonalSlides = useCallback(async () => {
    if (!curriculumId) return
    const res = await getCurriculumLessonMetaAction(curriculumId, 'personal')
    if (res?.success && ((res.totalSlides ?? 0) > 0 || (res.lessonCount ?? 0) > 0)) {
      setHasPersonalVersion(true)
      setInfographicPersonal(res.curriculumInfographic)
      setLessonMetaByMode((prev) => ({ ...prev, personal: lessonChunksToGroups(res.lessons) }))
      setLessonTotalSlidesByMode((prev) => ({ ...prev, personal: Math.max(0, Number(res.totalSlides) || 0) }))
      return
    }
    setHasPersonalVersion(false)
    setInfographicPersonal(undefined)
    setLessonMetaByMode((prev) => ({ ...prev, personal: [] }))
    setLessonTotalSlidesByMode((prev) => ({ ...prev, personal: 0 }))
  }, [curriculumId])

  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'refresh-personal-after-reset') {
        void refreshPersonalSlides()
        return
      }
      if (e.data?.type !== 'request-curriculum') return
      const target = e.source as Window | null
      if (!target) return
      let slidesToUse = aiSlides ?? activeOpenedSlidesRef.current ?? curriculumSlides ?? null
      const contentForTeacher = activeOpenedLessonMarkdownRef.current ?? curriculumMarkdown
      const slides =
        curriculumId && slideVersionChoice === null
          ? []
          :
        slidesToUse && slidesToUse.length > 0
          ? slidesToUse.map((s) => ({
              title: s.title,
              blocks: s.blocks ?? [],
              teacherNotes: (s as { teacherNotes?: string }).teacherNotes ?? '',
              imageUrl: s.imageUrl,
              visualEmbed: s.visualEmbed,
              visualLayout: s.visualLayout,
              visualCells: s.visualCells,
              visualInput1: (s as { visualInput1?: string }).visualInput1,
              visualInput2: (s as { visualInput2?: string }).visualInput2,
              visualInput3: (s as { visualInput3?: string }).visualInput3,
              visualInput4: (s as { visualInput4?: string }).visualInput4,
            }))
          : []
      const requestInfographic =
        slideVersionChoice === 'personal'
          ? infographicPersonal
          : slideVersionChoice === 'original'
            ? infographicOriginal
            : slideVersionChoice === 'shared'
              ? infographicShared
              : infographicShared ?? infographicOriginal ?? infographicPersonal
      try {
        target.postMessage(
          {
            type: 'curriculum-data',
            content: contentForTeacher,
            fullCurriculumMarkdown: curriculumMarkdown,
            topic: displayTopic,
            currentIndex: 0,
            curriculumId: curriculumId ?? null,
            slideMode: slideVersionChoice ?? null,
            personalViewSubMode: 'current',
            hasOriginalSlides: hasOriginalOrSharedVersion,
            slides,
            teacherTimerSeconds: 0,
            teacherTimerRunning: false,
            ...(requestInfographic ? { curriculumInfographic: requestInfographic } : {}),
          },
          window.location.origin
        )
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [curriculumMarkdown, displayTopic, curriculumId, aiSlides, curriculumSlides, slideVersionChoice, hasOriginalOrSharedVersion, refreshPersonalSlides, infographicShared, infographicOriginal, infographicPersonal])

  const handleOpenSlides = async () => {
    if (!curriculumMarkdown.trim()) return
    if (openSlidesInFlightRef.current) return
    openSlidesInFlightRef.current = true
    activeOpenedLessonMarkdownRef.current = null
    selectedLessonNoRef.current = null
    versionChooseArmedRef.current = false
    setSlideVersionChoice(null)
    setSlideAnalysisLoading(true)
    try {
      if (curriculumId) {
        const [sharedMeta, originalMeta, personalMeta] = await Promise.all([
          getCurriculumLessonMetaAction(curriculumId, 'shared'),
          getCurriculumLessonMetaAction(curriculumId, 'original'),
          getCurriculumLessonMetaAction(curriculumId, 'personal'),
        ])
        const hasShared = !!(sharedMeta && 'success' in sharedMeta && sharedMeta.success && ((sharedMeta.totalSlides ?? 0) > 0 || (sharedMeta.lessonCount ?? 0) > 0))
        const hasOriginal = !!(originalMeta && 'success' in originalMeta && originalMeta.success && ((originalMeta.totalSlides ?? 0) > 0 || (originalMeta.lessonCount ?? 0) > 0))
        const hasPersonal = !!(personalMeta && 'success' in personalMeta && personalMeta.success && ((personalMeta.totalSlides ?? 0) > 0 || (personalMeta.lessonCount ?? 0) > 0))
        setHasOriginalOrSharedVersion(hasShared || hasOriginal)
        setHasPersonalVersion(hasPersonal)
        setLessonMetaByMode({
          shared: hasShared ? lessonChunksToGroups(sharedMeta.lessons) : [],
          original: hasOriginal ? lessonChunksToGroups(originalMeta.lessons) : [],
          personal: hasPersonal ? lessonChunksToGroups(personalMeta.lessons) : [],
        })
        setLessonTotalSlidesByMode({
          shared: hasShared ? Math.max(0, Number(sharedMeta.totalSlides) || 0) : 0,
          original: hasOriginal ? Math.max(0, Number(originalMeta.totalSlides) || 0) : 0,
          personal: hasPersonal ? Math.max(0, Number(personalMeta.totalSlides) || 0) : 0,
        })
        setInfographicShared(hasShared ? sharedMeta.curriculumInfographic : undefined)
        setInfographicOriginal(hasOriginal ? originalMeta.curriculumInfographic : undefined)
        setInfographicPersonal(hasPersonal ? personalMeta.curriculumInfographic : undefined)
        const sharedGroups = hasShared ? lessonChunksToGroups(sharedMeta.lessons) : []
        const originalGroups = hasOriginal ? lessonChunksToGroups(originalMeta.lessons) : []
        const personalGroups = hasPersonal ? lessonChunksToGroups(personalMeta.lessons) : []
        const groups = sharedGroups.length > 0
          ? sharedGroups
          : originalGroups.length > 0
            ? originalGroups
            : personalGroups.length > 0
              ? personalGroups
              : []
        if (groups.length > 0) {
          pendingLessonOpenRef.current = {
            slides: null,
            mode: null,
            curriculumId,
          }
          setLessonGroups(groups)
          setLessonSelectOpen(true)
          return
        }
        toast({
          title: tr(
            'Chưa có dữ liệu tiết để mở',
            'Lesson data is not ready yet',
            '尚未准备好课时数据',
            '授業データがまだ準備できていません',
            '차시 데이터가 아직 준비되지 않았습니다'
          ),
          description: tr(
            'Vui lòng chạy backfill tiết hoặc lưu lại giáo trình để hệ thống tách JSON theo từng tiết.',
            'Please run lesson backfill or save curriculum again to build per-lesson JSON.',
            '请先执行课时回填，或重新保存课程以生成按课时 JSON。',
            '先に授業バックフィルを実行するか、カリキュラムを再保存して授業ごとのJSONを作成してください。',
            '차시 백필을 실행하거나 교육과정을 다시 저장해 차시별 JSON을 생성해 주세요.'
          ),
          variant: 'destructive',
        })
        return
      }
      toast({
        title: tr(
          'Vui lòng lưu giáo trình trước',
          'Please save curriculum first',
          '请先保存课程',
          '先にカリキュラムを保存してください',
          '먼저 교육과정을 저장해 주세요'
        ),
        description: tr(
          'Luồng hiện tại chỉ mở slide theo từng tiết từ dữ liệu DB đã lưu.',
          'Current flow only opens slides by lesson from saved DB data.',
          '当前流程仅支持从已保存的数据库按课时打开幻灯片。',
          '現在のフローは保存済みDBデータから授業単位でのみスライドを開きます。',
          '현재 플로우는 저장된 DB 데이터에서 차시 단위로만 슬라이드를 엽니다.'
        ),
        variant: 'destructive',
      })
    } finally {
      setSlideAnalysisLoading(false)
      openSlidesInFlightRef.current = false
    }
  }

  const handleSlideVersionChoose = (choice: SlideVersionChoice) => {
    versionChooseArmedRef.current = true
    setSlideVersionChoice(choice)
    if (curriculumId) {
      const infForChoice =
        choice === 'personal' ? infographicPersonal : choice === 'original' ? infographicOriginal : infographicShared
      const selectedLessonNo = selectedLessonNoRef.current
      if (!selectedLessonNo || selectedLessonNo <= 0) {
        const groups = lessonMetaByMode.shared ?? lessonMetaByMode.original ?? lessonMetaByMode.personal ?? []
        if (groups.length > 0) {
          pendingLessonOpenRef.current = { slides: null, mode: null, curriculumId }
          setLessonGroups(groups)
          setLessonSelectOpen(true)
          clearSlideVersionCaches()
          return
        }
        toast({
          title: tr('Chưa chọn tiết học', 'Lesson is not selected', '尚未选择课时', '授業が未選択です', '차시가 선택되지 않았습니다'),
          description: tr(
            'Vui lòng chọn tiết trước rồi mới chọn bản chung/bản riêng.',
            'Please choose lesson first, then choose shared/personal version.',
            '请先选择课时，再选择共享/个人版本。',
            '先に授業を選択してから、共有/個人版を選択してください。',
            '먼저 차시를 선택한 뒤 공유/개인 버전을 선택해 주세요.'
          ),
          variant: 'destructive',
        })
        clearSlideVersionCaches()
        return
      }
      void (async () => {
        const res = await getCurriculumSlidesByLessonCachedAction(curriculumId, choice, selectedLessonNo)
        if (res?.success && Array.isArray(res.slides) && res.slides.length > 0) {
          const source = String((res as { source?: unknown }).source ?? '')
          console.log('[lesson-open] slide-source', {
            curriculumId,
            lessonNo: selectedLessonNo,
            mode: choice,
            source,
            generated: !!(res as { generated?: unknown }).generated,
            slideCount: res.slides.length,
          })
          const selectedSlides = res.slides as AISlideData[]
          const lessonMarkdown = typeof (res as { lessonMarkdown?: unknown }).lessonMarkdown === 'string'
            ? String((res as { lessonMarkdown?: string }).lessonMarkdown || '')
            : ''
          if (source === 'fallback-empty' || source === 'fallback-error') {
            toast({
              title: tr(
                'Đang dùng fallback tạm',
                'Using fallback slides',
                '正在使用回退幻灯片',
                'フォールバックスライドを使用中',
                '대체 슬라이드 사용 중'
              ),
              description: tr(
                'AI chưa trả JSON slide hợp lệ cho tiết này, hệ thống tạm dựng slide từ markdown tiết.',
                'AI did not return valid JSON slides for this lesson, so temporary slides were built from lesson markdown.',
                'AI未返回该课时的有效JSON幻灯片，系统已临时从课时Markdown生成。',
                'AIがこの授業の有効なJSONスライドを返せなかったため、授業Markdownから暫定スライドを生成しました。',
                'AI가 해당 차시의 유효한 JSON 슬라이드를 반환하지 않아 차시 마크다운 기반 임시 슬라이드를 사용합니다.'
              ),
              variant: 'destructive',
            })
          }
          setAiSlides(selectedSlides)
          openGiaoVienWindow(selectedSlides, choice, infForChoice, lessonMarkdown || null)
          scheduleLessonIdleTrim()
          return
        }
        toast({
          title: tr('Không mở được tiết đã chọn', 'Cannot open selected lesson', '无法打开所选课时', '選択した授業を開けません', '선택한 차시를 열 수 없습니다'),
          variant: 'destructive',
        })
      })()
      clearSlideVersionCaches()
      return
    }
    toast({
      title: tr('Vui lòng lưu giáo trình trước', 'Please save curriculum first', '请先保存课程', '先にカリキュラムを保存してください', '먼저 교육과정을 저장해 주세요'),
      description: tr(
        'Luồng hiện tại chỉ mở slide theo từng tiết từ dữ liệu DB đã lưu.',
        'Current flow only opens slides by lesson from saved DB data.',
        '当前流程仅支持从已保存的数据库按课时打开幻灯片。',
        '現在のフローは保存済みDBデータから授業単位でのみスライドを開きます。',
        '현재 플로우는 저장된 DB 데이터에서 차시 단위로만 슬라이드를 엽니다.'
      ),
      variant: 'destructive',
    })
    clearSlideVersionCaches()
  }

  const handleReset = () => {
    cancelScheduledLessonTrim()
    setStep('INPUT')
    setCurriculumMarkdown('')
    setCurriculumId(null)
    versionChooseArmedRef.current = false
    activeOpenedSlidesRef.current = null
    activeOpenedLessonMarkdownRef.current = null
    selectedLessonNoRef.current = null
    setCurriculumEditMode(false)
    setEditOriginalText('')
    setEditEditedText('')
    setEditMatchStatus('idle')
    setEditMatchCount(0)
    setEditCompareResult(null)
    setEditCompareErrors([])
    setRegionPreview(null)
    setRegionCharCount(null)
    setRegionCompareResult(null)
    setRegionCheckErrors([])
    setWorksheetMarkdown('')
    setWorksheetId(null)
    resetWorksheetEditState()
    setCurriculumWorksheets([])
    setCurriculumSlides(null)
    setAiSlides(null)
    setSharedSlides(null)
    setOriginalSlides(null)
    setPersonalSlides(null)
    setHasOriginalOrSharedVersion(false)
    setHasPersonalVersion(false)
    setLessonMetaByMode({})
    setLessonTotalSlidesByMode({})
    setLessonGroups([])
    setInfographicShared(undefined)
    setInfographicOriginal(undefined)
    setInfographicPersonal(undefined)
    setFeatureSection('create')
    setLastOverwriteAt(null)
    setSimilarTopicCurricula([])
    setBookIsbn('')
    setLessonImages([])
    if (lessonImageInputRef.current) lessonImageInputRef.current.value = ''
    try {
      localStorage.removeItem(LAST_OPENED_CURRICULUM_KEY)
    } catch {}
  }

  const [saveCurriculumLoading, setSaveCurriculumLoading] = useState(false)
  const [escalateLoading, setEscalateLoading] = useState(false)
  const [curriculumEditMode, setCurriculumEditMode] = useState(false)
  const [regionCheckLoading, setRegionCheckLoading] = useState(false)
  const [regionCheckErrors, setRegionCheckErrors] = useState<string[]>([])
  const [regionPreview, setRegionPreview] = useState<{ original: string; edited: string } | null>(null)
  const [regionCharCount, setRegionCharCount] = useState<number | null>(null)
  const [regionCompareResult, setRegionCompareResult] = useState<{
    correctVersion: string
    originalReason: string | null
    editedReason: string | null
    explanation: string
    bothAgree?: boolean
    model1Version?: string
    model2Version?: string
  } | null>(null)
  const [editOriginalText, setEditOriginalText] = useState('')
  const [editEditedText, setEditEditedText] = useState('')
  const [editMatchStatus, setEditMatchStatus] = useState<'idle' | 'found' | 'not_found' | 'multiple'>('idle')
  const [editMatchCount, setEditMatchCount] = useState(0)
  const editMatchIndexRef = useRef<number>(-1)
  const curriculumMatchMarkRef = useRef<HTMLElement | null>(null)
  const [editCompareLoading, setEditCompareLoading] = useState(false)
  const [editCompareResult, setEditCompareResult] = useState<{ correctVersion: string; originalReason: string | null; editedReason: string | null; explanation: string; bothAgree: boolean; reasonSaved: string | null; reasonNotSaved: string | null; model1Version?: string; model2Version?: string } | null>(null)
  const [editCompareErrors, setEditCompareErrors] = useState<string[]>([])
  const [worksheetEditBlockIndex, setWorksheetEditBlockIndex] = useState<number | null>(null)
  const [worksheetEditBlockContent, setWorksheetEditBlockContent] = useState('')
  const [worksheetEditImages, setWorksheetEditImages] = useState<File[]>([])
  const [worksheetEditSaving, setWorksheetEditSaving] = useState(false)
  const [worksheetEditCheckLoading, setWorksheetEditCheckLoading] = useState(false)
  const [worksheetEditCheckResult, setWorksheetEditCheckResult] = useState<{
    issues: Array<{ field: string; location: string; issue: string; suggested: string }>
    correctedContent: string | null
  } | null>(null)
  const [worksheetEditFilter, setWorksheetEditFilter] = useState<'quiz' | 'essay' | null>(null)
  const worksheetEditBlocks = useMemo(
    () => parseWorksheetIntoBlocks(worksheetMarkdown),
    [worksheetMarkdown]
  )
  const editCompareTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const prevContentRef = useRef<string>('')
  const regionCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSaveCurriculum = async () => {
    if (!curriculumMarkdown.trim()) return
    setSaveCurriculumLoading(true)
    try {
      const formData = new FormData()
      formData.append('curriculumMarkdown', curriculumMarkdown)
      formData.append('topic', displayTopic)
      if (curriculumId) formData.append('curriculumId', curriculumId)
      formData.append('subjectId', subjectId)
      formData.append('gradeLevelId', gradeLevelId)
      formData.append('textbookSetId', textbookSetId)
      formData.append('textbookVolume', textbookVolume.trim())
      formData.append('lessonNumber', createMode === 'topic' ? '' : lessonNumber.trim())
      formData.append('lessonTypeId', lessonTypeId)
      formData.append('numLessons', String(numLessons))
      formData.append('lessonDurationMinutes', String(lessonDurationMinutes))
      formData.append('goals', goals)
      formData.append('bookIsbn', textbookSetId === 'khac' ? bookIsbn.trim() : '')
      const result = await saveCurriculum(formData)
      if (result.error) {
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error, variant: 'destructive' })
      } else if (result.success && result.curriculumId) {
        const newId = result.curriculumId
        setCurriculumId(newId)
        setCurriculumEditMode(false)
        if (curriculumSlides && curriculumSlides.length > 0 && !curriculumId) {
          saveSlidesToCurriculum({ curriculumId: newId, topic: displayTopic, subjectId, gradeLevelId, slides: curriculumSlides }).catch(() => {})
        }
        toast({ title: curriculumId ? tr('Đã cập nhật', 'Updated', '已更新', '更新しました', '업데이트됨') : tr('Đã lưu vào kho', 'Saved to library', '已保存到库', 'ライブラリに保存', '라이브러리에 저장됨'), duration: 2000 })
      }
    } finally {
      setSaveCurriculumLoading(false)
    }
  }

  const runRegionCheck = useCallback(
    async (prevContent: string, newContent: string, cursorPos: number) => {
      const regions = extractEditRegions(prevContent, newContent, cursorPos)
      if (!regions) {
        setRegionCheckLoading(false)
        return
      }
      setRegionPreview({ original: regions.originalRegion, edited: regions.editedRegion })
      setRegionCharCount(regions.charCount)
      setRegionCompareResult(null)
      setRegionCheckLoading(true)
      setRegionCheckErrors([])
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120000)
      try {
        const res = await fetch('/api/curriculum-edit-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalRegion: regions.originalRegion,
            editedRegion: regions.editedRegion,
          }),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        const data = await res.json().catch(() => ({}))
        const rc = data.regionCompare
        if (rc) {
          const bothAgree = !!data.bothAgree
          setRegionCompareResult({
            correctVersion: rc.correctVersion || 'edited',
            originalReason: rc.originalReason || null,
            editedReason: rc.editedReason || null,
            explanation: rc.explanation || '',
            bothAgree,
          })
          setRegionCheckErrors(Array.isArray(data.errors) ? data.errors : [])
          const useOriginal = rc.correctVersion === 'original'
          if (useOriginal) {
            const corrected = newContent.slice(0, regions.editedStart) + regions.originalRegion + newContent.slice(regions.editedEnd)
            setCurriculumMarkdown(corrected)
            prevContentRef.current = corrected
            setAutoSaveStatus('saving')
            const s = autoSaveStateRef.current
            const topicVal = s.topic.trim() || (s.lessonNumber ? `Bài ${s.lessonNumber}` : '')
            if (topicVal) {
              const formData = new FormData()
              formData.append('curriculumMarkdown', corrected)
              formData.append('topic', topicVal)
              if (s.curriculumId) formData.append('curriculumId', s.curriculumId)
              formData.append('subjectId', s.subjectId)
              formData.append('gradeLevelId', s.gradeLevelId)
              formData.append('textbookSetId', s.textbookSetId)
              formData.append('textbookVolume', s.textbookVolume)
              formData.append('lessonNumber', s.createMode === 'topic' ? '' : s.lessonNumber)
              formData.append('lessonTypeId', s.lessonTypeId)
              formData.append('numLessons', String(s.numLessons))
              formData.append('lessonDurationMinutes', String(s.lessonDurationMinutes))
              formData.append('goals', s.goals)
              formData.append('bookIsbn', s.textbookSetId === 'khac' ? s.bookIsbn.trim() : '')
              const result = await saveCurriculum(formData)
              if (result.success && result.curriculumId) {
                setCurriculumId(result.curriculumId)
                if (!s.curriculumId) setCurriculumEditMode(true)
                if (autoSaveTimeoutRef.current) {
                  clearTimeout(autoSaveTimeoutRef.current)
                  autoSaveTimeoutRef.current = null
                }
                toast({
                  title: tr('Đã sửa và lưu', 'Corrected and saved', '已修正并保存', '修正して保存', '수정 후 저장'),
                  description: rc.explanation || tr('AI đã so sánh và lưu bản đúng.', 'AI compared and saved the correct version.', 'AI已比较并保存正确版本。', 'AIが比較して正しい版を保存。', 'AI가 비교 후 올바른 버전 저장.'),
                  duration: 4000,
                })
              }
            }
            setAutoSaveStatus('idle')
          }
        } else if (data.ok) {
          setRegionCheckErrors([])
        } else {
          setRegionCheckErrors(Array.isArray(data.errors) ? data.errors : [])
        }
      } catch (err) {
        setRegionCheckErrors([])
        if (err instanceof Error && err.name === 'AbortError') {
          toast({
            title: tr('Hết thời gian kiểm tra', 'Check timed out', '检查超时', 'タイムアウト', '타임아웃'),
            description: tr('AI phản hồi chậm. Thử sửa lại hoặc bấm Lưu.', 'AI response slow. Try editing again or click Save.', 'AI响应慢。请重试或点击保存。', 'AI応答が遅い。再試行または保存をクリック。', 'AI 응답 지연. 다시 시도하거나 저장 클릭.'),
            variant: 'destructive',
          })
        }
      } finally {
        clearTimeout(timeoutId)
        setRegionCheckLoading(false)
        setRegionCharCount(null)
      }
    },
    [tr, toast]
  )

  const autoSaveStateRef = useRef({
    curriculumMarkdown: '',
    topic: '',
    lessonNumber: '',
    displayTopic: '',
    curriculumId: null as string | null,
    subjectId: '',
    gradeLevelId: '',
    textbookSetId: '',
    textbookVolume: '',
    bookIsbn: '',
    createMode: 'topic' as 'textbook' | 'topic',
    lessonTypeId: '',
    numLessons: 3,
    lessonDurationMinutes: 45,
    goals: '',
  })
  useEffect(() => {
    autoSaveStateRef.current = {
      curriculumMarkdown,
      topic,
      lessonNumber,
      displayTopic,
      curriculumId,
      subjectId,
      gradeLevelId,
      textbookSetId,
      textbookVolume,
      bookIsbn,
      createMode,
      lessonTypeId,
      numLessons,
      lessonDurationMinutes,
      goals,
    }
  })

  const performAutoSave = useCallback(async () => {
    const s = autoSaveStateRef.current
    if (!s.curriculumMarkdown.trim() || s.curriculumMarkdown.length < 30) return
    const topicVal = s.topic.trim() || (s.lessonNumber ? `Bài ${s.lessonNumber}` : '')
    if (!topicVal) return

    setAutoSaveStatus('saving')
    const formData = new FormData()
    formData.append('curriculumMarkdown', s.curriculumMarkdown)
    formData.append('topic', topicVal)
    if (s.curriculumId) formData.append('curriculumId', s.curriculumId)
    formData.append('subjectId', s.subjectId)
    formData.append('gradeLevelId', s.gradeLevelId)
    formData.append('textbookSetId', s.textbookSetId)
    formData.append('textbookVolume', s.textbookVolume)
    formData.append('lessonNumber', s.createMode === 'topic' ? '' : s.lessonNumber)
    formData.append('lessonTypeId', s.lessonTypeId)
    formData.append('numLessons', String(s.numLessons))
    formData.append('lessonDurationMinutes', String(s.lessonDurationMinutes))
    formData.append('goals', s.goals)
    formData.append('bookIsbn', s.textbookSetId === 'khac' ? s.bookIsbn.trim() : '')

    const result = await saveCurriculum(formData)
    if (result.error) {
      setAutoSaveStatus('idle')
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error, variant: 'destructive' })
    } else if (result.success && result.curriculumId) {
      setCurriculumId(result.curriculumId)
      if (!s.curriculumId) setCurriculumEditMode(true)
      setAutoSaveStatus('saved')
      toast({ title: tr('Đã lưu tự động', 'Auto-saved', '已自动保存', '自動保存しました', '자동 저장됨'), duration: 1500 })
      setTimeout(() => setAutoSaveStatus('idle'), 2000)
    } else {
      setAutoSaveStatus('idle')
    }
  }, [tr, toast])

  const handleCurriculumChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newVal = e.target.value
      const cursorPos = e.target.selectionStart ?? newVal.length
      const prev = prevContentRef.current
      setCurriculumMarkdown(newVal)
      prevContentRef.current = newVal

      if (regionCheckTimeoutRef.current) {
        clearTimeout(regionCheckTimeoutRef.current)
        setRegionCheckLoading(false)
      }
      const canEdit = curriculumEditMode || !curriculumId
      if (!canEdit || newVal.length < 15) return

      setRegionCheckLoading(true)
      const prevSnapshot = prev
      regionCheckTimeoutRef.current = setTimeout(() => {
        regionCheckTimeoutRef.current = null
        runRegionCheck(prevSnapshot, curriculumTextareaRef.current?.value ?? newVal, curriculumTextareaRef.current?.selectionStart ?? cursorPos)
      }, 350)

      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
      if (newVal.length >= 30 && step === 'RESULT') {
        autoSaveTimeoutRef.current = setTimeout(() => {
          autoSaveTimeoutRef.current = null
          void performAutoSave()
        }, 1000)
      }
    },
    [curriculumEditMode, curriculumId, runRegionCheck, step, performAutoSave]
  )

  useEffect(() => {
    prevContentRef.current = curriculumMarkdown
    return () => {
      if (regionCheckTimeoutRef.current) clearTimeout(regionCheckTimeoutRef.current)
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
      if (editCompareTimeoutRef.current) clearTimeout(editCompareTimeoutRef.current)
    }
  }, [curriculumMarkdown])

  useEffect(() => {
    const t = editOriginalText.trim()
    if (!t || t.length < 3 || !curriculumMarkdown) {
      setEditMatchStatus('idle')
      setEditMatchCount(0)
      editMatchIndexRef.current = -1
      return
    }
    let pos = 0
    const indices: number[] = []
    while ((pos = curriculumMarkdown.indexOf(t, pos)) >= 0) {
      indices.push(pos)
      pos += 1
    }
    if (indices.length === 0) {
      setEditMatchStatus('not_found')
      setEditMatchCount(0)
      editMatchIndexRef.current = -1
    } else if (indices.length === 1) {
      setEditMatchStatus('found')
      setEditMatchCount(1)
      editMatchIndexRef.current = indices[0]
    } else {
      setEditMatchStatus('multiple')
      setEditMatchCount(indices.length)
      editMatchIndexRef.current = -1
    }
  }, [editOriginalText, curriculumMarkdown])

  useEffect(() => {
    if (editMatchStatus !== 'found') return
    const el = curriculumMatchMarkRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    })
  }, [editMatchStatus, editOriginalText, curriculumMarkdown])

  const handleApplyEditFromSheet = useCallback(
    (originalText: string, editedText: string) => {
      const orig = originalText.trim()
      if (!orig || !curriculumMarkdown.includes(orig)) return
      const idx = curriculumMarkdown.indexOf(orig)
      if (idx < 0) return
      const newContent = curriculumMarkdown.slice(0, idx) + editedText.trim() + curriculumMarkdown.slice(idx + orig.length)
      setCurriculumMarkdown(newContent)
      prevContentRef.current = newContent
      setAutoSaveStatus('saving')
      const formData = new FormData()
      formData.append('curriculumMarkdown', newContent)
      formData.append('topic', displayTopic)
      if (curriculumId) formData.append('curriculumId', curriculumId)
      formData.append('subjectId', subjectId)
      formData.append('gradeLevelId', gradeLevelId)
      formData.append('textbookSetId', textbookSetId)
      formData.append('textbookVolume', textbookVolume.trim())
      formData.append('lessonNumber', createMode === 'topic' ? '' : lessonNumber.trim())
      formData.append('lessonTypeId', lessonTypeId)
      formData.append('numLessons', String(numLessons))
      formData.append('lessonDurationMinutes', String(lessonDurationMinutes))
      formData.append('goals', goals)
      formData.append('bookIsbn', textbookSetId === 'khac' ? bookIsbn.trim() : '')
      saveCurriculum(formData).then((result) => {
        if (result.success && result.curriculumId) {
          setCurriculumId(result.curriculumId)
          setAutoSaveStatus('saved')
          setTimeout(() => setAutoSaveStatus('idle'), 2000)
        } else {
          setAutoSaveStatus('idle')
        }
      })
    },
    [curriculumMarkdown, displayTopic, curriculumId, subjectId, gradeLevelId, textbookSetId, textbookVolume, createMode, lessonNumber, lessonTypeId, numLessons, lessonDurationMinutes, goals, bookIsbn]
  )

  const runEditCompare = useCallback(async () => {
    const orig = editOriginalText.trim()
    const edited = editEditedText.trim()
    if (!orig || orig.length < 5) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Dữ liệu cần sửa quá ngắn.', 'Data to edit is too short.', '要编辑的数据太短。', '編集するデータが短すぎます。', '편집할 데이터가 너무 짧습니다.'), variant: 'destructive' })
      return
    }
    if (editMatchStatus === 'multiple') {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Tìm thấy nhiều đoạn trùng. Gõ thêm nội dung để đoạn cần sửa là duy nhất.', 'Multiple matches found. Add more content so the segment to edit is unique.', '找到多个相同段落。请添加更多内容使要编辑的段落唯一。', '複数一致。編集する段落が一意になるよう内容を追加してください。', '여러 개 일치. 편집할 단락이 고유하도록 내용을 추가하세요.'), variant: 'destructive' })
      return
    }
    if (editMatchStatus !== 'found') {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Không tìm thấy dữ liệu cần sửa trong giáo trình.', 'Data to edit not found in curriculum.', '在课程中未找到要编辑的数据。', '教材内に編集するデータが見つかりません。', '교육과정에서 편집할 데이터를 찾을 수 없습니다.'), variant: 'destructive' })
      return
    }
    if (!edited) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Nhập nội dung sẽ sửa thành.', 'Enter the replacement content.', '请输入替换内容。', '置換後の内容を入力してください。', '대체할 내용을 입력하세요.'), variant: 'destructive' })
      return
    }
    setEditCompareLoading(true)
    setEditCompareResult(null)
    setEditCompareErrors([])
    const idx = editMatchIndexRef.current >= 0 ? editMatchIndexRef.current : curriculumMarkdown.indexOf(orig)
    const CONTEXT_CHARS = 250
    const start = Math.max(0, idx - CONTEXT_CHARS)
    const originalRegion = curriculumMarkdown.slice(start, idx + orig.length)
    const editedRegion = curriculumMarkdown.slice(start, idx) + edited
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000)
    try {
      const res = await fetch('/api/curriculum-edit-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalRegion, editedRegion }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      const data = await res.json().catch(() => ({}))
      const rc = data.regionCompare
      const reasonSaved = typeof data.reasonSaved === 'string' ? data.reasonSaved : null
      const reasonNotSaved = typeof data.reasonNotSaved === 'string' ? data.reasonNotSaved : null
      if (rc) {
        setEditCompareResult({
          correctVersion: rc.correctVersion || 'edited',
          originalReason: rc.originalReason || null,
          editedReason: rc.editedReason || null,
          explanation: rc.explanation || '',
          bothAgree: !!data.bothAgree,
          reasonSaved,
          reasonNotSaved,
          model1Version: data.model1Version,
          model2Version: data.model2Version,
        })
        setEditCompareErrors(Array.isArray(data.errors) ? data.errors : [])
        if (data.ok && rc.correctVersion === 'edited') {
          handleApplyEditFromSheet(orig, edited)
          setEditOriginalText('')
          setEditEditedText('')
          setEditMatchStatus('idle')
          setEditMatchCount(0)
          toast({
            title: tr('Đã lưu', 'Saved', '已保存', '保存しました', '저장됨'),
            description: reasonSaved || rc.explanation || tr('Lý do đã lưu: 2 AI (Gemini Pro + Gemini Flash) đồng ý bản sửa đúng.', 'Reason saved: 2 AIs agree the edit is correct.', '已保存原因：2个AI同意修改正确。', '保存理由：2つのAIが編集が正しいと同意。', '저장 이유: 2개 AI가 편집이 맞다고 동의.'),
            duration: 3000,
          })
        } else if (data.bothAgree && rc.correctVersion === 'original') {
          toast({
            title: tr('Chưa lưu – Giữ bản gốc', 'Not saved – Keep original', '未保存–保留原文', '保存せず–元のまま', '저장 안 함–원본 유지'),
            description: (reasonNotSaved || rc.explanation || tr('Lý do chưa lưu được: 2 AI đồng ý bản gốc đúng.', 'Reason not saved: 2 AIs agree the original is correct.', '未保存原因：2个AI同意原文正确。', '保存しない理由：2つのAIが元が正しいと同意。', '저장 안 함 이유: 2개 AI가 원본이 맞다고 동의.')) + ' ' + tr('Sửa lại và thử tiếp.', 'Edit and try again.', '请修改后重试。', '編集して再試行してください。', '수정 후 다시 시도하세요.'),
            variant: 'destructive',
            duration: 5000,
          })
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        toast({ title: tr('Hết thời gian', 'Timeout', '超时', 'タイムアウト', '타임아웃'), description: tr('AI phản hồi chậm. Thử lại.', 'AI response slow. Try again.', 'AI响应慢。请重试。', 'AI応答が遅い。再試行。', 'AI 응답 지연. 다시 시도.'), variant: 'destructive' })
      }
    } finally {
      clearTimeout(timeoutId)
      setEditCompareLoading(false)
    }
  }, [editOriginalText, editEditedText, editMatchStatus, curriculumMarkdown, handleApplyEditFromSheet, tr, toast])

  const handleSaveWorksheetBlockEdit = useCallback(async (opts?: { skipAiCheck?: boolean; contentOverride?: string }) => {
    const blockIdx = worksheetEditBlockIndex
    if (blockIdx == null || blockIdx < 0 || blockIdx >= worksheetEditBlocks.length) return
    const block = worksheetEditBlocks[blockIdx]
    const edited = opts?.contentOverride ?? worksheetEditBlockContent
    if (!worksheetId) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Phiếu bài tập chưa được lưu nên chưa thể sửa.', 'Worksheet is not saved yet, cannot edit now.', '练习尚未保存，暂无法编辑。', 'ワークシート未保存のため編集できません。', '워크시트가 아직 저장되지 않아 수정할 수 없습니다.'), variant: 'destructive' })
      return
    }
    if (!edited || edited.trim().length < 3) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Nội dung câu quá ngắn.', 'Question content is too short.', '题目内容太短。', '問題の内容が短すぎます。', '문제 내용이 너무 짧습니다.'), variant: 'destructive' })
      return
    }
    const originalContent = worksheetMarkdown.slice(block.startOffset, block.endOffset)
    if (originalContent === edited) {
      setWorksheetEditBlockIndex(null)
      setWorksheetEditBlockContent('')
      return
    }
    const skipAiCheck = opts?.skipAiCheck === true

    setWorksheetEditSaving(true)
    try {
      if (!skipAiCheck) {
        if (worksheetEditImages.length > 0) {
          const blockType = block?.type ?? 'quiz'
          const fdCheck = new FormData()
          fdCheck.append('content', edited)
          fdCheck.append('blockType', blockType)
          fdCheck.append('curriculum', curriculumMarkdown.slice(0, 4000))
          worksheetEditImages.forEach((f) => fdCheck.append('images', f))
          const checkRes = await fetch('/api/worksheet-edit-check', { method: 'POST', body: fdCheck })
          const checkData = await checkRes.json().catch(() => ({}))
          if (checkData.error) {
            toast({ title: tr('Lỗi kiểm tra', 'Check failed', '检查失败', 'チェック失敗', '검사 실패'), description: checkData.error, variant: 'destructive' })
            return
          }
          setWorksheetEditCheckResult({ issues: checkData.issues ?? [], correctedContent: checkData.correctedContent ?? null })
          if (Array.isArray(checkData.issues) && checkData.issues.length > 0) {
            toast({
              title: tr('Chưa lưu', 'Not saved', '未保存', '未保存', '저장 안 됨'),
              description: tr('Có lỗi theo ảnh đính kèm. Vui lòng sửa rồi lưu lại.', 'There are issues based on attached images. Please fix and save again.', '根据附图检测到问题，请修改后再保存。', '添付画像ベースで問題が見つかりました。修正して再保存してください。', '첨부 이미지 기준 오류가 있습니다. 수정 후 다시 저장하세요.'),
              variant: 'destructive',
            })
            return
          }
        } else {
        const CONTEXT_CHARS = 250
        const contextStart = Math.max(0, block.startOffset - CONTEXT_CHARS)
        const originalRegion = worksheetMarkdown.slice(contextStart, block.endOffset)
        const editedRegion = worksheetMarkdown.slice(contextStart, block.startOffset) + edited

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
          if (worksheetId) {
            try {
              const res = await fetch(`/api/worksheet/${encodeURIComponent(worksheetId)}`)
              const data = await res.json().catch(() => ({}))
              const list = Array.isArray(data?.questions) ? data.questions as Array<{ type?: string; content_json?: unknown }> : []
              const sameTypeIdx = worksheetEditBlocks.slice(0, blockIdx + 1).filter((b) => b.type === block.type).length - 1
              const row = list.filter((q) => q?.type === block.type)[sameTypeIdx]
              if (row && block.type === 'essay') {
                const heading = (restored.match(/^([^\n]*Bài\s+\d+[^\n]*)/i)?.[1] ?? '').trim()
                const problem = latexToReadable(getEssayProblem(row.content_json) || '')
                const solution = normalizeSolutionToStr(getEssaySolution(row.content_json)) || '(Chưa có lời giải)'
                restored = [heading, problem, '**Lời giải:**', solution].filter(Boolean).join('\n\n')
              }
            } catch {
              /* fallback dùng markdown hiện tại */
            }
          }
          setWorksheetEditBlockContent(restored)
          setWorksheetEditCheckResult(null)
          toast({
            title: tr('Chưa lưu', 'Not saved', '未保存', '未保存', '저장 안 됨'),
            description: (data.reasonNotSaved || rc?.explanation || tr('AI chưa đồng ý bản sửa.', 'AI did not approve this edit.', 'AI尚未同意该修改。', 'AIがこの編集を承認していません。', 'AI가 이 수정을 승인하지 않았습니다.')) + ' ' + tr('Đã hoàn nguyên nội dung gốc.', 'Reverted to original content.', '已恢复原内容。', '元の内容に戻しました。', '원본 내용으로 복원했습니다.'),
            variant: 'destructive',
          })
          return
        }
        }
      }

      const newMarkdown = replaceBlockInMarkdown(worksheetMarkdown, block, edited)
      const fd = new FormData()
      fd.append('worksheetId', worksheetId)
      fd.append('contentMarkdown', newMarkdown)
      const saveRes = await saveWorksheetContent(fd)
      if (saveRes?.error) {
        toast({ title: tr('Lỗi lưu phiếu', 'Save worksheet failed', '保存练习失败', 'ワークシート保存失敗', '워크시트 저장 실패'), description: saveRes.error, variant: 'destructive' })
        return
      }
      setWorksheetMarkdown(newMarkdown)
      setCurriculumWorksheets((prev) =>
        prev.map((w) => (w.id === worksheetId ? { ...w, content_markdown: '' } : w))
      )
      setWorksheetEditBlockIndex(null)
      setWorksheetEditBlockContent('')
      setWorksheetEditImages([])
      setWorksheetEditCheckResult(null)
      toast({
        title: tr('Đã lưu', 'Saved', '已保存', '保存しました', '저장됨'),
        description: skipAiCheck
          ? tr('Đã áp dụng sửa và lưu.', 'Applied fixes and saved.', '已应用修改并保存。', '修正を適用して保存しました。', '수정 적용 후 저장했습니다.')
          : tr('AI đã kiểm tra và lưu câu đã sửa.', 'AI checked and saved the edited question.', 'AI已检查并保存修改的题目。', 'AIが確認して修正した問題を保存しました。', 'AI가 확인 후 수정한 문제를 저장했습니다.'),
      })
    } finally {
      setWorksheetEditSaving(false)
    }
  }, [worksheetEditBlockIndex, worksheetEditBlockContent, worksheetEditBlocks, worksheetEditImages, worksheetMarkdown, worksheetId, curriculumMarkdown, tr, toast])

  const handleCheckWorksheetBlock = useCallback(async () => {
    const content = worksheetEditBlockContent.trim()
    if (!content || content.length < 5) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Nội dung câu quá ngắn.', 'Content too short.', '内容太短。', '内容が短すぎます。', '내용이 너무 짧습니다.'), variant: 'destructive' })
      return
    }
    const blockIdx = worksheetEditBlockIndex
    const block = blockIdx != null ? worksheetEditBlocks[blockIdx] : null
    const blockType = block?.type ?? 'quiz'
    setWorksheetEditCheckLoading(true)
    setWorksheetEditCheckResult(null)
    try {
      let res: Response
      if (worksheetEditImages.length > 0) {
        const fd = new FormData()
        fd.append('content', content)
        fd.append('blockType', blockType)
        fd.append('curriculum', curriculumMarkdown.slice(0, 4000))
        worksheetEditImages.forEach((f) => fd.append('images', f))
        res = await fetch('/api/worksheet-edit-check', { method: 'POST', body: fd })
      } else {
        res = await fetch('/api/worksheet-edit-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            blockType,
            curriculum: curriculumMarkdown.slice(0, 4000),
          }),
        })
      }
      const data = await res.json().catch(() => ({}))
      if (data.error) {
        toast({ title: tr('Lỗi kiểm tra', 'Check failed', '检查失败', 'チェック失敗', '검사 실패'), description: data.error, variant: 'destructive' })
        return
      }
      setWorksheetEditCheckResult({
        issues: data.issues ?? [],
        correctedContent: data.correctedContent ?? null,
      })
      if (!data.issues?.length) {
        toast({ title: tr('Không có lỗi', 'No issues', '无问题', '問題なし', '문제 없음'), description: tr('Câu đã đúng, có thể lưu.', 'Question is correct, you can save.', '题目正确，可以保存。', '問題は正しいです。保存できます。', '문제가 맞습니다. 저장하세요.'), duration: 2000 })
      }
    } finally {
      setWorksheetEditCheckLoading(false)
    }
  }, [worksheetEditBlockIndex, worksheetEditBlockContent, worksheetEditBlocks, worksheetEditImages, curriculumMarkdown, tr, toast])

  const handleEscalateToAdmin = async (errorsToSend?: string[]) => {
    const errs = errorsToSend ?? regionCheckErrors
    if (!curriculumMarkdown.trim()) return
    setEscalateLoading(true)
    try {
      const res = await fetch('/api/curriculum-edit-escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curriculumId,
          topic: displayTopic,
          subjectId,
          gradeLevelId,
          textbookSetId,
          textbookVolume: textbookVolume.trim(),
          lessonNumber: createMode === 'topic' ? '' : lessonNumber.trim(),
          lessonTypeId,
          numLessons,
          lessonDurationMinutes,
          goals,
          contentMarkdown: curriculumMarkdown,
          aiErrors: errs,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setCurriculumEditMode(true)
        toast({
          title: tr('Đã gửi admin', 'Sent to admin', '已发送给管理员', '管理者に送信しました', '관리자에게 전송됨'),
          description: tr('Admin sẽ xem xét và phản hồi. Bạn có thể tiếp tục sửa.', 'Admin will review and respond. You can continue editing.', '管理员将审核并回复。您可以继续编辑。', '管理者が確認して返答します。編集を続けられます。', '관리자가 검토 후 답변합니다. 편집을 계속할 수 있습니다.'),
          duration: 4000,
        })
      } else {
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: data?.error || 'Gửi thất bại.', variant: 'destructive' })
      }
    } finally {
      setEscalateLoading(false)
    }
  }

  const handleLoadCurriculum = async (id: string, options?: { skipScroll?: boolean }) => {
    const result = await getCurriculumById(id)
    if (result.error) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error, variant: 'destructive' })
      return
    }
    if (result.success && result.curriculum) {
      const c = result.curriculum as { id?: string; topic?: string; subject_id?: string; grade_level_id?: string; textbook_set_id?: string; textbook_volume?: string | null; textbook_isbn?: string | null; lesson_number?: number | null; lesson_type_id?: string; num_lessons?: number; lesson_duration_minutes?: number; goals?: string; content_markdown?: string }
      setSubjectId(c.subject_id ?? 'toan')
      setGradeLevelId(normalizeGradeLevelId(c.grade_level_id ?? 'lop-12'))
      setTextbookSetId(c.textbook_set_id ?? 'ket-noi-tri-thuc')
      setTextbookVolume(c.textbook_volume ?? '')
      setBookIsbn(c.textbook_isbn ?? '')
      setTopic(c.topic ?? '')
      setLessonNumber(c.lesson_number != null ? String(c.lesson_number) : '')
      setCreateMode(c.lesson_number != null ? 'textbook' : 'topic')
      setLessonTypeId(c.lesson_type_id ?? 'hinh-thanh-kien-thuc')
      setNumLessons(c.num_lessons ?? 3)
      setLessonDurationMinutes(c.lesson_duration_minutes ?? 45)
      setGoals(c.goals ?? '')
      setCurriculumMarkdown(c.content_markdown ?? '')
      setCurriculumId(c.id ?? null)
      setCurriculumEditMode(false) // Đóng mặc định; mở khi bấm "Sửa giáo trình"
      setEditOriginalText('')
      setEditEditedText('')
      setEditMatchStatus('idle')
      setEditMatchCount(0)
      setEditCompareResult(null)
      setEditCompareErrors([])
      setRegionPreview(null)
      setRegionCharCount(null)
      setRegionCompareResult(null)
      setRegionCheckErrors([])
      setWorksheetMarkdown('')
      setWorksheetId(null)
      resetWorksheetEditState()
      setStep('RESULT')
      setShowBrowse(false)
      setFeatureSection('create')
      setAiSlides(null)
      const wsRes = await getWorksheetsByCurriculumId(id)
      if (wsRes && 'items' in wsRes) setCurriculumWorksheets(compactWorksheetList((wsRes.items ?? []) as CurriculumWorksheetListItem[]))
      else setCurriculumWorksheets([])
      const [sharedMeta, originalMeta, personalMeta] = await Promise.all([
        getCurriculumLessonMetaAction(id, 'shared'),
        getCurriculumLessonMetaAction(id, 'original'),
        getCurriculumLessonMetaAction(id, 'personal'),
      ])
      const hasShared = !!(sharedMeta && 'success' in sharedMeta && sharedMeta.success && ((sharedMeta.totalSlides ?? 0) > 0 || (sharedMeta.lessonCount ?? 0) > 0))
      const hasOriginal = !!(originalMeta && 'success' in originalMeta && originalMeta.success && ((originalMeta.totalSlides ?? 0) > 0 || (originalMeta.lessonCount ?? 0) > 0))
      const hasPersonal = !!(personalMeta && 'success' in personalMeta && personalMeta.success && ((personalMeta.totalSlides ?? 0) > 0 || (personalMeta.lessonCount ?? 0) > 0))
      setHasOriginalOrSharedVersion(hasShared || hasOriginal)
      setHasPersonalVersion(hasPersonal)
      setLessonMetaByMode({
        shared: hasShared ? lessonChunksToGroups(sharedMeta.lessons) : [],
        original: hasOriginal ? lessonChunksToGroups(originalMeta.lessons) : [],
        personal: hasPersonal ? lessonChunksToGroups(personalMeta.lessons) : [],
      })
      // Không giữ toàn bộ slide trong bộ nhớ ở bước mở giáo trình.
      setCurriculumSlides(null)
      setInfographicShared(hasShared ? sharedMeta.curriculumInfographic : undefined)
      setInfographicOriginal(hasOriginal ? originalMeta.curriculumInfographic : undefined)
      setInfographicPersonal(hasPersonal ? personalMeta.curriculumInfographic : undefined)
      void recordCurriculumOpen(id)
      toast({ title: tr('Đã tải giáo trình', 'Curriculum loaded', '已加载课程', 'カリキュラムを読み込み', '교육과정 로드됨'), duration: 2000 })
      if (!options?.skipScroll) {
        setTimeout(() => {
          pageHeaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 150)
      }
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (hasAutoRestoredCurriculumRef.current) return
    if (curriculumId || curriculumMarkdown.trim()) return
    hasAutoRestoredCurriculumRef.current = true
    try {
      const savedCurriculumId = localStorage.getItem(LAST_OPENED_CURRICULUM_KEY)?.trim()
      if (!savedCurriculumId) return
      skipNextResultScrollRef.current = true
      void handleLoadCurriculum(savedCurriculumId, { skipScroll: true })
    } catch {}
  }, [curriculumId, curriculumMarkdown, handleLoadCurriculum])

  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null)
  const curriculumTextareaRef = useRef<HTMLTextAreaElement>(null)

  const handleDeleteCurriculum = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm(tr('Xóa giáo trình này? Phiếu bài tập thuộc giáo trình sẽ không bị xóa.', 'Delete this curriculum? Worksheets in it will not be deleted.', '删除此课程？其中的练习不会被删除。', 'このカリキュラムを削除しますか？ワークシートは削除されません。', '이 교육과정을 삭제할까요? 워크시트는 삭제되지 않습니다.'))) return
    setDeleteLoadingId(id)
    const result = await deleteCurriculum(id)
    setDeleteLoadingId(null)
    if (result.error) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error, variant: 'destructive' })
    } else {
      setCurriculaList((prev) => prev.filter((c) => c.id !== id))
      if (curriculumId === id) handleReset()
      toast({ title: tr('Đã xóa giáo trình', 'Curriculum deleted', '课程已删除', 'カリキュラムを削除', '교육과정 삭제됨'), duration: 2000 })
    }
  }

  const handleLoadWorksheetFromCurriculum = async (w: { id: string; topic: string; content_markdown: string }) => {
    // Gọi API để lấy content đã merge lời giải từ worksheet_questions (không cần auth)
    let content = w.content_markdown
    try {
      const res = await fetch(`/api/worksheet/${encodeURIComponent(w.id)}`)
      const data = await res.json().catch(() => ({}))
      if (!data?.error && data?.content_markdown) {
        content = data.content_markdown
        // Merge thêm trên client nếu API trả về questions – đảm bảo lời giải hiển thị trong popup sửa
        const questions = Array.isArray(data.questions) ? data.questions : []
        if (questions.length) content = mergeContentWithQuestions(content, questions)
      }
    } catch {
      const result = await getWorksheetById(w.id)
      if (result.success && result.worksheet) {
        content = (result.worksheet as { content_markdown?: string }).content_markdown ?? content
      }
    }
    setWorksheetMarkdown(content)
    setWorksheetId(w.id)
    resetWorksheetEditState()
  }

  const scrollToWorksheetSection = useCallback(() => {
    if (!worksheetMarkdown && curriculumWorksheets.length > 0) {
      handleLoadWorksheetFromCurriculum(curriculumWorksheets[0])
      setTimeout(() => {
        worksheetSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    } else if (worksheetSectionRef.current) {
      worksheetSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else if (curriculumWorksheetsSectionRef.current) {
      curriculumWorksheetsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [worksheetMarkdown, curriculumWorksheets])

  const pollJobStatus = useCallback(
    async (jobId: string): Promise<{ status: string; result?: Record<string, unknown>; error?: string }> => {
      const res = await fetch(`/api/worksheet-job-status?jobId=${encodeURIComponent(jobId)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return {
          status: 'failed',
          error:
            (typeof data?.error === 'string' && data.error.trim()) ||
            `Không lấy được trạng thái job (HTTP ${res.status}).`,
        }
      }
      if (typeof data?.status !== 'string' || !data.status.trim()) {
        return {
          status: 'failed',
          error: tr(
            'Phản hồi trạng thái job không hợp lệ.',
            'Invalid job status response.',
            '任务状态响应无效。',
            'ジョブ状態レスポンスが無効です。',
            '작업 상태 응답이 유효하지 않습니다.'
          ),
        }
      }
      return { status: data.status, result: data.result, error: data.error }
    },
    [tr]
  )

  const triggerWorksheetVerify = useCallback(
    async (targetWorksheetId: string, markdown: string) => {
      // Verify có thể chạy khá lâu khi phiếu có nhiều câu; poll lâu hơn để UI kịp phản ánh trạng thái [Đã verify].
      setWorksheetVerifyPollUntil(Date.now() + 10 * 60 * 1000)
      try {
        const res = await fetch('/api/worksheet-verify-background', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ worksheetId: targetWorksheetId, curriculumMarkdown: markdown }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data?.error) {
          toast({
            title: tr('Verify thất bại', 'Verify failed', '校验失败', '検証失敗', '검증 실패'),
            description: data?.error || tr('Không thể chạy verify nền.', 'Could not start background verify.', '无法启动后台校验。', 'バックグラウンド検証を開始できません。', '백그라운드 검증을 시작할 수 없습니다.'),
            variant: 'destructive',
          })
          return
        }
        if (data?.skipped) {
          toast({
            title: tr('Verify bị bỏ qua', 'Verify skipped', '校验已跳过', '検証をスキップ', '검증 건너뜀'),
            description: data?.reason || tr('Thiếu cấu hình verify.', 'Missing verify configuration.', '缺少校验配置。', '検証設定が不足しています。', '검증 설정이 누락되었습니다.'),
            variant: 'destructive',
          })
          return
        }
        // Refetch ngay: API đã đồng bộ tag [Đã verify] từ DB, không cần chờ poll 15s
        try {
          const r = await fetch(`/api/worksheet/${encodeURIComponent(targetWorksheetId)}`)
          const d = await r.json().catch(() => ({}))
          if (d?.content_markdown) {
            setWorksheetMarkdown(d.content_markdown)
            setCurriculumWorksheets((prev) =>
              prev.some((w) => w.id === targetWorksheetId)
                ? prev.map((w) => (w.id === targetWorksheetId ? { ...w, content_markdown: '' } : w))
                : prev
            )
          }
        } catch {
          /* poll effect vẫn tiếp tục */
        }
      } catch {
        toast({
          title: tr('Verify thất bại', 'Verify failed', '校验失败', '検証失敗', '검증 실패'),
          description: tr('Lỗi mạng khi gọi verify nền.', 'Network error while calling background verify.', '调用后台校验时网络错误。', 'バックグラウンド検証呼び出し時にネットワークエラー。', '백그라운드 검증 호출 중 네트워크 오류.'),
          variant: 'destructive',
        })
      }
    },
    [toast, tr]
  )

  const startSolveSgkEssaysJob = useCallback(
    async (targetWorksheetId: string, markdown: string, silent = false) => {
      const res = await fetch('/api/worksheet-solve-sgk-essays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worksheetId: targetWorksheetId, curriculumMarkdown: markdown }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.error) {
        toast({
          title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
          description: data?.error || tr('Không thể tạo job giải tự luận SGK.', 'Could not create SGK essay solving job.', '无法创建 SGK 主观题解题任务。', 'SGK記述式解答ジョブを作成できません。', 'SGK 서술형 풀이 작업을 생성할 수 없습니다.'),
          variant: 'destructive',
        })
        return
      }
      const solveJobId = data?.jobId as string | undefined
      if (!solveJobId) return

      try {
        localStorage.setItem(WS_ACTIVE_JOB_KEY, JSON.stringify({ jobId: solveJobId, type: 'solve_sgk_essays', curriculumId, curriculumMarkdown: markdown }))
      } catch {}

      if (!silent) {
        toast({
          title: tr('Đang giải tự luận SGK', 'Solving SGK essays', '正在解 SGK 主观题', 'SGK記述式を解答中', 'SGK 서술형 풀이 중'),
          description: tr('Hệ thống đang chạy nền từng bài tự luận.', 'Background solving is running for each essay.', '系统正在后台逐题解答主观题。', '記述式をバックグラウンドで順次解答中。', '서술형 문제를 백그라운드에서 순차 풀이 중입니다.'),
          duration: 4000,
        })
      }

      while (true) {
        const st = await pollJobStatus(solveJobId)
        if (st.status === 'completed' && st.result) {
          try { localStorage.removeItem(WS_ACTIVE_JOB_KEY) } catch {}
          const r = st.result as { worksheetId?: string; worksheetMarkdown?: string; solvedCount?: number; totalEssayCount?: number; pendingCount?: number }
          if (r.worksheetMarkdown) setWorksheetMarkdown(r.worksheetMarkdown)
          if (r.worksheetId) {
            setWorksheetId(r.worksheetId)
            void triggerWorksheetVerify(r.worksheetId, markdown)
          }
          if (curriculumId) {
            const wsRes = await getWorksheetsByCurriculumId(curriculumId)
            if (wsRes && 'items' in wsRes) setCurriculumWorksheets(compactWorksheetList((wsRes.items ?? []) as CurriculumWorksheetListItem[]))
          }
          toast({
            title: tr('Đã giải xong tự luận SGK', 'SGK essay solving completed', 'SGK 主观题解答完成', 'SGK記述式の解答完了', 'SGK 서술형 풀이 완료'),
            description: `${tr('Đã giải', 'Solved', '已解答', '解答済み', '풀이 완료')} ${r.solvedCount ?? 0}/${r.totalEssayCount ?? 0} (${tr('còn chờ', 'pending', '待处理', '保留', '대기')}: ${r.pendingCount ?? 0})`,
            duration: 3500,
          })
          break
        }
        if (st.status === 'failed') {
          try { localStorage.removeItem(WS_ACTIVE_JOB_KEY) } catch {}
          toast({
            title: tr('Giải tự luận thất bại', 'Essay solving failed', '主观题解答失败', '記述式解答失敗', '서술형 풀이 실패'),
            description: st.error || tr('Xử lý thất bại', 'Processing failed', '处理失败', '処理失敗', '처리 실패'),
            variant: 'destructive',
          })
          break
        }
        await new Promise((r) => setTimeout(r, 4000))
      }
    },
    [curriculumId, pollJobStatus, toast, tr, triggerWorksheetVerify]
  )

  const resumeJobRanRef = useRef(false)
  // Khôi phục job khi user quay lại trang (đã đóng trước đó)
  useEffect(() => {
    if (typeof window === 'undefined' || resumeJobRanRef.current) return
    try {
      const raw = localStorage.getItem(WS_ACTIVE_JOB_KEY)
      if (!raw) return
      resumeJobRanRef.current = true
      const stored = JSON.parse(raw) as { jobId?: string; type?: string; curriculumId?: string; curriculumMarkdown?: string }
      const jobId = stored?.jobId
      if (!jobId || typeof jobId !== 'string') return
      const jobType = stored?.type ?? 'parse_sgk_extract'
      const storedCurriculumId = stored?.curriculumId ?? null
      const storedCurriculumMarkdown = stored?.curriculumMarkdown ?? ''
      const doResume = async () => {
        if (jobType === 'parse_sgk_extract') setSgkLoading(true)
        else if (jobType === 'step_by_step_quiz' || jobType === 'step_by_step_essay') setWsStepByStepLoading(true)
        while (true) {
          const st = await pollJobStatus(jobId)
          if (st.status === 'completed' && st.result) {
            localStorage.removeItem(WS_ACTIVE_JOB_KEY)
            const r = st.result as { worksheetId?: string; worksheetMarkdown?: string; addedCount?: number; questionIds?: string[]; solvedCount?: number; totalEssayCount?: number; pendingCount?: number }
            setWorksheetMarkdown(r.worksheetMarkdown ?? worksheetMarkdown)
            setWorksheetId(r.worksheetId ?? worksheetId)
            setWsStepByStepQuestionIds(r.questionIds ?? [])
            resetWorksheetEditState()
            if (r.worksheetId) {
              if (jobType === 'solve_sgk_essays') void triggerWorksheetVerify(r.worksheetId, storedCurriculumMarkdown)
              if (jobType === 'parse_sgk_extract') void startSolveSgkEssaysJob(r.worksheetId, storedCurriculumMarkdown, true)
            }
            if (storedCurriculumId) {
              const wsRes = await getWorksheetsByCurriculumId(storedCurriculumId)
              if (wsRes && 'items' in wsRes) setCurriculumWorksheets(compactWorksheetList((wsRes.items ?? []) as CurriculumWorksheetListItem[]))
            }
            setWsStepByStepExpanded(true)
            toast({
              title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'),
              description: jobType === 'parse_sgk_extract'
                ? tr('Đã thêm', 'Added', '已添加', '追加しました', '추가됨') + ` ${r.addedCount ?? 0} ${tr('câu vào phiếu', 'questions to worksheet', '道题到练习', '問を追加', '문항 추가됨')}`
                : jobType === 'solve_sgk_essays'
                  ? `${tr('Đã giải', 'Solved', '已解答', '解答済み', '풀이 완료')} ${r.solvedCount ?? 0}/${r.totalEssayCount ?? 0}`
                : tr('Phiếu bài tập đã tạo và lưu.', 'Worksheet created and saved.', '练习已创建并保存。', '作成して保存しました。', '생성 후 저장했습니다.'),
              duration: 3000,
            })
            scrollToWorksheetSection()
            break
          }
          if (st.status === 'failed') {
            localStorage.removeItem(WS_ACTIVE_JOB_KEY)
            toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: st.error || tr('Xử lý thất bại', 'Processing failed', '处理失败', '処理失敗', '처리 실패'), variant: 'destructive' })
            break
          }
          await new Promise((r) => setTimeout(r, 3000))
        }
        setSgkLoading(false)
        setWsStepByStepLoading(false)
      }
      void doResume()
    } catch {
      localStorage.removeItem(WS_ACTIVE_JOB_KEY)
    }
  }, [pollJobStatus, startSolveSgkEssaysJob, triggerWorksheetVerify, tr, worksheetId, worksheetMarkdown])

  const handleParseSgk = async () => {
    if (sgkSubmitLockRef.current) return
    if (sgkImages.length === 0) {
      toast({ title: tr('Chọn ảnh', 'Select images', '选择图片', '画像を選択', '이미지 선택'), description: tr('Vui lòng chọn ảnh bài tập SGK.', 'Please select SGK exercise images.', '请选择教材练习图片。', 'SGKの練習画像を選択してください。', 'SGK 연습 이미지를 선택하세요.'), variant: 'destructive' })
      return
    }
    if (!curriculumMarkdown.trim()) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng tạo giáo trình trước.', 'Please create curriculum first.', '请先创建课程。', '先にカリキュラムを作成してください。', '먼저 교육과정을 만드세요.'), variant: 'destructive' })
      return
    }
    sgkSubmitLockRef.current = true
    setSgkLoading(true)
    const fd = new FormData()
    sgkImages.forEach((f) => fd.append('images', f))
    fd.append('topic', displayTopic)
    fd.append('subjectId', subjectId)
    fd.append('gradeLevelId', gradeLevelId)
    fd.append('curriculumMarkdown', curriculumMarkdown)
    if (curriculumId) fd.append('curriculumId', curriculumId)
    if (worksheetId) fd.append('worksheetId', worksheetId)
    try {
      const res = await fetch('/api/worksheet-extract-sgk', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (data.error) {
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: data.error, variant: 'destructive' })
        return
      }
      const jobId = data.jobId
      if (!jobId) {
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: 'Không nhận được jobId', variant: 'destructive' })
        return
      }
      try {
        localStorage.setItem(WS_ACTIVE_JOB_KEY, JSON.stringify({ jobId, type: 'parse_sgk_extract', curriculumId, curriculumMarkdown }))
      } catch {}
      toast({
        title: tr('Đang xử lý nền', 'Processing in background', '后台处理中', 'バックグラウンド処理中', '백그라운드 처리 중'),
        description: tr('Bạn có thể đóng trang. Quay lại để xem kết quả.', 'You can close the page. Return to see results.', '可关闭页面，稍后查看结果。', 'ページを閉じても大丈夫。後で結果を確認。', '페이지를 닫아도 됩니다. 나중에 결과 확인.'),
        duration: 5000,
      })
      setSgkImages([])
      if (sgkInputRef.current) sgkInputRef.current.value = ''
      while (true) {
        const st = await pollJobStatus(jobId)
        if (st.status === 'completed' && st.result) {
          const r = st.result as { worksheetId?: string; worksheetMarkdown?: string; addedCount?: number }
          try { localStorage.removeItem(WS_ACTIVE_JOB_KEY) } catch {}
          setWorksheetMarkdown(r.worksheetMarkdown ?? worksheetMarkdown)
          setWorksheetId(r.worksheetId ?? worksheetId)
          resetWorksheetEditState()
          if (r.worksheetId) {
            void startSolveSgkEssaysJob(r.worksheetId, curriculumMarkdown)
          }
          if (curriculumId) {
            const wsRes = await getWorksheetsByCurriculumId(curriculumId)
            if (wsRes && 'items' in wsRes) setCurriculumWorksheets(compactWorksheetList((wsRes.items ?? []) as CurriculumWorksheetListItem[]))
          }
          toast({
            title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'),
            description: tr('Đã tách', 'Extracted', '已提取', '抽出済み', '추출 완료') + ` ${r.addedCount ?? 0} ${tr('câu vào phiếu', 'questions to worksheet', '道题到练习', '問を追加', '문항 추가됨')}`,
            duration: 3000,
          })
          scrollToWorksheetSection()
          break
        }
        if (st.status === 'failed') {
          try { localStorage.removeItem(WS_ACTIVE_JOB_KEY) } catch {}
          toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: st.error || tr('Xử lý thất bại', 'Processing failed', '处理失败', '処理失敗', '처리 실패'), variant: 'destructive' })
          break
        }
        await new Promise((r) => setTimeout(r, 3000))
      }
    } finally {
      sgkSubmitLockRef.current = false
      setSgkLoading(false)
    }
  }

  const runCreateStepByStep = async (type: 'quiz' | 'essay') => {
    if (wsStepByStepSubmitLockRef.current) return
    if (!curriculumMarkdown.trim()) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng tạo giáo trình trước.', 'Please create curriculum first.', '请先创建课程。', '先にカリキュラムを作成してください。', '먼저 교육과정을 만드세요.'), variant: 'destructive' })
      return
    }
    const quizCount = Math.max(0, Math.min(wsStepByStepQuizCount, 20))
    const essayCount = Math.max(0, Math.min(wsStepByStepEssayCount, 10))
    const count = type === 'quiz' ? quizCount : essayCount
    const diff = type === 'quiz' ? wsStepByStepQuizDiff : wsStepByStepEssayBloom
    if (count === 0) {
      toast({
        title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
        description: type === 'quiz'
          ? tr('Nhập số câu trắc nghiệm ≥ 1.', 'Enter quiz count ≥ 1.', '输入选择题数≥1。', 'クイズ数を1以上。', '퀴즈 수 ≥ 1 입력.')
          : tr('Nhập số bài tự luận ≥ 1.', 'Enter essay count ≥ 1.', '输入主观题数≥1。', '記述式数を1以上。', '서술형 수 ≥ 1 입력.'),
        variant: 'destructive',
      })
      return
    }
    wsStepByStepSubmitLockRef.current = true
    setWsStepByStepLoading(true)
    setWsStepByStepQuestionIds([])
    let lessonTopics: string[] | undefined
    if (curriculumId) {
      const curRes = await getCurriculumById(curriculumId)
      const c = curRes?.curriculum as { lesson_topics?: string[] } | undefined
      lessonTopics = Array.isArray(c?.lesson_topics) && c.lesson_topics.length >= 1 ? c.lesson_topics : undefined
    }
    try {
      const res = await fetch('/api/worksheet-submit-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: type === 'quiz' ? 'quiz' : 'essay',
          count,
          curriculumMarkdown,
          topic: displayTopic,
          subjectId,
          gradeLevelId,
          curriculumId,
          lessonTopics,
          difficulty: diff,
          sessionQuizCountByDiff: { easy: wsStepByStepSessionCounts.quiz?.easy ?? 0, medium: wsStepByStepSessionCounts.quiz?.medium ?? 0, hard: wsStepByStepSessionCounts.quiz?.hard ?? 0 },
          sessionEssayCountByBloom: { 'nhan-biet': wsStepByStepSessionCounts.essay?.['nhan-biet'] ?? 0, 'thong-hieu': wsStepByStepSessionCounts.essay?.['thong-hieu'] ?? 0, 'van-dung-thap': wsStepByStepSessionCounts.essay?.['van-dung-thap'] ?? 0, 'van-dung-cao': wsStepByStepSessionCounts.essay?.['van-dung-cao'] ?? 0, 'thuc-te': wsStepByStepSessionCounts.essay?.['thuc-te'] ?? 0 },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.error) {
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: data.error, variant: 'destructive' })
        return
      }
      const jobId = data.jobId
      if (!jobId) {
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: 'Không nhận được jobId', variant: 'destructive' })
        return
      }
      try {
        localStorage.setItem(WS_ACTIVE_JOB_KEY, JSON.stringify({ jobId, type: type === 'quiz' ? 'step_by_step_quiz' : 'step_by_step_essay', curriculumId, curriculumMarkdown }))
      } catch {}
      toast({
        title: tr('Đang xử lý nền', 'Processing in background', '后台处理中', 'バックグラウンド処理中', '백그라운드 처리 중'),
        description: tr('Bạn có thể đóng trang. Quay lại để xem kết quả.', 'You can close the page. Return to see results.', '可关闭页面，稍后查看结果。', 'ページを閉じても大丈夫。後で結果を確認。', '페이지를 닫아도 됩니다. 나중에 결과 확인.'),
        duration: 5000,
      })
      setWsStepByStepStatus(tr('Đang tạo câu hỏi...', 'Creating questions...', '创建题目中...', '問題作成中...', '문항 생성 중...'))
      while (true) {
        const st = await pollJobStatus(jobId)
        if (st.status === 'completed' && st.result) {
          try { localStorage.removeItem(WS_ACTIVE_JOB_KEY) } catch {}
          const r = st.result as { worksheetId?: string; worksheetMarkdown?: string; questionIds?: string[] }
          setWorksheetMarkdown(r.worksheetMarkdown ?? '')
          setWorksheetId(r.worksheetId ?? null)
          setWsStepByStepQuestionIds(r.questionIds ?? [])
          resetWorksheetEditState()
          if (r.worksheetId) {
            void triggerWorksheetVerify(r.worksheetId, curriculumMarkdown)
          }
          if (curriculumId) {
            const wsRes = await getWorksheetsByCurriculumId(curriculumId)
            if (wsRes && 'items' in wsRes) setCurriculumWorksheets(compactWorksheetList((wsRes.items ?? []) as CurriculumWorksheetListItem[]))
          }
          setWsStepByStepExpanded(true)
          setWsStepByStepSessionCounts({ quiz: {}, essay: {} })
          if (curriculumId) {
            fetch(`/api/worksheet-question-counts?curriculumId=${encodeURIComponent(curriculumId)}`)
              .then((r) => r.json())
              .then((d) => { if (d.quiz && d.essay) setWsStepByStepCounts({ quiz: d.quiz, essay: d.essay }) })
              .catch(() => {})
          }
          toast({
            title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'),
            description: tr('Phiếu bài tập đã tạo từng câu và lưu.', 'Worksheet created from individual questions and saved.', '练习已逐题创建并保存。', '1問ずつ作成して保存しました。', '문항별로 생성 후 저장했습니다.'),
            duration: 3000,
          })
          scrollToWorksheetSection()
          break
        }
        if (st.status === 'failed') {
          try { localStorage.removeItem(WS_ACTIVE_JOB_KEY) } catch {}
          toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: st.error || tr('Xử lý thất bại', 'Processing failed', '处理失败', '処理失敗', '처리 실패'), variant: 'destructive' })
          break
        }
        await new Promise((r) => setTimeout(r, 3000))
      }
    } finally {
      wsStepByStepSubmitLockRef.current = false
      setWsStepByStepLoading(false)
      setWsStepByStepStatus('')
    }
  }


  return (
    <>
      <Toaster />
      <SlideVersionDialog
        open={showSlideVersionDialog}
        onOpenChange={handleSlideVersionDialogOpenChange}
        hasPersonal={hasPersonalVersion}
        onChoose={handleSlideVersionChoose}
        tr={tr}
      />
      <Dialog open={lessonSelectOpen} onOpenChange={handleLessonSelectOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{tr('Chọn tiết để mở', 'Choose lesson to open', '选择要打开的课时', '開く授業を選択', '열 과차시 선택')}</DialogTitle>
          </DialogHeader>
          {lessonPreparingGroupId && (
            <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700/80 dark:bg-amber-950/30 dark:text-amber-200">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>
                {tr(
                  `Đang tải dữ liệu tiết ${lessonPreparingLessonNo ?? ''}. Vui lòng chờ...`,
                  `Loading lesson ${lessonPreparingLessonNo ?? ''} data. Please wait...`,
                  `正在加载第 ${lessonPreparingLessonNo ?? ''} 课时数据，请稍候...`,
                  `${lessonPreparingLessonNo ?? ''}時のデータを読み込み中です。お待ちください...`,
                  `${lessonPreparingLessonNo ?? ''}차시 데이터를 불러오는 중입니다. 잠시만 기다려 주세요...`,
                )}
              </span>
            </div>
          )}
          <div className="max-h-[56vh] space-y-2 overflow-y-auto py-1">
            {lessonGroups.map((group) => (
              <Button
                key={group.id}
                type="button"
                variant="outline"
                className="h-auto w-full justify-start border-slate-400/80 bg-slate-100 text-slate-900 hover:bg-slate-200 hover:border-slate-500 focus-visible:ring-2 focus-visible:ring-slate-500 px-3 py-2 text-left dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:hover:border-slate-500"
                onClick={() => handleLessonChoose(group.id)}
                disabled={!!lessonPreparingGroupId}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="font-semibold">
                    {tr(
                      `Tiết ${group.lessonNo}`,
                      `Lesson ${group.lessonNo}`,
                      `第 ${group.lessonNo} 课时`,
                      `第${group.lessonNo}時`,
                      `${group.lessonNo}차시`,
                    )}
                  </span>
                  <span className="text-xs text-slate-700 dark:text-slate-300">
                    {tr(
                      lessonPreparingGroupId === group.id
                        ? 'Đang tải...'
                        : `${group.indices.length} slide`,
                      lessonPreparingGroupId === group.id
                        ? 'Loading...'
                        : `${group.indices.length} slides`,
                      lessonPreparingGroupId === group.id
                        ? '加载中...'
                        : `${group.indices.length} 张幻灯片`,
                      lessonPreparingGroupId === group.id
                        ? '読み込み中...'
                        : `${group.indices.length} 枚`,
                      lessonPreparingGroupId === group.id
                        ? '불러오는 중...'
                        : `${group.indices.length} 슬라이드`,
                    )}
                  </span>
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <CurriculumExerciseListDialog
        open={exerciseListOpen}
        onOpenChange={setExerciseListOpen}
        curriculumId={curriculumId}
        tr={tr}
      />
      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-5 md:space-y-6">
        <div ref={pageHeaderRef} className="text-center">
          <h1 className="text-xl font-bold text-foreground md:text-2xl">
            {tr('Tạo giáo trình bằng AI', 'AI Curriculum Creator', 'AI 课程创建', 'AI カリキュラム作成', 'AI 교육과정 생성')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base px-1">
            {tr(
              'Chọn môn học, cấp độ, nhập chủ đề. AI tạo giáo trình chi tiết cho giáo viên.',
              'Select subject, grade level, enter topic. AI creates detailed curriculum for teachers.',
              '选择科目、年级，输入主题。AI 为教师创建详细课程。',
              '科目・学年を選択し、主題を入力。AIが教師向けの詳細カリキュラムを作成。',
              '과목, 학년 선택, 주제 입력. AI가 교사를 위한 상세 교육과정 생성.'
            )}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center max-sm:[&_button]:min-h-10 max-sm:[&_a]:min-h-10 max-sm:[&_button]:w-full max-sm:[&_a]:w-full">
            <Button
              variant={featureSection === 'create' ? 'default' : 'outline'}
              size="sm"
              className="gap-1.5"
              onClick={() => setFeatureSection('create')}
            >
              <Sparkles className="h-4 w-4" />
              {tr('Tạo giáo trình', 'Create curriculum', '创建课程', 'カリキュラム作成', '교육과정 생성')}
            </Button>
            <Button
              variant={featureSection === 'library' ? 'default' : 'outline'}
              size="sm"
              className="gap-1.5"
              onClick={() => { setFeatureSection('library'); setShowBrowse(true) }}
            >
              <FolderOpen className="h-4 w-4" />
              {tr('Giáo trình của tôi', 'My curricula', '我的课程', 'マイカリキュラム', '내 교육과정')}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <Link href="/lop">
                <Users className="h-4 w-4" />
                {tr('Lớp học', 'Classes', '班级管理', 'クラス', '학급')}
              </Link>
            </Button>
            <Button
              variant={featureSection === 'exam' ? 'default' : 'outline'}
              size="sm"
              className="gap-1.5"
              onClick={() => setFeatureSection('exam')}
            >
              <FileQuestion className="h-4 w-4" />
              {tr('Tạo bài thi', 'Create exam', '创建测验', 'テスト作成', '시험 생성')}
            </Button>
            <Button
              variant={featureSection === 'homework' ? 'default' : 'outline'}
              size="sm"
              className="gap-1.5"
              onClick={() => setFeatureSection('homework')}
            >
              <NotebookPen className="h-4 w-4" />
              {tr('Tạo bài tập về nhà', 'Create homework', '创建家庭作业', '宿題を作成', '숙제 만들기')}
            </Button>
          </div>
        </div>

        {featureSection === 'library' && (
        <Card className="border shadow-sm border-slate-200/80 dark:border-slate-700/50">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-violet-600" />
                {tr('Kho giáo trình', 'Curriculum library', '课程库', 'カリキュラムライブラリ', '교육과정 라이브러리')}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowBrowse(!showBrowse)}>
                {showBrowse ? tr('Thu gọn', 'Collapse', '收起', '閉じる', '접기') : tr('Xem kho', 'Browse library', '浏览库', 'ライブラリを見る', '라이브러리 보기')}
              </Button>
            </div>
            <CardDescription className="text-xs">
              {tr('Danh sách đầy đủ giáo trình. Lọc theo môn học và lớp bên dưới. Mỗi giáo trình gồm: nội dung, phiếu bài tập, slide bài giảng.', 'Full curriculum list. Filter by subject and grade below. Each curriculum includes: content, worksheets, slides.', '完整课程列表。下方按科目和年级筛选。每个课程包含：内容、练习、幻灯片。', '全カリキュラム一覧。下で科目・学年でフィルター。各カリキュラムに：内容・ワークシート・スライド。', '전체 교육과정 목록. 아래에서 과목·학년으로 필터. 각 교육과정: 내용·워크시트·슬라이드.')}
            </CardDescription>
          </CardHeader>
          {showBrowse && (
            <CardContent className="pt-0 space-y-4">
              {browseLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-8 w-8 text-violet-500 animate-spin" />
                </div>
              ) : (
                <div>
                  <div className="flex flex-wrap gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                        {tr('Lọc môn', 'Filter subject', '筛选科目', '科目でフィルター', '과목 필터')}:
                      </label>
                      <select
                        value={browseSubjectFilter}
                        onChange={(e) => setBrowseSubjectFilter(e.target.value)}
                        className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs min-w-[120px]"
                      >
                        <option value="">{tr('Tất cả', 'All', '全部', 'すべて', '전체')}</option>
                        {SUBJECTS.map((s) => (
                          <option key={s.id} value={s.id}>
                            {uiLocale === 'en' ? s.labelEn : s.labelVi}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                        {tr('Lọc lớp', 'Filter grade', '筛选年级', '学年でフィルター', '학년 필터')}:
                      </label>
                      <select
                        value={browseGradeFilter}
                        onChange={(e) => setBrowseGradeFilter(e.target.value)}
                        className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs min-w-[120px]"
                      >
                        <option value="">{tr('Tất cả', 'All', '全部', 'すべて', '전체')}</option>
                        {GRADE_LEVEL_GROUPS.map((grp) => (
                          <optgroup key={grp.labelVi} label={uiLocale === 'en' ? grp.labelEn : grp.labelVi}>
                            {grp.ids.map((id) => {
                              const g = GRADE_LEVELS.find((x) => x.id === id)
                              return g ? <option key={g.id} value={g.id}>{uiLocale === 'en' ? g.labelEn : g.labelVi}</option> : null
                            })}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5" />
                    {tr('Giáo trình', 'Curricula', '课程', 'カリキュラム', '교육과정')} ({curriculaList.length})
                    {(browseSubjectFilter || browseGradeFilter) && (
                      <span className="text-muted-foreground/80">
                        — {tr('đang lọc', 'filtered', '已筛选', 'フィルター中', '필터됨')}
                      </span>
                    )}
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-1 rounded border p-2 bg-slate-50/50 dark:bg-slate-900/30">
                    {curriculaList.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">
                        {browseSubjectFilter || browseGradeFilter
                          ? tr('Không có giáo trình phù hợp bộ lọc. Thử bỏ lọc hoặc tạo mới.', 'No curricula match filter. Try removing filter or create new.', '没有符合筛选的课程。尝试移除筛选或新建。', 'フィルターに一致するカリキュラムがありません。', '필터에 맞는 교육과정 없음. 필터 해제 또는 새로 만들기.')
                          : tr('Chưa có giáo trình nào. Tạo mới bên dưới.', 'No curricula yet. Create new below.', '暂无课程。在下方新建。', 'カリキュラムがありません。下で新規作成。', '교육과정이 없습니다. 아래에서 새로 만들기.')}
                      </p>
                    ) : (
                      curriculaList.map((c) => (
                        <div
                          key={c.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => void handleLoadCurriculum(c.id)}
                          onKeyDown={(e) => e.key === 'Enter' && void handleLoadCurriculum(c.id)}
                          className="flex items-center gap-2 group cursor-pointer rounded hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
                        >
                          <div className="flex-1 min-w-0 text-left text-sm px-2 py-1.5">
                            <span className="font-medium truncate block">{c.topic}</span>
                            <span className="text-xs text-muted-foreground block">
                              {c.subject_id} · {c.grade_level_id}
                              {c.created_at && (
                                <span className="ml-1.5">· {formatCreatedAt(c.created_at)}</span>
                              )}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 opacity-60 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleDeleteCurriculum(e, c.id)
                            }}
                            disabled={deleteLoadingId === c.id}
                            title={tr('Xóa giáo trình', 'Delete curriculum', '删除课程', 'カリキュラムを削除', '교육과정 삭제')}
                          >
                            {deleteLoadingId === c.id ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
        )}

        {featureSection === 'create' && step === 'INPUT' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-violet-600" />
                {tr('Thông tin giáo trình', 'Curriculum info', '课程信息', 'カリキュラム情報', '교육과정 정보')}
              </CardTitle>
              <CardDescription>
                {tr('Chọn môn, lớp. Tạo theo SGK (gửi ảnh sách) hoặc theo chủ đề. AI tạo giáo trình Markdown.', 'Select subject, grade. Create by textbook (upload book images) or by topic. AI generates Markdown curriculum.', '选择科目、年级。按教材（上传教材图片）或主题创建。AI 生成 Markdown 课程。', '科目・学年を選択。教科書（画像アップロード）・主題で作成。AIがMarkdownカリキュラムを生成。', '과목·학년 선택. 교과서(이미지 업로드)·주제로 생성. AI가 Markdown 교육과정 생성.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Cách tạo', 'Create mode', '创建方式', '作成方法', '생성 방식')}</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="createMode"
                      checked={createMode === 'textbook'}
                      onChange={() => {
                        setCreateMode('textbook')
                        setSimilarTopicCurricula([])
                        if (textbookSetId === 'khac') {
                          setTextbookSetId('ket-noi-tri-thuc')
                          setBookIsbn('')
                        }
                      }}
                      className="rounded-full border-input"
                    />
                    <span className="text-sm">{tr('Theo SGK (bài số)', 'By textbook (lesson #)', '按教材（课号）', '教科書（課番号）', '교과서(차시)')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="createMode"
                      checked={createMode === 'topic'}
                      onChange={() => {
                        setCreateMode('topic')
                        setTextbookSetId('khac')
                        setSimilarTopicCurricula([])
                        setBookIsbn('')
                        setLessonImages([])
                      }}
                      className="rounded-full border-input"
                    />
                    <span className="text-sm">{tr('Theo chủ đề', 'By topic', '按主题', '主題で', '주제로')}</span>
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {createMode === 'textbook'
                    ? tr('Chọn bộ sách, nhập bài số. Gửi ảnh trang sách (bắt buộc) – AI lấy sơ đồ, hình minh họa từ ảnh.', 'Select textbook set, enter lesson #. Upload page image (required) – AI extracts diagrams, figures from images.', '选择教材、输入课号。上传教材页面（必填）– AI 从图片提取图表、示意图。', '教科書・課番号を入力。ページ画像をアップロード（必須）– AIが画像から図表を抽出。', '교과서·차시 입력. 페이지 이미지 업로드 (필수) – AI가 이미지에서 도표·그림 추출.')
                    : tr('Chỉ cần nhập chủ đề. Không cần bài số hay ảnh. Có thể gửi ảnh để AI bám sát hơn.', 'Just enter topic. No lesson # or image required. Optional: upload image for better accuracy.', '只需输入主题。无需课号或图片。可选：上传图片提高准确性。', '主題のみ入力。課番号・画像不要。任意：画像で精度向上。', '주제만 입력. 차시·이미지 불필요. 선택: 이미지로 정확도 향상.')}
                </p>
              </div>
              {createMode === 'topic' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    {tr('Chủ đề', 'Topic', '主题', '主題', '주제')} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    placeholder={tr('Ví dụ: Nguyên hàm, Tích phân, Phương trình bậc hai...', 'e.g. Antiderivative, Integral, Quadratic equation...', '例如：原函数、积分、一元二次方程...', '例：原始関数、積分、二次方程式...', '예: 부정적분, 적분, 이차방정식...')}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="bg-white/80"
                  />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Môn học', 'Subject', '科目', '科目', '과목')}</label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    {SUBJECTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {uiLocale === 'en' ? s.labelEn : s.labelVi}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Cấp độ', 'Grade level', '年级', '学年', '학년')}</label>
                  <select
                    value={gradeLevelId}
                    onChange={(e) => setGradeLevelId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    {GRADE_LEVEL_GROUPS.map((grp) => (
                      <optgroup key={grp.labelVi} label={uiLocale === 'en' ? grp.labelEn : grp.labelVi}>
                        {grp.ids.map((id) => {
                          const g = GRADE_LEVELS.find((x) => x.id === id)
                          return g ? <option key={g.id} value={g.id}>{uiLocale === 'en' ? g.labelEn : g.labelVi}</option> : null
                        })}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>
              {createMode === 'textbook' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Bộ sách giáo khoa', 'Textbook set', '教材', '教科書', '교과서')}</label>
                  <select
                    value={textbookSetId}
                    onChange={(e) => {
                      const next = e.target.value
                      setTextbookSetId(next)
                      if (next !== 'khac') setBookIsbn('')
                    }}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    {TEXTBOOK_SETS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {uiLocale === 'en' ? t.labelEn : t.labelVi}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {createMode === 'textbook' && textbookSetId === 'khac' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    {tr('ISBN sách', 'Book ISBN', '教材 ISBN', '教科書 ISBN', '교과서 ISBN')} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    placeholder={tr('Nhập ISBN-10 hoặc ISBN-13', 'Enter ISBN-10 or ISBN-13', '请输入 ISBN-10 或 ISBN-13', 'ISBN-10 または ISBN-13 を入力', 'ISBN-10 또는 ISBN-13 입력')}
                    value={bookIsbn}
                    onChange={(e) => setBookIsbn(e.target.value)}
                    className="w-full h-9 bg-white/80"
                  />
                  <p className="text-xs text-muted-foreground">
                    {tr('Bắt buộc để đối chiếu đúng sách trong DB, tránh gộp nhầm sách khác nhau.', 'Required for accurate DB matching, to avoid mixing different books.', '用于准确匹配数据库教材，避免不同教材被误判为同一教材。', 'DBで正確に照合し、別教材の誤統合を防ぐため必須です。', 'DB 정확 매칭을 위해 필수이며, 다른 교재가 합쳐지는 것을 방지합니다.')}
                  </p>
                </div>
              )}
              {createMode === 'textbook' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    {tr('Bài số', 'Lesson number', '课号', '課番号', '차시 번호')} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    placeholder={tr('Nhập số bài (ví dụ: 1, 2, 3...)', 'Enter lesson number (e.g. 1, 2, 3...)', '输入课号（如：1、2、3...）', '課番号を入力（例：1、2、3...）', '차시 번호 입력 (예: 1, 2, 3...)')}
                    value={lessonNumber}
                    onChange={(e) => setLessonNumber(e.target.value)}
                    className="w-24 h-9 bg-white/80"
                  />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Số tiết (1–10)', 'Lessons (1–10)', '课时 (1–10)', '時限 (1–10)', '차시 (1–10)')}</label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={numLessons}
                    onChange={(e) => setNumLessons(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                    className="w-24 bg-white/80"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Thời gian mỗi tiết', 'Duration per lesson', '每课时长', '1時限の時間', '차시당 시간')}</label>
                  <select
                    value={lessonDurationMinutes}
                    onChange={(e) => setLessonDurationMinutes(parseInt(e.target.value, 10))}
                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm bg-white/80"
                  >
                    <option value={35}>35 {tr('phút', 'min', '分钟', '分', '분')}</option>
                    <option value={40}>40 {tr('phút', 'min', '分钟', '分', '분')}</option>
                    <option value={45}>45 {tr('phút', 'min', '分钟', '分', '분')}</option>
                    <option value={60}>60 {tr('phút', 'min', '分钟', '分', '분')}</option>
                    <option value={90}>90 {tr('phút', 'min', '分钟', '分', '분')}</option>
                  </select>
                </div>
              </div>
              {createMode === 'topic' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Mục tiêu bổ sung (tùy chọn)', 'Additional goals (optional)', '补充目标（可选）', '追加目標（任意）', '추가 목표 (선택)')}</label>
                  <Textarea
                    placeholder={tr('Mô tả mục tiêu, yêu cầu đặc biệt...', 'Describe goals, special requirements...', '描述目标、特殊要求...', '目標・特別な要件を記述...', '목표, 특별 요구사항 설명...')}
                    value={goals}
                    onChange={(e) => setGoals(e.target.value)}
                    className="bg-white/80 min-h-[80px] resize-y"
                  />
                </div>
              )}
              {curriculumExists === true && existingCurriculumTopic && createMode === 'textbook' && (
                <div className="space-y-2 rounded-lg border border-emerald-300 dark:border-emerald-700 p-4 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                    {tr('Bài học có sẵn:', 'Lesson available:', '已有课程：', 'レッスンあり：', '수업 있음:')}
                  </p>
                  <p className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
                    {existingCurriculumTopic}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tr('Nếu tên bài khớp, mở bản có sẵn. Nếu không khớp, gửi ảnh rồi bấm "Tạo lại giáo trình (ghi đè)".', 'If lesson title matches, open existing. If not, upload image and click "Recreate curriculum (overwrite)".', '若课名匹配，请打开已有课程；若不匹配，请上传图片后点击“重建课程（覆盖）”。', '題名が一致すれば既存を開き、不一致なら画像をアップロードして「再作成（上書き）」を押してください。', '제목이 맞으면 기존을 열고, 맞지 않으면 이미지 업로드 후 "다시 만들기(덮어쓰기)"를 누르세요.')}
                  </p>
                </div>
              )}
              {createMode === 'topic' && similarTopicCurricula.length > 0 && (
                <div className="space-y-2 rounded-lg border border-amber-300 dark:border-amber-700 p-4 bg-amber-50/60 dark:bg-amber-950/20">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    {tr('Có giáo trình gần giống chủ đề này:', 'Similar curricula found for this topic:', '发现与该主题相近的课程：', 'この主題に近いカリキュラムがあります：', '이 주제와 유사한 교육과정이 있습니다:')}
                  </p>
                  <div className="space-y-1">
                    {similarTopicCurricula.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void handleLoadCurriculum(item.id)}
                        className="w-full text-left text-sm rounded border border-amber-200 dark:border-amber-800 bg-white/80 dark:bg-slate-900/50 px-3 py-2 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                      >
                        <div className="font-medium truncate">{item.topic}</div>
                        <div className="text-xs text-muted-foreground">
                          {tr('Độ gần:', 'Similarity:', '相似度：', '類似度：', '유사도:')} {Math.round(item.score * 100)}%
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tr('Bạn có thể mở giáo trình gần giống để dùng ngay, hoặc vẫn bấm "Tạo giáo trình" để tạo mới.', 'You can open a similar curriculum now, or still click "Create curriculum" to create a new one.', '您可以先打开相近课程，或继续点击“创建课程”新建。', '近いカリキュラムを開くか、そのまま「作成」を押して新規作成できます。', '유사 교육과정을 열거나, 그대로 "교육과정 생성"으로 새로 만들 수 있습니다.')}
                  </p>
                </div>
              )}
              {createMode === 'textbook' && (
              <div className="space-y-2 rounded-lg border border-dashed border-violet-300 dark:border-violet-700 p-4 bg-violet-50/50 dark:bg-violet-950/20">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <ImageIcon className="h-4 w-4" />
                  {tr('Gửi ảnh bài học', 'Upload lesson image', '上传课程图片', '授業画像をアップロード', '수업 이미지 업로드')}
                  <span className="text-red-500 font-medium">*</span>
                </label>
                <p className="text-xs text-muted-foreground">
                  {tr('Chụp/gửi ảnh trang sách (tối đa 20 ảnh) – bắt buộc. AI lấy sơ đồ, hình minh họa từ ảnh.', 'Upload photo(s) of the textbook page(s) (max 20) – required. AI extracts diagrams, figures from images.', '上传教材页面照片（最多20张）– 必填。AI 从图片提取图表、示意图。', '教科書のページ写真をアップロード（最大20枚）– 必須。AIが画像から図表を抽出。', '교과서 페이지 사진 업로드 (최대 20개) – 필수. AI가 이미지에서 도표·그림 추출.')}
                </p>
                <input
                  ref={lessonImageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const list = Array.from(e.target.files ?? [])
                    setLessonImages(list.slice(0, MAX_CURRICULUM_LESSON_IMAGES))
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => lessonImageInputRef.current?.click()}
                  className="border-violet-400 text-violet-700 hover:bg-violet-100 dark:border-violet-600 dark:text-violet-300"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {lessonImages.length > 0
                    ? `${tr('Đã chọn', 'Selected', '已选', '選択済み', '선택됨')} ${lessonImages.length} ${tr('ảnh', 'image(s)', '张图片', '枚の画像', '개 이미지')}`
                    : tr('Chọn ảnh, có thể nhiều', 'Choose image(s)', '选择图片（可多选）', '画像を選択（複数可）', '이미지 선택 여러 개')}
                </Button>
                {lessonImages.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClearLessonImages}
                    className="ml-2"
                  >
                    {tr('Xóa ảnh đã chọn', 'Clear selected images', '清除已选图片', '選択画像をクリア', '선택 이미지 지우기')}
                  </Button>
                )}
                {lessonImages.length > 0 && (
                  <ul className="text-xs text-muted-foreground mt-2 space-y-1 max-h-24 overflow-y-auto">
                    {lessonImages.map((f, i) => (
                      <li key={i} className="flex items-center justify-between gap-2">
                        <span className="truncate">• {f.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveLessonImage(i)}
                          className="shrink-0 text-red-600 hover:text-red-700"
                        >
                          {tr('Xóa', 'Remove', '删除', '削除', '삭제')}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              )}
              {createMode === 'textbook' && curriculumExists === true && (
                <p className="w-full text-sm text-red-600 dark:text-red-400">
                  {tr('Nếu tên bài khớp, mở bản có sẵn. Nếu không khớp, gửi ảnh rồi bấm "Tạo lại giáo trình (ghi đè)".', 'If lesson title matches, open existing. If not, upload image then click "Recreate curriculum (overwrite)".', '若课名匹配，请打开已有课程；若不匹配，请上传图片后点击“重建课程（覆盖）”。', '題名が一致すれば既存を開き、不一致なら画像をアップロードして「再作成（上書き）」を押してください。', '제목이 맞으면 기존을 열고, 맞지 않으면 이미지를 업로드한 뒤 "다시 만들기(덮어쓰기)"를 누르세요.')}
                </p>
              )}
              {createMode === 'textbook' && curriculumExists === true ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleOpenExistingCurriculum()}
                    disabled={openExistingLoading}
                    className="w-full border-violet-400 text-violet-700 hover:bg-violet-100 dark:border-violet-600 dark:text-violet-300"
                  >
                    {openExistingLoading
                      ? tr('Đang mở...', 'Opening...', '正在打开...', '読み込み中...', '여는 중...')
                      : tr('Mở giáo trình có sẵn', 'Open existing curriculum', '打开已有课程', '既存カリキュラムを開く', '기존 교육과정 열기')}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleOverwriteFromExisting()}
                    disabled={overwriteFromExistingLoading || (step as Step) === 'GENERATING' || lessonImages.length === 0}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {overwriteFromExistingLoading
                      ? tr('Đang tạo lại...', 'Recreating...', '正在重建...', '再作成中...', '다시 만드는 중...')
                      : (
                        <>
                          {tr('Tạo lại giáo trình (ghi đè)', 'Recreate curriculum (overwrite)', '重建课程（覆盖）', 'カリキュラム再作成（上書き）', '교육과정 다시 만들기(덮어쓰기)')}
                          {creditLabel(CURRICULUM_UI_CREDITS.createOrFromImage)}
                        </>
                      )}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={
                    (step as Step) === 'GENERATING' ||
                    overwriteFromExistingLoading ||
                    (createMode === 'topic'
                      ? !topic.trim() || topic.trim().length < 2
                      : checkLoading || lessonImages.length === 0 || (textbookSetId === 'khac' && !bookIsbn.trim()))
                  }
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {createMode === 'topic' ? (
                    <>
                      {tr('Tạo giáo trình', 'Create curriculum', '创建课程', 'カリキュラムを作成', '교육과정 생성')}
                      {creditLabel(CURRICULUM_UI_CREDITS.createOrFromImage)}
                    </>
                  ) : checkLoading ? (
                    tr('Đang kiểm tra...', 'Checking...', '正在检查...', '確認中...', '확인 중...')
                  ) : (
                    <>
                      {tr('Tạo giáo trình', 'Create curriculum', '创建课程', 'カリキュラムを作成', '교육과정 생성')}
                      {creditLabel(CURRICULUM_UI_CREDITS.createOrFromImage)}
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {featureSection === 'create' && (
        <div ref={curriculumResultRef}>
        {step === 'GENERATING' && (
          <AIProgressLoader
            title={tr('AI đang tạo giáo trình', 'AI is creating curriculum', 'AI 正在创建课程', 'AIがカリキュラムを作成中', 'AI가 교육과정 생성 중')}
            description={tr('Hệ thống đang xử lý tự động. Kết quả sẽ xuất hiện ngay khi sẵn sàng.', 'The system is processing automatically. Result will appear when ready.', '系统正在自动处理。结果准备好后将立即显示。', 'システムが自動処理中です。準備ができ次第結果を表示します。', '시스템이 자동 처리 중입니다. 준비되면 결과가 표시됩니다.')}
          />
        )}

        {(wsStepByStepLoading || sgkLoading) && step === 'RESULT' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="w-full max-w-lg px-4">
              {sgkLoading && (
                <AIProgressLoader
                  title={tr('Đang tách câu trắc nghiệm + tự luận từ ảnh SGK', 'Extracting quiz + essay from SGK images', '正在从教材图片提取选择题+主观题', 'SGK画像から選択式+記述式を抽出中', 'SGK 이미지에서 객관식+서술형 추출 중')}
                  description={tr('AI đang đọc ảnh và tách từng câu. Vui lòng chờ.', 'AI is reading images and extracting each question. Please wait.', 'AI正在读取图片并逐题提取。请稍候。', 'AIが画像を読み1問ずつ抽出中です。お待ちください。', 'AI가 이미지를 읽고 문항별 추출 중입니다. 잠시만 기다려 주세요.')}
                />
              )}
              {wsStepByStepLoading && !sgkLoading && (
                <AIProgressLoader
                  title={tr('Đang tạo phiếu từng câu', 'Creating worksheet per question', '逐题创建练习', '1問ずつ作成中', '문항별 생성 중')}
                  description={tr('AI đang tạo và kiểm tra từng câu. Vui lòng chờ.', 'AI is creating and verifying each question. Please wait.', 'AI正在逐题创建并验证。请稍候。', 'AIが1問ずつ作成・検証中です。お待ちください。', 'AI가 문항별로 생성 및 검증 중입니다. 잠시만 기다려 주세요.')}
                  customStatus={wsStepByStepStatus || undefined}
                />
              )}
            </div>
          </div>
        )}

        {step === 'RESULT' && (curriculumMarkdown || worksheetMarkdown) && (
          <>
            {curriculumMarkdown && (
            <Card className="border shadow-sm overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {tr('Giáo trình đã tạo', 'Generated curriculum', '已创建课程', '作成したカリキュラム', '생성된 교육과정')}
                  {lastOverwriteAt && (
                    <span className="text-xs font-normal text-amber-700 dark:text-amber-300">
                      {tr('Đã cập nhật từ ảnh', 'Updated from image', '已由图片更新', '画像から更新済み', '이미지로 업데이트됨')}
                    </span>
                  )}
                  {autoSaveStatus === 'saving' && (
                    <span className="text-xs font-normal text-muted-foreground animate-pulse">
                      {tr('Đang lưu...', 'Saving...', '保存中...', '保存中...', '저장 중...')}
                    </span>
                  )}
                  {autoSaveStatus === 'saved' && (
                    <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                      {tr('Đã lưu', 'Saved', '已保存', '保存済み', '저장됨')}
                    </span>
                  )}
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> {tr('Sao chép', 'Copy', '复制', 'コピー', '복사')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <FileDown className="h-3.5 w-3.5 mr-1" /> {tr('Tải .md', 'Download .md', '下载 .md', '.md をダウンロード', '.md 다운로드')}
                  </Button>
                  {!curriculumId && (
                    <Button variant="outline" size="sm" onClick={() => void handleSaveCurriculum()} disabled={saveCurriculumLoading} className="border-emerald-400 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-600 dark:text-emerald-300">
                      {saveCurriculumLoading ? tr('Đang lưu...', 'Saving...', '保存中...', '保存中...', '저장 중...') : tr('Lưu vào kho', 'Save to library', '保存到库', 'ライブラリに保存', '라이브러리에 저장')}
                    </Button>
                  )}
                  {curriculumId && !curriculumEditMode && (
                    <Button variant="outline" size="sm" onClick={() => { setCurriculumEditMode(true); setEditOriginalText(''); setEditEditedText(''); setEditMatchStatus('idle'); setEditMatchCount(0); setEditCompareResult(null); setEditCompareErrors([]); setRegionPreview(null); setRegionCharCount(null); setRegionCompareResult(null); setRegionCheckErrors([]) }} className="border-amber-400 text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-300">
                      {tr('Sửa giáo trình', 'Edit curriculum', '编辑课程', '教材を編集', '교육과정 편집')}
                    </Button>
                  )}
                  {curriculumEditMode && (
                    <Button variant="ghost" size="sm" onClick={() => { setCurriculumEditMode(false); setEditOriginalText(''); setEditEditedText(''); setEditMatchStatus('idle'); setEditMatchCount(0); setEditCompareResult(null); setEditCompareErrors([]) }}>
                      {tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => void handleOpenSlides()} disabled={slideAnalysisLoading} className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-950/30">
                    <Presentation className="h-3.5 w-3.5 mr-1" />
                    {slideAnalysisLoading
                      ? tr('Đang tải dữ liệu chọn tiết/bản...', 'Loading lesson/version options...', '正在加载课时/版本选项...', '授業/版の選択肢を読み込み中...', '차시/버전 선택 항목 로딩 중...')
                      : tr('Xem slide giáo trình', 'View curriculum slides', '查看课程幻灯片', '授業スライドを表示', '교과 슬라이드 보기')}
                  </Button>
                  {(worksheetMarkdown || curriculumWorksheets.length > 0) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-emerald-400 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-600 dark:text-emerald-300 dark:hover:bg-emerald-950/30 gap-1"
                        >
                          <ListChecks className="h-3.5 w-3.5 shrink-0" />
                          {tr('Xem danh sách bài tập', 'View exercise list', '查看习题列表', '演習一覧', '문제 목록 보기')}
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="z-[1000] max-w-[min(100vw-2rem,22rem)]">
                        <DropdownMenuItem
                          className="cursor-pointer whitespace-normal"
                          onClick={() => {
                            const targetWorksheetId = worksheetId ?? curriculumWorksheets[0]?.id
                            if (!targetWorksheetId) {
                              toast({
                                title: tr('Chưa có phiếu bài tập đã lưu', 'No saved worksheet yet', '尚无已保存的练习', '保存済みワークシートがありません', '저장된 워크시트 없음'),
                                description: tr(
                                  'Lưu phiếu bài tập (vào kho giáo trình) để mở trang xem đầy đủ như /phieu-bai-tap.',
                                  'Save the worksheet to your curriculum to open the full view page like /phieu-bai-tap.',
                                  '请将练习保存到课程，以打开与 /phieu-bai-tap 相同的完整页面。',
                                  'カリキュラムにワークシートを保存すると、/phieu-bai-tap と同じ全体表示ページを開けます。',
                                  '워크시트를 교육과정에 저장하면 /phieu-bai-tap 과 같은 전체 보기 페이지를 열 수 있습니다.',
                                ),
                                duration: 6000,
                              })
                              return
                            }
                            window.open(`${window.location.origin}/phieu-bai-tap/${targetWorksheetId}`, '_blank', 'noopener,noreferrer')
                          }}
                        >
                          {tr(
                            'Xem và tạo slide tất cả bài tập',
                            'View and create slides for all exercises',
                            '查看并为所有习题创建幻灯片',
                            'すべての演習を表示してスライドを作成',
                            '모든 문제 보고 슬라이드 만들기',
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer whitespace-normal"
                          onClick={() => {
                            if (!curriculumId) {
                              toast({
                                title: tr('Cần lưu giáo trình', 'Save curriculum first', '请先保存课程', '先に保存', '교육과정 저장 필요'),
                                description: tr(
                                  'Lưu giáo trình vào kho để xem danh sách câu hỏi và tạo slide chữa bài.',
                                  'Save to the library to load questions and build review slides.',
                                  '保存到库后可查看题目并生成讲评幻灯片。',
                                  'ライブラリに保存すると設問一覧と解説スライド作成ができます。',
                                  '라이브러리에 저장하면 문항 목록과 해설 슬라이드를 만들 수 있습니다.',
                                ),
                                duration: 5000,
                              })
                              return
                            }
                            setExerciseListOpen(true)
                          }}
                        >
                          {tr(
                            'Xem và chọn những bài tập để tạo slide',
                            'View list and pick exercises to create slides',
                            '查看列表并选择要生成幻灯片的习题',
                            '一覧を表示しスライド用の演習を選択',
                            '목록 보기 및 슬라이드에 쓸 문제 선택',
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSgkExpanded(!sgkExpanded)}
                    disabled={sgkLoading || wsStepByStepLoading}
                    className="border-amber-400 text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-300"
                  >
                    <BookOpen className="h-3.5 w-3.5 mr-1" />
                    {tr('Tạo phiếu bài tập từ ảnh SGK', 'Create worksheet from SGK images', '从教材图片创建练习', 'SGK画像からワークシート作成', 'SGK 이미지로 워크시트 생성')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWsStepByStepExpanded(!wsStepByStepExpanded)}
                    disabled={wsStepByStepLoading || sgkLoading}
                    className="border-violet-400 text-violet-700 hover:bg-violet-50 dark:border-violet-600 dark:text-violet-300"
                  >
                    <FileQuestion className="h-3.5 w-3.5 mr-1" />
                    {tr('Tạo từng câu', 'Create per question', '逐题创建', '1問ずつ作成', '문항별 생성')}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleReset}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-md"
                  >
                    {tr('Tạo giáo trình mới', 'Create new curriculum', '创建新课程', '新規カリキュラム作成', '새 교육과정 만들기')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {sgkExpanded && curriculumMarkdown && (
                  <div className="mb-4 p-4 rounded-lg border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                    <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      {tr('Tạo phiếu bài tập từ ảnh SGK', 'Create worksheet from SGK images', '从教材图片创建练习', 'SGK画像からワークシート作成', 'SGK 이미지로 워크시트 생성')}
                    </h4>
                    <p className="text-xs text-amber-700/90 dark:text-amber-300/90 mb-3">
                      {tr('Chọn ảnh trang bài tập SGK. AI tách câu trắc nghiệm + tự luận (có đáp án), thêm vào phiếu. Không giới hạn số câu.', 'Select SGK exercise page images. AI extracts quiz + essay questions (with answers), adds to worksheet. No limit.', '选择教材练习页图片。AI 提取选择题+主观题（含答案），添加到练习。无限制。', 'SGKの練習ページ画像を選択。AIが選択式+記述式（解答付き）を抽出して追加。制限なし。', 'SGK 연습 페이지 이미지 선택. AI가 객관식+서술형(정답 포함) 추출·추가. 제한 없음.')}
                    </p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <input
                        ref={sgkInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? [])
                          setSgkImages((prev) => [...prev, ...files].slice(0, 10))
                        }}
                      />
                      <Button variant="outline" size="sm" onClick={() => sgkInputRef.current?.click()} disabled={sgkLoading} className="border-amber-500">
                        <Upload className="h-3.5 w-3.5 mr-1" />
                        {tr('Chọn ảnh', 'Select images', '选择图片', '画像を選択', '이미지 선택')}
                      </Button>
                      {sgkImages.length > 0 && (
                        <span className="text-xs text-amber-700 dark:text-amber-300">
                          {sgkImages.length} {tr('ảnh', 'images', '张图片', '枚', '개')}
                          <button
                            type="button"
                            onClick={() => {
                              setSgkImages([])
                              if (sgkInputRef.current) sgkInputRef.current.value = ''
                            }}
                            className="ml-1 text-amber-600 hover:underline"
                          >
                            {tr('Xóa', 'Clear', '清除', 'クリア', '지우기')}
                          </button>
                        </span>
                      )}
                      <Button size="sm" onClick={() => void handleParseSgk()} disabled={sgkLoading || sgkImages.length === 0} className="bg-amber-600 hover:bg-amber-700">
                        {sgkLoading ? (
                          tr('Đang tách...', 'Extracting...', '提取中...', '抽出中...', '추출 중...')
                        ) : (
                          <>
                            {tr('Tách và thêm vào phiếu', 'Extract and add to worksheet', '提取并添加到练习', '抽出して追加', '추출 후 추가')}
                            {creditLabel(CURRICULUM_UI_CREDITS.sgkExtractJob)}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                {wsStepByStepExpanded && curriculumMarkdown && (() => {
                  const QUIZ_LIMIT = 10
                  const ESSAY_LIMIT = 6
                  const quizTotal: Record<string, number> = { easy: 0, medium: 0, hard: 0 }
                  const essayTotal: Record<string, number> = { 'nhan-biet': 0, 'thong-hieu': 0, 'van-dung-thap': 0, 'van-dung-cao': 0, 'thuc-te': 0 }
                  for (const d of ['easy', 'medium', 'hard']) {
                    quizTotal[d] = (wsStepByStepCounts?.quiz?.[d] ?? 0) + (wsStepByStepSessionCounts.quiz?.[d] ?? 0)
                  }
                  for (const d of ['nhan-biet', 'thong-hieu', 'van-dung-thap', 'van-dung-cao', 'thuc-te']) {
                    essayTotal[d] = (wsStepByStepCounts?.essay?.[d] ?? 0) + (wsStepByStepSessionCounts.essay?.[d] ?? 0)
                  }
                  const quizAvailable = (['easy', 'medium', 'hard'] as const).filter((d) => quizTotal[d] < QUIZ_LIMIT)
                  const essayAvailable = (['nhan-biet', 'thong-hieu', 'van-dung-thap', 'van-dung-cao', 'thuc-te'] as const).filter((d) => essayTotal[d] < ESSAY_LIMIT)
                  const quizSlotsLeft = quizAvailable.includes(wsStepByStepQuizDiff) ? QUIZ_LIMIT - quizTotal[wsStepByStepQuizDiff] : 0
                  const essaySlotsLeft = essayAvailable.includes(wsStepByStepEssayBloom) ? ESSAY_LIMIT - essayTotal[wsStepByStepEssayBloom] : 0
                  const quizCountMax = Math.min(20, quizSlotsLeft)
                  const essayCountMax = Math.min(10, essaySlotsLeft)
                  const quizCountVal = Math.min(wsStepByStepQuizCount, quizCountMax)
                  const essayCountVal = Math.min(wsStepByStepEssayCount, essayCountMax)
                  const quizLabels: Record<string, string> = { easy: tr('Dễ', 'Easy', '简单', '易', '쉬움'), medium: tr('Trung bình', 'Medium', '中等', '中', '보통'), hard: tr('Khó', 'Hard', '困难', '難', '어려움') }
                  const essayLabels: Record<string, string> = { 'nhan-biet': tr('Nhận biết', 'Recall', '识记', '知識', '인지'), 'thong-hieu': tr('Thông hiểu', 'Understand', '理解', '理解', '이해'), 'van-dung-thap': tr('Vận dụng thấp', 'Apply (low)', '应用（低）', '応用（低）', '적용(하)'), 'van-dung-cao': tr('Vận dụng cao', 'Apply (high)', '应用（高）', '応用（高）', '적용(상)'), 'thuc-te': tr('Thực tế', 'Real-world', '实际', '実践', '실전') }
                  return (
                  <div className="mb-4 space-y-3">
                    <p className="text-xs text-violet-600/90 dark:text-violet-400/90">
                      {tr('AI tạo từng câu, kiểm tra từng câu. Chất lượng cao hơn.', 'AI creates each question, verifies each. Higher quality.', 'AI逐题创建并逐题验证。质量更高。', 'AIが1問ずつ作成・検証。品質更高。', 'AI가 문항별 생성·검증. 품질 더 높음.')}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-4 rounded-lg border-2 border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20">
                        <h4 className="text-sm font-semibold text-violet-800 dark:text-violet-200 mb-2">
                          {tr('Trắc nghiệm', 'Quiz', '选择题', 'クイズ', '퀴즈')}
                        </h4>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div>
                            <label className="text-xs font-medium block mb-1">{tr('Số câu', 'Count', '数量', '数', '수')}</label>
                            <Input type="number" min={0} max={quizCountMax} value={quizCountVal} onChange={(e) => setWsStepByStepQuizCount(Math.min(Number(e.target.value) || 0, quizCountMax))} className="h-8" disabled={quizAvailable.length === 0} />
                          </div>
                          <div>
                            <label className="text-xs font-medium block mb-1">{tr('Độ khó', 'Difficulty', '难度', '難易度', '난이도')}</label>
                            <select value={quizAvailable.includes(wsStepByStepQuizDiff) ? wsStepByStepQuizDiff : (quizAvailable[0] ?? 'medium')} onChange={(e) => setWsStepByStepQuizDiff((quizAvailable.includes(e.target.value as 'easy'|'medium'|'hard') ? e.target.value : quizAvailable[0]) as 'easy'|'medium'|'hard')} className="h-8 w-full rounded-md border px-2 text-sm bg-background" disabled={quizAvailable.length === 0}>
                              {quizAvailable.length === 0 ? <option>{tr('Đã đủ 10/10 mỗi loại', 'All types full (10/10)', '各类已满10/10', '各10/10で満了', '각 10/10 완료')}</option> : quizAvailable.map((d) => <option key={d} value={d}>{quizLabels[d]} ({quizTotal[d]}/{QUIZ_LIMIT})</option>)}
                            </select>
                          </div>
                        </div>
                        <Button variant="default" size="sm" onClick={() => void runCreateStepByStep('quiz')} disabled={wsStepByStepLoading || quizAvailable.length === 0 || quizCountVal === 0} className="bg-violet-600 hover:bg-violet-700">
                          {wsStepByStepLoading ? (
                            tr('Đang tạo...', 'Creating...', '创建中...', '作成中...', '생성 중...')
                          ) : quizAvailable.length === 0 ? (
                            tr('Đã đủ câu', 'All full', '已满', '満了', '완료')
                          ) : (
                            <>
                              {tr('Tạo trắc nghiệm từng câu', 'Create quiz per question', '逐题创建选择题', '1問ずつクイズ作成', '문항별 퀴즈 생성')}
                              {creditLabel(quizCountVal * CURRICULUM_UI_CREDITS.worksheetQuestion)}
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="p-4 rounded-lg border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                        <h4 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-2">
                          {tr('Tự luận', 'Essay', '主观题', '記述式', '서술형')}
                        </h4>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div>
                            <label className="text-xs font-medium block mb-1">{tr('Số bài', 'Count', '数量', '数', '수')}</label>
                            <Input type="number" min={0} max={essayCountMax} value={essayCountVal} onChange={(e) => setWsStepByStepEssayCount(Math.min(Number(e.target.value) || 0, essayCountMax))} className="h-8" disabled={essayAvailable.length === 0} />
                          </div>
                          <div>
                            <label className="text-xs font-medium block mb-1">{tr('Dạng bài', 'Question type', '题型', '問題タイプ', '문항 유형')}</label>
                            <select value={essayAvailable.includes(wsStepByStepEssayBloom) ? wsStepByStepEssayBloom : (essayAvailable[0] ?? 'thong-hieu')} onChange={(e) => setWsStepByStepEssayBloom((essayAvailable.includes(e.target.value as typeof wsStepByStepEssayBloom) ? e.target.value : essayAvailable[0]) as typeof wsStepByStepEssayBloom)} className="h-8 w-full rounded-md border px-2 text-sm bg-background" disabled={essayAvailable.length === 0}>
                              {essayAvailable.length === 0 ? <option>{tr('Đã đủ 6/6 mỗi loại', 'All types full (6/6)', '各类已满6/6', '各6/6で満了', '각 6/6 완료')}</option> : essayAvailable.map((d) => <option key={d} value={d}>{essayLabels[d]} ({essayTotal[d]}/{ESSAY_LIMIT})</option>)}
                            </select>
                          </div>
                        </div>
                        <Button variant="default" size="sm" onClick={() => void runCreateStepByStep('essay')} disabled={wsStepByStepLoading || essayAvailable.length === 0 || essayCountVal === 0} className="bg-emerald-600 hover:bg-emerald-700">
                          {wsStepByStepLoading ? (
                            tr('Đang tạo...', 'Creating...', '创建中...', '作成中...', '생성 중...')
                          ) : essayAvailable.length === 0 ? (
                            tr('Đã đủ bài', 'All full', '已满', '満了', '완료')
                          ) : (
                            <>
                              {tr('Tạo tự luận từng câu', 'Create essay per question', '逐题创建主观题', '1問ずつ記述式作成', '문항별 서술형 생성')}
                              {creditLabel(essayCountVal * CURRICULUM_UI_CREDITS.worksheetQuestion)}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    {wsStepByStepStatus && <p className="text-xs text-violet-600 dark:text-violet-400 animate-pulse">{wsStepByStepStatus}</p>}
                  </div>
                  )
                })()}
                {curriculumId && curriculumEditMode && (
                  <div className="mb-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium block mb-1 text-amber-700 dark:text-amber-300">
                          {tr('Dữ liệu cần sửa', 'Data to edit', '要编辑的数据', '編集するデータ', '편집할 데이터')}
                        </label>
                        <Textarea
                          value={editOriginalText}
                          onChange={(e) => {
                            setEditOriginalText(e.target.value)
                            setEditEditedText('')
                            setEditCompareResult(null)
                            setEditCompareErrors([])
                          }}
                          placeholder={tr('Gõ đoạn ngắn để tìm...', 'Type short segment to find...', '输入短段落查找...', '短い段落を入力...', '짧은 단락 입력...')}
                          className="min-h-[60px] text-sm border border-amber-400/80 dark:border-amber-500/80 rounded-md px-2.5 py-2 bg-amber-50/40 dark:bg-amber-950/20"
                          spellCheck={false}
                        />
                        {editMatchStatus === 'found' && (
                          <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">✓ {tr('Đã tìm thấy 1 đoạn (bôi màu)', 'Found 1 segment (highlighted)', '已找到1段（高亮）', '1箇所見つかりました', '1개 찾음 (강조)')}</p>
                        )}
                        {editMatchStatus === 'multiple' && (
                          <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">⚠ {editMatchCount} {tr('đoạn trùng', 'matches', '个相同', '箇所一致', '개 일치')}</p>
                        )}
                        {editMatchStatus === 'not_found' && editOriginalText.trim().length >= 3 && (
                          <p className="mt-0.5 text-xs text-destructive">✗ {tr('Không tìm thấy', 'Not found', '未找到', '見つかりません', '찾을 수 없음')}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1 text-emerald-700 dark:text-emerald-300">
                          {tr('Dữ liệu sẽ sửa thành', 'Data to replace with', '将替换为', '置換後', '다음으로 수정')}
                        </label>
                        <Textarea
                          value={editEditedText}
                          onChange={(e) => {
                            setEditEditedText(e.target.value)
                            setEditCompareResult(null)
                            setEditCompareErrors([])
                          }}
                          placeholder={tr('Gõ nội dung mới...', 'Type new content...', '输入新内容...', '新しい内容を入力...', '새 내용 입력...')}
                          className="min-h-[60px] text-sm border border-emerald-400/80 dark:border-emerald-500/80 rounded-md px-2.5 py-2 bg-emerald-50/40 dark:bg-emerald-950/20"
                          spellCheck={false}
                          disabled={editMatchStatus !== 'found' || editMatchCount !== 1}
                        />
                        {(editMatchStatus !== 'found' || editMatchCount !== 1) && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{tr('Tìm thấy 1 đoạn trước', 'Find 1 segment first', '先找到1段', '1箇所見つけてから', '1개 찾은 후')}</p>
                        )}
                      </div>
                    </div>
                    {editCompareLoading && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 animate-pulse">{tr('Đang hỏi 2 AI...', 'Asking 2 AIs...', '正在请2个AI...', '2つのAIに依頼中...', '2개 AI 요청 중...')}</p>
                    )}
                    {editCompareResult && editCompareResult.bothAgree === true && (
                      <div className={`rounded-md border p-2 text-xs ${editCompareResult.correctVersion === 'edited' ? 'border-emerald-400/80 bg-emerald-50/60 dark:bg-emerald-950/20' : 'border-amber-400/80 bg-amber-50/60 dark:bg-amber-950/20'}`}>
                        <span className={`font-medium ${editCompareResult.correctVersion === 'edited' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                          {editCompareResult.correctVersion === 'edited' ? tr('Đã lưu', 'Saved', '已保存', '保存しました', '저장됨') : tr('Chưa lưu – Giữ bản gốc', 'Not saved – Keep original', '未保存–保留原文', '保存せず–元のまま', '저장 안 함–원본 유지')}
                        </span>
                        <span className={`ml-1 ${editCompareResult.correctVersion === 'edited' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {editCompareResult.correctVersion === 'edited' ? (editCompareResult.reasonSaved || editCompareResult.explanation || '') : (editCompareResult.reasonNotSaved || editCompareResult.explanation || '')}
                        </span>
                      </div>
                    )}
                    {editCompareResult && editCompareResult.bothAgree === false && (
                      <div className="rounded-md border border-amber-400/80 p-2 bg-amber-50/60 dark:bg-amber-950/20">
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">
                          {tr('Mỗi AI ý kiến khác – cần admin', 'Each AI different – admin needed', '各AI意见不同–需管理员', '各AI異なる–管理者必要', '각 AI 다름–관리자 필요')}
                        </p>
                        {(editCompareResult.model1Version || editCompareResult.model2Version) && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-1">Gemini Pro: {editCompareResult.model1Version || '–'} · Gemini Flash: {editCompareResult.model2Version || '–'}</p>
                        )}
                        {editCompareErrors.length > 0 && (
                          <ul className="text-xs text-amber-700 dark:text-amber-300 list-disc list-inside mb-2 space-y-0.5">
                            {editCompareErrors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        )}
                        <Button variant="outline" size="sm" onClick={() => void handleEscalateToAdmin(editCompareErrors)} disabled={escalateLoading} className="h-7 text-xs border-amber-500/80">
                          {escalateLoading ? tr('Đang gửi...', 'Sending...', '发送中...', '送信中...', '전송 중...') : tr('Gửi admin xem xét', 'Send to admin', '发送给管理员', '管理者に送信', '관리자 검토 요청')}
                        </Button>
                      </div>
                    )}
                    <Button
                      onClick={() => void runEditCompare()}
                      disabled={editCompareLoading || editMatchStatus !== 'found' || editMatchCount !== 1 || !editEditedText.trim()}
                      className="w-full h-9 text-sm bg-amber-600 hover:bg-amber-700"
                    >
                      {editCompareLoading ? (
                        tr('Đang kiểm tra...', 'Checking...', '正在检查...', '確認中...', '확인 중...')
                      ) : (
                        <>
                          {tr('Áp dụng sửa', 'Apply edit', '应用修改', '編集を適用', '편집 적용')}
                          {creditLabel(CURRICULUM_UI_CREDITS.curriculumEditApply)}
                        </>
                      )}
                    </Button>
                  </div>
                )}
                <div className="rounded-md border bg-slate-50 dark:bg-slate-900/50 p-3 overflow-auto max-h-[50vh]">
                  {curriculumId && curriculumEditMode ? (
                    <pre className="w-full min-h-[120px] text-sm font-sans leading-relaxed whitespace-pre-wrap break-words bg-transparent">
                      {(() => {
                        const { parts } = highlightMatchInCurriculum(curriculumMarkdown, editOriginalText)
                        const firstHighlightIndex = parts.findIndex((p) => p.highlight)
                        return parts.map((p, i) =>
                          p.highlight ? (
                            <mark
                              key={i}
                              ref={i === firstHighlightIndex ? (el) => { curriculumMatchMarkRef.current = el } : undefined}
                              className="bg-amber-300/70 dark:bg-amber-500/50 rounded px-0.5"
                            >
                              {p.text}
                            </mark>
                          ) : (
                            <span key={i}>{p.text}</span>
                          )
                        )
                      })()}
                    </pre>
                  ) : (
                    <textarea
                      ref={curriculumTextareaRef}
                      value={curriculumMarkdown}
                      onChange={handleCurriculumChange}
                      readOnly={!!curriculumId && !curriculumEditMode}
                      className={`w-full min-h-[120px] text-sm font-sans leading-relaxed prose prose-slate dark:prose-invert max-w-none bg-transparent border-0 resize-y focus:outline-none focus:ring-0 ${curriculumId && !curriculumEditMode ? 'cursor-not-allowed opacity-95' : ''}`}
                      placeholder={tr('Nội dung giáo trình...', 'Curriculum content...', '课程内容...', 'カリキュラム内容...', '교육과정 내용...')}
                      spellCheck={false}
                      title={curriculumId && !curriculumEditMode ? tr('Bấm "Sửa giáo trình" để chỉnh sửa.', 'Click "Edit curriculum" to edit.', '点击"编辑课程"进行编辑。', '「教材を編集」をクリックして編集。', '"교육과정 편집" 클릭하여 편집.') : undefined}
                    />
                  )}
                </div>
                {!curriculumEditMode && (regionPreview || regionCheckLoading || regionCompareResult) && (
                  <div className="mt-2 rounded-md border border-amber-300/80 dark:border-amber-600/80 bg-amber-50/50 dark:bg-amber-950/20 p-2">
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">
                      {regionCheckLoading
                        ? regionCharCount != null
                          ? tr(`Đang gửi ~${regionCharCount} ký tự quanh vị trí con trỏ...`, `Sending ~${regionCharCount} chars around cursor...`, `正在发送光标位置~${regionCharCount}字符...`, `カーソル位置~${regionCharCount}文字を送信中...`, `커서 위치 ~${regionCharCount}자 전송 중...`)
                          : tr('Đang kiểm tra đoạn vừa sửa...', 'Checking edited region...', '正在检查编辑区域...', '編集箇所を確認中...', '편집 영역 확인 중...')
                        : tr('Kết quả so sánh AI:', 'AI comparison result:', 'AI比较结果：', 'AI比較結果：', 'AI 비교 결과:')}
                    </p>
                    {regionCompareResult && (
                      <div className="space-y-2 text-sm mb-2">
                        {regionCompareResult.originalReason && (
                          <p className="text-amber-700 dark:text-amber-300">
                            <span className="font-medium">{tr('Bản gốc sai:', 'Original wrong:', '原文错误：', '元が誤り：', '원본 오류:')}</span> {regionCompareResult.originalReason}
                          </p>
                        )}
                        {regionCompareResult.editedReason && (
                          <p className="text-amber-700 dark:text-amber-300">
                            <span className="font-medium">{tr('Bản sửa sai:', 'Edited wrong:', '修改错误：', '編集が誤り：', '수정 오류:')}</span> {regionCompareResult.editedReason}
                          </p>
                        )}
                        {regionCompareResult.explanation && (
                          <p className="text-emerald-700 dark:text-emerald-300 font-medium">
                            {regionCompareResult.explanation}
                          </p>
                        )}
                      </div>
                    )}
                    {regionPreview && (
                      <div className="grid gap-2 text-xs">
                        {regionPreview.original && (
                          <div>
                            <span className="text-muted-foreground">{tr('Gốc:', 'Original:', '原文：', '元：', '원본:')}</span>
                            <pre className="mt-0.5 rounded bg-white/80 dark:bg-black/20 p-2 max-h-20 overflow-y-auto whitespace-pre-wrap break-words">
                              {regionPreview.original.slice(0, 200)}
                              {regionPreview.original.length > 200 ? '...' : ''}
                            </pre>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">{tr('Mới sửa:', 'Edited:', '修改后：', '編集後：', '수정:')}</span>
                          <pre className="mt-0.5 rounded bg-amber-100/80 dark:bg-amber-900/30 p-2 max-h-20 overflow-y-auto whitespace-pre-wrap break-words">
                            {regionPreview.edited.slice(0, 200)}
                            {regionPreview.edited.length > 200 ? '...' : ''}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {!curriculumEditMode && regionCheckErrors.length > 0 && regionCompareResult?.bothAgree === false && (
                  <div className="mt-2 rounded-md border border-amber-400/80 p-2 bg-amber-50/80 dark:bg-amber-950/30">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                      {tr('Mỗi AI đưa ra ý kiến khác nhau – cần admin xem xét', 'Each AI gave different opinion – admin review needed', '每个AI意见不同–需管理员审核', '各AIが異なる意見–管理者確認必要', '각 AI가 다른 의견–관리자 검토 필요')}
                    </p>
                    {(regionCompareResult.model1Version || regionCompareResult.model2Version) && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                        Gemini Pro: {regionCompareResult.model1Version === 'original' ? tr('bản gốc', 'original', '原文', '元', '원본') : regionCompareResult.model1Version === 'edited' ? tr('bản sửa', 'edited', '修改', '編集', '수정') : regionCompareResult.model1Version || '–'} · Gemini Flash: {regionCompareResult.model2Version === 'original' ? tr('bản gốc', 'original', '原文', '元', '원본') : regionCompareResult.model2Version === 'edited' ? tr('bản sửa', 'edited', '修改', '編集', '수정') : regionCompareResult.model2Version || '–'}
                      </p>
                    )}
                    <ul className="text-sm text-amber-700 dark:text-amber-300 list-disc list-inside space-y-1 mb-3">
                      {regionCheckErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleEscalateToAdmin(regionCheckErrors)}
                      disabled={escalateLoading}
                      className="border-amber-500 text-amber-700 hover:bg-amber-100 dark:border-amber-400 dark:text-amber-300 dark:hover:bg-amber-900/50"
                    >
                      {escalateLoading ? tr('Đang gửi...', 'Sending...', '发送中...', '送信中...', '전송 중...') : tr('Gửi admin xem xét', 'Send to admin for review', '发送给管理员审核', '管理者に送信して確認', '관리자에게 검토 요청')}
                    </Button>
                  </div>
                )}
              </CardContent>
              {curriculumWorksheets.length > 0 && (
                <CardContent ref={curriculumWorksheetsSectionRef} className="pt-0 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {tr('Phiếu bài tập thuộc giáo trình', 'Worksheets in this curriculum', '本课程练习', 'このカリキュラムのワークシート', '이 교육과정의 워크시트')} ({curriculumWorksheets.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {curriculumWorksheets.map((w) => (
                      <Button
                        key={w.id}
                        variant={worksheetId === w.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleLoadWorksheetFromCurriculum(w)}
                        className={worksheetId === w.id ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
                        {w.topic}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
            )}

            {worksheetMarkdown && (
              <div ref={worksheetSectionRef}>
              <Card className="border shadow-sm border-emerald-200/60">
                <div className="bg-violet-100/80 dark:bg-violet-950/40 px-4 py-2.5 border-b border-violet-300/70 dark:border-violet-700/60">
                  <p className="text-xs sm:text-sm font-medium text-violet-900 dark:text-violet-100">
                    {tr('Phiếu bài tập đã sẵn sàng. Dùng nhóm nút ở góc phải để sao chép hoặc tải file.', 'Worksheet is ready. Use the action buttons on the right to copy or download files.', '练习已就绪。请使用右侧操作按钮复制或下载文件。', 'ワークシートの準備ができました。右側の操作ボタンからコピー/ダウンロードしてください。', '워크시트 준비 완료. 오른쪽 작업 버튼에서 복사/다운로드하세요.')}
                  </p>
                </div>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    {tr('Phiếu bài tập', 'Worksheet', '练习', 'ワークシート', '워크시트')}
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    {worksheetId && (
                      <Button asChild variant="outline" size="sm">
                        <a href={`/phieu-bai-tap/${worksheetId}`} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-3.5 w-3.5 mr-1" />
                          {tr('Mở trang phiếu bài tập', 'Open worksheet page', '打开练习页面', 'ワークシートページを開く', '워크시트 페이지 열기')}
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleReset}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-md"
                    >
                      {tr('Tạo giáo trình mới', 'Create new curriculum', '创建新课程', '新規カリキュラム作成', '새 교육과정 만들기')}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-lg border bg-violet-50/70 dark:bg-violet-950/25 p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                          {tr('Phần trắc nghiệm', 'Quiz section', '选择题部分', 'クイズ部分', '퀴즈 섹션')}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0 h-7 text-xs border-violet-400/60 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40"
                          onClick={() => {
                            setWorksheetEditFilter('quiz')
                            setWorksheetEditBlockIndex(null)
                            setWorksheetEditBlockContent('')
                            setWorksheetEditCheckResult(null)
                          }}
                        >
                          {tr('Sửa trắc nghiệm', 'Edit quiz', '编辑选择题', '選択式を編集', '퀴즈 수정')}
                        </Button>
                      </div>
                      <div
                        role="region"
                        aria-label={tr('Phần trắc nghiệm', 'Quiz section', '选择题部分', 'クイズ部分', '퀴즈 섹션')}
                        className={`w-full min-h-[180px] text-sm font-sans leading-relaxed whitespace-pre-wrap break-words px-2 py-2 rounded-md bg-background/40 dark:bg-background/10 border border-violet-200/50 dark:border-violet-800/40 ${
                          worksheetParts.quiz.trim() ? 'text-foreground' : 'text-muted-foreground italic'
                        }`}
                      >
                        {worksheetParts.quiz.trim()
                          ? worksheetParts.quiz
                          : tr('Chưa có phần trắc nghiệm', 'No quiz section', '暂无选择题部分', 'クイズ部分がありません', '퀴즈 섹션 없음')}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-emerald-50/70 dark:bg-emerald-950/20 p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          {tr('Phần tự luận', 'Essay section', '主观题部分', '記述式部分', '서술형 섹션')}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0 h-7 text-xs border-emerald-400/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                          onClick={() => {
                            setWorksheetEditFilter('essay')
                            setWorksheetEditBlockIndex(null)
                            setWorksheetEditBlockContent('')
                            setWorksheetEditCheckResult(null)
                          }}
                        >
                          {tr('Sửa tự luận', 'Edit essay', '编辑主观题', '記述式を編集', '서술형 수정')}
                        </Button>
                      </div>
                      <div
                        role="region"
                        aria-label={tr('Phần tự luận', 'Essay section', '主观题部分', '記述式部分', '서술형 섹션')}
                        className={`w-full min-h-[180px] text-sm font-sans leading-relaxed whitespace-pre-wrap break-words px-2 py-2 rounded-md bg-background/40 dark:bg-background/10 border border-emerald-200/50 dark:border-emerald-800/40 ${
                          worksheetParts.essay.trim() ? 'text-foreground' : 'text-muted-foreground italic'
                        }`}
                      >
                        {worksheetParts.essay.trim()
                          ? worksheetParts.essay
                          : tr('Chưa có phần tự luận', 'No essay section', '暂无主观题部分', '記述式部分がありません', '서술형 섹션 없음')}
                      </div>
                    </div>
                  </div>
                  {/* Popup sửa phiếu – mở ngay khi bấm Sửa trắc nghiệm / Sửa tự luận */}
                  {worksheetEditFilter && (
                    <WorksheetEditSectionPopup
                      open={true}
                      onClose={() => {
                        setWorksheetEditFilter(null)
                        setWorksheetEditBlockIndex(null)
                        setWorksheetEditBlockContent('')
                        setWorksheetEditImages([])
                        setWorksheetEditCheckResult(null)
                      }}
                      filter={worksheetEditFilter}
                      blocks={worksheetEditBlocks}
                      blockIndex={worksheetEditBlockIndex}
                      blockContent={worksheetEditBlockContent}
                      onBlockContentChange={setWorksheetEditBlockContent}
                      onSelectBlock={async (idx) => {
                        setWorksheetEditBlockIndex(idx)
                        const block = worksheetEditBlocks[idx]
                        let nextContent = toEditableBlockContent(
                          block?.content ?? '',
                          block?.type === 'essay' ? 'essay' : 'quiz'
                        )
                        // Luôn ưu tiên lấy từ DB để tránh popup bị ảnh hưởng bởi markdown render lỗi/lặp.
                        if (worksheetId && block) {
                          try {
                            const res = await fetch(`/api/worksheet/${encodeURIComponent(worksheetId)}`)
                            const data = await res.json().catch(() => ({}))
                            const list = Array.isArray(data?.questions) ? data.questions as Array<{ type?: string; content_json?: unknown }> : []
                            const sameTypeIdx = worksheetEditBlocks.slice(0, idx + 1).filter((b) => b.type === block.type).length - 1
                            const row = list.filter((q) => q?.type === block.type)[sameTypeIdx]
                            if (row && block.type === 'essay') {
                              const heading = (nextContent.match(/^([^\n]*Bài\s+\d+[^\n]*)/i)?.[1] ?? '').trim()
                              const problem = latexToReadable(getEssayProblem(row.content_json) || '')
                              const solution = normalizeSolutionToStr(getEssaySolution(row.content_json)) || '(Chưa có lời giải)'
                              nextContent = [heading, problem, '**Lời giải:**', solution].filter(Boolean).join('\n\n')
                            }
                          } catch {
                            /* fallback dùng markdown hiện tại */
                          }
                        }
                        setWorksheetEditBlockContent(nextContent)
                        setWorksheetEditImages([])
                        setWorksheetEditCheckResult(null)
                      }}
                      onCancelEdit={() => {
                        setWorksheetEditBlockIndex(null)
                        setWorksheetEditBlockContent('')
                        setWorksheetEditImages([])
                        setWorksheetEditCheckResult(null)
                      }}
                      checkResult={worksheetEditCheckResult}
                      onApplyFix={() => {
                        const corrected = worksheetEditCheckResult?.correctedContent
                        if (corrected) {
                          setWorksheetEditBlockContent(corrected)
                          setWorksheetEditCheckResult(null)
                          void handleSaveWorksheetBlockEdit({ skipAiCheck: true, contentOverride: corrected })
                        }
                      }}
                      onCheck={() => void handleCheckWorksheetBlock()}
                      onSave={() => void handleSaveWorksheetBlockEdit()}
                      editImages={worksheetEditImages}
                      onPickImages={(files) => {
                        const list = Array.from(files ?? []).filter((f) => f && f.size > 0)
                        if (list.length === 0) return
                        setWorksheetEditImages((prev) => [...prev, ...list].slice(0, 6))
                      }}
                      onRemoveImage={(idx) => setWorksheetEditImages((prev) => prev.filter((_, i) => i !== idx))}
                      onClearImages={() => setWorksheetEditImages([])}
                      checkLoading={worksheetEditCheckLoading}
                      saving={worksheetEditSaving}
                      checkCreditSuffix={creditLabel(CURRICULUM_UI_CREDITS.worksheetEditCheck)}
                      saveCreditSuffix={creditLabel(CURRICULUM_UI_CREDITS.worksheetEditSave)}
                      saveDisabled={
                        !worksheetId ||
                        worksheetEditBlockContent.trim() ===
                          (worksheetEditBlockIndex != null && worksheetEditBlocks[worksheetEditBlockIndex]
                            ? toEditableBlockContent(
                                worksheetEditBlocks[worksheetEditBlockIndex].content,
                                worksheetEditBlocks[worksheetEditBlockIndex].type === 'essay' ? 'essay' : 'quiz'
                              )
                            : ''
                          ).trim()
                      }
                      tr={tr}
                    />
                  )}
                </CardContent>
              </Card>
              </div>
            )}

          </>
        )}
        </div>
        )}

        {featureSection === 'exam' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileQuestion className="h-4 w-4 text-violet-600" />
                {tr('Tạo bài thi theo giáo trình', 'Create exam by curriculum', '按课程创建测验', 'カリキュラム別テスト作成', '교육과정 기반 시험 생성')}
              </CardTitle>
              <CardDescription>
                {tr('Chỉ thay đổi giao diện điều hướng. Logic dữ liệu giữ nguyên như hiện tại.', 'Only navigation UI changed. Data logic stays unchanged.', '仅调整导航界面，数据逻辑保持不变。', 'ナビUIのみ変更し、データロジックは現状維持です。', '탐색 UI만 변경하고 데이터 로직은 유지합니다.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Link href="/tao-bai-thi">
                  <Button className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
                    <FileQuestion className="h-4 w-4" />
                    {tr('Mở trang Tạo bài thi', 'Open exam creator', '打开测验创建页面', 'テスト作成ページを開く', '시험 생성 페이지 열기')}
                  </Button>
                </Link>

                <div className="rounded border p-3 space-y-2 bg-background">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {tr('Danh sách bài thi đã tạo', 'Created exams', '已创建测验', '作成済みテスト', '생성된 시험')}
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={() => void loadCreatedExamItems()} disabled={examListLoading}>
                      {examListLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      {tr('Làm mới', 'Refresh', '刷新', '更新', '새로고침')}
                    </Button>
                  </div>
                  {examListLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {tr('Đang tải...', 'Loading...', '加载中...', '読み込み中...', '불러오는 중...')}
                    </div>
                  ) : createdExamItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {tr('Chưa có bài thi nào.', 'No exams yet.', '暂无测验。', 'まだテストがありません。', '아직 시험이 없습니다.')}
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {createdExamItems.map((exam) => (
                        <div key={exam.id} className="rounded border p-2 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{exam.title || tr('Bài thi', 'Exam', '测验', 'テスト', '시험')} - {exam.code}</p>
                            <p className="text-xs text-muted-foreground">
                              {exam.totalQuestions} {tr('câu', 'questions', '题', '問', '문항')} - {exam.durationMinutes} {tr('phút', 'minutes', '分钟', '分', '분')}
                            </p>
                            {(() => {
                              const time = formatSessionIsoDateTime(exam.createdAt, uiLocale as WebLocale)
                              if (!time) return null
                              return (
                                <p className="text-xs text-muted-foreground">
                                  {fillI18nTemplate(examSessionCreatedAtTpl, { time })}
                                </p>
                              )
                            })()}
                          </div>
                          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setExamAttachTarget({
                                  id: exam.id,
                                  title: exam.title || tr('Bài thi', 'Exam', '测验', 'テスト', '시험'),
                                })
                              }
                              className="gap-1.5"
                            >
                              <Link2 className="h-3.5 w-3.5" aria-hidden />
                              {tcClasses.examAssignClassButton}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void handleOpenExamPreview({
                                code: exam.code,
                                title: exam.title || tr('Bài thi', 'Exam', '测验', 'テスト', '시험'),
                                examUrl: exam.examUrl,
                              })}
                            >
                              {tr('Mở', 'Open', '打开', '開く', '열기')}
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setCreatedExamDeleteTarget({
                                  code: exam.code,
                                  title: exam.title || tr('Bài thi', 'Exam', '测验', 'テスト', '시험'),
                                })
                                setCreatedExamDeleteConfirmInput('')
                              }}
                              disabled={examDeletingCode === exam.code}
                              className="gap-1.5"
                            >
                              {examDeletingCode === exam.code ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                              {tr('Xóa', 'Delete', '删除', '削除', '삭제')}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {featureSection === 'homework' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-sky-200/60">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <NotebookPen className="h-4 w-4 text-sky-600" />
                {tr(
                  'Tạo bài tập về nhà theo giáo trình',
                  'Create homework by curriculum',
                  '按课程创建家庭作业',
                  'カリキュラムから宿題を作成',
                  '교육과정 기반 숙제 만들기'
                )}
              </CardTitle>
              <CardDescription>
                {tr(
                  'Giống bài thi trực tuyến nhưng không bắt tổng 100 điểm; học sinh không xem điểm sau khi nộp. Có thể gán vào lớp và phiếu như bài thi.',
                  'Like the online exam but no 100-point total; students do not see scores after submit. Attach to classes and worksheets like exams.',
                  '与在线测验相同，但不要求总分100分；学生提交后不显示成绩。可像测验一样关联班级与练习单。',
                  'オンライン試験と同様ですが合計100点は不要。提出後も生徒に点数は表示しません。クラスやワークシートへの割当は試験と同様です。',
                  '온라인 시험과 같으나 총 100점은 필요 없고 제출 후 학생에게 점수를 보여주지 않습니다. 학급·워크시트 연결은 시험과 같습니다.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Link href="/tao-bai-tap-ve-nha">
                  <Button className="gap-2 bg-sky-600 hover:bg-sky-700 text-white">
                    <NotebookPen className="h-4 w-4" />
                    {tr(
                      'Mở trang Tạo bài tập về nhà',
                      'Open homework creator',
                      '打开家庭作业创建页',
                      '宿題作成ページを開く',
                      '숙제 만들기 페이지 열기'
                    )}
                  </Button>
                </Link>

                <div className="rounded border p-3 space-y-2 bg-background">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {tr(
                        'Danh sách bài tập về nhà đã tạo',
                        'Created homework',
                        '已创建的家庭作业',
                        '作成した宿題',
                        '만든 숙제'
                      )}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void loadCreatedHomeworkItems()}
                      disabled={homeworkListLoading}
                    >
                      {homeworkListLoading ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      {tr('Làm mới', 'Refresh', '刷新', '更新', '새로고침')}
                    </Button>
                  </div>
                  {homeworkListLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {tr('Đang tải...', 'Loading...', '加载中...', '読み込み中...', '불러오는 중...')}
                    </div>
                  ) : createdHomeworkItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {tr(
                        'Chưa có bài tập về nhà nào.',
                        'No homework yet.',
                        '暂无家庭作业。',
                        'まだ宿題がありません。',
                        '아직 숙제가 없습니다.'
                      )}
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {createdHomeworkItems.map((row) => (
                        <div key={row.id} className="rounded border p-2 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {row.title
                                || tr('Bài tập về nhà', 'Homework', '家庭作业', '宿題', '숙제')}{' '}
                              - {row.code}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {row.totalQuestions} {tr('câu', 'questions', '题', '問', '문항')} - {row.durationMinutes}{' '}
                              {tr('phút', 'minutes', '分钟', '分', '분')}
                            </p>
                            {(() => {
                              const time = formatSessionIsoDateTime(row.createdAt, uiLocale as WebLocale)
                              if (!time) return null
                              return (
                                <p className="text-xs text-muted-foreground">
                                  {fillI18nTemplate(examSessionCreatedAtTpl, { time })}
                                </p>
                              )
                            })()}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                void handleOpenExamPreview(
                                  {
                                    code: row.code,
                                    title:
                                      row.title
                                      || tr('Bài tập về nhà', 'Homework', '家庭作业', '宿題', '숙제'),
                                    examUrl: row.examUrl,
                                  },
                                  true
                                )
                              }
                            >
                              {tr('Mở', 'Open', '打开', '開く', '열기')}
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => void handleDeleteCreatedHomework(row.code)}
                              disabled={homeworkDeletingCode === row.code}
                              className="gap-1.5"
                            >
                              {homeworkDeletingCode === row.code ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                              {tr('Xóa', 'Delete', '删除', '削除', '삭제')}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <AlertDialog
        open={createdExamDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreatedExamDeleteTarget(null)
            setCreatedExamDeleteConfirmInput('')
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tcClasses.examDeleteConfirmTitle}</AlertDialogTitle>
            {createdExamDeleteTarget ? (
              <>
                <p className="text-sm text-foreground">
                  <span className="font-medium">{createdExamDeleteTarget.title}</span>
                  {createdExamDeleteTarget.code.trim() ? (
                    <>
                      {' '}
                      <span className="font-mono text-muted-foreground">
                        ({createdExamDeleteTarget.code.trim()})
                      </span>
                    </>
                  ) : null}
                </p>
                <AlertDialogDescription>{tcClasses.examDeleteConfirmDescription}</AlertDialogDescription>
              </>
            ) : null}
          </AlertDialogHeader>
          {createdExamDeleteTarget ? (
            <div className="space-y-2 rounded-md border-2 border-border bg-muted/30 p-3">
              <p className="text-sm text-muted-foreground">{tcClasses.examDeleteConfirmTypeHint}</p>
              <p className="rounded-md border-2 border-muted-foreground/50 bg-background px-3 py-2 text-center font-mono text-sm font-semibold text-foreground shadow-sm">
                {tcClasses.examDeleteConfirmPhrase}
              </p>
              <Input
                value={createdExamDeleteConfirmInput}
                onChange={(e) => setCreatedExamDeleteConfirmInput(e.target.value)}
                autoComplete="off"
                autoFocus
                className={cn(
                  'h-10 bg-background font-mono text-sm shadow-sm',
                  'border-2 border-muted-foreground/55',
                  'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/50'
                )}
                aria-label={tcClasses.examDeleteConfirmTypeHint}
              />
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={examDeletingCode === createdExamDeleteTarget?.code}>
              {tcClasses.cancelAction}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={
                !createdExamDeleteTarget?.code.trim() ||
                examDeletingCode === createdExamDeleteTarget.code ||
                !matchesDestructiveConfirm(createdExamDeleteConfirmInput, tcClasses.examDeleteConfirmPhrase)
              }
              onClick={() => {
                if (!createdExamDeleteTarget?.code) return
                void runDeleteCreatedExam(createdExamDeleteTarget.code)
              }}
            >
              {examDeletingCode === createdExamDeleteTarget?.code
                ? tcClasses.examDeleting
                : tcClasses.examDeleteConfirmAction}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AttachExamToClassDialog
        open={examAttachTarget !== null}
        onOpenChange={(o) => {
          if (!o) setExamAttachTarget(null)
        }}
        sourceSessionId={examAttachTarget?.id ?? ''}
        examTitle={examAttachTarget?.title}
        tc={tcClasses}
        onSuccess={() => void loadCreatedExamItems()}
      />
      {examPreview && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg border bg-background shadow-xl">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <p className="text-sm font-semibold">
                {examPreview.forHomework
                  ? tr(
                      'Quét mã QR làm bài tập',
                      'Scan QR to do homework',
                      '扫码完成家庭作业',
                      'QRで宿題に取り組む',
                      'QR로 숙제하기'
                    )
                  : tr('Quét mã QR làm bài', 'Scan QR to take exam', '扫码参加测验', 'QRをスキャンして受験', 'QR 스캔으로 시험 응시')}
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setExamPreview(null)}>
                {tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}
              </Button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm font-medium">{examPreview.title} - {examPreview.code}</p>
              <div className="rounded border p-3 bg-muted/30 flex items-center justify-center min-h-[240px]">
                {examPreview.loadingQr ? (
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : examPreview.qrDataUrl ? (
                  <img src={examPreview.qrDataUrl} alt="QR exam" className="w-56 h-56" />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {tr('Không tạo được QR. Dùng link bên dưới.', 'Failed to generate QR. Use link below.', '二维码生成失败，请使用下方链接。', 'QR生成に失敗しました。下記リンクを使用してください。', 'QR 생성 실패. 아래 링크를 사용하세요.')}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Input readOnly value={examPreview.examUrl} className="text-xs font-mono" />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(examPreview.examUrl)}
                  >
                    {tr('Copy link', 'Copy link', '复制链接', 'リンクをコピー', '링크 복사')}
                  </Button>
                  <Button type="button" size="sm" asChild>
                    <Link href={examPreview.examUrl} target="_blank">
                      {tr('Mở trên máy này', 'Open on this device', '在本机打开', 'この端末で開く', '이 기기에서 열기')}
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
