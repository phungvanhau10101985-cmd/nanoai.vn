'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
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

const EXAM_TYPES = [
  { id: '15ph', labelVi: '15 phút', labelEn: '15 min', duration: 15 },
  { id: '1tiet', labelVi: '1 tiết (45 phút)', labelEn: '1 period (45 min)', duration: 45 },
  { id: 'hocky', labelVi: 'Học kỳ (90 phút)', labelEn: 'Semester (90 min)', duration: 90 },
  { id: 'totnghiep', labelVi: 'Tốt nghiệp (120 phút)', labelEn: 'Graduation (120 min)', duration: 120 },
] as const

export default function TaoBaiThiClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [examType, setExamType] = useState<string>('15ph')
  const [subjectId, setSubjectId] = useState('toan')
  const [gradeLevelId, setGradeLevelId] = useState('lop-12')
  const [title, setTitle] = useState('')
  const [quizMinutesByDifficulty, setQuizMinutesByDifficulty] = useState<{ easy: number; medium: number; hard: number }>({
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
  }>>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [newClassName, setNewClassName] = useState('')
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

  const tr = useCallback((vi: string, en: string) => (uiLocale === 'en' ? en : vi), [uiLocale])
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

  const loadTeacherClasses = useCallback(async () => {
    setClassesLoading(true)
    try {
      const res = await fetch('/api/classes/mine', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setTeacherClasses([])
        return
      }
      const classes = Array.isArray(data?.items) ? data.items : []
      setTeacherClasses(classes)
      setSelectedClassId((prev) => (prev || classes.length === 0 ? prev : String(classes[0].id)))
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
        title: tr('Thiếu dữ liệu', 'Missing input'),
        description: tr('Vui lòng nhập tên trường dài hơn trước khi tìm AI.', 'Please enter a longer school name before AI search.'),
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
          title: tr('Lỗi', 'Error'),
          description: data?.error ?? tr('Không thể tìm và chuẩn hóa trường bằng AI.', 'Unable to normalize school using AI.'),
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
        title: tr('Đã chuẩn hóa bằng AI', 'AI normalized'),
        description: tr('Đã lưu vào DB. Giáo viên chọn trường trong danh sách bên dưới.', 'Saved to DB. Please select the school from the list below.'),
      })
    } catch (e) {
      toast({
        title: tr('Lỗi', 'Error'),
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
        title: tr('Thiếu trường', 'Missing school'),
        description: tr('Vui lòng chọn trường trước khi tạo lớp.', 'Select a school before creating class.'),
        variant: 'destructive',
      })
      return false
    }
    if (!className) {
      toast({
        title: tr('Thiếu tên lớp', 'Missing class name'),
        description: tr('Vui lòng nhập tên lớp.', 'Please enter class name.'),
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
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.item?.id) {
        toast({
          title: tr('Lỗi', 'Error'),
          description: data?.error ?? tr('Không thể tạo lớp.', 'Failed to create class.'),
          variant: 'destructive',
        })
        return false
      }
      const item = data.item as { id: string; name: string; joinCode: string; schoolId: string; schoolName: string; gradeLevelId: string }
      setTeacherClasses((prev) => [item, ...prev])
      setSelectedClassId(String(item.id))
      setNewClassName('')
      toast({
        title: tr('Đã tạo lớp', 'Class created'),
        description: tr('Lớp mới đã sẵn sàng để gắn vào bài thi.', 'New class is ready for exam assignment.'),
      })
      return true
    } catch (e) {
      toast({
        title: tr('Lỗi', 'Error'),
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
        if (allRes && 'items' in allRes) setCurriculaList(allRes.items)
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
  const toggleEssayQuestion = (id: string) => {
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
  const essaySummary = useMemo(() => {
    const normLevel = (raw: string) => {
      const x = String(raw || '').trim().toLowerCase()
      if (x === 'nhan-biet' || x === 'van-dung-thap' || x === 'van-dung-cao' || x === 'thuc-te') return x
      return 'thong-hieu'
    }
    const rows: Array<{ key: string; label: string; count: number; minutes: number }> = [
      { key: 'nhan-biet', label: tr('Nhận biết', 'Recognition'), count: 0, minutes: 0 },
      { key: 'thong-hieu', label: tr('Thông hiểu', 'Comprehension'), count: 0, minutes: 0 },
      { key: 'van-dung-thap', label: tr('Vận dụng thấp', 'Low application'), count: 0, minutes: 0 },
      { key: 'van-dung-cao', label: tr('Vận dụng cao', 'High application'), count: 0, minutes: 0 },
      { key: 'thuc-te', label: tr('Thực tế', 'Practical'), count: 0, minutes: 0 },
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
    return {
      rows: filtered,
      totalCount: filtered.reduce((sum, r) => sum + r.count, 0),
      totalMinutes: filtered.reduce((sum, r) => sum + r.minutes, 0),
    }
  }, [selectedEssayQuestions, essayMinutesById, tr])
  const essayLevelLabel = (level: string) => {
    const x = String(level || '').trim().toLowerCase()
    if (x === 'nhan-biet') return tr('Nhận biết', 'Recognition')
    if (x === 'thong-hieu') return tr('Thông hiểu', 'Comprehension')
    if (x === 'van-dung-thap') return tr('Vận dụng thấp', 'Low application')
    if (x === 'van-dung-cao') return tr('Vận dụng cao', 'High application')
    if (x === 'thuc-te') return tr('Thực tế', 'Practical')
    return tr('Thông hiểu', 'Comprehension')
  }
  const sourceLabel = (source: string) => {
    const x = String(source || '').trim().toLowerCase()
    if (x === 'sgk') return tr('SGK', 'Textbook')
    if (x === 'ai') return tr('AI tạo', 'AI-generated')
    if (x === 'edited') return tr('Chỉnh sửa', 'Edited')
    if (!x) return tr('Nguồn khác', 'Other source')
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
  const totalExamMinutes = totalQuizMinutes + essaySummary.totalMinutes
  const selectedExamTypeDuration = useMemo(() => {
    const item = EXAM_TYPES.find((x) => x.id === examType)
    return item?.duration ?? 15
  }, [examType])
  const isDurationExceeded = totalExamMinutes > selectedExamTypeDuration
  const selectedExamTypeLabel = useMemo(() => {
    const item = EXAM_TYPES.find((x) => x.id === examType)
    if (!item) return uiLocale === 'en' ? '15 min' : '15 phút'
    return uiLocale === 'en' ? item.labelEn : item.labelVi
  }, [examType, uiLocale])
  const classOptions = useMemo(
    () => teacherClasses.filter((c) => !selectedSchoolId || c.schoolId === selectedSchoolId),
    [teacherClasses, selectedSchoolId]
  )
  useEffect(() => {
    if (classOptions.length === 0) {
      setSelectedClassId('')
      return
    }
    if (!classOptions.some((c) => c.id === selectedClassId)) {
      setSelectedClassId(classOptions[0].id)
    }
  }, [classOptions, selectedClassId])
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
        title: tr('Thiếu trường', 'Missing school'),
        description: tr('Vui lòng chọn trường trước khi tạo bài thi.', 'Select school before creating exam.'),
        variant: 'destructive',
      })
      return
    }
    if (!selectedClassId) {
      toast({
        title: tr('Thiếu lớp', 'Missing class'),
        description: tr('Vui lòng chọn lớp trước khi tạo bài thi.', 'Select class before creating exam.'),
        variant: 'destructive',
      })
      return
    }
    if (totalQuizCount <= 0) {
      toast({
        title: tr('Thiếu số lượng câu', 'Invalid question count'),
        description: tr('Hãy nhập số câu cho ít nhất 1 mức độ.', 'Set question count for at least one difficulty level.'),
        variant: 'destructive',
      })
      return
    }
    if (selectedQuizQuestionIds.size === 0) {
      toast({
        title: tr('Chưa chọn câu hỏi', 'No questions selected'),
        description: tr('Hãy chọn câu trắc nghiệm theo chỉ tiêu đã cài đặt.', 'Select quiz questions to match configured counts.'),
        variant: 'destructive',
      })
      return
    }
    if (remainingQuizCountByDifficulty.easy > 0 || remainingQuizCountByDifficulty.medium > 0 || remainingQuizCountByDifficulty.hard > 0) {
      toast({
        title: tr('Chưa đủ số câu theo mức độ', 'Not enough questions by difficulty'),
        description: tr('Giáo viên cần chọn đủ câu Dễ/Trung bình/Khó theo cài đặt.', 'Please select enough Easy/Medium/Hard questions as configured.'),
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
          title: title.trim() || 'Bài thi',
          curriculumIds: [...selectedCurriculumIds],
          quizCountEasy: quizCountByDifficulty.easy,
          quizCountMedium: quizCountByDifficulty.medium,
          quizCountHard: quizCountByDifficulty.hard,
          quizMinutesEasy: quizMinutesByDifficulty.easy,
          quizMinutesMedium: quizMinutesByDifficulty.medium,
          quizMinutesHard: quizMinutesByDifficulty.hard,
          selectionMode: 'manual',
          quizQuestionCount: 0,
          selectedQuizQuestionIds: [...selectedQuizQuestionIds],
          selectedEssayQuestionIds: [...selectedEssayQuestionIds],
          essayMinutesById,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: tr('Lỗi', 'Error'), description: data?.error ?? res.statusText, variant: 'destructive' })
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
          title: title.trim() || 'Bài thi',
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
        toast({ title: tr('Tạo thành công!', 'Created!'), description: tr('Đã tạo bài thi. Chia sẻ link hoặc QR cho học sinh.', 'Exam created. Share link or QR with students.'), duration: 3000 })
      }
    } catch (e) {
      toast({ title: tr('Lỗi', 'Error'), description: e instanceof Error ? e.message : String(e), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const copyLink = () => {
    if (!result?.examUrl) return
    navigator.clipboard.writeText(result.examUrl)
    toast({ title: tr('Đã copy', 'Copied'), description: tr('Link đã được sao chép.', 'Link copied.'), duration: 2000 })
  }

  const deleteCreatedExam = async (code: string) => {
    const ok = typeof window !== 'undefined'
      ? window.confirm(tr('Xóa bài thi này? Hành động không thể hoàn tác.', 'Delete this exam? This action cannot be undone.'))
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
        toast({ title: tr('Lỗi', 'Error'), description: data?.error ?? res.statusText, variant: 'destructive' })
        return
      }
      if (result?.code === code) {
        setResult(null)
        setQrDataUrl(null)
      }
      toast({ title: tr('Đã xóa', 'Deleted'), description: tr('Đã xóa bài thi.', 'Exam deleted.'), duration: 2000 })
      void loadCreatedExams()
    } catch (e) {
      toast({ title: tr('Lỗi', 'Error'), description: e instanceof Error ? e.message : String(e), variant: 'destructive' })
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
        toast({ title: tr('Lỗi', 'Error'), description: data?.error ?? 'Không tải được đề thi.', variant: 'destructive' })
        return
      }
      const md = buildExamMarkdown({
        title: data.title || result.title,
        durationMinutes: data.durationMinutes ?? result.durationMinutes,
        questions: data.questions ?? [],
      })
      const filename = `bai-thi-${result.code}.pdf`
      await exportWorksheetToPdf(md, filename, null)
      toast({ title: tr('Đã xuất PDF', 'PDF exported'), description: filename, duration: 2000 })
    } catch (e) {
      toast({ title: tr('Lỗi', 'Error'), description: e instanceof Error ? e.message : String(e), variant: 'destructive' })
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
        toast({ title: tr('Lỗi', 'Error'), description: data?.error ?? 'Không tải được đề thi.', variant: 'destructive' })
        return
      }
      const md = buildExamMarkdown({
        title: data.title || result.title,
        durationMinutes: data.durationMinutes ?? result.durationMinutes,
        questions: data.questions ?? [],
      })
      const filename = `bai-thi-${result.code}.docx`
      await exportWorksheetToWord(md, filename)
      toast({ title: tr('Đã xuất Word', 'Word exported'), description: filename, duration: 2000 })
    } catch (e) {
      toast({ title: tr('Lỗi', 'Error'), description: e instanceof Error ? e.message : String(e), variant: 'destructive' })
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
            {tr('Tạo bài thi trực tuyến', 'Create online exam')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {tr('15 phút, 1 tiết, học kỳ, tốt nghiệp. Chọn môn, lớp, bài. QR + link cho học sinh.', '15 min, 1 period, semester, graduation. Select subject, grade, lessons. QR + link for students.')}
          </p>
        </div>

        {result ? (
          <div ref={createdExamResultRef}>
          <Card className="border border-emerald-200 dark:border-emerald-800">
            <CardHeader>
              <CardTitle className="text-emerald-700 dark:text-emerald-400">
                {tr('Bài thi đã tạo', 'Exam created')}
              </CardTitle>
              <CardDescription>
                {result.totalQuestions} {tr('câu', 'questions')} · {result.durationMinutes} {tr('phút', 'minutes')}
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
                    <span className="text-sm font-medium">{tr('Link làm bài', 'Exam link')}</span>
                  </div>
                  <div className="flex gap-2">
                    <Input readOnly value={result.examUrl} className="text-sm font-mono" />
                    <Button variant="outline" size="icon" onClick={copyLink} title={tr('Copy link', 'Copy link')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tr('Mã bài thi', 'Exam code')}: <strong>{result.code}</strong>
                  </p>
                  {(result.className || result.schoolName) && (
                    <p className="text-xs text-muted-foreground">
                      {result.className ? `${tr('Lớp', 'Class')}: ${result.className}` : ''}
                      {result.className && result.schoolName ? ' · ' : ''}
                      {result.schoolName ? `${tr('Trường', 'School')}: ${result.schoolName}` : ''}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
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
                      {tr('Xuất PDF', 'Export PDF')}
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
                      {tr('Xuất Word', 'Export Word')}
                    </Button>
                  </div>
                </div>
              </div>
              <Button
                variant="default"
                className="font-bold shadow-sm"
                onClick={() => { clearCurriculaDraft(); setSelectedCurriculumIds(new Set()); setResult(null); setQrDataUrl(null) }}
              >
                {tr('Tạo bài thi khác', 'Create another exam')}
              </Button>
            </CardContent>
          </Card>
          </div>
        ) : (
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <QrCode className="h-4 w-4 text-violet-600" />
                {tr('Thông tin bài thi', 'Exam info')}
              </CardTitle>
              <CardDescription>
                {tr(
                  'Chọn môn/lớp và cách lấy câu hỏi: ngẫu nhiên hoặc giáo viên tự chọn từ danh sách bài tập trong giáo trình.',
                  'Select subject/grade and question method: random or teacher-picked from curriculum exercise lists.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Tiêu đề (tùy chọn)', 'Title (optional)')}</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={tr('Bài thi Toán 15 phút', 'Math 15-min exam')}
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Môn học', 'Subject')}</label>
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
                  <label className="text-xs font-medium text-muted-foreground">{tr('Lớp', 'Grade')}</label>
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
                <p className="text-sm font-semibold">{tr('Trường và lớp áp dụng', 'Target school and class')}</p>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Trường', 'School')}</label>
                  <div className="relative">
                    <Input
                      value={schoolSearch}
                      onChange={(e) => {
                        setSchoolSearch(e.target.value)
                        setSchoolDropdownOpen(true)
                      }}
                      onFocus={() => setSchoolDropdownOpen(true)}
                      onBlur={() => window.setTimeout(() => setSchoolDropdownOpen(false), 120)}
                      placeholder={tr('Gõ tên trường', 'Type school name')}
                      className="text-sm pr-28"
                    />
                    {schoolSearch.trim().length >= 3 && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => void searchAndSaveSchoolByAi()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2 rounded border bg-background text-xs font-medium hover:bg-muted"
                      >
                        {tr('Tìm kiếm', 'Search')}
                      </button>
                    )}
                    {schoolDropdownOpen && schoolSearch.trim().length >= 2 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-md border bg-background shadow-md max-h-52 overflow-y-auto p-1">
                        {schoolSearchLoading ? (
                          <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            {tr('Đang tìm trường...', 'Searching schools...')}
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
                                {tr('Nhập ít nhất 3 ký tự để tìm trường.', 'Enter at least 3 characters to search school.')}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {selectedSchoolId && (
                    <p className="text-xs text-muted-foreground">
                      {tr('Đang chọn', 'Selected')}: <strong>{selectedSchoolName || schoolSearch}</strong>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Lớp', 'Class')}</label>
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
                            ? tr('Đang tải lớp...', 'Loading classes...')
                            : tr('Chưa có lớp - bấm Tạo mới', 'No class yet - click Create new')}
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
                            title: tr('Thiếu trường', 'Missing school'),
                            description: tr('Vui lòng chọn trường trước khi tạo lớp mới.', 'Please select school first before creating a new class.'),
                            variant: 'destructive',
                          })
                          return
                        }
                        setShowCreateClassModal(true)
                      }}
                    >
                      {tr('Tạo mới', 'Create new')}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Loại bài thi', 'Exam type')}</label>
                <div className="flex flex-wrap gap-2">
                  {EXAM_TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setExamType(t.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        examType === t.id ? 'bg-violet-600 text-white' : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {uiLocale === 'en' ? t.labelEn : t.labelVi}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 rounded border p-3">
                <p className="text-sm font-semibold">{tr('Phần 1: Trắc nghiệm', 'Part 1: Quiz')}</p>
                <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground">
                  <p>{tr('Mức độ', 'Difficulty')}</p>
                  <p>{tr('Số câu', 'Question count')}</p>
                  <p>{tr('Phút/câu', 'Min/question')}</p>
                  <p>{tr('Tổng phút', 'Total minutes')}</p>
                </div>
                {(['easy', 'medium', 'hard'] as const).map((level) => {
                  const label = level === 'easy' ? tr('Câu dễ', 'Easy') : level === 'hard' ? tr('Câu khó', 'Hard') : tr('Câu trung bình', 'Medium')
                  const count = quizCountByDifficulty[level]
                  const minutes = quizMinutesByDifficulty[level]
                  return (
                    <div key={level} className="grid grid-cols-4 gap-2 items-center">
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
                      <p className="text-sm font-medium">{count * minutes}</p>
                    </div>
                  )
                })}
                <div className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
                  {tr('Tổng phần trắc nghiệm', 'Quiz total')}: <strong>{totalQuizCount}</strong> {tr('câu', 'questions')} - <strong>{totalQuizMinutes}</strong> {tr('phút', 'minutes')}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5" />
                  {tr('Chọn giáo trình theo môn và lớp đã chọn', 'Select curricula for selected subject and grade')}
                </label>
                {browseLoading ? (
                  <div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    {tr('Đang tải...', 'Loading...')}
                  </div>
                ) : curriculaList.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    {tr('Chưa có giáo trình cho môn/lớp này. ', 'No curricula for this subject/grade. ')}
                    <Link href="/tao-giao-trinh" className="text-primary hover:underline">
                      {tr('Tạo giáo trình', 'Create curriculum')}
                    </Link>
                    {tr(' trước.', ' first.')}
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
                    {tr('Hãy chọn giáo trình trước để tải danh sách câu trắc nghiệm.', 'Select curricula first to load quiz questions.')}
                  </p>
                ) : questionCatalogLoading ? (
                  <div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    {tr('Đang tải danh sách câu...', 'Loading questions...')}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded border px-2 py-1">
                        {tr('Còn lại Dễ', 'Easy remaining')}: <strong>{remainingQuizCountByDifficulty.easy}</strong>
                      </div>
                      <div className="rounded border px-2 py-1">
                        {tr('Còn lại Trung bình', 'Medium remaining')}: <strong>{remainingQuizCountByDifficulty.medium}</strong>
                      </div>
                      <div className="rounded border px-2 py-1">
                        {tr('Còn lại Khó', 'Hard remaining')}: <strong>{remainingQuizCountByDifficulty.hard}</strong>
                      </div>
                    </div>
                    <Input
                      placeholder={tr('Tìm câu trắc nghiệm...', 'Search quiz questions...')}
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
                                    <span className="rounded px-1.5 py-0.5 bg-emerald-100 text-emerald-700">{tr('Trắc nghiệm', 'Quiz')}</span>
                                    <span className="rounded px-1.5 py-0.5 bg-sky-100 text-sky-700">
                                      {diff === 'easy' ? tr('Dễ', 'Easy') : diff === 'hard' ? tr('Khó', 'Hard') : tr('Trung bình', 'Medium')}
                                    </span>
                                    <span className={`rounded px-1.5 py-0.5 ${q.verifiedAt ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                      {q.verifiedAt ? tr('Đã verify', 'Verified') : tr('Chưa verify', 'Unverified')}
                                    </span>
                                    {q.curriculumTopic ? (
                                      <span className="rounded px-1.5 py-0.5 bg-violet-100 text-violet-700">
                                        {tr('Thuộc bài', 'Lesson')}: {q.curriculumTopic}
                                      </span>
                                    ) : null}
                                    {checked ? (
                                      <span className="rounded px-1.5 py-0.5 bg-emerald-200 text-emerald-900">
                                        {tr('Đã chọn', 'Selected')}
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
                                  {tr('Xem nhanh', 'Quick view')}
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      {quizCatalog.length === 0 && (
                        <p className="text-xs text-muted-foreground py-2">
                          {tr('Không có câu trắc nghiệm trong giáo trình đã chọn.', 'No quiz questions found in selected curricula.')}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tr('Đã chọn trắc nghiệm', 'Selected quiz')}: {selectedQuizQuestionIds.size}/{totalQuizCount} {tr('câu', 'questions')}
                    </p>
                  </>
                )}
              </div>

              <div className="space-y-2 rounded border p-3">
                <p className="text-sm font-semibold">{tr('Phần 2: Tự luận', 'Part 2: Essay')}</p>
                <p className="text-xs text-muted-foreground">
                  {tr(
                    'Tự luận không có chế độ ngẫu nhiên. Chọn bài tự luận từ giáo trình đã chọn, rồi điền thời gian từng bài.',
                    'Essay has no random mode. Select essay questions from chosen curricula, then set time per question.'
                  )}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEssayPicker((prev) => !prev)}
                >
                  {showEssayPicker ? tr('Ẩn chọn bài tự luận', 'Hide essay picker') : tr('Chọn bài tự luận', 'Select essay questions')}
                </Button>

                {showEssayPicker && (
                  <>
                    {selectedCurriculumIds.size === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {tr('Hãy chọn giáo trình ở trên trước khi chọn tự luận.', 'Select curricula above before choosing essay questions.')}
                      </p>
                    ) : questionCatalogLoading ? (
                      <div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        {tr('Đang tải danh sách câu...', 'Loading questions...')}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs font-medium text-muted-foreground">{tr('Danh sách bài tự luận', 'Essay question list')}</p>
                        <Input
                          placeholder={tr('Tìm câu tự luận...', 'Search essay questions...')}
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
                                        {tr('Tự luận', 'Essay')}
                                      </span>
                                      <span className={`rounded px-1.5 py-0.5 text-[11px] ${q.verifiedAt ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                        {q.verifiedAt ? tr('Đã verify', 'Verified') : tr('Chưa verify', 'Unverified')}
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
                                          {tr('Đã chọn', 'Selected')}
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
                                    {tr('Xem nhanh', 'Quick view')}
                                  </Button>
                                </div>
                              </div>
                            )})}
                          {essayCatalog.length === 0 && (
                            <p className="text-xs text-muted-foreground py-2">
                              {tr('Không có bài tự luận trong giáo trình đã chọn.', 'No essay questions found in selected curricula.')}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            {tr('Danh sách tự luận đã chọn (chọn ở trên sẽ tự nhảy xuống đây)', 'Selected essay questions (picked above will move here)')}
                          </p>
                          <div className="max-h-72 overflow-y-auto space-y-2 rounded border p-2 bg-background/70">
                            {selectedEssayQuestions.map((q) => {
                              const value = Number(essayMinutesById[q.id] ?? 10)
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
                                          {q.verifiedAt ? tr('Đã verify', 'Verified') : tr('Chưa verify', 'Unverified')}
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
                                      <div className="grid grid-cols-[1fr_120px] gap-2 items-center">
                                        <p className="text-xs text-muted-foreground">{tr('Thời gian (phút)', 'Time (minutes)')}</p>
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
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                            {selectedEssayQuestions.length === 0 && (
                              <p className="text-xs text-muted-foreground py-2">
                                {tr('Chưa chọn bài tự luận.', 'No essay questions selected yet.')}
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
                <p className="text-sm font-semibold">{tr('Tóm tắt trước khi tạo đề', 'Summary before creating exam')}</p>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{tr('Phần trắc nghiệm', 'Quiz section')}</p>
                  <p>
                    {tr('Dễ', 'Easy')}: <strong>{quizCountByDifficulty.easy}</strong> {tr('câu', 'questions')} x <strong>{quizMinutesByDifficulty.easy}</strong> {tr('phút', 'min')} = <strong>{quizCountByDifficulty.easy * quizMinutesByDifficulty.easy}</strong> {tr('phút', 'min')}
                  </p>
                  <p>
                    {tr('Trung bình', 'Medium')}: <strong>{quizCountByDifficulty.medium}</strong> {tr('câu', 'questions')} x <strong>{quizMinutesByDifficulty.medium}</strong> {tr('phút', 'min')} = <strong>{quizCountByDifficulty.medium * quizMinutesByDifficulty.medium}</strong> {tr('phút', 'min')}
                  </p>
                  <p>
                    {tr('Khó', 'Hard')}: <strong>{quizCountByDifficulty.hard}</strong> {tr('câu', 'questions')} x <strong>{quizMinutesByDifficulty.hard}</strong> {tr('phút', 'min')} = <strong>{quizCountByDifficulty.hard * quizMinutesByDifficulty.hard}</strong> {tr('phút', 'min')}
                  </p>
                  <p className="pt-1">
                    {tr('Tổng trắc nghiệm', 'Quiz total')}: <strong>{totalQuizCount}</strong> {tr('câu', 'questions')} - <strong>{totalQuizMinutes}</strong> {tr('phút', 'minutes')}
                  </p>
                </div>
                <div className="space-y-1 text-sm pt-1">
                  <p className="font-medium">{tr('Phần tự luận', 'Essay section')}</p>
                  {essaySummary.rows.length > 0 ? (
                    essaySummary.rows.map((row) => (
                      <p key={`summary-${row.key}`}>
                        {row.label}: <strong>{row.count}</strong> {tr('câu', 'questions')} - <strong>{row.minutes}</strong> {tr('phút', 'minutes')}
                      </p>
                    ))
                  ) : (
                    <p className="text-muted-foreground">{tr('Chưa chọn bài tự luận.', 'No essay questions selected.')}</p>
                  )}
                  <p className="pt-1">
                    {tr('Tổng tự luận', 'Essay total')}: <strong>{essaySummary.totalCount}</strong> {tr('câu', 'questions')} - <strong>{essaySummary.totalMinutes}</strong> {tr('phút', 'minutes')}
                  </p>
                </div>
                <div className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {tr('Tổng thời gian cần làm bài', 'Total exam duration needed')}: <strong>{totalExamMinutes}</strong> {tr('phút', 'minutes')}
                </div>
                <p className="text-xs text-muted-foreground">
                  {tr('Loại bài thi đã chọn', 'Selected exam type')}: <strong>{selectedExamTypeLabel}</strong>
                </p>
                <div className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {tr('Thời gian đề chuẩn', 'Official exam duration')}: <strong>{selectedExamTypeDuration}</strong> {tr('phút', 'minutes')}
                </div>
                {isDurationExceeded && (
                  <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {tr(
                      `Cảnh báo: Tổng thời gian dự tính (${totalExamMinutes} phút) đang lớn hơn thời gian loại bài thi đã chọn (${selectedExamTypeDuration} phút). Đề vẫn được tạo, nhưng học sinh chỉ làm trong ${selectedExamTypeDuration} phút.`,
                      `Warning: Estimated total time (${totalExamMinutes} min) exceeds selected exam type duration (${selectedExamTypeDuration} min). The exam will still be created, but students only have ${selectedExamTypeDuration} minutes.`
                    )}
                  </div>
                )}
              </div>

              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    {tr('Đang tạo...', 'Creating...')}
                  </>
                ) : (
                  <>
                    <FileQuestion className="h-4 w-4 mr-2" />
                    {isDurationExceeded ? tr('Vẫn tạo bài thi', 'Create anyway') : tr('Tạo bài thi', 'Create exam')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        <div ref={createdExamListRef}>
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{tr('Danh sách bài thi đã tạo', 'Created exams')}</CardTitle>
            <CardDescription>
              {tr('Giáo viên có thể mở link hoặc xóa bài thi đã tạo.', 'Teacher can open link or delete created exams.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {createdExamsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                {tr('Đang tải danh sách...', 'Loading exam list...')}
              </div>
            ) : createdExams.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tr('Chưa có bài thi nào.', 'No exams yet.')}</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {createdExams.map((exam) => (
                  <div key={exam.id} className="rounded border p-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{exam.title || tr('Bài thi', 'Exam')} - {exam.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {exam.totalQuestions} {tr('câu', 'questions')} - {exam.durationMinutes} {tr('phút', 'minutes')}
                      </p>
                      {(exam.className || exam.schoolName) && (
                        <p className="text-xs text-muted-foreground">
                          {exam.className ? `${tr('Lớp', 'Class')}: ${exam.className}` : ''}
                          {exam.className && exam.schoolName ? ' · ' : ''}
                          {exam.schoolName ? `${tr('Trường', 'School')}: ${exam.schoolName}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void openExamPreview({
                          code: exam.code,
                          title: exam.title || tr('Bài thi', 'Exam'),
                          examUrl: exam.examUrl,
                        })}
                      >
                        {tr('Mở', 'Open')}
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
                        {tr('Xóa', 'Delete')}
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
              <p className="text-sm font-semibold">{tr('Quét mã QR làm bài', 'Scan QR to take exam')}</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setExamPreview(null)}>
                {tr('Đóng', 'Close')}
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
                    {tr('Không tạo được QR. Dùng link bên dưới.', 'Failed to generate QR. Use link below.')}
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
                    {tr('Copy link', 'Copy link')}
                  </Button>
                  <Button type="button" size="sm" asChild>
                    <Link href={examPreview.examUrl} target="_blank">
                      {tr('Mở trên máy này', 'Open on this device')}
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
              <p className="text-sm font-semibold">{tr('Tạo lớp mới', 'Create new class')}</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreateClassModal(false)}>
                {tr('Đóng', 'Close')}
              </Button>
            </div>
            <div className="p-4 space-y-3">
              {!selectedSchoolId && (
                <p className="text-xs text-muted-foreground">
                  {tr('Vui lòng chọn trường ở trên trước khi tạo lớp mới.', 'Please select school above before creating class.')}
                </p>
              )}
              <Input
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder={tr('Nhập tên lớp mới (VD: 12A6)', 'Enter new class name (e.g. 12A6)')}
                className="text-sm"
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateClassModal(false)}>
                  {tr('Hủy', 'Cancel')}
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    const ok = await createTeacherClass()
                    if (ok) setShowCreateClassModal(false)
                  }}
                  disabled={creatingClass || !newClassName.trim()}
                >
                  {creatingClass ? tr('Đang tạo...', 'Creating...') : tr('Tạo lớp mới', 'Create class')}
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
                {tr('Xem nhanh đề và lời giải', 'Quick view: problem and solution')}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => setQuickViewItem(null)}>
                {tr('Đóng', 'Close')}
              </Button>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{tr('Đề bài', 'Problem')}</p>
                <div className="rounded border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                  {quickViewItem.problem || quickViewItem.preview || tr('Không có nội dung đề bài.', 'No problem content.')}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{tr('Lời giải', 'Solution')}</p>
                <div className="rounded border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                  {quickViewItem.solution || tr('Chưa có lời giải.', 'No solution available.')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
