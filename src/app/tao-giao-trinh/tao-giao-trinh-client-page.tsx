'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Sparkles, Copy, FileDown, RefreshCw, FileSpreadsheet, QrCode, FolderOpen, BookOpen, FileText, Presentation, Trash2 } from 'lucide-react'
import QRCode from 'qrcode'
import { exportWorksheetToPdf, exportWorksheetToWord } from './lib/worksheet-export'
import { latexToReadable } from './lib/latex-to-readable'
import { curriculumToSlidesMarkdown } from './lib/curriculum-to-slides'
import { GammaSlideViewer } from './components/gamma-slide-viewer'
import { SlideVersionDialog, type SlideVersionChoice } from './components/slide-version-dialog'
import type { AISlideData } from './lib/curriculum-to-slides'
import { SUBJECTS, GRADE_LEVELS, GRADE_LEVEL_GROUPS, TEXTBOOK_SETS, LESSON_TYPES } from './lib/curriculum-subjects'
import { createCurriculum, createWorksheet, saveCurriculum, listCurricula, getCurriculumById, getWorksheetById, getWorksheetsByCurriculumId, deleteCurriculum, saveSlidesToCurriculum, getSlidesByCurriculumId, getOriginalSlides, getUserCustomizedSlides, saveOriginalSlidesIfNotExists } from './actions'

type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

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

type Step = 'INPUT' | 'GENERATING' | 'RESULT'

export default function TaoGiaoTrinhClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('INPUT')
  const [subjectId, setSubjectId] = useState('toan')
  const [gradeLevelId, setGradeLevelId] = useState('lop-12')
  const [textbookSetId, setTextbookSetId] = useState('ket-noi-tri-thuc')
  const [textbookVolume, setTextbookVolume] = useState<string>('')
  const [lessonNumber, setLessonNumber] = useState<string>('1')
  const [lessonTypeId, setLessonTypeId] = useState('hinh-thanh-kien-thuc')
  const [topic, setTopic] = useState('')
  const [numLessons, setNumLessons] = useState(5)
  const [lessonDurationMinutes, setLessonDurationMinutes] = useState(45)
  const [modelProvider, setModelProvider] = useState<'gemini' | 'deepseek'>('gemini')
  const [goals, setGoals] = useState('')
  const [curriculumMarkdown, setCurriculumMarkdown] = useState('')
  const [curriculumId, setCurriculumId] = useState<string | null>(null)
  const [worksheetMarkdown, setWorksheetMarkdown] = useState('')
  const [worksheetId, setWorksheetId] = useState<string | null>(null)
  const [worksheetQrDataUrl, setWorksheetQrDataUrl] = useState<string | null>(null)
  const [worksheetLoading, setWorksheetLoading] = useState(false)
  const [showBrowse, setShowBrowse] = useState(true)
  const [curriculaList, setCurriculaList] = useState<Array<{ id: string; topic: string; subject_id: string; grade_level_id: string; textbook_set_id?: string; lesson_type_id?: string; num_lessons?: number; lesson_duration_minutes?: number; created_at: string }>>([])
  const [curriculumWorksheets, setCurriculumWorksheets] = useState<Array<{ id: string; topic: string; subject_id: string; grade_level_id: string; content_markdown: string; created_at: string }>>([])
  const [browseLoading, setBrowseLoading] = useState(false)
  const [browseSubjectFilter, setBrowseSubjectFilter] = useState<string>('')
  const [browseGradeFilter, setBrowseGradeFilter] = useState<string>('')
  const [showSlideViewer, setShowSlideViewer] = useState(false)
  const [aiSlides, setAiSlides] = useState<AISlideData[] | null>(null)
  const [curriculumSlides, setCurriculumSlides] = useState<AISlideData[] | null>(null)
  const [slideAnalysisLoading, setSlideAnalysisLoading] = useState(false)
  const [showSlideVersionDialog, setShowSlideVersionDialog] = useState(false)
  const [slideVersionChoice, setSlideVersionChoice] = useState<SlideVersionChoice | null>(null)
  const [sharedSlides, setSharedSlides] = useState<AISlideData[] | null>(null)
  const [originalSlides, setOriginalSlides] = useState<AISlideData[] | null>(null)
  const [personalSlides, setPersonalSlides] = useState<AISlideData[] | null>(null)
  const { toast } = useToast()

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
      })
    } catch {
      return ''
    }
  }

  const displayTopic = topic.trim() || `Bài ${lessonNumber}`

  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  useEffect(() => {
    const syncLocale = () => setUiLocale(getWebLocaleFromCookie())
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!showBrowse) return
    setBrowseLoading(true)
    listCurricula({
      subjectId: browseSubjectFilter || undefined,
      gradeLevelId: browseGradeFilter || undefined,
      limit: 200,
    })
      .then((curRes) => {
        if (curRes && 'items' in curRes) setCurriculaList(curRes.items)
        else setCurriculaList([])
      })
      .catch(() => setCurriculaList([]))
      .finally(() => setBrowseLoading(false))
  }, [showBrowse, browseSubjectFilter, browseGradeFilter])

  const handleSubmit = async () => {
    const num = parseInt(lessonNumber, 10)
    if (!num || num < 1 || num > 100) {
      toast({
        title: tr('Thiếu thông tin', 'Missing information', '缺少信息', '情報不足', '정보 누락'),
        description: tr('Vui lòng chọn bài số (1–100).', 'Please select lesson number (1–100).', '请选择课号（1–100）。', '課番号（1–100）を選択してください。', '차시 번호(1–100)를 선택해 주세요.'),
        variant: 'destructive',
      })
      return
    }
    setStep('GENERATING')
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const formData = new FormData()
    formData.append('subjectId', subjectId)
    formData.append('gradeLevelId', gradeLevelId)
    formData.append('textbookSetId', textbookSetId)
    formData.append('textbookVolume', textbookVolume.trim())
    formData.append('lessonNumber', lessonNumber.trim())
    formData.append('lessonTypeId', lessonTypeId)
    formData.append('topic', displayTopic)
    formData.append('numLessons', String(numLessons))
    formData.append('lessonDurationMinutes', String(lessonDurationMinutes))
    formData.append('modelProvider', modelProvider)
    formData.append('goals', goals.trim())
    const result = await createCurriculum(formData)
    if (result.error) {
      setStep('INPUT')
      toast({
        title: tr('Tạo giáo trình thất bại', 'Create curriculum failed', '创建课程失败', 'カリキュラム作成に失敗', '교육과정 생성 실패'),
        description: result.error,
        variant: 'destructive',
        duration: 5000,
      })
    } else if (result.success && result.curriculumMarkdown) {
      setCurriculumMarkdown(result.curriculumMarkdown)
      setCurriculumId(result.curriculumId ?? null)
      setStep('RESULT')
      if (result.matched) {
        toast({
          title: tr('Đã tìm thấy giáo trình tương ứng', 'Matching curriculum found', '找到匹配课程', '一致するカリキュラムを発見', '일치하는 교육과정 발견'),
          description: tr('Sử dụng bản có sẵn trong kho.', 'Using existing curriculum from library.', '使用库中现有课程。', 'ライブラリの既存を使用。', '라이브러리 기존 사용.'),
          duration: 3000,
        })
      } else if (result.saveFailed) {
        toast({
          title: tr('Giáo trình đã tạo', 'Curriculum created', '课程已创建', 'カリキュラム作成', '교육과정 생성'),
          description: tr('Chưa lưu vào kho. Bấm "Lưu vào kho" để lưu.', 'Not saved to library. Click "Save to library" to save.', '未保存到库。点击"保存到库"保存。', 'ライブラリに未保存。「保存」をクリック。', '라이브러리에 미저장. "저장" 클릭.'),
          variant: 'default',
          duration: 5000,
        })
      } else {
        toast({
          title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'),
          description: tr('Giáo trình đã được tạo và lưu.', 'Curriculum created and saved.', '课程已创建并保存。', 'カリキュラムを作成・保存しました。', '교육과정 생성 및 저장됨.'),
          duration: 3000,
        })
      }
    }
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

  const handleOpenSlides = async () => {
    if (!curriculumMarkdown.trim()) return
    if (curriculumId) {
      const [sharedRes, originalRes, personalRes] = await Promise.all([
        getSlidesByCurriculumId(curriculumId),
        getOriginalSlides(curriculumId),
        getUserCustomizedSlides(curriculumId),
      ])
      const shared = sharedRes?.success && sharedRes.slides?.length ? sharedRes.slides : null
      const original = originalRes?.success && originalRes.slides?.length ? originalRes.slides : null
      const personal = personalRes?.success && personalRes.slides?.length ? personalRes.slides : null
      setSharedSlides(shared)
      setOriginalSlides(original)
      setPersonalSlides(personal)
      if (shared || original) {
        setShowSlideVersionDialog(true)
        return
      }
    }
    if (curriculumSlides && curriculumSlides.length > 0 && !curriculumId) {
      setAiSlides(curriculumSlides)
      setShowSlideViewer(true)
      setSlideVersionChoice(null)
      return
    }
    setSlideAnalysisLoading(true)
    try {
      const res = await fetch('/api/curriculum-analyze-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curriculumMarkdown,
          topic: displayTopic,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.error('[curriculum-analyze-slides] API lỗi:', res.status, data)
      }
      if (res.ok && Array.isArray(data?.slides) && data.slides.length > 0) {
        const slides = data.slides as AISlideData[]
        setCurriculumSlides(slides)
        if (curriculumId) {
          const saveRes = await saveSlidesToCurriculum({
            curriculumId,
            topic: displayTopic,
            subjectId,
            gradeLevelId,
            slides,
          })
          if (saveRes?.error) {
            toast({ title: tr('Lưu slide thất bại', 'Save slides failed', '保存幻灯片失败', 'スライド保存失敗', '슬라이드 저장 실패'), description: saveRes.error, variant: 'destructive' })
          }
          await saveOriginalSlidesIfNotExists({ curriculumId, slides })
          const [sharedRes, originalRes, personalRes] = await Promise.all([
            getSlidesByCurriculumId(curriculumId),
            getOriginalSlides(curriculumId),
            getUserCustomizedSlides(curriculumId),
          ])
          setSharedSlides(sharedRes?.success && sharedRes.slides?.length ? sharedRes.slides : null)
          setOriginalSlides(originalRes?.success && originalRes.slides?.length ? originalRes.slides : null)
          setPersonalSlides(personalRes?.success && personalRes.slides?.length ? personalRes.slides : null)
          setShowSlideVersionDialog(true)
        } else {
          setAiSlides(slides)
          setShowSlideViewer(true)
          setSlideVersionChoice(null)
        }
      } else {
        setAiSlides(null)
        setShowSlideViewer(true)
        setSlideVersionChoice(null)
        if (!res.ok) {
          toast({
            title: tr('Tạo nội dung giảng thất bại', 'Teaching content generation failed', '生成教学内容失败', '授業内容生成失敗', '수업 내용 생성 실패'),
            description: data?.error || tr('Dùng slide parse từ Markdown.', 'Using Markdown parsing.', '使用Markdown解析。', 'Markdown解析を使用。', 'Markdown 파싱 사용.'),
            variant: 'destructive',
          })
        }
      }
    } catch (err) {
      console.error('[curriculum-analyze-slides] Fetch lỗi:', err)
      setAiSlides(null)
      setShowSlideViewer(true)
      setSlideVersionChoice(null)
      toast({
        title: tr('Lỗi kết nối', 'Connection error', '连接错误', '接続エラー', '연결 오류'),
        description: err instanceof Error ? err.message : tr('Dùng nội dung parse từ Markdown.', 'Using Markdown parsing.', '使用Markdown解析。', 'Markdown解析を使用。', 'Markdown 파싱 사용.'),
        variant: 'destructive',
      })
    } finally {
      setSlideAnalysisLoading(false)
    }
  }

  const handleSlideVersionChoose = (choice: SlideVersionChoice) => {
    setSlideVersionChoice(choice)
    if (choice === 'original') {
      setAiSlides(originalSlides ?? sharedSlides ?? [])
    } else if (choice === 'shared') {
      setAiSlides(sharedSlides ?? originalSlides ?? [])
    } else {
      setAiSlides(personalSlides ?? [])
    }
    setShowSlideViewer(true)
  }

  const handleDownloadSlides = () => {
    const slidesMd = curriculumToSlidesMarkdown(curriculumMarkdown, displayTopic)
    const blob = new Blob([slidesMd], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `slide-bai-giang-${displayTopic.slice(0, 25).replace(/\s+/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: tr('Đã tải slide', 'Slides downloaded', '已下载幻灯片', 'スライドをダウンロード', '슬라이드 다운로드됨'), duration: 2000 })
  }

  const handleReset = () => {
    setStep('INPUT')
    setCurriculumMarkdown('')
    setCurriculumId(null)
    setWorksheetMarkdown('')
    setWorksheetId(null)
    setWorksheetQrDataUrl(null)
    setCurriculumWorksheets([])
    setCurriculumSlides(null)
    setAiSlides(null)
    setShowSlideViewer(false)
  }

  const [saveCurriculumLoading, setSaveCurriculumLoading] = useState(false)
  const handleSaveCurriculum = async () => {
    if (!curriculumMarkdown.trim()) return
    setSaveCurriculumLoading(true)
    const formData = new FormData()
    formData.append('curriculumMarkdown', curriculumMarkdown)
    formData.append('topic', displayTopic)
    formData.append('subjectId', subjectId)
    formData.append('gradeLevelId', gradeLevelId)
    formData.append('textbookSetId', textbookSetId)
    formData.append('textbookVolume', textbookVolume.trim())
    formData.append('lessonNumber', lessonNumber.trim())
    formData.append('lessonTypeId', lessonTypeId)
    formData.append('numLessons', String(numLessons))
    formData.append('lessonDurationMinutes', String(lessonDurationMinutes))
    formData.append('goals', goals)
    const result = await saveCurriculum(formData)
    setSaveCurriculumLoading(false)
    if (result.error) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error, variant: 'destructive' })
    } else if (result.success && result.curriculumId) {
      const newId = result.curriculumId
      setCurriculumId(newId)
      if (curriculumSlides && curriculumSlides.length > 0) {
        saveSlidesToCurriculum({ curriculumId: newId, topic: displayTopic, subjectId, gradeLevelId, slides: curriculumSlides }).catch(() => {})
      }
      toast({ title: tr('Đã lưu vào kho', 'Saved to library', '已保存到库', 'ライブラリに保存', '라이브러리에 저장됨'), duration: 2000 })
    }
  }

  const handleLoadCurriculum = async (id: string) => {
    const result = await getCurriculumById(id)
    if (result.error) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error, variant: 'destructive' })
      return
    }
    if (result.success && result.curriculum) {
      const c = result.curriculum as { id?: string; topic?: string; subject_id?: string; grade_level_id?: string; textbook_set_id?: string; textbook_volume?: string | null; lesson_number?: number | null; lesson_type_id?: string; num_lessons?: number; lesson_duration_minutes?: number; goals?: string; content_markdown?: string }
      setSubjectId(c.subject_id ?? 'toan')
      setGradeLevelId(normalizeGradeLevelId(c.grade_level_id ?? 'lop-12'))
      setTextbookSetId(c.textbook_set_id ?? 'ket-noi-tri-thuc')
      setTextbookVolume(c.textbook_volume ?? '')
      setTopic(c.topic ?? '')
      setLessonNumber(c.lesson_number != null ? String(c.lesson_number) : '1')
      setLessonTypeId(c.lesson_type_id ?? 'hinh-thanh-kien-thuc')
      setNumLessons(c.num_lessons ?? 5)
      setLessonDurationMinutes(c.lesson_duration_minutes ?? 45)
      setGoals(c.goals ?? '')
      setCurriculumMarkdown(c.content_markdown ?? '')
      setCurriculumId(c.id ?? null)
      setWorksheetMarkdown('')
      setWorksheetId(null)
      setWorksheetQrDataUrl(null)
      setStep('RESULT')
      setShowBrowse(false)
      setAiSlides(null)
      const wsRes = await getWorksheetsByCurriculumId(id)
      if (wsRes && 'items' in wsRes) setCurriculumWorksheets(wsRes.items)
      else setCurriculumWorksheets([])
      const slidesRes = await getSlidesByCurriculumId(id)
      if (slidesRes?.success && slidesRes.slides) setCurriculumSlides(slidesRes.slides)
      else setCurriculumSlides(null)
      toast({ title: tr('Đã tải giáo trình', 'Curriculum loaded', '已加载课程', 'カリキュラムを読み込み', '교육과정 로드됨'), duration: 2000 })
    }
  }

  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null)
  const curriculumTextareaRef = useRef<HTMLTextAreaElement>(null)
  const worksheetTextareaRef = useRef<HTMLTextAreaElement>(null)

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

  const handleLoadWorksheetFromCurriculum = (w: { id: string; topic: string; content_markdown: string }) => {
    setWorksheetMarkdown(w.content_markdown)
    setWorksheetId(w.id)
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    QRCode.toDataURL(`${baseUrl}/phieu-bai-tap/${w.id}`, { width: 180, margin: 2 }).then(setWorksheetQrDataUrl).catch(() => setWorksheetQrDataUrl(null))
  }

  const handleLoadWorksheet = async (id: string) => {
    const result = await getWorksheetById(id)
    if (result.error) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error, variant: 'destructive' })
      return
    }
    if (result.success && result.worksheet) {
      const w = result.worksheet as { id: string; topic: string; subject_id: string; grade_level_id: string; content_markdown: string; curriculum_id?: string }
      const curriculumIdFromWs = w.curriculum_id
      setTopic(w.topic ?? '')
      setSubjectId(w.subject_id ?? 'toan')
      setGradeLevelId(normalizeGradeLevelId(w.grade_level_id ?? 'lop-6'))
      setWorksheetMarkdown(w.content_markdown ?? '')
      setWorksheetId(w.id)
      setCurriculumId(curriculumIdFromWs ?? null)
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
      QRCode.toDataURL(`${baseUrl}/phieu-bai-tap/${w.id}`, { width: 180, margin: 2 }).then(setWorksheetQrDataUrl).catch(() => setWorksheetQrDataUrl(null))
      setStep('RESULT')
      setShowBrowse(false)
      if (curriculumIdFromWs) {
        const [curRes, wsRes, slidesRes] = await Promise.all([
          getCurriculumById(curriculumIdFromWs),
          getWorksheetsByCurriculumId(curriculumIdFromWs),
          getSlidesByCurriculumId(curriculumIdFromWs),
        ])
        if (curRes?.success && curRes.curriculum) {
          const c = curRes.curriculum as { textbook_set_id?: string; textbook_volume?: string | null; lesson_number?: number | null; lesson_type_id?: string; num_lessons?: number; lesson_duration_minutes?: number; goals?: string; content_markdown?: string; topic?: string }
          setTextbookSetId(c.textbook_set_id ?? 'ket-noi-tri-thuc')
          setTextbookVolume(c.textbook_volume ?? '')
          setTopic(c.topic ?? '')
          setLessonNumber(c.lesson_number != null ? String(c.lesson_number) : '1')
          setLessonTypeId(c.lesson_type_id ?? 'hinh-thanh-kien-thuc')
          setNumLessons(c.num_lessons ?? 5)
          setLessonDurationMinutes(c.lesson_duration_minutes ?? 45)
          setGoals(c.goals ?? '')
          setCurriculumMarkdown(c.content_markdown ?? '')
        }
        if (wsRes && 'items' in wsRes) setCurriculumWorksheets(wsRes.items)
        else setCurriculumWorksheets([])
        if (slidesRes?.success && slidesRes.slides) setCurriculumSlides(slidesRes.slides)
        else setCurriculumSlides(null)
      } else {
        setCurriculumMarkdown('')
        setCurriculumWorksheets([])
        setCurriculumSlides(null)
      }
      toast({ title: tr('Đã tải phiếu bài tập', 'Worksheet loaded', '已加载练习', 'ワークシートを読み込み', '워크시트 로드됨'), duration: 2000 })
    }
  }

  const handleCreateWorksheet = async () => {
    setWorksheetLoading(true)
    const formData = new FormData()
    formData.append('curriculumMarkdown', curriculumMarkdown)
    if (curriculumId) formData.append('curriculumId', curriculumId)
    formData.append('topic', displayTopic)
    formData.append('subjectId', subjectId)
    formData.append('gradeLevelId', gradeLevelId)
    formData.append('modelProvider', modelProvider)
    const result = await createWorksheet(formData)
    setWorksheetLoading(false)
    if (result.error) {
      toast({
        title: tr('Tạo phiếu bài tập thất bại', 'Create worksheet failed', '创建练习失败', 'ワークシート作成に失敗', '워크시트 생성 실패'),
        description: result.error,
        variant: 'destructive',
        duration: 5000,
      })
    } else if (result.success && result.worksheetMarkdown) {
      setWorksheetMarkdown(result.worksheetMarkdown)
      setWorksheetId(result.worksheetId ?? null)
      if (result.worksheetId) {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
        const url = `${baseUrl}/phieu-bai-tap/${result.worksheetId}`
        QRCode.toDataURL(url, { width: 180, margin: 2 }).then(setWorksheetQrDataUrl).catch(() => {})
      } else {
        setWorksheetQrDataUrl(null)
      }
      if (curriculumId) {
        const wsRes = await getWorksheetsByCurriculumId(curriculumId)
        if (wsRes && 'items' in wsRes) setCurriculumWorksheets(wsRes.items)
      }
      toast({
        title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'),
        description: tr('Phiếu bài tập đã được tạo.', 'Worksheet has been created.', '练习已创建。', 'ワークシートを作成しました。', '워크시트가 생성되었습니다.'),
        duration: 3000,
      })
    }
  }

  const handleCopyWorksheet = () => {
    navigator.clipboard.writeText(worksheetMarkdown)
    toast({ title: tr('Đã sao chép', 'Copied', '已复制', 'コピーしました', '복사됨'), duration: 2000 })
  }

  const handleDownloadWorksheet = () => {
    const blob = new Blob([worksheetMarkdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `phieu-bai-tap-${displayTopic.slice(0, 25).replace(/\s+/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: tr('Đã tải xuống', 'Downloaded', '已下载', 'ダウンロードしました', '다운로드됨'), duration: 2000 })
  }

  const handleExportPdf = () => {
    const name = `phieu-bai-tap-${displayTopic.slice(0, 25).replace(/\s+/g, '-')}.pdf`
    exportWorksheetToPdf(worksheetMarkdown, name, null).then(() => {
      toast({ title: tr('Đã tải PDF', 'PDF downloaded', '已下载PDF', 'PDFをダウンロード', 'PDF 다운로드됨'), duration: 2000 })
    }).catch(() => {
      toast({ title: tr('Xuất PDF thất bại', 'PDF export failed', 'PDF导出失败', 'PDFエクスポート失敗', 'PDF 내보내기 실패'), variant: 'destructive' })
    })
  }

  const handleExportWord = () => {
    const name = `phieu-bai-tap-${displayTopic.slice(0, 25).replace(/\s+/g, '-')}.docx`
    exportWorksheetToWord(worksheetMarkdown, name).then(() => {
      toast({ title: tr('Đã tải Word', 'Word downloaded', '已下载Word', 'Wordをダウンロード', 'Word 다운로드됨'), duration: 2000 })
    }).catch(() => {
      toast({ title: tr('Xuất Word thất bại', 'Word export failed', 'Word导出失败', 'Wordエクスポート失敗', 'Word 내보내기 실패'), variant: 'destructive' })
    })
  }

  return (
    <>
      <Toaster />
      <SlideVersionDialog
        open={showSlideVersionDialog}
        onOpenChange={setShowSlideVersionDialog}
        hasPersonal={!!personalSlides?.length}
        onChoose={handleSlideVersionChoose}
        tr={tr}
      />
      {showSlideViewer && curriculumMarkdown && (
        <GammaSlideViewer
          curriculumMarkdown={curriculumMarkdown}
          topic={displayTopic}
          onClose={() => { setShowSlideViewer(false); setAiSlides(null); setSlideVersionChoice(null) }}
          aiSlides={aiSlides}
          curriculumId={curriculumId}
          subjectId={subjectId}
          gradeLevelId={gradeLevelId}
          tr={tr}
          slideMode={slideVersionChoice ?? undefined}
          originalSlides={originalSlides ?? undefined}
          personalSlides={personalSlides ?? undefined}
          sharedSlides={sharedSlides ?? undefined}
          onSlidesSaved={async () => {
            if (curriculumId) {
              const [sharedRes, personalRes] = await Promise.all([
                getSlidesByCurriculumId(curriculumId),
                getUserCustomizedSlides(curriculumId),
              ])
              if (sharedRes?.success && sharedRes.slides) setSharedSlides(sharedRes.slides)
              if (personalRes?.success && personalRes.slides) setPersonalSlides(personalRes.slides)
            }
          }}
        />
      )}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            {tr('Tạo giáo trình bằng AI', 'AI Curriculum Creator', 'AI 课程创建', 'AI カリキュラム作成', 'AI 교육과정 생성')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {tr(
              'Chọn môn học, cấp độ, nhập chủ đề. AI tạo giáo trình chi tiết cho giáo viên.',
              'Select subject, grade level, enter topic. AI creates detailed curriculum for teachers.',
              '选择科目、年级，输入主题。AI 为教师创建详细课程。',
              '科目・学年を選択し、主題を入力。AIが教師向けの詳細カリキュラムを作成。',
              '과목, 학년 선택, 주제 입력. AI가 교사를 위한 상세 교육과정 생성.'
            )}
          </p>
        </div>

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
                          className="flex items-center gap-2 group"
                        >
                          <button
                            type="button"
                            onClick={() => void handleLoadCurriculum(c.id)}
                            className="flex-1 min-w-0 text-left text-sm px-2 py-1.5 rounded hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
                          >
                            <span className="font-medium truncate block">{c.topic}</span>
                            <span className="text-xs text-muted-foreground block">
                              {c.subject_id} · {c.grade_level_id}
                              {c.created_at && (
                                <span className="ml-1.5">· {formatCreatedAt(c.created_at)}</span>
                              )}
                            </span>
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 opacity-60 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                            onClick={(e) => void handleDeleteCurriculum(e, c.id)}
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

        {step === 'INPUT' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-violet-600" />
                {tr('Thông tin giáo trình', 'Curriculum info', '课程信息', 'カリキュラム情報', '교육과정 정보')}
              </CardTitle>
              <CardDescription>
                {tr('Chọn môn, lớp, sách, bài số (1–100). AI tạo giáo trình Markdown.', 'Select subject, grade, textbook, lesson number (1–100). AI generates Markdown curriculum.', '选择科目、年级、教材、课号（1–100）。AI 生成 Markdown 课程。', '科目・学年・教科書・課番号（1–100）を選択。AIがMarkdownカリキュラムを生成。', '과목·학년·교과서·차시(1–100) 선택. AI가 Markdown 교육과정 생성.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Bộ sách giáo khoa', 'Textbook set', '教材', '教科書', '교과서')}</label>
                  <select
                    value={textbookSetId}
                    onChange={(e) => setTextbookSetId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    {TEXTBOOK_SETS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {uiLocale === 'en' ? t.labelEn : t.labelVi}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Tập', 'Volume', '册', '巻', '권')}</label>
                  <select
                    value={textbookVolume}
                    onChange={(e) => setTextbookVolume(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    <option value="">{tr('Không phân tập', 'N/A', '不分册', '巻なし', '권 없음')}</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Loại bài học', 'Lesson type', '课程类型', '授業タイプ', '수업 유형')}</label>
                  <select
                    value={lessonTypeId}
                    onChange={(e) => setLessonTypeId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    {LESSON_TYPES.map((l) => (
                      <option key={l.id} value={l.id}>
                        {uiLocale === 'en' ? l.labelEn : l.labelVi}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  {tr('Bài số', 'Lesson number', '课号', '課番号', '차시 번호')} <span className="text-red-500">*</span>
                </label>
                <select
                  value={lessonNumber}
                  onChange={(e) => setLessonNumber(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm max-w-[120px]"
                >
                  {Array.from({ length: 100 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
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
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Mô hình AI', 'AI model', 'AI 模型', 'AIモデル', 'AI 모델')}</label>
                <select
                  value={modelProvider}
                  onChange={(e) => setModelProvider(e.target.value as 'gemini' | 'deepseek')}
                  className="w-full sm:max-w-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-sm bg-white/80"
                >
                  <option value="gemini">{tr('Gemini 2.0 Flash', 'Gemini 2.0 Flash', 'Gemini 2.0 Flash', 'Gemini 2.0 Flash', 'Gemini 2.0 Flash')}</option>
                  <option value="deepseek">{tr('DeepSeek V3', 'DeepSeek V3', 'DeepSeek V3', 'DeepSeek V3', 'DeepSeek V3')}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Mục tiêu bổ sung (tùy chọn)', 'Additional goals (optional)', '补充目标（可选）', '追加目標（任意）', '추가 목표 (선택)')}</label>
                <Textarea
                  placeholder={tr('Mô tả mục tiêu, yêu cầu đặc biệt...', 'Describe goals, special requirements...', '描述目标、特殊要求...', '目標・特別な要件を記述...', '목표, 특별 요구사항 설명...')}
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  className="bg-white/80 min-h-[80px] resize-y"
                />
              </div>
              <Button onClick={() => void handleSubmit()} disabled={step === 'GENERATING'} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
                <Sparkles className="h-4 w-4 mr-2" />
                {tr('Tạo giáo trình', 'Create curriculum', '创建课程', 'カリキュラムを作成', '교육과정 생성')}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'GENERATING' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-violet-200/60">
            <CardContent className="flex flex-col items-center py-12">
              <RefreshCw className="h-12 w-12 text-violet-500 animate-spin" />
              <p className="text-sm text-muted-foreground mt-4">{tr('AI đang tạo giáo trình...', 'AI is creating curriculum...', 'AI 正在创建课程...', 'AIがカリキュラムを作成中...', 'AI가 교육과정 생성 중...')}</p>
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && (curriculumMarkdown || worksheetMarkdown) && (
          <>
            {curriculumMarkdown && (
            <Card className="border shadow-sm overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">{tr('Giáo trình đã tạo', 'Generated curriculum', '已创建课程', '作成したカリキュラム', '생성된 교육과정')}</CardTitle>
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
                  <Button variant="outline" size="sm" onClick={() => void handleOpenSlides()} disabled={slideAnalysisLoading} className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-950/30">
                    <Presentation className="h-3.5 w-3.5 mr-1" />
                    {slideAnalysisLoading ? tr('Đang tạo nội dung giảng...', 'Generating teaching content...', '正在生成教学内容...', '授業内容を生成中...', '수업 내용 생성 중...') : tr('Xem slide (Gamma)', 'View slides (Gamma)', '查看幻灯片', 'スライド表示', '슬라이드 보기')}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => void handleCreateWorksheet()}
                    disabled={worksheetLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
                    {worksheetLoading
                      ? tr('Đang tạo...', 'Creating...', '创建中...', '作成中...', '생성 중...')
                      : tr('Tạo Phiếu bài tập đi kèm', 'Create worksheet', '创建练习', 'ワークシート作成', '워크시트 생성')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    {tr('Tạo mới', 'Create new', '新建', '新規作成', '새로 만들기')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border bg-slate-50 dark:bg-slate-900/50 p-4 overflow-auto max-h-[60vh]">
                  <textarea
                    ref={curriculumTextareaRef}
                    value={curriculumMarkdown}
                    onChange={(e) => setCurriculumMarkdown(e.target.value)}
                    className="w-full min-h-[200px] text-sm font-sans leading-relaxed prose prose-slate dark:prose-invert max-w-none bg-transparent border-0 resize-y focus:outline-none focus:ring-0"
                    placeholder={tr('Nội dung giáo trình...', 'Curriculum content...', '课程内容...', 'カリキュラム内容...', '교육과정 내용...')}
                    spellCheck={false}
                  />
                </div>
              </CardContent>
              {curriculumWorksheets.length > 0 && (
                <CardContent className="pt-0 border-t">
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
              <Card className="border shadow-sm overflow-hidden border-emerald-200/60">
                <div className="bg-violet-100 dark:bg-violet-950/50 px-4 py-4 border-b-2 border-violet-300 dark:border-violet-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">
                    {tr('Phiếu bài tập đã sẵn sàng. Nhấn nút bên dưới để tải:', 'Worksheet ready. Click below to download:', '练习已就绪。点击下方下载：', 'ワークシート準備完了。下のボタンでダウンロード：', '워크시트 준비됨. 아래 버튼으로 다운로드:')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="default" onClick={handleDownloadWorksheet} className="bg-white border-2 border-violet-500 text-violet-700 hover:bg-violet-50 dark:bg-violet-900/50 dark:border-violet-400 dark:text-violet-200 dark:hover:bg-violet-800/50">
                      <FileDown className="h-4 w-4 mr-2" /> {tr('Tải .md', 'Download .md', '下载 .md', '.md をダウンロード', '.md 다운로드')}
                    </Button>
                    <Button size="default" onClick={handleExportPdf} className="bg-violet-600 hover:bg-violet-700 text-white border-2 border-violet-600">
                      <FileDown className="h-4 w-4 mr-2" /> {tr('Tải PDF', 'Download PDF', '下载 PDF', 'PDF をダウンロード', 'PDF 다운로드')}
                    </Button>
                    <Button size="default" onClick={handleExportWord} className="bg-violet-600 hover:bg-violet-700 text-white border-2 border-violet-600">
                      <FileDown className="h-4 w-4 mr-2" /> {tr('Tải Word', 'Download Word', '下载 Word', 'Word をダウンロード', 'Word 다운로드')}
                    </Button>
                  </div>
                </div>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    {tr('Phiếu bài tập', 'Worksheet', '练习', 'ワークシート', '워크시트')}
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopyWorksheet}>
                      <Copy className="h-3.5 w-3.5 mr-1" /> {tr('Sao chép', 'Copy', '复制', 'コピー', '복사')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownloadWorksheet}>
                      <FileDown className="h-3.5 w-3.5 mr-1" /> .md
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportPdf}>
                      <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportWord}>
                      <FileDown className="h-3.5 w-3.5 mr-1" /> Word
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      {tr('Tạo mới', 'Create new', '新建', '新規作成', '새로 만들기')}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {worksheetQrDataUrl && worksheetId && (
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60">
                      <img src={worksheetQrDataUrl} alt="QR" className="w-[120px] h-[120px] rounded border bg-white p-1" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200 flex items-center gap-1">
                          <QrCode className="h-4 w-4" />
                          {tr('Quét mã QR xem lời giải', 'Scan QR to view answers', '扫码查看答案', 'QRで解答を表示', 'QR로 정답 보기')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {tr('In phiếu kèm QR, học sinh quét bằng điện thoại để xem đáp án chi tiết.', 'Print worksheet with QR, students scan with phone to view detailed answers.', '打印带QR的练习，学生用手机扫码查看详细答案。', 'QR付きで印刷、生徒がスマホでスキャンして解答を表示。', 'QR 포함 인쇄 후 학생이 휴대폰으로 스캔해 정답 확인.')}
                        </p>
                        <a
                          href={`/phieu-bai-tap/${worksheetId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-600 hover:underline mt-1 inline-block truncate max-w-full"
                        >
                          /phieu-bai-tap/{worksheetId.slice(0, 8)}...
                        </a>
                      </div>
                    </div>
                  )}
                  <div className="rounded-lg border bg-slate-50 dark:bg-slate-900/50 p-4 overflow-auto max-h-[60vh]">
                    <textarea
                      ref={worksheetTextareaRef}
                      value={worksheetMarkdown}
                      onChange={(e) => setWorksheetMarkdown(e.target.value)}
                      className="w-full min-h-[200px] text-sm font-sans leading-relaxed prose prose-slate dark:prose-invert max-w-none bg-transparent border-0 resize-y focus:outline-none focus:ring-0"
                      placeholder={tr('Nội dung phiếu bài tập...', 'Worksheet content...', '练习内容...', 'ワークシート内容...', '워크시트 내용...')}
                      spellCheck={false}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

          </>
        )}
      </div>
    </>
  )
}
