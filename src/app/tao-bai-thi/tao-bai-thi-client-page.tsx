'use client'

import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import Link from 'next/link'
import Image from 'next/image'
import { FileQuestion, RefreshCw, QrCode, Copy, Link2, BookOpen, FileDown, FileText, Eye, Trash2 } from 'lucide-react'
import QRCode from 'qrcode'
import { SUBJECTS, GRADE_LEVELS, GRADE_LEVEL_GROUPS } from '../tao-giao-trinh/lib/curriculum-subjects'
import { listCurriculaForExam } from '../tao-giao-trinh/actions'
import { latexToReadable } from '../tao-giao-trinh/lib/latex-to-readable'
import { exportWorksheetToPdf, exportWorksheetToWord } from '../tao-giao-trinh/lib/worksheet-export'
import { getDictionary, type Dictionary } from '@/lib/i18n/dictionaries'
import { DEFAULT_WEB_LOCALE, normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'

function getWebLocaleFromCookie(): WebLocale {
  if (typeof document === 'undefined') return DEFAULT_WEB_LOCALE
  const cookieValue = document.cookie
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('nanoai_locale='))
    ?.split('=')[1]
    ?.trim()
  return normalizeWebLocale(cookieValue) ?? DEFAULT_WEB_LOCALE
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

const EXAM_FORM_DEFAULTS_KEY = 'nanoai_tao_bai_thi_form_defaults_v1'
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

function readExamFormDefaults(): Partial<ExamFormDefaultsV1> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(EXAM_FORM_DEFAULTS_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as ExamFormDefaultsV1
    if (!p || p.version !== EXAM_FORM_DEFAULTS_VERSION) return null
    return p
  } catch {
    return null
  }
}

function writeExamFormDefaults(payload: ExamFormDefaultsV1) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(EXAM_FORM_DEFAULTS_KEY, JSON.stringify(payload))
  } catch {
    // ignore quota / private mode
  }
}

const SUBJECT_ID_SET: Set<string> = new Set(SUBJECTS.map((s) => s.id))
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

/** Trần điểm/câu cho một mức TN khi các mức khác + tổng TL giữ nguyên */
function maxQuizPointsPerQuestionForLevel(
  level: 'easy' | 'medium' | 'hard',
  counts: { easy: number; medium: number; hard: number },
  points: { easy: number; medium: number; hard: number },
  essayPointsTotal: number
): number {
  const otherQuiz =
    (level === 'easy' ? 0 : counts.easy * roundExamPoints(points.easy))
    + (level === 'medium' ? 0 : counts.medium * roundExamPoints(points.medium))
    + (level === 'hard' ? 0 : counts.hard * roundExamPoints(points.hard))
  const room = EXAM_FULL_SCORE - essayPointsTotal - otherQuiz
  const c = counts[level]
  if (c <= 0) return 50
  const perQ = roundExamPoints(room / c)
  return Math.max(0.25, Math.min(50, perQ))
}

export default function TaoBaiThiClientPage() {
  const [uiLocale, setUiLocale] = useState<WebLocale>(DEFAULT_WEB_LOCALE)
  const [examType, setExamType] = useState<string>('15ph')
  const [subjectId, setSubjectId] = useState('toan')
  const [gradeLevelId, setGradeLevelId] = useState('lop-12')
  const [title, setTitle] = useState('')
  const [quizMinutesByDifficulty, setQuizMinutesByDifficulty] = useState<{ easy: number; medium: number; hard: number }>({
    easy: 1,
    medium: 1.5,
    hard: 2,
  })
  const [quizPointsByDifficulty, setQuizPointsByDifficulty] = useState<{ easy: number; medium: number; hard: number }>({
    easy: 1,
    medium: 1.5,
    hard: 2,
  })
  const [quizCountByDifficulty, setQuizCountByDifficulty] = useState<{ easy: number; medium: number; hard: number }>({
    easy: 0,
    medium: 0,
    hard: 0,
  })
  const [selectedQuizQuestionIds, setSelectedQuizQuestionIds] = useState<Set<string>>(new Set())
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
  const [createdExamsLoading, setCreatedExamsLoading] = useState(false)
  const [deletingCode, setDeletingCode] = useState<string | null>(null)
  const [classesLoading, setClassesLoading] = useState(false)
  const [creatingClass, setCreatingClass] = useState(false)
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
  const [schoolSearch, setSchoolSearch] = useState('')
  const [schoolDropdownOpen, setSchoolDropdownOpen] = useState(false)
  const [schoolSearchLoading, setSchoolSearchLoading] = useState(false)
  const [schoolSearchItems, setSchoolSearchItems] = useState<Array<{ id: string; name: string }>>([])
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [selectedSchoolName, setSelectedSchoolName] = useState('')
  const [examPreview, setExamPreview] = useState<null | {
    code: string
    title: string
    examUrl: string
    qrDataUrl: string | null
    loadingQr: boolean
  }>(null)
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
  const { toast } = useToast()
  const createdExamResultRef = useRef<HTMLDivElement | null>(null)
  const createdExamListRef = useRef<HTMLDivElement | null>(null)
  const examFormHydratedRef = useRef(false)

  const buildExamReviewUrl = useCallback(
    (examCode: string) => `/giao-trinh/giao-vien/de-thi/${encodeURIComponent(examCode)}?t=${Date.now()}`,
    []
  )
  const curriculaStorageKey = useMemo(
    () => `tao-bai-thi:selected-curricula:${subjectId}:${gradeLevelId}`,
    [subjectId, gradeLevelId]
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
      const res = await fetch('/api/exam-session/mine', { cache: 'no-store' })
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
  }, [])

  useLayoutEffect(() => {
    const d = readExamFormDefaults()
    if (!d) {
      examFormHydratedRef.current = true
      return
    }
    if (d.examType && EXAM_TYPE_ID_SET.has(d.examType)) setExamType(d.examType)
    if (d.subjectId && SUBJECT_ID_SET.has(d.subjectId)) {
      setSubjectId(d.subjectId as (typeof SUBJECTS)[number]['id'])
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
    if (typeof d.newClassSubject === 'string') setNewClassSubject(d.newClassSubject)
    if (typeof d.newClassTeacher === 'string') setNewClassTeacher(d.newClassTeacher)
    examFormHydratedRef.current = true
  }, [])

  useEffect(() => {
    if (!examFormHydratedRef.current) return
    writeExamFormDefaults({
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
    })
  }, [
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

  useEffect(() => {
    const needle = schoolSearch.trim()
    if (needle.length < 2) {
      setSchoolSearchItems([])
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setSchoolSearchLoading(true)
      try {
        const res = await fetch(`/api/schools/search?q=${encodeURIComponent(needle)}`, { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setSchoolSearchItems([])
          return
        }
        setSchoolSearchItems(Array.isArray(data?.items) ? data.items : [])
      } catch {
        if (!cancelled) {
          setSchoolSearchItems([])
        }
      } finally {
        if (!cancelled) setSchoolSearchLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [schoolSearch])

  const searchAndSaveSchoolByAi = async () => {
    const needle = schoolSearch.trim()
    if (needle.length < 3) {
      toast({
        title: tx.missingInput,
        description: tx.missingInputSchoolAi,
        variant: 'destructive',
      })
      return
    }
    setSchoolSearchLoading(true)
    try {
      const res = await fetch('/api/schools/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: needle, useAi: true, setAsDefault: false }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.schoolId) {
        toast({
          title: tx.error,
          description: data?.error ?? tx.schoolAiFailed,
          variant: 'destructive',
        })
        return
      }
      const canonicalName = String(data?.canonicalName ?? needle).trim()
      const schoolId = String(data.schoolId)
      setSchoolSearch(canonicalName)
      setSchoolSearchItems((prev) => {
        const dedup = prev.filter((x) => x.id !== schoolId)
        return [{ id: schoolId, name: canonicalName }, ...dedup]
      })
      toast({
        title: tx.schoolAiNormalized,
        description: tx.schoolAiNormalizedDesc,
      })
    } catch (e) {
      toast({
        title: tx.error,
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      })
    } finally {
      setSchoolSearchLoading(false)
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
    setCreatingClass(true)
    try {
      const res = await fetch('/api/classes/mine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: className,
          schoolId: selectedSchoolId,
          gradeLevelId,
          subjectLabel: newClassSubject.trim(),
          teacherDisplayName: newClassTeacher.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
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
        gradeLevelId: string
        subjectLabel?: string
        teacherDisplayName?: string
      }
      const normalized = {
        ...item,
        subjectLabel: String(item.subjectLabel ?? '').trim(),
        teacherDisplayName: String(item.teacherDisplayName ?? '').trim(),
      }
      setTeacherClasses((prev) => [normalized, ...prev])
      setSelectedClassId(String(item.id))
      setNewClassName('')
      setNewClassSubject('')
      setNewClassTeacher('')
      toast({
        title: tx.classCreated,
        description: tx.classCreatedDesc,
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
    setSelectedEssayQuestionIds(new Set())
    setEssayMinutesById({})
    setShowEssayPicker(false)
    setQuickViewItem(null)
    setQuestionCatalog([])
    if (selectedCurriculumIds.size === 0) return
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
          for (const row of data.items as Array<{ id: string; type: string; difficulty?: string; source?: string; verified_at?: string | null; topic?: string; preview?: string; problem?: string; solution?: string }>) {
            if (row.type !== 'quiz' && row.type !== 'essay') continue
            allItems.push({
              id: row.id,
              type: row.type,
              difficulty: String(row.difficulty ?? '').trim(),
              source: String(row.source ?? '').trim(),
              verifiedAt: row.verified_at ?? null,
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
  }, [selectedCurriculumIds, curriculaList])

  const toggleCurriculum = (id: string) => {
    setSelectedCurriculumIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleQuizQuestion = (id: string) => {
    setSelectedQuizQuestionIds((prev) => {
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
      const m = Number(essayMinutesById[q.id] ?? 10)
      const minutes = Number.isFinite(m) ? Math.max(1, Math.min(20, Math.floor(m))) : 10
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
      totalMinutes: filtered.reduce((sum, r) => sum + r.minutes, 0),
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
  const totalQuizCount = quizCountByDifficulty.easy + quizCountByDifficulty.medium + quizCountByDifficulty.hard
  const totalQuizMinutes = useMemo(
    () =>
      (quizCountByDifficulty.easy * quizMinutesByDifficulty.easy)
      + (quizCountByDifficulty.medium * quizMinutesByDifficulty.medium)
      + (quizCountByDifficulty.hard * quizMinutesByDifficulty.hard),
    [quizCountByDifficulty, quizMinutesByDifficulty]
  )
  const totalQuizPoints = useMemo(
    () =>
      quizCountByDifficulty.easy * quizPointsByDifficulty.easy
      + quizCountByDifficulty.medium * quizPointsByDifficulty.medium
      + quizCountByDifficulty.hard * quizPointsByDifficulty.hard,
    [quizCountByDifficulty, quizPointsByDifficulty]
  )
  const totalExamMinutes = totalQuizMinutes + essaySummary.totalMinutes
  const totalExamPoints = totalQuizPoints + essaySummary.totalPoints
  const totalExamPointsRounded = roundExamPoints(totalExamPoints)
  const examPointsRemaining = roundExamPoints(EXAM_FULL_SCORE - totalExamPointsRounded)
  const isExamPointsExact100 = Math.abs(totalExamPointsRounded - EXAM_FULL_SCORE) < 0.005

  const toggleEssayQuestion = useCallback(
    (id: string) => {
      setSelectedEssayQuestionIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      setEssayMinutesById((prev) => {
        const next = { ...prev }
        if (id in next) delete next[id]
        else next[id] = 10
        return next
      })
      setEssayPointsById((prev) => {
        const next = { ...prev }
        if (id in next) {
          delete next[id]
          return next
        }
        const qz =
          quizCountByDifficulty.easy * quizPointsByDifficulty.easy
          + quizCountByDifficulty.medium * quizPointsByDifficulty.medium
          + quizCountByDifficulty.hard * quizPointsByDifficulty.hard
        const others = Object.entries(prev).reduce(
          (s, [, v]) => s + roundExamPoints(Number(v ?? 0)),
          0
        )
        const room = Math.max(0, roundExamPoints(EXAM_FULL_SCORE - qz - others))
        next[id] = room <= 0 ? 0 : Math.min(10, room)
        return next
      })
    },
    [quizCountByDifficulty, quizPointsByDifficulty]
  )

  const selectedExamTypeDuration = useMemo(() => {
    const id = examType as ExamTypeId
    return EXAM_TYPE_DURATION[id] ?? EXAM_TYPE_DURATION['15ph']
  }, [examType])
  const isDurationExceeded = totalExamMinutes > selectedExamTypeDuration
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
  const selectedQuizCountByDifficulty = useMemo(() => {
    let easy = 0
    let medium = 0
    let hard = 0
    for (const q of selectedQuizQuestions) {
      if (q.difficulty === 'easy') easy += 1
      else if (q.difficulty === 'hard') hard += 1
      else medium += 1
    }
    return { easy, medium, hard }
  }, [selectedQuizQuestions])
  const remainingQuizCountByDifficulty = useMemo(
    () => ({
      easy: Math.max(0, quizCountByDifficulty.easy - selectedQuizCountByDifficulty.easy),
      medium: Math.max(0, quizCountByDifficulty.medium - selectedQuizCountByDifficulty.medium),
      hard: Math.max(0, quizCountByDifficulty.hard - selectedQuizCountByDifficulty.hard),
    }),
    [quizCountByDifficulty, selectedQuizCountByDifficulty]
  )

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
    if (totalQuizCount <= 0) {
      toast({
        title: tx.invalidQuestionCount,
        description: tx.setQuestionCountHint,
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
    if (remainingQuizCountByDifficulty.easy > 0 || remainingQuizCountByDifficulty.medium > 0 || remainingQuizCountByDifficulty.hard > 0) {
      toast({
        title: tx.notEnoughQuizByDifficulty,
        description: tx.selectEnoughQuizByDifficulty,
        variant: 'destructive',
      })
      return
    }
    if (!isExamPointsExact100) {
      toast({
        title: tx.totalMustBe100,
        description: fillExamTpl(tx.totalMustBe100Desc, { total: String(totalExamPointsRounded) }),
        variant: 'destructive',
      })
      return
    }
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
          title: title.trim() || tx.defaultExamTitle,
          curriculumIds: [...selectedCurriculumIds],
          quizCountEasy: quizCountByDifficulty.easy,
          quizCountMedium: quizCountByDifficulty.medium,
          quizCountHard: quizCountByDifficulty.hard,
          quizMinutesEasy: quizMinutesByDifficulty.easy,
          quizMinutesMedium: quizMinutesByDifficulty.medium,
          quizMinutesHard: quizMinutesByDifficulty.hard,
          quizPointsEasy: quizPointsByDifficulty.easy,
          quizPointsMedium: quizPointsByDifficulty.medium,
          quizPointsHard: quizPointsByDifficulty.hard,
          selectionMode: 'manual',
          quizQuestionCount: 0,
          selectedQuizQuestionIds: [...selectedQuizQuestionIds],
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
        clearCurriculaDraft()
        setSelectedCurriculumIds(new Set())
        setResult({
          code: data.code,
          examUrl: data.examUrl,
          totalQuestions: data.totalQuestions ?? 0,
          durationMinutes: data.durationMinutes ?? 15,
          title: title.trim() || tx.defaultExamTitle,
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
        window.setTimeout(() => {
          const target = createdExamResultRef.current ?? createdExamListRef.current
          target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 80)
        toast({ title: tx.examCreateSuccess, description: tx.examCreateSuccessDesc, duration: 3000 })
      }
    } catch (e) {
      toast({ title: tx.error, description: e instanceof Error ? e.message : String(e), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const copyLink = () => {
    if (!result?.examUrl) return
    navigator.clipboard.writeText(result.examUrl)
    toast({ title: tx.copied, description: tx.linkCopiedDesc, duration: 2000 })
  }

  const deleteCreatedExam = async (code: string) => {
    const ok = typeof window !== 'undefined'
      ? window.confirm(tx.deleteExamConfirm)
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
      toast({ title: tx.examDeleted, description: tx.examDeletedDesc, duration: 2000 })
      void loadCreatedExams()
    } catch (e) {
      toast({ title: tx.error, description: e instanceof Error ? e.message : String(e), variant: 'destructive' })
    } finally {
      setDeletingCode(null)
    }
  }

  const openExamPreview = async (exam: { code: string; title: string; examUrl: string }) => {
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
      const filename = `bai-thi-${result.code}.pdf`
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
      const filename = `bai-thi-${result.code}.docx`
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
            <FileQuestion className="h-7 w-7 text-violet-600" />
            {tx.pageTitle}
          </h1>
          <p className="text-muted-foreground mt-1">
            {tx.pageSubtitle}
          </p>
        </div>

        {result ? (
          <div ref={createdExamResultRef}>
          <Card className="border border-emerald-200 dark:border-emerald-800">
            <CardHeader>
              <CardTitle className="text-emerald-700 dark:text-emerald-400">
                {tx.examCreatedBadge}
              </CardTitle>
              <CardDescription>
                {result.totalQuestions} {tx.questions} · {result.durationMinutes} {tx.minutes}
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
                    <Button variant="secondary" size="sm" asChild className="gap-1.5">
                      <Link href={buildExamReviewUrl(result.code)} target="_blank">
                        <BookOpen className="h-4 w-4" />
                        {tx.reviewSlides}
                      </Link>
                    </Button>
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
                {tx.createAnotherExam}
              </Button>
            </CardContent>
          </Card>
          </div>
        ) : (
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <QrCode className="h-4 w-4 text-violet-600" />
                {tx.cardExamInfo}
              </CardTitle>
              <CardDescription>
                {tx.examFormCardDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tx.titleOptional}</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={tx.titlePlaceholder}
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tx.subject}</label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    {SUBJECTS.map((s) => (
                      <option key={s.id} value={s.id}>{uiLocale === 'en' ? s.labelEn : s.labelVi}</option>
                    ))}
                  </select>
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
                        setSchoolSearch(e.target.value)
                        setSchoolDropdownOpen(true)
                      }}
                      onFocus={() => setSchoolDropdownOpen(true)}
                      onBlur={() => window.setTimeout(() => setSchoolDropdownOpen(false), 120)}
                      placeholder={tx.schoolPlaceholder}
                      className="text-sm pr-28"
                    />
                    {schoolSearch.trim().length >= 3 && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => void searchAndSaveSchoolByAi()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2 rounded border bg-background text-xs font-medium hover:bg-muted"
                      >
                        {tx.search}
                      </button>
                    )}
                    {schoolDropdownOpen && schoolSearch.trim().length >= 2 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-md border bg-background shadow-md max-h-52 overflow-y-auto p-1">
                        {schoolSearchLoading ? (
                          <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            {tx.searchingSchools}
                          </div>
                        ) : (
                          <>
                            {schoolSearchItems.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted ${
                                  selectedSchoolId === item.id ? 'bg-muted font-medium' : ''
                                }`}
                                onClick={() => {
                                  setSelectedSchoolId(item.id)
                                  setSelectedSchoolName(item.name)
                                  setSchoolSearch(item.name)
                                  setSchoolDropdownOpen(false)
                                }}
                              >
                                {item.name}
                              </button>
                            ))}
                            {schoolSearchItems.length === 0 && schoolSearch.trim().length < 3 && (
                              <p className="text-xs text-muted-foreground px-2 py-1.5">
                                {tx.schoolMinChars}
                              </p>
                            )}
                          </>
                        )}
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
                        setNewClassSubject((s) => s.trim() || defaultsForNewClass.subject)
                        setNewClassTeacher((s) => s.trim() || defaultsForNewClass.teacher)
                        setShowCreateClassModal(true)
                      }}
                    >
                      {tx.createNew}
                    </Button>
                  </div>
                </div>
              </div>

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

              <div className="space-y-2 rounded border p-3">
                <p className="text-sm font-semibold">{tx.part1Quiz}</p>
                <div className="overflow-x-auto -mx-1 px-1">
                  <div className="grid grid-cols-[minmax(5rem,1fr)_minmax(4rem,0.9fr)_minmax(4.5rem,0.9fr)_minmax(4.5rem,0.9fr)_minmax(4rem,0.8fr)] gap-2 text-xs font-medium text-muted-foreground min-w-[520px]">
                    <p>{tx.colDifficulty}</p>
                    <p>{tx.colCount}</p>
                    <p>{tx.colMinPerQ}</p>
                    <p>{tx.colPtsPerQ}</p>
                    <p>{tx.colSumMin}</p>
                  </div>
                  {(['easy', 'medium', 'hard'] as const).map((level) => {
                    const label = level === 'easy' ? tx.easyQuestions : level === 'hard' ? tx.hardQuestions : tx.mediumQuestions
                    const count = quizCountByDifficulty[level]
                    const minutes = quizMinutesByDifficulty[level]
                    const pts = quizPointsByDifficulty[level]
                    return (
                      <div
                        key={level}
                        className="grid grid-cols-[minmax(5rem,1fr)_minmax(4rem,0.9fr)_minmax(4.5rem,0.9fr)_minmax(4.5rem,0.9fr)_minmax(4rem,0.8fr)] gap-2 items-center min-w-[520px]"
                      >
                        <p className="text-sm">{label}</p>
                        <Input
                          type="number"
                          min={0}
                          max={200}
                          value={count}
                          onChange={(e) => {
                            const n = Math.max(0, Math.min(200, Math.floor(Number(e.target.value) || 0)))
                            setQuizCountByDifficulty((prev) => ({ ...prev, [level]: n }))
                          }}
                        />
                        <Input
                          type="number"
                          min={0.5}
                          max={10}
                          step={0.5}
                          value={minutes}
                          onChange={(e) => {
                            const n = Number(e.target.value)
                            const normalized = Number.isFinite(n) ? Math.max(0.5, Math.min(10, n)) : minutes
                            setQuizMinutesByDifficulty((prev) => ({ ...prev, [level]: normalized }))
                          }}
                        />
                        <Input
                          type="number"
                          min={0.25}
                          max={50}
                          step={0.25}
                          value={pts}
                          onChange={(e) => {
                            const n = Number(e.target.value)
                            let normalized = Number.isFinite(n) ? Math.max(0.25, Math.min(50, Math.round(n * 100) / 100)) : pts
                            const cap = maxQuizPointsPerQuestionForLevel(
                              level,
                              quizCountByDifficulty,
                              quizPointsByDifficulty,
                              essaySummary.totalPoints
                            )
                            normalized = Math.min(normalized, cap)
                            setQuizPointsByDifficulty((prev) => ({ ...prev, [level]: normalized }))
                          }}
                        />
                        <p className="text-sm font-medium tabular-nums">{count * minutes}</p>
                      </div>
                    )
                  })}
                </div>
                <div className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm space-y-1">
                  <p>
                    {tx.quizPartTotal}: <strong>{totalQuizCount}</strong>{' '}
                    {tx.questions} — <strong>{totalQuizMinutes}</strong> {tx.minutes} —{' '}
                    <strong>{Math.round(totalQuizPoints * 100) / 100}</strong> {tx.points}
                  </p>
                  {essaySummary.totalCount > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {fillExamTpl(tx.quizRemainForEssay, { n: String(roundExamPoints(Math.max(0, EXAM_FULL_SCORE - totalQuizPoints))) })}
                    </p>
                  ) : totalQuizPoints - EXAM_FULL_SCORE > 0.005 ? null : (
                    <p className="text-xs text-muted-foreground">
                      {fillExamTpl(tx.quizTnOptionalEssayHint, {
                        quizTotal: String(roundExamPoints(totalQuizPoints)),
                        remainForEssay: String(
                          roundExamPoints(Math.max(0, EXAM_FULL_SCORE - totalQuizPoints))
                        ),
                      })}
                    </p>
                  )}
                  {totalQuizPoints - EXAM_FULL_SCORE > 0.005 && (
                    <p className="text-xs text-amber-800">
                      {fillExamTpl(tx.quizOver100, { n: String(roundExamPoints(totalQuizPoints)) })}
                    </p>
                  )}
                </div>
              </div>

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

              <div className="space-y-2">
                {selectedCurriculumIds.size === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {tx.selectCurriculaForQuizList}
                  </p>
                ) : questionCatalogLoading ? (
                  <div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    {tx.loadingQuestionList}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded border px-2 py-1">
                        {tx.remainingEasy}: <strong>{remainingQuizCountByDifficulty.easy}</strong>
                      </div>
                      <div className="rounded border px-2 py-1">
                        {tx.remainingMedium}: <strong>{remainingQuizCountByDifficulty.medium}</strong>
                      </div>
                      <div className="rounded border px-2 py-1">
                        {tx.remainingHard}: <strong>{remainingQuizCountByDifficulty.hard}</strong>
                      </div>
                    </div>
                    <Input
                      placeholder={tx.searchQuizPlaceholder}
                      value={quizQuestionSearch}
                      onChange={(e) => setQuizQuestionSearch(e.target.value)}
                      className="text-sm h-8"
                    />
                    <div className="max-h-64 overflow-y-auto space-y-2 rounded border p-2 bg-muted/30">
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
                          const remain = diff === 'easy'
                            ? remainingQuizCountByDifficulty.easy
                            : diff === 'hard'
                              ? remainingQuizCountByDifficulty.hard
                              : remainingQuizCountByDifficulty.medium
                          const checked = selectedQuizQuestionIds.has(q.id)
                          const blocked = !checked && remain <= 0
                          return (
                            <div
                              key={`quiz-${q.id}`}
                              className={`rounded border p-2 space-y-2 ${checked ? 'bg-emerald-50/60 border-emerald-300' : 'bg-background/60'} ${blocked ? 'opacity-50' : ''}`}
                            >
                              <div className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={blocked}
                                  onChange={() => toggleQuizQuestion(q.id)}
                                  className="rounded mt-1"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap gap-2 text-xs mb-1">
                                    <span className="rounded px-1.5 py-0.5 bg-emerald-100 text-emerald-700">{tx.badgeQuiz}</span>
                                    <span className="rounded px-1.5 py-0.5 bg-sky-100 text-sky-700">
                                      {diff === 'easy' ? tx.easy : diff === 'hard' ? tx.hard : tx.medium}
                                    </span>
                                    <span className={`rounded px-1.5 py-0.5 ${q.verifiedAt ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                      {q.verifiedAt ? tx.verified : tx.unverified}
                                    </span>
                                    {q.curriculumTopic ? (
                                      <span className="rounded px-1.5 py-0.5 bg-violet-100 text-violet-700">
                                        {tx.lessonTag}: {q.curriculumTopic}
                                      </span>
                                    ) : null}
                                    {checked ? (
                                      <span className="rounded px-1.5 py-0.5 bg-emerald-200 text-emerald-900">
                                        {tx.selectedBadge}
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="text-sm whitespace-pre-wrap">{q.preview}</p>
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
                      {tx.selectedQuiz}: {fillExamTpl(tx.selectedQuizCount, { selected: String(selectedQuizQuestionIds.size), total: String(totalQuizCount) })}
                    </p>
                  </>
                )}
              </div>

              <div className="space-y-2 rounded border p-3">
                <p className="text-sm font-semibold">{tx.part2Essay}</p>
                <p className="text-xs text-muted-foreground">
                  {tx.essayIntroNoRandom}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tx.essayIntro100scale}
                </p>
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
                    ) : questionCatalogLoading ? (
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
                        <div className="max-h-72 overflow-y-auto space-y-2 rounded border p-2 bg-muted/30">
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
                              return (
                              <div
                                key={`essay-${q.id}`}
                                className={`rounded border p-2 space-y-2 ${checked ? 'bg-emerald-50/60 border-emerald-300' : 'bg-background/60'}`}
                              >
                                <div className="flex items-start gap-2">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleEssayQuestion(q.id)}
                                    className="rounded mt-1"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap gap-1.5 mb-1">
                                      <span className="rounded px-1.5 py-0.5 text-[11px] bg-amber-100 text-amber-700">
                                        {tx.badgeEssay}
                                      </span>
                                      <span className={`rounded px-1.5 py-0.5 text-[11px] ${q.verifiedAt ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                        {q.verifiedAt ? tx.verified : tx.unverified}
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
                                        <span className="rounded px-1.5 py-0.5 text-[11px] bg-emerald-200 text-emerald-900">
                                          {tx.selectedBadge}
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="text-sm whitespace-pre-wrap">{q.preview}</p>
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

                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            {tx.selectedEssayListTitle}
                          </p>
                          <div className="max-h-72 overflow-y-auto space-y-2 rounded border p-2 bg-background/70">
                            {selectedEssayQuestions.map((q) => {
                              const value = Number(essayMinutesById[q.id] ?? 10)
                              const maxEssayPts = maxEssayPointsForQuestion(
                                q.id,
                                orderedEssayQuestionIds,
                                essayPointsById,
                                totalQuizPoints
                              )
                              return (
                                <div key={`essay-minutes-${q.id}`} className="rounded border p-2 space-y-2">
                                  <div className="flex items-start gap-2">
                                    <input
                                      type="checkbox"
                                      checked={true}
                                      onChange={() => toggleEssayQuestion(q.id)}
                                      className="rounded mt-1"
                                    />
                                    <div className="min-w-0 flex-1 space-y-2">
                                      <div className="flex flex-wrap gap-1.5">
                                        <span className={`rounded px-1.5 py-0.5 text-[11px] ${q.verifiedAt ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                          {q.verifiedAt ? tx.verified : tx.unverified}
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
                                      </div>
                                      <p className="text-sm whitespace-pre-wrap">{q.preview}</p>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div className="grid grid-cols-[1fr_5rem] gap-2 items-center">
                                          <p className="text-xs text-muted-foreground">{tx.timeMinutes}</p>
                                          <Input
                                            type="number"
                                            min={1}
                                            max={20}
                                            step={1}
                                            value={String(value)}
                                            onChange={(e) => {
                                              const n = Number(e.target.value)
                                              const normalized = Number.isFinite(n) ? Math.max(1, Math.min(20, Math.floor(n))) : 10
                                              setEssayMinutesById((prev) => ({ ...prev, [q.id]: normalized }))
                                            }}
                                            className="h-8 text-sm"
                                          />
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
                                          {fillExamTpl(tx.essayMaxAllowedLine, { max: String(maxEssayPts) })}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                            {selectedEssayQuestions.length === 0 && (
                              <p className="text-xs text-muted-foreground py-2">
                                {tx.noEssaySelectedYet}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-2 rounded border p-3 bg-muted/20">
                <p className="text-sm font-semibold">{tx.summaryBeforeCreate}</p>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{tx.quizSection}</p>
                  <p>
                    {fillExamTpl(tx.summaryQuizLine, { label: tx.easy, count: String(quizCountByDifficulty.easy), min: String(quizMinutesByDifficulty.easy), sum: String(quizCountByDifficulty.easy * quizMinutesByDifficulty.easy) })}
                  </p>
                  <p>
                    {fillExamTpl(tx.summaryQuizLine, { label: tx.medium, count: String(quizCountByDifficulty.medium), min: String(quizMinutesByDifficulty.medium), sum: String(quizCountByDifficulty.medium * quizMinutesByDifficulty.medium) })}
                  </p>
                  <p>
                    {fillExamTpl(tx.summaryQuizLine, { label: tx.hard, count: String(quizCountByDifficulty.hard), min: String(quizMinutesByDifficulty.hard), sum: String(quizCountByDifficulty.hard * quizMinutesByDifficulty.hard) })}
                  </p>
                  <p className="pt-1">
                    {tx.quizSubtotalLabel}: <strong>{totalQuizCount}</strong> {tx.questions} - <strong>{totalQuizMinutes}</strong> {tx.minutes}
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
                {isDurationExceeded && (
                  <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {fillExamTpl(tx.durationWarning, { total: String(totalExamMinutes), limit: String(selectedExamTypeDuration) })}
                  </div>
                )}
              </div>

              <Button
                onClick={handleSubmit}
                disabled={loading || !isExamPointsExact100}
                className="w-full"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    {tx.creating}
                  </>
                ) : !isExamPointsExact100 ? (
                  <>
                    <FileQuestion className="h-4 w-4 mr-2" />
                    {tx.need100ToCreate}
                  </>
                ) : (
                  <>
                    <FileQuestion className="h-4 w-4 mr-2" />
                    {isDurationExceeded ? tx.createAnyway : tx.createExam}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        <div ref={createdExamListRef}>
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{tx.createdExamsList}</CardTitle>
            <CardDescription>
              {tx.createdExamsHint}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {createdExamsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                {tx.loadingExamList}
              </div>
            ) : createdExams.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tx.noExamsYet}</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {createdExams.map((exam) => (
                  <div key={exam.id} className="rounded border p-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{exam.title || tx.examTitle} - {exam.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {exam.totalQuestions} {tx.questions} - {exam.durationMinutes} {tx.minutes}
                      </p>
                      {(exam.className || exam.schoolName) && (
                        <p className="text-xs text-muted-foreground">
                          {exam.className ? `${tx.classLabel}: ${exam.className}` : ''}
                          {exam.className && exam.schoolName ? ' · ' : ''}
                          {exam.schoolName ? `${tx.schoolLabel}: ${exam.schoolName}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        asChild
                      >
                        <Link href={buildExamReviewUrl(exam.code)} target="_blank">
                          {tx.review}
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void openExamPreview({
                          code: exam.code,
                          title: exam.title || tx.examTitle,
                          examUrl: exam.examUrl,
                        })}
                      >
                        {tx.open}
                      </Button>
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
            )}
          </CardContent>
        </Card>
        </div>
      </div>
      {examPreview && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg border bg-background shadow-xl">
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
                <div className="flex gap-2">
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
                  <Button type="button" size="sm" variant="secondary" asChild>
                    <Link href={buildExamReviewUrl(examPreview.code)} target="_blank">
                      {tx.review}
                    </Link>
                  </Button>
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
                  <Input
                    value={newClassSubject}
                    onChange={(e) => setNewClassSubject(e.target.value)}
                    placeholder={tx.subjectForStudentsPh}
                    maxLength={120}
                    className="h-8 text-sm"
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
                  disabled={creatingClass || !newClassName.trim()}
                >
                  {creatingClass ? tx.creating : tx.createClass}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {quickViewItem && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-lg border bg-background shadow-xl">
            <div className="sticky top-0 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">
                {tx.quickViewTitle}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => setQuickViewItem(null)}>
                {tx.close}
              </Button>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{tx.problem}</p>
                <div className="rounded border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                  {quickViewItem.problem || quickViewItem.preview || tx.noProblem}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{tx.solution}</p>
                <div className="rounded border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                  {quickViewItem.solution || tx.noSolution}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
