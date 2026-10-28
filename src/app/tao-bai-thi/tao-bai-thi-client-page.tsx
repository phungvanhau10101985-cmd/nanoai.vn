'use client'

import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import Link from 'next/link'
import Image from 'next/image'
import {
  FileQuestion,
  RefreshCw,
  QrCode,
  Copy,
  Link2,
  BookOpen,
  FileDown,
  FileText,
  Eye,
  Trash2,
  ListOrdered,
  NotebookPen,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import QRCode from 'qrcode'
import { GRADE_LEVELS, GRADE_LEVEL_GROUPS } from '../tao-giao-trinh/lib/curriculum-subjects'
import ClassSubjectField from '../lop/class-subject-field'
import { isClassSubjectId, subjectIdFromFreeLabel } from '@/lib/lop/class-subject'
import { listCurriculaForExam, listExamTeacherReview } from '../tao-giao-trinh/actions'
import { latexToReadable } from '../tao-giao-trinh/lib/latex-to-readable'
import { exportWorksheetToPdf, exportWorksheetToWord } from '../tao-giao-trinh/lib/worksheet-export'
import { ExamPresetPanel } from './exam-preset-panel'
import { ExamCreateQuestions } from './exam-create-questions'
import { ExamQuestionQuickView } from './exam-question-quick-view'
import { ExamCreateReviewGate, type ExamReviewItem } from './exam-create-review-gate'
import { formatSessionIsoDateTime } from '@/lib/datetime/format-session-iso-local'
import { getDictionary, type Dictionary } from '@/lib/i18n/dictionaries'
import { DEFAULT_WEB_LOCALE, type WebLocale } from '@/lib/i18n/config'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import { AttachExamToClassDialog } from '@/components/exam/attach-exam-to-class-dialog'
import { isMarkedExamTeacher, markExamTeacher } from '@/lib/exam-teacher-mark'
import {
  navigateDetachedTeacherSlideWindow,
  openDetachedTeacherSlideWindow,
} from '@/lib/tao-giao-trinh/teacher-slide-window'
import { renameSavedSchool, savePickedSchool, useSchoolSearch, voteSavedSchool, type SchoolSearchHit } from '@/hooks/use-school-search'
import { SchoolNameOptions } from '@/components/school/school-name-options'

function getWebLocaleFromCookie(): WebLocale {
  return readWebLocaleFromDocumentCookie()
}

const EXAM_TYPE_ORDER = ['15ph', '1tiet', 'hocky', 'totnghiep'] as const
type ExamTypeId = (typeof EXAM_TYPE_ORDER)[number]
const EXAM_TYPE_DURATION: Record<ExamTypeId, number> = {
  '15ph': 15,
  '1tiet': 45,
  hocky: 90,
  totnghiep: 120,
}

function examTypeButtonLabel(tx: Dictionary['createExamPage'], id: string): string {
  if (id === '15ph') return tx.examType15
  if (id === '1tiet') return tx.examType45
  if (id === 'hocky') return tx.examType90
  if (id === 'totnghiep') return tx.examType120
  return tx.examType15
}

function fillExamTpl(template: string, vars: Record<string, string | number>): string {
  let s = template
  for (const [key, value] of Object.entries(vars)) {
    s = s.split(`{${key}}`).join(String(value))
  }
  return s
}

const EXAM_FORM_DEFAULTS_KEY_EXAM = 'app_tao_bai_thi_form_defaults_v1'
const EXAM_FORM_DEFAULTS_KEY_EXAM_LEGACY = 'nanoai_tao_bai_thi_form_defaults_v1'
const EXAM_FORM_DEFAULTS_KEY_HOMEWORK = 'app_tao_bai_tap_ve_nha_form_defaults_v1'
const EXAM_FORM_DEFAULTS_KEY_HOMEWORK_LEGACY = 'nanoai_tao_bai_tap_ve_nha_form_defaults_v1'
const EXAM_FORM_DEFAULTS_VERSION = 1

type ExamFormDefaultsV1 = {
  version: number
  examType: string
  subjectId: string
  gradeLevelId: string
  title: string
  schoolSearch: string
  selectedSchoolId: string
  selectedSchoolName: string
  selectedClassId: string
  newClassSubject: string
  newClassTeacher: string
}

function readExamFormDefaults(primaryKey: string, legacyKey: string): Partial<ExamFormDefaultsV1> | null {
  if (typeof window === 'undefined') return null
  const parseOne = (raw: string | null): Partial<ExamFormDefaultsV1> | null => {
    if (!raw) return null
    try {
      const p = JSON.parse(raw) as ExamFormDefaultsV1
      if (!p || p.version !== EXAM_FORM_DEFAULTS_VERSION) return null
      return p
    } catch {
      return null
    }
  }
  return parseOne(window.localStorage.getItem(primaryKey)) ?? parseOne(window.localStorage.getItem(legacyKey))
}

function writeExamFormDefaults(payload: ExamFormDefaultsV1, primaryKey: string, legacyKey: string) {
  if (typeof window === 'undefined') return
  try {
    const json = JSON.stringify(payload)
    window.localStorage.setItem(primaryKey, json)
    window.localStorage.setItem(legacyKey, json)
  } catch {
    // ignore quota / private mode
  }
}

const GRADE_LEVEL_ID_SET: Set<string> = new Set(GRADE_LEVELS.map((g) => g.id))
const EXAM_TYPE_ID_SET = new Set<string>(EXAM_TYPE_ORDER)

/** Tổng điểm (TN + TL) bắt buộc = 100 khi tạo phiên thi */
const EXAM_FULL_SCORE = 100

function roundExamPoints(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

/** Điểm tối đa gán được cho một câu tự luận nếu các câu khác giữ nguyên */
function maxEssayPointsForQuestion(
  questionId: string,
  orderedEssayIds: string[],
  essayPointsById: Record<string, number>,
  totalQuizPoints: number
): number {
  const others = orderedEssayIds
    .filter((x) => x !== questionId)
    .reduce((s, oid) => s + roundExamPoints(Number(essayPointsById[oid] ?? 0)), 0)
  return Math.max(0, roundExamPoints(EXAM_FULL_SCORE - totalQuizPoints - others))
}

/** Điểm tối đa gán được cho một câu trắc nghiệm nếu các câu khác giữ nguyên */
function maxQuizPointsForQuestion(
  questionId: string,
  orderedQuizIds: string[],
  quizPointsById: Record<string, number>,
  essayPointsTotal: number
): number {
  const others = orderedQuizIds
    .filter((x) => x !== questionId)
    .reduce((s, oid) => s + roundExamPoints(Number(quizPointsById[oid] ?? 0)), 0)
  return Math.max(0, roundExamPoints(EXAM_FULL_SCORE - essayPointsTotal - others))
}

/** Bước 0,5 phút — cùng lưới với ô phút/câu */
function roundExamMinutes(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 2) / 2
}

/** Trần phút làm tròn xuống 0,5 để số câu × phút/câu không vượt ngân sách */
function floorExamMinutes(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.floor(n * 2 + 1e-9) / 2
}

/** Phút tối đa gán được cho một câu tự luận nếu các câu khác giữ nguyên */
function maxEssayMinutesForQuestion(
  questionId: string,
  orderedEssayIds: string[],
  essayMinutesById: Record<string, number>,
  totalQuizMinutes: number,
  durationBudget: number
): number {
  const others = orderedEssayIds
    .filter((x) => x !== questionId)
    .reduce((s, oid) => s + roundExamMinutes(Number(essayMinutesById[oid] ?? 0)), 0)
  return floorExamMinutes(durationBudget - totalQuizMinutes - others)
}

/** Phút tối đa gán được cho một câu trắc nghiệm nếu các câu khác giữ nguyên */
function maxQuizMinutesForQuestion(
  questionId: string,
  orderedQuizIds: string[],
  quizMinutesById: Record<string, number>,
  essayMinutesTotal: number,
  durationBudget: number
): number {
  const others = orderedQuizIds
    .filter((x) => x !== questionId)
    .reduce((s, oid) => s + roundExamMinutes(Number(quizMinutesById[oid] ?? 0)), 0)
  return floorExamMinutes(durationBudget - essayMinutesTotal - others)
}

type CreatedExamRow = {
  id: string
  code: string
  title: string
  status: string
  durationMinutes: number
  totalQuestions: number
  createdAt: string
  examUrl: string
  className: string
  schoolName: string
}

function CreatedExamsListRows({
  loading,
  exams,
  tx,
  tcClasses,
  webLocale,
  buildExamReviewUrl,
  buildTeacherPaperUrl,
  showTeacherActions,
  openExamPreview,
  deleteCreatedExam,
  deletingCode,
  scrollClassName,
  onAttachToOtherClass,
  homeworkList,
}: {
  loading: boolean
  exams: CreatedExamRow[]
  tx: Dictionary['createExamPage']
  tcClasses: Dictionary['classes']
  webLocale: WebLocale
  buildExamReviewUrl: (code: string) => string
  buildTeacherPaperUrl: (code: string) => string
  /** Chữa bài và Giáo viên mở đề: người tạo đề, dùng đề có sẵn, hoặc đã mở giáo trình. */
  showTeacherActions: boolean
  openExamPreview: (exam: { code: string; title: string; examUrl: string }) => void
  deleteCreatedExam: (code: string) => void
  deletingCode: string | null
  /** lớp bọc danh sách (cuộn) — mặc định max-h-72 */
  scrollClassName?: string
  onAttachToOtherClass?: (exam: CreatedExamRow) => void
  homeworkList?: boolean
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" />
        {tx.loadingExamList}
      </div>
    )
  }
  if (exams.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {homeworkList ? tx.noHomeworkSessionsYet : tx.noExamsYet}
      </p>
    )
  }
  const wrap = scrollClassName ?? 'max-h-72'
  return (
    <div className={`space-y-2 overflow-y-auto ${wrap}`}>
      {exams.map((exam) => (
        <div key={exam.id} className="rounded border p-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {exam.title || tx.examTitle} - {exam.code}
            </p>
            <p className="text-xs text-muted-foreground">
              {homeworkList
                ? fillExamTpl(tx.homeworkCreatedResultLine, { count: String(exam.totalQuestions) })
                : `${exam.totalQuestions} ${tx.questions} - ${exam.durationMinutes} ${tx.minutes}`}
            </p>
            {(() => {
              const time = formatSessionIsoDateTime(exam.createdAt, webLocale)
              if (!time) return null
              return (
                <p className="text-xs text-muted-foreground">
                  {fillExamTpl(tcClasses.examSessionCreatedAt, { time })}
                </p>
              )
            })()}
            {(exam.className || exam.schoolName) && (
              <p className="text-xs text-muted-foreground">
                {exam.className ? `${tx.classLabel}: ${exam.className}` : ''}
                {exam.className && exam.schoolName ? ' · ' : ''}
                {exam.schoolName ? `${tx.schoolLabel}: ${exam.schoolName}` : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {showTeacherActions ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => openDetachedTeacherSlideWindow(buildExamReviewUrl(exam.code))}
                >
                  {tx.review}
                </Button>
                <Button type="button" size="sm" asChild>
                  <Link href={buildTeacherPaperUrl(exam.code)} target="_blank">
                    {tx.teacherOpenExam}
                  </Link>
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                void openExamPreview({
                  code: exam.code,
                  title: exam.title || tx.examTitle,
                  examUrl: exam.examUrl,
                })
              }
            >
              {tx.open}
            </Button>
            {onAttachToOtherClass ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onAttachToOtherClass(exam)}
                className="gap-1.5"
              >
                <Link2 className="h-3.5 w-3.5" aria-hidden />
                {tcClasses.examAttachToOtherClassButton}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => deleteCreatedExam(exam.code)}
              disabled={deletingCode === exam.code}
              className="gap-1.5"
            >
              {deletingCode === exam.code ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              {tx.delete}
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function TaoBaiThiClientPage({
  variant = 'exam',
  initialWebLocale = DEFAULT_WEB_LOCALE,
}: { variant?: 'exam' | 'homework'; initialWebLocale?: WebLocale } = {}) {
  const isHomework = variant === 'homework'
  const formDefaultsPrimary = isHomework ? EXAM_FORM_DEFAULTS_KEY_HOMEWORK : EXAM_FORM_DEFAULTS_KEY_EXAM
  const formDefaultsLegacy = isHomework ? EXAM_FORM_DEFAULTS_KEY_HOMEWORK_LEGACY : EXAM_FORM_DEFAULTS_KEY_EXAM_LEGACY
  const [uiLocale, setUiLocale] = useState<WebLocale>(initialWebLocale)
  /** Homework: không hiện “loại đề” — dùng 90 phút nội bộ làm giới hạn mềm trên lam-bai */
  const [examType, setExamType] = useState<string>(() => (variant === 'homework' ? 'hocky' : '15ph'))
  const [subjectId, setSubjectId] = useState('toan')
  const [gradeLevelId, setGradeLevelId] = useState('lop-12')
  const [title, setTitle] = useState('')
  const [selectedQuizQuestionIds, setSelectedQuizQuestionIds] = useState<Set<string>>(new Set())
  const [quizMinutesById, setQuizMinutesById] = useState<Record<string, number>>({})
  const [quizPointsById, setQuizPointsById] = useState<Record<string, number>>({})
  const [selectedEssayQuestionIds, setSelectedEssayQuestionIds] = useState<Set<string>>(new Set())
  const [essayMinutesById, setEssayMinutesById] = useState<Record<string, number>>({})
  const [essayPointsById, setEssayPointsById] = useState<Record<string, number>>({})
  const [essayQuestionSearch, setEssayQuestionSearch] = useState('')
  const [showEssayPicker, setShowEssayPicker] = useState(false)
  const [quickViewItem, setQuickViewItem] = useState<null | {
    id: string
    type: 'quiz' | 'essay'
    preview: string
    problem: string
    solution: string
  }>(null)
  const [selectedCurriculumIds, setSelectedCurriculumIds] = useState<Set<string>>(new Set())
  const [curriculaList, setCurriculaList] = useState<Array<{ id: string; topic: string; subject_id: string; grade_level_id: string; isOwn?: boolean }>>([])
  const [quizQuestionSearch, setQuizQuestionSearch] = useState('')
  const [questionCatalogLoading, setQuestionCatalogLoading] = useState(false)
  const [questionCatalog, setQuestionCatalog] = useState<Array<{
    id: string
    type: 'quiz' | 'essay'
    difficulty: string
    source: string
    verifiedAt: string | null
    createdAt?: string
    createdIn?: 'exam' | 'worksheet'
    topic: string
    preview: string
    problem: string
    solution: string
    curriculumId: string
    curriculumTopic: string
  }>>([])
  const [loading, setLoading] = useState(false)
  const [browseLoading, setBrowseLoading] = useState(false)
  const [result, setResult] = useState<{
    code: string
    examUrl: string
    totalQuestions: number
    durationMinutes: number
    title: string
    className: string
    schoolName: string
  } | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [exportLoading, setExportLoading] = useState<'pdf' | 'word' | null>(null)
  const [presetBusy, setPresetBusy] = useState(false)
  const [catalogReloadToken, setCatalogReloadToken] = useState(0)
  const [createdExamsLoading, setCreatedExamsLoading] = useState(false)
  const [deletingCode, setDeletingCode] = useState<string | null>(null)
  const [classesLoading, setClassesLoading] = useState(false)
  const [creatingClass, setCreatingClass] = useState(false)
  const [pendingReview, setPendingReview] = useState<ExamReviewItem[] | null>(null)
  const [teacherClasses, setTeacherClasses] = useState<Array<{
    id: string
    name: string
    joinCode: string
    schoolId: string
    schoolName: string
    gradeLevelId: string
    subjectLabel: string
    teacherDisplayName: string
  }>>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [newClassName, setNewClassName] = useState('')
  const [newClassSubject, setNewClassSubject] = useState('')
  const [newClassTeacher, setNewClassTeacher] = useState('')
  const [defaultsForNewClass, setDefaultsForNewClass] = useState({ subject: '', teacher: '' })
  const [showCreateClassModal, setShowCreateClassModal] = useState(false)
  const [createdExamsSheetOpen, setCreatedExamsSheetOpen] = useState(false)
  const [schoolSearch, setSchoolSearch] = useState('')
  const [schoolDropdownOpen, setSchoolDropdownOpen] = useState(false)
  const {
    items: schoolSearchItems,
    suggestions: schoolSuggestions,
    loading: schoolSearchLoading,
    suggesting: schoolSuggestLoading,
    reload: reloadSchools,
  } = useSchoolSearch(schoolSearch)
  const schoolPanelRef = useRef<HTMLDivElement>(null)
  const [savingSchool, setSavingSchool] = useState(false)
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [selectedSchoolName, setSelectedSchoolName] = useState('')
  const [examPreview, setExamPreview] = useState<null | {
    code: string
    title: string
    examUrl: string
    qrDataUrl: string | null
    loadingQr: boolean
  }>(null)
  const [attachTarget, setAttachTarget] = useState<CreatedExamRow | null>(null)
  const [createdExams, setCreatedExams] = useState<Array<{
    id: string
    code: string
    title: string
    status: string
    durationMinutes: number
    totalQuestions: number
    createdAt: string
    examUrl: string
    className: string
    schoolName: string
  }>>([])
  const [teacherMarked, setTeacherMarked] = useState(false)
  const { toast } = useToast()
  const createdExamResultRef = useRef<HTMLDivElement | null>(null)
  const createdExamListRef = useRef<HTMLDivElement | null>(null)
  const examFormHydratedRef = useRef(false)

  const buildExamReviewUrl = useCallback(
    (examCode: string) => `/giao-trinh/giao-vien/de-thi/${encodeURIComponent(examCode)}?t=${Date.now()}`,
    []
  )
  const buildTeacherPaperUrl = useCallback(
    (examCode: string) => `/giao-trinh/giao-vien/mo-de/${encodeURIComponent(examCode)}`,
    []
  )
  const showTeacherExamActions = teacherMarked || createdExams.length > 0
  useEffect(() => {
    if (isMarkedExamTeacher()) setTeacherMarked(true)
  }, [])
  const noteTeacher = () => {
    markExamTeacher()
    setTeacherMarked(true)
  }
  const curriculaStorageKey = useMemo(
    () => `${isHomework ? 'tao-bai-tap-ve-nha' : 'tao-bai-thi'}:selected-curricula:${subjectId}:${gradeLevelId}`,
    [isHomework, subjectId, gradeLevelId]
  )
  const clearCurriculaDraft = () => {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.removeItem(curriculaStorageKey)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const syncLocale = () => setUiLocale(getWebLocaleFromCookie())
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const dict = useMemo(() => getDictionary(uiLocale), [uiLocale])
  const tx = dict.createExamPage

  const loadCreatedExams = async () => {
    setCreatedExamsLoading(true)
    try {
      const q = isHomework ? '?only=homework' : '?only=exam'
      const res = await fetch(`/api/exam-session/mine${q}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCreatedExams([])
        return
      }
      setCreatedExams(Array.isArray(data?.items) ? data.items : [])
    } catch {
      setCreatedExams([])
    } finally {
      setCreatedExamsLoading(false)
    }
  }

  useEffect(() => {
    void loadCreatedExams()
  }, [isHomework])

  useLayoutEffect(() => {
    const d = readExamFormDefaults(formDefaultsPrimary, formDefaultsLegacy)
    if (!d) {
      examFormHydratedRef.current = true
      if (isHomework) setExamType('hocky')
      return
    }
    if (!isHomework && d.examType && EXAM_TYPE_ID_SET.has(d.examType)) setExamType(d.examType)
    if (typeof d.subjectId === 'string' && d.subjectId && d.subjectId !== 'khac' && d.subjectId.length <= 40) {
      setSubjectId(d.subjectId)
    }
    if (d.gradeLevelId && GRADE_LEVEL_ID_SET.has(d.gradeLevelId)) {
      setGradeLevelId(d.gradeLevelId as (typeof GRADE_LEVELS)[number]['id'])
    }
    if (typeof d.title === 'string') setTitle(d.title)
    if (typeof d.schoolSearch === 'string') setSchoolSearch(d.schoolSearch)
    if (typeof d.selectedSchoolId === 'string') setSelectedSchoolId(d.selectedSchoolId)
    if (typeof d.selectedSchoolName === 'string') setSelectedSchoolName(d.selectedSchoolName)
    const cid = typeof d.selectedClassId === 'string' ? d.selectedClassId : ''
    setSelectedClassId(cid)
    if (typeof d.newClassSubject === 'string') {
      const raw = d.newClassSubject.trim()
      if (raw && raw !== 'khac' && (isClassSubjectId(raw) || !raw.includes(' '))) setNewClassSubject(raw)
      else {
        const mapped = subjectIdFromFreeLabel(raw)
        setNewClassSubject(mapped === 'khac' ? '' : mapped)
      }
    }
    if (typeof d.newClassTeacher === 'string') setNewClassTeacher(d.newClassTeacher)
    examFormHydratedRef.current = true
    if (isHomework) setExamType('hocky')
  }, [formDefaultsPrimary, formDefaultsLegacy, isHomework])

  useEffect(() => {
    if (!examFormHydratedRef.current) return
    writeExamFormDefaults(
      {
        version: EXAM_FORM_DEFAULTS_VERSION,
        examType,
        subjectId,
        gradeLevelId,
        title,
        schoolSearch,
        selectedSchoolId,
        selectedSchoolName,
        selectedClassId,
        newClassSubject,
        newClassTeacher,
      },
      formDefaultsPrimary,
      formDefaultsLegacy
    )
  }, [
    formDefaultsPrimary,
    formDefaultsLegacy,
    examType,
    subjectId,
    gradeLevelId,
    title,
    schoolSearch,
    selectedSchoolId,
    selectedSchoolName,
    selectedClassId,
    newClassSubject,
    newClassTeacher,
  ])

  const loadTeacherClasses = useCallback(async () => {
    setClassesLoading(true)
    try {
      const res = await fetch('/api/classes/mine', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setTeacherClasses([])
        return
      }
      const rawItems = Array.isArray(data?.items) ? data.items : []
      const classes: Array<{
        id: string
        name: string
        joinCode: string
        schoolId: string
        schoolName: string
        gradeLevelId: string
        subjectLabel: string
        teacherDisplayName: string
      }> = rawItems.map((c: Record<string, unknown>) => ({
        id: String(c.id ?? ''),
        name: String(c.name ?? ''),
        joinCode: String(c.joinCode ?? ''),
        schoolId: String(c.schoolId ?? ''),
        schoolName: String(c.schoolName ?? ''),
        gradeLevelId: String(c.gradeLevelId ?? ''),
        subjectLabel: String(c.subjectLabel ?? '').trim(),
        teacherDisplayName: String(c.teacherDisplayName ?? '').trim(),
      }))
      setTeacherClasses(classes)
      setSelectedClassId((prev) => {
        const p = String(prev ?? '').trim()
        if (p && classes.some((row) => row.id === p)) return p
        return classes.length ? String(classes[0].id) : ''
      })
      const ds = data?.defaultSchool
      if (ds) {
        setDefaultsForNewClass({
          subject: String(ds.defaultSubjectLabel ?? '').trim(),
          teacher: String(ds.teacherDisplayName ?? '').trim(),
        })
      }
    } catch {
      setTeacherClasses([])
    } finally {
      setClassesLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTeacherClasses()
  }, [loadTeacherClasses])

  const chooseSavedSchool = async (item: SchoolSearchHit) => {
    setSavingSchool(true)
    try {
      const saved = await voteSavedSchool({
        schoolId: item.id,
        choice: item.choice,
        setAsDefault: false,
      })
      if (!saved.ok) {
        toast({
          title: tx.error,
          description: saved.error || tx.schoolAiFailed,
          variant: 'destructive',
        })
        return
      }
      const label = saved.canonicalName || item.name
      setSelectedSchoolId(saved.schoolId)
      setSelectedSchoolName(label)
      setSchoolSearch(label)
      setSchoolDropdownOpen(false)
      reloadSchools()
    } catch (e) {
      toast({
        title: tx.error,
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      })
    } finally {
      setSavingSchool(false)
    }
  }

  const renameSchool = async (schoolId: string, name: string) => {
    const saved = await renameSavedSchool({ schoolId, name })
    if (!saved.ok) {
      toast({
        title: tx.error,
        description: saved.error || tx.schoolAiFailed,
        variant: 'destructive',
      })
      return false
    }
    reloadSchools()
    return true
  }

  const pickSchoolName = async (rawName: string, siblingNames?: string[]) => {
    const raw = rawName.trim()
    if (raw.length < 3) return
    setSavingSchool(true)
    try {
      const saved = await savePickedSchool({
        name: raw,
        siblingNames,
        query: schoolSearch.trim(),
        setAsDefault: false,
      })
      if (!saved.ok) {
        toast({
          title: tx.error,
          description: saved.error || tx.schoolAiFailed,
          variant: 'destructive',
        })
        return
      }
      setSelectedSchoolId(saved.schoolId)
      setSelectedSchoolName(saved.canonicalName)
      setSchoolSearch(saved.canonicalName)
      setSchoolDropdownOpen(false)
    } catch (e) {
      toast({
        title: tx.error,
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      })
    } finally {
      setSavingSchool(false)
    }
  }

  const createTeacherClass = async (): Promise<boolean> => {
    const className = newClassName.trim()
    if (!selectedSchoolId) {
      toast({
        title: tx.missingSchool,
        description: tx.selectSchoolBeforeClass,
        variant: 'destructive',
      })
      return false
    }
    if (!className) {
      toast({
        title: tx.missingClassName,
        description: tx.enterClassName,
        variant: 'destructive',
      })
      return false
    }
    if (!newClassSubject.trim()) {
      toast({
        title: tx.error,
        description: dict.classes.enterClassSubject,
        variant: 'destructive',
      })
      return false
    }
    setCreatingClass(true)
    try {
      const res = await fetch('/api/classes/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          className,
          schoolId: selectedSchoolId,
          gradeLevelId,
          subjectId: newClassSubject,
          teacherDisplayName: newClassTeacher.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (data?.code === 'class_exists' && data?.existing?.id) {
        const existingId = String(data.existing.id)
        const existingName = String(data.existing.name ?? className)
        const owned = teacherClasses.some((c) => c.id === existingId)
        toast({
          title: tx.error,
          description: `${dict.classes.classNameTaken.replaceAll('{name}', existingName)} ${dict.classes.classNameTakenHint}`,
          variant: 'destructive',
        })
        if (owned) {
          setSelectedClassId(existingId)
          setShowCreateClassModal(false)
        }
        return false
      }
      if (!res.ok || !data?.item?.id) {
        toast({
          title: tx.error,
          description: data?.error ?? tx.createClassFailed,
          variant: 'destructive',
        })
        return false
      }
      const item = data.item as {
        id: string
        name: string
        joinCode: string
        schoolId: string
        schoolName: string
        gradeLevelId?: string
        subjectLabel?: string
        teacherDisplayName?: string
      }
      const normalized = {
        id: item.id,
        name: item.name,
        joinCode: item.joinCode,
        schoolId: item.schoolId,
        schoolName: item.schoolName,
        gradeLevelId: String(item.gradeLevelId ?? gradeLevelId ?? ''),
        subjectLabel: String(item.subjectLabel ?? '').trim(),
        teacherDisplayName: String(item.teacherDisplayName ?? '').trim(),
      }
      setTeacherClasses((prev) => (prev.some((c) => c.id === normalized.id) ? prev : [normalized, ...prev]))
      setSelectedClassId(String(item.id))
      setNewClassName('')
      setNewClassSubject('')
      setNewClassTeacher('')
      const attached =
        data.status === 'attached'
          ? dict.classes.enterClassAttached
          : data.status === 'already'
            ? dict.classes.enterClassAlready
            : tx.classCreatedDesc
      toast({
        title: data.status === 'created' ? tx.classCreated : tx.classCreated,
        description: attached,
      })
      return true
    } catch (e) {
      toast({
        title: tx.error,
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      })
      return false
    } finally {
      setCreatingClass(false)
    }
  }

  useEffect(() => {
    setBrowseLoading(true)
    listCurriculaForExam({ subjectId, gradeLevelId, limit: 300 })
      .then((allRes) => {
        if (allRes && 'items' in allRes) setCurriculaList(allRes.items ?? [])
        else setCurriculaList([])
      })
      .catch(() => {
        setCurriculaList([])
      })
      .finally(() => setBrowseLoading(false))
  }, [subjectId, gradeLevelId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.sessionStorage.getItem(curriculaStorageKey)
      if (!raw) {
        setSelectedCurriculumIds(new Set())
        return
      }
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        setSelectedCurriculumIds(new Set())
        return
      }
      const ids = parsed.map((x) => String(x ?? '').trim()).filter(Boolean)
      setSelectedCurriculumIds(new Set(ids))
    } catch {
      setSelectedCurriculumIds(new Set())
    }
  }, [curriculaStorageKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (selectedCurriculumIds.size === 0) {
        window.sessionStorage.removeItem(curriculaStorageKey)
      } else {
        window.sessionStorage.setItem(curriculaStorageKey, JSON.stringify([...selectedCurriculumIds]))
      }
    } catch {
      // ignore storage failures (private mode, quota, etc.)
    }
  }, [selectedCurriculumIds, curriculaStorageKey])

  useEffect(() => {
    if (curriculaList.length === 0 || selectedCurriculumIds.size === 0) return
    const validIds = new Set(curriculaList.map((c) => c.id))
    const filtered = [...selectedCurriculumIds].filter((id) => validIds.has(id))
    if (filtered.length !== selectedCurriculumIds.size) {
      setSelectedCurriculumIds(new Set(filtered))
    }
  }, [curriculaList, selectedCurriculumIds])

  useEffect(() => {
    setSelectedQuizQuestionIds(new Set())
    setQuizMinutesById({})
    setQuizPointsById({})
    setSelectedEssayQuestionIds(new Set())
    setEssayMinutesById({})
    setShowEssayPicker(false)
    setQuickViewItem(null)
  }, [selectedCurriculumIds])

  useEffect(() => {
    if (selectedCurriculumIds.size === 0) {
      setQuestionCatalog([])
      return
    }
    let cancelled = false
    const load = async () => {
      setQuestionCatalogLoading(true)
      try {
        const selectedCurricula = [...selectedCurriculumIds]
        const curriculumById = new Map(
          curriculaList.map((c) => [c.id, c.topic])
        )
        const allItems: Array<{
          id: string
          type: 'quiz' | 'essay'
          difficulty: string
          source: string
          verifiedAt: string | null
          createdAt: string
          createdIn: 'exam' | 'worksheet'
          topic: string
          preview: string
          problem: string
          solution: string
          curriculumId: string
          curriculumTopic: string
        }> = []
        for (const curriculumId of selectedCurricula) {
          const res = await fetch(`/api/worksheet/curriculum-questions-catalog?curriculumId=${encodeURIComponent(curriculumId)}&type=all&limit=100&offset=0`)
          const data = await res.json().catch(() => ({}))
          if (!res.ok || !Array.isArray(data?.items)) continue
          for (const row of data.items as Array<{ id: string; type: string; difficulty?: string; source?: string; verified_at?: string | null; created_at?: string; created_in?: string; topic?: string; preview?: string; problem?: string; solution?: string }>) {
            if (row.type !== 'quiz' && row.type !== 'essay') continue
            allItems.push({
              id: row.id,
              type: row.type,
              difficulty: String(row.difficulty ?? '').trim(),
              source: String(row.source ?? '').trim(),
              verifiedAt: row.verified_at ?? null,
              createdAt: String(row.created_at ?? ''),
              createdIn: row.created_in === 'exam' ? 'exam' : 'worksheet',
              topic: String(row.topic ?? ''),
              preview: String(row.preview ?? ''),
              problem: String(row.problem ?? ''),
              solution: String(row.solution ?? ''),
              curriculumId,
              curriculumTopic: curriculumById.get(curriculumId) ?? '',
            })
          }
        }
        if (!cancelled) {
          const dedup = new Map<string, (typeof allItems)[number]>()
          for (const item of allItems) {
            if (!dedup.has(item.id)) dedup.set(item.id, item)
          }
          setQuestionCatalog([...dedup.values()])
        }
      } catch {
        if (!cancelled) setQuestionCatalog([])
      } finally {
        if (!cancelled) setQuestionCatalogLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [selectedCurriculumIds, curriculaList, catalogReloadToken])

  const toggleCurriculum = (id: string) => {
    setSelectedCurriculumIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const quizCatalog = useMemo(() => questionCatalog.filter((q) => q.type === 'quiz'), [questionCatalog])
  const essayCatalog = useMemo(() => questionCatalog.filter((q) => q.type === 'essay'), [questionCatalog])

  const selectedQuizQuestions = useMemo(
    () => quizCatalog.filter((q) => selectedQuizQuestionIds.has(q.id)),
    [quizCatalog, selectedQuizQuestionIds]
  )
  const selectedEssayQuestions = useMemo(
    () => essayCatalog.filter((q) => selectedEssayQuestionIds.has(q.id)),
    [essayCatalog, selectedEssayQuestionIds]
  )
  const orderedQuizQuestionIds = useMemo(
    () => selectedQuizQuestions.map((q) => q.id),
    [selectedQuizQuestions]
  )
  const orderedEssayQuestionIds = useMemo(
    () => selectedEssayQuestions.map((q) => q.id),
    [selectedEssayQuestions]
  )
  const essaySummary = useMemo(() => {
    const normLevel = (raw: string) => {
      const x = String(raw || '').trim().toLowerCase()
      if (x === 'nhan-biet' || x === 'van-dung-thap' || x === 'van-dung-cao' || x === 'thuc-te') return x
      return 'thong-hieu'
    }
    const rows: Array<{ key: string; label: string; count: number; minutes: number }> = [
      { key: 'nhan-biet', label: tx.levelRecognition, count: 0, minutes: 0 },
      { key: 'thong-hieu', label: tx.levelComprehension, count: 0, minutes: 0 },
      { key: 'van-dung-thap', label: tx.levelLowApplication, count: 0, minutes: 0 },
      { key: 'van-dung-cao', label: tx.levelHighApplication, count: 0, minutes: 0 },
      { key: 'thuc-te', label: tx.levelPractical, count: 0, minutes: 0 },
    ]
    const byKey = new Map(rows.map((r) => [r.key, r]))
    for (const q of selectedEssayQuestions) {
      const key = normLevel(q.difficulty)
      const m = Number(essayMinutesById[q.id] ?? 0)
      const minutes = Number.isFinite(m) ? Math.max(0, roundExamMinutes(m)) : 0
      const row = byKey.get(key)
      if (!row) continue
      row.count += 1
      row.minutes += minutes
    }
    const filtered = rows.filter((r) => r.count > 0)
    let totalPoints = 0
    for (const q of selectedEssayQuestions) {
      const pt = Number(essayPointsById[q.id] ?? 0)
      totalPoints += Number.isFinite(pt) ? Math.max(0, Math.min(200, Math.round(pt * 100) / 100)) : 0
    }
    return {
      rows: filtered,
      totalCount: filtered.reduce((sum, r) => sum + r.count, 0),
      totalMinutes: roundExamMinutes(filtered.reduce((sum, r) => sum + r.minutes, 0)),
      totalPoints,
    }
  }, [selectedEssayQuestions, essayMinutesById, essayPointsById, tx])
  const essayLevelLabel = (level: string) => {
    const x = String(level || '').trim().toLowerCase()
    if (x === 'nhan-biet') return tx.levelRecognition
    if (x === 'thong-hieu') return tx.levelComprehension
    if (x === 'van-dung-thap') return tx.levelLowApplication
    if (x === 'van-dung-cao') return tx.levelHighApplication
    if (x === 'thuc-te') return tx.levelPractical
    return tx.levelComprehension
  }
  const sourceLabel = (source: string) => {
    const x = String(source || '').trim().toLowerCase()
    if (x === 'sgk') return tx.sourceTextbook
    if (x === 'ai') return tx.sourceAi
    if (x === 'edited') return tx.sourceEdited
    if (!x) return tx.sourceOther
    return x
  }
  const totalQuizCount = selectedQuizQuestions.length
  const totalQuizMinutes = useMemo(
    () =>
      roundExamMinutes(
        selectedQuizQuestions.reduce(
          (sum, q) => sum + roundExamMinutes(Number(quizMinutesById[q.id] ?? 0)),
          0
        )
      ),
    [selectedQuizQuestions, quizMinutesById]
  )
  const totalQuizPoints = useMemo(
    () =>
      roundExamPoints(
        selectedQuizQuestions.reduce(
          (sum, q) => sum + roundExamPoints(Number(quizPointsById[q.id] ?? 0)),
          0
        )
      ),
    [selectedQuizQuestions, quizPointsById]
  )
  const totalExamMinutes = roundExamMinutes(totalQuizMinutes + essaySummary.totalMinutes)
  const totalExamPoints = totalQuizPoints + essaySummary.totalPoints
  const totalExamPointsRounded = roundExamPoints(totalExamPoints)
  const examPointsRemaining = roundExamPoints(EXAM_FULL_SCORE - totalExamPointsRounded)
  const isExamPointsExact100 = Math.abs(totalExamPointsRounded - EXAM_FULL_SCORE) < 0.005
  const pointsOkForCreate = isHomework || isExamPointsExact100
  const selectedExamTypeDuration = useMemo(() => {
    const id = examType as ExamTypeId
    return EXAM_TYPE_DURATION[id] ?? EXAM_TYPE_DURATION['15ph']
  }, [examType])

  const examMinutesRemaining = roundExamMinutes(selectedExamTypeDuration - totalExamMinutes)
  const isExamMinutesExact = Math.abs(examMinutesRemaining) < 0.01
  const selectionFull =
    !isHomework && examPointsRemaining <= 0.005 && examMinutesRemaining <= 0.01

  const toggleEssayQuestion = useCallback(
    (id: string) => {
      setSelectedEssayQuestionIds((prev) => {
        if (!prev.has(id) && selectionFull) return prev
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      setEssayMinutesById((prev) => {
        const next = { ...prev }
        if (id in next) {
          delete next[id]
          return next
        }
        if (selectionFull) return prev
        const durationBudget = EXAM_TYPE_DURATION[examType as ExamTypeId] ?? EXAM_TYPE_DURATION['15ph']
        const qz = roundExamMinutes(
          Object.values(quizMinutesById).reduce((s, v) => s + roundExamMinutes(Number(v ?? 0)), 0)
        )
        const others = Object.entries(prev).reduce(
          (s, [, v]) => s + roundExamMinutes(Number(v ?? 0)),
          0
        )
        const room = floorExamMinutes(durationBudget - qz - others)
        next[id] = room <= 0 ? 0 : Math.min(10, room)
        return next
      })
      setEssayPointsById((prev) => {
        const next = { ...prev }
        if (id in next) {
          delete next[id]
          return next
        }
        if (selectionFull) return prev
        const qz = roundExamPoints(
          Object.values(quizPointsById).reduce((s, v) => s + roundExamPoints(Number(v ?? 0)), 0)
        )
        const others = Object.entries(prev).reduce(
          (s, [, v]) => s + roundExamPoints(Number(v ?? 0)),
          0
        )
        const room = Math.max(0, roundExamPoints(EXAM_FULL_SCORE - qz - others))
        next[id] = room <= 0 ? 0 : Math.min(10, room)
        return next
      })
    },
    [quizPointsById, quizMinutesById, examType, selectionFull]
  )

  const toggleQuizQuestion = useCallback(
    (id: string) => {
      setSelectedQuizQuestionIds((prev) => {
        if (!prev.has(id) && selectionFull) return prev
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      setQuizMinutesById((prev) => {
        const next = { ...prev }
        if (id in next) {
          delete next[id]
          return next
        }
        if (selectionFull) return prev
        const durationBudget = EXAM_TYPE_DURATION[examType as ExamTypeId] ?? EXAM_TYPE_DURATION['15ph']
        const essays = roundExamMinutes(
          Object.values(essayMinutesById).reduce((s, v) => s + roundExamMinutes(Number(v ?? 0)), 0)
        )
        const others = Object.entries(prev).reduce((s, [, v]) => s + roundExamMinutes(Number(v ?? 0)), 0)
        const room = floorExamMinutes(durationBudget - essays - others)
        next[id] = room <= 0 ? 0 : Math.min(1, room)
        return next
      })
      setQuizPointsById((prev) => {
        const next = { ...prev }
        if (id in next) {
          delete next[id]
          return next
        }
        if (selectionFull) return prev
        const essays = roundExamPoints(
          Object.values(essayPointsById).reduce((s, v) => s + roundExamPoints(Number(v ?? 0)), 0)
        )
        const others = Object.entries(prev).reduce((s, [, v]) => s + roundExamPoints(Number(v ?? 0)), 0)
        const room = Math.max(0, roundExamPoints(EXAM_FULL_SCORE - essays - others))
        next[id] = room <= 0 ? 0 : Math.min(1, room)
        return next
      })
    },
    [essayMinutesById, essayPointsById, examType, selectionFull]
  )

  const timeOkForCreate = isHomework || isExamMinutesExact
  const canCreateExam = pointsOkForCreate && timeOkForCreate
  const selectedExamTypeLabel = useMemo(() => examTypeButtonLabel(tx, examType), [tx, examType])
  const classOptions = useMemo(
    () => teacherClasses.filter((c) => !selectedSchoolId || c.schoolId === selectedSchoolId),
    [teacherClasses, selectedSchoolId]
  )
  useEffect(() => {
    if (classesLoading) return
    if (classOptions.length === 0) {
      setSelectedClassId('')
      return
    }
    if (!classOptions.some((c) => c.id === selectedClassId)) {
      setSelectedClassId(classOptions[0].id)
    }
  }, [classOptions, selectedClassId, classesLoading])
  const handleSubmit = async () => {
    if (!selectedSchoolId) {
      toast({
        title: tx.missingSchool,
        description: tx.selectSchoolBeforeExam,
        variant: 'destructive',
      })
      return
    }
    if (!selectedClassId) {
      toast({
        title: tx.missingClass,
        description: tx.selectClassBeforeExam,
        variant: 'destructive',
      })
      return
    }
    if (selectedQuizQuestionIds.size === 0) {
      toast({
        title: tx.noQuizSelected,
        description: tx.selectQuizMatchCounts,
        variant: 'destructive',
      })
      return
    }
    if (!isHomework && !isExamPointsExact100) {
      toast({
        title: tx.totalMustBe100,
        description: fillExamTpl(tx.totalMustBe100Desc, { total: String(totalExamPointsRounded) }),
        variant: 'destructive',
      })
      return
    }
    if (!isHomework && !isExamMinutesExact) {
      toast({
        title: tx.totalMustMatchDuration,
        description: fillExamTpl(tx.totalMustMatchDurationDesc, {
          total: String(totalExamMinutes),
          limit: String(selectedExamTypeDuration),
        }),
        variant: 'destructive',
      })
      return
    }
    setLoading(true)
    try {
      const review = await listExamTeacherReview([...selectedQuizQuestionIds, ...selectedEssayQuestionIds])
      if (review && 'error' in review && review.error) {
        toast({ title: tx.error, description: review.error, variant: 'destructive' })
        return
      }
      const items = (review && 'items' in review ? review.items : []) as ExamReviewItem[]
      if (items.length > 0) {
        setPendingReview(items)
        return
      }
    } catch (e) {
      toast({ title: tx.error, description: e instanceof Error ? e.message : String(e), variant: 'destructive' })
      return
    } finally {
      setLoading(false)
    }
    await submitCreatedExam()
  }

  const submitCreatedExam = async () => {
    setLoading(true)
    setResult(null)
    setQrDataUrl(null)
    try {
      const res = await fetch('/api/exam-session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examType,
          subjectId,
          gradeLevelId,
          classId: selectedClassId,
          schoolId: selectedSchoolId,
          title: title.trim() || (isHomework ? tx.defaultHomeworkTitle : tx.defaultExamTitle),
          locale: uiLocale,
          practiceHomework: isHomework,
          curriculumIds: [...selectedCurriculumIds],
          quizCountEasy: 0,
          quizCountMedium: 0,
          quizCountHard: 0,
          selectionMode: 'manual',
          quizQuestionCount: 0,
          selectedQuizQuestionIds: [...selectedQuizQuestionIds],
          quizMinutesById,
          quizPointsById,
          selectedEssayQuestionIds: [...selectedEssayQuestionIds],
          essayMinutesById,
          essayPointsById,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: tx.error, description: data?.error ?? res.statusText, variant: 'destructive' })
        return
      }
      if (data.success && data.code && data.examUrl) {
        noteTeacher()
        setPendingReview(null)
        clearCurriculaDraft()
        setSelectedCurriculumIds(new Set())
        setResult({
          code: data.code,
          examUrl: data.examUrl,
          totalQuestions: data.totalQuestions ?? 0,
          durationMinutes: data.durationMinutes ?? 15,
          title: title.trim() || (isHomework ? tx.defaultHomeworkTitle : tx.defaultExamTitle),
          className: String(data?.className ?? ''),
          schoolName: String(data?.schoolName ?? ''),
        })
        try {
          const qr = await QRCode.toDataURL(data.examUrl, { width: 200, margin: 2 })
          setQrDataUrl(qr)
        } catch {
          /* ignore */
        }
        void loadCreatedExams()
        setCreatedExamsSheetOpen(false)
        window.setTimeout(() => {
          const target = createdExamResultRef.current ?? createdExamListRef.current
          target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 80)
        toast({
          title: isHomework ? tx.homeworkCreateSuccess : tx.examCreateSuccess,
          description: isHomework ? tx.homeworkCreateSuccessDesc : tx.examCreateSuccessDesc,
          duration: 3000,
        })
      }
    } catch (e) {
      toast({ title: tx.error, description: e instanceof Error ? e.message : String(e), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const selectedCurriculumTopics = useMemo(
    () => curriculaList.filter((c) => selectedCurriculumIds.has(c.id)).map((c) => c.topic.trim()).filter(Boolean),
    [curriculaList, selectedCurriculumIds]
  )

  const applyPresetExam = async (sourceId: string, openReview: boolean) => {
    if (!selectedSchoolId) {
      toast({ title: tx.missingSchool, description: tx.selectSchoolBeforeExam, variant: 'destructive' })
      return
    }
    if (!selectedClassId) {
      toast({ title: tx.missingClass, description: tx.selectClassBeforeExam, variant: 'destructive' })
      return
    }
    const reviewWindow = openReview ? openDetachedTeacherSlideWindow('about:blank') : null
    setPresetBusy(true)
    try {
      const res = await fetch('/api/exam-session/from-preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceSessionId: sourceId,
          classId: selectedClassId,
          schoolId: selectedSchoolId,
          title: title.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success || !data?.code || !data?.examUrl) {
        if (reviewWindow && !reviewWindow.closed) reviewWindow.close()
        toast({ title: tx.error, description: data?.error ?? res.statusText, variant: 'destructive' })
        return
      }
      noteTeacher()
      setResult({
        code: data.code,
        examUrl: data.examUrl,
        totalQuestions: data.totalQuestions ?? 0,
        durationMinutes: data.durationMinutes ?? selectedExamTypeDuration,
        title: String(data.title ?? (title.trim() || tx.defaultExamTitle)),
        className: String(data?.className ?? ''),
        schoolName: String(data?.schoolName ?? ''),
      })
      try {
        const qr = await QRCode.toDataURL(data.examUrl, { width: 200, margin: 2 })
        setQrDataUrl(qr)
      } catch {
        setQrDataUrl(null)
      }
      void loadCreatedExams()
      window.setTimeout(() => {
        createdExamResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
      if (openReview) {
        navigateDetachedTeacherSlideWindow(reviewWindow, buildExamReviewUrl(String(data.code)))
      }
      toast({
        title: tx.examCreateSuccess,
        description: tx.examCreateSuccessDesc,
        duration: 3000,
      })
    } catch (e) {
      if (reviewWindow && !reviewWindow.closed) reviewWindow.close()
      toast({ title: tx.error, description: e instanceof Error ? e.message : String(e), variant: 'destructive' })
    } finally {
      setPresetBusy(false)
    }
  }

  const copyLink = () => {
    if (!result?.examUrl) return
    navigator.clipboard.writeText(result.examUrl)
    toast({ title: tx.copied, description: tx.linkCopiedDesc, duration: 2000 })
  }

  const deleteCreatedExam = async (code: string) => {
    const ok = typeof window !== 'undefined'
      ? window.confirm(isHomework ? tx.homeworkDeleteConfirm : tx.deleteExamConfirm)
      : true
    if (!ok) return
    setDeletingCode(code)
    try {
      const res = await fetch('/api/exam-session/mine', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: tx.error, description: data?.error ?? res.statusText, variant: 'destructive' })
        return
      }
      if (result?.code === code) {
        setResult(null)
        setQrDataUrl(null)
      }
      toast({
        title: isHomework ? tx.homeworkDeleted : tx.examDeleted,
        description: isHomework ? tx.homeworkDeletedDesc : tx.examDeletedDesc,
        duration: 2000,
      })
      void loadCreatedExams()
    } catch (e) {
      toast({ title: tx.error, description: e instanceof Error ? e.message : String(e), variant: 'destructive' })
    } finally {
      setDeletingCode(null)
    }
  }

  const openExamPreview = async (exam: { code: string; title: string; examUrl: string }) => {
    setCreatedExamsSheetOpen(false)
    setExamPreview({
      code: exam.code,
      title: exam.title,
      examUrl: exam.examUrl,
      qrDataUrl: null,
      loadingQr: true,
    })
    try {
      const qr = await QRCode.toDataURL(exam.examUrl, { width: 220, margin: 2 })
      setExamPreview({
        code: exam.code,
        title: exam.title,
        examUrl: exam.examUrl,
        qrDataUrl: qr,
        loadingQr: false,
      })
    } catch {
      setExamPreview((prev) => (prev ? { ...prev, loadingQr: false } : prev))
    }
  }

  const buildExamMarkdown = (examData: { title: string; durationMinutes: number; questions: Array<{ question_text: string; options: string[]; type?: string }> }): string => {
    const lines: string[] = [
      `# ${examData.title}`,
      '',
      `**Thời gian: ${examData.durationMinutes} phút**`,
      '',
      '---',
      '',
    ]
    examData.questions.forEach((q, i) => {
      const qText = latexToReadable(q.question_text)
      lines.push(`### Câu ${i + 1}. ${qText}`)
      lines.push('')
      const opts = Array.isArray(q.options) ? q.options : []
      if (opts.length > 0) {
        ;['A', 'B', 'C', 'D'].forEach((label, j) => {
          const opt = opts[j]
          if (opt) lines.push(`${label}. ${latexToReadable(opt)}`)
        })
      } else {
        lines.push('(Tự luận)')
      }
      lines.push('')
    })
    return lines.join('\n')
  }

  const handleExportPdf = async () => {
    if (!result?.code) return
    setExportLoading('pdf')
    try {
      const res = await fetch(`/api/exam-session/${encodeURIComponent(result.code)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        toast({ title: tx.error, description: data?.error ?? tx.loadExamFailed, variant: 'destructive' })
        return
      }
      const md = buildExamMarkdown({
        title: data.title || result.title,
        durationMinutes: data.durationMinutes ?? result.durationMinutes,
        questions: data.questions ?? [],
      })
      const filename = `${isHomework ? 'bai-tap-ve-nha' : 'bai-thi'}-${result.code}.pdf`
      await exportWorksheetToPdf(md, filename, null)
      toast({ title: tx.pdfExported, description: filename, duration: 2000 })
    } catch (e) {
      toast({ title: tx.error, description: e instanceof Error ? e.message : String(e), variant: 'destructive' })
    } finally {
      setExportLoading(null)
    }
  }

  const handleExportWord = async () => {
    if (!result?.code) return
    setExportLoading('word')
    try {
      const res = await fetch(`/api/exam-session/${encodeURIComponent(result.code)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        toast({ title: tx.error, description: data?.error ?? tx.loadExamFailed, variant: 'destructive' })
        return
      }
      const md = buildExamMarkdown({
        title: data.title || result.title,
        durationMinutes: data.durationMinutes ?? result.durationMinutes,
        questions: data.questions ?? [],
      })
      const filename = `${isHomework ? 'bai-tap-ve-nha' : 'bai-thi'}-${result.code}.docx`
      await exportWorksheetToWord(md, filename)
      toast({ title: tx.wordExported, description: filename, duration: 2000 })
    } catch (e) {
      toast({ title: tx.error, description: e instanceof Error ? e.message : String(e), variant: 'destructive' })
    } finally {
      setExportLoading(null)
    }
  }

  return (
    <>
      <Toaster />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            {isHomework ? (
              <NotebookPen className="h-7 w-7 text-sky-600" />
            ) : (
              <FileQuestion className="h-7 w-7 text-violet-600" />
            )}
            {isHomework ? tx.homeworkPageTitle : tx.pageTitle}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isHomework ? tx.homeworkPageSubtitle : tx.pageSubtitle}
          </p>
        </div>

        {result ? (
          <div ref={createdExamResultRef}>
          <Card className="border border-emerald-200 dark:border-emerald-800">
            <CardHeader>
              <CardTitle className="text-emerald-700 dark:text-emerald-400">
                {isHomework ? tx.homeworkCreatedBadge : tx.examCreatedBadge}
              </CardTitle>
              <CardDescription>
                {isHomework
                  ? fillExamTpl(tx.homeworkCreatedResultLine, { count: String(result.totalQuestions) })
                  : `${result.totalQuestions} ${tx.questions} · ${result.durationMinutes} ${tx.minutes}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                {qrDataUrl && (
                  <div className="flex-shrink-0 p-2 bg-white rounded-lg">
                    <Image src={qrDataUrl} alt="QR" width={160} height={160} className="w-40 h-40" />
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{tx.examLink}</span>
                  </div>
                  <div className="flex gap-2">
                    <Input readOnly value={result.examUrl} className="text-sm font-mono" />
                    <Button variant="outline" size="icon" onClick={copyLink} title={tx.copyLink}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tx.examCode}: <strong>{result.code}</strong>
                  </p>
                  {(result.className || result.schoolName) && (
                    <p className="text-xs text-muted-foreground">
                      {result.className ? `${tx.classLabel}: ${result.className}` : ''}
                      {result.className && result.schoolName ? ' · ' : ''}
                      {result.schoolName ? `${tx.schoolLabel}: ${result.schoolName}` : ''}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {showTeacherExamActions ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => openDetachedTeacherSlideWindow(buildExamReviewUrl(result.code))}
                        >
                          <BookOpen className="h-4 w-4" />
                          {tx.reviewSlides}
                        </Button>
                        <Button size="sm" asChild>
                          <Link href={buildTeacherPaperUrl(result.code)} target="_blank">
                            {tx.teacherOpenExam}
                          </Link>
                        </Button>
                      </>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportPdf}
                      disabled={exportLoading !== null}
                      className="gap-1.5"
                    >
                      {exportLoading === 'pdf' ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileDown className="h-4 w-4" />
                      )}
                      {tx.exportPdf}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportWord}
                      disabled={exportLoading !== null}
                      className="gap-1.5"
                    >
                      {exportLoading === 'word' ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      {tx.exportWord}
                    </Button>
                  </div>
                </div>
              </div>
              <Button
                variant="default"
                className="font-bold shadow-sm"
                onClick={() => { clearCurriculaDraft(); setSelectedCurriculumIds(new Set()); setResult(null); setQrDataUrl(null) }}
              >
                {isHomework ? tx.createAnotherHomework : tx.createAnotherExam}
              </Button>
            </CardContent>
          </Card>
          </div>
        ) : (
          <Card className="border shadow-sm">
            <div className="border-b border-border/70 bg-muted/25 px-4 py-3 sm:px-6">
              <Sheet
                open={createdExamsSheetOpen}
                onOpenChange={(open) => {
                  setCreatedExamsSheetOpen(open)
                  if (open) void loadCreatedExams()
                }}
              >
                <SheetTrigger asChild>
                  <Button type="button" variant="secondary" className="w-full gap-2 sm:w-auto touch-manipulation">
                    <ListOrdered className="h-4 w-4 shrink-0" aria-hidden />
                    {isHomework ? tx.openCreatedHomeworkListButton : tx.openCreatedExamsListButton}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden sm:max-w-md">
                  <SheetHeader className="space-y-1 text-left">
                    <SheetTitle>{isHomework ? tx.createdHomeworkListTitle : tx.createdExamsList}</SheetTitle>
                    <SheetDescription>{isHomework ? tx.createdHomeworkHint : tx.createdExamsHint}</SheetDescription>
                  </SheetHeader>
                  <div className="mt-4 min-h-0 flex-1 overflow-hidden pr-1">
                    <CreatedExamsListRows
                      loading={createdExamsLoading}
                      exams={createdExams}
                      tx={tx}
                      tcClasses={dict.classes}
                      webLocale={uiLocale}
                      buildExamReviewUrl={buildExamReviewUrl}
                      buildTeacherPaperUrl={buildTeacherPaperUrl}
                      showTeacherActions={showTeacherExamActions}
                      openExamPreview={openExamPreview}
                      deleteCreatedExam={deleteCreatedExam}
                      deletingCode={deletingCode}
                      scrollClassName="max-h-[calc(100dvh-10rem)]"
                      onAttachToOtherClass={(exam) => setAttachTarget(exam)}
                      homeworkList={isHomework}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <QrCode className="h-4 w-4 text-violet-600" />
                {isHomework ? tx.homeworkCardInfo : tx.cardExamInfo}
              </CardTitle>
              <CardDescription>
                {isHomework ? tx.homeworkFormCardDescription : tx.examFormCardDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tx.titleOptional}</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isHomework ? tx.homeworkTitlePlaceholder : tx.titlePlaceholder}
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tx.subject}</label>
                  <ClassSubjectField
                    id="exam-subject"
                    t={dict.classes}
                    locale={uiLocale}
                    value={subjectId}
                    onChange={setSubjectId}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tx.gradeLevelLabel}</label>
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

              <div className="space-y-3 rounded border p-3 bg-muted/20">
                <p className="text-sm font-semibold">{tx.targetSchoolAndClass}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">{tx.examFormRememberHint}</p>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tx.schoolLabel}</label>
                  <div className="relative">
                    <Input
                      value={schoolSearch}
                      onChange={(e) => {
                        const next = e.target.value
                        setSchoolSearch(next)
                        setSchoolDropdownOpen(true)
                        if (selectedSchoolName && next.trim() !== selectedSchoolName.trim()) {
                          setSelectedSchoolId('')
                          setSelectedSchoolName('')
                        }
                      }}
                      onFocus={() => setSchoolDropdownOpen(true)}
                      onBlur={() => {
                        window.setTimeout(() => {
                          if (schoolPanelRef.current?.contains(document.activeElement)) return
                          setSchoolDropdownOpen(false)
                        }, 180)
                      }}
                      placeholder={tx.schoolPlaceholder}
                      className="text-sm"
                      autoComplete="off"
                    />
                    {schoolDropdownOpen && schoolSearch.trim().length >= 2 && (
                      <div
                        ref={schoolPanelRef}
                        className="absolute left-0 right-0 top-full mt-1 z-20 max-h-80 overflow-y-auto rounded-md border bg-background p-1 shadow-md"
                        onMouseDown={(e) => {
                          const target = e.target as HTMLElement
                          if (target.closest('input, textarea')) return
                          e.preventDefault()
                        }}
                      >
                        <SchoolNameOptions
                          items={schoolSearchItems}
                          suggestions={schoolSuggestions}
                          loading={schoolSearchLoading}
                          suggesting={schoolSuggestLoading}
                          query={schoolSearch.trim()}
                          selectedId={selectedSchoolId}
                          selectedName={selectedSchoolName}
                          busy={savingSchool}
                          minCharsHint={tx.schoolMinChars}
                          labels={{
                            searching: tx.searchingSchools,
                            suggesting: dict.classes.createClassSchoolSuggesting,
                            suggestions: dict.classes.createClassSchoolSuggestions,
                            edit: dict.classes.createClassSchoolEdit,
                            save: dict.classes.createClassSchoolEditSave,
                            typeOwn: dict.classes.createClassSchoolTypeOwn,
                            typeOwnPlaceholder: dict.classes.createClassSchoolTypeOwnPlaceholder,
                          }}
                          onPickSaved={(item) => void chooseSavedSchool(item)}
                          onPickSuggestion={(name, siblingNames) => void pickSchoolName(name, siblingNames)}
                          onTypeOwn={(name) => void pickSchoolName(name)}
                          onRename={renameSchool}
                        />
                      </div>
                    )}
                  </div>
                  {selectedSchoolId && (
                    <p className="text-xs text-muted-foreground">
                      {tx.selectedPrefix}: <strong>{selectedSchoolName || schoolSearch}</strong>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tx.classLabel}</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                      disabled={classesLoading || classOptions.length === 0}
                    >
                      {classOptions.length === 0 ? (
                        <option value="">
                          {classesLoading
                            ? tx.loadingClasses
                            : tx.noClassClickNew}
                        </option>
                      ) : (
                        classOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))
                      )}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (!selectedSchoolId) {
                          toast({
                            title: tx.missingSchool,
                            description: tx.selectSchoolBeforeNewClass,
                            variant: 'destructive',
                          })
                          return
                        }
                        setNewClassSubject((s) => {
                          const raw = (s.trim() || defaultsForNewClass.subject).trim()
                          if (raw && raw !== 'khac' && (isClassSubjectId(raw) || !raw.includes(' '))) return raw
                          const mapped = subjectIdFromFreeLabel(raw)
                          return mapped === 'khac' ? '' : mapped
                        })
                        setNewClassTeacher((s) => s.trim() || defaultsForNewClass.teacher)
                        setShowCreateClassModal(true)
                      }}
                    >
                      {tx.createNew}
                    </Button>
                  </div>
                </div>
              </div>

              {!isHomework ? (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tx.examType}</label>
                  <div className="flex flex-wrap gap-2">
                    {EXAM_TYPE_ORDER.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setExamType(id)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          examType === id ? 'bg-violet-600 text-white' : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        {examTypeButtonLabel(tx, id)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5" />
                  {tx.selectCurricula}
                </label>
                {browseLoading ? (
                  <div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    {tx.loading}
                  </div>
                ) : curriculaList.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    {tx.noCurriculaForSubject}
                    <Link href="/giao-trinh" className="text-primary hover:underline">
                      {tx.createCurriculum}
                    </Link>
                    {tx.first}
                  </p>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-2 rounded border p-2 bg-muted/30">
                    {curriculaList.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                        <input type="checkbox" checked={selectedCurriculumIds.has(c.id)} onChange={() => toggleCurriculum(c.id)} className="rounded" />
                        <span className="text-sm truncate flex-1 min-w-0">{c.topic}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{c.subject_id} · {c.grade_level_id}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {!isHomework && selectedCurriculumTopics.length > 0 ? (
                <ExamPresetPanel
                  subjectId={subjectId}
                  gradeLevelId={gradeLevelId}
                  durationMinutes={selectedExamTypeDuration}
                  topics={selectedCurriculumTopics}
                  busy={presetBusy}
                  tx={tx}
                  onUse={(id, openReview) => void applyPresetExam(id, openReview)}
                  onMarkTeacher={noteTeacher}
                  allowTeacherActions={showTeacherExamActions}
                  onError={(message) => toast({ title: tx.error, description: message, variant: 'destructive' })}
                />
              ) : null}

              <div className="space-y-2">
                <p className="text-sm font-semibold">{tx.part1Quiz}</p>
                {isHomework ? (
                  <p className="text-xs text-muted-foreground">{tx.homeworkQuizPartFooterHint}</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">{tx.essayIntro100scale}</p>
                    <p className="text-xs text-muted-foreground">
                      {fillExamTpl(tx.essayIntroDuration, { limit: String(selectedExamTypeDuration) })}
                    </p>
                  </>
                )}
                {selectedCurriculumIds.size === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {tx.selectCurriculaForQuizList}
                  </p>
                ) : (
                  <>
                    <ExamCreateQuestions
                      kind="quiz"
                      curricula={curriculaList}
                      subjectId={subjectId}
                      gradeLevelId={gradeLevelId}
                      labels={{
                        title: tx.createQuizButton,
                        count: tx.createQuestionCount,
                        lesson: tx.createQuestionLesson,
                        addType: tx.createQuestionAddType,
                        removeType: tx.createQuestionRemoveType,
                        submit: tx.createQuestionSubmit,
                        charge: tx.createQuestionCharge,
                        chargeMixed: tx.createQuestionChargeMixed,
                        running: tx.createQuestionRunning,
                        done: tx.createQuestionDone,
                        reportTitle: tx.createReportTitle,
                        reportCreated: tx.createReportCreated,
                        reportFailed: tx.createReportFailed,
                        reportCredits: tx.createReportCredits,
                        reportFree: tx.createReportFree,
                        reportMixed: tx.createReportMixed,
                        reportPlace: tx.createReportPlace,
                        reportClose: tx.createReportClose,
                        difficulty: tx.colDifficulty,
                        error: tx.error,
                        levels: { easy: tx.easy, medium: tx.medium, hard: tx.hard },
                      }}
                      onDone={(curriculumId) => {
                        setSelectedCurriculumIds((prev) => {
                          if (prev.has(curriculumId)) return prev
                          const next = new Set(prev)
                          next.add(curriculumId)
                          return next
                        })
                        setCatalogReloadToken((n) => n + 1)
                      }}
                      onError={(message) => toast({ title: tx.error, description: message, variant: 'destructive' })}
                    />
                    {questionCatalogLoading ? (
                      <div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        {tx.loadingQuestionList}
                      </div>
                    ) : (
                    <>
                    <Input
                      placeholder={tx.searchQuizPlaceholder}
                      value={quizQuestionSearch}
                      onChange={(e) => setQuizQuestionSearch(e.target.value)}
                      className="text-sm h-8"
                    />
                    <div className="max-h-[36rem] overflow-y-auto space-y-2 rounded border p-2 bg-muted/30">
                      {quizCatalog
                        .filter((q) => {
                          const needle = quizQuestionSearch.trim().toLowerCase()
                          if (!needle) return true
                          return (
                            q.preview.toLowerCase().includes(needle) ||
                            q.topic.toLowerCase().includes(needle) ||
                            q.curriculumTopic.toLowerCase().includes(needle)
                          )
                        })
                        .map((q) => {
                          const diff = q.difficulty === 'easy' || q.difficulty === 'hard' ? q.difficulty : 'medium'
                          const checked = selectedQuizQuestionIds.has(q.id)
                          const minutesValue = roundExamMinutes(Number(quizMinutesById[q.id] ?? 0))
                          const maxQuizMin = checked
                            ? maxQuizMinutesForQuestion(
                              q.id,
                              orderedQuizQuestionIds,
                              quizMinutesById,
                              essaySummary.totalMinutes,
                              selectedExamTypeDuration
                            )
                            : 0
                          const maxQuizPts = checked
                            ? maxQuizPointsForQuestion(
                              q.id,
                              orderedQuizQuestionIds,
                              quizPointsById,
                              essaySummary.totalPoints
                            )
                            : 0
                          return (
                            <div
                              key={`quiz-${q.id}`}
                              className={`rounded border p-2 space-y-2 ${
                                checked
                                  ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-400/80 dark:bg-emerald-950/40'
                                  : q.createdIn === 'exam'
                                    ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/40'
                                    : 'border-border bg-background/60'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={!checked && selectionFull}
                                  title={!checked && selectionFull ? tx.selectionFullLock : undefined}
                                  onChange={() => toggleQuizQuestion(q.id)}
                                  className="rounded mt-1 disabled:cursor-not-allowed disabled:opacity-40"
                                />
                                <div className="min-w-0 flex-1 space-y-2">
                                  <div className="flex flex-wrap gap-2 text-xs">
                                    <span className="rounded px-1.5 py-0.5 bg-emerald-100 text-emerald-700">{tx.badgeQuiz}</span>
                                    <span className="rounded px-1.5 py-0.5 bg-sky-100 text-sky-700">
                                      {diff === 'easy' ? tx.easy : diff === 'hard' ? tx.hard : tx.medium}
                                    </span>
                                    <span className={`rounded px-1.5 py-0.5 ${q.verifiedAt ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                      {q.verifiedAt ? tx.verified : tx.unverified}
                                    </span>
                                    <span className={`rounded px-1.5 py-0.5 ${q.createdIn === 'exam' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                                      {q.createdIn === 'exam' ? tx.createdInExam : tx.createdInWorksheet}
                                      {q.createdAt ? ` · ${new Date(q.createdAt).toLocaleString(uiLocale)}` : ''}
                                    </span>
                                    {q.curriculumTopic ? (
                                      <span className="rounded px-1.5 py-0.5 bg-violet-100 text-violet-700">
                                        {tx.lessonTag}: {q.curriculumTopic}
                                      </span>
                                    ) : null}
                                    {checked ? (
                                      <span className="rounded px-1.5 py-0.5 bg-emerald-600 text-white">
                                        {tx.selectedBadge}
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="text-sm whitespace-pre-wrap">{q.preview}</p>
                                  {checked && !isHomework ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border border-emerald-200 bg-white/80 p-2 dark:bg-background/60">
                                      <div className="space-y-1">
                                        <div className="grid grid-cols-[1fr_5rem] gap-2 items-center">
                                          <p className="text-xs text-muted-foreground">{tx.timeMinutes}</p>
                                          <Input
                                            type="number"
                                            min={0}
                                            max={selectedExamTypeDuration}
                                            step={0.5}
                                            value={String(minutesValue)}
                                            onChange={(e) => {
                                              const n = Number(e.target.value)
                                              setQuizMinutesById((prev) => {
                                                const current = roundExamMinutes(Number(prev[q.id] ?? 0))
                                                const typed = Number.isFinite(n) ? Math.max(0, roundExamMinutes(n)) : 0
                                                const cap = maxQuizMinutesForQuestion(
                                                  q.id,
                                                  orderedQuizQuestionIds,
                                                  prev,
                                                  essaySummary.totalMinutes,
                                                  selectedExamTypeDuration
                                                )
                                                const normalized = Math.min(typed, Math.max(cap, current))
                                                return { ...prev, [q.id]: normalized }
                                              })
                                            }}
                                            className="h-8 text-sm"
                                          />
                                        </div>
                                        <div className="grid grid-cols-[1fr_5rem] gap-2 items-start">
                                          <span className="min-w-0" aria-hidden />
                                          <p
                                            className={`text-[11px] leading-snug text-right tabular-nums ${
                                              isExamMinutesExact
                                                ? 'text-green-700 dark:text-green-400 font-medium'
                                                : 'text-amber-800 dark:text-amber-200 font-medium'
                                            }`}
                                          >
                                            {isExamMinutesExact
                                              ? fillExamTpl(tx.equalsDuration, { limit: String(selectedExamTypeDuration) })
                                              : examMinutesRemaining > 0.01
                                                ? fillExamTpl(tx.minutesShort, { n: String(examMinutesRemaining) })
                                                : fillExamTpl(tx.minutesOver, {
                                                    n: String(roundExamMinutes(-examMinutesRemaining)),
                                                  })}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <div className="grid grid-cols-[1fr_5rem] gap-2 items-center">
                                          <p className="text-xs text-muted-foreground">{tx.maxPoints}</p>
                                          <Input
                                            type="number"
                                            min={0}
                                            max={maxQuizPts}
                                            step={0.5}
                                            value={String(quizPointsById[q.id] ?? 0)}
                                            onChange={(e) => {
                                              const n = Number(e.target.value)
                                              setQuizPointsById((prev) => {
                                                const cap = maxQuizPointsForQuestion(
                                                  q.id,
                                                  orderedQuizQuestionIds,
                                                  prev,
                                                  essaySummary.totalPoints
                                                )
                                                const normalized = Number.isFinite(n)
                                                  ? Math.max(0, Math.min(cap, Math.round(n * 100) / 100))
                                                  : 0
                                                return { ...prev, [q.id]: normalized }
                                              })
                                            }}
                                            className="h-8 text-sm"
                                          />
                                        </div>
                                        <div className="grid grid-cols-[1fr_5rem] gap-2 items-start">
                                          <span className="min-w-0" aria-hidden />
                                          <p
                                            className={`text-[11px] leading-snug text-right tabular-nums ${
                                              isExamPointsExact100
                                                ? 'text-green-700 dark:text-green-400 font-medium'
                                                : 'text-amber-800 dark:text-amber-200 font-medium'
                                            }`}
                                          >
                                            {isExamPointsExact100
                                              ? tx.equals100
                                              : examPointsRemaining > 0.005
                                                ? fillExamTpl(tx.ptsShort, { n: String(examPointsRemaining) })
                                                : fillExamTpl(tx.ptsOver, {
                                                    n: String(roundExamPoints(-examPointsRemaining)),
                                                  })}
                                          </p>
                                        </div>
                                      </div>
                                      <p className="text-xs text-muted-foreground col-span-full sm:col-span-2">
                                        {fillExamTpl(tx.quizMaxMinutesLine, { max: String(maxQuizMin) })}
                                      </p>
                                      <p className="text-xs text-muted-foreground col-span-full sm:col-span-2">
                                        {fillExamTpl(tx.quizMaxPointsLine, { max: String(maxQuizPts) })}
                                      </p>
                                    </div>
                                  ) : null}
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1"
                                  onClick={() => setQuickViewItem({
                                    id: q.id,
                                    type: q.type,
                                    preview: q.preview,
                                    problem: q.problem,
                                    solution: q.solution,
                                  })}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  {tx.quickView}
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      {quizCatalog.length === 0 && (
                        <p className="text-xs text-muted-foreground py-2">
                          {tx.noQuizInCurricula}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tx.selectedQuiz}: {selectedQuizQuestionIds.size} {tx.questions}
                    </p>
                    </>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-2 rounded border p-3">
                <p className="text-sm font-semibold">{tx.part2Essay}</p>
                {isHomework ? (
                  <p className="text-xs text-muted-foreground">{tx.homeworkEssayNo100Note}</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {tx.essayIntroNoRandom}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tx.essayIntro100scale}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fillExamTpl(tx.essayIntroDuration, { limit: String(selectedExamTypeDuration) })}
                    </p>
                  </>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEssayPicker((prev) => !prev)}
                >
                  {showEssayPicker ? tx.hideEssayPicker : tx.showEssayPicker}
                </Button>

                {showEssayPicker && (
                  <>
                    {selectedCurriculumIds.size === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {tx.selectCurriculaBeforeEssay}
                      </p>
                    ) : (
                      <>
                        <ExamCreateQuestions
                          kind="essay"
                          curricula={curriculaList}
                          subjectId={subjectId}
                          gradeLevelId={gradeLevelId}
                          labels={{
                            title: tx.createEssayButton,
                            count: tx.createQuestionCount,
                            lesson: tx.createQuestionLesson,
                            addType: tx.createQuestionAddType,
                            removeType: tx.createQuestionRemoveType,
                            submit: tx.createQuestionSubmit,
                            charge: tx.createQuestionCharge,
                            chargeMixed: tx.createQuestionChargeMixed,
                            running: tx.createQuestionRunning,
                            done: tx.createQuestionDone,
                            reportTitle: tx.createReportTitle,
                            reportCreated: tx.createReportCreated,
                            reportFailed: tx.createReportFailed,
                            reportCredits: tx.createReportCredits,
                            reportFree: tx.createReportFree,
                            reportMixed: tx.createReportMixed,
                            reportPlace: tx.createReportPlace,
                            reportClose: tx.createReportClose,
                            difficulty: tx.colDifficulty,
                            error: tx.error,
                            levels: {
                              'nhan-biet': tx.levelRecognition,
                              'thong-hieu': tx.levelComprehension,
                              'van-dung-thap': tx.levelLowApplication,
                              'van-dung-cao': tx.levelHighApplication,
                              'thuc-te': tx.levelPractical,
                            },
                          }}
                          onDone={(curriculumId) => {
                            setSelectedCurriculumIds((prev) => {
                              if (prev.has(curriculumId)) return prev
                              const next = new Set(prev)
                              next.add(curriculumId)
                              return next
                            })
                            setCatalogReloadToken((n) => n + 1)
                          }}
                          onError={(message) => toast({ title: tx.error, description: message, variant: 'destructive' })}
                        />
                        {questionCatalogLoading ? (
                          <div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            {tx.loadingQuestionList}
                          </div>
                        ) : (
                        <div className="space-y-3">
                        <p className="text-xs font-medium text-muted-foreground">{tx.essayQuestionList}</p>
                        <Input
                          placeholder={tx.searchEssayPlaceholder}
                          value={essayQuestionSearch}
                          onChange={(e) => setEssayQuestionSearch(e.target.value)}
                          className="text-sm h-8"
                        />
                        <div className="max-h-[36rem] overflow-y-auto space-y-2 rounded border p-2 bg-muted/30">
                          {essayCatalog
                            .filter((q) => {
                              const needle = essayQuestionSearch.trim().toLowerCase()
                              if (!needle) return true
                              return (
                                q.preview.toLowerCase().includes(needle) ||
                                q.topic.toLowerCase().includes(needle) ||
                                q.curriculumTopic.toLowerCase().includes(needle)
                              )
                            })
                            .map((q) => {
                              const checked = selectedEssayQuestionIds.has(q.id)
                              const value = roundExamMinutes(Number(essayMinutesById[q.id] ?? 0))
                              const maxEssayMin = checked
                                ? maxEssayMinutesForQuestion(
                                  q.id,
                                  orderedEssayQuestionIds,
                                  essayMinutesById,
                                  totalQuizMinutes,
                                  selectedExamTypeDuration
                                )
                                : 0
                              const maxEssayPts = checked
                                ? maxEssayPointsForQuestion(
                                  q.id,
                                  orderedEssayQuestionIds,
                                  essayPointsById,
                                  totalQuizPoints
                                )
                                : 0
                              return (
                              <div
                                key={`essay-${q.id}`}
                                className={`rounded border p-2 space-y-2 ${
                                  checked
                                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-400/80 dark:bg-emerald-950/40'
                                    : q.createdIn === 'exam'
                                      ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/40'
                                      : 'border-border bg-background/60'
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={!checked && selectionFull}
                                    title={!checked && selectionFull ? tx.selectionFullLock : undefined}
                                    onChange={() => toggleEssayQuestion(q.id)}
                                    className="rounded mt-1 disabled:cursor-not-allowed disabled:opacity-40"
                                  />
                                  <div className="min-w-0 flex-1 space-y-2">
                                    <div className="flex flex-wrap gap-1.5">
                                      <span className="rounded px-1.5 py-0.5 text-[11px] bg-amber-100 text-amber-700">
                                        {tx.badgeEssay}
                                      </span>
                                      <span className={`rounded px-1.5 py-0.5 text-[11px] ${q.verifiedAt ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                        {q.verifiedAt ? tx.verified : tx.unverified}
                                      </span>
                                      <span className={`rounded px-1.5 py-0.5 text-[11px] ${q.createdIn === 'exam' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                                        {q.createdIn === 'exam' ? tx.createdInExam : tx.createdInWorksheet}
                                        {q.createdAt ? ` · ${new Date(q.createdAt).toLocaleString(uiLocale)}` : ''}
                                      </span>
                                      <span className="rounded px-1.5 py-0.5 text-[11px] bg-violet-100 text-violet-700">
                                        {essayLevelLabel(q.difficulty)}
                                      </span>
                                      <span className="rounded px-1.5 py-0.5 text-[11px] bg-sky-100 text-sky-700">
                                        {sourceLabel(q.source)}
                                      </span>
                                      {q.topic ? (
                                        <span className="rounded px-1.5 py-0.5 text-[11px] bg-slate-100 text-slate-700">
                                          {q.topic}
                                        </span>
                                      ) : null}
                                      {q.curriculumTopic ? (
                                        <span className="rounded px-1.5 py-0.5 text-[11px] bg-emerald-100 text-emerald-700">
                                          {q.curriculumTopic}
                                        </span>
                                      ) : null}
                                      {checked ? (
                                        <span className="rounded px-1.5 py-0.5 text-[11px] bg-emerald-600 text-white">
                                          {tx.selectedBadge}
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="text-sm whitespace-pre-wrap">{q.preview}</p>
                                    {checked && !isHomework ? (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border border-emerald-200 bg-white/80 p-2 dark:bg-background/60">
                                        <div className="space-y-1">
                                          <div className="grid grid-cols-[1fr_5rem] gap-2 items-center">
                                            <p className="text-xs text-muted-foreground">{tx.timeMinutes}</p>
                                            <Input
                                              type="number"
                                              min={0}
                                              max={selectedExamTypeDuration}
                                              step={0.5}
                                              value={String(value)}
                                              onChange={(e) => {
                                                const n = Number(e.target.value)
                                                setEssayMinutesById((prev) => {
                                                  const current = roundExamMinutes(Number(prev[q.id] ?? 0))
                                                  const typed = Number.isFinite(n) ? Math.max(0, roundExamMinutes(n)) : 0
                                                  const cap = maxEssayMinutesForQuestion(
                                                    q.id,
                                                    orderedEssayQuestionIds,
                                                    prev,
                                                    totalQuizMinutes,
                                                    selectedExamTypeDuration
                                                  )
                                                  const normalized = Math.min(typed, Math.max(cap, current))
                                                  return { ...prev, [q.id]: normalized }
                                                })
                                              }}
                                              className="h-8 text-sm"
                                            />
                                          </div>
                                          <div className="grid grid-cols-[1fr_5rem] gap-2 items-start">
                                            <span className="min-w-0" aria-hidden />
                                            <p
                                              className={`text-[11px] leading-snug text-right tabular-nums ${
                                                isExamMinutesExact
                                                  ? 'text-green-700 dark:text-green-400 font-medium'
                                                  : 'text-amber-800 dark:text-amber-200 font-medium'
                                              }`}
                                            >
                                              {isExamMinutesExact
                                                ? fillExamTpl(tx.equalsDuration, { limit: String(selectedExamTypeDuration) })
                                                : examMinutesRemaining > 0.01
                                                  ? fillExamTpl(tx.minutesShort, { n: String(examMinutesRemaining) })
                                                  : fillExamTpl(tx.minutesOver, {
                                                      n: String(roundExamMinutes(-examMinutesRemaining)),
                                                    })}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="space-y-1">
                                          <div className="grid grid-cols-[1fr_5rem] gap-2 items-center">
                                            <p className="text-xs text-muted-foreground">{tx.maxPoints}</p>
                                            <Input
                                              type="number"
                                              min={0}
                                              max={maxEssayPts}
                                              step={0.5}
                                              value={String(essayPointsById[q.id] ?? 0)}
                                              onChange={(e) => {
                                                const n = Number(e.target.value)
                                                setEssayPointsById((prev) => {
                                                  const cap = maxEssayPointsForQuestion(
                                                    q.id,
                                                    orderedEssayQuestionIds,
                                                    prev,
                                                    totalQuizPoints
                                                  )
                                                  const normalized = Number.isFinite(n)
                                                    ? Math.max(0, Math.min(cap, Math.round(n * 100) / 100))
                                                    : 0
                                                  return { ...prev, [q.id]: normalized }
                                                })
                                              }}
                                              className="h-8 text-sm"
                                            />
                                          </div>
                                          <div className="grid grid-cols-[1fr_5rem] gap-2 items-start">
                                            <span className="min-w-0" aria-hidden />
                                            <p
                                              className={`text-[11px] leading-snug text-right tabular-nums ${
                                                isExamPointsExact100
                                                  ? 'text-green-700 dark:text-green-400 font-medium'
                                                  : 'text-amber-800 dark:text-amber-200 font-medium'
                                              }`}
                                            >
                                              {isExamPointsExact100
                                                ? tx.equals100
                                                : examPointsRemaining > 0.005
                                                  ? fillExamTpl(tx.ptsShort, { n: String(examPointsRemaining) })
                                                  : fillExamTpl(tx.ptsOver, {
                                                      n: String(roundExamPoints(-examPointsRemaining)),
                                                    })}
                                            </p>
                                          </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground col-span-full sm:col-span-2">
                                          {fillExamTpl(tx.essayMaxMinutesLine, { max: String(maxEssayMin) })}
                                        </p>
                                        <p className="text-xs text-muted-foreground col-span-full sm:col-span-2">
                                          {fillExamTpl(tx.essayMaxAllowedLine, { max: String(maxEssayPts) })}
                                        </p>
                                      </div>
                                    ) : null}
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-8 gap-1"
                                    onClick={() => setQuickViewItem({
                                      id: q.id,
                                      type: q.type,
                                      preview: q.preview,
                                      problem: q.problem,
                                      solution: q.solution,
                                    })}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    {tx.quickView}
                                  </Button>
                                </div>
                              </div>
                            )})}
                          {essayCatalog.length === 0 && (
                            <p className="text-xs text-muted-foreground py-2">
                              {tx.noEssayInPicker}
                            </p>
                          )}
                        </div>
                        </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-2 rounded border p-3 bg-muted/20">
                <p className="text-sm font-semibold">{tx.summaryBeforeCreate}</p>
                {isHomework ? (
                  <div className="space-y-1 text-sm">
                    <p>{fillExamTpl(tx.homeworkSummaryMc, { count: String(totalQuizCount) })}</p>
                    <p>{fillExamTpl(tx.homeworkSummaryEssay, { count: String(essaySummary.totalCount) })}</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">{tx.quizSection}</p>
                      <p className="pt-1">
                        {tx.quizSubtotalLabel}: <strong>{totalQuizCount}</strong> {tx.questions} — <strong>{totalQuizMinutes}</strong> {tx.minutes} — <strong>{roundExamPoints(totalQuizPoints)}</strong> {tx.points}
                      </p>
                    </div>
                    <div className="space-y-1 text-sm pt-1">
                      <p className="font-medium">{tx.essaySection}</p>
                      {essaySummary.rows.length > 0 ? (
                        essaySummary.rows.map((row) => (
                          <p key={`summary-${row.key}`}>
                            {row.label}: <strong>{row.count}</strong> {tx.questions} - <strong>{row.minutes}</strong> {tx.minutes}
                          </p>
                        ))
                      ) : (
                        <p className="text-muted-foreground">{tx.noEssaySelectedSummary}</p>
                      )}
                      <p className="pt-1">
                        {tx.essayTotalLabel}: <strong>{essaySummary.totalCount}</strong> {tx.questions} —{' '}
                        <strong>{essaySummary.totalMinutes}</strong> {tx.minutes} — <strong>{Math.round(essaySummary.totalPoints * 100) / 100}</strong>{' '}
                        {tx.points}
                      </p>
                    </div>
                    <div
                      className={`rounded-md border px-3 py-2 text-sm ${
                        isExamPointsExact100
                          ? 'border-green-300/80 bg-green-50/50 dark:bg-green-950/20'
                          : 'border-amber-300 bg-amber-50/80 dark:bg-amber-950/25'
                      }`}
                    >
                      <p>
                        {tx.targetLabel}: <strong>100</strong> {tx.pointsFullExam}
                        {' · '}
                        {tx.allocated}: <strong>{totalExamPointsRounded}</strong>
                        {!isExamPointsExact100 ? (
                          <>
                            {' · '}
                            {examPointsRemaining > 0.005 ? (
                              <span className="text-amber-900 dark:text-amber-100">
                                {fillExamTpl(tx.ptsShort, { n: String(examPointsRemaining) })}
                              </span>
                            ) : (
                              <span className="text-amber-900 dark:text-amber-100">
                                {fillExamTpl(tx.ptsOver, { n: String(roundExamPoints(-examPointsRemaining)) })}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-green-800 dark:text-green-200"> — {tx.equals100}</span>
                        )}
                      </p>
                    </div>
                    <div
                      className={`rounded-md border px-3 py-2 text-sm ${
                        isExamMinutesExact
                          ? 'border-green-300/80 bg-green-50/50 dark:bg-green-950/20'
                          : 'border-amber-300 bg-amber-50/80 dark:bg-amber-950/25'
                      }`}
                    >
                      <p>
                        {tx.targetLabel}: <strong>{selectedExamTypeDuration}</strong> {tx.minutes}
                        {' · '}
                        {tx.allocated}: <strong>{totalExamMinutes}</strong>
                        {isExamMinutesExact ? (
                          <span className="text-green-800 dark:text-green-200">
                            {' '}— {fillExamTpl(tx.equalsDuration, { limit: String(selectedExamTypeDuration) })}
                          </span>
                        ) : examMinutesRemaining > 0.01 ? (
                          <span className="text-amber-900 dark:text-amber-100">
                            {' · '}
                            {fillExamTpl(tx.minutesShort, { n: String(examMinutesRemaining) })}
                          </span>
                        ) : (
                          <span className="text-amber-900 dark:text-amber-100">
                            {' · '}
                            {fillExamTpl(tx.minutesOver, { n: String(roundExamMinutes(-examMinutesRemaining)) })}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                      {tx.totalDurationNeeded}: <strong>{totalExamMinutes}</strong> {tx.minutes}
                      {' · '}
                      {tx.totalPointsExam}: <strong>{totalExamPointsRounded}</strong>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tx.selectedExamType}: <strong>{selectedExamTypeLabel}</strong>
                    </p>
                    <div className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                      {tx.officialExamDuration}: <strong>{selectedExamTypeDuration}</strong> {tx.minutes}
                    </div>
                  </>
                )}
              </div>

              {pendingReview && pendingReview.length > 0 ? (
                <ExamCreateReviewGate
                  items={pendingReview}
                  locale={uiLocale}
                  createLabel={isHomework ? tx.createHomework : tx.createExam}
                  creatingLabel={tx.creating}
                  creating={loading}
                  onCancel={() => setPendingReview(null)}
                  onCreate={() => { void submitCreatedExam() }}
                />
              ) : null}
              <Button
                onClick={handleSubmit}
                disabled={loading || !canCreateExam}
                className="w-full"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    {questionCatalog.some((q) => (selectedQuizQuestionIds.has(q.id) || selectedEssayQuestionIds.has(q.id)) && !q.verifiedAt)
                      ? tx.examVerifyThenCreate
                      : tx.creating}
                  </>
                ) : !pointsOkForCreate ? (
                  <>
                    <FileQuestion className="h-4 w-4 mr-2" />
                    {tx.need100ToCreate}
                  </>
                ) : !timeOkForCreate ? (
                  <>
                    <FileQuestion className="h-4 w-4 mr-2" />
                    {fillExamTpl(tx.needDurationToCreate, { limit: String(selectedExamTypeDuration) })}
                  </>
                ) : (
                  <>
                    <FileQuestion className="h-4 w-4 mr-2" />
                    {isHomework ? tx.createHomework : tx.createExam}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        <div ref={createdExamListRef}>
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">
              {isHomework ? tx.createdHomeworkListTitle : tx.createdExamsList}
            </CardTitle>
            <CardDescription>
              {isHomework ? tx.createdHomeworkHint : tx.createdExamsHint}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <CreatedExamsListRows
              loading={createdExamsLoading}
              exams={createdExams}
              tx={tx}
              tcClasses={dict.classes}
              webLocale={uiLocale}
              buildExamReviewUrl={buildExamReviewUrl}
              buildTeacherPaperUrl={buildTeacherPaperUrl}
              showTeacherActions={showTeacherExamActions}
              openExamPreview={openExamPreview}
              deleteCreatedExam={deleteCreatedExam}
              deletingCode={deletingCode}
              onAttachToOtherClass={(exam) => setAttachTarget(exam)}
              homeworkList={isHomework}
            />
          </CardContent>
        </Card>
        </div>
      </div>
      <AttachExamToClassDialog
        open={attachTarget !== null}
        onOpenChange={(o) => {
          if (!o) setAttachTarget(null)
        }}
        sourceSessionId={attachTarget?.id ?? ''}
        examTitle={attachTarget?.title}
        tc={dict.classes}
        onSuccess={() => void loadCreatedExams()}
      />
      {examPreview && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white text-slate-900 shadow-xl">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <p className="text-sm font-semibold">{tx.scanQrTitle}</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setExamPreview(null)}>
                {tx.close}
              </Button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm font-medium">{examPreview.title} - {examPreview.code}</p>
              <div className="rounded border p-3 bg-muted/30 flex items-center justify-center min-h-[240px]">
                {examPreview.loadingQr ? (
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : examPreview.qrDataUrl ? (
                  <Image src={examPreview.qrDataUrl} alt="QR exam" width={224} height={224} className="w-56 h-56" />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {tx.qrFailedUseLink}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Input readOnly value={examPreview.examUrl} className="text-xs font-mono" />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(examPreview.examUrl)}
                  >
                    {tx.copyLink}
                  </Button>
                  <Button type="button" size="sm" asChild>
                    <Link href={examPreview.examUrl} target="_blank">
                      {tx.openOnThisDevice}
                    </Link>
                  </Button>
                  {showTeacherExamActions ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => openDetachedTeacherSlideWindow(buildExamReviewUrl(examPreview.code))}
                      >
                        {tx.review}
                      </Button>
                      <Button type="button" size="sm" asChild>
                        <Link href={buildTeacherPaperUrl(examPreview.code)} target="_blank">
                          {tx.teacherOpenExam}
                        </Link>
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showCreateClassModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg border bg-background shadow-xl">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <p className="text-sm font-semibold">{tx.createNewClass}</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreateClassModal(false)}>
                {tx.close}
              </Button>
            </div>
            <div className="p-4 space-y-3">
              {!selectedSchoolId && (
                <p className="text-xs text-muted-foreground">
                  {tx.selectSchoolAboveForClass}
                </p>
              )}
              <Input
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder={tx.newClassNamePlaceholder}
                className="text-sm"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    {tx.subjectForStudents}
                  </label>
                  <ClassSubjectField
                    id="new-class-subject"
                    t={dict.classes}
                    locale={uiLocale}
                    value={newClassSubject}
                    onChange={setNewClassSubject}
                    disabled={creatingClass}
                    compact
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    {tx.teacherForStudents}
                  </label>
                  <Input
                    value={newClassTeacher}
                    onChange={(e) => setNewClassTeacher(e.target.value)}
                    placeholder={tx.teacherForStudentsPh}
                    maxLength={120}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateClassModal(false)}>
                  {tx.cancel}
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    const ok = await createTeacherClass()
                    if (ok) setShowCreateClassModal(false)
                  }}
                  disabled={creatingClass || !newClassName.trim() || !newClassSubject.trim()}
                >
                  {creatingClass ? tx.creating : tx.createClass}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {quickViewItem && (
        <ExamQuestionQuickView
          questionId={quickViewItem.id}
          fallbackProblem={quickViewItem.problem || quickViewItem.preview}
          fallbackSolution={quickViewItem.solution}
          labels={{
            title: tx.quickViewTitle,
            close: tx.close,
            problem: tx.problem,
            solution: tx.solution,
            noProblem: tx.noProblem,
            noSolution: tx.noSolution,
            edit: tx.quickViewEdit,
            save: tx.quickViewSave,
            confirm: tx.quickViewConfirm,
            disagree: tx.quickViewDisagree,
            usingEdit: tx.quickViewUsingEdit,
            usingOriginal: tx.quickViewUsingOriginal,
            originalCompare: tx.quickViewOriginalCompare,
            editCompare: tx.quickViewEditCompare,
            counts: tx.quickViewCounts,
            rule: tx.quickViewRule,
            editShort: tx.quickViewEditShort,
            editBad: tx.quickViewEditBad,
          }}
          onClose={() => setQuickViewItem(null)}
        />
      )}
    </>
  )
}
